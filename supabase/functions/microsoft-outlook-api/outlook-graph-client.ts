/**
 * Microsoft Graph API Client
 * Handles authentication, requests, rate limiting, and token refresh
 * Follows existing Gmail integration patterns with Microsoft Graph specifics
 */

import { delay, enhanceErrorForLLM } from './outlook-utils.ts';

export interface GraphClientContext {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  agentId: string;
  supabaseClient: any;
}

export interface GraphAPIResponse {
  data?: any;
  error?: any;
  status: number;
  headers: Headers;
}

/**
 * Microsoft Graph API Client with built-in retry logic and error handling
 */
export class OutlookGraphClient {
  private accessToken: string;
  private refreshToken?: string;
  private userId: string;
  private agentId: string;
  private supabaseClient: any;
  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private maxRetries = 3;
  private baseDelayMs = 1000;
  private maxDelayMs = 30000;

  constructor(context: GraphClientContext) {
    this.accessToken = context.accessToken;
    this.refreshToken = context.refreshToken;
    this.userId = context.userId;
    this.agentId = context.agentId;
    this.supabaseClient = context.supabaseClient;
  }

  /**
   * GET request with retry logic
   */
  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return this.executeWithRetry(() => this.makeRequest('GET', url.toString()));
  }

  /**
   * POST request with retry logic
   */
  async post(endpoint: string, data: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.executeWithRetry(() => this.makeRequest('POST', url, data));
  }

  /**
   * PATCH request with retry logic
   */
  async patch(endpoint: string, data: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.executeWithRetry(() => this.makeRequest('PATCH', url, data));
  }

  /**
   * DELETE request with retry logic
   */
  async delete(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.executeWithRetry(() => this.makeRequest('DELETE', url));
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (!this.shouldRetry(error) || attempt === this.maxRetries) {
          throw this.enhanceError(error);
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, error);
        console.log(`[outlook-graph-client] Retry attempt ${attempt + 1} after ${delay}ms delay`);
        await this.sleep(delay);
      }
    }

    throw this.enhanceError(lastError);
  }

  /**
   * Make HTTP request to Microsoft Graph API
   */
  private async makeRequest(method: string, url: string, data?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Agentopia-Outlook-Integration/1.0'
    };

    const requestOptions: RequestInit = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(data);
    }

    console.log(`[outlook-graph-client] ${method} ${url}`);

    try {
      const response = await fetch(url, requestOptions);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        
        console.log(`[outlook-graph-client] Rate limited, waiting ${delayMs}ms`);
        throw {
          status: 429,
          retryAfter: delayMs,
          message: 'Rate limit exceeded'
        };
      }

      // Handle authentication errors
      if (response.status === 401) {
        console.log('[outlook-graph-client] Token expired, attempting refresh');
        await this.refreshTokenIfPossible();
        throw {
          status: 401,
          message: 'Authentication token expired',
          shouldRefresh: true
        };
      }

      // Parse response
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Handle API errors
      if (!response.ok) {
        console.error(`[outlook-graph-client] API Error ${response.status}:`, responseData);
        throw {
          status: response.status,
          response: { data: responseData },
          message: responseData?.error?.message || `HTTP ${response.status} error`
        };
      }

      console.log(`[outlook-graph-client] Success: ${method} ${url}`);
      return responseData;

    } catch (error) {
      if (error.status) {
        // Already processed error, re-throw
        throw error;
      }

      // Network or other errors
      console.error('[outlook-graph-client] Network error:', error);
      throw {
        status: 0,
        message: error.message || 'Network error',
        originalError: error
      };
    }
  }

  /**
   * Determine if error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    const status = error.status;
    
    // Retry on rate limiting, server errors, and network issues
    if (status === 429 || status === 503 || status === 504 || status === 0) {
      return true;
    }

    // Retry on token refresh scenarios
    if (status === 401 && this.refreshToken) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number, error: any): number {
    // Use Retry-After header if available
    if (error.retryAfter) {
      return error.retryAfter;
    }

    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, this.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    await delay(ms);
  }

  /**
   * Attempt to refresh access token
   */
  private async refreshTokenIfPossible(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      console.log('[outlook-graph-client] Refreshing access token');

      // Get Microsoft Outlook service provider configuration
      const { data: provider, error: providerError } = await this.supabaseClient
        .from('service_providers')
        .select('*')
        .eq('name', 'microsoft-outlook')
        .single();

      if (providerError) {
        throw new Error('Failed to get service provider configuration');
      }

      // Get client credentials from Supabase secrets
      const clientId = Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_ID');
      const clientSecret = Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new Error('Missing Microsoft Outlook client credentials');
      }

      // Refresh token request
      const tokenResponse = await fetch(provider.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: clientId,
          client_secret: clientSecret
        })
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('[outlook-graph-client] Token refresh failed:', errorData);
        throw new Error('Token refresh failed');
      }

      const tokens = await tokenResponse.json();
      
      // Update access token
      this.accessToken = tokens.access_token;
      
      // Update refresh token if provided
      if (tokens.refresh_token) {
        this.refreshToken = tokens.refresh_token;
      }

      // Update tokens in Supabase Vault
      await this.updateTokensInVault(tokens);

      console.log('[outlook-graph-client] Token refreshed successfully');

    } catch (error) {
      console.error('[outlook-graph-client] Token refresh error:', error);
      throw new Error('Failed to refresh authentication token');
    }
  }

  /**
   * Update tokens in Supabase Vault
   */
  private async updateTokensInVault(tokens: any): Promise<void> {
    try {
      // Get user's OAuth connection
      const { data: connection, error: connectionError } = await this.supabaseClient
        .from('user_integration_credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('connection_status', 'active')
        .single();

      if (connectionError) {
        console.error('[outlook-graph-client] Failed to get connection:', connectionError);
        return;
      }

      // Update access token in vault
      if (tokens.access_token && connection.vault_access_token_id) {
        await this.supabaseClient.rpc('vault_update', {
          vault_id: connection.vault_access_token_id,
          secret_value: tokens.access_token
        });
      }

      // Update refresh token in vault if provided
      if (tokens.refresh_token && connection.vault_refresh_token_id) {
        await this.supabaseClient.rpc('vault_update', {
          vault_id: connection.vault_refresh_token_id,
          secret_value: tokens.refresh_token
        });
      }

      console.log('[outlook-graph-client] Tokens updated in vault');

    } catch (error) {
      console.error('[outlook-graph-client] Failed to update tokens in vault:', error);
      // Don't throw here - token refresh was successful, vault update is secondary
    }
  }

  /**
   * Enhance error with LLM-friendly message
   */
  private enhanceError(error: any): Error {
    const enhancedMessage = enhanceErrorForLLM(error, 'unknown');
    const enhancedError = new Error(enhancedMessage);
    
    // Preserve original error details for debugging
    (enhancedError as any).originalError = error;
    (enhancedError as any).status = error.status;
    
    return enhancedError;
  }

  /**
   * Get current access token (useful for debugging)
   */
  getAccessToken(): string {
    return this.accessToken;
  }

  /**
   * Check if client has refresh token capability
   */
  canRefreshToken(): boolean {
    return !!this.refreshToken;
  }
}

