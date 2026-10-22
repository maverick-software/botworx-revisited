# Gmail Integration Implementation Plan

**Date:** January 7, 2025  
**Project:** Gmail Integration for Agentopia  
**Protocol:** Plan & Execute  
**Dependencies:** Research Phase Complete  

## Executive Summary

This plan implements a comprehensive Gmail integration system for Agentopia, enabling agents to securely access and manage Gmail accounts on behalf of users. The implementation follows OAuth 2.1 + PKCE standards, integrates with Supabase Vault for credential security, and provides a user-friendly interface similar to RelevanceAI and n8n.

## Project Scope

### Core Features
1. **Gmail OAuth 2.1 + PKCE Authentication**
2. **Secure Credential Management with Supabase Vault**
3. **Agent-Specific Gmail Account Assignment**
4. **Comprehensive Gmail Tools (Send, Read, Search, Manage)**
5. **Integration UI Components**
6. **Audit Trail and Compliance**

### Success Criteria
- ✅ Users can connect Gmail accounts with one-click OAuth
- ✅ Agents can perform Gmail operations on behalf of users
- ✅ All credentials stored securely in Supabase Vault
- ✅ Complete audit trail for compliance
- ✅ Responsive UI following existing design patterns

## Technical Architecture

### 1. Database Schema Extensions

**New Tables:**
```sql
-- Gmail OAuth provider (extends existing oauth_providers)
INSERT INTO oauth_providers (name, display_name, authorization_url, token_url, scopes)
VALUES ('gmail', 'Gmail', 'https://accounts.google.com/o/oauth2/v2/auth', 
        'https://oauth2.googleapis.com/token', 
        '["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.send"]');

-- Gmail-specific configurations
CREATE TABLE gmail_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_oauth_connection_id UUID REFERENCES user_oauth_connections(id),
    email_signature TEXT,
    max_emails_per_request INTEGER DEFAULT 50,
    default_send_as TEXT,
    auto_archive_sent BOOLEAN DEFAULT FALSE,
    security_settings JSONB DEFAULT '{"require_confirmation_for_send": true}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Gmail tools catalog
INSERT INTO integrations (category_id, name, description, status, is_popular, 
                         configuration_schema, required_oauth_provider_id)
VALUES ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
        'Gmail', 'Send, receive, and manage Gmail emails', 'available', true,
        '{"tools": ["send_email", "read_emails", "search_emails", "manage_labels"]}',
        (SELECT id FROM oauth_providers WHERE name = 'gmail'));
```

### 2. Supabase Edge Functions

**Gmail OAuth Function (`/gmail-oauth`):**
```typescript
// Handle Gmail OAuth flow with PKCE
export async function handleGmailOAuth(request: Request) {
  const { code, state } = await request.json();
  
  // Exchange authorization code for tokens
  const tokens = await exchangeCodeForTokens(code);
  
  // Store encrypted tokens in Supabase Vault
  const { data: encryptedTokens } = await supabase.rpc('vault_encrypt', {
    secret: JSON.stringify(tokens),
    key_id: 'gmail_oauth_tokens'
  });
  
  // Create user OAuth connection
  const connection = await createUserOAuthConnection(user_id, tokens, encryptedTokens);
  
  return new Response(JSON.stringify({ success: true, connection_id: connection.id }));
}
```

**Gmail API Function (`/gmail-api`):**
```typescript
// Execute Gmail operations for agents
export async function executeGmailOperation(request: Request) {
  const { agent_id, user_id, action, params } = await request.json();
  
  // Validate agent permissions
  const permissions = await validateAgentPermissions(agent_id, user_id, 'gmail');
  
  // Get and refresh tokens
  const tokens = await getDecryptedTokens(user_id, 'gmail');
  
  // Execute Gmail action
  const result = await gmailAPI[action](tokens.access_token, params);
  
  // Log operation for audit
  await logGmailOperation(agent_id, user_id, action, params, result);
  
  return new Response(JSON.stringify(result));
}
```

### 3. Frontend Components

