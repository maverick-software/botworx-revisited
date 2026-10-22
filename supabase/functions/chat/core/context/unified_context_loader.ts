/**
 * Unified Context Loader
 * 
 * Loads WorkingMemory and RelevantHistory as a single unified system
 * Runs asynchronously at chat function startup to eliminate lag
 * Injects context early in the message flow for better direction
 */

import { WorkingMemoryManager, WorkingMemoryContext } from './working_memory_manager.ts';

export interface UnifiedContext {
  // Working Memory (summaries, facts, action items)
  workingMemory: WorkingMemoryContext | null;
  
  // Recent Message History (tactical context)
  recentHistory: Array<{ role: string; content: any; created_at?: string }>;
  
  // Metadata
  metadata: {
    total_messages_in_conversation: number;
    history_messages_loaded: number;
    working_memory_message_count: number; // Messages summarized in working memory
    context_history_size: number; // Agent's setting for how many recent messages to include
    load_time_ms: number;
  };
}

export class UnifiedContextLoader {
  private workingMemoryManager: WorkingMemoryManager;

  constructor(private supabase: any) {
    this.workingMemoryManager = new WorkingMemoryManager(supabase);
  }

  /**
   * Load unified context asynchronously
   * This fires immediately when the chat function starts
   */
  async loadContext(
    conversationId: string,
    agentId: string,
    userId: string,
    options?: {
      contextHistorySize?: number; // Override agent's default
      includeChunks?: boolean; // Include working memory chunks (default: false)
    }
  ): Promise<UnifiedContext> {
    const startTime = Date.now();

    try {
      // Fetch agent's context_history_size setting in parallel with other operations
      const agentSettingsPromise = this.supabase
        .from('agents')
        .select('settings')
        .eq('id', agentId)
        .single()
        .then(({ data }: any) => data?.settings?.context_history_size || 25)
        .catch(() => 25);

      // Load WorkingMemory and RecentHistory IN PARALLEL
      const [workingMemory, contextHistorySize, totalMessageCount] = await Promise.all([
        // 1. Load Working Memory (summaries, facts, action items)
        this.workingMemoryManager.getWorkingContext(
          conversationId,
          agentId,
          options?.includeChunks ?? false
        ),

        // 2. Get agent's context history size setting
        agentSettingsPromise,

        // 3. Count total messages in conversation
        this.supabase
          .from('chat_messages_v2')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId)
          .then(({ count }: any) => count || 0)
          .catch(() => 0),
      ]);

      // Determine how many recent messages to load
      const effectiveHistorySize = options?.contextHistorySize ?? contextHistorySize;

      // Load recent message history
      const { data: recentMessagesData } = await this.supabase
        .from('chat_messages_v2')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(effectiveHistorySize);

      const recentHistory = recentMessagesData ? recentMessagesData.reverse() : [];

      const loadTime = Date.now() - startTime;

      const context: UnifiedContext = {
        workingMemory,
        recentHistory,
        metadata: {
          total_messages_in_conversation: totalMessageCount,
          history_messages_loaded: recentHistory.length,
          working_memory_message_count: workingMemory?.metadata.message_count || 0,
          context_history_size: effectiveHistorySize,
          load_time_ms: loadTime,
        },
      };

      // Only log in development or if there are errors
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Context] Loaded in ${loadTime}ms: ${recentHistory.length} messages, ${workingMemory ? 'summary available' : 'no summary'}`);
      }

      return context;
    } catch (error) {
      console.error('[UnifiedContext] ❌ Error loading context:', error);
      
      // Return empty context on error (graceful degradation)
      return {
        workingMemory: null,
        recentHistory: [],
        metadata: {
          total_messages_in_conversation: 0,
          history_messages_loaded: 0,
          working_memory_message_count: 0,
          context_history_size: 25,
          load_time_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Format unified context for LLM injection
   * This creates a single formatted block that includes both working memory and recent history
   */
  formatForLLM(context: UnifiedContext): string {
    const sections: string[] = [];

    // 1. Working Memory Section (Strategic Context)
    if (context.workingMemory && context.workingMemory.summary) {
      const wmBlock = this.workingMemoryManager.formatContextForLLM(context.workingMemory);
      sections.push(wmBlock);
    }

    // 2. Recent History Section (Tactical Context)
    if (context.recentHistory.length > 0) {
      sections.push('=== RECENT CONVERSATION HISTORY ===');
      sections.push(`Last ${context.recentHistory.length} messages for tactical context:`);
      sections.push('');

      for (const msg of context.recentHistory) {
        const role = msg.role.toUpperCase();
        let contentText = '';

        if (typeof msg.content === 'string') {
          contentText = msg.content;
        } else if (msg.content?.type === 'text') {
          contentText = msg.content.text;
        } else if (msg.content?.text) {
          contentText = msg.content.text;
        } else {
          contentText = JSON.stringify(msg.content);
        }

        sections.push(`${role}: ${contentText}`);
      }

      sections.push('');
      sections.push('=== END RECENT CONVERSATION HISTORY ===');
    }

    return sections.join('\n');
  }

  /**
   * Get formatted context as an assistant message for LLM
   * This is injected early in the message array for better direction
   */
  getContextMessage(context: UnifiedContext): { role: 'assistant'; content: string } {
    return {
      role: 'assistant',
      content: this.formatForLLM(context),
    };
  }
}

