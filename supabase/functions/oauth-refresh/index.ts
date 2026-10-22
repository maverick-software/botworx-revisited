import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefreshRequest {
  connection_id: string;
}

async function refreshGmailToken(supabase: SupabaseClient, userId: string, connectionId: string): Promise<{ success: boolean; expires_at?: string }> {
  console.log(`Refreshing Gmail token for user ${userId}, connection ${connectionId}`);

  // Get the connection details including credential type
  const { data: connection, error: fetchError } = await supabase
    .from('user_integration_credentials')
    .select('vault_refresh_token_id, external_username, credential_type, service_providers!oauth_provider_id(name)')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !connection) {
    throw new Error(`Failed to retrieve connection: ${fetchError?.message || 'Connection not found'}`);
  }

  // Check if this is an API key connection (cannot be refreshed)
  if (connection.credential_type === 'api_key') {
    throw new Error('API keys cannot be refreshed. Please update your API key if it has expired.');
  }

  // Check if this is an OAuth connection with a refresh token
  if (connection.credential_type === 'oauth' && !connection.vault_refresh_token_id) {
    throw new Error('No refresh token found for this OAuth connection.');
  }
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  // CRITICAL FIX: Decrypt the refresh token from vault or use directly if it's plain text
  let actualRefreshToken: string;
  
  // Check if vault_refresh_token_id is a UUID (vault reference) or plain text token
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connection.vault_refresh_token_id);
  
  if (isUuid) {
    // It's a vault reference, decrypt it
    console.log('Decrypting refresh token from vault...');
    const { data: decryptedToken, error: decryptError } = await supabase.rpc(
      'vault_decrypt',
      { vault_id: connection.vault_refresh_token_id }
    );
    
    if (decryptError || !decryptedToken) {
      throw new Error(`Failed to decrypt refresh token: ${decryptError?.message || 'Decryption failed'}`);
    }
    
    actualRefreshToken = decryptedToken;
  } else {
    // It's stored as plain text (legacy format)
    console.log('Using refresh token stored as plain text...');
    actualRefreshToken = connection.vault_refresh_token_id;
  }

  console.log('Making token refresh request to Google...');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: actualRefreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token refresh failed:', error);
    
    // Parse the error response to provide better user guidance
    let errorDetails;
    try {
      errorDetails = JSON.parse(error);
    } catch (e) {
      errorDetails = { error: 'unknown', error_description: error };
    }
    
    // Handle specific OAuth error cases
    if (errorDetails.error === 'invalid_grant') {
      // Update connection status to indicate re-authentication is needed
      await supabase
        .from('user_integration_credentials')
        .update({
          connection_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId)
        .eq('user_id', userId);
      
      throw new Error(
        'Your Gmail connection has expired and needs to be renewed. ' +
        'This happens when tokens are unused for more than 7 days. ' +
        'Please disconnect and reconnect your Gmail account to restore access.'
      );
    }
    
    throw new Error(`Token refresh failed: ${error}`);
  }

  const newTokens = await tokenResponse.json();
  console.log(`Received new tokens. Has refresh token: ${!!newTokens.refresh_token}`);

  // Calculate expiry time
  const expiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString();

  // CRITICAL FIX: Properly encrypt tokens before storing
  // For consistency with the rest of the system, we'll store tokens as plain text
  // (since the system supports both vault UUIDs and plain text storage)
  const updateData: any = {
    vault_access_token_id: newTokens.access_token,
    token_expires_at: expiresAt,
    last_token_refresh: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Update refresh token if a new one was provided
  if (newTokens.refresh_token) {
    updateData.vault_refresh_token_id = newTokens.refresh_token;
  }

  const { error: updateError } = await supabase
    .from('user_integration_credentials')
    .update(updateData)
    .eq('id', connectionId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to update tokens: ${updateError.message}`);
  }

  console.log('Token refresh completed successfully, expires at:', expiresAt);
  return { success: true, expires_at: expiresAt };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { connection_id }: RefreshRequest = await req.json()
    if (!connection_id) {
      throw new Error('connection_id is required');
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Create Supabase client with user context for authentication
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { 
        autoRefreshToken: false,
        persistSession: false 
      },
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' }
      }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    const { success, expires_at } = await refreshGmailToken(supabaseService, user.id, connection_id);

    const expiryDate = new Date(expires_at!);
    const message = `Token refreshed successfully! New expiry: ${expiryDate.toLocaleString()}`;

    return new Response(JSON.stringify({ 
      success: success, 
      message: message,
      expires_at: expires_at 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('OAuth refresh error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}) 