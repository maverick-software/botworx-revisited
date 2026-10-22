// ============================================================================
// Working Memory Manager
// Purpose: Retrieve and format conversation context from summary system
// ============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WorkingMemoryContext {
  summary: string;
  facts: string[];
  action_items: string[];
  pending_questions: string[];
  context_notes: string;
  chunks?: MemoryChunk[];
  metadata: {
    message_count: number;
    last_updated: string;
    update_frequency: number;
  };
}

export interface MemoryChunk {
  chunk_text: string;
  importance_score: number;
  chunk_type: string;
  created_at: string;
}

export interface SummarySearchResult {
  summary_text: string;
  key_facts: string[];
  topics: string[];
  similarity: number;
  created_at: string;
}

// ============================================================================
// Working Memory Manager Class
// ============================================================================

export class WorkingMemoryManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get working memory context for a conversation
   * Returns the current summary board with recent chunks
   */
  async getWorkingContext(
    conversationId: string,
    agentId: string,
    includeChunks: boolean = false
  ): Promise<WorkingMemoryContext | null> {
    try {
      // Get summary board
      const { data: summaryBoard, error: boardError } = await this.supabase
        .from('conversation_summary_boards')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (boardError) {
        console.error('[WorkingMemory] Error fetching summary board:', boardError);
        return null;
      }

      if (!summaryBoard) {
        // Silently return null - this is normal for new conversations
        return null;
      }

      // Build context
      const context: WorkingMemoryContext = {
        summary: summaryBoard.current_summary || '',
        facts: Array.isArray(summaryBoard.important_facts) ? summaryBoard.important_facts : [],
        action_items: Array.isArray(summaryBoard.action_items) ? summaryBoard.action_items : [],
        pending_questions: Array.isArray(summaryBoard.pending_questions) ? summaryBoard.pending_questions : [],
        context_notes: summaryBoard.context_notes || '',
        metadata: {
          message_count: summaryBoard.message_count || 0,
          last_updated: summaryBoard.last_updated || summaryBoard.updated_at,
          update_frequency: summaryBoard.update_frequency || 5,
        }
      };

      // Optionally include recent working memory chunks
      if (includeChunks) {
        const { data: chunks, error: chunksError } = await this.supabase
          .from('working_memory_chunks')
          .select('chunk_text, importance_score, chunk_type, created_at')
          .eq('conversation_id', conversationId)
          .eq('agent_id', agentId)
          .order('chunk_index', { ascending: false })
          .limit(5);

        if (!chunksError && chunks) {
          context.chunks = chunks;
        }
      }

      return context;

    } catch (error) {
      console.error('[WorkingMemory] Error getting working context:', error);
      return null;
    }
  }

  /**
   * Search working memory by semantic similarity
   * Uses vector search to find relevant chunks
   */
  async searchWorkingMemory(
    agentId: string,
    userId: string,
    query: string,
    queryEmbedding: number[],
    limit: number = 5
  ): Promise<MemoryChunk[]> {
    try {
      console.log(`[WorkingMemory] Searching for: "${query.substring(0, 50)}..."`);

      // Vector similarity search using pg_vector
      // Note: We use RPC because the JS client doesn't support vector operators directly
      const { data, error } = await this.supabase.rpc('search_working_memory', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_query_embedding: queryEmbedding,
        p_limit: limit
      });

      if (error) {
        console.error('[WorkingMemory] Search error:', error);
        return [];
      }

      console.log(`[WorkingMemory] ✅ Found ${data?.length || 0} relevant chunks`);
      return data || [];

    } catch (error) {
      console.error('[WorkingMemory] Search failed:', error);
      return [];
    }
  }

  /**
   * Search conversation summaries by semantic similarity
   * Find relevant past conversations
   */
  async searchConversationHistory(
    agentId: string,
    userId: string,
    query: string,
    queryEmbedding: number[],
    timeRange?: { start: string; end: string },
    limit: number = 5
  ): Promise<SummarySearchResult[]> {
    try {
      console.log(`[WorkingMemory] Searching conversation history`);

      const { data, error } = await this.supabase.rpc('search_conversation_summaries', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_query_embedding: queryEmbedding,
        p_start_date: timeRange?.start,
        p_end_date: timeRange?.end,
        p_limit: limit
      });

      if (error) {
        console.error('[WorkingMemory] History search error:', error);
        return [];
      }

      console.log(`[WorkingMemory] ✅ Found ${data?.length || 0} relevant conversations`);
      return data || [];

    } catch (error) {
      console.error('[WorkingMemory] History search failed:', error);
      return [];
    }
  }

  /**
   * Format working memory context for LLM consumption
   * Creates a clean, structured context block
   */
  formatContextForLLM(context: WorkingMemoryContext): string {
    const parts: string[] = [];

    parts.push('=== CONVERSATION CONTEXT ===\n');

    // Add summary
    if (context.summary) {
      parts.push(`Summary:\n${context.summary}\n`);
    }

    // Add key facts
    if (context.facts.length > 0) {
      parts.push(`\nKey Facts:`);
      context.facts.forEach(fact => {
        parts.push(`• ${fact}`);
      });
      parts.push('');
    }

    // Add action items
    if (context.action_items.length > 0) {
      parts.push(`Action Items:`);
      context.action_items.forEach(item => {
        parts.push(`• ${item}`);
      });
      parts.push('');
    }

    // Add pending questions
    if (context.pending_questions.length > 0) {
      parts.push(`Pending Questions:`);
      context.pending_questions.forEach(q => {
        parts.push(`• ${q}`);
      });
      parts.push('');
    }

    // Add context notes
    if (context.context_notes) {
      parts.push(`Notes: ${context.context_notes}\n`);
    }

    parts.push('=== END CONTEXT ===');

    return parts.join('\n');
  }

  /**
   * Format memory chunks for LLM consumption
   */
  formatChunksForLLM(chunks: MemoryChunk[]): string {
    if (chunks.length === 0) return '';

    const parts: string[] = [];
    parts.push('=== RECENT CONTEXT CHUNKS ===\n');

    chunks.forEach((chunk, index) => {
      parts.push(`[${index + 1}] (${chunk.chunk_type}, importance: ${chunk.importance_score.toFixed(2)})`);
      parts.push(chunk.chunk_text);
      parts.push('');
    });

    parts.push('=== END CHUNKS ===');

    return parts.join('\n');
  }

  /**
   * Get recent messages for immediate context (last 3-5 messages)
   * Used as a fallback or supplement to summaries
   */
  async getRecentMessages(
    conversationId: string,
    limit: number = 5
  ): Promise<Array<{ role: string; content: string; created_at: string }>> {
    try {
      const { data, error } = await this.supabase
        .from('chat_messages_v2')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[WorkingMemory] Error fetching recent messages:', error);
        return [];
      }

      // Reverse to get chronological order
      return (data || []).reverse().map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : (msg.content as any)?.text || '',
        created_at: msg.created_at,
      }));

    } catch (error) {
      console.error('[WorkingMemory] Error getting recent messages:', error);
      return [];
    }
  }
}

