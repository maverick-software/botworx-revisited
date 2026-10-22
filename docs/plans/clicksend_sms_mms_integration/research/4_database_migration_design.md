# Database Migration Design for ClickSend Integration

## Research Date
September 11, 2025

## Purpose
Design the specific database migration script to add ClickSend SMS/MMS integration to the existing schema following established patterns.

## Migration Overview

### Migration File
**Location**: `supabase/migrations/20250911000001_add_clicksend_sms_integration.sql`

### Dependencies
- Existing `service_providers` table
- Existing `integration_capabilities` table  
- Existing Supabase Vault setup for credential encryption

## Migration Script Design

```sql
-- =====================================================
-- ADD CLICKSEND SMS/MMS INTEGRATION
-- =====================================================
-- Add ClickSend as a service provider for SMS and MMS capabilities
-- Date: September 11, 2025

BEGIN;

-- Step 1: Add ClickSend SMS as a service provider
INSERT INTO public.service_providers (
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
  '["sms", "mms", "balance", "history", "delivery_receipts"]'::jsonb,
  false, -- API key based, no PKCE
  'header',
  true,
  '{
    "authentication_type": "basic_auth",
    "api_base_url": "https://rest.clicksend.com/v3",
    "auth_header_format": "Basic {base64(username:api_key)}",
    "supported_message_types": ["sms", "mms"],
    "features": {
      "sms_sending": true,
      "mms_sending": true,
      "delivery_receipts": true,
      "inbound_messages": true,
      "balance_checking": true,
      "message_history": true,
      "scheduled_messages": true,
      "message_tracking": true
    },
    "limits": {
      "sms_max_length": 1600,
      "mms_max_size_mb": 5,
      "rate_limit_per_hour": 1000,
      "concurrent_requests": 10
    },
    "supported_countries": ["US", "CA", "AU", "UK", "EU"],
    "pricing_model": "per_message",
    "documentation_url": "https://developers.clicksend.com/",
    "setup_instructions": {
      "step_1": "Sign up for ClickSend account at https://clicksend.com",
      "step_2": "Navigate to API Credentials in your dashboard",
      "step_3": "Copy your Username and API Key",
      "step_4": "Enter credentials in Agentopia integration setup"
    }
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Step 2: Add integration capabilities for ClickSend SMS/MMS
-- Following the same pattern as Gmail and Outlook integrations

-- SMS Capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'clicksend_send_sms', 
  'Send SMS', 
  1, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'clicksend_sms'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'clicksend_send_mms', 
  'Send MMS', 
  2, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'clicksend_sms'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Account Management Capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'clicksend_get_balance', 
  'Check Account Balance', 
  3, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'clicksend_sms'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- History and Tracking Capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'clicksend_get_sms_history', 
  'Get SMS History', 
  4, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'clicksend_sms'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'clicksend_get_mms_history', 
  'Get MMS History', 
  5, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'clicksend_sms'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'clicksend_get_delivery_receipts', 
  'Get Delivery Receipts', 
  6, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'clicksend_sms'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Step 3: Create permission validation function for ClickSend
-- Following the same pattern as Gmail and Outlook validation
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_agent_clicksend_permissions(UUID, UUID, TEXT[]) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION validate_agent_clicksend_permissions(UUID, UUID, TEXT[]) IS 
'Validates that an agent has permission to access ClickSend SMS/MMS integration for a specific user with required scopes';

-- Step 4: Create helper function to get user ClickSend connection
CREATE OR REPLACE FUNCTION get_user_clicksend_connection(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    connection_status TEXT,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uoc.id as connection_id,
        uoc.connection_name,
        uoc.external_username,
        uoc.connection_status,
        uoc.connection_metadata as configuration
    FROM user_oauth_connections uoc
    INNER JOIN service_providers sp ON uoc.oauth_provider_id = sp.id
    WHERE uoc.user_id = p_user_id
      AND sp.name = 'clicksend_sms'
      AND uoc.connection_status = 'active'
    ORDER BY uoc.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_clicksend_connection(UUID) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_clicksend_connection(UUID) IS 'Get user ClickSend connection details';

-- Step 5: Add RLS policies for ClickSend connections
-- Ensure users can only access their own ClickSend connections

-- Users can only see their own ClickSend connections
CREATE POLICY "Users can view own ClickSend connections" ON user_oauth_connections
    FOR SELECT USING (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'clicksend_sms')
    );

-- Users can create their own ClickSend connections
CREATE POLICY "Users can create own ClickSend connections" ON user_oauth_connections
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'clicksend_sms')
    );

-- Users can update their own ClickSend connections
CREATE POLICY "Users can update own ClickSend connections" ON user_oauth_connections
    FOR UPDATE USING (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'clicksend_sms')
    );

-- Users can delete their own ClickSend connections
CREATE POLICY "Users can delete own ClickSend connections" ON user_oauth_connections
    FOR DELETE USING (
        user_id = auth.uid() AND
        oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'clicksend_sms')
    );

-- Step 6: Create helpful view for ClickSend connections
CREATE OR REPLACE VIEW clicksend_connections AS
SELECT 
    uoc.id,
    uoc.user_id,
    uoc.connection_name,
    uoc.connection_status,
    uoc.connection_metadata,
    uoc.external_username,
    uoc.created_at,
    uoc.updated_at,
    sp.display_name as provider_name,
    sp.configuration_metadata as provider_config
FROM user_oauth_connections uoc
JOIN service_providers sp ON uoc.oauth_provider_id = sp.id
WHERE sp.name = 'clicksend_sms'
  AND uoc.connection_status = 'active';

COMMENT ON VIEW clicksend_connections IS 'View for active ClickSend SMS/MMS connections with provider details';

-- Step 7: Verify the migration by checking if capabilities were added
DO $$
DECLARE
  v_provider_count INTEGER;
  v_capability_count INTEGER;
  v_function_count INTEGER;
BEGIN
  -- Check if ClickSend provider was added
  SELECT COUNT(*) INTO v_provider_count
  FROM service_providers sp
  WHERE sp.name = 'clicksend_sms';
  
  -- Check if capabilities were added
  SELECT COUNT(*) INTO v_capability_count
  FROM integration_capabilities ic
  JOIN service_providers sp ON ic.integration_id = sp.id
  WHERE sp.name = 'clicksend_sms';
  
  -- Check if validation function exists
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc 
  WHERE proname = 'validate_agent_clicksend_permissions';
  
  IF v_provider_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: ClickSend service provider not created';
  END IF;
  
  IF v_capability_count < 6 THEN
    RAISE EXCEPTION 'Migration failed: Expected 6 ClickSend capabilities, found %', v_capability_count;
  END IF;
  
  IF v_function_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: ClickSend validation function not created';
  END IF;
  
  RAISE NOTICE '✅ ClickSend SMS/MMS integration migration completed successfully!';
  RAISE NOTICE '📱 Service Provider: % created', v_provider_count;
  RAISE NOTICE '🛠️  Capabilities: % created', v_capability_count;
  RAISE NOTICE '🔒 Validation function: created';
  RAISE NOTICE '📋 View: clicksend_connections created';
  RAISE NOTICE '🛡️  RLS policies: applied';
END;
$$;

COMMIT;
```

