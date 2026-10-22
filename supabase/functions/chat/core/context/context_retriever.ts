// Context Retriever - Multi-Source Context Retrieval
// Retrieves context candidates from various sources (memory, state, conversation, knowledge)

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';

// ============================
// Interfaces
// ============================

export interface ContextCandidate {
  id: string;
  content: any;
  source: ContextSource;
  token_count: number;
  relevance: RelevanceScore;
  priority?: ContextPriority;
  metadata: Record<string, any>;
}

export interface RelevanceScore {
  semantic_similarity: number;
  temporal_relevance: number;
  frequency_importance: number;
  contextual_fit: number;
  user_preference: number;
  composite_score: number;
}

export enum ContextSource {
  CONVERSATION_HISTORY = 'conversation_history',
  EPISODIC_MEMORY = 'episodic_memory',
  SEMANTIC_MEMORY = 'semantic_memory',
  AGENT_STATE = 'agent_state',
  KNOWLEDGE_BASE = 'knowledge_base',
  TOOL_CONTEXT = 'tool_context',
}

export enum ContextPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  OPTIONAL = 5,
}

export interface ConversationContext {
  conversation_id: string;
  session_id: string;
  agent_id: string;
  channel_id?: string;
  workspace_id?: string;
  user_id?: string;
  recent_messages?: any[];
  conversation_state?: any;
  user_intent?: string;
  topic_context?: string[];
}

export interface RetrievalOptions {
  max_candidates: number;
  required_sources?: ContextSource[];
  excluded_sources?: ContextSource[];
  relevance_threshold?: number;
}

// ============================
// Context Retriever Implementation
// ============================

export class ContextRetriever {
  constructor(private supabase: SupabaseClient) {}
  
  async retrieveAll(
    query: string,
    conversationContext: ConversationContext,
    options: RetrievalOptions
  ): Promise<ContextCandidate[]> {
    const candidates: ContextCandidate[] = [];
    
    // Retrieve from conversation history
    if (!options.excluded_sources?.includes(ContextSource.CONVERSATION_HISTORY)) {
      const conversationCandidates = await this.retrieveFromConversation(
        query,
        conversationContext
      );
      candidates.push(...conversationCandidates);
    }
    
    // Retrieve from memory systems
    if (!options.excluded_sources?.includes(ContextSource.EPISODIC_MEMORY)) {
      const memoryCandidates = await this.retrieveFromMemory(
        query,
        conversationContext.agent_id
      );
      candidates.push(...memoryCandidates);
    }
    
    // Retrieve from knowledge base
    if (!options.excluded_sources?.includes(ContextSource.KNOWLEDGE_BASE)) {
      const knowledgeCandidates = await this.retrieveFromKnowledge(
        query,
        conversationContext
      );
      candidates.push(...knowledgeCandidates);
    }
    
    // Retrieve from agent state
    if (!options.excluded_sources?.includes(ContextSource.AGENT_STATE)) {
      const stateCandidates = await this.retrieveFromState(
        query,
        conversationContext.agent_id
      );
      candidates.push(...stateCandidates);
    }
    
    // Filter by relevance threshold if specified
    const filtered = options.relevance_threshold 
      ? candidates.filter(c => c.relevance.composite_score >= options.relevance_threshold!)
      : candidates;
    
    // Limit to max candidates
    return filtered.slice(0, options.max_candidates);
  }
  
  private async retrieveFromConversation(
    query: string,
    conversationContext: ConversationContext
  ): Promise<ContextCandidate[]> {
    const candidates: ContextCandidate[] = [];
    
    // Add recent messages
    const recentMessages = conversationContext.recent_messages || [];
    const workingLimit = (conversationContext as any).working_memory_limit ?? 5;
    recentMessages.slice(-Math.max(0, Math.min(100, workingLimit))).forEach((message, index) => {
      candidates.push({
        id: `conv_${message.id || index}`,
        content: message.content,
        source: ContextSource.CONVERSATION_HISTORY,
        token_count: this.estimateTokens(message.content),
        relevance: {
          semantic_similarity: this.calculateSemanticSimilarity(message.content, query),
          temporal_relevance: 0.9 - (index * 0.1), // More recent = more relevant
          frequency_importance: 0.5,
          contextual_fit: 0.8,
          user_preference: 0.7,
          composite_score: 0.7,
        },
        metadata: {
          timestamp: message.timestamp,
          role: message.role,
          message_type: 'conversation',
        },
      });
    });
    
    return candidates;
  }
  
