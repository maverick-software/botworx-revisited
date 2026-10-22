# Edge Functions Documentation

## Overview

Supabase Edge Functions power the backend operations for credential management, OAuth flows, and API integrations. These Deno-based serverless functions provide secure, scalable endpoints for tool execution.

## Core Functions

### oauth-refresh

**Location**: `supabase/functions/oauth-refresh/index.ts`

Handles OAuth token refresh for all OAuth providers.

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
    
    // Create service client for DB operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Create user client for auth context
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );
    
    // Get user session
    const { data: { user }, error: authError } = 
      await supabaseUser.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Get connection with provider info
    const { data: connection, error: connError } = 
      await supabaseService
        .from('user_oauth_connections')
        .select(`
          *,
          provider:oauth_providers(*)
        `)
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();
    
    if (connError || !connection) {
      throw new Error('Connection not found');
    }
    
    // Decrypt refresh token from Vault
    let refreshToken = connection.vault_refresh_token_id;
    
    // Check if it's a UUID (Vault reference)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(refreshToken);
    
    if (isUUID) {
      const { data: vaultData, error: vaultError } = 
        await supabaseUser.rpc('vault_decrypt', {
          vault_id: refreshToken
        });
      
      if (vaultError) throw vaultError;
      refreshToken = vaultData.decrypted_secret;
    }
    
    // Provider-specific refresh logic
    let newTokens;
    switch (connection.provider.name) {
      case 'gmail':
        newTokens = await refreshGoogleToken(refreshToken);
        break;
      // Add other OAuth providers here
      default:
        throw new Error(`Unsupported provider: ${connection.provider.name}`);
    }
    
    // Update tokens in database
    await supabaseService
      .from('user_oauth_connections')
      .update({
        vault_access_token_id: newTokens.access_token,
        vault_refresh_token_id: newTokens.refresh_token || refreshToken,
        token_expires_at: new Date(
          Date.now() + (newTokens.expires_in || 3600) * 1000
        ).toISOString(),
        last_token_refresh: new Date().toISOString(),
        connection_status: 'connected'
      })
      .eq('id', connectionId);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        expires_in: newTokens.expires_in 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error: any) {
    // Handle specific OAuth errors
    if (error.message?.includes('invalid_grant')) {
      // Update connection status
      await supabaseService
        .from('user_oauth_connections')
        .update({ connection_status: 'expired' })
        .eq('id', connectionId);
      
      return new Response(
        JSON.stringify({
          error: 'Your connection has expired and needs to be renewed. Please disconnect and reconnect your account.'
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Token refresh failed');
  }
  
  return await response.json();
}
```

### gmail-api

**Location**: `supabase/functions/gmail-api/index.ts`

Executes Gmail API operations with permission enforcement.

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { google } from 'https://esm.sh/googleapis@118.0.0';

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { action, connectionId, agentId, params } = await req.json();
    
    // Verify agent permissions if agentId provided
    if (agentId) {
      const hasPermission = await checkAgentPermission(
        agentId, 
        connectionId, 
        action
      );
      
      if (!hasPermission) {
        throw new Error('Agent lacks required permission');
      }
    }
    
    // Get access token
    const accessToken = await getValidAccessToken(connectionId);
    
    // Initialize Gmail client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Execute action
    let result;
    switch (action) {
      case 'list':
        result = await listMessages(gmail, params, agentId);
        break;
        
      case 'get':
        result = await getMessage(gmail, params);
        break;
        
      case 'search':
        result = await searchMessages(gmail, params, agentId);
        break;
        
      case 'getAttachment':
        result = await getAttachment(gmail, params);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Log operation for audit
    await logOperation({
      function_name: 'gmail-api',
      action,
      connection_id: connectionId,
      agent_id: agentId,
      success: true
    });
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error: any) {
    // Log error
    await logOperation({
      function_name: 'gmail-api',
      error: error.message,
      success: false
    });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.status || 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

async function searchMessages(
  gmail: any, 
  params: any, 
  agentId?: string
) {
  // Get agent permissions if applicable
  let permissions = {};
  if (agentId) {
    permissions = await getAgentPermissions(agentId);
  }
  
  // Build query with permission filters
  let query = params.query || '';
  
  // Apply date range filter
  if (permissions.date_range_days) {
    const date = new Date();
    date.setDate(date.getDate() - permissions.date_range_days);
    query += ` after:${date.toISOString().split('T')[0]}`;
  }
  
  // List messages
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: Math.min(
      params.maxResults || 10,
      permissions.max_results || 50
    ),
    labelIds: permissions.allowed_labels || ['INBOX']
  });
  
  if (!response.data.messages) {
    return { messages: [] };
  }
  
  // Fetch message details
  const messages = await Promise.all(
    response.data.messages.slice(0, params.maxResults || 10).map(
      async (msg: any) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: params.includeBody ? 'full' : 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });
        
        return formatMessage(detail.data);
      }
    )
  );
  
  return { messages, totalResults: response.data.resultSizeEstimate };
}
```

### web-search-api

**Location**: `supabase/functions/web-search-api/index.ts`

Unified web search across multiple providers.

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { query, connectionId, agentId, options } = await req.json();
    
    // Get connection and provider info
    const connection = await getConnection(connectionId);
    
    // Check agent permissions if applicable
    if (agentId) {
      const canSearch = await checkSearchPermission(agentId, connectionId);
      if (!canSearch) {
        throw new Error('Agent lacks search permission');
      }
    }
    
    // Get API key from Vault
    const apiKey = await getApiKeyFromVault(connection);
    
    // Execute search based on provider
    let results;
    switch (connection.provider.name) {
      case 'serper_api':
        results = await searchWithSerper(apiKey, query, options);
        break;
        
      case 'serpapi':
        results = await searchWithSerpAPI(apiKey, query, options);
        break;
        
      case 'brave_search':
        results = await searchWithBrave(apiKey, query, options);
        break;
        
      default:
        throw new Error(`Unknown provider: ${connection.provider.name}`);
    }
    
    // Apply permission-based filtering if agent
    if (agentId) {
      results = await applyPermissionFilters(
        results, 
        agentId, 
        connectionId
      );
    }
    
    // Log search for analytics
    await logSearch({
      provider: connection.provider.name,
      query,
      result_count: results.length,
      agent_id: agentId
    });
    
    return new Response(
      JSON.stringify({ results }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
    
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.status || 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

async function getApiKeyFromVault(connection: any): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Try vault_access_token_id first (preferred)
  if (connection.vault_access_token_id) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(connection.vault_access_token_id);
    
    if (isUUID) {
      const { data, error } = await supabase.rpc('vault_decrypt', {
        vault_id: connection.vault_access_token_id
      });
      
      if (!error && data) {
        return data.decrypted_secret;
      }
    } else {
      // Plain text (shouldn't happen in production)
      return connection.vault_access_token_id;
    }
  }
  
  // Fallback to legacy encrypted_access_token
  if (connection.encrypted_access_token) {
    return connection.encrypted_access_token;
  }
  
  throw new Error('No API key found for connection');
}
```

## Common Patterns

### CORS Handling

```typescript
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 
      'POST, GET, OPTIONS, PUT, DELETE',
  };
}

// In function handler
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: getCorsHeaders() });
}
```

### Authentication

```typescript
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader }
      }
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}
```

### Error Handling

```typescript
class FunctionError extends Error {
  status: number;
  
  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
  }
}

