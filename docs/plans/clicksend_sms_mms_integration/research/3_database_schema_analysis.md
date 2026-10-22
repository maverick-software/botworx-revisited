# Database Schema Analysis for ClickSend Integration

## Research Date
September 11, 2025

## Purpose
Analyze the current database schema to understand the exact table structures needed for ClickSend SMS/MMS integration.

## Current Database Schema Analysis

### 1. Service Providers Table
```sql
CREATE TABLE IF NOT EXISTS "public"."service_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "authorization_endpoint" "text" NOT NULL,
    "token_endpoint" "text" NOT NULL,
    "revoke_endpoint" "text",
    "discovery_endpoint" "text",
    "scopes_supported" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pkce_required" boolean DEFAULT true NOT NULL,
    "client_credentials_location" "text" DEFAULT 'header'::"text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "configuration_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
```

**Key Observations:**
- This table stores OAuth and API key providers
- `configuration_metadata` JSONB field for provider-specific settings
- API key providers use placeholder OAuth endpoints (not actually used)
- `scopes_supported` defines available permissions/capabilities

### 2. Integration Capabilities Table
```sql
-- From migration analysis, structure appears to be:
CREATE TABLE IF NOT EXISTS "public"."integration_capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL, -- References service_providers.id
    "capability_key" "text" NOT NULL,
    "display_label" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
```

**Key Observations:**
- Links to `service_providers` via `integration_id`
- `capability_key` defines specific tool capabilities (e.g., 'outlook_send_email')
- Database-driven tool definitions (not hardcoded)

### 3. User OAuth Connections Table
```sql
CREATE TABLE IF NOT EXISTS "public"."user_oauth_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- Additional columns inferred from function usage:
    "user_id" "uuid" NOT NULL,
    "oauth_provider_id" "uuid" NOT NULL, -- References service_providers.id
    "encrypted_access_token" "text",
    "encrypted_refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "granted_scopes" "jsonb",
    "connection_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
```

**Key Observations:**
- Stores encrypted OAuth tokens and API keys
- Links to `service_providers` via `oauth_provider_id`
- `granted_scopes` JSONB field for OAuth scopes or API capabilities

### 4. Agent Integration Permissions Table
```sql
-- From function usage analysis:
CREATE TABLE IF NOT EXISTS "public"."agent_integration_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_oauth_connection_id" "uuid" NOT NULL, -- References user_oauth_connections.id
    "allowed_scopes" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
```

**Key Observations:**
- Controls which agents can use which integrations
- `allowed_scopes` JSONB defines specific capabilities granted to agent
- Links agent to user's OAuth connection

## Current Integration Pattern Analysis

### 1. Gmail Integration Example
From migration `20250910_fix_gmail_oauth_service_providers.sql`:

**Service Provider Entry:**
```sql
-- Gmail provider in service_providers table
name: 'gmail'
display_name: 'Gmail'
scopes_supported: ['https://www.googleapis.com/auth/gmail.send', ...]
```

**Integration Capabilities:**
```sql
-- Capabilities in integration_capabilities table
capability_key: 'gmail_send_email'
capability_key: 'gmail_read_emails'
capability_key: 'gmail_search_emails'
```

### 2. Microsoft Outlook Integration Example
From migration `20250910120000_add_outlook_integration_capabilities.sql`:

**Integration Capabilities:**
```sql
capability_key: 'outlook_send_email'
capability_key: 'outlook_read_emails'
capability_key: 'outlook_search_emails'
capability_key: 'outlook_create_event'
capability_key: 'outlook_get_events'
capability_key: 'outlook_get_contacts'
capability_key: 'outlook_search_contacts'
```

### 3. API Key Integration Pattern
From Mistral AI integration (`20250109000001_add_mistral_ocr_integration.sql`):

**Service Provider Configuration:**
```sql
name: 'mistral_ai'
display_name: 'Mistral AI'
pkce_required: false -- API key based, not OAuth
configuration_metadata: {
  "authentication_type": "api_key",
  "header_format": "Bearer {api_key}",
  "api_base_url": "https://api.mistral.ai/v1"
}
```

## ClickSend Integration Requirements

### 1. Service Provider Entry
```sql
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  discovery_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'clicksend_sms',
  'ClickSend SMS/MMS',
  'https://rest.clicksend.com/v3/oauth/authorize', -- Placeholder - ClickSend uses API keys
  'https://rest.clicksend.com/v3/oauth/token',     -- Placeholder - ClickSend uses API keys
  null,
  null,
  '["sms", "mms", "balance", "history"]'::jsonb,
  false, -- API key based, no PKCE
  'header',
  true,
  '{
    "authentication_type": "basic_auth",
    "api_base_url": "https://rest.clicksend.com/v3",
    "auth_header_format": "Basic {base64(username:api_key)}",
    "supported_features": {
      "sms": true,
      "mms": true,
      "voice": false,
      "email": false
    },
    "rate_limits": {
      "requests_per_hour": 1000,
      "concurrent_requests": 10
    },
    "pricing_model": "per_message",
    "delivery_receipts": true,
    "inbound_messages": true
  }'::jsonb
);
```

