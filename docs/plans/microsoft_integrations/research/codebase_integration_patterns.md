# Codebase Integration Patterns Research

**Date:** September 7, 2025  
**Research Objective:** Understand existing integration patterns in Agentopia to design Microsoft integrations

## Current Integration Architecture

### Database Schema Pattern

#### Service Providers Table
```sql
CREATE TABLE service_providers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,                    -- e.g., 'gmail', 'microsoft-teams'
  display_name text NOT NULL,            -- e.g., 'Gmail', 'Microsoft Teams'
  authorization_endpoint text NOT NULL,  -- OAuth authorization URL
  token_endpoint text NOT NULL,          -- OAuth token exchange URL
  revoke_endpoint text,                  -- Token revocation URL
  discovery_endpoint text,               -- OIDC discovery endpoint
  scopes_supported jsonb DEFAULT '[]'::jsonb NOT NULL,
  pkce_required boolean DEFAULT true NOT NULL,
  client_credentials_location text DEFAULT 'header'::text NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  configuration_metadata jsonb,          -- Provider-specific config
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT service_providers_pkey PRIMARY KEY (id),
  CONSTRAINT service_providers_name_key UNIQUE (name)
);
```

#### User Integration Credentials Table
```sql
CREATE TABLE user_integration_credentials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,                 -- References auth.users
  oauth_provider_id uuid NOT NULL,       -- References service_providers
  connection_name text,                  -- User-friendly name
  external_user_id text,                 -- Provider's user ID
  external_username text,                -- Provider's username
  scopes_granted jsonb DEFAULT '[]'::jsonb,
  vault_access_token_id text,            -- Supabase Vault token ID
  vault_refresh_token_id text,           -- Supabase Vault refresh token ID
  token_expires_at timestamptz,
  connection_status text DEFAULT 'active'::text,
  connection_metadata jsonb DEFAULT '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_integration_credentials_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_provider UNIQUE (user_id, oauth_provider_id)
);
```

#### Agent Integration Permissions Table
```sql
CREATE TABLE agent_integration_permissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  agent_id uuid NOT NULL,               -- References agents
  user_integration_credential_id uuid NOT NULL, -- References user_integration_credentials
  granted_by_user_id uuid NOT NULL,     -- References auth.users
  permission_level text DEFAULT 'custom'::text,
  allowed_scopes jsonb DEFAULT '[]'::jsonb,
  granted_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT agent_integration_permissions_pkey PRIMARY KEY (id)
);
```

### Frontend Integration Pattern

#### Directory Structure
```
src/integrations/
├── _shared/
│   ├── types/IntegrationSetup.ts
│   ├── hooks/useIntegrations.ts
│   └── registry/IntegrationSetupRegistry.ts
├── gmail/
│   ├── components/GmailSetupModal.tsx
│   ├── hooks/useGmailIntegration.ts
│   └── services/gmail-tools.ts
├── smtp/
│   ├── components/SMTPSetupModal.tsx
│   └── services/smtp-tools.ts
└── [provider]/
    ├── components/[Provider]SetupModal.tsx
    ├── hooks/use[Provider]Integration.ts
    └── services/[provider]-tools.ts
```

#### Integration Setup Modal Pattern
```typescript
// IntegrationSetupProps interface
export interface IntegrationSetupProps {
  integration: {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    icon_url?: string;
    category?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  user: any;
}

// Modal component structure
export function GmailSetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user
}: IntegrationSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    connection,
    isConnected,
    connect,
    disconnect,
    loading: connectionLoading,
    error: connectionError
  } = useGmailConnection(user?.id);

  // OAuth flow implementation
  const handleConnect = async () => {
    try {
      setLoading(true);
      await connect();
      onSuccess?.({ connected: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect {integration.display_name}</CardTitle>
        <CardDescription>
          Securely connect your {integration.display_name} account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Connection UI */}
      </CardContent>
    </Card>
  );
}
```