/**
 * Factory function to create Graph API client with authentication
 */
export async function createOutlookGraphClient(
  userId: string,
  agentId: string,
  supabaseClient: any
): Promise<OutlookGraphClient> {
  try {
    // Get Microsoft Outlook service provider ID
    const { data: provider, error: providerError } = await supabaseClient
      .from('service_providers')
      .select('id')
      .eq('name', 'microsoft-outlook')
      .single();

    if (providerError || !provider) {
      throw new Error('Microsoft Outlook service provider not found');
    }

    // Get user's active OAuth connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('user_integration_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('oauth_provider_id', provider.id)
      .eq('connection_status', 'active')
      .single();

    if (connectionError || !connection) {
      throw new Error('Question: You need to connect your Outlook account first. Please go to integrations settings and connect Microsoft Outlook.');
    }

    // Decrypt access token from vault
    const { data: accessToken, error: accessTokenError } = await supabaseClient.rpc('vault_decrypt', {
      vault_id: connection.vault_access_token_id
    });

    if (accessTokenError || !accessToken) {
      throw new Error('Question: Your Outlook connection has expired. Please reconnect your Outlook account in the integrations settings.');
    }

    // Decrypt refresh token if available
    let refreshToken = null;
    if (connection.vault_refresh_token_id) {
      const { data: decryptedRefreshToken } = await supabaseClient.rpc('vault_decrypt', {
        vault_id: connection.vault_refresh_token_id
      });
      refreshToken = decryptedRefreshToken;
    }

    // Create and return client
    return new OutlookGraphClient({
      accessToken,
      refreshToken,
      userId,
      agentId,
      supabaseClient
    });

  } catch (error) {
    console.error('[outlook-graph-client] Failed to create client:', error);
    throw error;
  }
}
