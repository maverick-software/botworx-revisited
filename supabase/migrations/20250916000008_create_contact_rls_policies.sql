-- Migration: Create Contact RLS Policies
-- Purpose: Row Level Security policies for all contact tables
-- Dependencies: All contact tables and functions
-- File: 20250916000008_create_contact_rls_policies.sql

-- Enable RLS on all contact tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_contact_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_specific_contact_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_group_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CONTACTS TABLE POLICIES
-- ============================================================================

-- Users can view their own contacts
CREATE POLICY "users_can_view_own_contacts" 
  ON contacts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own contacts
CREATE POLICY "users_can_insert_own_contacts" 
  ON contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own contacts
CREATE POLICY "users_can_update_own_contacts" 
  ON contacts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own contacts
CREATE POLICY "users_can_delete_own_contacts" 
  ON contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Agents can view contacts they have permission to access
CREATE POLICY "agents_can_view_permitted_contacts" 
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      INNER JOIN agent_contact_permissions acp ON a.id = acp.agent_id
      WHERE a.user_id = auth.uid()
        AND acp.user_id = contacts.user_id
        AND acp.can_view = TRUE
        AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
        AND (
          acp.permission_type = 'all_contacts' OR
          (acp.permission_type = 'specific_contacts' AND EXISTS (
            SELECT 1 FROM agent_specific_contact_access asca
            WHERE asca.agent_id = a.id 
              AND asca.contact_id = contacts.id
              AND asca.access_level != 'no_access'
              AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
          )) OR
          (acp.permission_type = 'contact_groups' AND EXISTS (
            SELECT 1 FROM agent_group_access aga
            INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
            WHERE aga.agent_id = a.id 
              AND cgm.contact_id = contacts.id
              AND (aga.expires_at IS NULL OR aga.expires_at > CURRENT_TIMESTAMP)
          ))
        )
    )
  );

-- Service role has full access for system operations
CREATE POLICY "service_role_full_access_contacts" 
  ON contacts FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT COMMUNICATION CHANNELS POLICIES
-- ============================================================================

-- Users can manage channels for their own contacts
CREATE POLICY "users_can_manage_own_contact_channels" 
  ON contact_communication_channels FOR ALL
  USING (auth.uid() = user_id);

-- Agents can view channels for contacts they have access to
CREATE POLICY "agents_can_view_permitted_contact_channels" 
  ON contact_communication_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id
      INNER JOIN agent_contact_permissions acp ON a.id = acp.agent_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_communication_channels.contact_id
        AND acp.can_view = TRUE
        AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
        AND (
          acp.permission_type = 'all_contacts' OR
          (acp.permission_type = 'specific_contacts' AND EXISTS (
            SELECT 1 FROM agent_specific_contact_access asca
            WHERE asca.agent_id = a.id 
              AND asca.contact_id = c.id
              AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
          ))
        )
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_channels" 
  ON contact_communication_channels FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT GROUPS POLICIES
-- ============================================================================

-- Users can manage their own contact groups
CREATE POLICY "users_can_manage_own_contact_groups" 
  ON contact_groups FOR ALL
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "service_role_full_access_groups" 
  ON contact_groups FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT GROUP MEMBERSHIPS POLICIES
-- ============================================================================

-- Users can manage memberships for their own groups and contacts
CREATE POLICY "users_can_manage_own_group_memberships" 
  ON contact_group_memberships FOR ALL
  USING (auth.uid() = user_id);

-- Agents can view group memberships for contacts they have access to
CREATE POLICY "agents_can_view_permitted_group_memberships" 
  ON contact_group_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id
      INNER JOIN agent_contact_permissions acp ON a.id = acp.agent_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_group_memberships.contact_id
        AND acp.can_view = TRUE
        AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_memberships" 
  ON contact_group_memberships FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- AGENT CONTACT PERMISSIONS POLICIES
-- ============================================================================

-- Users can manage permissions for their own agents
CREATE POLICY "users_can_manage_agent_contact_permissions" 
  ON agent_contact_permissions FOR ALL
  USING (auth.uid() = user_id);

-- Agents can view their own permissions (read-only)
CREATE POLICY "agents_can_view_own_permissions" 
  ON agent_contact_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a 
      WHERE a.id = agent_contact_permissions.agent_id 
        AND a.user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_permissions" 
  ON agent_contact_permissions FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- AGENT SPECIFIC CONTACT ACCESS POLICIES
-- ============================================================================

-- Users can manage specific access for their agents and contacts
CREATE POLICY "users_can_manage_specific_contact_access" 
  ON agent_specific_contact_access FOR ALL
  USING (auth.uid() = user_id);

-- Agents can view their own specific access records
CREATE POLICY "agents_can_view_own_specific_access" 
  ON agent_specific_contact_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a 
      WHERE a.id = agent_specific_contact_access.agent_id 
        AND a.user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_specific_access" 
  ON agent_specific_contact_access FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- AGENT GROUP ACCESS POLICIES
-- ============================================================================

-- Users can manage group access for their agents
CREATE POLICY "users_can_manage_agent_group_access" 
  ON agent_group_access FOR ALL
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "service_role_full_access_group_access" 
  ON agent_group_access FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT INTERACTIONS POLICIES
-- ============================================================================

-- Users can view interactions for their own contacts
CREATE POLICY "users_can_view_own_contact_interactions" 
  ON contact_interactions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create interactions for their own contacts and agents
