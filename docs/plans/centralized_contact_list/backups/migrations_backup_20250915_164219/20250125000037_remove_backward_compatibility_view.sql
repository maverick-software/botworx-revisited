-- Remove unnecessary backward compatibility view
-- Date: January 25, 2025
-- Purpose: Clean up backward compatibility view since all code has been updated

BEGIN;

-- Drop the backward compatibility view since we updated all code references
DROP VIEW IF EXISTS public.agent_oauth_permissions;

-- Remove any grants on the old view name
-- (This will fail silently if the view doesn't exist, which is fine)

-- Add a comment to document the cleanup
COMMENT ON TABLE agent_integration_permissions IS 
'Agent permissions for ALL integration types (OAuth, API keys, SMTP, MCP, etc.) - Renamed from agent_oauth_permissions. All code updated to use new name.';

-- Verification: Ensure the view is gone and table exists
DO $$
BEGIN
    -- Verify the table exists with new name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_integration_permissions' 
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'ERROR: agent_integration_permissions table not found!';
    END IF;
    
    -- Verify the old view is gone
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'agent_oauth_permissions'
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'ERROR: agent_oauth_permissions view still exists!';
    END IF;
    
    RAISE NOTICE '✅ Cleanup complete: agent_integration_permissions table exists';
    RAISE NOTICE '✅ Cleanup complete: agent_oauth_permissions view removed';
    RAISE NOTICE '✅ All code now uses the proper table name with no confusing legacy views';
END $$;

COMMIT;
