-- Migration to add CASCADE DELETE for all agent-related tables
-- This ensures that when an agent is deleted, all related records are also deleted

BEGIN;

-- Drop all existing foreign key constraints that reference agents
ALTER TABLE agent_contact_permissions DROP CONSTRAINT IF EXISTS agent_contact_permissions_agent_id_fkey;
ALTER TABLE agent_datastores DROP CONSTRAINT IF EXISTS agent_datastores_agent_id_fkey;
ALTER TABLE agent_droplets DROP CONSTRAINT IF EXISTS agent_droplets_agent_id_fkey;
ALTER TABLE agent_group_access DROP CONSTRAINT IF EXISTS agent_group_access_agent_id_fkey;
ALTER TABLE agent_integration_permissions DROP CONSTRAINT IF EXISTS agent_integration_permissions_agent_id_fkey;
ALTER TABLE agent_llm_preferences DROP CONSTRAINT IF EXISTS agent_llm_preferences_agent_id_fkey;
ALTER TABLE agent_mailgun_permissions DROP CONSTRAINT IF EXISTS agent_mailgun_permissions_agent_id_fkey;
ALTER TABLE agent_mcp_connections DROP CONSTRAINT IF EXISTS agent_mcp_connections_agent_id_fkey;
ALTER TABLE agent_media_assignments DROP CONSTRAINT IF EXISTS agent_media_assignments_agent_id_fkey;
ALTER TABLE agent_memories DROP CONSTRAINT IF EXISTS agent_memories_agent_id_fkey;
ALTER TABLE agent_specific_contact_access DROP CONSTRAINT IF EXISTS agent_specific_contact_access_agent_id_fkey;
ALTER TABLE agent_task_executions DROP CONSTRAINT IF EXISTS agent_task_executions_agent_id_fkey;
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_agent_id_fkey;
ALTER TABLE agent_toolbelt_items DROP CONSTRAINT IF EXISTS agent_toolbelt_items_agent_id_fkey;
ALTER TABLE agent_toolbox_access DROP CONSTRAINT IF EXISTS agent_toolbox_access_agent_id_fkey;
ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_agent_id_fkey;
ALTER TABLE canvas_sessions DROP CONSTRAINT IF EXISTS canvas_sessions_agent_id_fkey;
ALTER TABLE chat_messages_v2 DROP CONSTRAINT IF EXISTS chat_messages_v2_sender_agent_id_fkey;
ALTER TABLE contact_audit_log DROP CONSTRAINT IF EXISTS contact_audit_log_agent_id_fkey;
ALTER TABLE contact_interactions DROP CONSTRAINT IF EXISTS contact_interactions_agent_id_fkey;
ALTER TABLE context_boards DROP CONSTRAINT IF EXISTS context_boards_agent_id_fkey;
ALTER TABLE context_snapshots DROP CONSTRAINT IF EXISTS context_snapshots_agent_id_fkey;
ALTER TABLE conversation_sessions DROP CONSTRAINT IF EXISTS conversation_sessions_agent_id_fkey;
ALTER TABLE conversation_summaries DROP CONSTRAINT IF EXISTS conversation_summaries_agent_id_fkey;
ALTER TABLE conversation_summary_boards DROP CONSTRAINT IF EXISTS conversation_summary_boards_agent_id_fkey;
ALTER TABLE datastore_documents DROP CONSTRAINT IF EXISTS datastore_documents_agent_id_fkey;
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_agent_id_fkey;
ALTER TABLE enhanced_context_boards DROP CONSTRAINT IF EXISTS enhanced_context_boards_agent_id_fkey;
ALTER TABLE gmail_operation_logs DROP CONSTRAINT IF EXISTS gmail_operation_logs_agent_id_fkey;
ALTER TABLE mailgun_operation_logs DROP CONSTRAINT IF EXISTS mailgun_operation_logs_agent_id_fkey;
ALTER TABLE mailgun_routes DROP CONSTRAINT IF EXISTS mailgun_routes_agent_id_fkey;
ALTER TABLE memory_consolidations DROP CONSTRAINT IF EXISTS memory_consolidations_agent_id_fkey;
ALTER TABLE reasoning_sessions DROP CONSTRAINT IF EXISTS reasoning_sessions_agent_id_fkey;
ALTER TABLE smtp_operation_logs DROP CONSTRAINT IF EXISTS smtp_operation_logs_agent_id_fkey;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_reports_to_agent_id_fkey;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_agent_id_fkey;
ALTER TABLE temporary_chat_links DROP CONSTRAINT IF EXISTS temporary_chat_links_agent_id_fkey;
ALTER TABLE tool_execution_logs DROP CONSTRAINT IF EXISTS tool_execution_logs_agent_id_fkey;
ALTER TABLE tool_user_input_requests DROP CONSTRAINT IF EXISTS tool_user_input_requests_agent_id_fkey;
ALTER TABLE user_checkpoint_plans DROP CONSTRAINT IF EXISTS user_checkpoint_plans_agent_id_fkey;
ALTER TABLE working_memory_chunks DROP CONSTRAINT IF EXISTS working_memory_chunks_agent_id_fkey;
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_agent_id_fkey;

