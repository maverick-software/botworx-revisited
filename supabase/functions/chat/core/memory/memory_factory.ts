// Memory Factory
// Creates memories from various sources (messages, conversations, tools, patterns)

import {
  AgentMemory,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  WorkingMemory,
} from '../../types/memory.types.ts';
import { AdvancedChatMessage, ToolCall } from '../../types/message.types.ts';
import { generateMemoryId, generateTimestamp } from '../../types/utils.ts';

// ============================
// Interfaces
// ============================

export interface ToolResult {
  tool_id: string;
  tool_name: string;
  result: any;
  success: boolean;
  execution_time_ms: number;
  context: string;
}

export interface ConversationSummary {
  participant_count: number;
  message_count: number;
  duration_ms: number;
  key_topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  resolution_status: 'resolved' | 'ongoing' | 'pending';
}

export interface DetectedPattern {
  pattern_type: 'behavioral' | 'conversational' | 'tool_usage' | 'problem_solving';
  pattern_name: string;
  frequency: number;
  success_rate: number;
  contexts: string[];
  triggers: string[];
  outcomes: string[];
}

export interface MemoryCreationOptions {
  importance?: number;
  decay_rate?: number;
  expires_in_days?: number;
  related_memories?: string[];
  force_consolidation?: boolean;
}

// ============================
// Memory Factory Implementation
// ============================

export class MemoryFactory {
  /**
   * Create episodic memory from a single message
   */
  static createFromMessage(
    message: AdvancedChatMessage,
    options: MemoryCreationOptions = {}
  ): Partial<EpisodicMemory> {
    const importance = options.importance || MemoryFactory.calculateMessageImportance(message);
    
    return {
      id: generateMemoryId(),
      agent_id: message.context?.agent_id || '',
      memory_type: 'episodic',
      content: {
        event: `Message from ${message.role}`,
        participants: [message.role],
        temporal: {
          timestamp: message.timestamp || generateTimestamp(),
        },
        context: {
          conversation_id: message.context?.conversation_id,
          session_id: message.context?.session_id,
          channel_id: message.context?.channel_id,
          workspace_id: message.context?.workspace_id,
          message_content: message.content,
          tools_used: message.tools?.map(t => t.tool_name) || [],
          timestamp: message.timestamp,
        },
        outcome: message.role === 'assistant' ? 'response_provided' : 'query_received',
        sentiment: MemoryFactory.detectSentiment(message),
      },
      importance,
      decay_rate: options.decay_rate || 0.1,
      access_count: 0,
      related_memories: options.related_memories || [],
      // Don't set source_message_id unless we know it exists in chat_messages_v2
      // source_message_id: message.id,
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
      expires_at: options.expires_in_days ? 
        new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
    };
  }
  
  /**
   * Create episodic memory from a conversation
   */
  static createFromConversation(
    messages: AdvancedChatMessage[],
    summary: ConversationSummary,
    options: MemoryCreationOptions = {}
  ): Partial<EpisodicMemory> {
    if (messages.length === 0) {
      throw new Error('Cannot create memory from empty conversation');
    }
    
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const participants = [...new Set(messages.map(m => m.role))];
    
    const importance = options.importance || Math.min(
      0.3 + (summary.message_count * 0.05),
      1.0
    );
    
    return {
      id: generateMemoryId(),
      agent_id: firstMessage.context?.agent_id || '',
      memory_type: 'episodic',
      content: {
        event: `Conversation with ${participants.filter(p => p !== 'assistant').join(', ')}`,
        participants,
        temporal: {
          start_time: firstMessage.timestamp || generateTimestamp(),
          end_time: lastMessage.timestamp || generateTimestamp(),
          duration_ms: summary.duration_ms,
        },
        context: {
          conversation_id: firstMessage.context?.conversation_id,
          session_id: firstMessage.context?.session_id,
          channel_id: firstMessage.context?.channel_id,
          workspace_id: firstMessage.context?.workspace_id,
          start_time: firstMessage.timestamp,
          end_time: lastMessage.timestamp,
          duration_ms: summary.duration_ms,
          message_count: summary.message_count,
          key_topics: summary.key_topics,
          tools_used: messages.flatMap(m => m.tools?.map(t => t.tool_name) || []),
        },
        outcome: summary.resolution_status,
        sentiment: summary.sentiment,
      },
      importance,
      decay_rate: options.decay_rate || 0.08,
      access_count: 0,
      related_memories: options.related_memories || messages.map(m => m.id),
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
      expires_at: options.expires_in_days ? 
        new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
    };
  }
  
