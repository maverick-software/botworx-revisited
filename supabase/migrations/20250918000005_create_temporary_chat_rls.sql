-- Migration: Create Temporary Chat RLS Policies
-- Description: Row Level Security policies for temporary chat links and sessions
-- Date: 2025-09-18

-- =============================================================================
-- TEMPORARY CHAT LINKS RLS POLICIES
-- =============================================================================

-- Enable RLS on temporary_chat_links table
ALTER TABLE temporary_chat_links ENABLE ROW LEVEL SECURITY;

-- Policy 1: User isolation - users can only access their own links
CREATE POLICY "temp_links_user_isolation" ON temporary_chat_links
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.role() = 'service_role')
  );

-- Policy 2: Agent ownership - users can access links for their agents
CREATE POLICY "temp_links_agent_ownership" ON temporary_chat_links
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )) OR
    (auth.role() = 'service_role')
  );

-- Policy 3: Public read access for link validation (anonymous users)
-- This allows anonymous users to validate link tokens for public access
CREATE POLICY "temp_links_public_validation" ON temporary_chat_links
  FOR SELECT USING (
    auth.role() = 'anon' AND
    is_active = TRUE AND
    expires_at > NOW()
  );

-- Policy 4: Service role full access for system operations
CREATE POLICY "temp_links_service_role_access" ON temporary_chat_links
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- TEMPORARY CHAT SESSIONS RLS POLICIES
-- =============================================================================

-- Enable RLS on temporary_chat_sessions table
ALTER TABLE temporary_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service role has full access for system operations
CREATE POLICY "temp_sessions_service_role" ON temporary_chat_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Policy 2: Users can view sessions for their own links (management interface)
CREATE POLICY "temp_sessions_link_ownership" ON temporary_chat_sessions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    link_id IN (
      SELECT id FROM temporary_chat_links 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 3: Anonymous users cannot directly access session table
-- All session access for anonymous users goes through Edge Functions with service role
CREATE POLICY "temp_sessions_no_anonymous_access" ON temporary_chat_sessions
  FOR ALL USING (
    auth.role() != 'anon'
  );

-- =============================================================================
-- INTEGRATION WITH EXISTING CHAT SYSTEM RLS
-- =============================================================================

-- Create policy for temporary chat integration with conversation_sessions
-- This allows temporary chat sessions to create and access conversation sessions
CREATE POLICY "temp_chat_conversation_sessions" ON conversation_sessions
  FOR ALL USING (
    -- Regular user access
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    -- Service role access (for temporary chat processing)
    (auth.role() = 'service_role') OR
    -- Agent access for temporary chats
    (auth.uid() IS NOT NULL AND agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )) OR
    -- Allow access if this conversation belongs to a temporary chat session
    (conversation_id IN (
      SELECT conversation_id FROM temporary_chat_sessions tcs
      JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
      WHERE tcl.user_id = auth.uid()
    ))
  );

-- Create policy for temporary chat integration with chat_messages_v2
-- This allows temporary chat messages to be stored and retrieved
CREATE POLICY "temp_chat_messages" ON chat_messages_v2
  FOR ALL USING (
    -- Regular authenticated user access
    (auth.uid() IS NOT NULL AND (
      sender_user_id = auth.uid() OR
      conversation_id IN (
        SELECT conversation_id FROM conversation_sessions 
        WHERE user_id = auth.uid()
      )
    )) OR
    -- Service role access (for temporary chat processing)
    (auth.role() = 'service_role') OR
    -- Allow access for temporary chat conversations
    (conversation_id IN (
      SELECT tcs.conversation_id 
      FROM temporary_chat_sessions tcs
      JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
      WHERE tcl.user_id = auth.uid()
    ))
  );

-- =============================================================================
-- SECURITY FUNCTIONS FOR RLS POLICIES
-- =============================================================================

