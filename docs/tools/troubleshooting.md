# Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the MCP tool and credential management system.

## Common Issues

### Gmail Token Refresh Failures

#### Issue: "invalid_grant" Error

**Symptoms**:
- Token refresh returns `invalid_grant` error
- Gmail integration stops working after 7 days
- Error message: "Token has been expired or revoked"

**Causes**:
1. Refresh token expired (7-day inactivity for unverified apps)
2. User revoked access in Google Account settings
3. OAuth app credentials changed

**Solutions**:

```javascript
// 1. Check token status
const { data: connection } = await supabase
  .from('user_oauth_connections')
  .select('*')
  .eq('provider_id', gmailProviderId)
  .single();

console.log('Connection status:', connection.connection_status);
console.log('Last refresh:', connection.last_token_refresh);

// 2. If expired, guide user to reconnect
if (connection.connection_status === 'expired') {
  // Show reconnection UI
  showReconnectPrompt();
}

// 3. For development, verify app in Google Console
// Go to: https://console.cloud.google.com/apis/credentials
// Submit for verification to avoid 7-day expiry
```

#### Issue: Token Not Decrypting

**Symptoms**:
- Vault decrypt returns null
- "Vault error" in logs

**Solutions**:

```javascript
// Check if token is UUID (Vault) or plain text
function isVaultId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Decrypt only if it's a Vault ID
let token = connection.vault_access_token_id;
if (isVaultId(token)) {
  const { data } = await supabase.rpc('vault_decrypt', {
    vault_id: token
  });
  token = data.decrypted_secret;
}
```

---

### Web Search API Issues

#### Issue: API Key Not Working

**Symptoms**:
- 401 Unauthorized errors
- "Invalid API key" messages

**Solutions**:

```javascript
// 1. Verify API key format
const validateApiKey = (key, provider) => {
  switch (provider) {
    case 'serper_api':
      return /^[a-f0-9]{40}$/.test(key);
    case 'serpapi':
      return key.length === 64;
    case 'brave_search':
      return key.startsWith('BSA');
    default:
      return false;
  }
};

// 2. Test API key directly
async function testApiKey(provider, apiKey) {
  let testUrl;
  switch (provider) {
    case 'serper_api':
      testUrl = 'https://google.serper.dev/search';
      break;
    case 'serpapi':
      testUrl = 'https://serpapi.com/search?api_key=' + apiKey;
      break;
    case 'brave_search':
      testUrl = 'https://api.search.brave.com/res/v1/web/search';
      break;
  }
  
  const response = await fetch(testUrl, {
    headers: provider === 'serper_api' 
      ? { 'X-API-KEY': apiKey }
      : provider === 'brave_search'
      ? { 'X-Subscription-Token': apiKey }
      : {}
  });
  
  return response.ok;
}
```

#### Issue: Rate Limit Exceeded

**Symptoms**:
- 429 Too Many Requests
- Search stops working temporarily

**Solutions**:

```javascript
// Implement exponential backoff
async function searchWithRetry(query, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await performSearch(query);
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = error;
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}
```

---

### Connection Management Issues

#### Issue: Credentials Not Showing

**Symptoms**:
- Credentials page empty
- "No credentials" in agent modal
- Inconsistent connection status

**Root Cause**:
- Multiple data sources not synchronized
- Frontend caching issues

**Solutions**:

```javascript
// 1. Force refresh connections
const { refetch } = useConnections();
await refetch();

// 2. Clear any local caches
localStorage.removeItem('connections_cache');
sessionStorage.clear();

// 3. Check database directly
const { data } = await supabase
  .from('user_oauth_connections')
  .select('*')
  .eq('user_id', userId);
console.log('Direct DB query:', data);

// 4. Ensure using centralized hook
// ✅ CORRECT
const { connections } = useConnections();

// ❌ WRONG - Don't query directly
const connections = await supabase.from('user_oauth_connections').select();
```

#### Issue: Revoked Credentials Still Visible

**Symptoms**:
- Revoked credentials remain in UI
- Status shows "revoked" instead of being removed

**Solutions**:

```javascript
// Use optimistic updates in useConnections hook
const revoke = async (connectionId) => {
  // Immediately remove from UI
  setConnections(prev => prev.filter(c => c.id !== connectionId));
  
  // Then update backend
  await supabase
    .from('user_oauth_connections')
    .delete()
    .eq('id', connectionId);
};
```

---

### Agent Permission Issues

#### Issue: Agent Can't Access Tool

**Symptoms**:
- "Agent lacks permission" errors
- Tool not available in agent interface

**Diagnostic Steps**:

```javascript
// 1. Check if connection exists
const { data: connection } = await supabase
  .from('user_oauth_connections')
  .select('*')
  .eq('id', connectionId)
  .single();

console.log('Connection exists:', !!connection);
console.log('Connection status:', connection?.connection_status);

// 2. Check if permission exists
const { data: permission } = await supabase
  .from('agent_oauth_permissions')
  .select('*')
  .eq('agent_id', agentId)
  .eq('connection_id', connectionId)
  .single();

console.log('Permission exists:', !!permission);
console.log('Permission details:', permission?.permissions);

// 3. Check RLS policies
const { data: canAccess } = await supabase.rpc('check_agent_access', {
  p_agent_id: agentId,
  p_connection_id: connectionId
});

console.log('RLS allows access:', canAccess);
```

**Solutions**:

```javascript
// Create missing permission
if (!permission) {
  await supabase
    .from('agent_oauth_permissions')
    .insert({
      agent_id: agentId,
      connection_id: connectionId,
      permissions: getDefaultPermissions(provider)
    });
}
```

---

### Database & RLS Issues

#### Issue: RLS Policy Violations

**Symptoms**:
- "new row violates row-level security policy"
- Empty results when data should exist

**Solutions**:

```sql
-- Check current user
SELECT auth.uid();

-- Test RLS policies
SET LOCAL ROLE authenticated;
SET LOCAL auth.uid = 'user-uuid';

SELECT * FROM user_oauth_connections;

-- Temporarily disable RLS (admin only)
ALTER TABLE user_oauth_connections DISABLE ROW LEVEL SECURITY;

-- Fix and re-enable
ALTER TABLE user_oauth_connections ENABLE ROW LEVEL SECURITY;
```

#### Issue: Foreign Key Constraints

**Symptoms**:
- "violates foreign key constraint"
- Can't delete records

**Solutions**:

```sql
-- Check constraints
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'agent_oauth_permissions';

-- Add CASCADE DELETE if needed
ALTER TABLE agent_oauth_permissions
DROP CONSTRAINT agent_oauth_permissions_connection_id_fkey,
ADD CONSTRAINT agent_oauth_permissions_connection_id_fkey
  FOREIGN KEY (connection_id)
  REFERENCES user_oauth_connections(id)
  ON DELETE CASCADE;
```

---

### Edge Function Issues

#### Issue: CORS Errors

**Symptoms**:
- "No 'Access-Control-Allow-Origin' header"
- Preflight request fails

**Solutions**:

```typescript
// In edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Add to all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

#### Issue: Function Timeout

**Symptoms**:
- Function execution exceeds time limit
- 504 Gateway Timeout

**Solutions**:

```typescript
// 1. Increase timeout in config
// supabase/functions/config.toml
[functions.gmail-api]
verify_jwt = true
timeout = 30  # Increase from default 10s

// 2. Implement streaming for large operations
async function* streamResults(query) {
  let pageToken = null;
  
  do {
    const page = await fetchPage(query, pageToken);
    yield page.results;
    pageToken = page.nextPageToken;
  } while (pageToken);
}

// 3. Use background jobs for long operations
await supabase.from('job_queue').insert({
  type: 'process_emails',
  payload: { query },
  status: 'pending'
});
```

---

### UI/UX Issues

#### Issue: Components Not Updating

**Symptoms**:
- Stale data displayed
- Changes not reflected immediately

**Solutions**:

```typescript
// 1. Check React keys
{connections.map(conn => (
  <ConnectionCard 
    key={conn.id}  // Ensure unique, stable keys
    connection={conn}
  />
))}

// 2. Force re-render
const [, forceUpdate] = useReducer(x => x + 1, 0);
// Call forceUpdate() when needed

// 3. Use proper dependencies
useEffect(() => {
  fetchData();
}, [userId, connectionId]); // Include all dependencies