// Usage
try {
  // Function logic
} catch (error: any) {
  if (error instanceof FunctionError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.status }
    );
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error);
  
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500 }
  );
}
```

### Vault Operations

```typescript
async function storeInVault(secret: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase.rpc('vault_encrypt', {
    secret,
    key_id: crypto.randomUUID()
  });
  
  if (error) throw error;
  return data.vault_id;
}

async function getFromVault(vaultId: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase.rpc('vault_decrypt', {
    vault_id: vaultId
  });
  
  if (error) throw error;
  return data.decrypted_secret;
}
```

## Environment Variables

### Required Secrets

```bash
# Set via Supabase CLI or Dashboard
supabase secrets set GOOGLE_CLIENT_ID=your-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=your-secret
supabase secrets set SERPER_API_KEY=your-key  # Optional fallback
supabase secrets set SERPAPI_KEY=your-key     # Optional fallback
supabase secrets set BRAVE_SEARCH_KEY=your-key # Optional fallback
```

### Automatic Variables

```typescript
// Available in all edge functions
Deno.env.get('SUPABASE_URL')           // Supabase project URL
Deno.env.get('SUPABASE_ANON_KEY')      // Anonymous key
Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') // Service role key
Deno.env.get('SUPABASE_DB_URL')        // Direct DB connection
```

## Deployment

### Local Development

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test specific function
supabase functions serve oauth-refresh --env-file .env.local
```