-- Function to check if a user owns a temporary chat link
CREATE OR REPLACE FUNCTION user_owns_temp_chat_link(link_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM temporary_chat_links 
    WHERE id = link_id AND temporary_chat_links.user_id = user_owns_temp_chat_link.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a session belongs to a user's link
CREATE OR REPLACE FUNCTION user_owns_temp_chat_session(session_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    WHERE tcs.id = session_id AND tcl.user_id = user_owns_temp_chat_session.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate if a link token can be accessed publicly
CREATE OR REPLACE FUNCTION can_access_temp_chat_link(vault_token_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM temporary_chat_links 
    WHERE vault_link_token_id = vault_token_id
      AND is_active = TRUE 
      AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- AUDIT AND MONITORING POLICIES
-- =============================================================================

-- Create policy for tool_execution_logs to include temporary chat activities
CREATE POLICY "temp_chat_audit_logs" ON tool_execution_logs
  FOR ALL USING (
    -- Regular user access to their own logs
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    -- Service role access
    (auth.role() = 'service_role') OR
    -- Agent owner access
    (auth.uid() IS NOT NULL AND agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )) OR
    -- Access for temporary chat related logs
    (tool_name LIKE 'temporary_chat_%' AND user_id = auth.uid())
  );

-- =============================================================================
-- PERFORMANCE OPTIMIZATION FOR RLS
-- =============================================================================

-- Create indexes to support RLS policy performance
CREATE INDEX IF NOT EXISTS idx_temp_links_rls_user_agent 
  ON temporary_chat_links(user_id, agent_id) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_temp_sessions_rls_link_user 
  ON temporary_chat_sessions(link_id) 
  INCLUDE (created_at, status);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_temp_chat 
  ON conversation_sessions(conversation_id, user_id, agent_id);

-- =============================================================================
-- SECURITY MONITORING AND ALERTS
-- =============================================================================

-- Function to log RLS policy violations
CREATE OR REPLACE FUNCTION log_temp_chat_access_violation(
  table_name TEXT,
  operation TEXT,
  user_role TEXT,
  additional_info JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  -- Log security violation for monitoring
  INSERT INTO tool_execution_logs (
    agent_id,
    user_id,
    tool_name,
    execution_status,
    execution_details,
    created_at
  ) VALUES (
    NULL, -- No specific agent for security logs
    auth.uid(),
    'temporary_chat_security_violation',
    'warning',
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation,
      'user_role', user_role,
      'timestamp', NOW(),
      'additional_info', additional_info
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TESTING AND VALIDATION FUNCTIONS
-- =============================================================================

-- Function to test RLS policies (for development/testing)
CREATE OR REPLACE FUNCTION test_temp_chat_rls_policies()
RETURNS TABLE (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
) AS $$
BEGIN
  -- Test 1: Users can only see their own links
  RETURN QUERY SELECT 
    'user_isolation_test'::TEXT,
    (SELECT COUNT(*) FROM temporary_chat_links WHERE user_id != auth.uid()) = 0,
    'Users should not see other users links'::TEXT;
  
  -- Test 2: Service role can see all links
  -- Note: This would need to be run with service role context
  
  -- Test 3: Anonymous users can only see active, non-expired links for validation
  -- Note: This would need to be run with anonymous context
  
  -- Add more tests as needed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "temp_links_user_isolation" ON temporary_chat_links IS 
  'Ensures users can only access temporary chat links they created';

COMMENT ON POLICY "temp_links_agent_ownership" ON temporary_chat_links IS 
  'Allows users to access temporary chat links for agents they own';

COMMENT ON POLICY "temp_links_public_validation" ON temporary_chat_links IS 
  'Allows anonymous users to validate active, non-expired links for public access';

COMMENT ON POLICY "temp_sessions_service_role" ON temporary_chat_sessions IS 
  'Gives service role full access to temporary chat sessions for system operations';

COMMENT ON POLICY "temp_sessions_link_ownership" ON temporary_chat_sessions IS 
  'Allows users to view sessions for temporary chat links they own';

COMMENT ON FUNCTION user_owns_temp_chat_link IS 
  'Security function to check if a user owns a specific temporary chat link';

COMMENT ON FUNCTION can_access_temp_chat_link IS 
  'Security function to validate if a link token can be accessed publicly';

-- Log the migration with policy count
DO $$
DECLARE
  links_policies INTEGER;
  sessions_policies INTEGER;
  total_policies INTEGER;
BEGIN
  -- Count policies on temporary_chat_links
  SELECT COUNT(*) INTO links_policies
  FROM pg_policies 
  WHERE tablename = 'temporary_chat_links';
  
  -- Count policies on temporary_chat_sessions
  SELECT COUNT(*) INTO sessions_policies
  FROM pg_policies 
  WHERE tablename = 'temporary_chat_sessions';
  
  total_policies := links_policies + sessions_policies;
  
  RAISE NOTICE 'Migration completed: Created % RLS policies (% on links, % on sessions)', 
    total_policies, links_policies, sessions_policies;
END $$;