-- Recreate all foreign key constraints with CASCADE DELETE
ALTER TABLE agent_contact_permissions ADD CONSTRAINT agent_contact_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_datastores ADD CONSTRAINT agent_datastores_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_droplets ADD CONSTRAINT agent_droplets_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_group_access ADD CONSTRAINT agent_group_access_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_integration_permissions ADD CONSTRAINT agent_integration_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_llm_preferences ADD CONSTRAINT agent_llm_preferences_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_mailgun_permissions ADD CONSTRAINT agent_mailgun_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_mcp_connections ADD CONSTRAINT agent_mcp_connections_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_media_assignments ADD CONSTRAINT agent_media_assignments_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_memories ADD CONSTRAINT agent_memories_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_specific_contact_access ADD CONSTRAINT agent_specific_contact_access_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_task_executions ADD CONSTRAINT agent_task_executions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_toolbelt_items ADD CONSTRAINT agent_toolbelt_items_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_toolbox_access ADD CONSTRAINT agent_toolbox_access_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE canvas_sessions ADD CONSTRAINT canvas_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE chat_messages_v2 ADD CONSTRAINT chat_messages_v2_sender_agent_id_fkey FOREIGN KEY (sender_agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE contact_audit_log ADD CONSTRAINT contact_audit_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE contact_interactions ADD CONSTRAINT contact_interactions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE context_boards ADD CONSTRAINT context_boards_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE context_snapshots ADD CONSTRAINT context_snapshots_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE conversation_sessions ADD CONSTRAINT conversation_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE conversation_summaries ADD CONSTRAINT conversation_summaries_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE conversation_summary_boards ADD CONSTRAINT conversation_summary_boards_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE datastore_documents ADD CONSTRAINT datastore_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE enhanced_context_boards ADD CONSTRAINT enhanced_context_boards_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE gmail_operation_logs ADD CONSTRAINT gmail_operation_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE mailgun_operation_logs ADD CONSTRAINT mailgun_operation_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE mailgun_routes ADD CONSTRAINT mailgun_routes_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE memory_consolidations ADD CONSTRAINT memory_consolidations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE reasoning_sessions ADD CONSTRAINT reasoning_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE smtp_operation_logs ADD CONSTRAINT smtp_operation_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- Handle team_members table with special care (has two agent references)
ALTER TABLE team_members ADD CONSTRAINT team_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
-- For reports_to_agent_id, we'll set to NULL instead of CASCADE to avoid orphaning team structure
ALTER TABLE team_members ADD CONSTRAINT team_members_reports_to_agent_id_fkey FOREIGN KEY (reports_to_agent_id) REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE temporary_chat_links ADD CONSTRAINT temporary_chat_links_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE tool_execution_logs ADD CONSTRAINT tool_execution_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE tool_user_input_requests ADD CONSTRAINT tool_user_input_requests_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE user_checkpoint_plans ADD CONSTRAINT user_checkpoint_plans_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE working_memory_chunks ADD CONSTRAINT working_memory_chunks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- Create a function to safely delete an agent and all related data
CREATE OR REPLACE FUNCTION delete_agent_cascade(agent_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Check if agent exists and belongs to the current user
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = agent_uuid 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;

    -- Delete the agent (CASCADE will handle all related records automatically)
    DELETE FROM agents WHERE id = agent_uuid AND user_id = auth.uid();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RAISE EXCEPTION 'Failed to delete agent';
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and re-raise
        RAISE EXCEPTION 'Error deleting agent: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_agent_cascade(UUID) TO authenticated;

COMMIT;
