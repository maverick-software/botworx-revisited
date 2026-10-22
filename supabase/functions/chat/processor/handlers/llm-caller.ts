/**
 * LLM Caller - Handles calling LLM (via router or direct OpenAI) with proper tool_choice logic
 */

import type OpenAI from 'npm:openai@6.1.0';
import type { IRouter, LLMTool } from '../../../shared/llm/interfaces.ts';
import { ModelResolver } from '../utils/model-resolver.ts';
import { adaptLLMParams, supportsTools } from '../utils/model-api-adapter.ts';

export interface LLMCallOptions {
  messages: any[];
  tools: LLMTool[];
  temperature?: number;
  maxTokens?: number;
  toolChoice?: 'auto' | 'required' | 'none';
  userMessage?: string; // For intent detection
}

export interface LLMCallResult {
  text?: string;
  toolCalls?: any[];
  usage?: { prompt: number; completion: number; total: number };
}

export class LLMCaller {
  private modelResolver: ModelResolver | null = null;
  
  constructor(
    private openai: OpenAI,
    private router?: IRouter,
    private agentId?: string,
    private supabase?: any
  ) {
    if (supabase) {
      this.modelResolver = new ModelResolver(supabase);
    }
  }

  /**
   * Detect if user message implies a tool should be called
   */
  private detectToolIntent(userMessage: string): boolean {
    const lower = userMessage.toLowerCase();
    return (
      // Action verbs
      lower.includes('run') ||
      lower.includes('execute') ||
      lower.includes('use') ||
      lower.includes('call') ||
      lower.includes('create') ||
      lower.includes('get') ||
      lower.includes('show') ||
      lower.includes('find') ||
      lower.includes('search') ||
      lower.includes('list') ||
      lower.includes('retrieve') ||
      lower.includes('fetch') ||
      lower.includes('pull') ||
      lower.includes('load') ||
      // Data operations
      lower.includes('add') ||
      lower.includes('update') ||
      lower.includes('delete') ||
      lower.includes('edit') ||
      lower.includes('modify') ||
      lower.includes('change') ||
      lower.includes('remove') ||
      // Query patterns
      lower.includes('what are') ||
      lower.includes('what is') ||
      lower.includes('how many') ||
      lower.includes('who is') ||
      lower.includes('where is') ||
      lower.includes('when was') ||
      lower.includes('show me') ||
      lower.includes('tell me about') ||
      lower.includes('give me') ||
      // Common tool-requiring patterns
      lower.includes('my ') || // "my contacts", "my emails", etc.
      lower.includes('the ') || // "the invoice", "the customer", etc.
      lower.includes('send') ||
      lower.includes('email') ||
      lower.includes('contact') ||
      lower.includes('invoice') ||
      lower.includes('customer')
    );
  }

  /**
   * Determine appropriate tool_choice based on context
   */
  private determineToolChoice(options: LLMCallOptions): 'auto' | 'required' | 'none' | undefined {
    // If explicitly set (including undefined), use it
    if (options.toolChoice !== undefined) {
      return options.toolChoice;
    }

    // If no tools provided, no choice needed
    if (!options.tools || options.tools.length === 0) {
      return undefined;
    }

    // If user message suggests tool use, require it
    if (options.userMessage && this.detectToolIntent(options.userMessage)) {
      return 'required';
    }

    // Otherwise auto
    return 'auto';
  }

  /**
   * Call LLM via router or direct OpenAI
   */
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const toolChoice = this.determineToolChoice(options);

    console.log(`[LLMCaller] Calling LLM with ${options.messages.length} messages, ${options.tools.length} tools, tool_choice: ${toolChoice}`);

    // Use router if available
    if (this.router && this.agentId) {
      console.log('[LLMCaller] ✅ Using LLMRouter (Responses API)');
      const resp = await this.router.chat(this.agentId, options.messages, {
        tools: options.tools,
        tool_choice: toolChoice,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1200,
      });

      console.log(`[LLMCaller] Router response:`, {
        hasText: !!resp.text,
        textLength: resp.text?.length,
        hasToolCalls: !!resp.toolCalls,
        toolCallsCount: resp.toolCalls?.length || 0,
      });

      return {
        text: resp.text,
        toolCalls: resp.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
        usage: resp.usage,
      };
    }

    // Fallback to direct OpenAI Chat Completions API
    console.log('[LLMCaller] ⚠️ Router not available, using direct OpenAI call (Chat Completions API - DEPRECATED)');
    // Convert messages from Responses API format to Chat Completions format if needed
    const chatMessages = options.messages.map((msg: any) => {
      // If message has 'type' field, it's Responses API format - convert it
      if (msg.type === 'function_call_output') {
        return {
          role: 'tool',
          content: msg.output,
          tool_call_id: msg.call_id
        };
      }
      // Otherwise keep as-is (already in Chat Completions format)
      return msg;
    });

    // Resolve model - use agent's model or fallback
    const model = this.modelResolver 
      ? (await this.modelResolver.getAgentModel(this.agentId, 'main')).model
      : 'gpt-4';

    // Adapt API params for the specific model's requirements
    const adaptedParams = adaptLLMParams({
      model,
      messages: chatMessages,
      tools: options.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: toolChoice,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 1200
    });

    const completion = await this.openai.chat.completions.create(adaptedParams);

    console.log(`[LLMCaller] OpenAI response:`, {
      hasText: !!completion.choices?.[0]?.message?.content,
      textLength: completion.choices?.[0]?.message?.content?.length,
      hasToolCalls: !!completion.choices?.[0]?.message?.tool_calls,
      toolCallsCount: completion.choices?.[0]?.message?.tool_calls?.length || 0,
    });

    return {
      text: completion.choices?.[0]?.message?.content || undefined,
      toolCalls: completion.choices?.[0]?.message?.tool_calls,
      usage: completion.usage
        ? {
            prompt: completion.usage.prompt_tokens,
            completion: completion.usage.completion_tokens,
            total: completion.usage.total_tokens,
          }
        : undefined,
    };
  }
}

