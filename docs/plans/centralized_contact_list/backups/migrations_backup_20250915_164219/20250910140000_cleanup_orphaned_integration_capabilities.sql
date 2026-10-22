-- Cleanup orphaned integration capabilities
-- Purpose: Remove integration_capabilities records that reference non-existent service_providers

-- First, let's see what we're dealing with
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM integration_capabilities ic
    LEFT JOIN service_providers sp ON ic.integration_id = sp.id
    WHERE sp.id IS NULL;
    
    RAISE NOTICE 'Found % orphaned integration_capabilities records', orphaned_count;
END $$;

-- Remove orphaned integration_capabilities records
DELETE FROM integration_capabilities 
WHERE integration_id NOT IN (
    SELECT id FROM service_providers
);

-- Now we can safely add the constraint
ALTER TABLE integration_capabilities 
DROP CONSTRAINT IF EXISTS integration_capabilities_integration_id_fkey;

ALTER TABLE integration_capabilities 
ADD CONSTRAINT integration_capabilities_integration_id_fkey 
FOREIGN KEY (integration_id) REFERENCES service_providers(id) ON DELETE CASCADE;

-- Log the cleanup
DO $$
BEGIN
    RAISE NOTICE '✅ Cleaned up orphaned integration_capabilities and fixed foreign key constraint';
END $$;
