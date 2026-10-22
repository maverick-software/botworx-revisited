// Episodic Memory Manager
// Specialized handling for episodic memories (conversation history and experiences)

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  EpisodicMemory,
  AgentMemory,
} from '../../types/memory.types.ts';
import { AdvancedChatMessage } from '../../types/message.types.ts';
import { MemoryFactory, ConversationSummary } from './memory_factory.ts';
import { generateTimestamp } from '../../types/utils.ts';

// ============================
// Interfaces
// ============================

export interface EpisodicQuery {
  agent_id: string;
  timeframe?: {
    start: string;
    end: string;
  };
  participants?: string[];
  event_types?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  min_importance?: number;
  limit?: number;
}

export interface ConversationThread {
  thread_id: string;
  messages: AdvancedChatMessage[];
  summary: ConversationSummary;
  participants: string[];
  duration_ms: number;
  key_events: EpisodicMemory[];
}

export interface MemoryTimeline {
  agent_id: string;
  timeframe: {
    start: string;
    end: string;
  };
  events: Array<{
    timestamp: string;
    memory: EpisodicMemory;
    context: 'conversation' | 'tool_use' | 'system_event';
  }>;
  patterns: Array<{
    pattern: string;
    frequency: number;
    examples: string[];
  }>;
}

// ============================
// Episodic Memory Manager Implementation
// ============================

export class EpisodicMemoryManager {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Create episodic memory from a conversation
   */
  async createFromConversation(
    messages: AdvancedChatMessage[],
    auto_consolidate: boolean = true
  ): Promise<string[]> {
    const memories: string[] = [];
    
    // Create memory for each significant message
    for (const message of messages) {
      if (this.isSignificantMessage(message)) {
        const memory = MemoryFactory.createFromMessage(message);
        const memoryId = await this.storeEpisodicMemory(memory as EpisodicMemory);
        memories.push(memoryId);
      }
    }
    
    // Create conversation summary memory
    if (messages.length >= 3) {
      const summary = this.analyzeConversation(messages);
      const conversationMemory = MemoryFactory.createFromConversation(
        messages,
        summary
      );
      const summaryId = await this.storeEpisodicMemory(conversationMemory as EpisodicMemory);
      memories.push(summaryId);
    }
    
    // Auto-consolidate if requested
    if (auto_consolidate && memories.length > 5) {
      await this.consolidateRelatedMemories(memories);
    }
    
    return memories;
  }
  