### 2. Integration Capabilities
```sql
-- SMS capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT id, 'clicksend_send_sms', 'Send SMS', 1 FROM service_providers WHERE name = 'clicksend_sms';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT id, 'clicksend_send_mms', 'Send MMS', 2 FROM service_providers WHERE name = 'clicksend_sms';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT id, 'clicksend_get_balance', 'Check Balance', 3 FROM service_providers WHERE name = 'clicksend_sms';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT id, 'clicksend_get_sms_history', 'Get SMS History', 4 FROM service_providers WHERE name = 'clicksend_sms';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT id, 'clicksend_get_mms_history', 'Get MMS History', 5 FROM service_providers WHERE name = 'clicksend_sms';
```

### 3. User Connection Storage
```sql
-- User stores ClickSend credentials in user_oauth_connections
{
  user_id: 'user-uuid',
  oauth_provider_id: 'clicksend-provider-uuid',
  encrypted_access_token: 'vault-encrypted-username',
  encrypted_refresh_token: 'vault-encrypted-api-key', -- Using refresh_token field for API key
  granted_scopes: '["sms", "mms", "balance", "history"]'::jsonb,
  connection_status: 'active'
}
```

### 4. Agent Permission Control
```sql
-- Agent granted SMS/MMS permissions
{
  agent_id: 'agent-uuid',
  user_oauth_connection_id: 'connection-uuid',
  allowed_scopes: '["sms", "mms"]'::jsonb, -- Subset of granted_scopes
  is_active: true
}
```

## Permission Validation Pattern

### Validation Function Template
```sql
CREATE OR REPLACE FUNCTION validate_agent_clicksend_permissions(
  p_agent_id UUID,
  p_user_id UUID,
  p_required_scopes TEXT[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connection_exists BOOLEAN := FALSE;
  v_has_permissions BOOLEAN := FALSE;
  v_provider_id UUID;
BEGIN
  -- Get ClickSend service provider ID
  SELECT id INTO v_provider_id
  FROM service_providers 
  WHERE name = 'clicksend_sms';
  
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'ClickSend service provider not found';
  END IF;
  
  -- Check if user has an active ClickSend connection
  SELECT EXISTS(
    SELECT 1 
    FROM user_oauth_connections uoc
    WHERE uoc.user_id = p_user_id 
      AND uoc.oauth_provider_id = v_provider_id
      AND uoc.connection_status = 'active'
  ) INTO v_connection_exists;
  
  IF NOT v_connection_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Check if agent has permissions for this integration
  SELECT EXISTS(
    SELECT 1
    FROM agent_integration_permissions aip
    JOIN user_oauth_connections uoc ON uoc.id = aip.user_oauth_connection_id
    WHERE aip.agent_id = p_agent_id
      AND uoc.user_id = p_user_id
      AND uoc.oauth_provider_id = v_provider_id
      AND aip.is_active = true
      AND (
        -- If no specific scopes required, just check if permission exists
        p_required_scopes IS NULL 
        OR array_length(p_required_scopes, 1) = 0
        -- If scopes required, check if all required scopes are in allowed_scopes
        OR (
          aip.allowed_scopes IS NOT NULL 
          AND p_required_scopes <@ (
            SELECT ARRAY(
              SELECT jsonb_array_elements_text(aip.allowed_scopes)
            )
          )
        )
      )
  ) INTO v_has_permissions;
  
  RETURN v_has_permissions;
END;
$$;
```

## Key Differences from Initial Analysis

### 1. Table Name Corrections
- **Correct**: `service_providers` (not `oauth_providers`)
- **Correct**: `user_oauth_connections` (not `user_integration_credentials`)
- **Correct**: `integration_capabilities` (references `service_providers.id`)

### 2. Schema Architecture
- **Unified Provider System**: Both OAuth and API key providers use `service_providers`
- **Database-Driven Tools**: Tool definitions stored in `integration_capabilities`
- **Flexible Credential Storage**: OAuth tokens and API keys both use `user_oauth_connections`
- **Granular Permissions**: Agent access controlled via `agent_integration_permissions`

### 3. Integration Pattern
- **Service Provider**: Define provider configuration and capabilities
- **User Connection**: Store encrypted credentials (username/API key for ClickSend)
- **Agent Permissions**: Grant specific capabilities to agents
- **Tool Discovery**: Query capabilities based on agent permissions

## Implementation Implications

### 1. Migration Requirements
- Add ClickSend to `service_providers` table
- Add SMS/MMS capabilities to `integration_capabilities` table
- No new tables needed - use existing infrastructure

### 2. Credential Handling
- Store ClickSend username in `encrypted_access_token` field
- Store ClickSend API key in `encrypted_refresh_token` field
- Both encrypted using Supabase Vault

### 3. Permission System
- Use existing `agent_integration_permissions` table
- `allowed_scopes` contains granted SMS/MMS capabilities
- Validation follows established pattern

### 4. Tool Discovery
- Query `integration_capabilities` for available tools
- Filter by agent permissions in `agent_integration_permissions`
- Return tools based on active user connections

## Next Steps
1. **Create Migration Script**: Add ClickSend to database schema
2. **Implement Validation Function**: Create ClickSend permission validation
3. **Build Tool Discovery**: Integrate with existing tool discovery system
4. **Test Schema Changes**: Verify migration works correctly

This analysis confirms that ClickSend integration can leverage the existing database architecture without requiring new tables, following the established patterns used by Gmail, Outlook, and other integrations.
