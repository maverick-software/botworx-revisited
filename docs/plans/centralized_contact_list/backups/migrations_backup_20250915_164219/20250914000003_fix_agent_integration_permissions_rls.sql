-- Migration: Fix agent_integration_permissions RLS policies
-- Date: 2025-09-14
-- Purpose: Add proper RLS policies for agent_integration_permissions to fix 406 errors

-- Enable RLS on agent_integration_permissions if not already enabled
ALTER TABLE agent_integration_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view agent permissions for their agents" ON agent_integration_permissions;
DROP POLICY IF EXISTS "Users can manage agent permissions for their agents" ON agent_integration_permissions;
DROP POLICY IF EXISTS "Service role full access to agent permissions" ON agent_integration_permissions;

-- Policy 1: Users can view agent integration permissions for agents they own
CREATE POLICY "Users can view agent permissions for their agents" ON agent_integration_permissions
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Policy 2: Users can insert/update/delete agent integration permissions for agents they own
CREATE POLICY "Users can manage agent permissions for their agents" ON agent_integration_permissions
    FOR ALL USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Policy 3: Service role has full access (for system operations)
CREATE POLICY "Service role full access to agent permissions" ON agent_integration_permissions
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_integration_permissions TO authenticated;
GRANT ALL ON agent_integration_permissions TO service_role;

-- Add helpful comments
COMMENT ON POLICY "Users can view agent permissions for their agents" ON agent_integration_permissions IS 
'Allows users to view integration permissions for agents they own';

COMMENT ON POLICY "Users can manage agent permissions for their agents" ON agent_integration_permissions IS 
'Allows users to manage integration permissions for agents they own';

COMMENT ON POLICY "Service role full access to agent permissions" ON agent_integration_permissions IS 
'Allows service role full access for system operations';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Agent integration permissions RLS policies created successfully';
    RAISE NOTICE '🔒 Users can now access permissions for their own agents';
    RAISE NOTICE '🛡️ Service role has full access for system operations';
END $$;
