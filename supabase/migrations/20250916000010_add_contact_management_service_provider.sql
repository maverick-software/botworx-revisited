-- Migration: Add Contact Management Service Provider
-- Purpose: Register contact management as an internal service provider
-- Dependencies: service_providers table
-- File: 20250916000010_add_contact_management_service_provider.sql

-- Add Contact Management as a service provider
INSERT INTO service_providers (
  id,
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
  configuration_metadata,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'contact_management',
  'Contact Management',
  'internal://contact-management/authorize',
  'internal://contact-management/token',
  null,
  null,
  '["search_contacts", "get_contact_details", "view_contact_channels", "contact_permissions"]'::jsonb,
  false,
  'header',
  true,
  '{
    "authentication_type": "internal",
    "provider_type": "internal",
    "icon_name": "UserCheck",
    "integration_description": "Internal contact management system for agent access to user contacts",
    "documentation_url": "https://docs.agentopia.com/contact-management",
    "default_scopes": ["search_contacts", "get_contact_details"],
    "scope_descriptions": {
      "search_contacts": "Search and list contacts based on query parameters",
      "get_contact_details": "Retrieve detailed information about a specific contact",
      "view_contact_channels": "Access contact communication channels (email, phone, etc.)",
      "contact_permissions": "View contact access permissions and restrictions"
    },
    "is_internal": true,
    "agent_classification": "tool"
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  scopes_supported = EXCLUDED.scopes_supported,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = NOW();

-- Function to automatically create contact management credentials for users
CREATE OR REPLACE FUNCTION create_contact_management_credential_for_user(user_id UUID)
RETURNS UUID AS $$
DECLARE
  credential_id UUID;
BEGIN
  -- Check if credential already exists
  SELECT id INTO credential_id
  FROM user_integration_credentials
  WHERE user_integration_credentials.user_id = create_contact_management_credential_for_user.user_id
  AND oauth_provider_id = '00000000-0000-0000-0000-000000000003'::uuid;
  
  -- If not found, create it
  IF credential_id IS NULL THEN
    INSERT INTO user_integration_credentials (
      user_id,
      oauth_provider_id,
      connection_name,
      external_username,
      external_user_id,
      credential_type,
      connection_status,
      scopes_granted,
      vault_access_token_id,
      created_at,
      updated_at
    ) VALUES (
      create_contact_management_credential_for_user.user_id,
      '00000000-0000-0000-0000-000000000003'::uuid,
      'Contact Management System',
      'internal',
      'contact_system_' || create_contact_management_credential_for_user.user_id,
      'api_key'::connection_credential_type_enum,
      'active',
      '["search_contacts", "get_contact_details"]'::jsonb,
      'internal_contact_token',
      NOW(),
      NOW()
    ) 
    RETURNING id INTO credential_id;
    
    RAISE NOTICE 'Created contact management credential % for user %', credential_id, create_contact_management_credential_for_user.user_id;
  END IF;
  
  RETURN credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create contact management credentials for all existing users
DO $$
DECLARE
  user_record RECORD;
  credential_id UUID;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    BEGIN
      credential_id := create_contact_management_credential_for_user(user_record.id);
      RAISE NOTICE 'Processed user %: credential %', user_record.id, credential_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create contact credential for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Trigger to automatically create contact management credentials for new users
CREATE OR REPLACE FUNCTION auto_create_contact_management_credential()
RETURNS TRIGGER AS $$
DECLARE
  credential_id UUID;
BEGIN
  -- Create contact management credential for the new user
  credential_id := create_contact_management_credential_for_user(NEW.id);
  
  RAISE NOTICE 'Auto-created contact management credential % for new user %', credential_id, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users (if it doesn't exist)
DROP TRIGGER IF EXISTS auto_create_contact_management_credential_trigger ON auth.users;
CREATE TRIGGER auto_create_contact_management_credential_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_contact_management_credential();

-- Function to grant contact management access to agents
CREATE OR REPLACE FUNCTION grant_contact_management_access_to_agent(
  p_agent_id UUID,
  p_user_id UUID,
  p_scopes TEXT[] DEFAULT ARRAY['search_contacts', 'get_contact_details']
)
RETURNS UUID AS $$
DECLARE
  credential_id UUID;
  permission_id UUID;
BEGIN
  -- Get or create the contact management credential for the user
  credential_id := create_contact_management_credential_for_user(p_user_id);
  
  -- Check if permission already exists
  SELECT id INTO permission_id
  FROM agent_integration_permissions
  WHERE agent_id = p_agent_id
  AND user_oauth_connection_id = credential_id;
  
  -- If permission doesn't exist, create it
  IF permission_id IS NULL THEN
    INSERT INTO agent_integration_permissions (
      agent_id,
      user_oauth_connection_id,
      allowed_scopes,
      permission_level,
      granted_by_user_id,
      is_active,
      granted_at,
      created_at,
      updated_at
    ) VALUES (
      p_agent_id,
      credential_id,
      array_to_json(p_scopes)::jsonb,
      'full_access',
      p_user_id,
      true,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO permission_id;
    
    RAISE NOTICE 'Granted contact management access % to agent % for user %', permission_id, p_agent_id, p_user_id;
  ELSE
    -- Update existing permission with new scopes
    UPDATE agent_integration_permissions
    SET allowed_scopes = array_to_json(p_scopes)::jsonb,
        updated_at = NOW()
    WHERE id = permission_id;
    
    RAISE NOTICE 'Updated contact management access % for agent % for user %', permission_id, p_agent_id, p_user_id;
  END IF;
  
  RETURN permission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant contact management access to all existing agents
DO $$
DECLARE
  agent_record RECORD;
  permission_id UUID;
BEGIN
  FOR agent_record IN 
    SELECT a.id as agent_id, a.user_id 
    FROM agents a
  LOOP
    BEGIN
      permission_id := grant_contact_management_access_to_agent(
        agent_record.agent_id, 
        agent_record.user_id,
        ARRAY['search_contacts', 'get_contact_details']
      );
      RAISE NOTICE 'Processed agent %: permission %', agent_record.agent_id, permission_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to grant contact access to agent %: %', agent_record.agent_id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Create trigger to automatically grant contact management access to new agents
CREATE OR REPLACE FUNCTION auto_grant_contact_management_access()
RETURNS TRIGGER AS $$
DECLARE
  permission_id UUID;
BEGIN
  -- Grant contact management access to the new agent
  permission_id := grant_contact_management_access_to_agent(
    NEW.id,
    NEW.user_id,
    ARRAY['search_contacts', 'get_contact_details']
  );
  
  RAISE NOTICE 'Auto-granted contact management access % to new agent %', permission_id, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new agents (if it doesn't exist)
DROP TRIGGER IF EXISTS auto_grant_contact_management_access_trigger ON agents;
CREATE TRIGGER auto_grant_contact_management_access_trigger
  AFTER INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION auto_grant_contact_management_access();

-- Add helpful comments
COMMENT ON FUNCTION create_contact_management_credential_for_user(UUID) IS 
'Creates internal contact management credentials for users';

COMMENT ON FUNCTION grant_contact_management_access_to_agent(UUID, UUID, TEXT[]) IS 
'Grants contact management tool access to agents through the standard integration permission system';

-- Note: Cannot add comment to auth.users trigger due to permissions

COMMENT ON TRIGGER auto_grant_contact_management_access_trigger ON agents IS 
'Automatically grants contact management access to new agents';

DO $$
BEGIN
  RAISE NOTICE 'Contact Management service provider and integration system created successfully';
END $$;
