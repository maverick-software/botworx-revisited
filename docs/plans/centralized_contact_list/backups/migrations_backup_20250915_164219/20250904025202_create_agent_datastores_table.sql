-- Create agent_datastores table for agent-datastore relationships
-- Purpose: Link agents to their associated datastores for knowledge management

BEGIN;

-- Create the agent_datastores table
CREATE TABLE IF NOT EXISTS public.agent_datastores (
  id uuid not null default gen_random_uuid (),
  agent_id uuid not null,
  datastore_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint agent_datastores_pkey primary key (id),
  constraint agent_datastores_agent_id_datastore_id_key unique (agent_id, datastore_id),
  constraint agent_datastores_agent_id_fkey foreign KEY (agent_id) references agents (id) on delete CASCADE,
  constraint agent_datastores_datastore_id_fkey foreign KEY (datastore_id) references datastores (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_datastores_agent_id on public.agent_datastores using btree (agent_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_agent_datastores_datastore_id on public.agent_datastores using btree (datastore_id) TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE agent_datastores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access agent_datastores for their own agents
CREATE POLICY agent_datastores_user_access ON agent_datastores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY agent_datastores_service_access ON agent_datastores
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_datastores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_datastores TO service_role;

-- Add table comment
COMMENT ON TABLE agent_datastores IS 'Links agents to their associated datastores for knowledge management and context';

COMMIT;
