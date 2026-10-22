-- Add Microsoft Outlook integration capabilities
-- Purpose: Enable Microsoft Outlook tools to be discoverable by agents
-- Date: September 10, 2025

-- Add integration capabilities for Microsoft Outlook
-- Following the same pattern as Gmail and SMTP integrations

-- Email capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_send_email', 
  'Send Email', 
  1, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_read_emails', 
  'Read Emails', 
  2, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_search_emails', 
  'Search Emails', 
  3, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Calendar capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_create_event', 
  'Create Calendar Event', 
  4, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_get_events', 
  'Get Calendar Events', 
  5, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Contact capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_get_contacts', 
  'Get Contacts', 
  6, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
SELECT 
  id, 
  'outlook_search_contacts', 
  'Search Contacts', 
  7, 
  NOW(), 
  NOW()
FROM service_providers 
WHERE name = 'microsoft-outlook'
ON CONFLICT (integration_id, capability_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Create permission validation function for Microsoft Outlook
-- Following the same pattern as Gmail validation
CREATE OR REPLACE FUNCTION validate_agent_outlook_permissions(
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
  -- Get Microsoft Outlook service provider ID
  SELECT id INTO v_provider_id
  FROM service_providers 
  WHERE name = 'microsoft-outlook';
  
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Microsoft Outlook service provider not found';
  END IF;
  
  -- Check if user has an active Outlook connection
  SELECT EXISTS(
    SELECT 1 
    FROM user_integration_credentials uic
    WHERE uic.user_id = p_user_id 
      AND uic.oauth_provider_id = v_provider_id
      AND uic.connection_status = 'active'
  ) INTO v_connection_exists;
  
  IF NOT v_connection_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Check if agent has permissions for this integration
  SELECT EXISTS(
    SELECT 1
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    WHERE aip.agent_id = p_agent_id
      AND uic.user_id = p_user_id
      AND uic.oauth_provider_id = v_provider_id
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

-- Add comment for documentation
COMMENT ON FUNCTION validate_agent_outlook_permissions(UUID, UUID, TEXT[]) IS 
'Validates that an agent has permission to access Microsoft Outlook integration for a specific user with required scopes';

-- Verify the migration by checking if capabilities were added
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM integration_capabilities ic
  JOIN service_providers sp ON ic.integration_id = sp.id
  WHERE sp.name = 'microsoft-outlook';
  
  IF v_count < 7 THEN
    RAISE EXCEPTION 'Migration failed: Expected 7 Outlook capabilities, found %', v_count;
  END IF;
  
  RAISE NOTICE 'Successfully added % Microsoft Outlook integration capabilities', v_count;
END;
$$;