  private async retrieveFromMemory(
    query: string,
    agentId: string
  ): Promise<ContextCandidate[]> {
    const candidates: ContextCandidate[] = [];
    
    try {
      const { data: memories } = await this.supabase
        .from('agent_memories')
        .select('*')
        .eq('agent_id', agentId)
        .order('importance_score', { ascending: false })
        .limit(10);
      
      if (memories) {
        memories.forEach((memory) => {
          candidates.push({
            id: `memory_${memory.id}`,
            content: memory.content,
            source: ContextSource.EPISODIC_MEMORY,
            token_count: this.estimateTokens(memory.content),
            relevance: {
              semantic_similarity: this.calculateSemanticSimilarity(memory.content, query),
              temporal_relevance: this.calculateTemporalRelevance(memory.created_at),
              frequency_importance: memory.access_count / 100,
              contextual_fit: 0.7,
              user_preference: 0.6,
              composite_score: 0.65,
            },
            metadata: {
              memory_type: memory.memory_type,
              importance_score: memory.importance_score,
              created_at: memory.created_at,
            },
          });
        });
      }
    } catch (error) {
      console.error('Memory retrieval failed:', error);
    }
    
    return candidates;
  }
  
  private async retrieveFromKnowledge(
    query: string,
    conversationContext: ConversationContext
  ): Promise<ContextCandidate[]> {
    // Simplified knowledge base retrieval
    // In production, this would integrate with vector databases, document stores, etc.
    return [];
  }
  
  private async retrieveFromState(
    query: string,
    agentId: string
  ): Promise<ContextCandidate[]> {
    const candidates: ContextCandidate[] = [];
    
    try {
      const { data: state } = await this.supabase
        .from('agent_states')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_current', true)
        .single();
      
      if (state) {
        // Add relevant state information
        if (state.persistent_state?.knowledge) {
          candidates.push({
            id: `state_knowledge_${agentId}`,
            content: state.persistent_state.knowledge,
            source: ContextSource.AGENT_STATE,
            token_count: this.estimateTokens(state.persistent_state.knowledge),
            relevance: {
              semantic_similarity: this.calculateSemanticSimilarity(state.persistent_state.knowledge, query),
              temporal_relevance: 0.8,
              frequency_importance: 0.7,
              contextual_fit: 0.9,
              user_preference: 0.8,
              composite_score: 0.74,
            },
            metadata: {
              state_type: 'persistent_knowledge',
              last_modified: state.last_modified,
            },
          });
        }
        
        if (state.local_state?.preferences) {
          candidates.push({
            id: `state_preferences_${agentId}`,
            content: state.local_state.preferences,
            source: ContextSource.AGENT_STATE,
            token_count: this.estimateTokens(state.local_state.preferences),
            relevance: {
              semantic_similarity: this.calculateSemanticSimilarity(state.local_state.preferences, query),
              temporal_relevance: 0.7,
              frequency_importance: 0.9,
              contextual_fit: 0.8,
              user_preference: 0.95,
              composite_score: 0.76,
            },
            metadata: {
              state_type: 'local_preferences',
              last_modified: state.last_modified,
            },
          });
        }
      }
    } catch (error) {
      console.error('State retrieval failed:', error);
    }
    
    return candidates;
  }
  
  private estimateTokens(content: any): number {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  private calculateSemanticSimilarity(content: any, query: string): number {
    // Simplified keyword matching - would use embeddings in production
    const contentText = typeof content === 'string' ? content : JSON.stringify(content);
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = contentText.toLowerCase().split(/\s+/);
    
    const matches = queryWords.filter(word => contentWords.includes(word));
    return matches.length / queryWords.length;
  }
  
  private calculateTemporalRelevance(createdAt: string): number {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const ageHours = (now - created) / (1000 * 60 * 60);
    
    // Exponential decay: more recent = more relevant
    return Math.exp(-ageHours / 24); // Half relevance after 24 hours
  }
}