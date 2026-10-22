-- Cleanup Revoked Connections
-- Date: January 25, 2025
-- Purpose: Remove revoked connections that are blocking new credential setup due to unique constraints

-- Remove orphaned agent permissions for revoked connections first
-- This resolves foreign key constraints that prevent deletion
DELETE FROM agent_oauth_permissions 
WHERE user_oauth_connection_id IN (
    SELECT id FROM user_oauth_connections 
    WHERE connection_status = 'revoked'
);

-- Remove orphaned agent web search permissions for revoked connections
DELETE FROM agent_web_search_permissions
WHERE user_key_id IN (
    SELECT id FROM user_web_search_keys
    WHERE key_status IN ('inactive', 'expired', 'error')
);

-- Clean up revoked web search keys
DELETE FROM user_web_search_keys
WHERE key_status IN ('inactive', 'expired', 'error');

-- Now delete all revoked OAuth connections
DELETE FROM user_oauth_connections 
WHERE connection_status = 'revoked';

-- Clean up any expired connections older than 30 days
DELETE FROM user_oauth_connections 
WHERE connection_status = 'expired' 
  AND updated_at < (now() - INTERVAL '30 days');

-- Add a comment explaining the cleanup
COMMENT ON TABLE user_oauth_connections IS 'User OAuth and API key connections. Revoked connections should be deleted, not just marked as revoked, to prevent unique constraint conflicts.';
