-- Refresh PostgREST schema cache to recognize agent_datastores relationship
-- Purpose: Force PostgREST to reload schema and recognize the agent_datastores table relationship

BEGIN;

-- Force PostgREST to reload the schema cache by sending a NOTIFY signal
-- This will make PostgREST recognize the agent_datastores table and its relationships
NOTIFY pgrst, 'reload schema';

-- Also ensure the foreign key constraints exist (in case they were missing)
DO $$
BEGIN
    -- Check if the foreign key constraint exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_datastores_agent_id_fkey'
        AND table_name = 'agent_datastores'
    ) THEN
        ALTER TABLE agent_datastores 
        ADD CONSTRAINT agent_datastores_agent_id_fkey 
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_datastores_datastore_id_fkey'
        AND table_name = 'agent_datastores'
    ) THEN
        ALTER TABLE agent_datastores 
        ADD CONSTRAINT agent_datastores_datastore_id_fkey 
        FOREIGN KEY (datastore_id) REFERENCES datastores (id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add a comment to trigger schema reload
COMMENT ON TABLE agent_datastores IS 'Links agents to their associated datastores - schema cache refreshed';

COMMIT;