// 4. Avoid stale closures
const handleClick = useCallback(() => {
  // Use latest state
  setData(prevData => ({ ...prevData, updated: true }));
}, []);
```

---

## Diagnostic Scripts

### Check System Health

```javascript
// scripts/check_system_health.js
async function checkSystemHealth() {
  const checks = {
    database: false,
    vault: false,
    functions: false,
    providers: false
  };
  
  // Check database
  try {
    await supabase.from('oauth_providers').select('count');
    checks.database = true;
  } catch (e) {
    console.error('Database check failed:', e);
  }
  
  // Check Vault
  try {
    await supabase.rpc('vault_list_secrets');
    checks.vault = true;
  } catch (e) {
    console.error('Vault check failed:', e);
  }
  
  // Check functions
  try {
    const { error } = await supabase.functions.invoke('health-check');
    checks.functions = !error;
  } catch (e) {
    console.error('Functions check failed:', e);
  }
  
  // Check providers
  try {
    const providers = ['gmail', 'serper_api', 'serpapi', 'brave_search'];
    const { data } = await supabase
      .from('oauth_providers')
      .select('name')
      .in('name', providers);
    
    checks.providers = data.length === providers.length;
  } catch (e) {
    console.error('Providers check failed:', e);
  }
  
  console.table(checks);
  return checks;
}
```

### Debug Connection Issues

```javascript
// scripts/debug_connection.js
async function debugConnection(userId, providerId) {
  console.log('=== Connection Debug ===');
  
  // 1. Check connection exists
  const { data: conn } = await supabase
    .from('user_oauth_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .single();
  
  console.log('Connection:', conn);
  
  if (!conn) {
    console.error('No connection found');
    return;
  }
  
  // 2. Check token validity
  if (conn.credential_type === 'oauth') {
    const expiresAt = new Date(conn.token_expires_at);
    const isExpired = expiresAt < new Date();
    console.log('Token expired:', isExpired);
    
    if (isExpired) {
      console.log('Attempting refresh...');
      const { error } = await supabase.functions.invoke('oauth-refresh', {
        body: { connectionId: conn.id }
      });
      
      if (error) {
        console.error('Refresh failed:', error);
      } else {
        console.log('Refresh successful');
      }
    }
  }
  
  // 3. Check Vault access
  if (conn.vault_access_token_id) {
    try {
      const { data } = await supabase.rpc('vault_decrypt', {
        vault_id: conn.vault_access_token_id
      });
      console.log('Vault access:', !!data);
    } catch (e) {
      console.error('Vault error:', e);
    }
  }
  
  // 4. Check agent permissions
  const { data: perms } = await supabase
    .from('agent_oauth_permissions')
    .select('*')
    .eq('connection_id', conn.id);
  
  console.log('Agent permissions:', perms);
}
```

## Environment-Specific Issues

### Local Development

```bash
# Issue: Can't connect to local Supabase
# Solution: Check Docker is running
docker ps

# Start Supabase
supabase start

# Check status
supabase status

# Issue: Edge functions not working locally
# Solution: Serve functions separately
supabase functions serve

# Issue: Secrets not available locally
# Solution: Create .env.local
echo "GOOGLE_CLIENT_ID=your-id" >> .env.local
echo "GOOGLE_CLIENT_SECRET=your-secret" >> .env.local
supabase functions serve --env-file .env.local
```

### Production

```bash
# Issue: Deployment fails
# Solution: Check logs
supabase functions list
supabase functions logs oauth-refresh

# Issue: Secrets not set
# Solution: Set via CLI
supabase secrets set GOOGLE_CLIENT_ID=your-id --project-ref your-ref

# Issue: Database migrations not applied
# Solution: Run migrations
supabase db push --project-ref your-ref
```

## Performance Issues

### Slow Queries

```sql
-- Identify slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Add indexes
CREATE INDEX idx_connections_user_status 
ON user_oauth_connections(user_id, connection_status);

CREATE INDEX idx_permissions_agent_connection 
ON agent_oauth_permissions(agent_id, connection_id);

-- Analyze tables
ANALYZE user_oauth_connections;
ANALYZE agent_oauth_permissions;
```

### Memory Leaks

```javascript
// Identify memory leaks
if (typeof window !== 'undefined') {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('Memory:', entry);
    }
  });
  
  observer.observe({ entryTypes: ['measure'] });
}

// Clean up subscriptions
useEffect(() => {
  const subscription = supabase
    .from('user_oauth_connections')
    .on('*', handleChange)
    .subscribe();
  
  return () => {
    subscription.unsubscribe(); // Important!
  };
}, []);
```

## Getting Help

### Support Channels

1. **Documentation**: Check `/docs/tools/` folder
2. **GitHub Issues**: Report bugs and feature requests
3. **Discord Community**: Get help from other developers
4. **Support Email**: support@yourdomain.com

### Information to Provide

When reporting issues, include:

1. **Error messages** (full stack trace)
2. **Steps to reproduce**
3. **Environment** (browser, OS, versions)
4. **Network logs** (HAR file)
5. **Console logs**
6. **Database query results**
7. **Edge function logs**

### Debug Mode

Enable debug mode for verbose logging:

```javascript
// In frontend
localStorage.setItem('DEBUG', 'true');

// In edge functions
Deno.env.set('DEBUG', 'true');

// In database
SET log_statement = 'all';
SET log_duration = on;
```
