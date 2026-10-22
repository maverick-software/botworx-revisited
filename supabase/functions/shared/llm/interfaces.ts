export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMMessage {
	role: LLMRole;
	content: string;
	tool_call_id?: string;
}

export interface LLMTool {
	name: string;
	description: string;
	parameters: any;
}

export interface LLMToolCall {
	id: string;
	name: string;
	arguments: string;
}

export interface LLMUsage { prompt: number; completion: number; total: number }

export interface LLMChatOptions {
	tools?: LLMTool[];
	tool_choice?: 'auto' | 'required' | 'none'; // Control whether LLM must call tools
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	stream?: boolean;
	model?: string;
	previousResponseId?: string; // For multi-turn conversations in Responses API
}

export interface LLMChatResponse {
	text?: string;
	toolCalls?: LLMToolCall[];
	usage?: LLMUsage;
	responseId?: string; // Response ID from Responses API for chaining
}

export interface LLMProvider {
	chat(messages: LLMMessage[], options: LLMChatOptions): Promise<LLMChatResponse>;
	stream?(messages: LLMMessage[], options: LLMChatOptions): ReadableStream<Uint8Array>;
	embed(inputs: string[], modelHint?: string): Promise<number[][]>;
	countTokens?(messages: LLMMessage[], model?: string): Promise<number>;
	modelInfo(model: string): { maxContext: number; supportsTools: boolean };
}

export interface AgentLLMPreferences {
	provider: string;
	model: string;
	params?: Record<string, any>;
	embedding_model?: string;
}

export interface LLMRouter {
	resolveAgent(agentId: string): Promise<{ provider: LLMProvider; prefs: AgentLLMPreferences }>;
	chat(agentId: string, messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse>;
	stream?(agentId: string, messages: LLMMessage[], options?: LLMChatOptions): ReadableStream<Uint8Array>;
	embed(agentId: string, inputs: string[], modelHint?: string): Promise<number[][]>;
}


