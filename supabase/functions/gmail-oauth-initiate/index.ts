import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { redirect_uri } = await req.json()
    
    if (!redirect_uri) {
      throw new Error('Redirect URI is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header provided')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Get Google OAuth credentials from Supabase secrets/vault
    // First, try to get from vault
    let clientId = null
    let clientSecret = null
    
    try {
      // Try to get OAuth credentials from Supabase vault
      const { data: clientIdData } = await supabase.rpc('vault_decrypt', {
        vault_id: Deno.env.get('GOOGLE_CLIENT_ID_VAULT_ID')
      })
      const { data: clientSecretData } = await supabase.rpc('vault_decrypt', {
        vault_id: Deno.env.get('GOOGLE_CLIENT_SECRET_VAULT_ID')
      })
      
      if (clientIdData && clientSecretData) {
        clientId = clientIdData
        clientSecret = clientSecretData
      }
    } catch (vaultError) {
      console.log('Vault access failed, trying environment variables')
    }
    
    // Fallback to environment variables if vault fails
    if (!clientId || !clientSecret) {
      clientId = Deno.env.get('GOOGLE_CLIENT_ID')
      clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    }
    
    if (!clientId || !clientSecret) {
      // Return a helpful error message for the developer
      throw new Error(
        'Google OAuth is not configured. Please set up OAuth credentials:\n\n' +
        '1. Go to https://console.cloud.google.com/\n' +
        '2. Create or select a project\n' +
        '3. Enable the Gmail API\n' +
        '4. Create OAuth 2.0 credentials (Web application type)\n' +
        '5. Add ' + redirect_uri + ' to Authorized redirect URIs\n' +
        '6. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase Edge Functions\n\n' +
        'See: https://supabase.com/docs/guides/functions/secrets'
      )
    }

    // Generate PKCE challenge
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    
    // Store code verifier in user's session or temporary storage
    // For now, we'll return it to be stored client-side
    const state = btoa(JSON.stringify({ 
      user_id: user.id, 
      timestamp: Date.now(),
      code_verifier: codeVerifier 
    }))
    
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirect_uri,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`

    return new Response(
      JSON.stringify({ 
        auth_url: authUrl,
        state: state
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Gmail OAuth initiation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to initiate OAuth flow',
        details: error.message?.includes('not configured') ? error.message : undefined
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400,
      }
    )
  }
})

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
} 