#### Integration Registry Pattern
```typescript
// IntegrationSetupRegistry.ts
export const integrationSetupRegistry: IntegrationSetupRegistry = {
  'Gmail': {
    component: GmailSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
    capabilities: [
      { key: 'send_email', label: 'Send and receive emails' },
      { key: 'read_email', label: 'Read and search email messages' },
      { key: 'manage_labels', label: 'Manage email labels and folders' },
      { key: 'oauth_auth', label: 'Secure OAuth authentication' }
    ]
  },
  
  // Microsoft integrations would follow the same pattern
  'Microsoft Teams': {
    component: MicrosoftTeamsSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://graph.microsoft.com/Team.ReadBasic.All',
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Chat.ReadWrite'
    ],
    capabilities: [
      { key: 'send_message', label: 'Send messages to channels and chats' },
      { key: 'read_messages', label: 'Read team and chat messages' },
      { key: 'manage_teams', label: 'Manage team settings' }
    ]
  }
};
```

### Backend Integration Pattern

#### Supabase Edge Functions Structure
```
supabase/functions/
├── [provider]-oauth/          # OAuth flow handling
│   └── index.ts
├── [provider]-api/            # API operations
│   └── index.ts
└── chat/
    └── function_calling/
        └── [provider]-provider.ts
```

#### OAuth Flow Implementation
```typescript
// supabase/functions/gmail-oauth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { action, ...params } = await req.json();
  
  switch (action) {
    case 'initiate':
      return await initiateOAuth(params);
    case 'callback':
      return await handleCallback(params);
    case 'refresh':
      return await refreshToken(params);
    default:
      return new Response('Invalid action', { status: 400 });
  }
});

async function initiateOAuth({ userId, scopes }) {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', Deno.env.get('GMAIL_CLIENT_ID')!);
  authUrl.searchParams.append('redirect_uri', getRedirectUri());
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', scopes.join(' '));
  authUrl.searchParams.append('state', generateSecureState(userId));
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent');
  
  return new Response(JSON.stringify({ authUrl: authUrl.toString() }));
}
```

#### API Operations Implementation
```typescript
// supabase/functions/gmail-api/index.ts
serve(async (req) => {
  const { agent_id, action, parameters } = await req.json();
  
  // Validate permissions
  const hasPermission = await validateAgentPermissions(agent_id, action);
  if (!hasPermission) {
    return new Response('Permission denied', { status: 403 });
  }
  
  // Get access token from vault
  const accessToken = await getAccessToken(agent_id);
  
  // Execute action
  switch (action) {
    case 'send_email':
      return await sendEmail(accessToken, parameters);
    case 'read_emails':
      return await readEmails(accessToken, parameters);
    default:
      return new Response('Invalid action', { status: 400 });
  }
});
```

### MCP Tool Integration Pattern

#### Tool Definition Structure
```typescript
// src/integrations/gmail/services/gmail-tools.ts
export const gmailMCPTools = {
  gmail_send_email: {
    name: 'gmail_send_email',
    description: 'Send an email via Gmail',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
        html: { type: 'string', description: 'HTML email content' },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded' },
              contentType: { type: 'string' }
            }
          }
        }
      },
      required: ['to', 'subject', 'body']
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.send']
  },
  
  gmail_read_emails: {
    name: 'gmail_read_emails',
    description: 'Read emails from Gmail',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query' },
        max_results: { type: 'integer', default: 50 },
        include_body: { type: 'boolean', default: false }
      }
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly']
  }
};
```

#### Tool Registry Integration
```typescript
// src/lib/mcp/tool-registry.ts
export class MCPToolRegistry {
  constructor() {
    // Register tool providers
    this.registerToolProvider('gmail', gmailMCPTools);
    this.registerToolProvider('microsoft-teams', microsoftTeamsMCPTools);
    this.registerToolProvider('microsoft-outlook', microsoftOutlookMCPTools);
    this.registerToolProvider('microsoft-onedrive', microsoftOneDriveMCPTools);
  }

  async getAvailableTools(agentId: string, userId: string): Promise<RegisteredTool[]> {
    const tools: RegisteredTool[] = [];
    
    // Check each provider for available tools
    for (const [providerId, provider] of this.toolProviders) {
      const providerTools = await this.getProviderTools(providerId, agentId, userId);
      tools.push(...providerTools);
    }
    
    return tools;
  }
}
```

### Security Pattern

