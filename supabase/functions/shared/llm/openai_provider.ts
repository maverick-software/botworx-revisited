import OpenAI from 'npm:openai@6.1.0';
import type { LLMProvider, LLMMessage, LLMChatOptions, LLMChatResponse, LLMTool, LLMToolCall } from './interfaces.ts';

export class OpenAIProvider implements LLMProvider {
	private apiKey: string;
	private baseURL: string = 'https://api.openai.com/v1';

	constructor(private client: OpenAI, private defaults: { model: string } = { model: 'gpt-4o-mini' }) {
		// Extract API key from client for direct API calls
		this.apiKey = (client as any).apiKey || '';
	}

	private toResponsesTools(tools: LLMTool[] = []) {
		// Responses API format with strict mode requirements:
		// 1. additionalProperties: false
		// 2. ALL properties must be in required array
		// 3. Optional fields should use type: ["string", "null"]
		return tools.map(t => {
			// Clone parameters to avoid modifying original
			const parameters = { ...t.parameters };
			
			// Add additionalProperties: false (required for strict mode)
			if (!parameters.hasOwnProperty('additionalProperties')) {
				parameters.additionalProperties = false;
			}
			
			// For strict mode, ALL properties must be in required array
			if (parameters.properties && typeof parameters.properties === 'object') {
				const allPropertyKeys = Object.keys(parameters.properties);
				
				// Always include all properties in required for strict mode
				// If a property is optional, it should use type: ["string", "null"] in the schema
				parameters.required = allPropertyKeys;
			}
			
			return {
				type: 'function', 
				name: t.name, 
				description: t.description, 
				parameters: parameters,
				strict: true // Enable strict mode for better reliability
			};
		});
	}

	private prepareInput(messages: LLMMessage[]): { instructions?: string; input: any } {
		// Separate system messages (instructions) from user/assistant messages
		const systemMessages = messages.filter(m => m.role === 'system');
		const otherMessages = messages
			.filter(m => m.role !== 'system')
			.map(m => {
				// RESPONSES API COMPATIBILITY: Convert 'tool' role to 'function_call_output'
				// The Responses API uses a different format for tool results:
				// - Chat Completions API: { role: 'tool', content: '...', tool_call_id: '...' }
				// - Responses API: { type: 'function_call_output', call_id: '...', output: '...' }
				// Reference: https://platform.openai.com/docs/guides/function-calling?api-mode=responses
				if (m.role === 'tool') {
					const toolCallId = (m as any).tool_call_id || 'unknown';
					return {
						type: 'function_call_output',
						call_id: toolCallId,
						output: m.content
					};
				}
				return m;
			});

		// Combine system messages into instructions
		const instructions = systemMessages.length > 0 
			? systemMessages.map(m => m.content).join('\n') 
			: undefined;

		// If only one user message and no conversation history, use string input
		if (otherMessages.length === 1 && otherMessages[0].role === 'user') {
			return { instructions, input: otherMessages[0].content };
		}

		// Otherwise use array of items
		return { instructions, input: otherMessages };
	}

	async chat(messages: LLMMessage[], options: LLMChatOptions = {}): Promise<LLMChatResponse> {
		const { instructions, input } = this.prepareInput(messages);
		const model = options.model || this.defaults.model;
		
		// Build Responses API request
		const requestBody: any = {
			model,
			input,
			store: false, // Disable storage for privacy
		};

		if (instructions) {
			requestBody.instructions = instructions;
		}

		// Temperature is not supported for reasoning models (GPT-5, GPT-4.1, etc.)
		// Only add temperature for non-reasoning models
		const isReasoningModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1') || model.startsWith('o1-') || model.startsWith('o3-');
		if (options.temperature !== undefined && !isReasoningModel) {
			requestBody.temperature = options.temperature;
		}

		if (options.maxTokens) {
			requestBody.max_output_tokens = options.maxTokens;
		}

		if (options.tools && options.tools.length > 0) {
			// Skip tools entirely if tool_choice is 'none'
			if (options.tool_choice === 'none') {
				// Don't add tools at all
			} else {
				requestBody.tools = this.toResponsesTools(options.tools);
				
				// Note: OpenAI Responses API doesn't support tool_choice or tool_constraints
				// It automatically decides whether to use tools based on the request
				// To "force" tool use, we need to be more explicit in the instructions
				if (options.tool_choice === 'required') {
					// Add explicit instruction to use tools in the instructions
					if (requestBody.instructions) {
						requestBody.instructions += '\n\nIMPORTANT: You MUST use one of the available function tools to complete this request. Do not respond without calling a function.';
					}
				}
			}
		}

		if (options.previousResponseId) {
			requestBody.previous_response_id = options.previousResponseId;
		}

		console.log('[OpenAI Responses API] Calling with:', {
			model: requestBody.model,
			hasInstructions: !!requestBody.instructions,
			hasTools: !!requestBody.tools,
			maxOutputTokens: requestBody.max_output_tokens
		});

		// Call Responses API using SDK method
		const res = await this.client.responses.create(requestBody);

		// Parse output items
		let text: string | undefined;
		const toolCalls: LLMToolCall[] = [];

		for (const item of res.output || []) {
			if (item.type === 'message') {
				// Extract text from message content
				for (const contentBlock of item.content || []) {
					if (contentBlock.type === 'output_text') {
						text = contentBlock.text;
					}
				}
			} else if (item.type === 'function_call') {
				// Extract function calls
				toolCalls.push({
					id: item.call_id,
					name: item.name,
					arguments: JSON.stringify(item.arguments),
				});
			}
		}

		// Build response
		const response = {
			text: text || undefined,
			toolCalls: toolCalls.length ? toolCalls : undefined,
			usage: res.usage ? { 
				prompt: res.usage.input_tokens || 0, 
				completion: res.usage.output_tokens || 0, 
				total: (res.usage.input_tokens || 0) + (res.usage.output_tokens || 0) 
			} : undefined,
			responseId: res.id, // Store response ID for multi-turn conversations
		};
		
		console.log('[OpenAI Responses API] Response:', {
			hasText: !!response.text,
			textLength: response.text?.length,
			hasToolCalls: !!response.toolCalls,
			toolCallsCount: response.toolCalls?.length || 0,
			outputItems: res.output?.length || 0,
			outputTypes: res.output?.map((item: any) => item.type).join(', ') || 'none'
		});
		
		return response;
	}

	stream(messages: LLMMessage[], options: LLMChatOptions = {}) {
		// Delegate to SDK stream() when available; otherwise return undefined to use non-stream pathway
		// For now, we rely on existing SSE infra in the chat function; this can be filled later as needed.
		return undefined as any;
	}

	async embed(inputs: string[], modelHint?: string): Promise<number[][]> {
		const mdl = modelHint || 'text-embedding-3-small';
		const resp = await this.client.embeddings.create({ model: mdl as any, input: inputs as any });
		return (resp.data || []).map((d: any) => d.embedding as number[]);
	}

	async countTokens(): Promise<number> { return 0; }

	modelInfo(model: string) { 
		// GPT-5 models have 200k context
		if (model.startsWith('gpt-5')) {
			return { maxContext: 200000, supportsTools: true };
		}
		// GPT-4.1 and GPT-4o models have 128k context
		if (model.startsWith('gpt-4')) {
			return { maxContext: 128000, supportsTools: true };
		}
		// GPT-3.5 has 16k context
		if (model.startsWith('gpt-3.5')) {
			return { maxContext: 16385, supportsTools: true };
		}
		// Default fallback
		return { maxContext: 8192, supportsTools: true };
	}
}