  /**
   * Retrieve episodic memories based on query
   */
  async query(query: EpisodicQuery): Promise<EpisodicMemory[]> {
    let dbQuery = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', query.agent_id)
      .eq('memory_type', 'episodic');
    
    // Apply timeframe filter
    if (query.timeframe) {
      dbQuery = dbQuery
        .gte('created_at', query.timeframe.start)
        .lte('created_at', query.timeframe.end);
    }
    
    // Apply participant filter
    if (query.participants) {
      dbQuery = dbQuery.contains('content->participants', query.participants);
    }
    
    // Apply importance filter
    if (query.min_importance) {
      dbQuery = dbQuery.gte('importance', query.min_importance);
    }
    
    const { data, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(query.limit || 50);
    
    if (error) {
      throw new Error(`Failed to query episodic memories: ${error.message}`);
    }
    
    // Filter by additional criteria
    let filtered = (data || []) as EpisodicMemory[];
    
    if (query.event_types) {
      filtered = filtered.filter(memory => 
        query.event_types!.some(type => 
          memory.content.event.toLowerCase().includes(type.toLowerCase())
        )
      );
    }
    
    if (query.sentiment) {
      filtered = filtered.filter(memory => 
        memory.content.sentiment === query.sentiment
      );
    }
    
    return filtered;
  }
  
  /**
   * Get conversation threads for an agent
   */
  async getConversationThreads(
    agent_id: string,
    timeframe?: { start: string; end: string }
  ): Promise<ConversationThread[]> {
    const query: EpisodicQuery = {
      agent_id,
      timeframe,
      event_types: ['conversation', 'message'],
    };
    
    const memories = await this.query(query);
    
    // Group by conversation_id
    const conversationGroups = new Map<string, EpisodicMemory[]>();
    
    for (const memory of memories) {
      const conversationId = memory.content.context.conversation_id;
      if (conversationId) {
        if (!conversationGroups.has(conversationId)) {
          conversationGroups.set(conversationId, []);
        }
        conversationGroups.get(conversationId)!.push(memory);
      }
    }
    
    // Build conversation threads
    const threads: ConversationThread[] = [];
    
    for (const [conversationId, threadMemories] of conversationGroups) {
      const thread = await this.buildConversationThread(
        conversationId,
        threadMemories
      );
      threads.push(thread);
    }
    
    return threads.sort((a, b) => 
      new Date(b.summary.key_topics[0] || '').getTime() - 
      new Date(a.summary.key_topics[0] || '').getTime()
    );
  }
  
  /**
   * Generate memory timeline for an agent
   */
  async generateTimeline(
    agent_id: string,
    timeframe: { start: string; end: string }
  ): Promise<MemoryTimeline> {
    const memories = await this.query({
      agent_id,
      timeframe,
    });
    
    // Create timeline events
    const events = memories.map(memory => ({
      timestamp: memory.created_at,
      memory,
      context: this.categorizeMemoryContext(memory),
    })).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Detect patterns
    const patterns = this.detectTimelinePatterns(memories);
    
    return {
      agent_id,
      timeframe,
      events,
      patterns,
    };
  }
  
  /**
   * Find related memories based on content similarity
   */
  async findRelated(
    memory_id: string,
    max_results: number = 10
  ): Promise<EpisodicMemory[]> {
    // Get the source memory
    const { data: sourceMemory, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('id', memory_id)
      .single();
    
    if (error || !sourceMemory) {
      throw new Error(`Source memory not found: ${memory_id}`);
    }
    
    // Find memories with similar participants
    const participants = sourceMemory.content.participants || [];
    let relatedQuery = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', sourceMemory.agent_id)
      .eq('memory_type', 'episodic')
      .neq('id', memory_id);
    
    // Add participant filter if available
    if (participants.length > 0) {
      relatedQuery = relatedQuery.overlaps('content->participants', participants);
    }
    
    const { data, error: queryError } = await relatedQuery
      .order('created_at', { ascending: false })
      .limit(max_results * 2); // Get more to filter later
    
    if (queryError) {
      throw new Error(`Failed to find related memories: ${queryError.message}`);
    }
    
    // Score and rank by similarity
    const scored = (data || []).map(memory => ({
      memory: memory as EpisodicMemory,
      score: this.calculateMemorySimilarity(sourceMemory, memory),
    }));
    
    return scored
      .filter(item => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, max_results)
      .map(item => item.memory);
  }
  
  /**
   * Update memory with new access information
   */
  async recordAccess(memory_id: string): Promise<void> {
    await this.supabase.rpc('increment_memory_access', {
      memory_id,
    });
  }
  
  /**
   * Consolidate related episodic memories
   */
  async consolidateRelatedMemories(memory_ids: string[]): Promise<string> {
    // Fetch memories to consolidate
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .in('id', memory_ids);
    
    if (error || !memories) {
      throw new Error(`Failed to fetch memories for consolidation: ${error?.message}`);
    }
    
    // Group by conversation or timeframe
    const groups = this.groupMemoriesForConsolidation(memories as EpisodicMemory[]);
    
    // Create consolidated memories
    const consolidatedIds: string[] = [];
    
    for (const group of groups) {
      if (group.length >= 3) {
        const consolidated = await this.createConsolidatedMemory(group);
        consolidatedIds.push(consolidated);
        
        // Delete original memories
        await this.supabase
          .from('agent_memories')
          .delete()
          .in('id', group.map(m => m.id));
      }
    }
    
    return consolidatedIds[0] || '';
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private async storeEpisodicMemory(memory: EpisodicMemory): Promise<string> {
    // Ensure we never pass a non-UUID id value (e.g., mem_*) into the table insert
    const cleanMemory: any = { ...memory };
    if (cleanMemory && typeof cleanMemory.id === 'string' && cleanMemory.id.startsWith('mem_')) {
      delete cleanMemory.id; // let DB generate a UUID
    }

    // If source_message_id is present but not a valid UUID, drop it to satisfy FK
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (cleanMemory && typeof cleanMemory.source_message_id === 'string' && !uuidRegex.test(cleanMemory.source_message_id)) {
      delete cleanMemory.source_message_id;
    }

    const { data, error } = await this.supabase
      .from('agent_memories')
      .insert(cleanMemory)
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Failed to store episodic memory: ${error.message}`);
    }
    
    return data.id;
  }
  
  private isSignificantMessage(message: AdvancedChatMessage): boolean {
    // Skip very short messages
    if (message.content.type === 'text' && message.content.text.length < 20) {
      return false;
    }
    
    // Always include tool usage
    if (message.tools && message.tools.length > 0) {
      return true;
    }
    
    // Include questions
    if (message.content.type === 'text' && message.content.text.includes('?')) {
      return true;
    }
    
    // Include emotional content
    const emotionalWords = ['excited', 'frustrated', 'confused', 'happy', 'sad', 'angry'];
    if (message.content.type === 'text' && 
        emotionalWords.some(word => 
          message.content.text.toLowerCase().includes(word)
        )) {
      return true;
    }
    
    return message.role === 'user'; // Include all user messages by default
  }
  
  private analyzeConversation(messages: AdvancedChatMessage[]): ConversationSummary {
    const participants = [...new Set(messages.map(m => m.role))];
    const start = new Date(messages[0].timestamp).getTime();
    const end = new Date(messages[messages.length - 1].timestamp).getTime();
    
    // Extract key topics (simplified)
    const allText = messages
      .filter(m => m.content.type === 'text')
      .map(m => m.content.text)
      .join(' ');
    
    const keyTopics = this.extractKeywords(allText, 5);
    
    // Determine sentiment
    const sentiments = messages.map(m => this.detectSentiment(m));
    const overallSentiment = this.aggregateSentiment(sentiments);
    
    // Determine resolution status
    const resolutionStatus = this.analyzeResolutionStatus(messages);
    
    return {
      participant_count: participants.length,
      message_count: messages.length,
      duration_ms: end - start,
      key_topics: keyTopics,
      sentiment: overallSentiment,
      resolution_status: resolutionStatus,
    };
  }
  
  private extractKeywords(text: string, count: number): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4);
    
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([word]) => word);
  }
  
  private detectSentiment(message: AdvancedChatMessage): 'positive' | 'neutral' | 'negative' {
    if (message.content.type !== 'text') return 'neutral';
    
    const text = message.content.text.toLowerCase();
    
    const positiveWords = ['thank', 'great', 'good', 'excellent', 'perfect', 'amazing', 'love'];
    const negativeWords = ['error', 'problem', 'issue', 'wrong', 'bad', 'terrible', 'hate'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
  
  private aggregateSentiment(
    sentiments: ('positive' | 'neutral' | 'negative')[]
  ): 'positive' | 'neutral' | 'negative' {
    const counts = sentiments.reduce((acc, sentiment) => {
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const max = Math.max(counts.positive || 0, counts.neutral || 0, counts.negative || 0);
    
    if (counts.positive === max) return 'positive';
    if (counts.negative === max) return 'negative';
    return 'neutral';
  }
  
  private analyzeResolutionStatus(
    messages: AdvancedChatMessage[]
  ): 'resolved' | 'ongoing' | 'pending' {
    const lastMessages = messages.slice(-3);
    const hasQuestion = lastMessages.some(m => 
      m.content.type === 'text' && m.content.text.includes('?')
    );
    
    if (hasQuestion) return 'pending';
    
    const hasThankYou = lastMessages.some(m => 
      m.content.type === 'text' && 
      (m.content.text.toLowerCase().includes('thank') ||
       m.content.text.toLowerCase().includes('perfect') ||
       m.content.text.toLowerCase().includes('solved'))
    );
    
    return hasThankYou ? 'resolved' : 'ongoing';
  }
  
  private async buildConversationThread(
    conversationId: string,
    memories: EpisodicMemory[]
  ): Promise<ConversationThread> {
    // Reconstruct messages from memories (simplified)
    const messages: AdvancedChatMessage[] = memories
      .filter(m => m.source_message_id)
      .map(m => ({
        id: m.source_message_id!,
        version: '2.0.0',
        role: m.content.participants[0] as any,
        content: { type: 'text', text: m.content.event },
        timestamp: m.created_at,
        created_at: m.created_at,
        metadata: {},
        context: m.content.context,
      }));
    
    const summary = this.analyzeConversation(messages);
    
    return {
      thread_id: conversationId,
      messages,
      summary,
      participants: [...new Set(memories.flatMap(m => m.content.participants))],
      duration_ms: summary.duration_ms,
      key_events: memories.slice(0, 5), // Top 5 key events
    };
  }
  
  private categorizeMemoryContext(
    memory: EpisodicMemory
  ): 'conversation' | 'tool_use' | 'system_event' {
    if (memory.content.context.tools_used && 
        memory.content.context.tools_used.length > 0) {
      return 'tool_use';
    }
    
    if (memory.content.participants.includes('system')) {
      return 'system_event';
    }
    
    return 'conversation';
  }
  
  private detectTimelinePatterns(memories: EpisodicMemory[]): Array<{
    pattern: string;
    frequency: number;
    examples: string[];
  }> {
    const patterns = new Map<string, string[]>();
    
    // Look for recurring patterns
    for (const memory of memories) {
      const event = memory.content.event.toLowerCase();
      
      // Tool usage patterns
      const tools = memory.content.context.tools_used || [];
      for (const tool of tools) {
        const pattern = `tool_usage_${tool}`;
        if (!patterns.has(pattern)) patterns.set(pattern, []);
        patterns.get(pattern)!.push(event);
      }
      
      // Participant patterns
      const participants = memory.content.participants.filter(p => p !== 'assistant');
      if (participants.length > 0) {
        const pattern = `interaction_with_${participants.join('_')}`;
        if (!patterns.has(pattern)) patterns.set(pattern, []);
        patterns.get(pattern)!.push(event);
      }
      
      // Sentiment patterns
      const sentimentPattern = `${memory.content.sentiment}_interaction`;
      if (!patterns.has(sentimentPattern)) patterns.set(sentimentPattern, []);
      patterns.get(sentimentPattern)!.push(event);
    }
    
    // Convert to result format
    return Array.from(patterns.entries())
      .filter(([, examples]) => examples.length >= 2)
      .map(([pattern, examples]) => ({
        pattern: pattern.replace(/_/g, ' '),
        frequency: examples.length,
        examples: examples.slice(0, 3),
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }
  
  private calculateMemorySimilarity(
    memory1: EpisodicMemory,
    memory2: EpisodicMemory
  ): number {
    let score = 0;
    
    // Participant overlap
    const participants1 = new Set(memory1.content.participants);
    const participants2 = new Set(memory2.content.participants);
    const participantOverlap = [...participants1].filter(p => participants2.has(p)).length;
    score += (participantOverlap / Math.max(participants1.size, participants2.size)) * 0.3;
    
    // Context similarity
    if (memory1.content.context.conversation_id === memory2.content.context.conversation_id) {
      score += 0.4;
    }
    
    // Tool usage similarity
    const tools1 = new Set(memory1.content.context.tools_used || []);
    const tools2 = new Set(memory2.content.context.tools_used || []);
    const toolOverlap = [...tools1].filter(t => tools2.has(t)).length;
    if (tools1.size > 0 || tools2.size > 0) {
      score += (toolOverlap / Math.max(tools1.size, tools2.size)) * 0.2;
    }
    
    // Temporal proximity
    const time1 = new Date(memory1.created_at).getTime();
    const time2 = new Date(memory2.created_at).getTime();
    const timeDiff = Math.abs(time1 - time2);
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    const temporalScore = Math.max(0, 1 - daysDiff / 7); // Similar if within a week
    score += temporalScore * 0.1;
    
    return score;
  }
  
  private groupMemoriesForConsolidation(
    memories: EpisodicMemory[]
  ): EpisodicMemory[][] {
    const groups: EpisodicMemory[][] = [];
    const used = new Set<string>();
    
    for (const memory of memories) {
      if (used.has(memory.id)) continue;
      
      const group = [memory];
      used.add(memory.id);
      
      // Find similar memories
      for (const other of memories) {
        if (used.has(other.id)) continue;
        
        const similarity = this.calculateMemorySimilarity(memory, other);
        if (similarity > 0.7) {
          group.push(other);
          used.add(other.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
  
  private async createConsolidatedMemory(
    memories: EpisodicMemory[]
  ): Promise<string> {
    const participants = [...new Set(memories.flatMap(m => m.content.participants))];
    const tools = [...new Set(memories.flatMap(m => m.content.context.tools_used || []))];
    const events = memories.map(m => m.content.event);
    
    const consolidated: Partial<EpisodicMemory> = {
      agent_id: memories[0].agent_id,
      memory_type: 'episodic',
      content: {
        event: `Consolidated: ${events.join(', ')}`,
        participants,
        context: {
          ...memories[0].content.context,
          tools_used: tools,
          consolidated_from: memories.map(m => m.id),
          original_count: memories.length,
        },
        outcome: 'consolidated',
        sentiment: this.aggregateSentiment(memories.map(m => m.content.sentiment)),
      },
      importance: Math.max(...memories.map(m => m.importance)),
      decay_rate: 0.05, // Consolidated memories decay slower
      access_count: memories.reduce((sum, m) => sum + m.access_count, 0),
      related_memories: memories.map(m => m.id),
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
    };
    
    return await this.storeEpisodicMemory(consolidated as EpisodicMemory);
  }
}