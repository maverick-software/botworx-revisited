-- Fix RLS policies for agents table to allow proper access
-- Purpose: Ensure authenticated users can access their agents and service role has full access

BEGIN;

-- Enable RLS on agents table (in case it was disabled)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "agents_user_access" ON agents;
DROP POLICY IF EXISTS "agents_service_access" ON agents;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON agents;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON agents;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON agents;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON agents;

-- Create comprehensive policy for authenticated users
-- This policy allows users to SELECT, INSERT, UPDATE, DELETE their own agents
CREATE POLICY "agents_user_access" ON agents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policy for service role to have full access
-- This is needed for Edge Functions and admin operations
CREATE POLICY "agents_service_access" ON agents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure proper permissions are granted
GRANT SELECT, INSERT, UPDATE, DELETE ON agents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agents TO service_role;

-- No sequence needed for agents table (uses gen_random_uuid())

-- Add a comment to track this fix
COMMENT ON TABLE agents IS 'Agents table with proper RLS policies - allows users to manage their own agents';

COMMIT;