**Gmail Integration Setup (`/src/components/integrations/GmailSetup.tsx`):**
```typescript
export function GmailSetup() {
  const [isConnecting, setIsConnecting] = useState(false);
  
  const handleConnect = async () => {
    setIsConnecting(true);
    
    // Initialize Google Identity Services
    const codeClient = google.accounts.oauth2.initCodeClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      ux_mode: 'popup',
      callback: handleOAuthCallback
    });
    
    codeClient.requestCode();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Gmail</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect Gmail Account'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Agent Gmail Configuration (`/src/components/agents/AgentGmailConfig.tsx`):**
```typescript
export function AgentGmailConfig({ agentId }: { agentId: string }) {
  const { data: gmailConnections } = useUserGmailConnections();
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  
  const assignGmailToAgent = async () => {
    await supabase.from('agent_oauth_permissions').insert({
      agent_id: agentId,
      user_oauth_connection_id: selectedConnection,
      granted_scopes: ['gmail.readonly', 'gmail.send']
    });
  };
  
  return (
    <Select value={selectedConnection} onValueChange={setSelectedConnection}>
      {gmailConnections?.map(connection => (
        <SelectItem key={connection.id} value={connection.id}>
          {connection.external_username}
        </SelectItem>
      ))}
    </Select>
  );
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- ✅ Database schema migration
- ✅ Basic OAuth provider setup
- ✅ Supabase Vault integration
- ✅ Gmail OAuth Edge Function

### Phase 2: Core Integration (Week 2)
- ✅ Gmail API operations Edge Function
- ✅ Token refresh and management
- ✅ Agent permission validation
- ✅ Audit logging system

### Phase 3: Frontend Interface (Week 3)
- ✅ Gmail connection UI components
- ✅ Agent configuration interface
- ✅ Integration management page
- ✅ Status monitoring dashboard

### Phase 4: Gmail Tools (Week 4)
- ✅ Send email tool
- ✅ Read emails tool
- ✅ Search emails tool
- ✅ Manage labels tool
- ✅ Email templates system

### Phase 5: Testing & Security (Week 5)
- ✅ Security validation
- ✅ OAuth compliance verification
- ✅ Performance testing
- ✅ User acceptance testing

## Security Implementation

### 1. OAuth 2.1 + PKCE Flow
```typescript
// PKCE implementation
const generatePKCE = () => {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier));
  return { codeVerifier, codeChallenge };
};
```

### 2. Secure Token Storage
```sql
-- Supabase Vault integration
CREATE OR REPLACE FUNCTION store_gmail_tokens(
  p_user_id UUID,
  p_tokens JSONB
) RETURNS UUID AS $$
DECLARE
  v_vault_id UUID;
BEGIN
  -- Encrypt tokens in Supabase Vault
  SELECT vault_encrypt(p_tokens::TEXT, 'gmail_oauth_tokens') INTO v_vault_id;
  
  -- Store vault reference
  INSERT INTO user_oauth_connections (user_id, oauth_provider_id, vault_access_token_id)
  VALUES (p_user_id, (SELECT id FROM oauth_providers WHERE name = 'gmail'), v_vault_id)
  RETURNING id INTO v_vault_id;
  
  RETURN v_vault_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Agent Permission Validation
```typescript
const validateAgentPermissions = async (agentId: string, userId: string, integration: string) => {
  const { data: permissions } = await supabase
    .from('agent_oauth_permissions')
    .select('granted_scopes')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .eq('integration', integration)
    .single();
    
  if (!permissions) {
    throw new Error('Agent not authorized for Gmail access');
  }
  
  return permissions.granted_scopes;
};
```

## Next Steps

1. **Execute Phase 1**: Database schema and OAuth setup
2. **Security Review**: Validate all security implementations
3. **Testing**: Comprehensive testing of all components
4. **Documentation**: User guides and API documentation
5. **Deployment**: Production deployment with monitoring

## Risk Mitigation

- **Token Expiration**: Automatic refresh token handling
- **Rate Limiting**: Respect Gmail API quotas
- **Error Handling**: Graceful degradation for API failures
- **Security**: Regular security audits and compliance checks
- **User Experience**: Clear error messages and status indicators

This implementation plan provides a complete Gmail integration system that meets enterprise security standards while providing an intuitive user experience. 