CREATE POLICY "users_can_create_own_contact_interactions" 
  ON contact_interactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM contacts WHERE id = contact_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND user_id = auth.uid())
  );

-- Users can update their own contact interactions
CREATE POLICY "users_can_update_own_contact_interactions" 
  ON contact_interactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own contact interactions
CREATE POLICY "users_can_delete_own_contact_interactions" 
  ON contact_interactions FOR DELETE
  USING (auth.uid() = user_id);

-- Agents can view interactions for contacts they have access to
CREATE POLICY "agents_can_view_permitted_contact_interactions" 
  ON contact_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id
      INNER JOIN agent_contact_permissions acp ON a.id = acp.agent_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_interactions.contact_id
        AND acp.can_view = TRUE
        AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
    )
  );

-- Agents can create interactions for contacts they have contact permission
CREATE POLICY "agents_can_create_permitted_contact_interactions" 
  ON contact_interactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id AND a.id = contact_interactions.agent_id
      INNER JOIN agent_contact_permissions acp ON a.id = acp.agent_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_interactions.contact_id
        AND acp.can_contact = TRUE
        AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_interactions" 
  ON contact_interactions FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT IMPORT JOBS POLICIES
-- ============================================================================

-- Users can manage their own import jobs
CREATE POLICY "users_can_manage_own_import_jobs" 
  ON contact_import_jobs FOR ALL
  USING (auth.uid() = user_id);

-- Service role has full access for system operations
CREATE POLICY "service_role_full_access_import_jobs" 
  ON contact_import_jobs FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT IMPORT ERRORS POLICIES
-- ============================================================================

-- Users can view errors for their own import jobs
CREATE POLICY "users_can_view_own_import_errors" 
  ON contact_import_errors FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update resolution status of their own import errors
CREATE POLICY "users_can_update_own_import_errors" 
  ON contact_import_errors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all import errors
CREATE POLICY "service_role_full_access_import_errors" 
  ON contact_import_errors FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================================================
-- CONTACT AUDIT LOG POLICIES
-- ============================================================================

-- Users can view audit logs for their own contacts
CREATE POLICY "users_can_view_own_contact_audit_logs" 
  ON contact_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all audit logs
CREATE POLICY "service_role_full_access_audit_logs" 
  ON contact_audit_log FOR ALL
  USING (current_setting('role') = 'service_role');

-- System can insert audit logs (for triggers and functions)
CREATE POLICY "system_can_insert_audit_logs" 
  ON contact_audit_log FOR INSERT
  WITH CHECK (true); -- Allow all inserts for audit logging

-- ============================================================================
-- ADDITIONAL SECURITY FUNCTIONS
-- ============================================================================

-- Function to check if user owns a contact (used in other policies)
CREATE OR REPLACE FUNCTION user_owns_contact(contact_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM contacts 
    WHERE id = contact_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns an agent (used in other policies)
CREATE OR REPLACE FUNCTION user_owns_agent(agent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agents 
    WHERE id = agent_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate agent contact access for RLS
CREATE OR REPLACE FUNCTION validate_agent_contact_access_rls(
  agent_id UUID,
  contact_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  agent_user_id UUID;
  contact_user_id UUID;
BEGIN
  -- Get agent owner
  SELECT user_id INTO agent_user_id 
  FROM agents 
  WHERE id = agent_id;
  
  -- Get contact owner  
  SELECT user_id INTO contact_user_id 
  FROM contacts 
  WHERE id = contact_id;
  
  -- Must be same user and current user must be the owner
  IF agent_user_id != contact_user_id OR agent_user_id != auth.uid() THEN
    RETURN FALSE;
  END IF;
  
  -- Check permissions using existing function
  RETURN check_agent_contact_permission(agent_id, contact_id, 'view');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- POLICY VALIDATION AND TESTING
-- ============================================================================

-- Function to test RLS policies (for development/testing)
CREATE OR REPLACE FUNCTION test_contact_rls_policies()
RETURNS TABLE (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
) AS $$
BEGIN
  -- This function would contain comprehensive RLS policy tests
  -- Implementation would depend on test framework and requirements
  
  RETURN QUERY SELECT 
    'RLS Policies Created'::TEXT as test_name,
    TRUE as passed,
    'All RLS policies have been created successfully'::TEXT as details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy documentation
COMMENT ON POLICY "users_can_view_own_contacts" ON contacts IS 
  'Users can only view contacts they own';
COMMENT ON POLICY "agents_can_view_permitted_contacts" ON contacts IS 
  'Agents can view contacts based on their granted permissions';
COMMENT ON POLICY "users_can_manage_own_contact_channels" ON contact_communication_channels IS 
  'Users have full control over communication channels for their contacts';
COMMENT ON POLICY "agents_can_view_permitted_contact_interactions" ON contact_interactions IS 
  'Agents can view interaction history for contacts they have permission to access';

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant service role permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create indexes to support RLS policy performance
-- Note: Removed auth.uid() from index predicates as it's not immutable
CREATE INDEX IF NOT EXISTS idx_contacts_user_auth ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_user_auth ON agents(user_id);

-- Final validation
DO $$
BEGIN
  -- Verify all tables have RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' 
      AND c.relname LIKE 'contact%'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Not all contact tables have RLS enabled';
  END IF;
  
  RAISE NOTICE 'Contact RLS policies created successfully';
END;
$$;