  /**
   * Create semantic memory from a concept or fact
   */
  static createFromConcept(
    agent_id: string,
    concept: string,
    definition: string,
    source: string = 'learned',
    options: MemoryCreationOptions = {}
  ): Partial<SemanticMemory> {
    const importance = options.importance || 0.6;
    
    return {
      id: generateMemoryId(),
      agent_id,
      memory_type: 'semantic',
      content: {
        concept,
        definition,
        source,
        confidence: 0.8,
        last_verified: generateTimestamp(),
        references: [],
      },
      importance,
      decay_rate: options.decay_rate || 0.05, // Semantic memories decay slower
      access_count: 0,
      related_memories: options.related_memories || [],
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
      expires_at: options.expires_in_days ? 
        new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
    };
  }
  
  /**
   * Create procedural memory from a detected pattern
   */
  static createFromPattern(
    agent_id: string,
    pattern: DetectedPattern,
    options: MemoryCreationOptions = {}
  ): Partial<ProceduralMemory> {
    const importance = options.importance || Math.min(
      0.4 + (pattern.frequency * 0.1) + (pattern.success_rate * 0.5),
      1.0
    );
    
    // Convert pattern to procedural steps
    const steps = MemoryFactory.patternToSteps(pattern);
    
    return {
      id: generateMemoryId(),
      agent_id,
      memory_type: 'procedural',
      content: {
        skill: pattern.pattern_name,
        steps,
        conditions: pattern.triggers,
        success_indicators: pattern.outcomes.filter(o => o.includes('success')),
        frequency: pattern.frequency,
        success_rate: pattern.success_rate,
        last_used: generateTimestamp(),
      },
      importance,
      decay_rate: options.decay_rate || 0.07,
      access_count: pattern.frequency,
      related_memories: options.related_memories || [],
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
      expires_at: options.expires_in_days ? 
        new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
    };
  }
  
  /**
   * Create working memory for temporary context
   */
  static createWorkingMemory(
    agent_id: string,
    items: string[],
    capacity: number = 7,
    options: MemoryCreationOptions = {}
  ): Partial<WorkingMemory> {
    // Limit to capacity (Miller's 7±2 rule)
    const limitedItems = items.slice(-capacity);
    
    return {
      id: generateMemoryId(),
      agent_id,
      memory_type: 'working',
      content: {
        items: limitedItems,
        capacity,
        current_focus: limitedItems[limitedItems.length - 1],
        processing_queue: limitedItems.slice(0, -1),
      },
      importance: options.importance || 0.9, // Working memory is always important
      decay_rate: options.decay_rate || 0.5, // Working memory decays fast
      access_count: 0,
      related_memories: options.related_memories || [],
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour default
    };
  }
  
  /**
   * Create memory from tool execution result
   */
  static createFromTool(
    agent_id: string,
    toolResult: ToolResult,
    options: MemoryCreationOptions = {}
  ): Partial<EpisodicMemory> {
    const importance = options.importance || (
      toolResult.success ? 0.6 : 0.8 // Failed tools are more important to remember
    );
    
    return {
      id: generateMemoryId(),
      agent_id,
      memory_type: 'episodic',
      content: {
        event: `Tool execution: ${toolResult.tool_name}`,
        participants: ['assistant'],
        context: {
          tool_id: toolResult.tool_id,
          tool_name: toolResult.tool_name,
          execution_context: toolResult.context,
          result: toolResult.result,
          success: toolResult.success,
          execution_time_ms: toolResult.execution_time_ms,
          timestamp: generateTimestamp(),
        },
        outcome: toolResult.success ? 'tool_success' : 'tool_failure',
        sentiment: toolResult.success ? 'positive' : 'negative',
      },
      importance,
      decay_rate: options.decay_rate || 0.12,
      access_count: 0,
      related_memories: options.related_memories || [],
      created_at: generateTimestamp(),
      last_accessed: generateTimestamp(),
      expires_at: options.expires_in_days ? 
        new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
    };
  }
  
  /**
   * Create multiple memories from a batch of messages
   */
  static createBatchFromMessages(
    messages: AdvancedChatMessage[],
    options: MemoryCreationOptions = {}
  ): Partial<AgentMemory>[] {
    const memories: Partial<AgentMemory>[] = [];
    
    // Create individual message memories
    for (const message of messages) {
      if (MemoryFactory.shouldCreateMemoryFromMessage(message)) {
        memories.push(MemoryFactory.createFromMessage(message, options));
      }
    }
    
    // Create conversation summary memory if enough messages
    if (messages.length >= 3) {
      const summary = MemoryFactory.summarizeConversation(messages);
      memories.push(MemoryFactory.createFromConversation(messages, summary, options));
    }
    
    // Extract semantic concepts
    const concepts = MemoryFactory.extractConcepts(messages);
    for (const [concept, definition] of concepts) {
      const agent_id = messages[0]?.context?.agent_id || '';
      memories.push(MemoryFactory.createFromConcept(
        agent_id,
        concept,
        definition,
        'conversation',
        options
      ));
    }
    
    return memories;
  }
  