### Production Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy gmail-api

# Deploy with secrets
supabase functions deploy --project-ref your-project-ref
```

## Testing

### Unit Tests

```typescript
// tests/oauth-refresh.test.ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('refreshGoogleToken returns new tokens', async () => {
  const mockRefreshToken = 'mock-refresh-token';
  
  // Mock fetch
  globalThis.fetch = async (url: string, options: any) => {
    assertEquals(url, 'https://oauth2.googleapis.com/token');
    
    return new Response(
      JSON.stringify({
        access_token: 'new-access-token',
        expires_in: 3600
      }),
      { status: 200 }
    );
  };
  
  const result = await refreshGoogleToken(mockRefreshToken);
  
  assertEquals(result.access_token, 'new-access-token');
  assertEquals(result.expires_in, 3600);
});
```

### Integration Tests

```bash
# Test with curl
curl -X POST \
  https://your-project.supabase.co/functions/v1/oauth-refresh \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "test-connection-id"}'
```

## Monitoring

### Logging

```typescript
// Structured logging
function log(level: string, message: string, data?: any) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
}

// Usage
log('info', 'Function invoked', { 
  function: 'gmail-api',
  action: 'search' 
});
```

### Metrics

```typescript
// Track function metrics
async function trackMetric(
  metric: string, 
  value: number, 
  tags?: Record<string, string>
) {
  // Send to monitoring service
  await fetch('https://metrics.example.com/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric,
      value,
      tags,
      timestamp: Date.now()
    })
  });
}

// Usage
await trackMetric('function.duration', duration, {
  function: 'gmail-api',
  action: 'search'
});
```

## Performance Optimization

### Caching

```typescript
// Simple in-memory cache
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  
  if (!cached || cached.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCached(key: string, data: any, ttl: number = 300000) {
  cache.set(key, {
    data,
    expires: Date.now() + ttl
  });
}
```

### Connection Pooling

```typescript
// Reuse Supabase clients
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }
  
  return supabaseClient;
}
```

## Security Best Practices

1. **Always validate input** - Sanitize and validate all request data
2. **Use service role carefully** - Only for trusted operations
3. **Implement rate limiting** - Prevent abuse
4. **Log security events** - Track suspicious activity
5. **Rotate secrets regularly** - Update API keys and tokens
6. **Use HTTPS only** - Never send credentials over HTTP
7. **Implement timeouts** - Prevent hanging requests
8. **Validate permissions** - Check agent permissions before operations

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure OPTIONS handler returns proper headers
2. **Auth failures**: Check Authorization header format
3. **Vault errors**: Verify service role key has vault access
4. **Timeout errors**: Increase function timeout in config
5. **Memory errors**: Optimize data processing, use streaming

### Debug Mode

```typescript
const DEBUG = Deno.env.get('DEBUG') === 'true';

function debug(message: string, data?: any) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, data);
  }
}
```
