# API Reference

## Overview

This document provides a comprehensive reference for all API endpoints, database operations, and function calls in the MCP tool and credential management system.

## Edge Function APIs

### oauth-refresh

Refreshes OAuth tokens for connected services.

**Endpoint**: `POST /functions/v1/oauth-refresh`

**Headers**:
```http
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

**Request Body**:
```json
{
  "connectionId": "uuid-of-connection"
}
```

**Response**:
```json
{
  "success": true,
  "expires_in": 3600
}
```

**Error Response**:
```json
{
  "error": "Your connection has expired and needs to be renewed. Please disconnect and reconnect your account."
}
```

**Status Codes**:
- `200`: Token refreshed successfully
- `400`: Invalid grant or expired token
- `401`: Unauthorized
- `404`: Connection not found
- `500`: Internal server error

---

### gmail-api

Executes Gmail API operations.

**Endpoint**: `POST /functions/v1/gmail-api`

**Headers**:
```http
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

**Request Body**:

#### List Messages
```json
{
  "action": "list",
  "connectionId": "uuid",
  "agentId": "uuid (optional)",
  "params": {
    "maxResults": 10,
    "query": "is:unread",
    "labelIds": ["INBOX"]
  }
}
```

#### Get Message
```json
{
  "action": "get",
  "connectionId": "uuid",
  "params": {
    "messageId": "message-id",
    "format": "full"
  }
}
```

#### Read Emails
```json
{
  "action": "read_emails",
  "agentId": "uuid",
  "params": {
    "max_results": 10,
    "query": "is:unread",
    "include_body": true
  }
}
```

#### Search Emails
```json
{
  "action": "search_emails",
  "agentId": "uuid",
  "params": { "query": "from:user@example.com subject:invoice", "max_results": 20 }
}
```

#### Email Actions
```json
{
  "action": "email_actions",
  "agentId": "uuid",
  "params": { "action": "mark_read", "message_ids": ["msgId1","msgId2"] }
}
```

**Response**:
```json
{ "success": true, "total": 2, "messages": [{ "id": "...", "subject": "...", "from": "...", "date": "...", "snippet": "...", "body_preview": "..." }] }
```

---

### web-search-api

Performs web searches across multiple providers.

**Endpoint**: `POST /functions/v1/web-search-api`

**Headers**:
```http
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

**Request Body**:
```json
{
  "query": "search query",
  "connectionId": "uuid",
  "agentId": "uuid (optional)",
  "options": {
    "numResults": 10,
    "safeSearch": true,
    "country": "us",
    "language": "en"
  }
}
```

**Response**:
```json
{
  "results": [
    {
      "title": "Result Title",
      "url": "https://example.com",
      "snippet": "Result description...",
      "position": 1,
      "domain": "example.com",
      "date": "2024-01-01",
      "thumbnail": "https://example.com/thumb.jpg"
    }
  ]
}
```

## Database APIs (via Supabase Client)

### user_oauth_connections

#### Create Connection
```typescript
const { data, error } = await supabase
  .from('user_oauth_connections')
  .insert({
    user_id: userId,
    provider_id: providerId,
    credential_type: 'oauth' | 'api_key',
    vault_access_token_id: vaultId,
    vault_refresh_token_id: vaultId, // OAuth only
    token_expires_at: timestamp,     // OAuth only
    connection_status: 'connected'
  })
  .select()
  .single();
```

#### Get User Connections
```typescript
const { data, error } = await supabase
  .from('user_oauth_connections')
  .select(`
    *,
    provider:oauth_providers(*)
  `)
  .eq('user_id', userId)
  .eq('connection_status', 'connected');
```

#### Update Connection Status
```typescript
const { error } = await supabase
  .from('user_oauth_connections')
  .update({ 
    connection_status: 'expired',
    updated_at: new Date().toISOString()
  })
  .eq('id', connectionId);
```

#### Delete Connection
```typescript
const { error } = await supabase
  .from('user_oauth_connections')
  .delete()
  .eq('id', connectionId);
```

---

### agent_integration_permissions

#### Create Permission
```typescript
const { data, error } = await supabase
  .from('agent_integration_permissions')
  .insert({
    agent_id: agentId,
    connection_id: connectionId,
    permissions: {
      // Provider-specific permissions
    }
  })
  .select()
  .single();
```

#### Get Agent Permissions
```typescript
const { data, error } = await supabase
  .from('agent_integration_permissions')
  .select(`
    *,
    connection:user_oauth_connections(
      *,
      provider:oauth_providers(*)
    )
  `)
  .eq('agent_id', agentId);
