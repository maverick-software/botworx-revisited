-- Fix integration_capabilities foreign key constraint
-- Purpose: Update constraint to point to service_providers instead of deprecated integrations_renamed

-- Drop the existing constraint
ALTER TABLE integration_capabilities 
DROP CONSTRAINT integration_capabilities_integration_id_fkey;

-- Add the constraint back pointing to the correct table
ALTER TABLE integration_capabilities 
ADD CONSTRAINT integration_capabilities_integration_id_fkey 
FOREIGN KEY (integration_id) REFERENCES service_providers(id) ON DELETE CASCADE;

-- Log the fix
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed integration_capabilities foreign key constraint to point to service_providers';
END $$;