#### Supabase Vault Integration
```typescript
// Secure token storage
export class VaultService {
  static async storeToken(token: string, description: string): Promise<string> {
    const { data, error } = await supabase.rpc('vault_create_secret', {
      secret: token,
      name: `oauth_token_${Date.now()}`,
      description
    });
    
    if (error) throw error;
    return data.id;
  }
  
  static async retrieveToken(vaultId: string): Promise<string> {
    const { data, error } = await supabase.rpc('vault_decrypt', {
      secret_id: vaultId
    });
    
    if (error) throw error;
    return data.decrypted_secret;
  }
}
```

#### Permission Validation
```typescript
// Permission checking pattern
export async function validateAgentPermissions(
  agentId: string, 
  userId: string, 
  requiredScopes: string[]
): Promise<boolean> {
  const { data: permissions } = await supabase
    .from('agent_integration_permissions')
    .select(`
      allowed_scopes,
      user_integration_credentials!inner(
        scopes_granted,
        connection_status
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_integration_credentials.user_id', userId)
    .eq('is_active', true)
    .eq('user_integration_credentials.connection_status', 'active');
  
  if (!permissions?.length) return false;
  
  const allowedScopes = permissions[0].allowed_scopes || [];
  return requiredScopes.every(scope => allowedScopes.includes(scope));
}
```

## Integration Patterns for Microsoft Services

### Microsoft Graph API Considerations

#### Unified Endpoint Pattern
Unlike Gmail which has its own API, Microsoft services use the unified Graph API:
- **Base URL:** `https://graph.microsoft.com/v1.0/`
- **Authentication:** Same OAuth flow for all services
- **Scopes:** Service-specific scopes (Teams, Mail, Files)

#### Multi-Service Provider Pattern
We can implement Microsoft as either:

1. **Single Provider Approach:**
   ```typescript
   'Microsoft Graph': {
     component: MicrosoftGraphSetupModal,
     credentialType: 'oauth',
     defaultScopes: [
       'https://graph.microsoft.com/Mail.ReadWrite',
       'https://graph.microsoft.com/Team.ReadBasic.All',
       'https://graph.microsoft.com/Files.ReadWrite'
     ]
   }
   ```

2. **Multi-Provider Approach:**
   ```typescript
   'Microsoft Teams': { /* Teams-specific scopes */ },
   'Microsoft Outlook': { /* Mail-specific scopes */ },
   'Microsoft OneDrive': { /* Files-specific scopes */ }
   ```

### Recommended Implementation Strategy

#### 1. Multi-Provider Approach (Recommended)
- Separate setup modals for each service
- Service-specific scopes and capabilities
- Better user experience and permission granularity
- Follows existing Gmail pattern

#### 2. Shared Backend Infrastructure
- Single Microsoft Graph API client
- Shared OAuth flow with service-specific scopes
- Unified token management
- Service-specific tool implementations

#### 3. Tool Naming Convention
Following the existing pattern:
```typescript
// Teams tools
'teams_send_message'
'teams_create_meeting'
'teams_list_channels'

// Outlook tools  
'outlook_send_email'
'outlook_read_emails'
'outlook_create_event'

// OneDrive tools
'onedrive_upload_file'
'onedrive_share_file'
'onedrive_search_files'
```

## Next Steps for Implementation

1. **Database Setup:** Add Microsoft service providers to `service_providers` table
2. **OAuth Implementation:** Create Microsoft-specific OAuth flow
3. **Setup Modals:** Create UI components for each service
4. **Tool Definitions:** Define MCP tools for each service
5. **API Handlers:** Implement Supabase Edge Functions
6. **Registry Integration:** Add to `IntegrationSetupRegistry`
7. **Testing:** Comprehensive testing with Microsoft developer tenant

## Key Differences from Gmail

1. **Unified API:** All services use Graph API vs separate APIs
2. **Tenant-based:** Microsoft uses tenant-specific endpoints
3. **Broader Scopes:** Graph API scopes cover multiple services
4. **Complex Permissions:** More granular permission model
5. **Rate Limits:** Different throttling patterns per service

## Conclusion

The existing Agentopia integration patterns provide a solid foundation for Microsoft integrations. The modular architecture, secure token management, and MCP tool system can be extended to support Microsoft Graph API services while maintaining consistency with existing patterns.