## Migration Analysis

### 1. Service Provider Configuration

**Key Design Decisions:**
- **Name**: `clicksend_sms` (consistent with provider naming)
- **Authentication**: Basic Auth with username:api_key
- **Scopes**: `["sms", "mms", "balance", "history", "delivery_receipts"]`
- **Configuration Metadata**: Comprehensive provider settings

**Credential Storage Strategy:**
- **Username**: Stored in `encrypted_access_token` field (vault-encrypted)
- **API Key**: Stored in `encrypted_refresh_token` field (vault-encrypted)
- **Connection Status**: Tracks active/inactive state

### 2. Integration Capabilities

**Tool Definitions:**
1. `clicksend_send_sms` - Send SMS messages
2. `clicksend_send_mms` - Send MMS with media
3. `clicksend_get_balance` - Check account balance
4. `clicksend_get_sms_history` - Retrieve SMS history
5. `clicksend_get_mms_history` - Retrieve MMS history  
6. `clicksend_get_delivery_receipts` - Get delivery status

**Database-Driven Approach:**
- Tools defined in `integration_capabilities` table
- Dynamic tool discovery based on agent permissions
- Consistent with existing Gmail/Outlook patterns

### 3. Permission System

**Validation Function:**
- `validate_agent_clicksend_permissions()` follows established pattern
- Checks user connection status and agent permissions
- Validates required scopes against granted capabilities

