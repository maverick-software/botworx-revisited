/**
 * Mistral AI API Edge Function
 * Handles Mistral AI operations for agents using system-level API key
 * Supports chat completions and text generation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Request/Response interfaces
interface MistralRequest {
  agent_id: string;
  action: 'chat_completion' | 'text_generation';
  params: {
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
  };
}

interface MistralResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    model: string;
    tokens_used?: number;
  };
}

// Mistral API client
class MistralClient {
  private apiKey: string;
  private baseUrl = 'https://api.mistral.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: string = 'POST', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    console.log(`[Mistral] Making ${method} request to ${endpoint}`);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log(`[Mistral] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Mistral] API error response: ${errorText}`);
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      return responseData;
    } catch (error: any) {
      console.error(`[Mistral] Request failed:`, error.message);
      throw error;
    }
  }

  // Chat completion
  async chatCompletion(params: any): Promise<any> {
    const payload = {
      model: params.model || 'mistral-small-latest',
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens,
      top_p: params.top_p ?? 1,
      stream: params.stream ?? false,
    };

    // Remove undefined fields
    Object.keys(payload).forEach(key => 
      payload[key] === undefined && delete payload[key]
    );

    return await this.makeRequest('/chat/completions', 'POST', payload);
  }

  // Text generation (legacy endpoint)
  async textGeneration(params: any): Promise<any> {
    const payload = {
      model: params.model || 'mistral-small-latest',
      prompt: params.prompt,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens,
      top_p: params.top_p ?? 1,
    };

    // Remove undefined fields
    Object.keys(payload).forEach(key => 
      payload[key] === undefined && delete payload[key]
    );

    return await this.makeRequest('/completions', 'POST', payload);
  }
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const body: MistralRequest = await req.json();
    const { agent_id, action, params } = body;

    console.log(`[Mistral] Processing ${action} request for agent ${agent_id}`);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // ============================================
    // SYSTEM-LEVEL API KEY RETRIEVAL
    // ============================================
    console.log(`[Mistral] Fetching system-level API key for Mistral AI`);
    
    const { data: systemKey, error: systemKeyError } = await supabase
      .from('system_api_keys')
      .select('vault_secret_id, is_active')
      .eq('provider_name', 'mistral_ai')
      .eq('is_active', true)
      .single();

    console.log(`[Mistral] System key query result - Error: ${systemKeyError?.message}, Key found: ${!!systemKey}`);
    
    if (systemKeyError || !systemKey || !systemKey.vault_secret_id) {
      console.error(`[Mistral] System API key not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Mistral AI system API key is not configured. Please contact your administrator to set up this service in the Admin Settings.',
          metadata: { execution_time_ms: Date.now() - startTime }
        }),
        { 
          status: 503, // Service Unavailable
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Decrypt system API key from Vault
    console.log(`[Mistral] Decrypting system API key - Vault ID: ${systemKey.vault_secret_id}`);
    
    const { data: apiKeyData, error: keyError } = await supabase.rpc(
      'vault_decrypt',
      { vault_id: systemKey.vault_secret_id }
    );

    console.log(`[Mistral] Vault decryption result - API Key: ${apiKeyData ? 'SUCCESS' : 'FAILED'}`);
    
    if (keyError || !apiKeyData) {
      console.error(`[Mistral] API key decryption failed:`, keyError);
      throw new Error('Failed to decrypt Mistral AI system API key. Please contact your administrator.');
    }

    // Initialize Mistral client
    console.log(`[Mistral] Initializing Mistral client with system API key`);
    const mistralClient = new MistralClient(apiKeyData);

    // Execute the requested action
    console.log(`[Mistral] Executing action: ${action}`);
    let result: any;

    switch (action) {
      case 'chat_completion':
        if (!params.messages || !Array.isArray(params.messages)) {
          throw new Error('Missing or invalid "messages" parameter. Must be an array of message objects with role and content.');
        }
        result = await mistralClient.chatCompletion(params);
        break;
      
      case 'text_generation':
        if (!params.prompt) {
          throw new Error('Missing required "prompt" parameter for text generation.');
        }
        result = await mistralClient.textGeneration(params);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}. Supported actions: chat_completion, text_generation`);
    }

    // Extract token usage
    const tokensUsed = result.usage?.total_tokens || 0;

    // Log successful operation
    await supabase.from('tool_execution_logs').insert({
      agent_id: agent_id,
      user_id: user.id,
      tool_name: `mistral_${action}`,
      tool_provider: 'mistral_ai',
      parameters: params,
      result_data: result,
      success: true,
      execution_time_ms: Date.now() - startTime,
      quota_consumed: 1
    });

    const response: MistralResponse = {
      success: true,
      data: result,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        model: params.model || 'mistral-small-latest',
        tokens_used: tokensUsed,
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[Mistral] Error:', error);

    // Log failed operation
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      let logAgentId = null;
      let logAction = 'unknown';
      
      try {
        const requestBody = await req.clone().json();
        logAgentId = requestBody.agent_id || null;
        logAction = requestBody.action || 'unknown';
      } catch (parseError) {
        console.warn('[Mistral] Could not parse request body for error logging');
      }

      await supabase.from('tool_execution_logs').insert({
        agent_id: logAgentId,
        user_id: null,
        tool_name: `mistral_${logAction}`,
        tool_provider: 'mistral_ai',
        parameters: {},
        success: false,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
        quota_consumed: 0
      });
    } catch (logError) {
      console.error('[Mistral] Failed to log error:', logError);
    }

    const response: MistralResponse = {
      success: false,
      error: error.message,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        model: 'unknown'
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});




