# Credential Management System

## Overview

The Agentopia credential management system provides a unified, secure way to manage OAuth tokens and API keys for external integrations. All credentials are stored securely in Supabase Vault and accessed through a centralized data flow.

## Architecture

### Database Schema

The credential system is built on the following core tables:

#### `user_oauth_connections`
Primary table for all user credentials (OAuth and API keys):

```sql
- id: UUID (primary key)
- user_id: UUID (references auth.users)
- provider_id: UUID (references oauth_providers)
- credential_type: 'oauth' | 'api_key'
- connection_status: 'connected' | 'expired' | 'revoked'
- vault_access_token_id: UUID (Vault reference for access token/API key)
- vault_refresh_token_id: UUID (Vault reference for refresh token, OAuth only)
- token_expires_at: timestamp (OAuth only)
- last_token_refresh: timestamp
- created_at: timestamp
- updated_at: timestamp
```

#### `oauth_providers`
Provider configuration:

```sql
- id: UUID (primary key)
- name: text (unique) - e.g., 'gmail', 'serper_api', 'serpapi', 'brave_search'
- display_name: text - User-friendly name
- provider_type: 'oauth' | 'api_key'
- auth_url: text (OAuth providers only)
- token_url: text (OAuth providers only)
- scope: text (OAuth providers only)
- created_at: timestamp
```

#### `agent_oauth_permissions`
Agent-specific permissions for credentials:

```sql
- id: UUID (primary key)
- agent_id: UUID (references agents)
- connection_id: UUID (references user_oauth_connections)
- permissions: jsonb - Provider-specific permissions
- created_at: timestamp
- updated_at: timestamp
```

### Vault Storage

All sensitive credentials are stored in Supabase Vault:

1. **API Keys**: Stored as `vault_access_token_id`
2. **OAuth Access Tokens**: Stored as `vault_access_token_id`
3. **OAuth Refresh Tokens**: Stored as `vault_refresh_token_id`

Legacy support exists for `encrypted_access_token` fields for backward compatibility.

## Frontend Architecture

### Core Hook: `useConnections`

The `useConnections` hook (located at `src/hooks/useConnections.ts`) is the single source of truth for all credential operations:

```typescript
const {
  connections,    // Array of user connections
  loading,        // Loading state
  error,          // Error state
  revoke,         // Function to revoke a connection
  remove,         // Function to remove a connection
  refetch         // Function to refresh data
} = useConnections();
```

### Service Layer: `connections.ts`

The service layer (`src/services/integrations/connections.ts`) provides the underlying API:

```typescript
// Fetch all user connections
getUserConnections(userId: string): Promise<Connection[]>

// Revoke a connection (soft delete - sets status to 'revoked')
revokeConnection(connectionId: string): Promise<void>

// Remove a connection (hard delete)
removeConnection(connectionId: string): Promise<void>
```

## Credential Lifecycle

### 1. Connection Setup

**Entry Point**: Integrations Page (`src/pages/IntegrationsPage.tsx`)

1. User clicks "Connect" on an integration
2. `IntegrationSetupModal` opens
3. For OAuth: Redirects to provider auth flow
4. For API Key: User enters key directly
5. Credential stored in Vault
6. Connection record created in `user_oauth_connections`

### 2. Credential Management

**Management Page**: Credentials Page (`src/pages/CredentialsPage.tsx`)

Features:
- View all active connections
- Refresh OAuth tokens
- Revoke connections (immediate UI removal)
- Status indicators (connected, expired, needs reconnection)
- User-friendly error messages

### 3. Agent Assignment

**Assignment UI**: Agent Edit Page (`src/components/agent-edit/AgentIntegrationsManager.tsx`)

1. Agent creator selects from available credentials
2. Sets provider-specific permissions
3. Creates record in `agent_oauth_permissions`
4. Agent can now use the credential for tool execution

### 4. Token Refresh (OAuth)

**Refresh Function**: `supabase/functions/oauth-refresh`

Automatic refresh flow:
1. Edge function detects expired token
2. Retrieves refresh token from Vault
3. Exchanges with provider for new tokens
4. Updates Vault with new tokens
5. Updates `token_expires_at` and `last_token_refresh`

Error handling:
- `invalid_grant` errors update status to 'expired'
- User-friendly messages guide reconnection
- Frontend displays prominent warnings

### 5. Revocation/Removal

**Revocation Flow**:
1. User clicks "Revoke" on Credentials page
2. `useConnections.revoke()` called
3. Optimistic UI update (immediate removal)
4. Backend sets `connection_status = 'revoked'`
5. Associated agent permissions cascade delete

## Provider-Specific Implementation

### Gmail (OAuth)

- **Provider Name**: `gmail`
- **Credential Type**: `oauth`
- **Required Scopes**: `https://www.googleapis.com/auth/gmail.readonly`
- **Token Expiry**: 1 hour (access), 7 days inactive (refresh for unverified apps)
- **Edge Function**: `gmail-api`

### Web Search Providers (API Key)

#### Serper API
- **Provider Name**: `serper_api`
- **Credential Type**: `api_key`
- **Edge Function**: `web-search-api`

#### SerpAPI
- **Provider Name**: `serpapi`
- **Credential Type**: `api_key`
- **Edge Function**: `web-search-api`

#### Brave Search
- **Provider Name**: `brave_search`
- **Credential Type**: `api_key`
- **Edge Function**: `web-search-api`

## UI/UX Guidelines

### Status Display

1. **Connected**: Green badge, full functionality
2. **Expired**: Amber badge with "Reconnect Needed"
3. **Revoked**: Not displayed (removed from UI)

### Error Messages

Always provide user-friendly messages:
- ❌ "invalid_grant error from Google OAuth"
- ✅ "Your Gmail connection has expired. Please disconnect and reconnect your account."

### Visual Hierarchy

- Compact credential cards (not oversized)
- Clear action buttons (Refresh, Disconnect)
- Prominent warnings for expired connections
- Immediate UI updates on actions

## Best Practices

1. **Always use `useConnections` hook** for credential data
2. **Store new secrets in Vault**, never in plain text
3. **Handle token expiry gracefully** with clear user guidance
4. **Maintain consistency** across all credential touchpoints
5. **Optimize for user experience** with immediate UI updates
6. **Log security events** for audit trails

## Migration Notes

For systems migrating from older credential storage:

1. Check for `encrypted_access_token` (legacy)
2. Migrate to `vault_access_token_id` when updating
3. Maintain backward compatibility during transition
4. Clean up legacy data after verification
