-- Migration: Fix agent_contact_permissions updated_at reference
-- Purpose: Remove reference to non-existent updated_at column in check_agent_contact_permission function
-- Dependencies: check_agent_contact_permission function
-- File: 20251011080300_fix_agent_contact_permissions_updated_at.sql

-- Recreate the function without the updated_at reference
CREATE OR REPLACE FUNCTION check_agent_contact_permission(
  p_agent_id UUID,
  p_contact_id UUID,
  p_permission_type TEXT DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
  agent_user_id UUID;
  contact_user_id UUID;
  has_permission BOOLEAN := FALSE;
  permission_record RECORD;
BEGIN
  -- Get agent owner
  SELECT user_id INTO agent_user_id FROM agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RAISE NOTICE 'Agent % not found', p_agent_id;
    RETURN FALSE;
  END IF;
  
  -- Check if specific contact is provided and validate ownership
  IF p_contact_id IS NOT NULL THEN
    SELECT user_id INTO contact_user_id FROM contacts WHERE id = p_contact_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'Contact % not found', p_contact_id;
      RETURN FALSE;
    END IF;
    
    -- Agents can only access contacts owned by the same user
    IF agent_user_id != contact_user_id THEN
      RAISE NOTICE 'Agent user % does not match contact user %', agent_user_id, contact_user_id;
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Get agent permissions
  SELECT * INTO permission_record
  FROM agent_contact_permissions
  WHERE agent_id = p_agent_id 
    AND user_id = agent_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No contact permissions found for agent % and user %', p_agent_id, agent_user_id;
    -- If no permissions exist, grant default access for the agent's own user
    -- This ensures agents can access their user's contacts by default
    INSERT INTO agent_contact_permissions (
      agent_id,
      user_id,
      permission_type,
      can_view,
      can_contact,
      can_edit,
      can_delete,
      can_export,
      granted_by_user_id,
      granted_at
    ) VALUES (
      p_agent_id,
      agent_user_id,
      'all_contacts',
      true,
      true,
      false,
      false,
      false,
      agent_user_id,
      NOW()
    ) ON CONFLICT (agent_id) DO UPDATE SET
      permission_type = EXCLUDED.permission_type,
      can_view = EXCLUDED.can_view,
      can_contact = EXCLUDED.can_contact
    RETURNING * INTO permission_record;
    
    IF NOT FOUND THEN
      RAISE NOTICE 'Failed to create default permissions';
      RETURN FALSE;
    END IF;
  END IF;
  
  RAISE NOTICE 'Found permission record: type=%, can_view=%, can_contact=%', 
    permission_record.permission_type, permission_record.can_view, permission_record.can_contact;
  
  -- Check permission type
  CASE permission_record.permission_type
    WHEN 'no_access' THEN
      has_permission := FALSE;
    WHEN 'all_contacts' THEN
      has_permission := TRUE;
    WHEN 'specific_contacts' THEN
      -- For general search (p_contact_id IS NULL), allow if agent has any specific contact access
      -- For specific contact, check specific access table
      IF p_contact_id IS NULL THEN
        has_permission := EXISTS (
          SELECT 1 FROM agent_specific_contact_access
          WHERE agent_id = p_agent_id 
            AND (expires_at IS NULL OR expires_at > NOW())
            AND access_level != 'no_access'
        );
      ELSE
        has_permission := EXISTS (
          SELECT 1 FROM agent_specific_contact_access
          WHERE agent_id = p_agent_id 
            AND contact_id = p_contact_id
            AND (expires_at IS NULL OR expires_at > NOW())
            AND access_level != 'no_access'
        );
      END IF;
    WHEN 'contact_groups' THEN
      -- For general search (p_contact_id IS NULL), allow if agent has any group access
      -- For specific contact, check if contact is in any group the agent has access to
      IF p_contact_id IS NULL THEN
        has_permission := EXISTS (
          SELECT 1 FROM agent_group_access
          WHERE agent_id = p_agent_id
            AND (expires_at IS NULL OR expires_at > NOW())
        );
      ELSE
        has_permission := EXISTS (
          SELECT 1
          FROM agent_group_access aga
          INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
          WHERE aga.agent_id = p_agent_id
            AND cgm.contact_id = p_contact_id
            AND (aga.expires_at IS NULL OR aga.expires_at > NOW())
        );
      END IF;
    WHEN 'filtered_access' THEN
      -- Apply filters from access_filters JSONB
      has_permission := TRUE; -- Simplified for now
    ELSE
      -- Default to allowing access for unknown permission types
      has_permission := TRUE;
  END CASE;
  
  -- Check specific permission type if we have base permission
  IF has_permission THEN
    CASE p_permission_type
      WHEN 'view' THEN
        has_permission := permission_record.can_view;
      WHEN 'contact' THEN
        has_permission := permission_record.can_contact;
      WHEN 'edit' THEN
        has_permission := permission_record.can_edit;
      WHEN 'delete' THEN
        has_permission := permission_record.can_delete;
      WHEN 'export' THEN
        has_permission := permission_record.can_export;
      ELSE
        has_permission := permission_record.can_view; -- Default to view permission
    END CASE;
  END IF;
  
  RAISE NOTICE 'Final permission result: %', has_permission;
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION check_agent_contact_permission IS 'Checks if an agent has permission to access contacts, automatically granting default access if none exists';