// ============================================================================
// Database Functions (RPC)
// These need to be created in a migration
// ============================================================================

/*
-- Create search_working_memory RPC function
CREATE OR REPLACE FUNCTION search_working_memory(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  chunk_text TEXT,
  importance_score FLOAT,
  chunk_type TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wmc.chunk_text,
    wmc.importance_score,
    wmc.chunk_type,
    wmc.created_at,
    1 - (wmc.embedding <=> p_query_embedding) AS similarity
  FROM working_memory_chunks wmc
  WHERE wmc.agent_id = p_agent_id
    AND wmc.user_id = p_user_id
    AND wmc.expires_at > NOW()
  ORDER BY wmc.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Create search_conversation_summaries RPC function
CREATE OR REPLACE FUNCTION search_conversation_summaries(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  summary_text TEXT,
  key_facts JSONB,
  topics TEXT[],
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.summary_text,
    cs.key_facts,
    cs.topics,
    cs.created_at,
    1 - (cs.embedding <=> p_query_embedding) AS similarity
  FROM conversation_summaries cs
  WHERE cs.agent_id = p_agent_id
    AND cs.user_id = p_user_id
    AND (p_start_date IS NULL OR cs.created_at >= p_start_date)
    AND (p_end_date IS NULL OR cs.created_at <= p_end_date)
  ORDER BY cs.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;
*/

