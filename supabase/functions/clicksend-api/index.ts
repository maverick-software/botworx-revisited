import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ClickSend API configuration
const CLICKSEND_API_BASE_URL = 'https://rest.clicksend.com/v3';

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Request/Response interfaces
interface ClickSendRequest {
  agent_id: string;
  action: string;
  params: any;
}

interface ClickSendResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    quota_consumed?: number;
    message_id?: string;
    cost?: number;
  };
}

// ClickSend API client
class ClickSendClient {
  private baseUrl: string;
  private username: string;
  private apiKey: string;

  constructor(username: string, apiKey: string) {
    this.baseUrl = CLICKSEND_API_BASE_URL;
    this.username = username;
    this.apiKey = apiKey;
  }

  private getAuthHeader(): string {
    const credentials = btoa(`${this.username}:${this.apiKey}`);
    return `Basic ${credentials}`;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    console.log(`[ClickSend] Making ${method} request to ${endpoint}`);
    if (body) {
      console.log(`[ClickSend] Request payload:`, JSON.stringify(body, null, 2));
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log(`[ClickSend] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ClickSend] API error response: ${errorText}`);
        throw new Error(`ClickSend API error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`[ClickSend] Response data:`, JSON.stringify(responseData, null, 2));
      return responseData;
    } catch (error: any) {
      console.error(`[ClickSend] Request failed:`, error.message);
      throw error;
    }
  }

  // Send SMS message
  async sendSMS(to: string, body: string, from?: string): Promise<any> {
    const payload = {
      messages: [
        {
          source: 'agentopia',
          from: from || null,
          to: to,
          body: body,
        }
      ]
    };

    return await this.makeRequest('/sms/send', 'POST', payload);
  }

  // Send MMS message
  async sendMMS(to: string, body: string, mediaUrl: string, subject?: string, from?: string): Promise<any> {
    const payload = {
      messages: [
        {
          source: 'agentopia',
          from: from || null,
          to: to,
          subject: subject || '',
          body: body,
          media: [mediaUrl]
        }
      ]
    };

    return await this.makeRequest('/mms/send', 'POST', payload);
  }

  // Get account balance
  async getBalance(): Promise<any> {
    return await this.makeRequest('/account');
  }

  // Get SMS history
  async getSMSHistory(page: number = 1, limit: number = 50): Promise<any> {
    return await this.makeRequest(`/sms/history?page=${page}&limit=${limit}`);
  }

  // Get MMS history
  async getMMSHistory(page: number = 1, limit: number = 50): Promise<any> {
    return await this.makeRequest(`/mms/history?page=${page}&limit=${limit}`);
  }

  // Get delivery receipts
  async getDeliveryReceipts(page: number = 1, limit: number = 50): Promise<any> {
    return await this.makeRequest(`/sms/receipts?page=${page}&limit=${limit}`);
  }
}

// Utility functions
function validatePhoneNumber(phoneNumber: string): boolean {
  // Basic international phone number validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

function validateSMSBody(body: string): boolean {
  // SMS can be up to 1600 characters (concatenated)
  return body.length > 0 && body.length <= 1600;
}

function validateMMSMediaUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: ClickSendRequest = await req.json();
    const { agent_id, action, params } = body;

    console.log(`[ClickSend] Processing ${action} request for agent ${agent_id}`);
    
    // Extract parameters - handle both direct params and nested input structure
    let parameters: any;
    
    // CRITICAL FIX: If params is a string (e.g. from Responses API), parse it first
    if (typeof params === 'string') {
      try {
        parameters = JSON.parse(params);
        console.log(`[ClickSend] Parsed params from JSON string:`, JSON.stringify(parameters, null, 2));
      } catch (e) {
        console.error(`[ClickSend] Failed to parse params string:`, e);
        parameters = {};
      }
    } else if (params?.input && typeof params.input === 'string') {
      // Try to parse as JSON first, but if it fails, treat as plain text message
      try {
        parameters = JSON.parse(params.input);
        console.log(`[ClickSend] Parsed parameters from input field as JSON:`, JSON.stringify(parameters, null, 2));
      } catch (e) {
        console.log(`[ClickSend] Input field is not JSON, treating as plain text message:`, params.input);
        // If parsing fails and this is an SMS action, treat input as the message content
        if (action === 'send_sms') {
          parameters = {
            message: params.input,
            // Try to extract phone number from other params if available
            to: params.to || params.phone || params.phone_number
          };
        } else {
          parameters = params;
        }
      }
    } else {
      parameters = params || {};
      console.log(`[ClickSend] Using direct parameters:`, JSON.stringify(parameters, null, 2));
    }

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    console.log(`[ClickSend] Auth header present: ${!!authHeader}`);
    if (!authHeader) {
      console.error(`[ClickSend] Missing authorization header`);
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    console.log(`[ClickSend] User auth result - User ID: ${user?.id}, Error: ${userError?.message}`);
    if (userError || !user) {
      console.error(`[ClickSend] Authentication failed:`, userError);
      throw new Error('Invalid authentication token');
    }

    // ============================================
    // ACCOUNT-LEVEL CREDENTIAL RETRIEVAL
    // ============================================
    console.log(`[ClickSend] Fetching account-level credentials for user ${user.id}`);
    
    // Get the account_id from the user
    const { data: accountData, error: accountError } = await supabase
      .from('user_accounts')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountData) {
      console.error(`[ClickSend] Failed to get account for user:`, accountError);
      throw new Error('Failed to retrieve user account information');
    }

    const accountId = accountData.account_id;
    console.log(`[ClickSend] Account ID: ${accountId}`);

    // Check if user has ClickSend integration enabled
    const { data: permission, error: permissionError } = await supabase
      .from('agent_integration_permissions')
      .select('is_enabled')
      .eq('agent_id', agent_id)
      .eq('provider_name', 'clicksend')
      .single();

    if (permissionError || !permission || !permission.is_enabled) {
      console.error(`[ClickSend] Integration not enabled for agent ${agent_id}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ClickSend SMS is not enabled for this agent. Please enable it in the Integrations page.',
          metadata: { execution_time_ms: Date.now() - startTime }
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user's ClickSend credentials
    const { data: credentials, error: credentialsError } = await supabase
      .from('user_integration_credentials')
      .select('vault_secret_id, scopes')
      .eq('account_id', accountId)
      .eq('provider_name', 'clicksend')
      .single();

    if (credentialsError || !credentials || !credentials.vault_secret_id) {
      console.error(`[ClickSend] No credentials found for account ${accountId}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ClickSend SMS credentials not configured for your account. Please set up ClickSend in the Integrations page.',
          metadata: { execution_time_ms: Date.now() - startTime }
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Decrypt credentials from Supabase Vault
    console.log(`[ClickSend] Decrypting account credentials - Vault ID: ${credentials.vault_secret_id}`);
    
    const { data: credentialsData, error: decryptError } = await supabase.rpc(
      'vault_decrypt',
      { vault_id: credentials.vault_secret_id }
    );

    if (decryptError || !credentialsData) {
      console.error(`[ClickSend] Failed to decrypt credentials:`, decryptError);
      throw new Error('Failed to decrypt ClickSend credentials');
    }

    // Parse username:apikey format
    const credentialParts = credentialsData.split(':');
    if (credentialParts.length !== 2) {
      console.error(`[ClickSend] Invalid credential format - expected username:apikey`);
      throw new Error('Invalid ClickSend credentials format');
    }

    const [username, apiKey] = credentialParts;
    console.log(`[ClickSend] Successfully parsed account credentials - Username: ${username ? 'present' : 'missing'}, API Key: ${apiKey ? 'present' : 'missing'}`);

    // Initialize ClickSend client with account credentials
    console.log(`[ClickSend] Initializing ClickSend client with account credentials`);
    const clicksendClient = new ClickSendClient(username, apiKey);

    // Execute the requested action
    console.log(`[ClickSend] Executing action: ${action} with parameters:`, JSON.stringify(parameters, null, 2));
    let result: any;
    let quotaConsumed = 0;

    switch (action) {
      case 'send_sms':
        result = await handleSendSMS(clicksendClient, parameters);
        quotaConsumed = 1;
        break;
      
      case 'send_mms':
        result = await handleSendMMS(clicksendClient, parameters);
        quotaConsumed = 3; // MMS typically costs more
        break;
      
      case 'get_balance':
        result = await handleGetBalance(clicksendClient, parameters);
        quotaConsumed = 0; // Balance check is typically free
        break;
      
      case 'get_sms_history':
        result = await handleGetSMSHistory(clicksendClient, parameters);
        quotaConsumed = 0;
        break;
      
      case 'get_mms_history':
        result = await handleGetMMSHistory(clicksendClient, parameters);
        quotaConsumed = 0;
        break;
      
      case 'get_delivery_receipts':
        result = await handleGetDeliveryReceipts(clicksendClient, parameters);
        quotaConsumed = 0;
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Check if the result is a validation error (requires_retry from handleSendSMS)
    if (result && result.success === false && result.requires_retry) {
      console.log(`[ClickSend] Validation error - returning for LLM retry`);
      
      // Return validation error with HTTP 200 so the retry mechanism engages
      return new Response(
        JSON.stringify(result),
        { 
          status: 200,  // Important: 200 so universal-tool-executor processes it as retryable
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful operation
    await supabase.from('tool_execution_logs').insert({
      agent_id: agent_id,
      user_id: user.id,
      tool_name: `clicksend_${action}`,
      tool_provider: 'clicksend',
      parameters: parameters,
      result_data: result,
      success: true,
      execution_time_ms: Date.now() - startTime,
      quota_consumed: quotaConsumed
    });

    const response: ClickSendResponse = {
      success: true,
      data: result,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        quota_consumed: quotaConsumed,
        message_id: result?.data?.messages?.[0]?.message_id,
        cost: result?.data?.total_price
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[ClickSend] Error:', error);

    // Log failed operation - fix variable scope issue
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Parse the body to get agent_id and action if they exist
      let logAgentId = null;
      let logAction = 'unknown';
      let logParameters = {};
      
      try {
        const requestBody = await req.clone().json();
        logAgentId = requestBody.agent_id || null;
        logAction = requestBody.action || 'unknown';
        logParameters = requestBody.params || {};
      } catch (parseError) {
        console.warn('[ClickSend] Could not parse request body for error logging:', parseError);
      }

      await supabase.from('tool_execution_logs').insert({
        agent_id: logAgentId,
        user_id: null, // We may not have user context in error cases
        tool_name: `clicksend_${logAction}`,
        tool_provider: 'clicksend',
        parameters: logParameters,
        success: false,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
        quota_consumed: 0
      });
    } catch (logError) {
      console.error('[ClickSend] Failed to log error:', logError);
    }

    // Check if this is a validation error (retryable) or a hard error
    const isValidationError = error.message && (
      error.message.includes('Invalid phone number format') ||
      error.message.includes('missing') ||
      error.message.includes('required') ||
      error.message.includes('must be between')
    );
    
    const response: ClickSendResponse = {
      success: false,
      error: error.message,
      requires_retry: isValidationError,  // Flag validation errors as retryable
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: isValidationError ? 200 : 500,  // 200 for retryable errors, 500 for hard errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Action handlers
async function handleSendSMS(client: ClickSendClient, params: any): Promise<any> {
  // Handle multiple possible field names for flexibility
  let { to, body, message, phone, phone_number, text, content, from } = params;
  
  // Try to find phone number from various possible field names
  const phoneNumber = to || phone || phone_number;
  
  // Try to find message text from various possible field names
  const messageText = message || body || text || content;

  console.log(`[ClickSend] SMS Parameters - Phone: ${phoneNumber}, Message: ${messageText ? messageText.substring(0, 50) + '...' : 'undefined'}`);

  // Validate required parameters with intelligent error messages
  const missingParams = [];
  if (!phoneNumber) missingParams.push('to (phone number)');
  if (!messageText) missingParams.push('message or body (SMS text content)');
  
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}. Please provide: ${
      !phoneNumber ? 'a phone number in international format (e.g., +1234567890)' : ''
    }${!phoneNumber && !messageText ? ' and ' : ''}${
      !messageText ? 'the SMS message text' : ''
    }.`);
  }
  
  // Use the found values
  to = phoneNumber;
  const finalMessageText = messageText;

  // Smart phone number cleaning - handle all common formats before validation
  // This prevents unnecessary LLM retries for simple formatting issues
  const originalNumber = to;
  
  // Step 1: Remove all non-digit characters except the leading +
  let cleaned = to.replace(/[^\d+]/g, '');
  
  // Step 2: Handle multiple + signs - keep only the first
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.substring(1).replace(/\+/g, '');
    cleaned = '+' + digitsOnly;
  }
  
  // Step 3: Add country code if missing
  if (!cleaned.startsWith('+')) {
    const digits = cleaned;
    
    // If it's 10 digits and looks like a US number (area code starts with 2-9)
    if (digits.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
      cleaned = '+1' + digits;
    }
    // If it's 11 digits starting with 1 (US country code)
    else if (digits.length === 11 && digits.startsWith('1')) {
      cleaned = '+' + digits;
    }
    // Otherwise, assume it's a US number and add +1
    else if (digits.length >= 10) {
      cleaned = '+1' + digits;
    }
  }
  
  to = cleaned;
  
  if (originalNumber !== cleaned) {
    console.log(`[ClickSend] Smart-cleaned phone number: "${originalNumber}" → "${cleaned}"`);
  }

  // Validate phone number format after cleaning
  if (!validatePhoneNumber(to)) {
    // Only return error if cleaning didn't fix it
    const errorMessage = `Invalid phone number format. The number "${originalNumber}" was cleaned to "${to}" but is still invalid. Please provide a valid phone number with country code and area code.`;
    
    console.log(`[ClickSend] Phone validation error after cleaning: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      requires_retry: true,
      metadata: {
        error_type: 'validation_error',
        field: 'to',
        provided_value: originalNumber,
        cleaned_value: to,
        expected_format: '+1234567890 (international format)'
      }
    };
  }

  // Validate SMS body
  if (!validateSMSBody(finalMessageText)) {
    throw new Error('SMS message must be between 1 and 1600 characters');
  }

  return await client.sendSMS(to, finalMessageText, from);
}

async function handleSendMMS(client: ClickSendClient, params: any): Promise<any> {
  let { to, body, media_url, subject, from } = params;

  // Validate required parameters
  if (!to || !body || !media_url) {
    throw new Error('Missing required parameters: to, body, media_url');
  }

  // Auto-fix common phone number format issues (assume USA +1 if not specified)
  if (to && !to.startsWith('+')) {
    // Remove any non-digit characters except +
    const cleanNumber = to.replace(/[^\d]/g, '');
    
    // If it's 10 digits, assume US number
    if (cleanNumber.length === 10 && /^[2-9]\d{2}[2-9]\d{2}\d{4}$/.test(cleanNumber)) {
      to = `+1${cleanNumber}`;
      console.log(`[ClickSend] Auto-corrected US phone number to: ${to}`);
    }
    // If it's 11 digits starting with 1, assume US number with country code
    else if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
      to = `+${cleanNumber}`;
      console.log(`[ClickSend] Auto-corrected phone number to: ${to}`);
    }
  }

  // Validate phone number format
  if (!validatePhoneNumber(to)) {
    throw new Error(`Invalid phone number format. The number "${params.to}" was processed as "${to}". Please provide a valid phone number. For US numbers, use formats like: +1234567890, 1234567890, (123) 456-7890, or 123-456-7890.`);
  }

  // Validate media URL
  if (!validateMMSMediaUrl(media_url)) {
    throw new Error('Invalid media URL. Must be a valid HTTP/HTTPS URL');
  }

  return await client.sendMMS(to, body, media_url, subject, from);
}

async function handleGetBalance(client: ClickSendClient, params: any): Promise<any> {
  return await client.getBalance();
}

async function handleGetSMSHistory(client: ClickSendClient, params: any): Promise<any> {
  const { page = 1, limit = 50 } = params;
  
  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 1000) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-1000');
  }

  return await client.getSMSHistory(page, limit);
}

async function handleGetMMSHistory(client: ClickSendClient, params: any): Promise<any> {
  const { page = 1, limit = 50 } = params;
  
  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 1000) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-1000');
  }

  return await client.getMMSHistory(page, limit);
}

async function handleGetDeliveryReceipts(client: ClickSendClient, params: any): Promise<any> {
  const { page = 1, limit = 50 } = params;
  
  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 1000) {
    throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-1000');
  }

  return await client.getDeliveryReceipts(page, limit);
}

// Account-level credential approach: Each account manages their own ClickSend credentials
// This allows per-account sender identities and phone number configuration