  // ============================
  // Private Utility Methods
  // ============================
  
  private static calculateMessageImportance(message: AdvancedChatMessage): number {
    let importance = 0.3; // Base importance
    
    // Content factors
    if (message.content.type === 'text') {
      const text = message.content.text;
      
      // Length factor
      importance += Math.min(text.length / 1000, 0.2);
      
      // Question factor
      if (text.includes('?')) importance += 0.1;
      
      // Urgency keywords
      const urgentWords = ['urgent', 'important', 'critical', 'asap', 'emergency'];
      if (urgentWords.some(word => text.toLowerCase().includes(word))) {
        importance += 0.2;
      }
      
      // Emotional content
      const emotionalWords = ['excited', 'frustrated', 'confused', 'happy', 'sad', 'angry'];
      if (emotionalWords.some(word => text.toLowerCase().includes(word))) {
        importance += 0.15;
      }
    }
    
    // Tool usage increases importance
    if (message.tools && message.tools.length > 0) {
      importance += message.tools.length * 0.1;
    }
    
    // Role factor
    if (message.role === 'user') {
      importance += 0.1; // User messages are typically more important
    }
    
    return Math.min(importance, 1.0);
  }
  
  private static detectSentiment(message: AdvancedChatMessage): 'positive' | 'neutral' | 'negative' {
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
  
  private static patternToSteps(pattern: DetectedPattern): string[] {
    // Convert pattern into actionable steps
    const baseSteps = [
      `Recognize ${pattern.triggers.join(' or ')}`,
      `Apply ${pattern.pattern_name} approach`,
    ];
    
    // Add context-specific steps
    if (pattern.contexts.length > 0) {
      baseSteps.push(`Consider context: ${pattern.contexts.join(', ')}`);
    }
    
    // Add outcome-focused steps
    if (pattern.outcomes.length > 0) {
      baseSteps.push(`Aim for: ${pattern.outcomes.join(' or ')}`);
    }
    
    return baseSteps;
  }
  
  private static shouldCreateMemoryFromMessage(message: AdvancedChatMessage): boolean {
    // Skip very short messages
    if (message.content.type === 'text' && message.content.text.length < 10) {
      return false;
    }
    
    // Skip system messages unless they contain important information
    if (message.role === 'system') {
      return message.content.type === 'text' && 
             message.content.text.includes('important');
    }
    
    // Always create memories for tool usage
    if (message.tools && message.tools.length > 0) {
      return true;
    }
    
    return true;
  }
  
  private static summarizeConversation(messages: AdvancedChatMessage[]): ConversationSummary {
    const participants = [...new Set(messages.map(m => m.role))];
    const start = new Date(messages[0].timestamp).getTime();
    const end = new Date(messages[messages.length - 1].timestamp).getTime();
    
    // Extract topics (simplified - in production, use NLP)
    const allText = messages
      .filter(m => m.content.type === 'text')
      .map(m => m.content.text)
      .join(' ');
    
    const words = allText.toLowerCase().split(/\s+/);
    const wordCounts = words.reduce((acc, word) => {
      if (word.length > 4) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const keyTopics = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
    
    // Determine sentiment
    const sentiments = messages.map(m => MemoryFactory.detectSentiment(m));
    const positiveCount = sentiments.filter(s => s === 'positive').length;
    const negativeCount = sentiments.filter(s => s === 'negative').length;
    
    let overallSentiment: 'positive' | 'neutral' | 'negative';
    if (positiveCount > negativeCount) overallSentiment = 'positive';
    else if (negativeCount > positiveCount) overallSentiment = 'negative';
    else overallSentiment = 'neutral';
    
    return {
      participant_count: participants.length,
      message_count: messages.length,
      duration_ms: end - start,
      key_topics: keyTopics,
      sentiment: overallSentiment,
      resolution_status: 'ongoing', // Simplified
    };
  }
  
  private static extractConcepts(messages: AdvancedChatMessage[]): Map<string, string> {
    const concepts = new Map<string, string>();
    
    // Simple concept extraction - in production, use NLP
    for (const message of messages) {
      if (message.content.type === 'text') {
        const text = message.content.text;
        
        // Look for definition patterns
        const definitionPatterns = [
          /(.+) is (.+)/g,
          /(.+) means (.+)/g,
          /(.+) refers to (.+)/g,
        ];
        
        for (const pattern of definitionPatterns) {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const concept = match[1].trim();
            const definition = match[2].trim();
            
            if (concept.length > 2 && definition.length > 10) {
              concepts.set(concept, definition);
            }
          }
        }
      }
    }
    
    return concepts;
  }
}