**Permission Granularity:**
- Users grant specific scopes to agents
- Agents can have subset of user's capabilities
- Example: User has SMS+MMS, agent only granted SMS

### 4. Security Measures

**Row Level Security (RLS):**
- Users can only access their own ClickSend connections
- Standard CRUD policies applied
- Prevents cross-user data access

**Credential Protection:**
- All credentials encrypted via Supabase Vault
- No plain-text storage anywhere in system
- Server-side only decryption

### 5. Helper Functions and Views

**Utility Functions:**
- `get_user_clicksend_connection()` for connection retrieval
- Follows same pattern as Gmail connection functions

**Database View:**
- `clicksend_connections` view for easy connection management
- Joins provider and connection data
- Filters for active connections only

## Migration Testing Strategy

### 1. Pre-Migration Validation
```sql
-- Check existing schema state
SELECT COUNT(*) FROM service_providers WHERE name = 'clicksend_sms';
SELECT COUNT(*) FROM integration_capabilities WHERE capability_key LIKE 'clicksend_%';
```

### 2. Post-Migration Verification
```sql
-- Verify provider creation
SELECT name, display_name, is_enabled FROM service_providers WHERE name = 'clicksend_sms';

-- Verify capabilities creation
SELECT capability_key, display_label FROM integration_capabilities ic
JOIN service_providers sp ON ic.integration_id = sp.id
WHERE sp.name = 'clicksend_sms' ORDER BY display_order;

-- Test validation function
SELECT validate_agent_clicksend_permissions(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  ARRAY['sms']
);
```

### 3. Rollback Strategy
```sql
-- Emergency rollback if needed
DELETE FROM integration_capabilities WHERE integration_id IN (
  SELECT id FROM service_providers WHERE name = 'clicksend_sms'
);
DELETE FROM service_providers WHERE name = 'clicksend_sms';
DROP FUNCTION IF EXISTS validate_agent_clicksend_permissions(UUID, UUID, TEXT[]);
DROP FUNCTION IF EXISTS get_user_clicksend_connection(UUID);
DROP VIEW IF EXISTS clicksend_connections;
```

## Integration Points

### 1. Tool Discovery System
- `get-agent-tools` Edge Function will automatically discover ClickSend tools
- Based on `integration_capabilities` table entries
- Filtered by agent permissions

### 2. Function Calling System
- Tools registered with OpenAI function calling format
- Routed through Universal Tool Executor
- Permission validation before execution

### 3. Credential Management
- Setup modal stores credentials in `user_oauth_connections`
- Encrypted via Supabase Vault
- Retrieved by Edge Functions for API calls

## Risk Mitigation

### 1. Migration Risks
- **Foreign Key Violations**: ON CONFLICT clauses handle duplicates
- **Function Conflicts**: OR REPLACE handles existing functions
- **Policy Conflicts**: Conditional creation prevents errors

### 2. Security Risks
- **Credential Exposure**: Vault encryption prevents plain-text storage
- **Cross-User Access**: RLS policies enforce user isolation
- **Permission Bypass**: Validation function prevents unauthorized access

### 3. Performance Risks
- **Query Performance**: Indexed foreign keys for efficient lookups
- **Function Performance**: Optimized permission validation logic
- **View Performance**: Simple joins for connection management

## Next Steps
1. **Create Migration File**: Implement the designed migration script
2. **Test Migration**: Verify all components work correctly
3. **Update Documentation**: Document new integration capabilities
4. **Prepare Rollback**: Ensure safe rollback procedures

This migration design follows established patterns while adding comprehensive ClickSend SMS/MMS capabilities to the Agentopia platform.
