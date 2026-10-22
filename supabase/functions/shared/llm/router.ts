import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@6.1.0';
import type { LLMRouter as IRouter, LLMMessage, LLMChatOptions, LLMChatResponse, AgentLLMPreferences } from './interfaces.ts';
import { OpenAIProvider } from './openai_provider.ts';
import { AnthropicProvider } from './anthropic_provider.ts';

export class LLMRouter implements IRouter {
	private supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

	// Fetch system API key from vault
	private async getSystemAPIKey(providerName: string): Promise<string | null> {
		try {
			// Get vault_secret_id from system_api_keys
			const { data: systemKey, error } = await this.supabase
				.from('system_api_keys')
				.select('vault_secret_id, is_active')
				.eq('provider_name', providerName)
				.eq('is_active', true)
				.single();

			if (error || !systemKey?.vault_secret_id) {
				console.warn(`[LLMRouter] No system API key found for ${providerName}`);
				return null;
			}

			// Decrypt from vault using get_secret function
			const { data: secretData, error: vaultError } = await this.supabase
				.rpc('get_secret', { secret_id: systemKey.vault_secret_id });

			if (vaultError || !secretData || secretData.length === 0) {
				console.error(`[LLMRouter] Failed to decrypt ${providerName} key:`, vaultError);
				return null;
			}

			// get_secret returns an array with one row containing {key: "secret"}
			return secretData[0]?.key || null;
		} catch (err) {
			console.error(`[LLMRouter] Error fetching system API key for ${providerName}:`, err);
			return null;
		}
	}

	async resolveAgent(agentId: string): Promise<{ provider: any; prefs: AgentLLMPreferences }> {
		// Load per-agent preferences; fallback to OpenAI defaults
		const { data } = await this.supabase.from('agent_llm_preferences').select('*').eq('agent_id', agentId).maybeSingle();
		const prefs: AgentLLMPreferences = data || { provider: 'openai', model: 'gpt-4o-mini', params: {}, embedding_model: 'text-embedding-3-small' };
		
		// OpenAI Provider
		if (prefs.provider === 'openai') {
			const apiKey = await this.getSystemAPIKey('openai');
			if (!apiKey) {
				throw new Error('OpenAI API key not configured. Admin: Please add it in Admin > System API Keys.');
			}
			const openai = new OpenAI({ apiKey });
			return { provider: new OpenAIProvider(openai, { model: prefs.model }), prefs };
		}
		
		// Anthropic Provider (Claude)
		if (prefs.provider === 'anthropic') {
			const apiKey = await this.getSystemAPIKey('anthropic');
			if (!apiKey) {
				throw new Error('Anthropic API key not configured. Admin: Please add it in Admin > System API Keys.');
			}
			return { provider: new AnthropicProvider(apiKey, { model: prefs.model }), prefs };
		}
		
		// Future: add other providers (Google, Mistral, Groq, OpenRouter)
		
		// Unknown provider - throw error
		throw new Error(`Unknown LLM provider: ${prefs.provider}. Supported providers: openai, anthropic`);
	}

	async chat(agentId: string, messages: LLMMessage[], options: LLMChatOptions = {}): Promise<LLMChatResponse> {
		const { provider, prefs } = await this.resolveAgent(agentId);
		const merged: LLMChatOptions = { ...prefs.params, ...options, model: options.model || prefs.model } as any;
		return provider.chat(messages, merged);
	}

	stream(agentId: string, messages: LLMMessage[], options: LLMChatOptions = {}): ReadableStream<Uint8Array> {
		return undefined as any;
	}

	async embed(agentId: string, inputs: string[], modelHint?: string): Promise<number[][]> {
		const { provider, prefs } = await this.resolveAgent(agentId);
		return provider.embed(inputs, modelHint || prefs.embedding_model);
	}
}


