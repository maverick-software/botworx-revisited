import type { LLMProvider, LLMMessage, LLMChatOptions, LLMChatResponse, LLMTool, LLMToolCall } from './interfaces.ts';

/**
 * Anthropic Claude Provider
 * Implements the LLMProvider interface for Anthropic's Claude models
 * 
 * Key differences from OpenAI:
 * - System messages are passed as a separate 'system' parameter
 * - Tool calling uses 'tool_use' content blocks instead of 'tool_calls'
 * - Requires 'anthropic-version' header
 * 
 * Reference: https://docs.anthropic.com/en/api/overview
 */

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: any }>;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: any;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string = 'https://api.anthropic.com/v1';
  private apiVersion: string = '2023-06-01';

  constructor(
    apiKey: string,
    private defaults: { model: string } = { model: 'claude-3-5-sonnet-20241022' }
  ) {
    this.apiKey = apiKey;
  }

  /**
   * Convert internal LLMTool format to Anthropic's tool format
   */
  private toAnthropicTools(tools: LLMTool[] = []): AnthropicTool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }

  /**
   * Convert internal LLMMessage format to Anthropic's message format
   * Extracts system messages and formats conversation messages
   */
  private toAnthropicMessages(messages: LLMMessage[]): {
    system: string | undefined;
    messages: AnthropicMessage[];
  } {
    // Separate system messages from conversation
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Combine system messages
    const system = systemMessages.length > 0
      ? systemMessages.map(m => m.content).join('\n\n')
      : undefined;

    // Convert conversation messages
    const anthropicMessages: AnthropicMessage[] = [];
    
    for (const msg of conversationMessages) {
      if (msg.role === 'tool') {
        // Tool result messages need special handling
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || 'unknown',
              content: msg.content
            }
          ]
        });
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    return { system, messages: anthropicMessages };
  }

  /**
   * Main chat completion method
   */
  async chat(messages: LLMMessage[], options: LLMChatOptions = {}): Promise<LLMChatResponse> {
    const { system, messages: anthropicMessages } = this.toAnthropicMessages(messages);

    const requestBody: any = {
      model: options.model || this.defaults.model,
      max_tokens: options.maxTokens || 4096,
      messages: anthropicMessages,
    };

    // Add optional parameters
    if (system) {
      requestBody.system = system;
    }

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      requestBody.top_p = options.topP;
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = this.toAnthropicTools(options.tools);
      
      // Handle tool_choice parameter
      // Anthropic supports: { type: "auto" | "any" | "tool", name?: string }
      if (options.tool_choice === 'required') {
        requestBody.tool_choice = { type: 'any' }; // Force tool use
      } else if (options.tool_choice === 'none') {
        // Remove tools if tool_choice is 'none'
        delete requestBody.tools;
      }
      // 'auto' is the default behavior in Anthropic
    }

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const data: AnthropicResponse = await response.json();

      // Extract text content
      const textContent = data.content.find(c => c.type === 'text');
      const text = textContent?.text;

      // Extract tool calls
      const toolUses = data.content.filter(c => c.type === 'tool_use');
      const toolCalls: LLMToolCall[] = toolUses.map(tu => ({
        id: tu.id || 'unknown',
        name: tu.name || 'unknown',
        arguments: JSON.stringify(tu.input || {}),
      }));

      return {
        text: text || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
          total: data.usage.input_tokens + data.usage.output_tokens,
        },
      };
    } catch (error) {
      console.error('[AnthropicProvider] Chat error:', error);
      throw error;
    }
  }

  /**
   * Streaming support (not implemented yet)
   */
  stream(messages: LLMMessage[], options: LLMChatOptions = {}): ReadableStream<Uint8Array> {
    // TODO: Implement streaming support with Server-Sent Events
    console.warn('[AnthropicProvider] Streaming not yet implemented');
    return undefined as any;
  }

  /**
   * Embeddings - Anthropic doesn't provide native embeddings
   * Fall back to OpenAI or throw an error
   */
  async embed(inputs: string[], modelHint?: string): Promise<number[][]> {
    throw new Error(
      'Anthropic does not provide native embeddings. ' +
      'Please configure an OpenAI embedding model in agent preferences.'
    );
  }

  /**
   * Token counting (not implemented yet)
   */
  async countTokens(): Promise<number> {
    // TODO: Implement token counting using Anthropic's token counting API
    return 0;
  }

  /**
   * Model information
   */
  modelInfo(model: string): { maxContext: number; supportsTools: boolean } {
    // Claude 3 models all have 200k context windows
    // Opus 4 has 200k, Sonnet 4.5 has 200k
    const contextMap: Record<string, number> = {
      'claude-3-opus-20240229': 200000,
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-5-haiku-20241022': 200000,
      'claude-3-sonnet-20240229': 200000,
      'claude-3-haiku-20240307': 200000,
      'claude-sonnet-4-5': 200000,
      'claude-opus-4': 200000,
      'claude-sonnet-4': 200000,
    };

    const maxContext = contextMap[model] || 200000;

    return {
      maxContext,
      supportsTools: true, // All Claude 3+ models support tool use
    };
  }
}

