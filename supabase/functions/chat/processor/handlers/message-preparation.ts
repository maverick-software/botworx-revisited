/**
 * Message Preparation - Prepares messages array with system prompts, context, and history
 * Uses UnifiedContextLoader for efficient async loading of WorkingMemory + RelevantHistory
 */

import type { AdvancedChatMessage } from '../../types/message.types.ts';
import type { ProcessingContext } from '../types.ts';
import { PromptBuilder } from '../utils/prompt-builder.ts';
import { UnifiedContextLoader, UnifiedContext } from '../../core/context/unified_context_loader.ts';

export interface PreparedMessages {
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }>;
  recentMessages: Array<{ role: string; content: string }>;
  summaryInfo: any | null;
}

export class MessagePreparation {
  private promptBuilder: PromptBuilder;
  private contextLoader: UnifiedContextLoader;

  constructor(private supabase: any) {
    this.promptBuilder = new PromptBuilder(supabase);
    this.contextLoader = new UnifiedContextLoader(supabase);
  }

  /**
   * Prepare messages array with system prompt, context window, working memory, and history
   */
  async prepare(message: AdvancedChatMessage, context: ProcessingContext): Promise<PreparedMessages> {
    const msgs: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }> = [];
    let recentMessages: Array<{ role: string; content: string }> = [];
    let summaryInfo: any = null;

    // Add agent system prompt
    if (context.agent_id) {
      const { data: agent } = await this.supabase
        .from('agents')
        .select('system_instructions, assistant_instructions, description, personality, name, metadata')
        .eq('id', context.agent_id)
        .single();

      // Build comprehensive system prompt using PromptBuilder
      let systemPrompt = await this.promptBuilder.buildSystemPromptString(agent);

      // Append system_prompt_override from sessionContext (for temporary chats)
      const sessionContext = (message as any)?.context?.sessionContext || (context as any)?.sessionContext;
      if (sessionContext?.system_prompt_override) {
        console.log('[MessagePreparation] Appending system_prompt_override from sessionContext');
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n=== TEMPORARY CHAT INSTRUCTIONS ===\n${sessionContext.system_prompt_override}\n=== END TEMPORARY CHAT INSTRUCTIONS ===`
          : sessionContext.system_prompt_override;
      }

      // Add chat_intent context if present
      if (sessionContext?.chat_intent) {
        console.log('[MessagePreparation] Adding chat_intent context from sessionContext');
        const intentContext = `\n\n=== CHAT PURPOSE ===\nThis temporary chat session has a specific purpose: ${sessionContext.chat_intent}\nFocus your responses on gathering information related to this purpose.\n=== END CHAT PURPOSE ===`;
        systemPrompt = systemPrompt ? `${systemPrompt}${intentContext}` : intentContext;
      }

      if (systemPrompt) {
        msgs.push({ role: 'system', content: systemPrompt });
      }

      // CONTEXT WINDOW INJECTION (episodic/semantic context) - as assistant message
      const ctxWin = (message as any)?.context?.context_window;
      const sections = Array.isArray(ctxWin?.sections) ? ctxWin.sections : [];
      if (sections.length > 0) {
        const toLabel = (s: any): string => {
          if (s?.source === 'episodic_memory') return 'EPISODIC MEMORY';
          if (s?.source === 'semantic_memory') return 'SEMANTIC MEMORY';
          return s?.title || 'Context';
        };

        const top = sections
          .slice(0, 4)
          .map((s: any) => `${toLabel(s)}:\n${String(s.content || '').slice(0, 2000)}`);
        const ctxBlock = [
          '=== CONTEXT WINDOW ===',
          ...top,
          '=== END CONTEXT WINDOW ===\n',
        ].join('\n\n');
        msgs.push({ role: 'assistant', content: ctxBlock });
      }
      if (agent?.assistant_instructions) msgs.push({ role: 'assistant', content: agent.assistant_instructions });
    }

    // UNIFIED CONTEXT LOADER: WorkingMemory + RelevantHistory as ONE system
    const conversationId = context.conversation_id || (message as any).conversation_id;
    const userId = context.user_id || (message as any).context?.user_id;

    if (conversationId && context.agent_id && userId) {
      try {
        // Load unified context (WorkingMemory + RelevantHistory in parallel)
        const unifiedContext = await this.contextLoader.loadContext(
          conversationId,
          context.agent_id,
          userId,
          {
            includeChunks: false, // Just summaries for now
          }
        );

        // Inject unified context EARLY in messages array for better direction
        const contextMessage = this.contextLoader.getContextMessage(unifiedContext);
        msgs.push(contextMessage);

        // Store summary info for metrics
        if (unifiedContext.workingMemory) {
          summaryInfo = {
            summary: unifiedContext.workingMemory.summary,
            facts_count: unifiedContext.workingMemory.facts.length,
            action_items_count: unifiedContext.workingMemory.action_items.length,
            pending_questions_count: unifiedContext.workingMemory.pending_questions.length,
            message_count: unifiedContext.workingMemory.metadata.message_count,
            last_updated: unifiedContext.workingMemory.metadata.last_updated,
          };
        }

        // Store recent messages for return value
        recentMessages = unifiedContext.recentHistory.map((msg: any) => {
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

          return {
            role: msg.role,
            content: contentText,
          };
        });

        // Log successful context load
        const hasSummary = unifiedContext.workingMemory ? 'with summary' : 'no summary';
        console.log(`[Context] ✅ Loaded ${unifiedContext.metadata.history_messages_loaded} messages ${hasSummary} (${unifiedContext.metadata.load_time_ms}ms)`);
      } catch (error: any) {
        console.error('[Context] ❌ Failed to load:', error.message);
        // Gracefully continue without context if loading fails
      }
    } else {
      console.log('[Context] ⏭️ Skipped (new conversation)');
    }

    // Add current user message
    const userText = (message as any).content?.text || (message as any).content || '';
    msgs.push({ role: 'user', content: userText });

    return {
      messages: msgs,
      recentMessages,
      summaryInfo,
    };
  }
}