```

#### Update Permissions
```typescript
const { error } = await supabase
  .from('agent_integration_permissions')
  .update({ 
    permissions: newPermissions,
    updated_at: new Date().toISOString()
  })
  .eq('id', permissionId);
```

#### Delete Permission
```typescript
const { error } = await supabase
  .from('agent_integration_permissions')
  .delete()
  .eq('id', permissionId);
```

---

### oauth_providers

#### Get All Providers
```typescript
const { data, error } = await supabase
  .from('oauth_providers')
  .select('*')
  .order('display_name');
```

#### Get Provider by Name
```typescript
const { data, error } = await supabase
  .from('oauth_providers')
  .select('*')
  .eq('name', 'gmail')
  .single();
```

## Vault RPCs

### vault_encrypt

Encrypts and stores a secret in Vault.

```typescript
const { data, error } = await supabase.rpc('vault_encrypt', {
  secret: 'sensitive-data',
  key_id: crypto.randomUUID() // Optional
});

// Returns
{
  vault_id: 'uuid-of-vault-entry'
}
```

### vault_decrypt

Decrypts a secret from Vault.

```typescript
const { data, error } = await supabase.rpc('vault_decrypt', {
  vault_id: 'uuid-of-vault-entry'
});

// Returns
{
  decrypted_secret: 'sensitive-data'
}
```

## React Hooks API

### useConnections

```typescript
const {
  connections,    // Connection[]
  loading,        // boolean
  error,          // string | null
  revoke,         // (id: string) => Promise<void>
  remove,         // (id: string) => Promise<void>
  refetch         // () => Promise<void>
} = useConnections();
```

### useAgentPermissions

```typescript
const {
  permissions,      // AgentPermission[]
  loading,          // boolean
  addPermission,    // (connectionId: string, perms: any) => Promise<AgentPermission>
  updatePermission, // (id: string, perms: any) => Promise<void>
  removePermission, // (id: string) => Promise<void>
  refetch           // () => Promise<void>
} = useAgentPermissions(agentId);
```

### useWebSearch

```typescript
const {
  search,   // (query: string, connectionId: string, options?: any) => Promise<SearchResult[]>
  results,  // SearchResult[]
  loading   // boolean
} = useWebSearch();
```

## Type Definitions

### Connection

```typescript
interface Connection {
  id: string;
  user_id: string;
  provider_id: string;
  provider: Provider;
  credential_type: 'oauth' | 'api_key';
  connection_status: 'connected' | 'expired' | 'revoked';
  vault_access_token_id?: string;
  vault_refresh_token_id?: string;
  token_expires_at?: string;
  last_token_refresh?: string;
  created_at: string;
  updated_at: string;
}
```

### Provider

```typescript
interface Provider {
  id: string;
  name: string;
  display_name: string;
  provider_type: 'oauth' | 'api_key';
  auth_url?: string;
  token_url?: string;
  scope?: string;
  icon_url?: string;
  created_at: string;
}
```

### AgentPermission

```typescript
interface AgentPermission {
  id: string;
  agent_id: string;
  connection_id: string;
  connection?: Connection;
  permissions: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

### SearchResult

```typescript
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  domain: string;
  date?: string;
  thumbnail?: string;
}
```

### GmailMessage

```typescript
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  headers: {
    From: string;
    To: string;
    Subject: string;
    Date: string;
    [key: string]: string;
  };
  body?: {
    text?: string;
    html?: string;
  };
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}
```

## Error Codes

### Standard HTTP Status Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| 200 | Success | Operation completed successfully |
| 400 | Bad Request | Invalid parameters, expired token |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### Custom Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `invalid_grant` | OAuth token expired | Reconnect account |
| `insufficient_scope` | Missing OAuth permissions | Update OAuth scopes |
| `vault_error` | Vault operation failed | Check Vault configuration |
| `permission_denied` | Agent lacks permission | Update agent permissions |
| `provider_unavailable` | External API down | Retry later |

## Rate Limits

### Edge Functions

| Function | Limit | Window |
|----------|-------|--------|
| oauth-refresh | 10 requests | per minute per user |
| gmail-api | 100 requests | per minute per user |
| web-search-api | 50 requests | per minute per user |

### External APIs

| Provider | Free Tier | Paid Tier |
|----------|-----------|-----------|
| Gmail API | 250 quota units/second | 25,000/second |
| Serper API | 100/month | 2,500+/month |
| SerpAPI | 100/month | 5,000+/month |
| Brave Search | 2,000/month | 10,000+/month |

## Pagination

### Database Queries

```typescript
// Paginated query
const { data, error, count } = await supabase
  .from('user_oauth_connections')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1)
  .order('created_at', { ascending: false });
```

### Gmail API

```typescript
// Get next page
const response = await gmail.users.messages.list({
  userId: 'me',
  pageToken: nextPageToken,
  maxResults: 10
});
```

## Webhooks

### Connection Status Change

```json
{
  "type": "connection.status_changed",
  "data": {
    "connection_id": "uuid",
    "old_status": "connected",
    "new_status": "expired",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Permission Update

```json
{
  "type": "permission.updated",
  "data": {
    "permission_id": "uuid",
    "agent_id": "uuid",
    "connection_id": "uuid",
    "changes": {
      "before": { "max_results": 10 },
      "after": { "max_results": 20 }
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Authenticate
const { data: { user } } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Get connections
const { data: connections } = await supabase
  .from('user_oauth_connections')
  .select('*')
  .eq('user_id', user.id);

// Refresh token
const { data, error } = await supabase.functions.invoke('oauth-refresh', {
  body: { connectionId: connections[0].id }
});
```

### Python

```python
from supabase import create_client

supabase = create_client(
    'https://your-project.supabase.co',
    'your-anon-key'
)

# Authenticate
user = supabase.auth.sign_in_with_password({
    'email': 'user@example.com',
    'password': 'password'
})

# Get connections
connections = supabase.table('user_oauth_connections') \
    .select('*') \
    .eq('user_id', user.user.id) \
    .execute()

# Refresh token
result = supabase.functions.invoke(
    'oauth-refresh',
    invoke_options={'body': {'connectionId': connections.data[0]['id']}}
)
```

### cURL

```bash
# Get connections
curl -X GET \
  'https://your-project.supabase.co/rest/v1/user_oauth_connections?user_id=eq.USER_ID' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

# Refresh token
curl -X POST \
  'https://your-project.supabase.co/functions/v1/oauth-refresh' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"connectionId": "CONNECTION_ID"}'
```

## Migration Endpoints

### Migrate Legacy Credentials

```typescript
// One-time migration script
async function migrateLegacyCredentials() {
  // Get legacy credentials
  const { data: legacy } = await supabase
    .from('user_oauth_connections')
    .select('*')
    .not('encrypted_access_token', 'is', null);
  
  for (const cred of legacy) {
    // Encrypt in Vault
    const { data: vault } = await supabase.rpc('vault_encrypt', {
      secret: cred.encrypted_access_token
    });
    
    // Update to use Vault
    await supabase
      .from('user_oauth_connections')
      .update({
        vault_access_token_id: vault.vault_id,
        encrypted_access_token: null
      })
      .eq('id', cred.id);
  }
}
```

## Health Check Endpoints

### Function Health

```bash
# Check function status
curl -X GET \
  'https://your-project.supabase.co/functions/v1/health' \
  -H 'apikey: YOUR_ANON_KEY'
```

### Database Health

```typescript
// Check database connectivity
const { error } = await supabase
  .from('oauth_providers')
  .select('count')
  .single();

if (error) {
  console.error('Database unhealthy:', error);
}
```

# GetZep Integration Notes

This project integrates with Zep (v3) for a centralized temporal knowledge graph. Ensure alignment with Zep docs:

- Graph Overview: https://help.getzep.com/graph-overview
- Walkthrough (agent memory and graph): https://help.getzep.com/walkthrough
- Adding Memory: https://help.getzep.com/adding-memory
- Retrieving Memory: https://help.getzep.com/retrieving-memory
- v2 → v3 Migration: https://help.getzep.com/zep-v2-to-v3-migration

## Credentials & Settings
- API Key: stored in Supabase Vault via `user_oauth_connections` and referenced by `account_graphs.connection_id`.
- Account/Project: some deployments require a project or account context. We persist optional fields in `account_graphs.settings`:

{
  "project_id": "<zep project id>",
  "account_id": "<zep account id>",
  "migrated_from_datastore_id": "<uuid>"
}

## Client Construction (planned)

import { ZepClient } from '@getzep/zep-cloud';
const client = new ZepClient({ apiKey, projectId /* optional */ });

Then use `client.graph.add`/batch add/read/search per Zep docs.

## Execution Flow in Agentopia
- User saves API key in Integrations → creates `account_graphs` → optional project/account saved in `settings`.
- Chat pipeline enqueues extractions to `graph_ingestion_queue`.
- `graph-ingestion` function processes queue and upserts to Zep + local mirror tables (planned), or directly to Zep first.
- Enrichment queries graph neighborhood and fuses with vector search context.

## TODOs
- Implement real HTTP calls to Zep in `GetZepService` (auth header `Authorization: Bearer <key>`; include `projectId` if required).
- Add ingestion status polling endpoints and error handling.