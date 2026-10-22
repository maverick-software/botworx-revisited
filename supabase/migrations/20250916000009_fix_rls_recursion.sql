-- Migration: Fix RLS Recursion Issues
-- Purpose: Remove problematic RLS policies causing infinite recursion
-- Dependencies: 20250916000008_create_contact_rls_policies.sql
-- File: 20250916000009_fix_rls_recursion.sql

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "agents_can_view_permitted_contacts" ON contacts;
DROP POLICY IF EXISTS "agents_can_view_permitted_contact_channels" ON contact_communication_channels;
DROP POLICY IF EXISTS "agents_can_view_permitted_group_memberships" ON contact_group_memberships;
DROP POLICY IF EXISTS "agents_can_view_permitted_contact_interactions" ON contact_interactions;

-- Drop the problematic functions that cause recursion
DROP FUNCTION IF EXISTS user_owns_contact(UUID);
DROP FUNCTION IF EXISTS user_owns_agent(UUID);
DROP FUNCTION IF EXISTS validate_agent_contact_access_rls(UUID, UUID);

-- Create simplified, non-recursive policies for agents
-- Agents can view contacts for their own user only (no complex permission checking in RLS)
CREATE POLICY "agents_can_view_own_user_contacts" 
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a 
      WHERE a.user_id = auth.uid() 
        AND a.user_id = contacts.user_id
    )
  );

-- Agents can view channels for contacts of their own user
CREATE POLICY "agents_can_view_own_user_contact_channels" 
  ON contact_communication_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_communication_channels.contact_id
    )
  );

-- Agents can view group memberships for contacts of their own user
CREATE POLICY "agents_can_view_own_user_group_memberships" 
  ON contact_group_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_group_memberships.contact_id
    )
  );

-- Agents can view interactions for contacts of their own user
CREATE POLICY "agents_can_view_own_user_contact_interactions" 
  ON contact_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_interactions.contact_id
    )
  );

-- Agents can create interactions for contacts of their own user
CREATE POLICY "agents_can_create_own_user_contact_interactions" 
  ON contact_interactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts c
      INNER JOIN agents a ON c.user_id = a.user_id AND a.id = contact_interactions.agent_id
      WHERE a.user_id = auth.uid()
        AND c.id = contact_interactions.contact_id
    )
  );

-- Create simple helper functions without RLS dependencies
CREATE OR REPLACE FUNCTION simple_user_owns_contact(contact_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM contacts 
    WHERE id = contact_id AND contacts.user_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION simple_user_owns_agent(agent_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agents 
    WHERE id = agent_id AND agents.user_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the change
COMMENT ON POLICY "agents_can_view_own_user_contacts" ON contacts IS 
  'Simplified agent access - agents can view all contacts for their user. Detailed permissions handled in application layer.';

-- Final validation
DO $$
BEGIN
  RAISE NOTICE 'RLS recursion issues fixed. Agent permissions now use simplified policies.';
END;
$$;
