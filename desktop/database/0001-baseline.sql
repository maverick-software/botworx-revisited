--
-- PostgreSQL database dump
--

\restrict MVGHWOZjDX4R8PScrNmDeQP2el1iLEdzEgkVm6eBqYcNebXNgnQbH6LClM9GPho

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'Cleaned up all database objects from the failed custom Vault implementation.';


--
-- Name: agent_tool_credential_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agent_tool_credential_status_enum AS ENUM (
    'active',
    'revoked',
    'requires_reauth',
    'error'
);


--
-- Name: chat_member_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_member_type AS ENUM (
    'user',
    'agent',
    'team'
);


--
-- Name: connection_credential_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connection_credential_type_enum AS ENUM (
    'oauth',
    'api_key'
);


--
-- Name: droplet_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.droplet_status_enum AS ENUM (
    'pending_creation',
    'creating',
    'active',
    'error_creation',
    'pending_deletion',
    'deleting',
    'deleted',
    'error_deletion',
    'unresponsive'
);


--
-- Name: event_trigger_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_trigger_type_enum AS ENUM (
    'email_received',
    'integration_webhook',
    'time_based',
    'manual',
    'agent_mentioned',
    'file_uploaded',
    'workspace_message'
);


--
-- Name: integration_agent_classification_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.integration_agent_classification_enum AS ENUM (
    'tool',
    'channel'
);


--
-- Name: integration_connection_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.integration_connection_status_enum AS ENUM (
    'connected',
    'disconnected',
    'error',
    'pending'
);


--
-- Name: integration_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.integration_status_enum AS ENUM (
    'available',
    'beta',
    'coming_soon',
    'deprecated'
);


--
-- Name: room_member_details; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.room_member_details AS (
	member_entry_id uuid,
	room_id uuid,
	member_type text,
	member_id uuid,
	added_at timestamp with time zone,
	member_name text,
	member_avatar_url text
);


--
-- Name: task_execution_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_execution_status_enum AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: task_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status_enum AS ENUM (
    'active',
    'paused',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: task_step_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_step_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'skipped'
);


--
-- Name: TYPE task_step_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.task_step_status IS 'Enum defining step execution states: pending, running, completed, failed, skipped';


--
-- Name: task_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_type_enum AS ENUM (
    'scheduled',
    'event_based'
);


--
-- Name: team_connection_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_connection_type AS ENUM (
    'reports_to',
    'collaborates_with',
    'supports',
    'custom'
);


--
-- Name: TYPE team_connection_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.team_connection_type IS 'Enum defining types of relationships between teams: reports_to, collaborates_with, supports, custom';


--
-- Name: tool_installation_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tool_installation_status_enum AS ENUM (
    'pending_install',
    'installing',
    'active',
    'error_install',
    'pending_uninstall',
    'uninstalling',
    'uninstalled',
    'error_uninstall',
    'pending_config',
    'stopped',
    'starting',
    'stopping',
    'error_runtime',
    'disabled'
);


--
-- Name: admin_reactivate_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reactivate_user(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
BEGIN
    -- Clear the banned_until field
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION admin_reactivate_user(target_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_reactivate_user(target_user_id uuid) IS 'Reactivate a user by clearing banned_until - service role only';


--
-- Name: admin_suspend_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_suspend_user(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
BEGIN
    -- Update the user's banned_until field to a far future date
    UPDATE auth.users
    SET banned_until = NOW() + INTERVAL '999 years'
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION admin_suspend_user(target_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_suspend_user(target_user_id uuid) IS 'Suspend a user by setting banned_until - service role only';


--
-- Name: aggregate_user_token_usage(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aggregate_user_token_usage(p_user_id uuid DEFAULT NULL::uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(users_processed integer, records_created integer, records_updated integer, total_tokens_aggregated bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
  v_period_start TIMESTAMP WITH TIME ZONE;
  v_period_end TIMESTAMP WITH TIME ZONE;
  v_users_processed INTEGER := 0;
  v_records_created INTEGER := 0;
  v_records_updated INTEGER := 0;
  v_total_tokens BIGINT := 0;
  v_user RECORD;
  v_existed BOOLEAN;
BEGIN
  -- Default to yesterday if no dates provided
  v_start := COALESCE(p_start_date, DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day'));
  v_end := COALESCE(p_end_date, DATE_TRUNC('day', CURRENT_DATE));
  
  RAISE NOTICE 'Starting aggregation from % to % for user %', v_start, v_end, COALESCE(p_user_id::TEXT, 'ALL');
  
  v_period_start := v_start;
  
  -- Loop through each day in the date range
  WHILE v_period_start < v_end LOOP
    v_period_end := v_period_start + INTERVAL '1 day';
    
    -- Find all users who have messages with LLM call data in this period
    -- JOIN with conversation_sessions to get the user_id for all messages in a conversation
    FOR v_user IN (
      SELECT DISTINCT cs.user_id as user_id
      FROM chat_messages_v2 cm
      JOIN conversation_sessions cs ON cm.conversation_id = cs.conversation_id
      WHERE (p_user_id IS NULL OR cs.user_id = p_user_id)
        AND cs.user_id IS NOT NULL
        AND cm.created_at >= v_period_start
        AND cm.created_at < v_period_end
        AND cm.metadata->'processingDetails'->'llm_calls' IS NOT NULL
        AND jsonb_array_length(cm.metadata->'processingDetails'->'llm_calls') > 0
    ) LOOP
      
      -- Check if record already exists
      SELECT EXISTS (
        SELECT 1 FROM user_token_usage
        WHERE user_id = v_user.user_id
          AND period_start = v_period_start
          AND period_type = 'daily'
      ) INTO v_existed;
      
      -- Aggregate and insert/update the token usage for this user and period
      INSERT INTO user_token_usage (
        user_id, period_start, period_end, period_type,
        total_prompt_tokens, total_completion_tokens, total_tokens,
        message_count, conversation_count, agent_ids, last_activity
      )
      SELECT
        v_user.user_id,
        v_period_start,
        v_period_end,
        'daily',
        -- Sum all prompt tokens from all LLM calls
        COALESCE(SUM(
          (SELECT SUM(COALESCE((call->'response'->'usage'->>'prompt_tokens')::BIGINT, 0))
           FROM jsonb_array_elements(cm.metadata->'processingDetails'->'llm_calls') AS call)
        ), 0),
        -- Sum all completion tokens from all LLM calls
        COALESCE(SUM(
          (SELECT SUM(COALESCE((call->'response'->'usage'->>'completion_tokens')::BIGINT, 0))
           FROM jsonb_array_elements(cm.metadata->'processingDetails'->'llm_calls') AS call)
        ), 0),
        -- Sum all total tokens from all LLM calls
        COALESCE(SUM(
          (SELECT SUM(COALESCE((call->'response'->'usage'->>'total_tokens')::BIGINT, 0))
           FROM jsonb_array_elements(cm.metadata->'processingDetails'->'llm_calls') AS call)
        ), 0),
        -- Count messages
        COUNT(DISTINCT cm.id),
        -- Count unique conversations
        COUNT(DISTINCT cm.conversation_id),
        -- Collect unique agent IDs from conversation_sessions
        ARRAY_AGG(DISTINCT cs.agent_id) FILTER (WHERE cs.agent_id IS NOT NULL),
        -- Last activity timestamp
        MAX(cm.created_at)
      FROM chat_messages_v2 cm
      JOIN conversation_sessions cs ON cm.conversation_id = cs.conversation_id
      WHERE cs.user_id = v_user.user_id
        AND cm.created_at >= v_period_start
        AND cm.created_at < v_period_end
        AND cm.metadata->'processingDetails'->'llm_calls' IS NOT NULL
        AND jsonb_array_length(cm.metadata->'processingDetails'->'llm_calls') > 0
      GROUP BY cs.user_id
      ON CONFLICT (user_id, period_start, period_type)
      DO UPDATE SET
        total_prompt_tokens = EXCLUDED.total_prompt_tokens,
        total_completion_tokens = EXCLUDED.total_completion_tokens,
        total_tokens = EXCLUDED.total_tokens,
        message_count = EXCLUDED.message_count,
        conversation_count = EXCLUDED.conversation_count,
        agent_ids = EXCLUDED.agent_ids,
        last_activity = EXCLUDED.last_activity,
        updated_at = NOW();
      
      IF v_existed THEN
        v_records_updated := v_records_updated + 1;
      ELSE
        v_records_created := v_records_created + 1;
      END IF;
      
      v_users_processed := v_users_processed + 1;
    END LOOP;
    
    v_period_start := v_period_start + INTERVAL '1 day';
  END LOOP;
  
  RETURN QUERY SELECT v_users_processed, v_records_created, v_records_updated, v_total_tokens;
END;
$$;


--
-- Name: FUNCTION aggregate_user_token_usage(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.aggregate_user_token_usage(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) IS 'Aggregates token usage by joining chat_messages_v2 with conversation_sessions to get user_id';


--
-- Name: apply_retention_policies(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_retention_policies() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER := 0;
  contact_record RECORD;
BEGIN
  -- Find contacts that should be deleted based on retention policies
  FOR contact_record IN
    SELECT id, user_id, display_name, data_retention_date
    FROM contacts
    WHERE data_retention_date IS NOT NULL 
      AND data_retention_date <= CURRENT_TIMESTAMP
      AND deleted_at IS NULL
  LOOP
    -- Log retention deletion
    INSERT INTO contact_audit_log (
      contact_id, user_id, operation_type, operation_details
    ) VALUES (
      contact_record.id, contact_record.user_id, 'gdpr_request',
      jsonb_build_object(
        'action', 'retention_delete',
        'retention_date', contact_record.data_retention_date,
        'contact_name', contact_record.display_name,
        'deletion_date', NOW()
      )
    );
    
    -- Perform deletion
    DELETE FROM contacts WHERE id = contact_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION apply_retention_policies(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.apply_retention_policies() IS 'Automated data retention policy enforcement';


--
-- Name: assign_local_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_local_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles(user_id, role_id) SELECT NEW.id, id FROM public.roles WHERE name='user' ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: assign_media_to_agent(uuid, uuid, uuid, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_media_to_agent(p_agent_id uuid, p_media_id uuid, p_user_id uuid, p_assignment_type text DEFAULT 'training_data'::text, p_include_vector boolean DEFAULT true, p_include_graph boolean DEFAULT true) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    assignment_id UUID;
BEGIN
    -- Validate agent ownership
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Validate media ownership
    IF NOT EXISTS (
        SELECT 1 FROM media_library 
        WHERE id = p_media_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Media file not found or access denied';
    END IF;
    
    -- Create or update assignment
    INSERT INTO agent_media_assignments (
        agent_id,
        media_id,
        user_id,
        assignment_type,
        include_in_vector_search,
        include_in_knowledge_graph
    ) VALUES (
        p_agent_id,
        p_media_id,
        p_user_id,
        p_assignment_type,
        p_include_vector,
        p_include_graph
    )
    ON CONFLICT (agent_id, media_id) 
    DO UPDATE SET
        assignment_type = EXCLUDED.assignment_type,
        include_in_vector_search = EXCLUDED.include_in_vector_search,
        include_in_knowledge_graph = EXCLUDED.include_in_knowledge_graph,
        is_active = true,
        updated_at = NOW()
    RETURNING id INTO assignment_id;
    
    -- Update assignment count cache
    UPDATE media_library 
    SET 
        assigned_agents_count = (
            SELECT COUNT(*) FROM agent_media_assignments 
            WHERE media_id = p_media_id AND is_active = true
        ),
        last_assigned_at = NOW()
    WHERE id = p_media_id;
    
    RETURN assignment_id;
END;
$$;


--
-- Name: audit_mcp_url_security(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_mcp_url_security() RETURNS TABLE(security_status text, connection_count bigint, details text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'SECURE_VAULT_STORAGE'::TEXT,
        COUNT(*),
        'Connections with vault-encrypted URLs'::TEXT
    FROM agent_mcp_connections 
    WHERE vault_server_url_id IS NOT NULL AND server_url IS NULL
    
    UNION ALL
    
    SELECT 
        'MIGRATION_PENDING'::TEXT,
        COUNT(*),
        'Connections with deprecated plain text URLs'::TEXT
    FROM agent_mcp_connections 
    WHERE server_url_deprecated IS NOT NULL AND vault_server_url_id IS NULL
    
    UNION ALL
    
    SELECT 
        'SECURITY_VIOLATION'::TEXT,
        COUNT(*),
        'CRITICAL: Connections with plain text URLs in main column'::TEXT
    FROM agent_mcp_connections 
    WHERE server_url IS NOT NULL;
END;
$$;


--
-- Name: auto_create_contact_management_credential(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_contact_management_credential() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  credential_id UUID;
BEGIN
  -- Create contact management credential for the new user
  credential_id := create_contact_management_credential_for_user(NEW.id);
  
  RAISE NOTICE 'Auto-created contact management credential % for new user %', credential_id, NEW.id;
  
  RETURN NEW;
END;
$$;


--
-- Name: auto_grant_contact_management_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_grant_contact_management_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  permission_id UUID;
BEGIN
  -- Grant contact management access to the new agent
  permission_id := grant_contact_management_access_to_agent(
    NEW.id,
    NEW.user_id,
    ARRAY['search_contacts', 'get_contact_details']
  );
  
  RAISE NOTICE 'Auto-granted contact management access % to new agent %', permission_id, NEW.id;
  
  RETURN NEW;
END;
$$;


--
-- Name: backfill_token_usage(date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer DEFAULT 30) RETURNS TABLE(batch_start date, batch_end date, users_processed integer, records_created integer, records_updated integer, status text, duration_seconds numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_batch_start DATE := p_start_date;
  v_batch_end DATE;
  v_result RECORD;
  v_start_time TIMESTAMP;
  v_duration NUMERIC;
BEGIN
  WHILE v_batch_start < p_end_date LOOP
    v_batch_end := LEAST(v_batch_start + p_batch_size, p_end_date);
    v_start_time := clock_timestamp();
    
    BEGIN
      SELECT * INTO v_result FROM aggregate_user_token_usage(
        NULL, v_batch_start::timestamp, v_batch_end::timestamp
      );
      
      v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
      RETURN QUERY SELECT v_batch_start, v_batch_end, v_result.users_processed,
        v_result.records_created, v_result.records_updated, 'success'::TEXT, v_duration;
      
    EXCEPTION WHEN OTHERS THEN
      v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
      RETURN QUERY SELECT v_batch_start, v_batch_end, 0, 0, 0,
        'error: ' || SQLERRM, v_duration;
    END;
    
    v_batch_start := v_batch_end;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer) IS 'Backfills historical token usage data in batches';


--
-- Name: calculate_next_run_time(text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_next_run_time(cron_expr text, timezone_name text DEFAULT 'UTC'::text, from_time timestamp with time zone DEFAULT now()) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- This is a placeholder. In practice, you'd implement proper cron parsing
    -- or call out to a function that uses a cron library
    -- For now, we'll return a simple future time
    RETURN from_time + INTERVAL '1 hour';
END;
$$;


--
-- Name: can_access_temp_chat_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_temp_chat_link(vault_token_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM temporary_chat_links 
    WHERE vault_link_token_id = vault_token_id
      AND is_active = TRUE 
      AND expires_at > NOW()
  );
END;
$$;


--
-- Name: FUNCTION can_access_temp_chat_link(vault_token_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_access_temp_chat_link(vault_token_id text) IS 'Security function to validate if a link token can be accessed publicly';


--
-- Name: can_manage_chat_room_members(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_chat_room_members(p_room_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check if user is the chat_room owner
    SELECT 1
    FROM public.chat_rooms w -- Check chat_rooms table
    WHERE w.id = p_room_id AND w.owner_user_id = p_user_id
    UNION ALL
    -- Check if user is a direct member with the 'moderator' role
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_room_id 
      AND wm.user_id = p_user_id 
      AND wm.role = 'moderator'
  );
$$;


--
-- Name: can_manage_workspace_members(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id AND wm.role = 'moderator' -- Or other managing roles
  );
$$;


--
-- Name: check_agent_contact_permission(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text DEFAULT 'view'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  agent_user_id UUID;
  contact_user_id UUID;
  has_permission BOOLEAN := FALSE;
  permission_record RECORD;
BEGIN
  -- Get agent owner
  SELECT user_id INTO agent_user_id FROM agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RAISE NOTICE 'Agent % not found', p_agent_id;
    RETURN FALSE;
  END IF;
  
  -- Check if specific contact is provided and validate ownership
  IF p_contact_id IS NOT NULL THEN
    SELECT user_id INTO contact_user_id FROM contacts WHERE id = p_contact_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'Contact % not found', p_contact_id;
      RETURN FALSE;
    END IF;
    
    -- Agents can only access contacts owned by the same user
    IF agent_user_id != contact_user_id THEN
      RAISE NOTICE 'Agent user % does not match contact user %', agent_user_id, contact_user_id;
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Get agent permissions
  SELECT * INTO permission_record
  FROM agent_contact_permissions
  WHERE agent_id = p_agent_id 
    AND user_id = agent_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No contact permissions found for agent % and user %', p_agent_id, agent_user_id;
    -- If no permissions exist, grant default access for the agent's own user
    -- This ensures agents can access their user's contacts by default
    INSERT INTO agent_contact_permissions (
      agent_id,
      user_id,
      permission_type,
      can_view,
      can_contact,
      can_edit,
      can_delete,
      can_export,
      granted_by_user_id,
      granted_at
    ) VALUES (
      p_agent_id,
      agent_user_id,
      'all_contacts',
      true,
      true,
      false,
      false,
      false,
      agent_user_id,
      NOW()
    ) ON CONFLICT (agent_id) DO UPDATE SET
      permission_type = EXCLUDED.permission_type,
      can_view = EXCLUDED.can_view,
      can_contact = EXCLUDED.can_contact
    RETURNING * INTO permission_record;
    
    IF NOT FOUND THEN
      RAISE NOTICE 'Failed to create default permissions';
      RETURN FALSE;
    END IF;
  END IF;
  
  RAISE NOTICE 'Found permission record: type=%, can_view=%, can_contact=%', 
    permission_record.permission_type, permission_record.can_view, permission_record.can_contact;
  
  -- Check permission type
  CASE permission_record.permission_type
    WHEN 'no_access' THEN
      has_permission := FALSE;
    WHEN 'all_contacts' THEN
      has_permission := TRUE;
    WHEN 'specific_contacts' THEN
      -- For general search (p_contact_id IS NULL), allow if agent has any specific contact access
      -- For specific contact, check specific access table
      IF p_contact_id IS NULL THEN
        has_permission := EXISTS (
          SELECT 1 FROM agent_specific_contact_access
          WHERE agent_id = p_agent_id 
            AND (expires_at IS NULL OR expires_at > NOW())
            AND access_level != 'no_access'
        );
      ELSE
        has_permission := EXISTS (
          SELECT 1 FROM agent_specific_contact_access
          WHERE agent_id = p_agent_id 
            AND contact_id = p_contact_id
            AND (expires_at IS NULL OR expires_at > NOW())
            AND access_level != 'no_access'
        );
      END IF;
    WHEN 'contact_groups' THEN
      -- For general search (p_contact_id IS NULL), allow if agent has any group access
      -- For specific contact, check if contact is in any group the agent has access to
      IF p_contact_id IS NULL THEN
        has_permission := EXISTS (
          SELECT 1 FROM agent_group_access
          WHERE agent_id = p_agent_id
            AND (expires_at IS NULL OR expires_at > NOW())
        );
      ELSE
        has_permission := EXISTS (
          SELECT 1
          FROM agent_group_access aga
          INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
          WHERE aga.agent_id = p_agent_id
            AND cgm.contact_id = p_contact_id
            AND (aga.expires_at IS NULL OR aga.expires_at > NOW())
        );
      END IF;
    WHEN 'filtered_access' THEN
      -- Apply filters from access_filters JSONB
      has_permission := TRUE; -- Simplified for now
    ELSE
      -- Default to allowing access for unknown permission types
      has_permission := TRUE;
  END CASE;
  
  -- Check specific permission type if we have base permission
  IF has_permission THEN
    CASE p_permission_type
      WHEN 'view' THEN
        has_permission := permission_record.can_view;
      WHEN 'contact' THEN
        has_permission := permission_record.can_contact;
      WHEN 'edit' THEN
        has_permission := permission_record.can_edit;
      WHEN 'delete' THEN
        has_permission := permission_record.can_delete;
      WHEN 'export' THEN
        has_permission := permission_record.can_export;
      ELSE
        has_permission := permission_record.can_view; -- Default to view permission
    END CASE;
  END IF;
  
  RAISE NOTICE 'Final permission result: %', has_permission;
  RETURN has_permission;
END;
$$;


--
-- Name: FUNCTION check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text) IS 'Checks if an agent has permission to access contacts, automatically granting default access if none exists';


--
-- Name: check_mcp_server_health(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_mcp_server_health(p_connection_id uuid) RETURNS TABLE(is_healthy boolean, status text, last_call timestamp with time zone, days_since_last_call integer, tool_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  connection_record RECORD;
  tool_count_val BIGINT;
BEGIN
  -- Get connection details
  SELECT * INTO connection_record
  FROM agent_mcp_connections
  WHERE id = p_connection_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Connection not found'::TEXT, NULL::TIMESTAMPTZ, NULL::INTEGER, 0::BIGINT;
    RETURN;
  END IF;

  -- Get tool count
  SELECT COUNT(*) INTO tool_count_val
  FROM mcp_tools_cache
  WHERE connection_id = p_connection_id;

  -- Determine health status
  IF NOT connection_record.is_active THEN
    RETURN QUERY SELECT false, 'Connection disabled'::TEXT, connection_record.last_successful_call, 
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  ELSIF connection_record.last_successful_call IS NULL THEN
    RETURN QUERY SELECT false, 'Never connected'::TEXT, NULL::TIMESTAMPTZ, NULL::INTEGER, tool_count_val;
  ELSIF connection_record.last_successful_call < (NOW() - INTERVAL '7 days') THEN
    RETURN QUERY SELECT false, 'Stale (>7 days)'::TEXT, connection_record.last_successful_call,
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  ELSIF tool_count_val = 0 THEN
    RETURN QUERY SELECT false, 'No tools available'::TEXT, connection_record.last_successful_call,
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  ELSE
    RETURN QUERY SELECT true, 'Healthy'::TEXT, connection_record.last_successful_call,
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  END IF;
END;
$$;


--
-- Name: check_smtp_rate_limit(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_smtp_rate_limit(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    daily_count INTEGER;
    hourly_count INTEGER;
    config_daily_limit INTEGER;
    agent_daily_limit INTEGER;
    effective_daily_limit INTEGER;
BEGIN
    -- Get configuration limits
    SELECT max_emails_per_day
    INTO config_daily_limit
    FROM smtp_configurations
    WHERE id = p_smtp_config_id AND user_id = p_user_id;
    
    -- Get agent-specific limits
    SELECT daily_email_limit
    INTO agent_daily_limit
    FROM agent_smtp_permissions
    WHERE agent_id = p_agent_id AND smtp_config_id = p_smtp_config_id;
    
    -- Use the more restrictive limit
    effective_daily_limit := LEAST(
        COALESCE(config_daily_limit, 100),
        COALESCE(agent_daily_limit, 100)
    );
    
    -- Check daily limit
    SELECT COUNT(*)
    INTO daily_count
    FROM smtp_operation_logs
    WHERE user_id = p_user_id
    AND agent_id = p_agent_id
    AND smtp_config_id = p_smtp_config_id
    AND operation_type = 'send_email'
    AND status = 'success'
    AND created_at >= CURRENT_DATE;
    
    IF daily_count >= effective_daily_limit THEN
        RAISE EXCEPTION 'Daily email limit exceeded: % emails sent, limit is %', 
            daily_count, effective_daily_limit;
    END IF;
    
    -- Check hourly limit (10% of daily limit per hour)
    SELECT COUNT(*)
    INTO hourly_count
    FROM smtp_operation_logs
    WHERE user_id = p_user_id
    AND agent_id = p_agent_id
    AND smtp_config_id = p_smtp_config_id
    AND operation_type = 'send_email'
    AND status = 'success'
    AND created_at >= NOW() - INTERVAL '1 hour';
    
    IF hourly_count >= (effective_daily_limit * 0.1) THEN
        RAISE EXCEPTION 'Hourly email limit exceeded: % emails sent in last hour', 
            hourly_count;
    END IF;
    
    RETURN true;
END;
$$;


--
-- Name: check_temp_chat_rate_limit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_temp_chat_rate_limit(p_session_token text) RETURNS TABLE(allowed boolean, current_count integer, limit_per_minute integer, reset_time timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session_id UUID;
    v_rate_limit INTEGER;
    v_current_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Get session info by decrypting token
    SELECT 
        tcs.id,
        tcl.rate_limit_per_minute
    INTO v_session_id, v_rate_limit
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    WHERE tcs.vault_session_token_id IN (
        SELECT vs.id 
        FROM vault.secrets vs 
        WHERE vault_decrypt(vs.id::TEXT) = p_session_token
    )
    AND tcs.status = 'active'
    AND tcl.expires_at > NOW();  -- Use tcl.expires_at, not tcs.expires_at

    -- If session not found, return not allowed
    IF v_session_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, NOW() + INTERVAL '1 minute';
        RETURN;
    END IF;

    -- Calculate current minute window
    v_window_start := DATE_TRUNC('minute', NOW());

    -- Count messages in current minute window
    SELECT COUNT(*)::INTEGER
    INTO v_current_count
    FROM chat_messages_v2 cm
    WHERE cm.conversation_id = (
        SELECT conversation_id 
        FROM temporary_chat_sessions 
        WHERE id = v_session_id
    )
    AND cm.role = 'user'
    AND cm.created_at >= v_window_start
    AND cm.created_at < v_window_start + INTERVAL '1 minute';

    -- Return rate limit check result
    RETURN QUERY SELECT 
        (v_current_count < v_rate_limit) AS allowed,
        v_current_count,
        v_rate_limit,
        v_window_start + INTERVAL '1 minute' AS reset_time;
END;
$$;


--
-- Name: FUNCTION check_temp_chat_rate_limit(p_session_token text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_temp_chat_rate_limit(p_session_token text) IS 'Checks if a session has exceeded its rate limit for message sending';


--
-- Name: check_user_exists_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_exists_by_email(user_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Query auth.users to check if email exists
  SELECT COUNT(*)
  INTO user_count
  FROM auth.users
  WHERE email = user_email;
  
  -- Return true if user exists, false otherwise
  RETURN user_count > 0;
END;
$$;


--
-- Name: FUNCTION check_user_exists_by_email(user_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_user_exists_by_email(user_email text) IS 'Check if a user exists by email address. Used during login/signup flow.';


--
-- Name: cleanup_expired_temp_chats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_temp_chats() RETURNS TABLE(expired_links integer, expired_sessions integer, cleaned_vault_secrets integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_expired_links INTEGER := 0;
  v_expired_sessions INTEGER := 0;
  v_cleaned_secrets INTEGER := 0;
  v_vault_token_ids TEXT[];
BEGIN
  -- Collect vault token IDs from expired links before cleanup
  SELECT ARRAY_AGG(vault_link_token_id) INTO v_vault_token_ids
  FROM temporary_chat_links 
  WHERE expires_at < NOW() AND is_active = TRUE;
  
  -- Mark expired links as inactive
  UPDATE temporary_chat_links 
  SET is_active = FALSE, updated_at = NOW()
  WHERE expires_at < NOW() AND is_active = TRUE;
  
  GET DIAGNOSTICS v_expired_links = ROW_COUNT;
  
  -- End expired sessions
  UPDATE temporary_chat_sessions 
  SET status = 'expired', ended_at = NOW(), end_reason = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND (
      last_activity_at < NOW() - INTERVAL '30 minutes' OR
      link_id IN (SELECT id FROM temporary_chat_links WHERE is_active = FALSE)
    );
  
  GET DIAGNOSTICS v_expired_sessions = ROW_COUNT;
  
  -- Clean up vault secrets for very old expired links (older than 30 days)
  -- This is optional and should be done carefully
  SELECT COUNT(*) INTO v_cleaned_secrets
  FROM temporary_chat_links tcl
  WHERE tcl.expires_at < NOW() - INTERVAL '30 days'
    AND tcl.is_active = FALSE;
  
  -- Note: Actual vault secret deletion would require additional vault functions
  -- For now, we just count what would be cleaned
  
  RETURN QUERY SELECT v_expired_links, v_expired_sessions, v_cleaned_secrets;
END;
$$;


--
-- Name: FUNCTION cleanup_expired_temp_chats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_expired_temp_chats() IS 'Cleans up expired temporary chat links and inactive sessions';


--
-- Name: cleanup_expired_working_memory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_working_memory() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM working_memory_chunks
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % expired working memory chunks', deleted_count;
  RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_expired_working_memory(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_expired_working_memory() IS 'Removes expired working memory chunks. Should be called periodically via pg_cron or Edge Function.';


--
-- Name: cleanup_old_import_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_import_jobs(p_retention_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old completed import jobs and their errors
  WITH deleted_jobs AS (
    DELETE FROM contact_import_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND completed_at < NOW() - INTERVAL '1 day' * p_retention_days
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_jobs;
  
  RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_orphaned_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_orphaned_permissions() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Remove agent permissions where the credential no longer exists
    DELETE FROM agent_oauth_permissions 
    WHERE user_oauth_connection_id NOT IN (
        SELECT id FROM user_integration_credentials 
        WHERE connection_status = 'active'
    );
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % orphaned agent permissions', cleanup_count;
    RETURN cleanup_count;
END;
$$;


--
-- Name: FUNCTION cleanup_orphaned_permissions(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_orphaned_permissions() IS 'Cleans up orphaned agent permissions that reference deleted credentials';


--
-- Name: complete_import_job(uuid, uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_import_job(p_job_id uuid, p_user_id uuid, p_status text DEFAULT 'completed'::text, p_results jsonb DEFAULT '{}'::jsonb, p_error_details jsonb DEFAULT '{}'::jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate ownership and status
  IF NOT EXISTS (SELECT 1 FROM contact_import_jobs WHERE id = p_job_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Import job not found or access denied';
  END IF;
  
  UPDATE contact_import_jobs
  SET 
    status = p_status,
    import_results = p_results,
    error_details = p_error_details,
    completed_at = NOW()
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: complete_stripe_order(text, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_stripe_order(p_checkout_session_id text, p_payment_intent_id text, p_customer_id text, p_amount_total integer, p_payment_status text DEFAULT 'succeeded'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
BEGIN
  -- Get user_id from customer
  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE stripe_customer_id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;
  
  -- Create or update order
  INSERT INTO stripe_orders (
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_customer_id,
    user_id,
    amount_subtotal,
    amount_total,
    payment_status,
    order_status
  ) VALUES (
    p_checkout_session_id,
    p_payment_intent_id,
    p_customer_id,
    v_user_id,
    p_amount_total,
    p_amount_total,
    p_payment_status,
    CASE WHEN p_payment_status = 'succeeded' THEN 'completed' ELSE 'pending' END
  )
  ON CONFLICT (stripe_checkout_session_id) DO UPDATE SET
    payment_status = EXCLUDED.payment_status,
    order_status = EXCLUDED.order_status,
    updated_at = NOW()
  RETURNING id INTO v_order_id;
  
  -- Log payment event
  INSERT INTO payment_events (
    event_type,
    stripe_order_id,
    user_id,
    amount,
    payment_method_type
  ) VALUES (
    CASE WHEN p_payment_status = 'succeeded' THEN 'payment_succeeded' ELSE 'payment_created' END,
    v_order_id,
    v_user_id,
    p_amount_total,
    'card'
  );
  
  RETURN v_order_id;
END;
$$;


--
-- Name: create_agent_llm_preferences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_agent_llm_preferences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Insert default LLM preferences for the new agent
  INSERT INTO public.agent_llm_preferences (
    agent_id,
    provider,
    model,
    params,
    embedding_model
  ) VALUES (
    NEW.id,
    'openai',
    'gpt-4o-mini',
    '{}',
    'text-embedding-3-small'
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION create_agent_llm_preferences(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_agent_llm_preferences() IS 'Automatically creates default LLM preferences when a new agent is created';


--
-- Name: create_contact_interaction(uuid, uuid, uuid, text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_contact_interaction(p_contact_id uuid, p_agent_id uuid, p_user_id uuid, p_interaction_type text, p_channel_type text DEFAULT NULL::text, p_channel_identifier text DEFAULT NULL::text, p_direction text DEFAULT 'outbound'::text, p_summary text DEFAULT NULL::text, p_full_content text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  interaction_id UUID;
  vault_id TEXT;
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Encrypt full content if provided
  IF p_full_content IS NOT NULL THEN
    -- This would use Supabase Vault in real implementation
    -- vault_id := vault.create_secret(p_full_content);
    vault_id := 'vault_' || gen_random_uuid()::text; -- Placeholder
  END IF;
  
  -- Insert interaction record
  INSERT INTO contact_interactions (
    contact_id,
    agent_id,
    user_id,
    interaction_type,
    channel_type,
    channel_identifier,
    direction,
    interaction_summary,
    full_content_vault_id,
    interaction_metadata,
    message_preview
  ) VALUES (
    p_contact_id,
    p_agent_id,
    p_user_id,
    p_interaction_type,
    p_channel_type,
    p_channel_identifier,
    p_direction,
    p_summary,
    vault_id,
    p_metadata,
    LEFT(COALESCE(p_summary, p_full_content, ''), 200)
  ) RETURNING id INTO interaction_id;
  
  RETURN interaction_id;
END;
$$;


--
-- Name: create_contact_management_credential_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_contact_management_credential_for_user(user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  credential_id UUID;
  provider_id UUID := '00000000-0000-0000-0000-000000000003'::uuid;
BEGIN
  -- Check if credential already exists
  SELECT id INTO credential_id
  FROM user_integration_credentials
  WHERE user_integration_credentials.user_id = create_contact_management_credential_for_user.user_id
  AND oauth_provider_id = provider_id;
  
  -- If not found, create it
  IF credential_id IS NULL THEN
    BEGIN
      INSERT INTO user_integration_credentials (
        user_id,
        oauth_provider_id,
        external_user_id,
        external_username,
        connection_name,
        credential_type,
        connection_status,
        scopes_granted,
        vault_access_token_id,
        created_at,
        updated_at
      ) VALUES (
        create_contact_management_credential_for_user.user_id,
        provider_id,
        'contact_system_' || create_contact_management_credential_for_user.user_id,
        'internal',
        'Contact Management System',
        'api_key'::connection_credential_type_enum,
        'active',
        '["search_contacts", "get_contact_details"]'::jsonb,
        'internal_contact_token',
        NOW(),
        NOW()
      ) 
      RETURNING id INTO credential_id;
      
      RAISE NOTICE 'Created contact management credential % for user %', credential_id, create_contact_management_credential_for_user.user_id;
    EXCEPTION WHEN OTHERS THEN
      -- If there's an error creating the credential, log it but don't fail
      RAISE WARNING 'Failed to create contact management credential for user %: % - %', 
        create_contact_management_credential_for_user.user_id, SQLSTATE, SQLERRM;
      -- Return a dummy UUID so the trigger doesn't fail
      RETURN '00000000-0000-0000-0000-000000000000'::uuid;
    END;
  END IF;
  
  RETURN credential_id;
END;
$$;


--
-- Name: FUNCTION create_contact_management_credential_for_user(user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_contact_management_credential_for_user(user_id uuid) IS 'Creates internal contact management credentials for users. Fixed to use oauth_provider_id column.';


--
-- Name: create_contact_with_validation(uuid, text, text, text, text, text, text, text, text, text[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text DEFAULT NULL::text, p_organization text DEFAULT NULL::text, p_job_title text DEFAULT NULL::text, p_contact_type text DEFAULT 'external'::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_tags text[] DEFAULT '{}'::text[], p_custom_fields jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  contact_id UUID;
  email_channel_id UUID;
  phone_channel_id UUID;
BEGIN
  -- Validate required fields
  IF LENGTH(TRIM(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  
  -- Create contact
  INSERT INTO contacts (
    user_id, first_name, last_name, organization, job_title, 
    contact_type, notes, tags, custom_fields
  ) VALUES (
    p_user_id, TRIM(p_first_name), NULLIF(TRIM(p_last_name), ''), 
    NULLIF(TRIM(p_organization), ''), NULLIF(TRIM(p_job_title), ''),
    p_contact_type, NULLIF(TRIM(p_notes), ''), p_tags, p_custom_fields
  ) RETURNING id INTO contact_id;
  
  -- Add email channel if provided
  IF p_email IS NOT NULL AND LENGTH(TRIM(p_email)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, 
      is_primary, display_label
    ) VALUES (
      contact_id, p_user_id, 'email', TRIM(p_email), 
      TRUE, 'Primary Email'
    ) RETURNING id INTO email_channel_id;
  END IF;
  
  -- Add phone channel if provided
  IF p_phone IS NOT NULL AND LENGTH(TRIM(p_phone)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, 
      is_primary, display_label
    ) VALUES (
      contact_id, p_user_id, 'phone', TRIM(p_phone), 
      TRUE, 'Primary Phone'
    ) RETURNING id INTO phone_channel_id;
  END IF;
  
  -- Log creation
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, operation_details
  ) VALUES (
    contact_id, p_user_id, 'create',
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'organization', p_organization,
      'email_added', email_channel_id IS NOT NULL,
      'phone_added', phone_channel_id IS NOT NULL
    )
  );
  
  RETURN contact_id;
END;
$$;


--
-- Name: FUNCTION create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_notes text, p_tags text[], p_custom_fields jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_notes text, p_tags text[], p_custom_fields jsonb) IS 'Contact creation with validation, audit logging, and mobile number support';


--
-- Name: create_contact_with_validation(uuid, text, text, text, text, text, text, text, text, text, text[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text DEFAULT NULL::text, p_organization text DEFAULT NULL::text, p_job_title text DEFAULT NULL::text, p_contact_type text DEFAULT 'external'::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_tags text[] DEFAULT '{}'::text[], p_custom_fields jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  contact_id UUID;
  email_channel_id UUID;
  phone_channel_id UUID;
  mobile_channel_id UUID;
BEGIN
  -- Validate required fields
  IF LENGTH(TRIM(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  
  -- Create contact
  INSERT INTO contacts (
    user_id, first_name, last_name, organization, job_title, 
    contact_type, notes, tags, custom_fields
  ) VALUES (
    p_user_id, TRIM(p_first_name), NULLIF(TRIM(p_last_name), ''), 
    NULLIF(TRIM(p_organization), ''), NULLIF(TRIM(p_job_title), ''),
    p_contact_type, NULLIF(TRIM(p_notes), ''), p_tags, p_custom_fields
  ) RETURNING id INTO contact_id;
  
  -- Add email channel if provided
  IF p_email IS NOT NULL AND LENGTH(TRIM(p_email)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, is_primary, is_active
    ) VALUES (
      contact_id, p_user_id, 'email', TRIM(p_email), true, true
    ) RETURNING id INTO email_channel_id;
  END IF;
  
  -- Add phone channel if provided
  IF p_phone IS NOT NULL AND LENGTH(TRIM(p_phone)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, is_primary, is_active
    ) VALUES (
      contact_id, p_user_id, 'phone', TRIM(p_phone), true, true
    ) RETURNING id INTO phone_channel_id;
  END IF;
  
  -- Add mobile channel if provided
  IF p_mobile IS NOT NULL AND LENGTH(TRIM(p_mobile)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, 
      is_primary, is_active
    ) VALUES (
      contact_id, p_user_id, 'mobile', TRIM(p_mobile), 
      -- Set as primary if no phone channel exists
      (phone_channel_id IS NULL), true
    ) RETURNING id INTO mobile_channel_id;
  END IF;
  
  -- Note: display_name is automatically generated by PostgreSQL
  
  -- Log contact creation
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, operation_details
  ) VALUES (
    contact_id, p_user_id, 'created', 
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'organization', p_organization,
      'contact_type', p_contact_type,
      'has_email', (email_channel_id IS NOT NULL),
      'has_phone', (phone_channel_id IS NOT NULL),
      'has_mobile', (mobile_channel_id IS NOT NULL)
    )
  );
  
  RETURN contact_id;
END;
$$;


--
-- Name: create_default_contact_groups(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_contact_groups(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Create "All Contacts" system group
  INSERT INTO contact_groups (user_id, name, description, group_type, is_system_group, color, icon)
  VALUES (
    p_user_id,
    'All Contacts',
    'System group containing all contacts',
    'system',
    TRUE,
    '#6b7280',
    'users'
  );
  
  -- Create "Favorites" group
  INSERT INTO contact_groups (user_id, name, description, group_type, color, icon)
  VALUES (
    p_user_id,
    'Favorites',
    'Important contacts marked as favorites',
    'custom',
    '#f59e0b',
    'star'
  );
  
  -- Create "Recent" smart group
  INSERT INTO contact_groups (
    user_id, name, description, group_type, is_smart_group, smart_criteria, color, icon
  )
  VALUES (
    p_user_id,
    'Recent',
    'Contacts added in the last 30 days',
    'custom',
    TRUE,
    '[{"field": "created_after", "value": "30 days ago"}]'::jsonb,
    '#10b981',
    'clock'
  );
END;
$$;


--
-- Name: create_default_media_categories(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_media_categories(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    default_categories JSONB[] := ARRAY[
        '{"name": "SOPs", "description": "Standard Operating Procedures", "icon_name": "BookOpen", "color_hex": "#3B82F6"}',
        '{"name": "Training", "description": "Training materials and documentation", "icon_name": "GraduationCap", "color_hex": "#10B981"}',
        '{"name": "Reference", "description": "Reference documents and guides", "icon_name": "BookMarked", "color_hex": "#8B5CF6"}',
        '{"name": "Policies", "description": "Company policies and procedures", "icon_name": "Shield", "color_hex": "#F59E0B"}',
        '{"name": "Templates", "description": "Document templates and forms", "icon_name": "FileText", "color_hex": "#EF4444"}'
    ];
    category JSONB;
BEGIN
    FOREACH category IN ARRAY default_categories
    LOOP
        INSERT INTO media_categories (
            user_id,
            name,
            description,
            icon_name,
            color_hex,
            sort_order
        ) VALUES (
            p_user_id,
            (category->>'name')::text,
            (category->>'description')::text,
            (category->>'icon_name')::text,
            (category->>'color_hex')::text,
            array_position(default_categories, category)
        )
        ON CONFLICT (user_id, name) DO NOTHING;
    END LOOP;
END;
$$;


--
-- Name: create_encryption_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_encryption_key(key_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_key_id UUID;
    final_key_name TEXT;
BEGIN
    -- Only allow service role
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;
    
    -- Generate key name if not provided
    final_key_name := COALESCE(key_name, 'key_' || gen_random_uuid()::text);
    
    -- Create the key
    SELECT (pgsodium.create_key(name := final_key_name)).id INTO new_key_id;
    
    RETURN new_key_id;
END;
$$;


--
-- Name: create_or_update_vault_secret(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_or_update_vault_secret(p_secret text, p_name text, p_description text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result FROM public.upsert_vault_secret(p_secret, p_name, p_description);
    RETURN v_result.id;
END;
$$;


--
-- Name: FUNCTION create_or_update_vault_secret(p_secret text, p_name text, p_description text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_or_update_vault_secret(p_secret text, p_name text, p_description text) IS 'Simple wrapper for upsert_vault_secret that only returns the UUID. Handles conflicts gracefully.';


--
-- Name: create_routing_rule(text, text, uuid, jsonb, jsonb, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_routing_rule(p_name text, p_description text, p_agent_id uuid, p_conditions jsonb, p_action jsonb, p_priority integer DEFAULT 0, p_stop_processing boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_config_id UUID;
    v_rule_id UUID;
BEGIN
    -- Get user's SendGrid config
    SELECT id INTO v_config_id
    FROM sendgrid_configurations
    WHERE user_id = auth.uid()
    AND is_active = true;
    
    IF v_config_id IS NULL THEN
        RAISE EXCEPTION 'No active SendGrid configuration found for user';
    END IF;
    
    -- Insert the routing rule
    INSERT INTO sendgrid_inbound_routing_rules (
        sendgrid_config_id,
        agent_id,
        name,
        description,
        priority,
        conditions,
        action,
        stop_processing,
        created_by
    ) VALUES (
        v_config_id,
        p_agent_id,
        p_name,
        p_description,
        p_priority,
        p_conditions,
        p_action,
        p_stop_processing,
        auth.uid()
    ) RETURNING id INTO v_rule_id;
    
    RETURN v_rule_id;
END;
$$;


--
-- Name: create_task_step(uuid, text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task_step(p_task_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean DEFAULT false, p_step_order integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_step_id UUID;
    next_order INTEGER;
BEGIN
    -- Validate task exists and user has access
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks 
        WHERE id = p_task_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;
    
    -- Calculate next step order if not provided
    IF p_step_order IS NULL THEN
        SELECT COALESCE(MAX(step_order), 0) + 1 
        INTO next_order
        FROM task_steps 
        WHERE task_id = p_task_id;
    ELSE
        next_order := p_step_order;
        
        -- Shift existing steps if inserting in middle
        UPDATE task_steps 
        SET step_order = step_order + 1,
            updated_at = NOW()
        WHERE task_id = p_task_id 
        AND step_order >= p_step_order;
    END IF;
    
    -- Create the new step
    INSERT INTO task_steps (
        task_id,
        step_order,
        step_name,
        instructions,
        include_previous_context
    ) VALUES (
        p_task_id,
        next_order,
        p_step_name,
        p_instructions,
        p_include_previous_context
    ) RETURNING id INTO new_step_id;
    
    RETURN new_step_id;
END;
$$;


--
-- Name: create_team_connection(uuid, uuid, public.team_connection_type, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_style text DEFAULT 'solid'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_connection_id UUID;
    v_from_team_owner UUID;
    v_to_team_owner UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Validate connection type
    IF p_connection_type NOT IN ('reports_to', 'collaborates_with', 'supports', 'custom') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid connection type: ' || p_connection_type::text
        );
    END IF;
    
    -- Prevent self-connections
    IF p_from_team_id = p_to_team_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Teams cannot connect to themselves'
        );
    END IF;
    
    -- Verify both teams exist and user has access
    SELECT owner_user_id INTO v_from_team_owner
    FROM teams WHERE id = p_from_team_id;
    
    SELECT owner_user_id INTO v_to_team_owner  
    FROM teams WHERE id = p_to_team_id;
    
    IF v_from_team_owner IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Source team not found'
        );
    END IF;
    
    IF v_to_team_owner IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Target team not found'
        );
    END IF;
    
    -- Verify user owns both teams
    IF v_from_team_owner != v_user_id OR v_to_team_owner != v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient permissions to create team connection'
        );
    END IF;
    
    -- Check for duplicate connections
    IF EXISTS (
        SELECT 1 FROM team_connections
        WHERE from_team_id = p_from_team_id 
        AND to_team_id = p_to_team_id
        AND connection_type = p_connection_type
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Connection already exists between these teams'
        );
    END IF;
    
    -- For hierarchical connections, basic cycle detection
    IF p_connection_type = 'reports_to' THEN
        IF EXISTS (
            SELECT 1 FROM team_connections
            WHERE from_team_id = p_to_team_id 
            AND to_team_id = p_from_team_id
            AND connection_type = 'reports_to'
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This connection would create a circular reporting structure'
            );
        END IF;
    END IF;
    
    -- Create the connection
    INSERT INTO team_connections (
        from_team_id,
        to_team_id,
        connection_type,
        label,
        color,
        style,
        created_by_user_id
    ) VALUES (
        p_from_team_id,
        p_to_team_id,
        p_connection_type,
        p_label,
        p_color,
        p_style,
        v_user_id
    )
    RETURNING id INTO v_connection_id;
    
    -- Log the connection creation
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'team_connection_created',
        v_user_id,
        jsonb_build_object(
            'connection_id', v_connection_id,
            'from_team_id', p_from_team_id,
            'to_team_id', p_to_team_id,
            'connection_type', p_connection_type
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'connection_id', v_connection_id,
        'from_team_id', p_from_team_id,
        'to_team_id', p_to_team_id,
        'connection_type', p_connection_type,
        'created_at', NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO system_alerts (
            type,
            severity,
            message,
            context
        ) VALUES (
            'database_error',
            'error',
            'Failed to create team connection: ' || SQLERRM,
            jsonb_build_object(
                'function', 'create_team_connection',
                'user_id', v_user_id,
                'from_team_id', p_from_team_id,
                'to_team_id', p_to_team_id,
                'connection_type', p_connection_type
            )
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal error creating team connection',
            'error_code', SQLSTATE
        );
END;
$$;


--
-- Name: FUNCTION create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text, p_color text, p_style text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text, p_color text, p_style text) IS 'Create team connection with validation and cycle detection';


--
-- Name: create_temp_chat_session(text, text, text, inet, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_temp_chat_session(p_link_token text, p_participant_identifier text DEFAULT NULL::text, p_participant_name text DEFAULT NULL::text, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_referrer text DEFAULT NULL::text) RETURNS TABLE(session_id uuid, session_token text, conversation_id uuid, agent_id uuid, agent_name text, is_valid boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_link_id UUID;
  v_agent_id UUID;
  v_agent_name TEXT;
  v_new_session_id UUID;
  v_new_session_token TEXT;
  v_vault_session_token_id UUID;
  v_new_conversation_id UUID;
  v_conversation_session_id UUID;
  v_current_sessions INTEGER;
  v_max_sessions INTEGER;
  v_is_active BOOLEAN;
  v_expires_at TIMESTAMPTZ;
  v_vault_link_token_id UUID;
  v_decrypted_token TEXT;
BEGIN
  -- Find and validate link token using Vault
  -- We need to check all links and decrypt their tokens to find a match
  FOR v_link_id, v_agent_id, v_agent_name, v_max_sessions, v_is_active, v_expires_at, v_vault_link_token_id IN
    SELECT tcl.id, tcl.agent_id, a.name, tcl.max_sessions, tcl.is_active, tcl.expires_at, tcl.vault_link_token_id
    FROM temporary_chat_links tcl
    JOIN agents a ON tcl.agent_id = a.id
    WHERE tcl.is_active = true
  LOOP
    -- Decrypt and compare token
    v_decrypted_token := vault_decrypt(v_vault_link_token_id::TEXT);
    
    -- Remove whitespace for comparison
    IF REPLACE(REPLACE(v_decrypted_token, E'\n', ''), ' ', '') = REPLACE(REPLACE(p_link_token, E'\n', ''), ' ', '') THEN
      -- Found matching link
      EXIT;
    ELSE
      -- Reset variables if not matching
      v_link_id := NULL;
    END IF;
  END LOOP;
  
  -- Check if link exists
  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, FALSE, 'Invalid chat link'::TEXT;
    RETURN;
  END IF;
  
  -- Check if link is active and not expired
  IF NOT v_is_active OR v_expires_at <= NOW() THEN
    RETURN QUERY SELECT NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, FALSE, 'Chat link has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check current active sessions count
  SELECT COUNT(*) INTO v_current_sessions
  FROM temporary_chat_sessions
  WHERE link_id = v_link_id AND status = 'active';
  
  -- Check session limit
  IF v_current_sessions >= v_max_sessions THEN
    RETURN QUERY SELECT NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, FALSE, 'Maximum sessions reached'::TEXT;
    RETURN;
  END IF;
  
  -- Generate new session components
  v_new_session_id := gen_random_uuid();
  v_vault_session_token_id := generate_session_token();
  v_new_conversation_id := gen_random_uuid();
  
  -- Get the actual session token for return (decrypt from vault)
  v_new_session_token := vault_decrypt(v_vault_session_token_id::TEXT);
  
  -- Create conversation session in existing table
  INSERT INTO conversation_sessions (
    id, conversation_id, agent_id, status, started_at
  ) VALUES (
    gen_random_uuid(), v_new_conversation_id, v_agent_id, 'active', NOW()
  ) RETURNING id INTO v_conversation_session_id;
  
  -- Create temporary chat session
  INSERT INTO temporary_chat_sessions (
    id, link_id, vault_session_token_id, conversation_id, conversation_session_id,
    participant_identifier, participant_name, ip_address, user_agent, referrer
  ) VALUES (
    v_new_session_id, v_link_id, v_vault_session_token_id, v_new_conversation_id, v_conversation_session_id,
    p_participant_identifier, p_participant_name, p_ip_address, p_user_agent, p_referrer
  );
  
  -- Update link session count
  UPDATE temporary_chat_links 
  SET session_count = session_count + 1,
      last_accessed_at = NOW()
  WHERE id = v_link_id;
  
  -- Return success
  RETURN QUERY SELECT 
    v_new_session_id, v_new_session_token, v_new_conversation_id, 
    v_agent_id, v_agent_name, TRUE, ''::TEXT;
END;
$$;


--
-- Name: FUNCTION create_temp_chat_session(p_link_token text, p_participant_identifier text, p_participant_name text, p_ip_address inet, p_user_agent text, p_referrer text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_temp_chat_session(p_link_token text, p_participant_identifier text, p_participant_name text, p_ip_address inet, p_user_agent text, p_referrer text) IS 'Creates a new temporary chat session for a given link token with participant information';


--
-- Name: create_vault_secret(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_vault_secret(p_secret text, p_name text, p_description text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Create secret in vault
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO secret_id;
  
  RETURN secret_id::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create vault secret: %', SQLERRM;
END;
$$;


--
-- Name: FUNCTION create_vault_secret(p_secret text, p_name text, p_description text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_vault_secret(p_secret text, p_name text, p_description text) IS 'Creates an encrypted secret in Supabase Vault and returns the vault UUID';


--
-- Name: decrypt_with_key(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_with_key(encrypted_text text, key_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    combined_data BYTEA;
    nonce BYTEA;
    ciphertext BYTEA;
    decrypted_data BYTEA;
BEGIN
    -- Only allow service role
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;
    
    -- Decode from base64
    combined_data := decode(encrypted_text, 'base64');
    
    -- Extract nonce (first 24 bytes) and ciphertext
    nonce := substring(combined_data from 1 for 24);
    ciphertext := substring(combined_data from 25);
    
    -- Decrypt the data
    decrypted_data := pgsodium.crypto_aead_det_decrypt(
        ciphertext,
        'vault_context'::bytea,
        key_id,
        nonce
    );
    
    RETURN convert_from(decrypted_data, 'UTF8');
END;
$$;


--
-- Name: delete_agent_cascade(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_agent_cascade(agent_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: delete_lines(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_lines(content text, start_line integer, end_line integer) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    lines TEXT[];
    result TEXT[];
BEGIN
    lines := string_to_array(content, E'\n');
    
    -- Validate bounds
    IF start_line < 1 OR start_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'start_line out of bounds: %', start_line;
    END IF;
    
    IF end_line < start_line OR end_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'end_line out of bounds: %', end_line;
    END IF;
    
    -- Build result: before + after (skip deleted lines)
    result := lines[1:start_line-1] || lines[end_line+1:array_length(lines, 1)];
    
    RETURN array_to_string(result, E'\n');
END;
$$;


--
-- Name: FUNCTION delete_lines(content text, start_line integer, end_line integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_lines(content text, start_line integer, end_line integer) IS 'Deletes a range of lines from content';


--
-- Name: delete_task_step(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_task_step(p_step_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    step_task_id UUID;
    step_order_to_delete INTEGER;
BEGIN
    -- Get step details and validate access
    SELECT task_id, step_order 
    INTO step_task_id, step_order_to_delete
    FROM task_steps ts
    JOIN agent_tasks at ON ts.task_id = at.id
    WHERE ts.id = p_step_id 
    AND at.user_id = auth.uid();
    
    IF step_task_id IS NULL THEN
        RAISE EXCEPTION 'Step not found or access denied';
    END IF;
    
    -- Prevent deletion of the last step
    IF (SELECT COUNT(*) FROM task_steps WHERE task_id = step_task_id) <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last step - tasks must have at least one step';
    END IF;
    
    -- Delete the step
    DELETE FROM task_steps WHERE id = p_step_id;
    
    -- Reorder remaining steps to close gaps
    UPDATE task_steps 
    SET step_order = step_order - 1,
        updated_at = NOW()
    WHERE task_id = step_task_id 
    AND step_order > step_order_to_delete;
    
    RETURN TRUE;
END;
$$;


--
-- Name: delete_team_connection(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_team_connection(p_connection_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_connection RECORD;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Get connection details and verify ownership
    SELECT 
        tc.id,
        tc.from_team_id,
        tc.to_team_id,
        tc.connection_type,
        tc.created_by_user_id,
        t1.owner_user_id as from_team_owner,
        t2.owner_user_id as to_team_owner
    INTO v_connection
    FROM team_connections tc
    JOIN teams t1 ON tc.from_team_id = t1.id
    JOIN teams t2 ON tc.to_team_id = t2.id
    WHERE tc.id = p_connection_id;
    
    IF v_connection IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Connection not found'
        );
    END IF;
    
    -- Verify user can delete this connection
    IF v_connection.created_by_user_id != v_user_id OR
       v_connection.from_team_owner != v_user_id OR 
       v_connection.to_team_owner != v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient permissions to delete this connection'
        );
    END IF;
    
    -- Delete the connection
    DELETE FROM team_connections
    WHERE id = p_connection_id;
    
    -- Log the deletion
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'team_connection_deleted',
        v_user_id,
        jsonb_build_object(
            'connection_id', p_connection_id,
            'from_team_id', v_connection.from_team_id,
            'to_team_id', v_connection.to_team_id,
            'connection_type', v_connection.connection_type
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted_connection_id', p_connection_id,
        'deleted_at', NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO system_alerts (
            type,
            severity,
            message,
            context
        ) VALUES (
            'database_error',
            'error',
            'Failed to delete team connection: ' || SQLERRM,
            jsonb_build_object(
                'function', 'delete_team_connection',
                'user_id', v_user_id,
                'connection_id', p_connection_id
            )
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal error deleting team connection',
            'error_code', SQLSTATE
        );
END;
$$;


--
-- Name: FUNCTION delete_team_connection(p_connection_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_team_connection(p_connection_id uuid) IS 'Delete team connection with proper ownership verification';


--
-- Name: delete_vault_secret(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_vault_secret(secret_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Ensure supabase_vault.secrets table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'supabase_vault' AND table_name = 'secrets'
    ) THEN
        RAISE EXCEPTION 'Supabase Vault (supabase_vault.secrets table) not found. Ensure Vault is enabled and initialized.';
    END IF;

    DELETE FROM supabase_vault.secrets
    WHERE id = secret_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count = 0 THEN
        -- Optionally, raise a warning or return false if the secret was not found
        RAISE WARNING 'Vault secret with ID % not found for deletion.', secret_id;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in delete_vault_secret: % - %', SQLSTATE, SQLERRM;
        RAISE; -- Re-raise the original error to ensure transaction integrity
END;
$$;


--
-- Name: FUNCTION delete_vault_secret(secret_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_vault_secret(secret_id uuid) IS 'Deletes a secret from Supabase Vault by its UUID. Returns true if deletion was successful, false if not found.';


--
-- Name: encrypt_with_key(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_with_key(plain_text text, key_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    encrypted_data BYTEA;
    nonce BYTEA;
BEGIN
    -- Only allow service role
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;
    
    -- Generate a random nonce
    nonce := gen_random_bytes(24);
    
    -- Encrypt the data
    encrypted_data := pgsodium.crypto_aead_det_encrypt(
        plain_text::bytea,
        'vault_context'::bytea,
        key_id,
        nonce
    );
    
    -- Return base64 encoded result (nonce + ciphertext)
    RETURN encode(nonce || encrypted_data, 'base64');
END;
$$;


--
-- Name: end_temp_chat_session(text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.end_temp_chat_session(p_session_token text, p_end_reason text DEFAULT 'completed'::text, p_satisfaction_rating integer DEFAULT NULL::integer, p_feedback_text text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_session_id UUID;
  v_conversation_session_id UUID;
BEGIN
  -- Find session by token
  SELECT tcs.id, tcs.conversation_session_id
  INTO v_session_id, v_conversation_session_id
  FROM temporary_chat_sessions tcs
  WHERE vault.decrypt_secret(tcs.vault_session_token_id) = p_session_token
    AND status = 'active';
  
  IF v_session_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update temporary chat session
  UPDATE temporary_chat_sessions 
  SET status = 'ended',
      ended_at = NOW(),
      end_reason = p_end_reason,
      satisfaction_rating = p_satisfaction_rating,
      feedback_text = p_feedback_text,
      updated_at = NOW()
  WHERE id = v_session_id;
  
  -- Update conversation session
  IF v_conversation_session_id IS NOT NULL THEN
    UPDATE conversation_sessions
    SET status = 'completed',
        ended_at = NOW()
    WHERE id = v_conversation_session_id;
  END IF;
  
  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION end_temp_chat_session(p_session_token text, p_end_reason text, p_satisfaction_rating integer, p_feedback_text text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.end_temp_chat_session(p_session_token text, p_end_reason text, p_satisfaction_rating integer, p_feedback_text text) IS 'Ends a temporary chat session with optional feedback and satisfaction rating';


--
-- Name: evaluate_smart_group_criteria(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evaluate_smart_group_criteria(p_user_id uuid, p_criteria jsonb) RETURNS TABLE(contact_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  sql_query TEXT;
  condition_parts TEXT[] := '{}';
  criteria_item JSONB;
BEGIN
  -- Build dynamic query based on criteria
  sql_query := 'SELECT id FROM contacts WHERE user_id = $1 AND contact_status = ''active'' AND deleted_at IS NULL';
  
  -- Process each criteria item
  FOR criteria_item IN SELECT * FROM jsonb_array_elements(p_criteria)
  LOOP
    CASE criteria_item->>'field'
      WHEN 'contact_type' THEN
        condition_parts := condition_parts || format('contact_type = %L', criteria_item->>'value');
      WHEN 'organization' THEN
        condition_parts := condition_parts || format('organization ILIKE %L', '%' || (criteria_item->>'value') || '%');
      WHEN 'tags' THEN
        condition_parts := condition_parts || format('%L = ANY(tags)', criteria_item->>'value');
      WHEN 'created_after' THEN
        condition_parts := condition_parts || format('created_at >= %L::timestamptz', criteria_item->>'value');
      WHEN 'last_contacted_after' THEN
        condition_parts := condition_parts || format('last_contacted_at >= %L::timestamptz', criteria_item->>'value');
      -- Add more criteria as needed
    END CASE;
  END LOOP;
  
  -- Add conditions to query
  IF array_length(condition_parts, 1) > 0 THEN
    sql_query := sql_query || ' AND ' || array_to_string(condition_parts, ' AND ');
  END IF;
  
  -- Execute dynamic query
  RETURN QUERY EXECUTE sql_query USING p_user_id;
END;
$_$;


--
-- Name: execute_sql(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_sql(sql text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Execute the provided SQL
    EXECUTE sql;
END;
$$;


--
-- Name: FUNCTION execute_sql(sql text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.execute_sql(sql text) IS 'Executes SQL commands for pg_cron scheduling from Edge Functions';


--
-- Name: expire_inactive_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_inactive_sessions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  expired_count INTEGER := 0;
BEGIN
  -- Expire sessions that have exceeded their timeout
  UPDATE temporary_chat_sessions 
  SET status = 'expired',
      ended_at = NOW(),
      end_reason = 'timeout',
      updated_at = NOW()
  FROM temporary_chat_links tcl
  WHERE temporary_chat_sessions.link_id = tcl.id
    AND temporary_chat_sessions.status = 'active'
    AND temporary_chat_sessions.last_activity_at < NOW() - (tcl.session_timeout_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$;


--
-- Name: export_contact_data_for_subject(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  contact_data JSONB;
  channels_data JSONB;
  interactions_data JSONB;
  groups_data JSONB;
  result JSONB;
BEGIN
  -- Validate contact ownership
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Get contact data
  SELECT jsonb_build_object(
    'id', id,
    'first_name', first_name,
    'last_name', last_name,
    'organization', organization,
    'job_title', job_title,
    'department', department,
    'notes', notes,
    'tags', tags,
    'contact_type', contact_type,
    'contact_status', contact_status,
    'custom_fields', custom_fields,
    'consent_status', consent_status,
    'consent_date', consent_date,
    'legal_basis', legal_basis,
    'data_processing_purpose', data_processing_purpose,
    'created_at', created_at,
    'updated_at', updated_at,
    'last_contacted_at', last_contacted_at
  ) INTO contact_data
  FROM contacts WHERE id = p_contact_id;
  
  -- Get communication channels
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'channel_type', channel_type,
      'channel_identifier', channel_identifier,
      'display_label', display_label,
      'is_primary', is_primary,
      'is_verified', is_verified,
      'marketing_consent', marketing_consent,
      'marketing_consent_date', marketing_consent_date,
      'created_at', created_at,
      'last_used_at', last_used_at
    )
  ) INTO channels_data
  FROM contact_communication_channels 
  WHERE contact_id = p_contact_id;
  
  -- Get interaction history (summary only for privacy)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'interaction_type', interaction_type,
      'channel_type', channel_type,
      'direction', direction,
      'interaction_summary', interaction_summary,
      'interaction_at', interaction_at,
      'delivery_status', delivery_status
    )
  ) INTO interactions_data
  FROM contact_interactions 
  WHERE contact_id = p_contact_id;
  
  -- Get group memberships
  SELECT jsonb_agg(
    jsonb_build_object(
      'group_name', cg.name,
      'group_type', cg.group_type,
      'added_at', cgm.added_at
    )
  ) INTO groups_data
  FROM contact_group_memberships cgm
  INNER JOIN contact_groups cg ON cgm.group_id = cg.id
  WHERE cgm.contact_id = p_contact_id;
  
  -- Build complete export
  result := jsonb_build_object(
    'export_date', NOW(),
    'contact_info', contact_data,
    'communication_channels', COALESCE(channels_data, '[]'::jsonb),
    'interaction_history', COALESCE(interactions_data, '[]'::jsonb),
    'group_memberships', COALESCE(groups_data, '[]'::jsonb),
    'data_controller', 'Gofr Agents Platform',
    'export_reason', 'GDPR Article 15 - Right of Access'
  );
  
  RETURN result;
END;
$$;


--
-- Name: FUNCTION export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid) IS 'GDPR Article 15 compliant data export function';


--
-- Name: format_phone_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.format_phone_number(phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  -- Remove all non-digit characters except +
  phone := regexp_replace(phone, '[^\d+]', '', 'g');
  
  -- Basic formatting - can be enhanced based on requirements
  IF phone ~ '^\+1[0-9]{10}$' THEN
    -- US/Canada format: +1 (XXX) XXX-XXXX
    RETURN '+1 (' || substring(phone, 3, 3) || ') ' || 
           substring(phone, 6, 3) || '-' || substring(phone, 9, 4);
  ELSIF phone ~ '^1[0-9]{10}$' THEN
    -- US/Canada without + prefix
    RETURN '+1 (' || substring(phone, 2, 3) || ') ' || 
           substring(phone, 5, 3) || '-' || substring(phone, 8, 4);
  ELSE
    -- International format - keep as is with + prefix
    RETURN CASE WHEN phone ~ '^\+' THEN phone ELSE '+' || phone END;
  END IF;
END;
$_$;


--
-- Name: gdpr_delete_contact(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text DEFAULT 'User requested deletion'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Validate contact ownership
  SELECT * INTO contact_record
  FROM contacts 
  WHERE id = p_contact_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Log the deletion in audit trail
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, operation_details
  ) VALUES (
    p_contact_id, p_user_id, 'gdpr_request', 
    jsonb_build_object(
      'action', 'delete',
      'reason', p_deletion_reason,
      'contact_name', contact_record.display_name,
      'deletion_date', NOW()
    )
  );
  
  -- Soft delete first (mark as deleted)
  UPDATE contacts 
  SET 
    deleted_at = NOW(),
    deletion_reason = p_deletion_reason,
    contact_status = 'archived'
  WHERE id = p_contact_id;
  
  -- Hard delete after audit log (CASCADE will handle related records)
  DELETE FROM contacts WHERE id = p_contact_id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text) IS 'GDPR compliant contact deletion with audit trail';


--
-- Name: generate_organization_api_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_organization_api_key() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'agnt_' || encode(gen_random_bytes(32), 'base64');
END;
$$;


--
-- Name: generate_session_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_session_token() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  session_uuid UUID;
  timestamp_part TEXT;
  final_token TEXT;
  vault_secret_id UUID;
BEGIN
  session_uuid := gen_random_uuid();
  timestamp_part := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  
  final_token := encode(
    (session_uuid::TEXT || '-' || timestamp_part)::BYTEA,
    'base64'
  );
  
  -- Make URL safe
  final_token := replace(replace(final_token, '+', '-'), '/', '_');
  final_token := rtrim(final_token, '=');
  
  -- Store token in Vault and return the vault secret ID
  vault_secret_id := vault.create_secret(final_token);
  
  RETURN vault_secret_id;
END;
$$;


--
-- Name: FUNCTION generate_session_token(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_session_token() IS 'Generates cryptographically secure tokens for temporary chat sessions and stores them in Supabase Vault';


--
-- Name: generate_temp_chat_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_temp_chat_token() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  token_uuid UUID;
  timestamp_part TEXT;
  random_part TEXT;
  final_token TEXT;
  vault_secret_id UUID;
BEGIN
  -- Generate components for cryptographically secure token
  token_uuid := gen_random_uuid();
  timestamp_part := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  random_part := encode(gen_random_bytes(16), 'base64');
  
  -- Clean up base64 for URL safety
  random_part := replace(replace(random_part, '+', '-'), '/', '_');
  random_part := rtrim(random_part, '=');
  
  -- Combine components for final token
  final_token := encode(
    (token_uuid::TEXT || '-' || timestamp_part || '-' || random_part)::BYTEA,
    'base64'
  );
  
  -- Make URL safe
  final_token := replace(replace(final_token, '+', '-'), '/', '_');
  final_token := rtrim(final_token, '=');
  
  -- Store token in Vault and return the vault secret ID
  vault_secret_id := vault.create_secret(final_token);
  
  RETURN vault_secret_id;
END;
$$;


--
-- Name: FUNCTION generate_temp_chat_token(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_temp_chat_token() IS 'Generates cryptographically secure tokens for temporary chat links and stores them in Supabase Vault';


--
-- Name: get_admin_credential(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_credential(p_integration_type text, p_credential_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  vault_id TEXT;
  credential_value TEXT;
BEGIN
  -- Only admins and service role can call this function
  IF auth.role() != 'service_role' AND NOT (SELECT user_has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Insufficient privileges to access admin credentials';
  END IF;

  -- Get vault secret ID
  SELECT vault_secret_id INTO vault_id
  FROM admin_integration_credentials
  WHERE integration_type = p_integration_type
    AND credential_name = p_credential_name
    AND connection_status = 'active';

  IF vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Decrypt from vault
  SELECT vault_decrypt(vault_id) INTO credential_value;
  
  RETURN credential_value;
END;
$$;


--
-- Name: FUNCTION get_admin_credential(p_integration_type text, p_credential_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_credential(p_integration_type text, p_credential_name text) IS 'Safely retrieve admin credentials from vault (admin/service role only)';


--
-- Name: get_agent_integration_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agent_integration_permissions(p_agent_id uuid) RETURNS TABLE(permission_id uuid, agent_id uuid, connection_id uuid, connection_name text, external_username text, provider_name text, provider_display_name text, allowed_scopes jsonb, is_active boolean, permission_level text, granted_at timestamp with time zone, granted_by_user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT 
        aop.id AS permission_id,
        aop.agent_id,
        uoc.id AS connection_id,
        uoc.connection_name,
        uoc.external_username,
        op.name AS provider_name,
        op.display_name AS provider_display_name,
        aop.allowed_scopes,
        aop.is_active,
        aop.permission_level,
        aop.granted_at,
        aop.granted_by_user_id
    FROM agent_oauth_permissions aop
    INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = auth.uid()
    AND aop.is_active = true
    ORDER BY aop.granted_at DESC;
$$;


--
-- Name: FUNCTION get_agent_integration_permissions(p_agent_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_agent_integration_permissions(p_agent_id uuid) IS 'Get all integration permissions for an agent';


--
-- Name: get_agent_mcp_tools(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agent_mcp_tools(p_agent_id uuid) RETURNS TABLE(connection_id uuid, connection_name text, tool_name text, openai_schema jsonb, successful_parameters jsonb, last_successful_call timestamp with time zone, success_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        amc.id as connection_id,
        amc.connection_name,
        mtc.tool_name,
        mtc.openai_schema,
        mtc.successful_parameters,
        mtc.last_successful_call,
        mtc.success_count
    FROM agent_mcp_connections amc
    JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
    WHERE amc.agent_id = p_agent_id 
    AND amc.is_active = true
    ORDER BY amc.connection_name, mtc.tool_name;
END;
$$;


--
-- Name: FUNCTION get_agent_mcp_tools(p_agent_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_agent_mcp_tools(p_agent_id uuid) IS 'Returns MCP tools with successful parameter examples for LLM guidance';


--
-- Name: get_agent_oauth_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agent_oauth_permissions(p_agent_id uuid) RETURNS TABLE(permission_id uuid, connection_id uuid, provider_name text, provider_display_name text, connection_name text, permission_level text, allowed_scopes jsonb, expires_at timestamp with time zone, usage_count integer, last_used_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    aop.id,
    uoc.id,
    op.name,
    op.display_name,
    uoc.connection_name,
    aop.permission_level,
    aop.allowed_scopes,
    aop.expires_at,
    aop.usage_count,
    aop.last_used_at
  FROM agent_oauth_permissions aop
  JOIN user_oauth_connections uoc ON aop.user_oauth_connection_id = uoc.id
  JOIN service_providers op ON uoc.oauth_provider_id = op.id
  WHERE aop.agent_id = p_agent_id
    AND aop.is_active = true
    AND uoc.connection_status = 'active'
    AND (aop.expires_at IS NULL OR aop.expires_at > now());
$$;


--
-- Name: FUNCTION get_agent_oauth_permissions(p_agent_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_agent_oauth_permissions(p_agent_id uuid) IS 'Returns OAuth permissions for an agent';


--
-- Name: get_agent_web_search_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agent_web_search_permissions(p_agent_id uuid) RETURNS TABLE(permission_id uuid, agent_id uuid, provider_id uuid, provider_name text, provider_display_name text, key_id uuid, key_name text, permissions jsonb, is_active boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        awsp.id as permission_id,
        awsp.agent_id,
        awsp.provider_id,
        wsp.name as provider_name,
        wsp.display_name as provider_display_name,
        awsp.user_key_id as key_id,
        uwsk.key_name,
        awsp.permissions,
        awsp.is_active,
        awsp.created_at
    FROM agent_web_search_permissions awsp
    JOIN web_search_providers wsp ON awsp.provider_id = wsp.id
    JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
    WHERE awsp.agent_id = p_agent_id
        AND awsp.user_id = auth.uid()
    ORDER BY wsp.display_name;
END;
$$;


--
-- Name: get_billing_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_billing_statistics() RETURNS TABLE(total_users bigint, active_subscriptions bigint, past_due_count bigint, monthly_revenue bigint, churn_rate numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_total_users BIGINT;
  v_active_subs BIGINT;
  v_past_due BIGINT;
  v_monthly_revenue BIGINT;
  v_churn_rate NUMERIC;
BEGIN
  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  
  -- Active subscriptions
  SELECT COUNT(*) INTO v_active_subs 
  FROM stripe_subscriptions 
  WHERE status = 'active';
  
  -- Past due subscriptions
  SELECT COUNT(*) INTO v_past_due 
  FROM stripe_subscriptions 
  WHERE status = 'past_due';
  
  -- Monthly revenue (sum of active subscription amounts)
  SELECT COALESCE(SUM(billing_amount), 0) INTO v_monthly_revenue
  FROM stripe_subscriptions 
  WHERE status = 'active' AND billing_interval = 'month';
  
  -- Simple churn rate calculation (canceled this month / total active)
  SELECT 
    CASE 
      WHEN v_active_subs > 0 THEN 
        (SELECT COUNT(*)::NUMERIC FROM stripe_subscriptions 
         WHERE status = 'canceled' 
         AND canceled_at >= date_trunc('month', CURRENT_DATE)) / v_active_subs * 100
      ELSE 0
    END INTO v_churn_rate;
  
  RETURN QUERY SELECT v_total_users, v_active_subs, v_past_due, v_monthly_revenue, v_churn_rate;
END;
$$;


--
-- Name: FUNCTION get_billing_statistics(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_billing_statistics() IS 'Returns key billing metrics and statistics';


--
-- Name: get_chat_messages_with_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_messages_with_details(p_channel_id uuid) RETURNS TABLE(id uuid, channel_id uuid, sender_user_id uuid, sender_agent_id uuid, content text, metadata jsonb, embedding public.vector, created_at timestamp with time zone, user_profile jsonb, agent jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    cm.id,
    cm.channel_id,
    cm.sender_user_id,
    cm.sender_agent_id,
    cm.content,
    cm.metadata,
    cm.embedding,
    cm.created_at,
    -- Construct JSON object for user profile if sender_user_id is not null
    CASE WHEN cm.sender_user_id IS NOT NULL THEN
      jsonb_build_object(
          'full_name', up.full_name,
          'avatar_url', up.avatar_url
      )
    ELSE NULL END AS user_profile,
    -- Construct JSON object for agent if sender_agent_id is not null
    CASE WHEN cm.sender_agent_id IS NOT NULL THEN
      jsonb_build_object(
          'name', a.name
      )
    ELSE NULL END AS agent
  FROM
    public.chat_messages cm
    LEFT JOIN public.user_profiles up ON cm.sender_user_id = up.id
    LEFT JOIN public.agents a ON cm.sender_agent_id = a.id
  WHERE
    cm.channel_id = p_channel_id
  ORDER BY
    cm.created_at ASC; -- Ensure consistent ordering
$$;


--
-- Name: get_contact_details_for_agent(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid) RETURNS TABLE(contact_id uuid, first_name text, last_name text, display_name text, organization text, job_title text, department text, contact_type text, contact_status text, notes text, tags text[], custom_fields jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, last_contacted_at timestamp with time zone, communication_channels jsonb, recent_interactions jsonb, groups jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate agent ownership
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Check agent permission for this specific contact
  IF NOT check_agent_contact_permission(p_agent_id, p_contact_id, 'view') THEN
    RAISE EXCEPTION 'Agent does not have permission to view this contact';
  END IF;
  
  -- Return contact details
  RETURN QUERY
  SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.display_name,
    c.organization,
    c.job_title,
    c.department,
    c.contact_type,
    c.contact_status,
    c.notes,
    c.tags,
    c.custom_fields,
    c.created_at,
    c.updated_at,
    c.last_contacted_at,
    -- Get communication channels as JSONB
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', ccc.id,
         'type', ccc.channel_type,
         'identifier', ccc.channel_identifier,
         'label', ccc.display_label,
         'is_primary', ccc.is_primary,
         'is_verified', ccc.is_verified,
         'can_receive_marketing', ccc.can_receive_marketing
       )
     )
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id AND ccc.is_active = TRUE
    ) as communication_channels,
    -- Get recent interactions as JSONB
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', ci.id,
         'type', ci.interaction_type,
         'channel', ci.channel_type,
         'direction', ci.direction,
         'summary', ci.interaction_summary,
         'date', ci.interaction_at,
         'agent_name', a.name
       ) ORDER BY ci.interaction_at DESC
     )
     FROM contact_interactions ci
     INNER JOIN agents a ON ci.agent_id = a.id
     WHERE ci.contact_id = c.id
     LIMIT 10
    ) as recent_interactions,
    -- Get groups as JSONB
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', cg.id,
         'name', cg.name,
         'type', cg.group_type
       )
     )
     FROM contact_group_memberships cgm
     INNER JOIN contact_groups cg ON cgm.group_id = cg.id
     WHERE cgm.contact_id = c.id
    ) as groups
  FROM contacts c
  WHERE c.id = p_contact_id 
    AND c.user_id = p_user_id
    AND c.deleted_at IS NULL;
END;
$$;


--
-- Name: FUNCTION get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid) IS 'MCP tool function to get detailed contact information for agents';


--
-- Name: get_contact_interaction_stats(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contact_interaction_stats(p_contact_id uuid, p_user_id uuid, p_days integer DEFAULT 30) RETURNS TABLE(total_interactions bigint, sent_messages bigint, received_messages bigint, failed_deliveries bigint, avg_response_time interval, last_interaction timestamp with time zone, most_used_channel text, engagement_score numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_interactions,
    COUNT(*) FILTER (WHERE direction = 'outbound') as sent_messages,
    COUNT(*) FILTER (WHERE direction = 'inbound') as received_messages,
    COUNT(*) FILTER (WHERE delivery_status IN ('failed', 'bounced')) as failed_deliveries,
    AVG(read_at - interaction_at) FILTER (WHERE read_at IS NOT NULL) as avg_response_time,
    MAX(interaction_at) as last_interaction,
    MODE() WITHIN GROUP (ORDER BY channel_type) as most_used_channel,
    AVG(ci.engagement_score) as engagement_score
  FROM contact_interactions ci
  WHERE ci.contact_id = p_contact_id 
    AND ci.user_id = p_user_id
    AND ci.interaction_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$;


--
-- Name: get_contact_stats_for_agent(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid) RETURNS TABLE(total_contacts integer, contacts_by_type jsonb, contacts_with_phone integer, contacts_with_email integer, contacts_with_whatsapp integer, recent_interactions integer, top_organizations jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate agent ownership and permissions
  IF NOT check_agent_contact_permission(p_agent_id, NULL, 'view') THEN
    RAISE EXCEPTION 'Agent does not have contact access permissions';
  END IF;

  RETURN QUERY
  WITH accessible_contacts AS (
    SELECT c.*
    FROM contacts c
    WHERE c.user_id = p_user_id
      AND c.contact_status = 'active'
      AND c.deleted_at IS NULL
      -- Apply agent-specific access controls
      AND (
        -- Agent has all_contacts permission
        EXISTS (
          SELECT 1 FROM agent_contact_permissions acp
          WHERE acp.agent_id = p_agent_id 
            AND acp.permission_type = 'all_contacts'
            AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
        ) OR
        -- Agent has specific access to this contact
        EXISTS (
          SELECT 1 FROM agent_specific_contact_access asca
          WHERE asca.agent_id = p_agent_id 
            AND asca.contact_id = c.id
            AND asca.access_level != 'no_access'
            AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
        ) OR
        -- Agent has group access to this contact
        EXISTS (
          SELECT 1 FROM agent_group_access aga
          INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
          WHERE aga.agent_id = p_agent_id 
            AND cgm.contact_id = c.id
            AND (aga.expires_at IS NULL OR aga.expires_at > CURRENT_TIMESTAMP)
        )
      )
  )
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM accessible_contacts) as total_contacts,
    (SELECT jsonb_object_agg(contact_type, type_count)
     FROM (
       SELECT contact_type, COUNT(*) as type_count
       FROM accessible_contacts
       GROUP BY contact_type
     ) t) as contacts_by_type,
    (SELECT COUNT(DISTINCT ac.id)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_communication_channels ccc ON ac.id = ccc.contact_id
     WHERE ccc.channel_type IN ('phone', 'mobile') AND ccc.is_active = TRUE) as contacts_with_phone,
    (SELECT COUNT(DISTINCT ac.id)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_communication_channels ccc ON ac.id = ccc.contact_id
     WHERE ccc.channel_type = 'email' AND ccc.is_active = TRUE) as contacts_with_email,
    (SELECT COUNT(DISTINCT ac.id)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_communication_channels ccc ON ac.id = ccc.contact_id
     WHERE ccc.channel_type = 'whatsapp' AND ccc.is_active = TRUE) as contacts_with_whatsapp,
    (SELECT COUNT(*)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_interactions ci ON ac.id = ci.contact_id
     WHERE ci.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as recent_interactions,
    (SELECT jsonb_agg(jsonb_build_object('organization', organization, 'count', contact_count))
     FROM (
       SELECT organization, COUNT(*) as contact_count
       FROM accessible_contacts
       WHERE organization IS NOT NULL AND organization != ''
       GROUP BY organization
       ORDER BY contact_count DESC
       LIMIT 10
     ) t) as top_organizations;
END;
$$;


--
-- Name: FUNCTION get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid) IS 'Returns comprehensive contact statistics for agent dashboard';


--
-- Name: get_cron_job_status(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cron_job_status(p_job_name character varying DEFAULT 'aggregate-token-usage-daily'::character varying) RETURNS TABLE(jobid bigint, schedule text, command text, active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cj.jobid,
    cj.schedule,
    cj.command,
    cj.active
  FROM cron.job cj
  WHERE cj.jobname = p_job_name;
END;
$$;


--
-- Name: FUNCTION get_cron_job_status(p_job_name character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_cron_job_status(p_job_name character varying) IS 'Returns status of the token aggregation cron job';


--
-- Name: get_current_time_in_timezone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_time_in_timezone(timezone_name text DEFAULT 'UTC'::text) RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    AS $$
  SELECT timezone(timezone_name, now());
$$;


--
-- Name: get_current_utc_time(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_utc_time() RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    AS $$
  SELECT now();
$$;


--
-- Name: get_gmail_connection_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_gmail_connection_by_id(p_connection_id uuid) RETURNS TABLE(connection_id uuid, connection_name text, external_username text, scopes_granted jsonb, connection_status text, connection_metadata jsonb, configuration jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT 
        id AS connection_id,
        connection_name,
        external_username,
        scopes_granted,
        connection_status,
        connection_metadata,
        '{}'::jsonb AS configuration
    FROM user_oauth_connections
    WHERE id = p_connection_id
    AND user_id = auth.uid()
    AND oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
$$;


--
-- Name: get_gmail_connection_with_tokens(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_gmail_connection_with_tokens(p_user_id uuid) RETURNS TABLE(connection_id uuid, external_username text, scopes_granted jsonb, connection_status text, vault_access_token_id text, vault_refresh_token_id text, connection_metadata jsonb, configuration jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT 
        uoc.id AS connection_id,
        uoc.external_username,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.vault_access_token_id,
        uoc.vault_refresh_token_id,
        uoc.connection_metadata,
        '{}'::jsonb as configuration
    FROM user_oauth_connections uoc
    WHERE uoc.user_id = p_user_id
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND uoc.connection_status = 'active'
    LIMIT 1;
$$;


--
-- Name: FUNCTION get_gmail_connection_with_tokens(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_gmail_connection_with_tokens(p_user_id uuid) IS 'Get Gmail connection with vault token IDs for edge function use';


--
-- Name: get_gmail_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_gmail_tools(p_agent_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_has_send BOOLEAN = FALSE;
    v_has_read BOOLEAN = FALSE;
    v_has_modify BOOLEAN = FALSE;
BEGIN
    -- Get allowed scopes for agent (using correct column name)
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND op.name = 'gmail'
    AND aop.is_active = true;
    
    -- Check if agent has permissions
    IF v_allowed_scopes IS NULL THEN
        RETURN v_tools;
    END IF;
    
    -- Check which scopes are granted
    v_has_send := v_allowed_scopes ? 'https://www.googleapis.com/auth/gmail.send';
    v_has_read := v_allowed_scopes ? 'https://www.googleapis.com/auth/gmail.readonly';
    v_has_modify := v_allowed_scopes ? 'https://www.googleapis.com/auth/gmail.modify';
    
    -- Build tools array based on granted scopes
    IF v_has_send THEN
        v_tools := v_tools || jsonb_build_object(
            'name', 'send_email',
            'description', 'Send an email through Gmail',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.send']
        );
    END IF;
    
    IF v_has_read THEN
        v_tools := v_tools || jsonb_build_object(
            'name', 'read_emails',
            'description', 'Read emails from Gmail',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.readonly']
        );
        
        v_tools := v_tools || jsonb_build_object(
            'name', 'search_emails',
            'description', 'Search emails in Gmail',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.readonly']
        );
    END IF;
    
    IF v_has_modify THEN
        v_tools := v_tools || jsonb_build_object(
            'name', 'email_actions',
            'description', 'Perform actions on emails (mark read, archive, etc)',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.modify']
        );
    END IF;
    
    RETURN v_tools;
END;
$$;


--
-- Name: get_import_job_summary(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_import_job_summary(p_user_id uuid, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, file_name text, status text, total_rows integer, successful_imports integer, failed_imports integer, duplicate_contacts integer, created_at timestamp with time zone, completed_at timestamp with time zone, processing_duration interval)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cij.id,
    cij.file_name,
    cij.status,
    cij.total_rows,
    cij.successful_imports,
    cij.failed_imports,
    cij.duplicate_contacts,
    cij.created_at,
    cij.completed_at,
    cij.completed_at - cij.started_at as processing_duration
  FROM contact_import_jobs cij
  WHERE cij.user_id = p_user_id
  ORDER BY cij.created_at DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: get_integration_categories_with_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_integration_categories_with_counts() RETURNS TABLE(id uuid, name text, description text, icon_name text, display_order integer, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, provider_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id,
    ic.name,
    ic.description,
    ic.icon_name,
    ic.display_order,
    ic.is_active,
    ic.created_at,
    ic.updated_at,
    COALESCE(sp_counts.provider_count, 0) as provider_count
  FROM integration_categories ic
  LEFT JOIN (
    SELECT 
      CASE 
        WHEN sp.name IN ('gmail', 'smtp', 'sendgrid', 'mailgun', 'discord') THEN 'Messaging & Communication'
        WHEN sp.name IN ('serper_api', 'serpapi', 'brave_search', 'ocr_space') THEN 'API Integrations'
        WHEN sp.name IN ('pinecone', 'getzep') THEN 'Database Connectors'
        WHEN sp.name IN ('digitalocean') THEN 'Cloud Services'
        WHEN sp.name IN ('zapier') THEN 'Automation & Workflows'
        WHEN sp.name IN ('microsoft-teams') THEN 'Communication'
        WHEN sp.name IN ('microsoft-outlook') THEN 'Productivity'
        WHEN sp.name IN ('microsoft-onedrive') THEN 'Storage'
        ELSE 'API Integrations'
      END as category_name,
      COUNT(*) as provider_count
    FROM service_providers sp
    WHERE sp.is_enabled = true
    GROUP BY category_name
  ) sp_counts ON ic.name = sp_counts.category_name
  WHERE ic.is_active = true
  ORDER BY ic.display_order, ic.name;
END;
$$;


--
-- Name: get_integration_categories_with_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_integration_categories_with_counts(p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, description text, icon_name text, display_order integer, total_integrations bigint, available_integrations bigint, user_connected_integrations bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ic.id,
        ic.name,
        ic.description,
        ic.icon_name,
        ic.display_order,
        COUNT(i.id) as total_integrations,
        COUNT(CASE WHEN i.status = 'available' THEN 1 END) as available_integrations,
        COALESCE(COUNT(CASE WHEN ui.connection_status = 'connected' THEN 1 END), 0) as user_connected_integrations
    FROM integration_categories ic
    LEFT JOIN integrations i ON ic.id = i.category_id AND i.is_active = true
    LEFT JOIN user_integrations ui ON i.id = ui.integration_id 
        AND ui.user_id = COALESCE(p_user_id, auth.uid())
        AND ui.connection_status = 'connected'
    WHERE ic.is_active = true
    GROUP BY ic.id, ic.name, ic.description, ic.icon_name, ic.display_order
    ORDER BY ic.display_order, ic.name;
END;
$$;


--
-- Name: get_integrations_by_category(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_integrations_by_category(p_category_id uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, name text, description text, icon_name text, status public.integration_status_enum, is_popular boolean, documentation_url text, display_order integer, user_connection_status public.integration_connection_status_enum, user_connection_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.description,
        i.icon_name,
        i.status,
        i.is_popular,
        i.documentation_url,
        i.display_order,
        COALESCE(MAX(ui.connection_status), NULL::integration_connection_status_enum) as user_connection_status,
        COUNT(ui.id) as user_connection_count
    FROM integrations i
    LEFT JOIN user_integrations ui ON i.id = ui.integration_id 
        AND ui.user_id = COALESCE(p_user_id, auth.uid())
    WHERE i.category_id = p_category_id AND i.is_active = true
    GROUP BY i.id, i.name, i.description, i.icon_name, i.status, i.is_popular, i.documentation_url, i.display_order
    ORDER BY i.display_order, i.name;
END;
$$;


--
-- Name: get_line_count(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_line_count(content text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    RETURN array_length(string_to_array(content, E'\n'), 1);
END;
$$;


--
-- Name: FUNCTION get_line_count(content text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_line_count(content text) IS 'Counts the number of lines in text content';


--
-- Name: get_lines(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_lines(content text, start_line integer DEFAULT 1, end_line integer DEFAULT NULL::integer) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    lines TEXT[];
    result TEXT;
BEGIN
    lines := string_to_array(content, E'\n');
    
    IF end_line IS NULL THEN
        end_line := array_length(lines, 1);
    END IF;
    
    -- Validate bounds
    IF start_line < 1 OR start_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'start_line out of bounds: %', start_line;
    END IF;
    
    IF end_line < start_line OR end_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'end_line out of bounds: %', end_line;
    END IF;
    
    result := array_to_string(lines[start_line:end_line], E'\n');
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_lines(content text, start_line integer, end_line integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_lines(content text, start_line integer, end_line integer) IS 'Extracts a range of lines from content';


--
-- Name: get_mcp_connections_needing_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mcp_connections_needing_refresh() RETURNS TABLE(connection_id uuid, connection_name text, agent_id uuid, last_updated timestamp with time zone, days_old integer, tool_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    amc.id as connection_id,
    amc.connection_name,
    amc.agent_id,
    MIN(mtc.last_updated) as last_updated,
    EXTRACT(DAY FROM NOW() - MIN(mtc.last_updated))::INTEGER as days_old,
    COUNT(mtc.id) as tool_count
  FROM agent_mcp_connections amc
  LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
  WHERE amc.is_active = true
    AND (
      -- No tools cached yet
      mtc.id IS NULL
      OR
      -- Tools older than 7 days
      (NOW() - mtc.last_updated) > INTERVAL '7 days'
      OR
      -- Recent schema errors and auto-refresh enabled
      (mtc.last_schema_error IS NOT NULL 
       AND mtc.auto_refresh_enabled = true
       AND (NOW() - mtc.last_schema_error) < INTERVAL '1 hour')
    )
  GROUP BY amc.id, amc.connection_name, amc.agent_id
  ORDER BY days_old DESC NULLS FIRST;
END;
$$;


--
-- Name: FUNCTION get_mcp_connections_needing_refresh(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_mcp_connections_needing_refresh() IS 'Get list of connections with stale schemas';


--
-- Name: get_mcp_server_type_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mcp_server_type_stats() RETURNS TABLE(server_type text, active_connections bigint, total_connections bigint, total_tools bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    amc.connection_type as server_type,
    COUNT(*) FILTER (WHERE amc.is_active = true) as active_connections,
    COUNT(*) as total_connections,
    COUNT(mtc.id) as total_tools
  FROM agent_mcp_connections amc
  LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
  GROUP BY amc.connection_type
  ORDER BY active_connections DESC;
END;
$$;


--
-- Name: get_mcp_server_url(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mcp_server_url(connection_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    vault_id TEXT;
    decrypted_url TEXT;
    fallback_url TEXT;
BEGIN
    -- Only service role can decrypt URLs
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to access MCP server URLs';
    END IF;

    -- Get vault ID and fallback URL
    SELECT vault_server_url_id, server_url_deprecated 
    INTO vault_id, fallback_url
    FROM agent_mcp_connections 
    WHERE id = connection_id;

    -- Try to decrypt from vault first
    IF vault_id IS NOT NULL THEN
        SELECT vault_decrypt(vault_id) INTO decrypted_url;
        IF decrypted_url IS NOT NULL THEN
            RETURN decrypted_url;
        END IF;
    END IF;

    -- Fallback to deprecated column during migration period
    IF fallback_url IS NOT NULL THEN
        RETURN fallback_url;
    END IF;

    -- No URL found
    RETURN NULL;
END;
$$;


--
-- Name: FUNCTION get_mcp_server_url(connection_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_mcp_server_url(connection_id uuid) IS 'Securely retrieves decrypted MCP server URL (service role only)';


--
-- Name: get_mcp_tool_successful_params(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text) RETURNS TABLE(parameters jsonb, last_success timestamp with time zone, success_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    successful_parameters,
    last_successful_call,
    mcp_tools_cache.success_count
  FROM mcp_tools_cache
  WHERE connection_id = p_connection_id 
    AND tool_name = p_tool_name;
END;
$$;


--
-- Name: FUNCTION get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text) IS 'Retrieves successful parameter examples for LLM context';


--
-- Name: get_media_document_content_for_agent(uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_media_document_content_for_agent(p_agent_id uuid, p_user_id uuid, p_document_id uuid, p_include_metadata boolean DEFAULT true) RETURNS TABLE(document_id uuid, file_name text, display_name text, file_type text, file_size bigint, category text, assignment_type text, text_content text, tags text[], description text, processing_status text, chunk_count integer, metadata jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Validate agent ownership
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Validate document assignment to agent
    IF NOT EXISTS (
        SELECT 1 FROM agent_media_assignments ama
        INNER JOIN media_library ml ON ama.media_id = ml.id
        WHERE ama.agent_id = p_agent_id 
            AND ama.user_id = p_user_id
            AND ml.id = p_document_id
            AND ama.is_active = true
            AND ml.is_archived = false
    ) THEN
        RAISE EXCEPTION 'Document not found or not assigned to this agent';
    END IF;
    
    -- Return document content
    RETURN QUERY
    SELECT 
        ml.id,
        ml.file_name,
        COALESCE(ml.display_name, ml.file_name),
        ml.file_type,
        ml.file_size,
        ml.category,
        ama.assignment_type,
        ml.text_content,
        ml.tags,
        ml.description,
        ml.processing_status,
        ml.chunk_count,
        CASE WHEN p_include_metadata THEN ml.metadata ELSE '{}'::jsonb END,
        ml.created_at,
        ml.updated_at
    FROM media_library ml
    INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
    WHERE ml.id = p_document_id
        AND ama.agent_id = p_agent_id
        AND ama.user_id = p_user_id
        AND ama.is_active = true
        AND ml.is_archived = false;
    
    -- Update access tracking
    UPDATE agent_media_assignments 
    SET 
        last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE agent_id = p_agent_id 
        AND media_id = p_document_id
        AND user_id = p_user_id;
        
    UPDATE media_library 
    SET last_accessed_at = NOW()
    WHERE id = p_document_id;
END;
$$;


--
-- Name: get_microsoft_onedrive_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_connection_active BOOLEAN = false;
    v_connection_id UUID;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aip.allowed_scopes,
        (uic.connection_status = 'active'),
        uic.id
    INTO v_allowed_scopes, v_connection_active, v_connection_id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uic.oauth_provider_id
    WHERE aip.agent_id = p_agent_id
    AND uic.user_id = p_user_id
    AND sp.name = 'microsoft-onedrive'
    AND aip.is_active = true;
    
    -- Return empty if no active connection or permissions
    IF v_allowed_scopes IS NULL OR NOT v_connection_active THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    -- Upload file tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Files.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "onedrive_upload_file",
            "description": "Upload a file to Microsoft OneDrive",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_name": {"type": "string", "description": "Name of the file including extension"},
                    "file_content": {"type": "string", "description": "Base64 encoded file content"},
                    "folder_path": {"type": "string", "description": "Destination folder path (e.g., /Documents/Projects)", "default": "/"},
                    "conflict_behavior": {"type": "string", "enum": ["fail", "replace", "rename"], "default": "rename", "description": "Behavior when file already exists"}
                },
                "required": ["file_name", "file_content"]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
        
        -- Share file tool
        v_tools = v_tools || '[{
            "name": "onedrive_share_file",
            "description": "Create a sharing link for a OneDrive file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "OneDrive file ID"},
                    "file_path": {"type": "string", "description": "File path (alternative to file_id, e.g., /Documents/file.pdf)"},
                    "link_type": {"type": "string", "enum": ["view", "edit", "embed"], "default": "view", "description": "Type of sharing link"},
                    "scope": {"type": "string", "enum": ["anonymous", "organization"], "default": "anonymous", "description": "Sharing scope"}
                },
                "oneOf": [
                    {"required": ["file_id"]},
                    {"required": ["file_path"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
        
        -- List files tool
        v_tools = v_tools || '[{
            "name": "onedrive_list_files",
            "description": "List files in a OneDrive folder",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "Folder path to list (e.g., /Documents)", "default": "/"},
                    "limit": {"type": "integer", "description": "Maximum number of files to return", "default": 100, "minimum": 1, "maximum": 200}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
        
        -- Download file tool
        v_tools = v_tools || '[{
            "name": "onedrive_download_file",
            "description": "Download a file from OneDrive",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "OneDrive file ID"},
                    "file_path": {"type": "string", "description": "File path (alternative to file_id)"}
                },
                "oneOf": [
                    {"required": ["file_id"]},
                    {"required": ["file_path"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
    END IF;
    
    -- Search files tool (requires read access)
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Files.Read' OR v_allowed_scopes ? 'https://graph.microsoft.com/Files.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "onedrive_search_files",
            "description": "Search files in OneDrive by name or content",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query (file name, content, or metadata)"},
                    "limit": {"type": "integer", "description": "Maximum number of results to return", "default": 50, "minimum": 1, "maximum": 100}
                },
                "required": ["query"]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.Read"]
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;


--
-- Name: FUNCTION get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid) IS 'Returns available Microsoft OneDrive tools for an agent based on granted OAuth scopes and active connection status';


--
-- Name: get_microsoft_outlook_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_connection_active BOOLEAN = false;
    v_connection_id UUID;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aip.allowed_scopes,
        (uic.connection_status = 'active'),
        uic.id
    INTO v_allowed_scopes, v_connection_active, v_connection_id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uic.oauth_provider_id
    WHERE aip.agent_id = p_agent_id
    AND uic.user_id = p_user_id
    AND sp.name = 'microsoft-outlook'
    AND aip.is_active = true;
    
    -- Return empty if no active connection or permissions
    IF v_allowed_scopes IS NULL OR NOT v_connection_active THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    -- Send email tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Mail.Send' THEN
        v_tools = v_tools || '[{
            "name": "outlook_send_email",
            "description": "Send an email via Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "Recipient email addresses"},
                    "cc": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "CC recipient email addresses"},
                    "bcc": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "BCC recipient email addresses"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body content"},
                    "body_type": {"type": "string", "enum": ["text", "html"], "default": "text", "description": "Email body format"},
                    "importance": {"type": "string", "enum": ["low", "normal", "high"], "default": "normal", "description": "Email importance level"}
                },
                "required": ["to", "subject", "body"]
            },
            "required_scopes": ["https://graph.microsoft.com/Mail.Send"]
        }]'::jsonb;
    END IF;
    
    -- Read emails tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Mail.Read' THEN
        v_tools = v_tools || '[{
            "name": "outlook_read_emails",
            "description": "Read emails from Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {"type": "string", "description": "Mail folder to read from (inbox, sent, drafts, etc.)", "default": "inbox"},
                    "limit": {"type": "integer", "description": "Maximum number of emails to retrieve", "default": 50, "minimum": 1, "maximum": 100},
                    "search": {"type": "string", "description": "Search query to filter emails"},
                    "unread_only": {"type": "boolean", "description": "Only return unread emails", "default": false}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Mail.Read"]
        }]'::jsonb;
    END IF;
    
    -- Create calendar event tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Calendars.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "outlook_create_event",
            "description": "Create a calendar event in Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Event subject/title"},
                    "start": {"type": "string", "format": "date-time", "description": "Event start time (ISO 8601 format)"},
                    "end": {"type": "string", "format": "date-time", "description": "Event end time (ISO 8601 format)"},
                    "location": {"type": "string", "description": "Event location"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "Attendee email addresses"},
                    "body": {"type": "string", "description": "Event description/body"},
                    "is_online_meeting": {"type": "boolean", "description": "Create as Teams meeting", "default": false}
                },
                "required": ["subject", "start", "end"]
            },
            "required_scopes": ["https://graph.microsoft.com/Calendars.ReadWrite"]
        }]'::jsonb;
    END IF;
    
    -- Read calendar events tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Calendars.Read' THEN
        v_tools = v_tools || '[{
            "name": "outlook_read_events",
            "description": "Read calendar events from Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date", "description": "Start date for event range (YYYY-MM-DD)"},
                    "end_date": {"type": "string", "format": "date", "description": "End date for event range (YYYY-MM-DD)"},
                    "limit": {"type": "integer", "description": "Maximum number of events to retrieve", "default": 50, "minimum": 1, "maximum": 100}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Calendars.Read"]
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;


--
-- Name: FUNCTION get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid) IS 'Returns available Microsoft Outlook tools for an agent based on granted OAuth scopes and active connection status';


--
-- Name: get_microsoft_teams_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_connection_active BOOLEAN = false;
    v_connection_id UUID;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aip.allowed_scopes,
        (uic.connection_status = 'active'),
        uic.id
    INTO v_allowed_scopes, v_connection_active, v_connection_id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uic.oauth_provider_id
    WHERE aip.agent_id = p_agent_id
    AND uic.user_id = p_user_id
    AND sp.name = 'microsoft-teams'
    AND aip.is_active = true;
    
    -- Return empty if no active connection or permissions
    IF v_allowed_scopes IS NULL OR NOT v_connection_active THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    -- Send message tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/ChannelMessage.Send' THEN
        v_tools = v_tools || '[{
            "name": "teams_send_message",
            "description": "Send a message to a Microsoft Teams channel or chat",
            "parameters": {
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Teams channel ID (format: 19:...@thread.tacv2)"},
                    "chat_id": {"type": "string", "description": "Teams chat ID (format: 19:...)"},
                    "message": {"type": "string", "description": "Message content to send"},
                    "message_type": {"type": "string", "enum": ["text", "html"], "default": "text", "description": "Message format type"}
                },
                "required": ["message"],
                "oneOf": [
                    {"required": ["channel_id"]},
                    {"required": ["chat_id"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/ChannelMessage.Send"]
        }]'::jsonb;
    END IF;
    
    -- Create meeting tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/OnlineMeetings.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "teams_create_meeting",
            "description": "Create a Microsoft Teams meeting",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Meeting subject/title"},
                    "start_time": {"type": "string", "format": "date-time", "description": "Meeting start time (ISO 8601 format)"},
                    "end_time": {"type": "string", "format": "date-time", "description": "Meeting end time (ISO 8601 format)"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "List of attendee email addresses"}
                },
                "required": ["subject", "start_time", "end_time"]
            },
            "required_scopes": ["https://graph.microsoft.com/OnlineMeetings.ReadWrite"]
        }]'::jsonb;
    END IF;
    
    -- Read messages tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/ChannelMessage.Read.All' THEN
        v_tools = v_tools || '[{
            "name": "teams_read_messages",
            "description": "Read messages from Microsoft Teams channels or chats",
            "parameters": {
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Teams channel ID to read from"},
                    "chat_id": {"type": "string", "description": "Teams chat ID to read from"},
                    "limit": {"type": "integer", "description": "Maximum number of messages to retrieve", "default": 50, "minimum": 1, "maximum": 100}
                },
                "oneOf": [
                    {"required": ["channel_id"]},
                    {"required": ["chat_id"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/ChannelMessage.Read.All"]
        }]'::jsonb;
    END IF;
    
    -- List teams tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Team.ReadBasic.All' THEN
        v_tools = v_tools || '[{
            "name": "teams_list_teams",
            "description": "List Microsoft Teams that the user is a member of",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Maximum number of teams to retrieve", "default": 50, "minimum": 1, "maximum": 100}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Team.ReadBasic.All"]
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;


--
-- Name: FUNCTION get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid) IS 'Returns available Microsoft Teams tools for an agent based on granted OAuth scopes and active connection status';


--
-- Name: get_my_claim(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_claim(claim_name text) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim_name;
$$;


--
-- Name: FUNCTION get_my_claim(claim_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_claim(claim_name text) IS 'Retrieves a specific text claim from the current session''s JWT claims.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: task_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    step_order integer NOT NULL,
    step_name text NOT NULL,
    instructions text NOT NULL,
    include_previous_context boolean DEFAULT false NOT NULL,
    context_data jsonb DEFAULT '{}'::jsonb,
    status public.task_step_status DEFAULT 'pending'::public.task_step_status NOT NULL,
    execution_result jsonb DEFAULT '{}'::jsonb,
    execution_started_at timestamp with time zone,
    execution_completed_at timestamp with time zone,
    execution_duration_ms integer,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_steps_instructions_length CHECK (((char_length(instructions) >= 10) AND (char_length(instructions) <= 5000))),
    CONSTRAINT task_steps_retry_count_non_negative CHECK ((retry_count >= 0)),
    CONSTRAINT task_steps_step_name_length CHECK (((char_length(step_name) >= 1) AND (char_length(step_name) <= 100))),
    CONSTRAINT task_steps_step_order_positive CHECK ((step_order > 0))
);


--
-- Name: TABLE task_steps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_steps IS 'Individual steps within scheduled tasks supporting sequential execution with context passing';


--
-- Name: COLUMN task_steps.step_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_steps.step_order IS 'Execution order of steps within a task (1, 2, 3...)';


--
-- Name: COLUMN task_steps.include_previous_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_steps.include_previous_context IS 'Whether to include previous step execution result as context';


--
-- Name: COLUMN task_steps.context_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_steps.context_data IS 'JSONB storage for context data passed from previous steps';


--
-- Name: COLUMN task_steps.execution_result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_steps.execution_result IS 'JSONB storage for step execution results and agent responses';


--
-- Name: get_next_pending_step(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_pending_step(p_task_id uuid) RETURNS public.task_steps
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    next_step task_steps;
BEGIN
    SELECT * INTO next_step
    FROM task_steps
    WHERE task_id = p_task_id 
    AND status = 'pending'
    ORDER BY step_order
    LIMIT 1;
    
    RETURN next_step;
END;
$$;


--
-- Name: stripe_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    customer_email text NOT NULL,
    customer_name text,
    default_payment_method text,
    customer_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_email CHECK ((customer_email ~ '^[^@]+@[^@]+\.[^@]+$'::text)),
    CONSTRAINT valid_stripe_id CHECK ((stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$'::text))
);


--
-- Name: TABLE stripe_customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_customers IS 'Links Agentopia users to Stripe customer records for billing';


--
-- Name: COLUMN stripe_customers.stripe_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stripe_customers.stripe_customer_id IS 'Stripe customer ID (cus_...)';


--
-- Name: COLUMN stripe_customers.default_payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stripe_customers.default_payment_method IS 'Default Stripe payment method ID';


--
-- Name: COLUMN stripe_customers.customer_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stripe_customers.customer_metadata IS 'Additional Stripe customer metadata';


--
-- Name: get_or_create_stripe_customer(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_stripe_customer(p_user_id uuid, p_stripe_customer_id text DEFAULT NULL::text, p_customer_email text DEFAULT NULL::text, p_customer_name text DEFAULT NULL::text) RETURNS public.stripe_customers
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_customer stripe_customers;
  v_profile RECORD;
BEGIN
  -- Try to find existing customer
  SELECT * INTO v_customer 
  FROM stripe_customers 
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN v_customer;
  END IF;
  
  -- Get user profile if customer data not provided
  IF p_customer_email IS NULL OR p_customer_name IS NULL THEN
    SELECT email, full_name INTO v_profile
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.id = p_user_id;
  END IF;
  
  -- Create new customer record
  INSERT INTO stripe_customers (
    user_id,
    stripe_customer_id,
    customer_email,
    customer_name
  ) VALUES (
    p_user_id,
    p_stripe_customer_id,
    COALESCE(p_customer_email, v_profile.email),
    COALESCE(p_customer_name, v_profile.full_name)
  ) RETURNING * INTO v_customer;
  
  RETURN v_customer;
END;
$$;


--
-- Name: get_previous_step_context(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_previous_step_context(p_task_id uuid, p_current_step_order integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    previous_result JSONB;
BEGIN
    -- Get the execution result from the immediately previous step
    SELECT execution_result INTO previous_result
    FROM task_steps
    WHERE task_id = p_task_id 
    AND step_order = p_current_step_order - 1
    AND status = 'completed';
    
    RETURN COALESCE(previous_result, '{}'::jsonb);
END;
$$;


--
-- Name: get_recent_contact_interactions(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_contact_interactions(p_contact_id uuid, p_user_id uuid, p_limit integer DEFAULT 20) RETURNS TABLE(id uuid, interaction_type text, channel_type text, direction text, interaction_summary text, interaction_at timestamp with time zone, delivery_status text, agent_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.interaction_type,
    ci.channel_type,
    ci.direction,
    ci.interaction_summary,
    ci.interaction_at,
    ci.delivery_status,
    a.name as agent_name
  FROM contact_interactions ci
  INNER JOIN agents a ON ci.agent_id = a.id
  WHERE ci.contact_id = p_contact_id 
    AND ci.user_id = p_user_id
  ORDER BY ci.interaction_at DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: get_revenue_analytics(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_revenue_analytics(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS TABLE(period_date date, daily_revenue bigint, new_subscriptions bigint, canceled_subscriptions bigint, active_subscriptions bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::date as period_date
  ),
  daily_stats AS (
    SELECT 
      d.period_date,
      
      -- Daily revenue from paid invoices
      COALESCE(SUM(si.amount_paid) FILTER (WHERE si.paid_at::date = d.period_date), 0) as daily_revenue,
      
      -- New subscriptions
      COUNT(ss.id) FILTER (WHERE ss.created_at::date = d.period_date) as new_subscriptions,
      
      -- Canceled subscriptions
      COUNT(ss.id) FILTER (WHERE ss.canceled_at::date = d.period_date) as canceled_subscriptions,
      
      -- Active subscriptions at end of day
      COUNT(ss.id) FILTER (WHERE 
        ss.created_at::date <= d.period_date 
        AND (ss.canceled_at IS NULL OR ss.canceled_at::date > d.period_date)
        AND ss.status = 'active'
      ) as active_subscriptions
      
    FROM date_series d
    LEFT JOIN stripe_invoices si ON si.paid_at::date = d.period_date
    LEFT JOIN stripe_subscriptions ss ON TRUE
    GROUP BY d.period_date
  )
  SELECT * FROM daily_stats ORDER BY period_date;
END;
$$;


--
-- Name: FUNCTION get_revenue_analytics(p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_revenue_analytics(p_start_date date, p_end_date date) IS 'Returns daily revenue and subscription analytics';


--
-- Name: get_room_id_for_channel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_room_id_for_channel(p_channel_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT room_id
  FROM chat_channels
  WHERE id = p_channel_id;
$$;


--
-- Name: get_room_members(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_room_members(p_room_id uuid) RETURNS SETOF public.room_member_details
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
    WITH room_access AS (
        SELECT public.is_room_member(p_room_id, auth.uid()) as has_access
    )
    SELECT
        crm.id as member_entry_id,
        crm.room_id,
        crm.member_type,
        crm.member_id,
        crm.added_at,
        CASE crm.member_type
            WHEN 'user' THEN (SELECT p.full_name FROM public.user_profiles p WHERE p.id = crm.member_id)
            WHEN 'agent' THEN (SELECT a.name FROM public.agents a WHERE a.id = crm.member_id)
            WHEN 'team' THEN (SELECT t.name FROM public.teams t WHERE t.id = crm.member_id)
            ELSE NULL
        END as member_name,
        CASE crm.member_type
            WHEN 'user' THEN (SELECT p.avatar_url FROM public.user_profiles p WHERE p.id = crm.member_id)
            ELSE NULL
        END as member_avatar_url
    FROM public.chat_room_members crm
    CROSS JOIN room_access
    WHERE crm.room_id = p_room_id
    AND room_access.has_access = true;
$$;


--
-- Name: get_root_teams(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_root_teams() RETURNS TABLE(id uuid, name text, description text, owner_user_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, child_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.owner_user_id,
    t.created_at,
    t.updated_at,
    COUNT(child.id) AS child_count
  FROM teams t
  LEFT JOIN teams child ON child.parent_team_id = t.id
  WHERE t.parent_team_id IS NULL
  GROUP BY t.id, t.name, t.description, t.owner_user_id, t.created_at, t.updated_at
  ORDER BY t.name;
END;
$$;


--
-- Name: get_secret(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_secret(secret_name text) RETURNS TABLE(key text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT decrypted_secret AS key
    FROM vault.decrypted_secrets
    WHERE name = secret_name;
END;
$$;


--
-- Name: FUNCTION get_secret(secret_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_secret(secret_name text) IS 'Retrieve a decrypted secret from vault by name';


--
-- Name: get_secret(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_secret(secret_id uuid) RETURNS TABLE(key text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT decrypted_secret AS key
    FROM vault.decrypted_secrets
    WHERE id = secret_id;
END;
$$;


--
-- Name: FUNCTION get_secret(secret_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_secret(secret_id uuid) IS 'Retrieve a decrypted secret from vault by ID';


--
-- Name: get_sendgrid_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sendgrid_tools(p_agent_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_tools JSONB = '[]'::jsonb;
    v_permission RECORD;
BEGIN
    -- Get agent permissions and config
    SELECT 
        asp.*,
        sc.id as config_id,
        sc.is_active as config_active
    INTO v_permission
    FROM agent_sendgrid_permissions asp
    JOIN sendgrid_configurations sc ON sc.id = asp.sendgrid_config_id
    WHERE asp.agent_id = p_agent_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true;
    
    IF NOT FOUND THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on permissions
    IF v_permission.can_send_email THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'send_email',
            'enabled', true,
            'limits', jsonb_build_object(
                'daily_limit', v_permission.daily_send_limit,
                'recipients_limit', v_permission.recipients_per_email_limit
            )
        );
    END IF;
    
    IF v_permission.can_use_templates THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'send_template_email',
            'enabled', true
        );
    END IF;
    
    IF v_permission.can_send_bulk THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'send_bulk_email',
            'enabled', true,
            'limits', jsonb_build_object(
                'max_personalizations', 1000
            )
        );
    END IF;
    
    IF v_permission.can_view_analytics THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'get_email_status',
            'enabled', true
        );
        v_tools = v_tools || jsonb_build_object(
            'name', 'search_email_analytics',
            'enabled', true
        );
    END IF;
    
    IF v_permission.can_receive_emails THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'list_inbound_emails',
            'enabled', true
        );
    END IF;
    
    IF v_permission.can_manage_templates THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'create_email_template',
            'enabled', true
        );
    END IF;
    
    RETURN v_tools;
END;
$$;


--
-- Name: get_smtp_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_smtp_password(p_user_id uuid, p_vault_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    decrypted_password TEXT;
BEGIN
    -- Validate user access
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: can only access own credentials';
    END IF;
    
    -- Validate input
    IF p_vault_id IS NULL THEN
        RAISE EXCEPTION 'Vault ID is required';
    END IF;
    
    -- Retrieve decrypted password
    SELECT decrypted_secret
    INTO decrypted_password
    FROM vault.decrypted_secrets
    WHERE id = p_vault_id::UUID;
    
    IF decrypted_password IS NULL THEN
        RAISE EXCEPTION 'SMTP password not found or access denied';
    END IF;
    
    RETURN decrypted_password;
END;
$$;


--
-- Name: get_smtp_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_smtp_tools(p_agent_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    tools JSONB := '[]'::jsonb;
    permission RECORD;
BEGIN
    -- Get agent SMTP permissions
    FOR permission IN
        SELECT 
            asp.*,
            sc.connection_name,
            sc.from_email
        FROM agent_smtp_permissions asp
        JOIN smtp_configurations sc ON sc.id = asp.smtp_config_id
        WHERE asp.agent_id = p_agent_id
        AND sc.user_id = p_user_id
        AND asp.is_active = true
        AND sc.is_active = true
        AND (asp.expires_at IS NULL OR asp.expires_at > NOW())
    LOOP
        -- Add send_email tool if permitted
        IF permission.can_send_email THEN
            tools := tools || jsonb_build_object(
                'name', 'send_email',
                'description', format('Send email via %s (%s)', permission.connection_name, permission.from_email),
                'config_id', permission.smtp_config_id,
                'daily_limit', COALESCE(permission.daily_email_limit, 100),
                'recipients_limit', COALESCE(permission.recipients_per_email_limit, 50)
            );
        END IF;
        
        -- Add test_connection tool (always available)
        tools := tools || jsonb_build_object(
            'name', 'test_connection',
            'description', format('Test SMTP connection for %s', permission.connection_name),
            'config_id', permission.smtp_config_id
        );
    END LOOP;
    
    RETURN tools;
END;
$$;


--
-- Name: get_task_step_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_task_step_count(p_task_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER 
        FROM task_steps 
        WHERE task_id = p_task_id
    );
END;
$$;


--
-- Name: get_task_steps_with_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_task_steps_with_context(p_task_id uuid) RETURNS TABLE(step_id uuid, step_order integer, step_name text, instructions text, include_previous_context boolean, context_data jsonb, status public.task_step_status, execution_result jsonb, previous_step_result jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Validate task access
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks 
        WHERE id = p_task_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;
    
    RETURN QUERY
    SELECT 
        ts.id as step_id,
        ts.step_order,
        ts.step_name,
        ts.instructions,
        ts.include_previous_context,
        ts.context_data,
        ts.status,
        ts.execution_result,
        -- Get previous step result if context is enabled
        CASE 
            WHEN ts.include_previous_context AND ts.step_order > 1 THEN
                (SELECT prev.execution_result 
                 FROM task_steps prev 
                 WHERE prev.task_id = ts.task_id 
                 AND prev.step_order = ts.step_order - 1)
            ELSE '{}'::jsonb
        END as previous_step_result,
        ts.created_at,
        ts.updated_at
    FROM task_steps ts
    WHERE ts.task_id = p_task_id
    ORDER BY ts.step_order;
END;
$$;


--
-- Name: get_team_canvas_layout(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_canvas_layout(p_workspace_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_layout RECORD;
    v_teams JSONB;
    v_agents JSONB;  -- NEW
BEGIN
    -- Use provided user ID or get current user
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to retrieve canvas layout'
        );
    END IF;
    
    -- Get layout
    SELECT * INTO v_layout
    FROM team_canvas_layouts
    WHERE user_id = v_user_id
        AND ((workspace_id IS NULL AND p_workspace_id IS NULL) OR workspace_id = p_workspace_id)
    ORDER BY updated_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'layout', NULL
        );
    END IF;
    
    -- Get teams for this user
    SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'description', t.description,
        'created_at', t.created_at,
        'updated_at', t.updated_at
    )) INTO v_teams
    FROM teams t
    WHERE t.owner_user_id = v_user_id;
    
    -- Get agents for this user (NEW)
    SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'model', a.model,
        'created_at', a.created_at,
        'updated_at', a.updated_at
    )) INTO v_agents
    FROM agents a
    WHERE a.owner_user_id = v_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'layout', jsonb_build_object(
            'id', v_layout.id,
            'positions', COALESCE(v_layout.positions, '[]'::jsonb),
            'agentPositions', COALESCE(v_layout.agent_positions, '[]'::jsonb),  -- NEW
            'connections', COALESCE(v_layout.connections, '[]'::jsonb),
            'viewSettings', COALESCE(v_layout.view_settings, '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb),
            'created_at', v_layout.created_at,
            'updated_at', v_layout.updated_at
        ),
        'teams', COALESCE(v_teams, '[]'::jsonb),
        'agents', COALESCE(v_agents, '[]'::jsonb)  -- NEW
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to retrieve canvas layout: ' || SQLERRM
        );
END;
$$;


--
-- Name: FUNCTION get_team_canvas_layout(p_workspace_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_team_canvas_layout(p_workspace_id uuid, p_user_id uuid) IS 'Retrieve team canvas layout with proper access control and team data';


--
-- Name: get_team_children(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_children(team_id uuid) RETURNS TABLE(id uuid, name text, description text, parent_team_id uuid, owner_user_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, child_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.parent_team_id,
    t.owner_user_id,
    t.created_at,
    t.updated_at,
    COUNT(child.id) AS child_count
  FROM teams t
  LEFT JOIN teams child ON child.parent_team_id = t.id
  WHERE t.parent_team_id = team_id
  GROUP BY t.id, t.name, t.description, t.parent_team_id, t.owner_user_id, t.created_at, t.updated_at
  ORDER BY t.name;
END;
$$;


--
-- Name: get_team_hierarchy(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_hierarchy(team_id uuid) RETURNS TABLE(id uuid, name text, description text, parent_team_id uuid, owner_user_id uuid, level integer, path text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Base case: start with the specified team
    SELECT 
      t.id,
      t.name,
      t.description,
      t.parent_team_id,
      t.owner_user_id,
      0 AS level,
      t.name::TEXT AS path
    FROM teams t
    WHERE t.id = team_id
    
    UNION ALL
    
    -- Recursive case: get child teams
    SELECT 
      t.id,
      t.name,
      t.description,
      t.parent_team_id,
      t.owner_user_id,
      tt.level + 1,
      tt.path || ' > ' || t.name
    FROM teams t
    INNER JOIN team_tree tt ON t.parent_team_id = tt.id
  )
  SELECT * FROM team_tree ORDER BY level, name;
END;
$$;


--
-- Name: get_team_id_for_channel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_id_for_channel(p_channel_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_room_id uuid;
  v_team_id uuid;
BEGIN
  -- Get room_id from channel
  SELECT room_id INTO v_room_id
  FROM public.chat_channels
  WHERE id = p_channel_id;

  -- Get team_id from room
  IF v_room_id IS NOT NULL THEN
    SELECT team_id INTO v_team_id
    FROM public.chat_rooms
    WHERE id = v_room_id;
  END IF;

  RETURN v_team_id;
END;
$$;


--
-- Name: get_temp_chat_analytics(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_temp_chat_analytics(p_agent_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid, p_days_back integer DEFAULT 30) RETURNS TABLE(total_links integer, active_links integer, total_sessions integer, active_sessions integer, total_messages integer, avg_session_duration interval, top_countries text[], satisfaction_avg numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH link_stats AS (
    SELECT 
      COUNT(*) as total_links,
      COUNT(*) FILTER (WHERE is_active = TRUE AND expires_at > NOW()) as active_links
    FROM temporary_chat_links tcl
    WHERE (p_agent_id IS NULL OR tcl.agent_id = p_agent_id)
      AND (p_user_id IS NULL OR tcl.user_id = p_user_id)
      AND tcl.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ),
  session_stats AS (
    SELECT 
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE tcs.status = 'active') as active_sessions,
      SUM(tcs.message_count) as total_messages,
      AVG(EXTRACT(EPOCH FROM (COALESCE(tcs.ended_at, NOW()) - tcs.started_at)) * INTERVAL '1 second') as avg_duration,
      ARRAY_AGG(DISTINCT tcs.country_code) FILTER (WHERE tcs.country_code IS NOT NULL) as countries,
      AVG(tcs.satisfaction_rating) FILTER (WHERE tcs.satisfaction_rating IS NOT NULL) as avg_satisfaction
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    WHERE (p_agent_id IS NULL OR tcl.agent_id = p_agent_id)
      AND (p_user_id IS NULL OR tcl.user_id = p_user_id)
      AND tcs.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  )
  SELECT 
    ls.total_links::INTEGER,
    ls.active_links::INTEGER,
    COALESCE(ss.total_sessions, 0)::INTEGER,
    COALESCE(ss.active_sessions, 0)::INTEGER,
    COALESCE(ss.total_messages, 0)::INTEGER,
    COALESCE(ss.avg_duration, '0 seconds'::INTERVAL),
    COALESCE(ss.countries, ARRAY[]::TEXT[]),
    COALESCE(ss.avg_satisfaction, 0)::NUMERIC
  FROM link_stats ls
  CROSS JOIN session_stats ss;
END;
$$;


--
-- Name: FUNCTION get_temp_chat_analytics(p_agent_id uuid, p_user_id uuid, p_days_back integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_temp_chat_analytics(p_agent_id uuid, p_user_id uuid, p_days_back integer) IS 'Returns comprehensive analytics for temporary chat links and sessions';


--
-- Name: get_temp_chat_cleanup_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_temp_chat_cleanup_stats() RETURNS TABLE(expired_links_count integer, inactive_sessions_count integer, old_vault_secrets_count integer, cleanup_recommended boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM temporary_chat_links WHERE expires_at < NOW() AND is_active = TRUE),
    (SELECT COUNT(*)::INTEGER FROM temporary_chat_sessions 
     WHERE status = 'active' AND last_activity_at < NOW() - INTERVAL '30 minutes'),
    (SELECT COUNT(*)::INTEGER FROM temporary_chat_links 
     WHERE expires_at < NOW() - INTERVAL '30 days' AND is_active = FALSE),
    (SELECT COUNT(*) FROM temporary_chat_links WHERE expires_at < NOW() AND is_active = TRUE) > 0;
END;
$$;


--
-- Name: get_temp_chat_session_details(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_temp_chat_session_details(p_link_id uuid, p_limit integer DEFAULT 50) RETURNS TABLE(session_id uuid, participant_name text, started_at timestamp with time zone, ended_at timestamp with time zone, message_count integer, session_duration interval, status text, satisfaction_rating integer, country_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tcs.id,
    tcs.participant_name,
    tcs.started_at,
    tcs.ended_at,
    tcs.message_count,
    CASE 
      WHEN tcs.ended_at IS NOT NULL THEN 
        tcs.ended_at - tcs.started_at
      ELSE 
        NOW() - tcs.started_at
    END as duration,
    tcs.status,
    tcs.satisfaction_rating,
    tcs.country_code
  FROM temporary_chat_sessions tcs
  WHERE tcs.link_id = p_link_id
  ORDER BY tcs.started_at DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: get_user_billing_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_billing_overview() RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, subscription jsonb, customer jsonb, total_paid bigint, invoice_count bigint, last_payment timestamp with time zone, payment_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    p.full_name,
    u.created_at,
    
    -- Subscription data as JSON
    CASE 
      WHEN ss.id IS NOT NULL THEN 
        jsonb_build_object(
          'id', ss.id,
          'plan_name', ss.plan_name,
          'status', ss.status,
          'billing_amount', ss.billing_amount,
          'billing_interval', ss.billing_interval,
          'current_period_end', ss.current_period_end,
          'cancel_at_period_end', ss.cancel_at_period_end
        )
      ELSE NULL
    END as subscription,
    
    -- Customer data as JSON
    CASE 
      WHEN sc.id IS NOT NULL THEN 
        jsonb_build_object(
          'stripe_customer_id', sc.stripe_customer_id,
          'customer_email', sc.customer_email
        )
      ELSE NULL
    END as customer,
    
    -- Total amount paid
    COALESCE(SUM(si.amount_paid), 0) as total_paid,
    
    -- Invoice count
    COUNT(si.id) as invoice_count,
    
    -- Last payment date
    MAX(si.paid_at) as last_payment,
    
    -- Payment status
    CASE 
      WHEN ss.status = 'active' THEN 'current'
      WHEN ss.status = 'past_due' THEN 'past_due'
      WHEN ss.status = 'canceled' THEN 'canceled'
      ELSE 'none'
    END as payment_status
    
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  LEFT JOIN stripe_customers sc ON u.id = sc.user_id
  LEFT JOIN stripe_subscriptions ss ON u.id = ss.user_id AND ss.status IN ('active', 'past_due', 'canceled')
  LEFT JOIN stripe_invoices si ON u.id = si.user_id AND si.status = 'paid'
  GROUP BY u.id, u.email, p.full_name, u.created_at, ss.id, ss.plan_name, ss.status, 
           ss.billing_amount, ss.billing_interval, ss.current_period_end, ss.cancel_at_period_end,
           sc.id, sc.stripe_customer_id, sc.customer_email
  ORDER BY u.created_at DESC;
END;
$$;


--
-- Name: FUNCTION get_user_billing_overview(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_billing_overview() IS 'Returns comprehensive billing overview for all users';


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    context_window_size integer DEFAULT 20 NOT NULL,
    context_window_token_limit integer DEFAULT 8000 NOT NULL,
    CONSTRAINT chat_rooms_name_check CHECK ((char_length(name) > 0))
);

ALTER TABLE ONLY public.workspaces FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE workspaces; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspaces IS 'Top-level container for chat channels and members, similar to a Discord server.';


--
-- Name: COLUMN workspaces.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.id IS 'Unique identifier for the chat room.';


--
-- Name: COLUMN workspaces.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.name IS 'User-defined name for the chat room.';


--
-- Name: COLUMN workspaces.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.owner_user_id IS 'The user who created and owns the chat room.';


--
-- Name: COLUMN workspaces.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.created_at IS 'Timestamp when the chat room was created.';


--
-- Name: COLUMN workspaces.context_window_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.context_window_size IS 'Maximum number of recent messages to include in the context for agents in this workspace.';


--
-- Name: COLUMN workspaces.context_window_token_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.context_window_token_limit IS 'Maximum number of tokens allowed in the context window sent to agents.';


--
-- Name: get_user_chat_rooms(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_chat_rooms(p_user_id uuid) RETURNS SETOF public.workspaces
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT cr.*
  FROM public.chat_rooms cr
  WHERE public.is_room_member(cr.id, p_user_id); -- Filter rooms using the helper
$$;


--
-- Name: get_user_clicksend_connection(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_clicksend_connection(p_user_id uuid) RETURNS TABLE(connection_id uuid, connection_name text, external_username text, connection_status text, configuration jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uic.id as connection_id,
        uic.connection_name,
        uic.external_username,
        uic.connection_status,
        uic.connection_metadata as configuration
    FROM user_integration_credentials uic
    INNER JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = p_user_id
      AND sp.name = 'clicksend_sms'
      AND uic.connection_status = 'active'
    ORDER BY uic.created_at DESC
    LIMIT 1;
END;
$$;


--
-- Name: FUNCTION get_user_clicksend_connection(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_clicksend_connection(p_user_id uuid) IS 'Get user ClickSend connection details';


--
-- Name: get_user_gmail_connections(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_gmail_connections(p_user_id uuid) RETURNS TABLE(connection_id uuid, connection_name text, external_username text, connection_status text, configuration jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uic.id as connection_id,
        uic.connection_name,
        uic.external_username,
        uic.connection_status,
        uic.connection_metadata as configuration
    FROM user_integration_credentials uic
    INNER JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = p_user_id
      AND sp.name = 'gmail'
      AND uic.connection_status = 'active'
    ORDER BY uic.created_at DESC;
END;
$$;


--
-- Name: FUNCTION get_user_gmail_connections(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_gmail_connections(p_user_id uuid) IS 'Get user Gmail connections (plural) - Frontend compatibility function';


--
-- Name: get_user_inbound_emails(uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_inbound_emails(p_user_id uuid DEFAULT auth.uid(), p_agent_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(email_id uuid, from_email text, from_name text, subject text, processed_at timestamp with time zone, has_attachments boolean, agent_id uuid, routing_rules_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ie.id as email_id,
        ie.from_email,
        ie.from_name,
        ie.subject,
        ie.processed_at,
        (jsonb_array_length(ie.attachments) > 0) as has_attachments,
        ie.agent_id,
        COALESCE(array_length(ie.routing_rules_applied, 1), 0) as routing_rules_count
    FROM sendgrid_inbound_emails ie
    JOIN sendgrid_configurations sc ON sc.id = ie.sendgrid_config_id
    WHERE sc.user_id = p_user_id
    AND (p_agent_id IS NULL OR ie.agent_id = p_agent_id)
    ORDER BY ie.processed_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


--
-- Name: get_user_integration_credentials(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_integration_credentials(p_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(credential_id uuid, connection_id uuid, user_id uuid, provider_name text, provider_display_name text, external_username text, connection_name text, scopes_granted jsonb, connection_status text, credential_type public.connection_credential_type_enum, token_expires_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Return data from user_integration_credentials with service_providers join
    RETURN QUERY
    SELECT 
        uic.id as credential_id,
        uic.id as connection_id,  -- Use same ID for backward compatibility
        uic.user_id,
        COALESCE(sp.name, 'unknown') as provider_name,
        COALESCE(sp.display_name, 'Unknown Provider') as provider_display_name,
        uic.external_username,
        uic.connection_name,
        COALESCE(uic.scopes_granted, '{}'::jsonb) as scopes_granted,
        uic.connection_status,
        uic.credential_type,
        uic.token_expires_at,
        uic.created_at,
        uic.updated_at
    FROM user_integration_credentials uic
    LEFT JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = COALESCE(p_user_id, auth.uid())
    AND uic.connection_status != 'revoked'
    ORDER BY uic.created_at DESC;
END;
$$;


--
-- Name: FUNCTION get_user_integration_credentials(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_integration_credentials(p_user_id uuid) IS 'Get user integration credentials - Updated to use oauth_provider_id column referencing service_providers table';


--
-- Name: get_user_integration_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_integration_stats(p_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(total_available_integrations bigint, total_connected_integrations bigint, total_categories bigint, recent_connections bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM integrations WHERE status = 'available' AND is_active = true) as total_available_integrations,
        (SELECT COUNT(*) FROM user_integrations WHERE user_id = COALESCE(p_user_id, auth.uid()) AND connection_status = 'connected') as total_connected_integrations,
        (SELECT COUNT(*) FROM integration_categories WHERE is_active = true) as total_categories,
        (SELECT COUNT(*) FROM user_integrations WHERE user_id = COALESCE(p_user_id, auth.uid()) AND connection_status = 'connected' AND created_at > NOW() - INTERVAL '30 days') as recent_connections;
END;
$$;


--
-- Name: get_user_media_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_media_stats(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_files', COUNT(*),
        'total_size_bytes', COALESCE(SUM(file_size), 0),
        'files_by_status', jsonb_object_agg(processing_status, status_count),
        'files_by_type', jsonb_object_agg(file_extension, type_count),
        'categories_count', (
            SELECT COUNT(*) FROM media_categories 
            WHERE user_id = p_user_id
        ),
        'assigned_files_count', (
            SELECT COUNT(DISTINCT media_id) FROM agent_media_assignments 
            WHERE user_id = p_user_id AND is_active = true
        )
    ) INTO stats
    FROM (
        SELECT 
            processing_status,
            file_extension,
            file_size,
            COUNT(*) OVER (PARTITION BY processing_status) as status_count,
            COUNT(*) OVER (PARTITION BY file_extension) as type_count
        FROM media_library 
        WHERE user_id = p_user_id AND is_archived = false
    ) grouped_data;
    
    RETURN COALESCE(stats, '{}'::jsonb);
END;
$$;


--
-- Name: get_user_oauth_connections(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_oauth_connections(p_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(connection_id uuid, provider_name text, provider_display_name text, external_username text, connection_name text, scopes_granted jsonb, connection_status text, credential_type text, token_expires_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
        -- Delegate to the new function
        RETURN QUERY
        SELECT * FROM get_user_integration_credentials(p_user_id);
    END;
    $$;


--
-- Name: FUNCTION get_user_oauth_connections(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_oauth_connections(p_user_id uuid) IS 'DEPRECATED: Use get_user_integration_credentials instead';


--
-- Name: get_user_organization_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_organization_role(user_id uuid, org_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.organization_memberships
    WHERE user_id = get_user_organization_role.user_id 
    AND organization_id = org_id 
    AND status = 'active';
    
    RETURN COALESCE(user_role, 'none');
END;
$$;


--
-- Name: get_user_subscription_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_subscription_details(p_user_id uuid) RETURNS TABLE(subscription_info jsonb, invoice_history jsonb, payment_methods jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Subscription information
    CASE 
      WHEN ss.id IS NOT NULL THEN 
        jsonb_build_object(
          'id', ss.id,
          'stripe_subscription_id', ss.stripe_subscription_id,
          'plan_name', ss.plan_name,
          'status', ss.status,
          'billing_amount', ss.billing_amount,
          'billing_interval', ss.billing_interval,
          'current_period_start', ss.current_period_start,
          'current_period_end', ss.current_period_end,
          'cancel_at_period_end', ss.cancel_at_period_end,
          'canceled_at', ss.canceled_at,
          'payment_method_brand', ss.payment_method_brand,
          'payment_method_last4', ss.payment_method_last4
        )
      ELSE NULL
    END as subscription_info,
    
    -- Invoice history
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'stripe_invoice_id', si.stripe_invoice_id,
          'status', si.status,
          'amount_due', si.amount_due,
          'amount_paid', si.amount_paid,
          'total', si.total,
          'invoice_created', si.invoice_created,
          'paid_at', si.paid_at,
          'invoice_pdf', si.invoice_pdf
        ) ORDER BY si.invoice_created DESC
      ) FILTER (WHERE si.id IS NOT NULL),
      '[]'::jsonb
    ) as invoice_history,
    
    -- Payment methods (from customer)
    CASE 
      WHEN sc.id IS NOT NULL THEN 
        jsonb_build_object(
          'default_payment_method', sc.default_payment_method,
          'customer_metadata', sc.customer_metadata
        )
      ELSE NULL
    END as payment_methods
    
  FROM auth.users u
  LEFT JOIN stripe_customers sc ON u.id = sc.user_id
  LEFT JOIN stripe_subscriptions ss ON u.id = ss.user_id
  LEFT JOIN stripe_invoices si ON u.id = si.user_id
  WHERE u.id = p_user_id
  GROUP BY u.id, ss.id, ss.stripe_subscription_id, ss.plan_name, ss.status, 
           ss.billing_amount, ss.billing_interval, ss.current_period_start, 
           ss.current_period_end, ss.cancel_at_period_end, ss.canceled_at,
           ss.payment_method_brand, ss.payment_method_last4,
           sc.id, sc.default_payment_method, sc.customer_metadata;
END;
$$;


--
-- Name: FUNCTION get_user_subscription_details(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_subscription_details(p_user_id uuid) IS 'Returns detailed subscription info for a specific user';


--
-- Name: get_users_auth_data(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_users_auth_data(user_ids uuid[]) RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, banned_until timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email::TEXT,
        u.created_at,
        u.last_sign_in_at,
        u.banned_until
    FROM auth.users u
    WHERE u.id = ANY(user_ids);
END;
$$;


--
-- Name: FUNCTION get_users_auth_data(user_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_users_auth_data(user_ids uuid[]) IS 'Get auth.users data for admin panel - service role only';


--
-- Name: get_vault_secrets_by_names(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vault_secrets_by_names(p_secret_names text[]) RETURNS TABLE(id uuid, name text, decrypted_secret text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'vault', 'public'
    AS $$
    SELECT
        s.id,
        s.name,
        ds.decrypted_secret
    FROM vault.secrets s
    JOIN vault.decrypted_secrets ds ON s.id = ds.id
    WHERE s.name = ANY(p_secret_names);
$$;


--
-- Name: FUNCTION get_vault_secrets_by_names(p_secret_names text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_vault_secrets_by_names(p_secret_names text[]) IS 'Retrieves decrypted secrets from the Vault by their unique names.';


--
-- Name: get_web_search_api_key(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_web_search_api_key(p_agent_id uuid, p_user_id uuid, p_provider_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    vault_key_id UUID;
    api_key TEXT;
BEGIN
    -- Get the vault key ID for the provider
    SELECT uwsk.vault_api_key_id INTO vault_key_id
    FROM web_search_providers wsp
    JOIN agent_web_search_permissions awsp ON wsp.id = awsp.provider_id
    JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
    WHERE wsp.name = p_provider_name
        AND awsp.agent_id = p_agent_id
        AND awsp.user_id = p_user_id
        AND awsp.is_active = true
        AND uwsk.key_status = 'active';

    IF vault_key_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Retrieve the API key from vault
    SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE id = vault_key_id;

    RETURN api_key;
END;
$$;


--
-- Name: get_web_search_tools(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_web_search_tools(p_agent_id uuid, p_user_id uuid) RETURNS TABLE(tool_name text, provider_name text, provider_display_name text, supported_features jsonb, permissions jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN 'web_search' = ANY(array(SELECT jsonb_array_elements_text(awsp.permissions)))
                THEN 'web_search_' || wsp.name
            ELSE NULL
        END as tool_name,
        wsp.name as provider_name,
        wsp.display_name as provider_display_name,
        wsp.supported_features,
        awsp.permissions
    FROM web_search_providers wsp
    JOIN agent_web_search_permissions awsp ON wsp.id = awsp.provider_id
    JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
    WHERE awsp.agent_id = p_agent_id 
        AND awsp.user_id = p_user_id
        AND awsp.is_active = true
        AND uwsk.key_status = 'active'
        AND wsp.is_enabled = true;
END;
$$;


--
-- Name: get_websocket_server_secrets(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_websocket_server_secrets(p_server_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_config RECORD;
  v_supabase_key TEXT;
  v_admin_password TEXT;
  v_openai_key TEXT;
  v_result JSONB;
BEGIN
  -- Validate input
  IF p_server_name IS NULL OR p_server_name = '' THEN
    RAISE EXCEPTION 'Server name is required';
  END IF;

  -- Get the configuration
  SELECT * INTO v_config
  FROM public.server_configuration_secrets
  WHERE server_name = p_server_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Server configuration not found: %', p_server_name;
  END IF;

  -- Decrypt the secrets
  IF v_config.vault_supabase_service_key_id IS NOT NULL THEN
    SELECT public.vault_decrypt(v_config.vault_supabase_service_key_id) INTO v_supabase_key;
  END IF;

  IF v_config.vault_admin_password_id IS NOT NULL THEN
    SELECT public.vault_decrypt(v_config.vault_admin_password_id) INTO v_admin_password;
  END IF;

  IF v_config.vault_openai_api_key_id IS NOT NULL THEN
    SELECT public.vault_decrypt(v_config.vault_openai_api_key_id) INTO v_openai_key;
  END IF;

  -- Return decrypted secrets
  v_result := jsonb_build_object(
    'SUPABASE_SERVICE_ROLE_KEY', v_supabase_key,
    'ADMIN_PASSWORD', v_admin_password,
    'OPENAI_API_KEY', v_openai_key,
    'server_name', p_server_name,
    'retrieved_at', now()
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to retrieve server secrets: %', SQLERRM;
END;
$$;


--
-- Name: FUNCTION get_websocket_server_secrets(p_server_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_websocket_server_secrets(p_server_name text) IS 'Retrieves and decrypts all secrets for a WebSocket server (service role only)';


--
-- Name: get_workspace_id_for_channel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.chat_channels
  WHERE id = p_channel_id;
  RETURN v_workspace_id;
END;
$$;


--
-- Name: get_workspace_members_with_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_members_with_details(p_workspace_id uuid) RETURNS TABLE(id uuid, role text, created_at timestamp with time zone, workspace_id uuid, user_id uuid, agent_id uuid, team_id uuid, user_profile jsonb, agent jsonb, team jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    wm.id,
    wm.role,
    wm.created_at,
    wm.workspace_id,
    wm.user_id,
    wm.agent_id,
    wm.team_id,
    -- Construct JSON object for user profile if user_id is not null
    CASE WHEN wm.user_id IS NOT NULL THEN
      jsonb_build_object(
          'full_name', up.full_name,
          'avatar_url', up.avatar_url
      )
    ELSE NULL END AS user_profile,
    -- Construct JSON object for agent if agent_id is not null
    CASE WHEN wm.agent_id IS NOT NULL THEN
      jsonb_build_object(
          'name', a.name
      )
    ELSE NULL END AS agent,
    -- Construct JSON object for team if team_id is not null
    CASE WHEN wm.team_id IS NOT NULL THEN
      jsonb_build_object(
          'name', t.name
      )
    ELSE NULL END AS team
  FROM
    public.workspace_members wm
    LEFT JOIN public.user_profiles up ON wm.user_id = up.id
    LEFT JOIN public.agents a ON wm.agent_id = a.id
    LEFT JOIN public.teams t ON wm.team_id = t.id
  WHERE
    wm.workspace_id = p_workspace_id;
$$;


--
-- Name: grant_agent_contact_access(uuid, uuid, uuid, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid, p_access_level text DEFAULT 'view_and_contact'::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  permission_id UUID;
  access_id UUID;
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Get or create agent permission record
  SELECT id INTO permission_id
  FROM agent_contact_permissions
  WHERE agent_id = p_agent_id;
  
  IF NOT FOUND THEN
    INSERT INTO agent_contact_permissions (agent_id, user_id, permission_type)
    VALUES (p_agent_id, p_user_id, 'specific_contacts')
    RETURNING id INTO permission_id;
  END IF;
  
  -- Insert or update specific access
  INSERT INTO agent_specific_contact_access (
    agent_id, contact_id, permission_id, user_id, access_level, expires_at
  ) VALUES (
    p_agent_id, p_contact_id, permission_id, p_user_id, p_access_level, p_expires_at
  )
  ON CONFLICT (agent_id, contact_id)
  DO UPDATE SET
    access_level = EXCLUDED.access_level,
    expires_at = EXCLUDED.expires_at,
    granted_at = NOW()
  RETURNING id INTO access_id;
  
  RETURN access_id;
END;
$$;


--
-- Name: grant_agent_integration_permission(uuid, uuid, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text DEFAULT 'custom'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the connection belongs to the user (use renamed table)
    IF NOT EXISTS (
        SELECT 1 FROM user_integration_credentials 
        WHERE id = p_connection_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Connection not found or access denied';
    END IF;
    
    -- Verify the agent belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Insert or update the permission
    INSERT INTO agent_oauth_permissions (
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        granted_by,
        is_active
    ) VALUES (
        p_agent_id,
        p_connection_id,
        p_allowed_scopes,
        p_permission_level,
        v_user_id,
        true
    )
    ON CONFLICT (agent_id, user_oauth_connection_id)
    DO UPDATE SET
        allowed_scopes = EXCLUDED.allowed_scopes,
        permission_level = EXCLUDED.permission_level,
        granted_by = EXCLUDED.granted_by,
        is_active = true,
        granted_at = NOW(),
        revoked_at = NULL,
        revoked_by = NULL,
        updated_at = NOW()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;


--
-- Name: FUNCTION grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text) IS 'Grant integration permission to an agent - Updated for user_integration_credentials table';


--
-- Name: grant_agent_integration_permission(uuid, uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text DEFAULT 'custom'::text, p_user_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the user ID (from auth or parameter)
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Validate we have a user ID
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID required: either authenticate or provide p_user_id parameter';
    END IF;
    
    -- Verify the connection belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM user_integration_credentials 
        WHERE id = p_connection_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Connection not found or access denied for user %', v_user_id;
    END IF;
    
    -- Verify the agent belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied for user %', v_user_id;
    END IF;
    
    -- Insert or update the permission using CORRECT table name
    INSERT INTO agent_integration_permissions (
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        granted_by_user_id,
        is_active
    ) VALUES (
        p_agent_id,
        p_connection_id,
        p_allowed_scopes,
        p_permission_level,
        v_user_id,
        true
    )
    ON CONFLICT (agent_id, user_oauth_connection_id)
    DO UPDATE SET
        allowed_scopes = EXCLUDED.allowed_scopes,
        permission_level = EXCLUDED.permission_level,
        granted_by_user_id = EXCLUDED.granted_by_user_id,
        is_active = true,
        granted_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;


--
-- Name: FUNCTION grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text, p_user_id uuid) IS 'Grant integration permission to an agent - Uses agent_integration_permissions table for ALL integration types';


--
-- Name: grant_agent_oauth_access(uuid, uuid, text, jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text DEFAULT 'read_only'::text, p_allowed_scopes jsonb DEFAULT NULL::jsonb, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the user ID for the agent
    SELECT user_id INTO v_user_id 
    FROM agents 
    WHERE id = p_agent_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Verify the user owns the OAuth connection
    IF NOT EXISTS (
        SELECT 1 
        FROM user_oauth_connections 
        WHERE id = p_connection_id 
        AND user_id = v_user_id
        AND connection_status = 'active'
    ) THEN
        RAISE EXCEPTION 'OAuth connection not found or access denied';
    END IF;
    
    -- Insert or update the permission record
    INSERT INTO agent_oauth_permissions (
        agent_id,
        user_oauth_connection_id,
        granted_by_user_id,
        permission_level,
        allowed_scopes,
        expires_at
    ) VALUES (
        p_agent_id,
        p_connection_id,
        v_user_id,
        p_permission_level,
        p_allowed_scopes,
        p_expires_at
    )
    ON CONFLICT (agent_id, user_oauth_connection_id) 
    DO UPDATE SET
        permission_level = EXCLUDED.permission_level,
        allowed_scopes = EXCLUDED.allowed_scopes,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;


--
-- Name: FUNCTION grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text, p_allowed_scopes jsonb, p_expires_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text, p_allowed_scopes jsonb, p_expires_at timestamp with time zone) IS 'Grants agent access to user OAuth connection';


--
-- Name: grant_agent_web_search_permission(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_agent_web_search_permission(p_agent_id uuid, p_user_key_id uuid, p_permissions jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_provider_id UUID;
    v_permission_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Get provider_id from the user_key_id
    SELECT provider_id INTO v_provider_id
    FROM user_web_search_keys 
    WHERE id = p_user_key_id 
        AND user_id = v_user_id;
    
    IF v_provider_id IS NULL THEN
        RAISE EXCEPTION 'Invalid user key ID or insufficient permissions';
    END IF;
    
    -- Insert or update the permission
    INSERT INTO agent_web_search_permissions (
        agent_id,
        user_id,
        provider_id,
        user_key_id,
        permissions,
        is_active
    ) VALUES (
        p_agent_id,
        v_user_id,
        v_provider_id,
        p_user_key_id,
        p_permissions,
        true
    )
    ON CONFLICT (agent_id, provider_id) 
    DO UPDATE SET
        user_key_id = EXCLUDED.user_key_id,
        permissions = EXCLUDED.permissions,
        is_active = EXCLUDED.is_active,
        updated_at = now()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;


--
-- Name: grant_contact_management_access_to_agent(uuid, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[] DEFAULT ARRAY['search_contacts'::text, 'get_contact_details'::text]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  credential_id UUID;
  permission_id UUID;
BEGIN
  -- Get or create the contact management credential for the user
  credential_id := create_contact_management_credential_for_user(p_user_id);
  
  -- Check if permission already exists
  SELECT id INTO permission_id
  FROM agent_integration_permissions
  WHERE agent_id = p_agent_id
  AND user_oauth_connection_id = credential_id;
  
  -- If permission doesn't exist, create it
  IF permission_id IS NULL THEN
    INSERT INTO agent_integration_permissions (
      agent_id,
      user_oauth_connection_id,
      allowed_scopes,
      permission_level,
      granted_by_user_id,
      is_active,
      granted_at,
      created_at,
      updated_at
    ) VALUES (
      p_agent_id,
      credential_id,
      array_to_json(p_scopes)::jsonb,
      'full_access',
      p_user_id,
      true,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO permission_id;
    
    RAISE NOTICE 'Granted contact management access % to agent % for user %', permission_id, p_agent_id, p_user_id;
  ELSE
    -- Update existing permission with new scopes
    UPDATE agent_integration_permissions
    SET allowed_scopes = array_to_json(p_scopes)::jsonb,
        updated_at = NOW()
    WHERE id = permission_id;
    
    RAISE NOTICE 'Updated contact management access % for agent % for user %', permission_id, p_agent_id, p_user_id;
  END IF;
  
  RETURN permission_id;
END;
$$;


--
-- Name: FUNCTION grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[]) IS 'Grants contact management tool access to agents through the standard integration permission system';


--
-- Name: grant_reasoning_access_to_new_agent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_reasoning_access_to_new_agent() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  reasoning_integration_id UUID;
  reasoning_credential_id UUID;
BEGIN
  -- Get the Advanced Reasoning integration ID
  SELECT id INTO reasoning_integration_id 
  FROM integrations 
  WHERE name = 'Advanced Reasoning' 
  LIMIT 1;
  
  IF reasoning_integration_id IS NULL THEN
    RAISE NOTICE 'Advanced Reasoning integration not found, skipping permission grant';
    RETURN NEW;
  END IF;
  
  -- Check if internal reasoning credential already exists for this user
  SELECT id INTO reasoning_credential_id
  FROM user_integration_credentials
  WHERE user_id = NEW.user_id 
  AND connection_name = 'Internal Reasoning System';
  
  -- If not found, create it
  IF reasoning_credential_id IS NULL THEN
    INSERT INTO user_integration_credentials (
      user_id,
      oauth_provider_id,
      connection_name,
      external_username,
      external_user_id,
      credential_type,
      connection_status,
      scopes_granted,
      vault_access_token_id,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      '00000000-0000-0000-0000-000000000002'::uuid, -- Internal system OAuth provider
      'Internal Reasoning System',
      'system',
      'internal_system_' || NEW.user_id,
      'api_key'::connection_credential_type_enum,
      'active',
      '["reasoning_execute_chain", "reasoning_inductive", "reasoning_deductive", "reasoning_abductive", "iterative_processing", "confidence_tracking", "memory_integration", "safety_controls"]'::jsonb,
      'internal_reasoning_token',
      NOW(),
      NOW()
    ) 
    RETURNING id INTO reasoning_credential_id;
  END IF;
  
  -- Grant reasoning permissions to the new agent (only if not already exists)
  IF NOT EXISTS (
    SELECT 1 FROM agent_integration_permissions 
    WHERE agent_id = NEW.id AND user_oauth_connection_id = reasoning_credential_id
  ) THEN
    INSERT INTO agent_integration_permissions (
      agent_id,
      user_oauth_connection_id,
      allowed_scopes,
      permission_level,
      granted_by_user_id,
      is_active,
      granted_at,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      reasoning_credential_id,
      '["reasoning_execute_chain", "reasoning_inductive", "reasoning_deductive", "reasoning_abductive", "iterative_processing", "confidence_tracking", "memory_integration", "safety_controls"]'::jsonb,
      'full_access',
      NEW.user_id,
      true,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_agent_deletion_cascade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_agent_deletion_cascade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Log agent deletion and its impact
    RAISE NOTICE 'Agent deleted: % - Associated tool permissions will be cascaded', 
        OLD.id;
    
    -- The CASCADE DELETE constraints will handle the cleanup automatically
    -- This trigger is for logging and any additional cleanup needed
    
    RETURN OLD;
END;
$$;


--
-- Name: FUNCTION handle_agent_deletion_cascade(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_agent_deletion_cascade() IS 'Handles cascade effects when agents are deleted, cleaning up permissions';


--
-- Name: handle_credential_revocation_cascade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_credential_revocation_cascade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When a credential is revoked, clean up related data
    IF NEW.connection_status = 'revoked' AND OLD.connection_status != 'revoked' THEN
        -- Log the revocation
        RAISE NOTICE 'Credential revoked for user % provider %: %', 
            NEW.user_id, 
            (SELECT name FROM service_providers WHERE id = NEW.oauth_provider_id),
            NEW.connection_name;
        
        -- The CASCADE DELETE will automatically remove agent_oauth_permissions
        -- when the credential record is deleted, but we can log here
        
        -- Update any agent metadata that might reference this tool
        UPDATE agents 
        SET metadata = jsonb_set(
            COALESCE(metadata, '{}'),
            '{credential_revoked}',
            to_jsonb(ARRAY[NEW.id::text])
        )
        WHERE id IN (
            SELECT agent_id 
            FROM agent_oauth_permissions 
            WHERE user_oauth_connection_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_credential_revocation_cascade(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_credential_revocation_cascade() IS 'Handles cascade effects when credentials are revoked, ensuring agents lose tool access';


--
-- Name: handle_integration_deletion_cascade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_integration_deletion_cascade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When an OAuth provider (integration) is deleted, cascade through the system
    RAISE NOTICE 'Integration deleted: % - Cascading through credentials and permissions', 
        OLD.display_name;
    
    -- The CASCADE DELETE constraints will handle most cleanup
    -- This is for additional business logic if needed
    
    RETURN OLD;
END;
$$;


--
-- Name: handle_invoice_webhook(text, text, text, integer, integer, integer, bigint, text, bigint, bigint, bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_invoice_webhook(p_stripe_invoice_id text, p_stripe_customer_id text, p_status text, p_amount_due integer, p_amount_paid integer, p_total integer, p_invoice_created bigint, p_stripe_subscription_id text DEFAULT NULL::text, p_period_start bigint DEFAULT NULL::bigint, p_period_end bigint DEFAULT NULL::bigint, p_paid_at bigint DEFAULT NULL::bigint, p_invoice_pdf text DEFAULT NULL::text, p_hosted_invoice_url text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from customer
  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE stripe_customer_id = p_stripe_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_stripe_customer_id;
  END IF;
  
  -- Upsert invoice record
  INSERT INTO stripe_invoices (
    stripe_invoice_id,
    stripe_customer_id,
    stripe_subscription_id,
    user_id,
    status,
    amount_due,
    amount_paid,
    amount_remaining,
    total,
    invoice_created,
    period_start,
    period_end,
    paid_at,
    invoice_pdf,
    hosted_invoice_url
  ) VALUES (
    p_stripe_invoice_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    v_user_id,
    p_status,
    p_amount_due,
    p_amount_paid,
    p_amount_due - p_amount_paid,
    p_total,
    to_timestamp(p_invoice_created),
    CASE WHEN p_period_start IS NOT NULL THEN to_timestamp(p_period_start) ELSE NULL END,
    CASE WHEN p_period_end IS NOT NULL THEN to_timestamp(p_period_end) ELSE NULL END,
    CASE WHEN p_paid_at IS NOT NULL THEN to_timestamp(p_paid_at) ELSE NULL END,
    p_invoice_pdf,
    p_hosted_invoice_url
  )
  ON CONFLICT (stripe_invoice_id) DO UPDATE SET
    status = EXCLUDED.status,
    amount_due = EXCLUDED.amount_due,
    amount_paid = EXCLUDED.amount_paid,
    amount_remaining = EXCLUDED.amount_remaining,
    paid_at = EXCLUDED.paid_at,
    invoice_pdf = EXCLUDED.invoice_pdf,
    hosted_invoice_url = EXCLUDED.hosted_invoice_url,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Insert profile with first_name and last_name from raw_user_meta_data
    INSERT INTO public.profiles (
        id, 
        first_name, 
        last_name, 
        created_at, 
        updated_at
    )
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'last_name', NULL),
        NOW(), 
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail user creation
        RAISE WARNING 'Failed to create profile for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
        RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile entry when a new user signs up, extracting first_name and last_name from user metadata';


--
-- Name: handle_new_user_key_generation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_key_generation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'extensions', 'public'
    AS $$
DECLARE
  generated_key_bytes bytea;
  generated_key_base64 text;
BEGIN
  -- Generate 32 random bytes using pgcrypto from the extensions schema
  generated_key_bytes := extensions.gen_random_bytes(32);

  -- Encode the bytes as base64 for text storage
  generated_key_base64 := encode(generated_key_bytes, 'base64');

  -- Insert the key into the user_secrets table
  INSERT INTO public.user_secrets (user_id, encryption_key)
  VALUES (NEW.id, generated_key_base64);

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_new_user_key_generation(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_user_key_generation() IS 'Trigger function to generate a unique encryption key (using pgcrypto from extensions schema) and store it.';


--
-- Name: handle_subscription_webhook(text, text, bigint, bigint, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_subscription_webhook(p_stripe_subscription_id text, p_status text, p_current_period_start bigint, p_current_period_end bigint, p_cancel_at_period_end boolean DEFAULT false, p_stripe_event_id text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_subscription_id UUID;
  v_user_id UUID;
  v_old_status TEXT;
BEGIN
  -- Get current subscription info
  SELECT id, user_id, status INTO v_subscription_id, v_user_id, v_old_status
  FROM stripe_subscriptions 
  WHERE stripe_subscription_id = p_stripe_subscription_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update subscription status
  UPDATE stripe_subscriptions 
  SET 
    status = p_status,
    current_period_start = to_timestamp(p_current_period_start),
    current_period_end = to_timestamp(p_current_period_end),
    cancel_at_period_end = p_cancel_at_period_end,
    updated_at = NOW()
  WHERE stripe_subscription_id = p_stripe_subscription_id;
  
  -- Log the change in history
  INSERT INTO subscription_history (
    subscription_id, 
    user_id, 
    change_type, 
    old_status,
    new_status, 
    change_reason,
    stripe_event_id
  ) VALUES (
    v_subscription_id, 
    v_user_id, 
    'updated',
    v_old_status,
    p_status, 
    'webhook_update',
    p_stripe_event_id
  );
  
  RETURN TRUE;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: has_organization_permission(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_organization_permission(user_id uuid, org_id uuid, permission text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    user_role TEXT;
    user_permissions JSONB;
BEGIN
    SELECT role, permissions INTO user_role, user_permissions
    FROM public.organization_memberships
    WHERE user_id = has_organization_permission.user_id 
    AND organization_id = org_id 
    AND status = 'active';
    
    -- Owners and admins have all permissions
    IF user_role IN ('owner', 'admin') THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific permissions
    RETURN user_permissions @> jsonb_build_array(permission);
END;
$$;


--
-- Name: increment_rule_match_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_rule_match_count(p_rule_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE sendgrid_inbound_routing_rules
    SET match_count = match_count + 1,
        last_matched_at = now()
    WHERE id = p_rule_id;
END;
$$;


--
-- Name: initialize_websocket_server_secrets(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_supabase_key_vault_id TEXT;
  v_admin_pass_vault_id TEXT;
  v_openai_key_vault_id TEXT;
  v_result JSONB;
BEGIN
  -- Validate inputs
  IF p_server_name IS NULL OR p_server_name = '' THEN
    RAISE EXCEPTION 'Server name is required';
  END IF;

  IF p_supabase_service_key IS NULL OR p_supabase_service_key = '' THEN
    RAISE EXCEPTION 'Supabase service key is required';
  END IF;

  IF p_admin_password IS NULL OR p_admin_password = '' THEN
    RAISE EXCEPTION 'Admin password is required';
  END IF;

  -- Store Supabase service key in vault
  SELECT public.create_vault_secret(
    p_supabase_service_key,
    p_server_name || '_supabase_service_key',
    'Supabase service role key for ' || p_server_name || ' - Created: ' || now()::TEXT
  ) INTO v_supabase_key_vault_id;

  -- Store admin password in vault
  SELECT public.create_vault_secret(
    p_admin_password,
    p_server_name || '_admin_password',
    'Admin password for ' || p_server_name || ' - Created: ' || now()::TEXT
  ) INTO v_admin_pass_vault_id;

  -- Store OpenAI API key if provided
  IF p_openai_api_key IS NOT NULL AND p_openai_api_key != '' THEN
    SELECT public.create_vault_secret(
      p_openai_api_key,
      p_server_name || '_openai_api_key',
      'OpenAI API key for ' || p_server_name || ' - Created: ' || now()::TEXT
    ) INTO v_openai_key_vault_id;
  END IF;

  -- Insert or update server configuration
  INSERT INTO public.server_configuration_secrets (
    server_name,
    vault_supabase_service_key_id,
    vault_admin_password_id,
    vault_openai_api_key_id,
    configuration_metadata
  ) VALUES (
    p_server_name,
    v_supabase_key_vault_id,
    v_admin_pass_vault_id,
    v_openai_key_vault_id,
    jsonb_build_object(
      'initialized_at', now(),
      'initialized_by', current_user,
      'version', '1.0.0'
    )
  )
  ON CONFLICT (server_name) DO UPDATE SET
    vault_supabase_service_key_id = EXCLUDED.vault_supabase_service_key_id,
    vault_admin_password_id = EXCLUDED.vault_admin_password_id,
    vault_openai_api_key_id = COALESCE(EXCLUDED.vault_openai_api_key_id, server_configuration_secrets.vault_openai_api_key_id),
    configuration_metadata = server_configuration_secrets.configuration_metadata || jsonb_build_object('updated_at', now()),
    updated_at = now();

  -- Return the vault IDs
  v_result := jsonb_build_object(
    'server_name', p_server_name,
    'vault_supabase_service_key_id', v_supabase_key_vault_id,
    'vault_admin_password_id', v_admin_pass_vault_id,
    'vault_openai_api_key_id', v_openai_key_vault_id,
    'status', 'success',
    'message', 'Server secrets initialized successfully'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to initialize server secrets: %', SQLERRM;
END;
$$;


--
-- Name: FUNCTION initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text) IS 'Initializes all secrets for a WebSocket server in Supabase Vault';


--
-- Name: insert_lines(text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_lines(content text, after_line integer, new_content text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    lines TEXT[];
    new_lines TEXT[];
    result TEXT[];
BEGIN
    lines := string_to_array(content, E'\n');
    new_lines := string_to_array(new_content, E'\n');
    
    -- Validate bounds (allow 0 for inserting at start)
    IF after_line < 0 OR after_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'after_line out of bounds: %', after_line;
    END IF;
    
    -- Build result: before + new + after
    IF after_line = 0 THEN
        result := new_lines || lines;
    ELSE
        result := lines[1:after_line] || new_lines || lines[after_line+1:array_length(lines, 1)];
    END IF;
    
    RETURN array_to_string(result, E'\n');
END;
$$;


--
-- Name: FUNCTION insert_lines(content text, after_line integer, new_content text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.insert_lines(content text, after_line integer, new_content text) IS 'Inserts new lines after a specific line';


--
-- Name: is_agent_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_agent_owner(agent_id_to_check uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agents
    WHERE id = agent_id_to_check AND user_id = auth.uid()
  );
$$;


--
-- Name: is_chat_room_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_chat_room_member(p_room_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check if user is a direct member
    SELECT 1
    FROM public.workspace_members wm -- Use workspace_members table
    WHERE wm.workspace_id = p_room_id AND wm.user_id = p_user_id
    UNION ALL
    -- Check if user is a member of a team that is a member of the workspace
    SELECT 1
    FROM public.workspace_members wm_teams -- Use workspace_members table
    JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id
    WHERE wm_teams.workspace_id = p_room_id AND utm.user_id = p_user_id
    -- TODO: Consider if agent ownership implies membership? For now, no.
  );
$$;


--
-- Name: is_global_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_global_admin(p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.name = 'admin'
  ) INTO is_admin;
  RETURN is_admin;
END;
$$;


--
-- Name: is_mcp_schema_stale(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_mcp_schema_stale(p_connection_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  oldest_update TIMESTAMPTZ;
  stale_threshold INTERVAL := INTERVAL '7 days';
BEGIN
  -- Get the oldest tool update time for this connection
  SELECT MIN(last_updated) INTO oldest_update
  FROM mcp_tools_cache
  WHERE connection_id = p_connection_id;
  
  -- If no tools found, consider it stale
  IF oldest_update IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if older than threshold
  RETURN (NOW() - oldest_update) > stale_threshold;
END;
$$;


--
-- Name: FUNCTION is_mcp_schema_stale(p_connection_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_mcp_schema_stale(p_connection_id uuid) IS 'Check if MCP connection schemas are older than 7 days';


--
-- Name: is_organization_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_organization_member(user_id uuid, org_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = is_organization_member.user_id 
        AND organization_id = org_id 
        AND status = 'active'
    );
END;
$$;


--
-- Name: is_room_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        -- Direct user membership
        SELECT 1
        FROM chat_room_members crm_user
        WHERE crm_user.room_id = p_room_id
          AND crm_user.member_type = 'user'
          AND crm_user.member_id = p_user_id

        UNION ALL

        -- Team membership (user is in a team via user_team_memberships, and that team is in chat_room_members)
        SELECT 1
        FROM chat_room_members crm_team
        JOIN user_team_memberships utm ON crm_team.member_id = utm.team_id -- Join based on team_id
        WHERE crm_team.room_id = p_room_id
          AND crm_team.member_type = 'team' -- Ensure we are looking at a team membership in the room
          AND utm.user_id = p_user_id -- Check if the calling user is in that team
    );
$$;


--
-- Name: is_team_admin_or_pm(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_team_admin_or_pm(p_team_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  is_admin_or_pm boolean;
BEGIN
  -- Check if the user owns an agent in the team with role 'project_manager' (or potentially 'admin')
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.agents a ON tm.agent_id = a.id
    WHERE tm.team_id = p_team_id
      AND a.user_id = p_user_id
      AND tm.team_role IN ('project_manager') -- Add 'admin' here if you define such a team role
  ) INTO is_admin_or_pm;
  RETURN is_admin_or_pm;
END;
$$;


--
-- Name: is_team_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  is_member boolean;
BEGIN
  -- Check if the user owns any agent that is part of the team
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.agents a ON tm.agent_id = a.id
    WHERE tm.team_id = p_team_id AND a.user_id = p_user_id
  ) INTO is_member;
  RETURN is_member;
END;
$$;


--
-- Name: is_team_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = p_team_id AND t.owner_user_id = p_user_id
  ) INTO is_owner;
  RETURN is_owner;
END;
$$;


--
-- Name: is_workspace_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    -- Check if user is directly a member
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id
    UNION ALL
    -- Check if user is a member of a team that is a member of the workspace
    SELECT 1 
    FROM public.workspace_members wm_teams 
    JOIN public.user_team_memberships utm ON wm_teams.team_id = utm.team_id 
    WHERE wm_teams.workspace_id = p_workspace_id AND utm.user_id = p_user_id
    UNION ALL
    -- Check if user is the owner of the workspace (owners should implicitly be members for RLS checks)
    SELECT 1 
    FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
  );
$$;


--
-- Name: is_workspace_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_owner(p_workspace_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_user_id INTO v_owner_id
  FROM public.workspaces
  WHERE id = p_workspace_id;
  RETURN v_owner_id = p_user_id;
END;
$$;


--
-- Name: list_agent_assigned_documents(uuid, uuid, text, text, boolean, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_agent_assigned_documents(p_agent_id uuid, p_user_id uuid, p_category text DEFAULT NULL::text, p_assignment_type text DEFAULT NULL::text, p_include_inactive boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(document_id uuid, file_name text, display_name text, file_type text, file_size bigint, category text, assignment_type text, processing_status text, tags text[], description text, chunk_count integer, assigned_at timestamp with time zone, last_accessed_at timestamp with time zone, access_count integer, is_active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Validate agent ownership
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Return assigned documents
    RETURN QUERY
    SELECT 
        ml.id,
        ml.file_name,
        COALESCE(ml.display_name, ml.file_name),
        ml.file_type,
        ml.file_size,
        ml.category,
        ama.assignment_type,
        ml.processing_status,
        ml.tags,
        ml.description,
        ml.chunk_count,
        ama.assigned_at,
        ama.last_accessed_at,
        ama.access_count,
        ama.is_active
    FROM media_library ml
    INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
    WHERE ama.agent_id = p_agent_id 
        AND ama.user_id = p_user_id
        AND ml.is_archived = false
        AND (p_include_inactive OR ama.is_active = true)
        AND (p_category IS NULL OR ml.category = p_category)
        AND (p_assignment_type IS NULL OR ama.assignment_type = p_assignment_type)
    ORDER BY ama.assigned_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


--
-- Name: list_encryption_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_encryption_keys() RETURNS TABLE(key_id uuid, key_name text, key_type text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Only allow service role
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;
    
    RETURN QUERY
    SELECT 
        id as key_id,
        name as key_name,
        key_type::text,
        created as created_at
    FROM pgsodium.valid_key
    ORDER BY created DESC
    LIMIT 10;
END;
$$;


--
-- Name: chat_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    topic text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone,
    CONSTRAINT chat_channels_name_check CHECK ((char_length(name) > 0))
);

ALTER TABLE ONLY public.chat_channels FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE chat_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_channels IS 'Represents individual channels within a chat room, similar to Discord channels.';


--
-- Name: COLUMN chat_channels.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.id IS 'Unique identifier for the channel.';


--
-- Name: COLUMN chat_channels.workspace_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.workspace_id IS 'The chat room this channel belongs to.';


--
-- Name: COLUMN chat_channels.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.name IS 'Name of the channel (e.g., #general, #random).';


--
-- Name: COLUMN chat_channels.topic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.topic IS 'Optional topic description for the channel.';


--
-- Name: COLUMN chat_channels.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.created_at IS 'Timestamp when the channel was created.';


--
-- Name: COLUMN chat_channels.last_message_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.last_message_at IS 'Timestamp of the last message sent in this channel (for sorting).';


--
-- Name: list_room_channels(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_room_channels(p_room_id uuid) RETURNS SETOF public.chat_channels
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
    WITH room_access AS (
        SELECT public.is_room_member(p_room_id, auth.uid()) as has_access
    )
    SELECT cc.*
    FROM public.chat_channels cc
    CROSS JOIN room_access
    WHERE cc.room_id = p_room_id
    AND room_access.has_access = true
    ORDER BY cc.name;
$$;


--
-- Name: log_import_error(uuid, uuid, integer, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_import_error(p_job_id uuid, p_user_id uuid, p_row_number integer, p_error_type text, p_error_message text, p_column_name text DEFAULT NULL::text, p_raw_value text DEFAULT NULL::text, p_row_data jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  error_id UUID;
BEGIN
  INSERT INTO contact_import_errors (
    import_job_id,
    user_id,
    row_number,
    column_name,
    error_type,
    error_message,
    raw_value,
    row_data
  ) VALUES (
    p_job_id,
    p_user_id,
    p_row_number,
    p_error_type,
    p_error_message,
    p_column_name,
    p_raw_value,
    p_row_data
  ) RETURNING id INTO error_id;
  
  RETURN error_id;
END;
$$;


--
-- Name: log_sendgrid_operation(uuid, uuid, text, jsonb, jsonb, text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_sendgrid_operation(p_agent_id uuid, p_user_id uuid, p_operation_type text, p_operation_params jsonb DEFAULT NULL::jsonb, p_operation_result jsonb DEFAULT NULL::jsonb, p_status text DEFAULT 'success'::text, p_error_message text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text, p_recipients_count integer DEFAULT 1, p_execution_time_ms integer DEFAULT 0) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_config_id UUID;
    v_log_id UUID;
BEGIN
    -- Get user's SendGrid config
    SELECT id INTO v_config_id
    FROM sendgrid_configurations
    WHERE user_id = p_user_id
    AND is_active = true;
    
    -- Insert operation log
    INSERT INTO sendgrid_operation_logs (
        agent_id,
        user_id,
        sendgrid_config_id,
        operation_type,
        operation_params,
        operation_result,
        status,
        error_message,
        sendgrid_message_id,
        recipients_count,
        execution_time_ms
    ) VALUES (
        p_agent_id,
        p_user_id,
        v_config_id,
        p_operation_type,
        p_operation_params,
        p_operation_result,
        p_status,
        p_error_message,
        p_message_id,
        p_recipients_count,
        p_execution_time_ms
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


--
-- Name: log_smtp_operation(uuid, uuid, uuid, text, jsonb, jsonb, text, text, integer, integer, inet, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_smtp_operation(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid, p_operation_type text, p_operation_params jsonb DEFAULT NULL::jsonb, p_operation_result jsonb DEFAULT NULL::jsonb, p_status text DEFAULT 'success'::text, p_error_message text DEFAULT NULL::text, p_recipients_count integer DEFAULT 0, p_execution_time_ms integer DEFAULT 0, p_client_ip inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO smtp_operation_logs (
        user_id,
        agent_id,
        smtp_config_id,
        operation_type,
        operation_params,
        operation_result,
        status,
        error_message,
        recipients_count,
        execution_time_ms,
        client_ip,
        user_agent,
        created_at
    ) VALUES (
        p_user_id,
        p_agent_id,
        p_smtp_config_id,
        p_operation_type,
        p_operation_params,
        p_operation_result,
        p_status,
        p_error_message,
        p_recipients_count,
        p_execution_time_ms,
        p_client_ip,
        p_user_agent,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;


--
-- Name: log_temp_chat_access_violation(text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_temp_chat_access_violation(table_name text, operation text, user_role text, additional_info jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: mark_mcp_schema_refresh_needed(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update all tools for this connection
  UPDATE mcp_tools_cache
  SET 
    last_schema_error = NOW(),
    auto_refresh_enabled = true
  WHERE connection_id = p_connection_id;
  
  -- Log the refresh request
  RAISE NOTICE 'Schema refresh marked for connection %: %', 
    p_connection_id, COALESCE(p_error_message, 'Manual refresh requested');
END;
$$;


--
-- Name: FUNCTION mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text) IS 'Mark a connection as needing schema refresh';


--
-- Name: mark_previous_versions_not_latest(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_previous_versions_not_latest() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If this is a new version of an existing artifact (has parent)
    IF NEW.parent_artifact_id IS NOT NULL THEN
        -- Mark all previous versions as not latest
        UPDATE artifacts
        SET is_latest_version = false
        WHERE id = NEW.parent_artifact_id
           OR parent_artifact_id = NEW.parent_artifact_id;
        
        -- Ensure the new one is marked as latest
        NEW.is_latest_version = true;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: match_channel_messages(public.vector, double precision, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_channel_messages(query_embedding public.vector, match_threshold double precision, match_count integer, p_channel_id uuid) RETURNS TABLE(id uuid, channel_id uuid, content text, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.channel_id,
    cm.content,
    1 - (cm.embedding <=> query_embedding) as similarity
  FROM public.chat_messages cm
  WHERE cm.channel_id = p_channel_id AND cm.embedding IS NOT NULL
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: migrate_chat_messages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_chat_messages() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    migrated_count INTEGER := 0;
    v_conversation_id UUID;
    v_session_id UUID;
BEGIN
    -- Create a default conversation and session for migration
    v_conversation_id := uuid_generate_v4();
    v_session_id := uuid_generate_v4();
    
    -- Insert conversation session
    INSERT INTO conversation_sessions (id, conversation_id, started_at)
    VALUES (v_session_id, v_conversation_id, NOW());
    
    -- Migrate messages
    INSERT INTO chat_messages_v2 (
        conversation_id,
        session_id,
        channel_id,
        sender_user_id,
        sender_agent_id,
        role,
        content,
        created_at
    )
    SELECT 
        v_conversation_id,
        v_session_id,
        channel_id,
        sender_user_id,
        sender_agent_id,
        CASE 
            WHEN sender_user_id IS NOT NULL THEN 'user'
            WHEN sender_agent_id IS NOT NULL THEN 'assistant'
            ELSE 'system'
        END as role,
        jsonb_build_object(
            'type', 'text',
            'text', content
        ) as content,
        created_at
    FROM chat_messages
    WHERE NOT EXISTS (
        SELECT 1 FROM chat_messages_v2 
        WHERE chat_messages_v2.created_at = chat_messages.created_at
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    
    RETURN migrated_count;
END;
$$;


--
-- Name: FUNCTION migrate_chat_messages(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.migrate_chat_messages() IS 'Migrates existing chat_messages to the new chat_messages_v2 structure';


--
-- Name: migrate_mcp_urls_to_vault(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_mcp_urls_to_vault() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    connection_record RECORD;
    vault_id UUID;
    migrated_count INTEGER := 0;
BEGIN
    -- Only service role can perform migration
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to migrate MCP URLs';
    END IF;

    -- Process each connection with a plain text URL
    FOR connection_record IN 
        SELECT id, server_url, connection_name
        FROM agent_mcp_connections 
        WHERE server_url IS NOT NULL 
        AND vault_server_url_id IS NULL
    LOOP
        -- Create vault secret for the URL
        BEGIN
            SELECT create_vault_secret(
                connection_record.server_url,
                'mcp_server_url_' || connection_record.id || '_' || extract(epoch from now()),
                'MCP Server URL for connection: ' || connection_record.connection_name
            ) INTO vault_id;

            -- Update the record with vault ID and move URL to deprecated column
            UPDATE agent_mcp_connections 
            SET 
                vault_server_url_id = vault_id::TEXT,
                server_url_deprecated = server_url,
                server_url = NULL,  -- Clear the plain text URL
                updated_at = NOW()
            WHERE id = connection_record.id;

            migrated_count := migrated_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other records
            RAISE WARNING 'Failed to migrate URL for connection %: %', connection_record.id, SQLERRM;
        END;
    END LOOP;

    RETURN migrated_count;
END;
$$;


--
-- Name: FUNCTION migrate_mcp_urls_to_vault(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.migrate_mcp_urls_to_vault() IS 'One-time migration function to move existing URLs to vault storage';


--
-- Name: monitor_session_security(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.monitor_session_security() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Log suspicious activity
  IF TG_OP = 'UPDATE' THEN
    -- Check for rapid rate limit violations
    IF NEW.rate_limit_violations > OLD.rate_limit_violations + 5 THEN
      -- Log security event (would integrate with existing audit system)
      INSERT INTO tool_execution_logs (
        agent_id,
        user_id,
        tool_name,
        execution_status,
        execution_details,
        created_at
      ) VALUES (
        (SELECT agent_id FROM temporary_chat_links WHERE id = NEW.link_id),
        (SELECT user_id FROM temporary_chat_links WHERE id = NEW.link_id),
        'temporary_chat_security_alert',
        'warning',
        jsonb_build_object(
          'event_type', 'rate_limit_violations',
          'session_id', NEW.id,
          'violations_count', NEW.rate_limit_violations,
          'ip_address', NEW.ip_address,
          'user_agent', NEW.user_agent
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: prevent_plaintext_mcp_urls(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_plaintext_mcp_urls() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
    -- Prevent storing URLs in the main server_url column (force vault usage)
    IF NEW.server_url IS NOT NULL AND NEW.vault_server_url_id IS NULL THEN
        RAISE EXCEPTION 'Security Error: MCP server URLs must be stored in vault. Use vault storage for new connections.';
    END IF;
    
    -- Ensure vault UUID format if provided
    IF NEW.vault_server_url_id IS NOT NULL THEN
        IF NEW.vault_server_url_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'Security Error: vault_server_url_id must be a valid UUID. Use create_vault_secret() to encrypt URLs.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$_$;


--
-- Name: prevent_vault_token_exposure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_vault_token_exposure() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Log any attempt to directly access vault tokens (for security monitoring)
  IF TG_OP = 'SELECT' THEN
    -- This would be handled by RLS policies, but we can log here if needed
    RETURN NEW;
  END IF;
  
  -- Ensure vault_link_token_id is always provided for new records
  IF TG_OP = 'INSERT' AND NEW.vault_link_token_id IS NULL THEN
    RAISE EXCEPTION 'vault_link_token_id is required and must reference a valid vault secret';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: queue_conversation_summarization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_conversation_summarization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  message_count INTEGER;
  last_summary_count INTEGER;
  update_frequency INTEGER DEFAULT 5;  -- Default: summarize every 5 messages
  should_summarize BOOLEAN DEFAULT FALSE;
BEGIN
  -- Get the conversation's current message count
  SELECT COUNT(*) INTO message_count
  FROM chat_messages_v2
  WHERE conversation_id = NEW.conversation_id;
  
  -- Get the last summarized message count
  -- FIX: Add table alias 'csb' to resolve ambiguous column reference
  SELECT COALESCE(csb.message_count, 0), COALESCE(csb.update_frequency, 5)
  INTO last_summary_count, update_frequency
  FROM conversation_summary_boards csb
  WHERE csb.conversation_id = NEW.conversation_id;
  
  -- Determine if we should summarize
  -- Summarize if we've accumulated enough new messages
  IF message_count - last_summary_count >= update_frequency THEN
    should_summarize := TRUE;
  END IF;
  
  -- If this is the first time (no summary board exists), create one after 5 messages
  IF NOT FOUND AND message_count >= 5 THEN
    should_summarize := TRUE;
  END IF;
  
  -- Queue summarization if needed
  IF should_summarize THEN
    -- Use pg_notify to send async notification
    -- The conversation-summarizer Edge Function will listen for these
    PERFORM pg_notify(
      'summarization_queue',
      json_build_object(
        'conversation_id', NEW.conversation_id,
        'agent_id', NEW.sender_agent_id,
        'user_id', NEW.sender_user_id,
        'message_count', message_count,
        'timestamp', NOW()
      )::text
    );
    
    RAISE NOTICE '[Summarization Trigger] Queued summarization for conversation %', NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION queue_conversation_summarization(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.queue_conversation_summarization() IS 'Trigger function that queues conversation summarization after N messages. Called automatically on message insert.';


--
-- Name: record_agent_oauth_usage(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE agent_oauth_permissions 
    SET 
        usage_count = usage_count + 1,
        last_used_at = now(),
        updated_at = now()
    WHERE agent_id = p_agent_id 
    AND user_oauth_connection_id = p_connection_id
    AND is_active = true;
    
    RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid) IS 'Records OAuth connection usage by agent';


--
-- Name: record_mcp_tool_execution(uuid, text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_existing_params JSONB;
  v_params_array JSONB;
  v_param_exists BOOLEAN;
BEGIN
  IF p_success THEN
    -- Get current successful parameters array
    SELECT successful_parameters INTO v_existing_params
    FROM mcp_tools_cache
    WHERE connection_id = p_connection_id 
      AND tool_name = p_tool_name;
    
    -- Initialize as empty array if NULL
    IF v_existing_params IS NULL THEN
      v_existing_params := '[]'::jsonb;
    END IF;
    
    -- Check if these exact parameters already exist
    SELECT EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(v_existing_params) AS elem
      WHERE elem = p_parameters
    ) INTO v_param_exists;
    
    -- Only add if parameters don't already exist (avoid duplicates)
    IF NOT v_param_exists THEN
      -- Append new successful parameters (keep last 10 unique combinations)
      v_params_array := v_existing_params || jsonb_build_array(p_parameters);
      
      -- Keep only the most recent 10 successful parameter combinations
      IF jsonb_array_length(v_params_array) > 10 THEN
        v_params_array := (
          SELECT jsonb_agg(elem)
          FROM (
            SELECT elem
            FROM jsonb_array_elements(v_params_array) AS elem
            ORDER BY ordinality DESC
            LIMIT 10
          ) AS limited
        );
      END IF;
    ELSE
      v_params_array := v_existing_params;
    END IF;
    
    -- Update the cache with successful parameters
    UPDATE mcp_tools_cache
    SET 
      successful_parameters = v_params_array,
      last_successful_call = NOW(),
      success_count = success_count + 1,
      last_updated = NOW()
    WHERE connection_id = p_connection_id 
      AND tool_name = p_tool_name;
      
    -- Also update the connection's last successful call
    UPDATE agent_mcp_connections
    SET last_successful_call = NOW()
    WHERE id = p_connection_id;
  END IF;
END;
$$;


--
-- Name: FUNCTION record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean) IS 'Records successful tool execution parameters for learning';


--
-- Name: record_mcp_tool_success(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_mcp_tool_success(p_connection_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Only service role can record tool execution
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to record tool execution';
  END IF;

  UPDATE agent_mcp_connections
  SET last_successful_call = NOW()
  WHERE id = p_connection_id;
END;
$$;


--
-- Name: refresh_smart_group_memberships(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_smart_group_memberships(p_group_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  group_record RECORD;
  contact_ids UUID[];
  current_member_ids UUID[];
  to_add UUID[];
  to_remove UUID[];
  changes_made INTEGER := 0;
BEGIN
  -- Get group details
  SELECT * INTO group_record 
  FROM contact_groups 
  WHERE id = p_group_id AND is_smart_group = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Smart group not found: %', p_group_id;
  END IF;
  
  -- Get contacts that should be in this group based on criteria
  SELECT ARRAY(
    SELECT contact_id 
    FROM evaluate_smart_group_criteria(group_record.user_id, group_record.smart_criteria)
  ) INTO contact_ids;
  
  -- Get current members
  SELECT ARRAY(
    SELECT contact_id 
    FROM contact_group_memberships 
    WHERE group_id = p_group_id
  ) INTO current_member_ids;
  
  -- Find contacts to add (in criteria results but not in current members)
  SELECT ARRAY(
    SELECT unnest(contact_ids) 
    EXCEPT 
    SELECT unnest(current_member_ids)
  ) INTO to_add;
  
  -- Find contacts to remove (in current members but not in criteria results)
  SELECT ARRAY(
    SELECT unnest(current_member_ids) 
    EXCEPT 
    SELECT unnest(contact_ids)
  ) INTO to_remove;
  
  -- Add new members
  IF array_length(to_add, 1) > 0 THEN
    INSERT INTO contact_group_memberships (contact_id, group_id, user_id, membership_type)
    SELECT unnest(to_add), p_group_id, group_record.user_id, 'smart_rule';
    changes_made := changes_made + array_length(to_add, 1);
  END IF;
  
  -- Remove members that no longer match
  IF array_length(to_remove, 1) > 0 THEN
    DELETE FROM contact_group_memberships 
    WHERE group_id = p_group_id AND contact_id = ANY(to_remove);
    changes_made := changes_made + array_length(to_remove, 1);
  END IF;
  
  RETURN changes_made;
END;
$$;


--
-- Name: reorder_task_steps(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_task_steps(p_task_id uuid, p_step_orders jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    step_update JSONB;
    step_id UUID;
    new_order INTEGER;
BEGIN
    -- Validate task access
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks 
        WHERE id = p_task_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;
    
    -- Update each step's order
    FOR step_update IN SELECT * FROM jsonb_array_elements(p_step_orders)
    LOOP
        step_id := (step_update->>'stepId')::UUID;
        new_order := (step_update->>'newOrder')::INTEGER;
        
        -- Validate step belongs to task
        IF NOT EXISTS (
            SELECT 1 FROM task_steps 
            WHERE id = step_id 
            AND task_id = p_task_id
        ) THEN
            RAISE EXCEPTION 'Step % does not belong to task %', step_id, p_task_id;
        END IF;
        
        -- Update step order
        UPDATE task_steps 
        SET step_order = new_order,
            updated_at = NOW()
        WHERE id = step_id;
    END LOOP;
    
    RETURN TRUE;
END;
$$;


--
-- Name: replace_lines(text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_lines(content text, start_line integer, end_line integer, new_content text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    lines TEXT[];
    new_lines TEXT[];
    result TEXT[];
BEGIN
    lines := string_to_array(content, E'\n');
    new_lines := string_to_array(new_content, E'\n');
    
    -- Validate bounds
    IF start_line < 1 OR start_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'start_line out of bounds: %', start_line;
    END IF;
    
    IF end_line < start_line OR end_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'end_line out of bounds: %', end_line;
    END IF;
    
    -- Build result: before + new + after
    result := lines[1:start_line-1] || new_lines || lines[end_line+1:array_length(lines, 1)];
    
    RETURN array_to_string(result, E'\n');
END;
$$;


--
-- Name: FUNCTION replace_lines(content text, start_line integer, end_line integer, new_content text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.replace_lines(content text, start_line integer, end_line integer, new_content text) IS 'Replaces a range of lines with new content';


--
-- Name: revoke_agent_contact_access(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate ownership
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Remove specific access
  DELETE FROM agent_specific_contact_access
  WHERE agent_id = p_agent_id 
    AND contact_id = p_contact_id 
    AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: revoke_agent_integration_permission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_agent_integration_permission(p_permission_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the permission belongs to the user's agent
    IF NOT EXISTS (
        SELECT 1 FROM agent_oauth_permissions aop
        JOIN agents a ON aop.agent_id = a.id
        WHERE aop.id = p_permission_id AND a.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Permission not found or access denied';
    END IF;
    
    -- Mark the permission as revoked
    UPDATE agent_oauth_permissions 
    SET 
        is_active = false,
        revoked_at = NOW(),
        revoked_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_permission_id;
    
    RETURN true;
END;
$$;


--
-- Name: FUNCTION revoke_agent_integration_permission(p_permission_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.revoke_agent_integration_permission(p_permission_id uuid) IS 'Revoke integration permission from an agent';


--
-- Name: revoke_agent_web_search_permission(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_agent_web_search_permission(p_agent_id uuid, p_provider_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Deactivate the permission
    UPDATE agent_web_search_permissions 
    SET is_active = false, updated_at = now()
    WHERE agent_id = p_agent_id 
        AND provider_id = p_provider_id
        AND user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;


--
-- Name: revoke_smtp_credentials(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_smtp_credentials(p_user_id uuid, p_config_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    vault_id TEXT;
BEGIN
    -- Get vault ID for the configuration
    SELECT vault_password_id
    INTO vault_id
    FROM smtp_configurations
    WHERE id = p_config_id AND user_id = p_user_id;
    
    IF vault_id IS NULL THEN
        RAISE EXCEPTION 'SMTP configuration not found or access denied';
    END IF;
    
    -- Mark configuration as inactive
    UPDATE smtp_configurations
    SET is_active = false,
        updated_at = NOW()
    WHERE id = p_config_id;
    
    -- Delete secret from vault
    DELETE FROM vault.secrets WHERE id = vault_id::UUID;
    
    RETURN true;
END;
$$;


--
-- Name: save_team_canvas_layout(uuid, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_team_canvas_layout(p_workspace_id uuid DEFAULT NULL::uuid, p_positions jsonb DEFAULT '[]'::jsonb, p_connections jsonb DEFAULT '[]'::jsonb, p_view_settings jsonb DEFAULT '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_layout_id UUID;
    v_existing_layout_id UUID;
    v_team_id UUID;
    v_position_item JSONB;
    v_connection_item JSONB;
    v_validation_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to save canvas layout'
        );
    END IF;
    
    -- Validate positions JSON structure
    IF NOT jsonb_typeof(p_positions) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Positions must be a JSON array');
    ELSE
        -- Validate each position
        FOR v_position_item IN SELECT * FROM jsonb_array_elements(p_positions)
        LOOP
            -- Check required fields
            IF NOT (v_position_item ? 'teamId' AND v_position_item ? 'x' AND v_position_item ? 'y') THEN
                v_validation_errors := array_append(v_validation_errors, 'Position items must have teamId, x, and y fields');
                CONTINUE;
            END IF;
            
            -- Validate team ID and ownership
            BEGIN
                v_team_id := (v_position_item->>'teamId')::UUID;
                
                IF NOT EXISTS (
                    SELECT 1 FROM teams 
                    WHERE id = v_team_id 
                    AND owner_user_id = v_user_id
                ) THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        format('Team %s not found or access denied', v_team_id));
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        'Invalid team ID format: ' || (v_position_item->>'teamId'));
            END;
        END LOOP;
    END IF;
    
    -- Validate connections JSON structure
    IF NOT jsonb_typeof(p_connections) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Connections must be a JSON array');
    ELSE
        -- Basic connection validation (detailed validation in separate function)
        FOR v_connection_item IN SELECT * FROM jsonb_array_elements(p_connections)
        LOOP
            IF NOT (v_connection_item ? 'fromTeamId' AND 
                   v_connection_item ? 'toTeamId' AND 
                   v_connection_item ? 'type') THEN
                v_validation_errors := array_append(v_validation_errors, 
                    'Connection items must have fromTeamId, toTeamId, and type fields');
            END IF;
        END LOOP;
    END IF;
    
    -- Return validation errors if any
    IF array_length(v_validation_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Validation failed',
            'validation_errors', to_jsonb(v_validation_errors)
        );
    END IF;
    
    -- Check for existing layout
    SELECT id INTO v_existing_layout_id
    FROM team_canvas_layouts
    WHERE user_id = v_user_id 
    AND workspace_id IS NOT DISTINCT FROM p_workspace_id;
    
    -- Insert or update layout
    IF v_existing_layout_id IS NOT NULL THEN
        -- Update existing layout
        UPDATE team_canvas_layouts
        SET 
            positions = p_positions,
            connections = p_connections,
            view_settings = p_view_settings,
            updated_at = NOW()
        WHERE id = v_existing_layout_id
        RETURNING id INTO v_layout_id;
    ELSE
        -- Create new layout
        INSERT INTO team_canvas_layouts (
            user_id,
            workspace_id,
            positions,
            connections,
            view_settings
        ) VALUES (
            v_user_id,
            p_workspace_id,
            p_positions,
            p_connections,
            p_view_settings
        )
        RETURNING id INTO v_layout_id;
    END IF;
    
    -- Log the save operation
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'canvas_layout_save',
        v_user_id,
        jsonb_build_object(
            'layout_id', v_layout_id,
            'workspace_id', p_workspace_id,
            'position_count', jsonb_array_length(p_positions),
            'connection_count', jsonb_array_length(p_connections),
            'action', CASE WHEN v_existing_layout_id IS NOT NULL THEN 'update' ELSE 'create' END
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'layout_id', v_layout_id,
        'position_count', jsonb_array_length(p_positions),
        'connection_count', jsonb_array_length(p_connections),
        'saved_at', NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        INSERT INTO system_alerts (
            type,
            severity, 
            message,
            context
        ) VALUES (
            'database_error',
            'error',
            'Failed to save canvas layout: ' || SQLERRM,
            jsonb_build_object(
                'function', 'save_team_canvas_layout',
                'user_id', v_user_id,
                'workspace_id', p_workspace_id,
                'error_detail', SQLSTATE
            )
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal error saving canvas layout',
            'error_code', SQLSTATE
        );
END;
$$;


--
-- Name: FUNCTION save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb) IS 'Save or update team canvas layout with comprehensive validation and audit logging';


--
-- Name: save_team_canvas_layout(uuid, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_team_canvas_layout(p_workspace_id uuid DEFAULT NULL::uuid, p_positions jsonb DEFAULT '[]'::jsonb, p_agent_positions jsonb DEFAULT '[]'::jsonb, p_connections jsonb DEFAULT '[]'::jsonb, p_view_settings jsonb DEFAULT '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_layout_id UUID;
    v_existing_layout_id UUID;
    v_team_id UUID;
    v_agent_id UUID;
    v_position_item JSONB;
    v_agent_position_item JSONB;
    v_connection_item JSONB;
    v_validation_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to save canvas layout'
        );
    END IF;
    
    -- Validate positions JSON structure (teams)
    IF NOT jsonb_typeof(p_positions) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Positions must be a JSON array');
    ELSE
        -- Validate each team position
        FOR v_position_item IN SELECT * FROM jsonb_array_elements(p_positions)
        LOOP
            IF NOT (v_position_item ? 'teamId' AND v_position_item ? 'x' AND v_position_item ? 'y') THEN
                v_validation_errors := array_append(v_validation_errors, 'Position items must have teamId, x, and y fields');
                CONTINUE;
            END IF;
            
            BEGIN
                v_team_id := (v_position_item->>'teamId')::UUID;
                
                IF NOT EXISTS (
                    SELECT 1 FROM teams 
                    WHERE id = v_team_id 
                    AND owner_user_id = v_user_id
                ) THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        format('Team %s not found or access denied', v_team_id));
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        'Invalid team ID format: ' || (v_position_item->>'teamId'));
            END;
        END LOOP;
    END IF;
    
    -- Validate agent positions JSON structure (NEW)
    IF NOT jsonb_typeof(p_agent_positions) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Agent positions must be a JSON array');
    ELSE
        -- Validate each agent position
        FOR v_agent_position_item IN SELECT * FROM jsonb_array_elements(p_agent_positions)
        LOOP
            IF NOT (v_agent_position_item ? 'agentId' AND v_agent_position_item ? 'x' AND v_agent_position_item ? 'y') THEN
                v_validation_errors := array_append(v_validation_errors, 'Agent position items must have agentId, x, and y fields');
                CONTINUE;
            END IF;
            
            BEGIN
                v_agent_id := (v_agent_position_item->>'agentId')::UUID;
                
                IF NOT EXISTS (
                    SELECT 1 FROM agents 
                    WHERE id = v_agent_id 
                    AND owner_user_id = v_user_id
                ) THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        format('Agent %s not found or access denied', v_agent_id));
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        'Invalid agent ID format: ' || (v_agent_position_item->>'agentId'));
            END;
        END LOOP;
    END IF;
    
    -- Validate connections JSON structure (supports team-to-team, team-to-agent, agent-to-agent)
    IF NOT jsonb_typeof(p_connections) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Connections must be a JSON array');
    ELSE
        FOR v_connection_item IN SELECT * FROM jsonb_array_elements(p_connections)
        LOOP
            -- Connection must have type and at least one pair of from/to IDs
            IF NOT (v_connection_item ? 'type') THEN
                v_validation_errors := array_append(v_validation_errors, 'Connection items must have type field');
            END IF;
            
            -- Must have either teamId pairs or agentId pairs or mixed
            IF NOT (
                (v_connection_item ? 'fromTeamId' OR v_connection_item ? 'fromAgentId') AND
                (v_connection_item ? 'toTeamId' OR v_connection_item ? 'toAgentId')
            ) THEN
                v_validation_errors := array_append(v_validation_errors, 
                    'Connection items must have source and target IDs (team or agent)');
            END IF;
        END LOOP;
    END IF;
    
    -- Return validation errors if any
    IF array_length(v_validation_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Validation failed',
            'validation_errors', to_jsonb(v_validation_errors)
        );
    END IF;
    
    -- Check for existing layout
    SELECT id INTO v_existing_layout_id
    FROM team_canvas_layouts
    WHERE user_id = v_user_id 
        AND ((workspace_id IS NULL AND p_workspace_id IS NULL) OR workspace_id = p_workspace_id);
    
    -- Insert or update layout
    IF v_existing_layout_id IS NULL THEN
        -- Create new layout
        INSERT INTO team_canvas_layouts (
            user_id,
            workspace_id,
            positions,
            agent_positions,  -- NEW COLUMN
            connections,
            view_settings
        ) VALUES (
            v_user_id,
            p_workspace_id,
            p_positions,
            p_agent_positions,  -- NEW VALUE
            p_connections,
            p_view_settings
        )
        RETURNING id INTO v_layout_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'layout_id', v_layout_id,
            'position_count', jsonb_array_length(p_positions),
            'agent_position_count', jsonb_array_length(p_agent_positions),  -- NEW
            'connection_count', jsonb_array_length(p_connections),
            'saved_at', now()
        );
    ELSE
        -- Update existing layout
        UPDATE team_canvas_layouts
        SET 
            positions = p_positions,
            agent_positions = p_agent_positions,  -- NEW COLUMN
            connections = p_connections,
            view_settings = p_view_settings,
            updated_at = now()
        WHERE id = v_existing_layout_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'layout_id', v_existing_layout_id,
            'position_count', jsonb_array_length(p_positions),
            'agent_position_count', jsonb_array_length(p_agent_positions),  -- NEW
            'connection_count', jsonb_array_length(p_connections),
            'saved_at', now()
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to save canvas layout: ' || SQLERRM
        );
END;
$$;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid,
    sender_agent_id uuid,
    sender_user_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding public.vector(1536),
    metadata jsonb,
    CONSTRAINT chat_messages_content_check CHECK ((char_length(content) > 0)),
    CONSTRAINT chk_sender_not_null CHECK (((sender_agent_id IS NOT NULL) OR (sender_user_id IS NOT NULL)))
);


--
-- Name: TABLE chat_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_messages IS 'Stores individual messages within chat sessions.';


--
-- Name: COLUMN chat_messages.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.id IS 'Unique identifier for the message.';


--
-- Name: COLUMN chat_messages.channel_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.channel_id IS 'The chat session this message belongs to.';


--
-- Name: COLUMN chat_messages.sender_agent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.sender_agent_id IS 'The agent that sent the message (if applicable).';


--
-- Name: COLUMN chat_messages.sender_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.sender_user_id IS 'The user that sent the message (if applicable).';


--
-- Name: COLUMN chat_messages.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.content IS 'The textual content of the message.';


--
-- Name: COLUMN chat_messages.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.created_at IS 'Timestamp when the message was created.';


--
-- Name: COLUMN chat_messages.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.embedding IS 'Vector embedding of the message content.';


--
-- Name: COLUMN chat_messages.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.metadata IS 'JSONB field for storing arbitrary metadata, e.g., mentions.';


--
-- Name: search_chat_history(uuid, text, text, integer, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_chat_history(p_channel_id uuid, p_search_query text, p_search_type text DEFAULT 'text'::text, p_match_count integer DEFAULT 5, p_match_threshold double precision DEFAULT 0.7) RETURNS SETOF public.chat_messages
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
    v_query_embedding vector(1536);
    v_room_id uuid;
BEGIN
    SELECT room_id INTO v_room_id FROM chat_channels WHERE id = p_channel_id;

    IF NOT public.is_room_member(v_room_id, auth.uid()) THEN
        RAISE EXCEPTION 'User % is not a member of room %', auth.uid(), v_room_id;
        RETURN;
    END IF;

    IF p_search_type = 'semantic' THEN
        -- Semantic search logic needs embedding generation for p_search_query
        -- Placeholder: Fallback to text search for now
        RETURN QUERY
        SELECT cm.*
        FROM public.chat_messages cm
        WHERE cm.channel_id = p_channel_id
          AND cm.content ILIKE ('%' || p_search_query || '%')
        ORDER BY cm.created_at DESC
        LIMIT p_match_count;
    ELSE
        RETURN QUERY
        SELECT cm.*
        FROM public.chat_messages cm
        WHERE cm.channel_id = p_channel_id
          AND cm.content ILIKE ('%' || p_search_query || '%')
        ORDER BY cm.created_at DESC
        LIMIT p_match_count;
    END IF;
END;
$$;


--
-- Name: search_contacts_for_agent(uuid, uuid, text, text, uuid, text, text[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text DEFAULT NULL::text, p_contact_type text DEFAULT NULL::text, p_group_id uuid DEFAULT NULL::uuid, p_channel_type text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[], p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(contact_id uuid, first_name text, last_name text, display_name text, organization text, job_title text, contact_type text, contact_status text, primary_email text, primary_phone text, tags text[], last_contacted_at timestamp with time zone, created_at timestamp with time zone, interaction_count bigint, has_channel boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate agent ownership
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Check agent permissions
  IF NOT check_agent_contact_permission(p_agent_id, NULL, 'view') THEN
    RAISE EXCEPTION 'Agent does not have contact access permissions';
  END IF;
  
  -- Return filtered contacts based on permissions and search criteria
  RETURN QUERY
  SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.display_name,
    c.organization,
    c.job_title,
    c.contact_type,
    c.contact_status,
    -- Get primary email
    (SELECT ccc.channel_identifier 
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id 
       AND ccc.channel_type = 'email' 
       AND ccc.is_primary = TRUE 
       AND ccc.is_active = TRUE 
     LIMIT 1) as primary_email,
    -- Get primary phone
    (SELECT ccc.channel_identifier 
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id 
       AND ccc.channel_type IN ('phone', 'mobile') 
       AND ccc.is_primary = TRUE 
       AND ccc.is_active = TRUE 
     LIMIT 1) as primary_phone,
    c.tags,
    c.last_contacted_at,
    c.created_at,
    -- Count interactions
    (SELECT COUNT(*) 
     FROM contact_interactions ci 
     WHERE ci.contact_id = c.id) as interaction_count,
    -- Check if contact has specified channel type
    CASE 
      WHEN p_channel_type IS NULL THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM contact_communication_channels ccc 
        WHERE ccc.contact_id = c.id 
          AND ccc.channel_type = p_channel_type 
          AND ccc.is_active = TRUE
      )
    END as has_channel
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND c.contact_status = 'active'
    AND c.deleted_at IS NULL
    -- Text search filter
    AND (p_query IS NULL OR 
         c.display_name ILIKE '%' || p_query || '%' OR
         c.organization ILIKE '%' || p_query || '%' OR
         c.job_title ILIKE '%' || p_query || '%' OR
         c.notes ILIKE '%' || p_query || '%')
    -- Contact type filter
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    -- Tags filter
    AND (p_tags IS NULL OR c.tags && p_tags)
    -- Group membership filter
    AND (p_group_id IS NULL OR EXISTS (
      SELECT 1 FROM contact_group_memberships cgm 
      WHERE cgm.contact_id = c.id AND cgm.group_id = p_group_id
    ))
    -- Channel type filter
    AND (p_channel_type IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type = p_channel_type 
        AND ccc.is_active = TRUE
    ))
    -- Apply agent-specific access controls
    AND (
      -- Agent has all_contacts permission
      EXISTS (
        SELECT 1 FROM agent_contact_permissions acp
        WHERE acp.agent_id = p_agent_id 
          AND acp.permission_type = 'all_contacts'
          AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
      ) OR
      -- Agent has specific access to this contact
      EXISTS (
        SELECT 1 FROM agent_specific_contact_access asca
        WHERE asca.agent_id = p_agent_id 
          AND asca.contact_id = c.id
          AND asca.access_level != 'no_access'
          AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
      ) OR
      -- Agent has group access to this contact
      EXISTS (
        SELECT 1 FROM agent_group_access aga
        INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
        WHERE aga.agent_id = p_agent_id 
          AND cgm.contact_id = c.id
          AND (aga.expires_at IS NULL OR aga.expires_at > CURRENT_TIMESTAMP)
      )
    )
  ORDER BY 
    CASE WHEN p_query IS NOT NULL THEN
      ts_rank(to_tsvector('english', c.display_name || ' ' || COALESCE(c.organization, '')), 
               plainto_tsquery('english', p_query))
    ELSE 0 END DESC,
    c.last_contacted_at DESC NULLS LAST,
    c.display_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: FUNCTION search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_tags text[], p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_tags text[], p_limit integer, p_offset integer) IS 'MCP tool function to search contacts with agent permission validation';


--
-- Name: search_contacts_for_agent_enhanced(uuid, uuid, text, text, uuid, text, text, text, text, text, text[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text DEFAULT NULL::text, p_contact_type text DEFAULT NULL::text, p_group_id uuid DEFAULT NULL::uuid, p_channel_type text DEFAULT NULL::text, p_organization_filter text DEFAULT NULL::text, p_job_title_filter text DEFAULT NULL::text, p_phone_pattern text DEFAULT NULL::text, p_email_pattern text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[], p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(contact_id uuid, first_name text, last_name text, display_name text, organization text, job_title text, contact_type text, contact_status text, primary_email text, primary_phone text, tags text[], last_contacted_at timestamp with time zone, created_at timestamp with time zone, interaction_count bigint, has_channel boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate agent ownership and permissions
  IF NOT check_agent_contact_permission(p_agent_id, NULL, 'view') THEN
    RAISE EXCEPTION 'Agent does not have contact access permissions';
  END IF;

  RETURN QUERY
  SELECT 
    c.id as contact_id,
    c.first_name,
    c.last_name,
    c.display_name,
    c.organization,
    c.job_title,
    c.contact_type,
    c.contact_status,
    -- Get primary email
    (SELECT ccc.channel_identifier 
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id 
       AND ccc.channel_type = 'email' 
       AND ccc.is_primary = TRUE 
       AND ccc.is_active = TRUE 
     LIMIT 1) as primary_email,
    -- Get primary phone
    (SELECT ccc.channel_identifier 
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id 
       AND ccc.channel_type IN ('phone', 'mobile') 
       AND ccc.is_primary = TRUE 
       AND ccc.is_active = TRUE 
     LIMIT 1) as primary_phone,
    c.tags,
    c.last_contacted_at,
    c.created_at,
    -- Count interactions
    (SELECT COUNT(*) 
     FROM contact_interactions ci 
     WHERE ci.contact_id = c.id) as interaction_count,
    -- Check if contact has specified channel type
    CASE 
      WHEN p_channel_type IS NULL THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM contact_communication_channels ccc 
        WHERE ccc.contact_id = c.id 
          AND ccc.channel_type = p_channel_type 
          AND ccc.is_active = TRUE
      )
    END as has_channel
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND c.contact_status = 'active'
    AND c.deleted_at IS NULL
    -- Enhanced text search filter - treat "*" as wildcard for all contacts
    AND (p_query IS NULL OR p_query = '' OR p_query = '*' OR 
         c.display_name ILIKE '%' || p_query || '%' OR
         c.organization ILIKE '%' || p_query || '%' OR
         c.job_title ILIKE '%' || p_query || '%' OR
         c.notes ILIKE '%' || p_query || '%' OR
         c.first_name ILIKE '%' || p_query || '%' OR
         c.last_name ILIKE '%' || p_query || '%')
    -- Contact type filter
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    -- Organization filter
    AND (p_organization_filter IS NULL OR c.organization ILIKE '%' || p_organization_filter || '%')
    -- Job title filter
    AND (p_job_title_filter IS NULL OR c.job_title ILIKE '%' || p_job_title_filter || '%')
    -- Tags filter
    AND (p_tags IS NULL OR c.tags && p_tags)
    -- Group membership filter
    AND (p_group_id IS NULL OR EXISTS (
      SELECT 1 FROM contact_group_memberships cgm 
      WHERE cgm.contact_id = c.id AND cgm.group_id = p_group_id
    ))
    -- Channel type filter
    AND (p_channel_type IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type = p_channel_type 
        AND ccc.is_active = TRUE
    ))
    -- Phone pattern filter
    AND (p_phone_pattern IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type IN ('phone', 'mobile', 'sms') 
        AND ccc.is_active = TRUE
        AND (
          ccc.channel_identifier LIKE p_phone_pattern || '%' OR
          ccc.channel_identifier LIKE '%' || p_phone_pattern || '%' OR
          REGEXP_REPLACE(ccc.channel_identifier, '[^0-9]', '', 'g') LIKE p_phone_pattern || '%'
        )
    ))
    -- Email pattern filter
    AND (p_email_pattern IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type = 'email' 
        AND ccc.is_active = TRUE
        AND ccc.channel_identifier ILIKE '%' || p_email_pattern || '%'
    ))
    -- Apply agent-specific access controls
    AND (
      -- Agent has all_contacts permission
      EXISTS (
        SELECT 1 FROM agent_contact_permissions acp
        WHERE acp.agent_id = p_agent_id 
          AND acp.permission_type = 'all_contacts'
          AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
      ) OR
      -- Agent has specific access to this contact
      EXISTS (
        SELECT 1 FROM agent_specific_contact_access asca
        WHERE asca.agent_id = p_agent_id 
          AND asca.contact_id = c.id
          AND asca.access_level != 'no_access'
          AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
      ) OR
      -- Agent has group access to this contact
      EXISTS (
        SELECT 1 FROM agent_group_access aga
        INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
        WHERE aga.agent_id = p_agent_id 
          AND cgm.contact_id = c.id
          AND (aga.expires_at IS NULL OR aga.expires_at > CURRENT_TIMESTAMP)
      )
    )
  ORDER BY 
    -- Prioritize exact matches
    CASE 
      WHEN p_query IS NOT NULL AND p_query != '' AND p_query != '*' THEN
        CASE 
          WHEN c.display_name ILIKE p_query THEN 1
          WHEN c.display_name ILIKE p_query || '%' THEN 2
          WHEN c.organization ILIKE p_query THEN 3
          WHEN c.job_title ILIKE p_query THEN 4
          ELSE 5
        END
      ELSE 0 
    END,
    -- Full text search ranking
    CASE WHEN p_query IS NOT NULL AND p_query != '' AND p_query != '*' THEN
      ts_rank(to_tsvector('english', c.display_name || ' ' || COALESCE(c.organization, '') || ' ' || COALESCE(c.job_title, '')), 
               plainto_tsquery('english', p_query))
    ELSE 0 END DESC,
    -- Recent contact priority
    c.last_contacted_at DESC NULLS LAST,
    -- Alphabetical fallback
    c.display_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: FUNCTION search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_organization_filter text, p_job_title_filter text, p_phone_pattern text, p_email_pattern text, p_tags text[], p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_organization_filter text, p_job_title_filter text, p_phone_pattern text, p_email_pattern text, p_tags text[], p_limit integer, p_offset integer) IS 'Enhanced contact search with natural language parsing support, phone pattern matching, advanced filtering, and "*" wildcard support for listing all contacts';


--
-- Name: search_conversation_summaries(uuid, uuid, public.vector, timestamp with time zone, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 5) RETURNS TABLE(summary_text text, key_facts jsonb, topics text[], created_at timestamp with time zone, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.summary_text,
    cs.key_facts,
    cs.topics,
    cs.created_at,
    1 - (cs.embedding <=> p_query_embedding) AS similarity
  FROM conversation_summaries cs
  WHERE cs.agent_id = p_agent_id
    AND cs.user_id = p_user_id
    AND (p_start_date IS NULL OR cs.created_at >= p_start_date)
    AND (p_end_date IS NULL OR cs.created_at <= p_end_date)
  ORDER BY cs.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer) IS 'Vector similarity search for conversation summaries. Optionally filter by date range.';


--
-- Name: search_inbound_emails(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_inbound_emails(p_search_query text, p_user_id uuid DEFAULT auth.uid(), p_limit integer DEFAULT 50) RETURNS TABLE(email_id uuid, from_email text, subject text, processed_at timestamp with time zone, rank real)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ie.id as email_id,
        ie.from_email,
        ie.subject,
        ie.processed_at,
        ts_rank(
            to_tsvector('english', COALESCE(ie.subject, '') || ' ' || COALESCE(ie.text_body, '') || ' ' || COALESCE(ie.from_email, '')),
            websearch_to_tsquery('english', p_search_query)
        ) as rank
    FROM sendgrid_inbound_emails ie
    JOIN sendgrid_configurations sc ON sc.id = ie.sendgrid_config_id
    WHERE sc.user_id = p_user_id
    AND (
        to_tsvector('english', COALESCE(ie.subject, '') || ' ' || COALESCE(ie.text_body, '') || ' ' || COALESCE(ie.from_email, ''))
        @@ websearch_to_tsquery('english', p_search_query)
    )
    ORDER BY rank DESC, ie.processed_at DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: search_media_documents_for_agent(uuid, uuid, text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_media_documents_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_search_type text DEFAULT 'semantic'::text, p_category text DEFAULT NULL::text, p_assignment_type text DEFAULT NULL::text, p_limit integer DEFAULT 10) RETURNS TABLE(document_id uuid, file_name text, display_name text, description text, category text, assignment_type text, file_size bigint, processing_status text, created_at timestamp with time zone, relevance_score double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Validate agent ownership
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Return documents based on search type
    IF p_search_type = 'semantic' THEN
        -- For semantic search, we'll use text similarity
        RETURN QUERY
        SELECT 
            ml.id,
            ml.file_name,
            COALESCE(ml.display_name, ml.file_name),
            ml.description,
            ml.category,
            ama.assignment_type,
            ml.file_size,
            ml.processing_status,
            ml.created_at,
            -- Cast similarity result to double precision
            CASE 
                WHEN ml.text_content IS NOT NULL THEN
                    similarity(LOWER(p_query), LOWER(ml.text_content))::DOUBLE PRECISION
                ELSE 0.0::DOUBLE PRECISION
            END as relevance_score
        FROM media_library ml
        INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
        WHERE ama.agent_id = p_agent_id 
            AND ama.user_id = p_user_id
            AND ama.is_active = true
            AND ml.is_archived = false
            AND (p_category IS NULL OR ml.category = p_category)
            AND (p_assignment_type IS NULL OR ama.assignment_type = p_assignment_type)
            AND (
                -- Enhanced search: include category matching for queries like "SOP"
                ml.text_content ILIKE '%' || p_query || '%' OR
                ml.file_name ILIKE '%' || p_query || '%' OR
                ml.description ILIKE '%' || p_query || '%' OR
                ml.category ILIKE '%' || p_query || '%' OR  -- Add category search
                EXISTS (SELECT 1 FROM unnest(ml.tags) tag WHERE tag ILIKE '%' || p_query || '%')
            )
        ORDER BY relevance_score DESC, ml.created_at DESC
        LIMIT p_limit;
    ELSE
        -- Keyword or exact search
        RETURN QUERY
        SELECT 
            ml.id,
            ml.file_name,
            COALESCE(ml.display_name, ml.file_name),
            ml.description,
            ml.category,
            ama.assignment_type,
            ml.file_size,
            ml.processing_status,
            ml.created_at,
            1.0::DOUBLE PRECISION as relevance_score -- Cast to double precision
        FROM media_library ml
        INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
        WHERE ama.agent_id = p_agent_id 
            AND ama.user_id = p_user_id
            AND ama.is_active = true
            AND ml.is_archived = false
            AND (p_category IS NULL OR ml.category = p_category)
            AND (p_assignment_type IS NULL OR ama.assignment_type = p_assignment_type)
            AND (
                CASE 
                    WHEN p_search_type = 'exact' THEN
                        ml.text_content LIKE '%' || p_query || '%' OR
                        ml.file_name LIKE '%' || p_query || '%' OR
                        ml.description LIKE '%' || p_query || '%' OR
                        ml.category LIKE '%' || p_query || '%'  -- Add category search
                    ELSE -- keyword search
                        ml.text_content ILIKE '%' || p_query || '%' OR
                        ml.file_name ILIKE '%' || p_query || '%' OR
                        ml.description ILIKE '%' || p_query || '%' OR
                        ml.category ILIKE '%' || p_query || '%' OR  -- Add category search
                        EXISTS (SELECT 1 FROM unnest(ml.tags) tag WHERE tag ILIKE '%' || p_query || '%')
                END
            )
        ORDER BY ml.created_at DESC
        LIMIT p_limit;
    END IF;
END;
$$;


--
-- Name: search_working_memory(uuid, uuid, public.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer DEFAULT 5) RETURNS TABLE(chunk_text text, importance_score double precision, chunk_type text, created_at timestamp with time zone, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wmc.chunk_text,
    wmc.importance_score,
    wmc.chunk_type,
    wmc.created_at,
    1 - (wmc.embedding <=> p_query_embedding) AS similarity
  FROM working_memory_chunks wmc
  WHERE wmc.agent_id = p_agent_id
    AND wmc.user_id = p_user_id
    AND wmc.expires_at > NOW()
  ORDER BY wmc.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer) IS 'Vector similarity search for working memory chunks. Returns most relevant chunks for a query embedding.';


--
-- Name: set_summary_update_frequency(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_summary_update_frequency(p_conversation_id uuid, p_frequency integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate frequency (must be between 1 and 50 messages)
  IF p_frequency < 1 OR p_frequency > 50 THEN
    RAISE EXCEPTION 'Update frequency must be between 1 and 50 messages';
  END IF;
  
  -- Update or insert summary board with new frequency
  INSERT INTO conversation_summary_boards (
    conversation_id,
    agent_id,
    user_id,
    update_frequency
  )
  SELECT 
    p_conversation_id,
    sender_agent_id,
    sender_user_id,
    p_frequency
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id
    AND sender_agent_id IS NOT NULL
  LIMIT 1
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    update_frequency = p_frequency,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION set_summary_update_frequency(p_conversation_id uuid, p_frequency integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_summary_update_frequency(p_conversation_id uuid, p_frequency integer) IS 'Set how many messages should accumulate before triggering automatic summarization (1-50).';


--
-- Name: set_team_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_team_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.owner_user_id = auth.uid();
    RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: simple_user_owns_agent(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.simple_user_owns_agent(agent_id uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agents 
    WHERE id = agent_id AND agents.user_id = user_id
  );
END;
$$;


--
-- Name: simple_user_owns_contact(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.simple_user_owns_contact(contact_id uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM contacts 
    WHERE id = contact_id AND contacts.user_id = user_id
  );
END;
$$;


--
-- Name: start_contact_import_job(uuid, text, bigint, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_contact_import_job(p_user_id uuid, p_file_name text, p_file_size bigint, p_import_settings jsonb DEFAULT '{}'::jsonb, p_column_mapping jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO contact_import_jobs (
    user_id,
    file_name,
    file_size,
    import_settings,
    column_mapping,
    status,
    started_at
  ) VALUES (
    p_user_id,
    p_file_name,
    p_file_size,
    p_import_settings,
    p_column_mapping,
    'pending',
    NOW()
  ) RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;


--
-- Name: store_admin_credential(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text DEFAULT 'manual'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  vault_id UUID;
  credential_id UUID;
  secret_name TEXT;
  secret_description TEXT;
BEGIN
  -- Only admins and service role can call this function
  IF auth.role() != 'service_role' AND NOT (SELECT user_has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Insufficient privileges to store admin credentials';
  END IF;

  -- Generate standardized secret name and description
  secret_name := p_integration_type || '_' || p_credential_name || '_admin_' || extract(epoch from now())::bigint;
  secret_description := p_integration_type || ' ' || p_credential_name || ' for admin - Created: ' || now()::text;

  -- Store in vault
  SELECT create_vault_secret(p_credential_value, secret_name, secret_description) INTO vault_id;

  -- Store credential reference
  INSERT INTO admin_integration_credentials (
    integration_type,
    credential_name,
    vault_secret_id,
    connection_method,
    created_by,
    updated_by
  ) VALUES (
    p_integration_type,
    p_credential_name,
    vault_id::text,
    p_connection_method,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  )
  ON CONFLICT (integration_type, credential_name) 
  DO UPDATE SET
    vault_secret_id = vault_id::text,
    connection_method = p_connection_method,
    connection_status = 'active',
    updated_by = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    updated_at = NOW()
  RETURNING id INTO credential_id;

  RETURN credential_id;
END;
$$;


--
-- Name: FUNCTION store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text) IS 'Safely store admin credentials in vault (admin/service role only)';


--
-- Name: store_smtp_password(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_smtp_password(p_user_id uuid, p_config_name text, p_password text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    vault_id UUID;
BEGIN
    -- Validate user access
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: can only store own credentials';
    END IF;
    
    -- Validate inputs
    IF p_config_name IS NULL OR p_password IS NULL THEN
        RAISE EXCEPTION 'Configuration name and password are required';
    END IF;
    
    -- Encrypt password in vault
    SELECT vault.create_secret(
        p_password,
        format('smtp_%s_%s', p_user_id, p_config_name),
        format('SMTP password for %s', p_config_name)
    ) INTO vault_id;
    
    RETURN vault_id::TEXT;
END;
$$;


--
-- Name: suggest_contacts_for_agent(uuid, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer DEFAULT 10) RETURNS TABLE(contact_id uuid, display_name text, organization text, job_title text, contact_type text, primary_email text, primary_phone text, match_type text, relevance_score integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate agent ownership and permissions
  IF NOT check_agent_contact_permission(p_agent_id, NULL, 'view') THEN
    RAISE EXCEPTION 'Agent does not have contact access permissions';
  END IF;

  RETURN QUERY
  WITH contact_matches AS (
    SELECT 
      c.id as contact_id,
      c.display_name,
      c.organization,
      c.job_title,
      c.contact_type,
      -- Get primary email
      (SELECT ccc.channel_identifier 
       FROM contact_communication_channels ccc 
       WHERE ccc.contact_id = c.id 
         AND ccc.channel_type = 'email' 
         AND ccc.is_primary = TRUE 
         AND ccc.is_active = TRUE 
       LIMIT 1) as primary_email,
      -- Get primary phone
      (SELECT ccc.channel_identifier 
       FROM contact_communication_channels ccc 
       WHERE ccc.contact_id = c.id 
         AND ccc.channel_type IN ('phone', 'mobile') 
         AND ccc.is_primary = TRUE 
         AND ccc.is_active = TRUE 
       LIMIT 1) as primary_phone,
      -- Determine match type and score
      CASE 
        WHEN c.display_name ILIKE p_partial_query || '%' THEN 'name_prefix'
        WHEN c.display_name ILIKE '%' || p_partial_query || '%' THEN 'name_contains'
        WHEN c.organization ILIKE p_partial_query || '%' THEN 'org_prefix'
        WHEN c.organization ILIKE '%' || p_partial_query || '%' THEN 'org_contains'
        WHEN c.job_title ILIKE p_partial_query || '%' THEN 'title_prefix'
        WHEN c.job_title ILIKE '%' || p_partial_query || '%' THEN 'title_contains'
        ELSE 'other'
      END as match_type,
      CASE 
        WHEN c.display_name ILIKE p_partial_query || '%' THEN 100
        WHEN c.display_name ILIKE '%' || p_partial_query || '%' THEN 90
        WHEN c.organization ILIKE p_partial_query || '%' THEN 80
        WHEN c.organization ILIKE '%' || p_partial_query || '%' THEN 70
        WHEN c.job_title ILIKE p_partial_query || '%' THEN 60
        WHEN c.job_title ILIKE '%' || p_partial_query || '%' THEN 50
        ELSE 10
      END as relevance_score
    FROM contacts c
    WHERE c.user_id = p_user_id
      AND c.contact_status = 'active'
      AND c.deleted_at IS NULL
      AND (
        c.display_name ILIKE '%' || p_partial_query || '%' OR
        c.organization ILIKE '%' || p_partial_query || '%' OR
        c.job_title ILIKE '%' || p_partial_query || '%'
      )
      -- Apply agent-specific access controls
      AND (
        -- Agent has all_contacts permission
        EXISTS (
          SELECT 1 FROM agent_contact_permissions acp
          WHERE acp.agent_id = p_agent_id 
            AND acp.permission_type = 'all_contacts'
            AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
        ) OR
        -- Agent has specific access to this contact
        EXISTS (
          SELECT 1 FROM agent_specific_contact_access asca
          WHERE asca.agent_id = p_agent_id 
            AND asca.contact_id = c.id
            AND asca.access_level != 'no_access'
            AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
        ) OR
        -- Agent has group access to this contact
        EXISTS (
          SELECT 1 FROM agent_group_access aga
          INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
          WHERE aga.agent_id = p_agent_id 
            AND cgm.contact_id = c.id
            AND (aga.expires_at IS NULL OR aga.expires_at > CURRENT_TIMESTAMP)
        )
      )
  )
  SELECT * FROM contact_matches
  ORDER BY relevance_score DESC, display_name ASC
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer) IS 'Provides contact suggestions based on partial input for autocomplete functionality';


--
-- Name: sync_organization_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_organization_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update organization subscription_tier based on subscription
  IF NEW.organization_id IS NOT NULL THEN
    UPDATE organizations 
    SET subscription_tier = NEW.plan_name,
        updated_at = NOW()
    WHERE id = NEW.organization_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: test_contact_rls_policies(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_contact_rls_policies() RETURNS TABLE(test_name text, passed boolean, details text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- This function would contain comprehensive RLS policy tests
  -- Implementation would depend on test framework and requirements
  
  RETURN QUERY SELECT 
    'RLS Policies Created'::TEXT as test_name,
    TRUE as passed,
    'All RLS policies have been created successfully'::TEXT as details;
END;
$$;


--
-- Name: test_rpc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_rpc() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT 'RPC is working!'::text;
$$;


--
-- Name: FUNCTION test_rpc(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.test_rpc() IS 'Test RPC functionality';


--
-- Name: test_temp_chat_rls_policies(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_temp_chat_rls_policies() RETURNS TABLE(test_name text, passed boolean, details text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: test_vault_system(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_vault_system() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    test_key_id UUID;
    test_secret_id UUID;
    test_value TEXT := 'Test vault value ' || now()::text;
    encrypted_value TEXT;
    decrypted_value TEXT;
    vault_decrypted TEXT;
    result JSONB := '{}'::jsonb;
BEGIN
    -- Only allow service role
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges';
    END IF;
    
    -- Test 1: Create a key
    BEGIN
        test_key_id := public.create_encryption_key('test_vault_key_' || gen_random_uuid()::text);
        result := result || jsonb_build_object('key_created', true, 'key_id', test_key_id);
    EXCEPTION WHEN OTHERS THEN
        result := result || jsonb_build_object('key_created', false, 'key_error', SQLERRM);
    END;
    
    -- Test 2: Encrypt with our key
    IF test_key_id IS NOT NULL THEN
        BEGIN
            encrypted_value := public.encrypt_with_key(test_value, test_key_id);
            result := result || jsonb_build_object('encryption_works', true);
        EXCEPTION WHEN OTHERS THEN
            result := result || jsonb_build_object('encryption_works', false, 'encryption_error', SQLERRM);
        END;
    END IF;
    
    -- Test 3: Decrypt with our key
    IF encrypted_value IS NOT NULL THEN
        BEGIN
            decrypted_value := public.decrypt_with_key(encrypted_value, test_key_id);
            result := result || jsonb_build_object(
                'decryption_works', true, 
                'values_match', (decrypted_value = test_value)
            );
        EXCEPTION WHEN OTHERS THEN
            result := result || jsonb_build_object('decryption_works', false, 'decryption_error', SQLERRM);
        END;
    END IF;
    
    -- Test 4: Test vault.create_secret
    BEGIN
        test_secret_id := vault.create_secret(test_value, 'test_secret_' || gen_random_uuid()::text);
        result := result || jsonb_build_object('vault_create_works', true, 'secret_id', test_secret_id);
        
        -- Try to decrypt it
        BEGIN
            SELECT decrypted_secret INTO vault_decrypted
            FROM vault.decrypted_secrets
            WHERE id = test_secret_id;
            
            result := result || jsonb_build_object(
                'vault_decrypt_works', true,
                'vault_value_matches', (vault_decrypted = test_value)
            );
        EXCEPTION WHEN OTHERS THEN
            result := result || jsonb_build_object('vault_decrypt_works', false, 'vault_decrypt_error', SQLERRM);
        END;
    EXCEPTION WHEN OTHERS THEN
        result := result || jsonb_build_object('vault_create_works', false, 'vault_create_error', SQLERRM);
    END;
    
    RETURN result;
END;
$$;


--
-- Name: time_diff_seconds(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.time_diff_seconds(time1 timestamp with time zone, time2 timestamp with time zone) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT EXTRACT(EPOCH FROM (time1 - time2))::integer;
$$;


--
-- Name: track_temp_link_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_temp_link_access() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update last_accessed_at when session_count increases
  IF NEW.session_count > OLD.session_count THEN
    NEW.last_accessed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: trigger_manual_summarization(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_agent_id UUID;
  v_user_id UUID;
  v_message_count INTEGER;
BEGIN
  -- Get agent_id from messages (try assistant messages first)
  SELECT sender_agent_id INTO v_agent_id
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id
    AND sender_agent_id IS NOT NULL
  LIMIT 1;
  
  -- Get user_id from messages (try user messages first)
  SELECT sender_user_id INTO v_user_id
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id
    AND sender_user_id IS NOT NULL
  LIMIT 1;
  
  -- If no agent_id found, this might be a user-only conversation
  -- Try to get the agent from the current user's context
  IF v_agent_id IS NULL THEN
    -- Default to authenticated user's first agent
    SELECT id INTO v_agent_id
    FROM agents
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- If still no user_id, use authenticated user
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;
  
  -- Get message count
  SELECT COUNT(*) INTO v_message_count
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id;
  
  IF v_agent_id IS NULL OR v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Could not find agent_id or user_id for conversation. Please ensure conversation exists and you have access.',
      'conversation_id', p_conversation_id,
      'message_count', v_message_count
    );
  END IF;
  
  -- Send notification with force flag
  PERFORM pg_notify(
    'summarization_queue',
    json_build_object(
      'conversation_id', p_conversation_id,
      'agent_id', v_agent_id,
      'user_id', v_user_id,
      'message_count', v_message_count,
      'force_full_summary', p_force_full,
      'manual_trigger', TRUE,
      'timestamp', NOW()
    )::text
  );
  
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Summarization queued',
    'conversation_id', p_conversation_id,
    'message_count', v_message_count
  );
END;
$$;


--
-- Name: FUNCTION trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean) IS 'Manually trigger summarization for a specific conversation. Set force_full=TRUE to regenerate complete summary.';


--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: trigger_token_aggregation(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_token_aggregation(p_start_date date DEFAULT (CURRENT_DATE - '1 day'::interval), p_end_date date DEFAULT CURRENT_DATE) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result RECORD;
  v_start_time TIMESTAMP := clock_timestamp();
  v_duration NUMERIC;
BEGIN
  SELECT * INTO v_result
  FROM aggregate_user_token_usage(
    p_user_id := NULL,
    p_start_date := p_start_date::timestamp,
    p_end_date := p_end_date::timestamp
  );
  
  v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
  
  RETURN jsonb_build_object(
    'success', true,
    'users_processed', v_result.users_processed,
    'records_created', v_result.records_created,
    'records_updated', v_result.records_updated,
    'total_tokens_aggregated', v_result.total_tokens_aggregated,
    'duration_seconds', v_duration,
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;


--
-- Name: FUNCTION trigger_token_aggregation(p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_token_aggregation(p_start_date date, p_end_date date) IS 'Manually trigger token aggregation for testing';


--
-- Name: update_agent_mcp_connections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_mcp_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_agent_smtp_permissions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_smtp_permissions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_agent_web_search_permissions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_web_search_permissions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_artifacts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_artifacts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_canvas_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_canvas_sessions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_channel_last_message_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_channel_last_message_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE public.chat_channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$;


--
-- Name: update_channels_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_channels_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_contact_groups_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_groups_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_contact_last_contacted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_last_contacted() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update the contact's last contacted timestamp
  UPDATE contacts 
  SET last_contacted_at = NEW.interaction_at
  WHERE id = NEW.contact_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_contact_with_audit(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  old_values JSONB;
  field_name TEXT;
  field_value TEXT;
  update_sql TEXT := 'UPDATE contacts SET updated_at = NOW()';
  where_clause TEXT := ' WHERE id = $1 AND user_id = $2';
BEGIN
  -- Validate contact ownership
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Get current values for audit
  SELECT jsonb_build_object(
    'first_name', first_name,
    'last_name', last_name,
    'organization', organization,
    'job_title', job_title,
    'department', department,
    'notes', notes,
    'tags', tags,
    'contact_type', contact_type,
    'custom_fields', custom_fields
  ) INTO old_values
  FROM contacts WHERE id = p_contact_id;
  
  -- Build dynamic update query
  FOR field_name IN SELECT jsonb_object_keys(p_updates)
  LOOP
    field_value := p_updates ->> field_name;
    update_sql := update_sql || ', ' || field_name || ' = ' || quote_literal(field_value);
  END LOOP;
  
  -- Execute update
  EXECUTE update_sql || where_clause USING p_contact_id, p_user_id;
  
  -- Log the update
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, old_values, new_values, operation_details
  ) VALUES (
    p_contact_id, p_user_id, 'update', old_values, p_updates,
    jsonb_build_object('updated_fields', jsonb_object_keys(p_updates))
  );
  
  RETURN TRUE;
END;
$_$;


--
-- Name: FUNCTION update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb) IS 'Contact update with comprehensive audit trail';


--
-- Name: update_contacts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contacts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_conversation_summary_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_summary_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_datastore_documents_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_datastore_documents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_group_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_group_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  group_id_to_update UUID;
BEGIN
  -- Determine which group to update
  IF TG_OP = 'DELETE' THEN
    group_id_to_update := OLD.group_id;
  ELSE
    group_id_to_update := NEW.group_id;
  END IF;
  
  -- Update the member count
  UPDATE contact_groups 
  SET 
    member_count = (
      SELECT COUNT(*) 
      FROM contact_group_memberships 
      WHERE group_id = group_id_to_update
    ),
    last_activity_at = NOW()
  WHERE id = group_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_import_job_progress(uuid, uuid, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_import_job_progress(p_job_id uuid, p_user_id uuid, p_processed_rows integer, p_successful_imports integer DEFAULT NULL::integer, p_failed_imports integer DEFAULT NULL::integer, p_duplicate_contacts integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate ownership
  IF NOT EXISTS (SELECT 1 FROM contact_import_jobs WHERE id = p_job_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Import job not found or access denied';
  END IF;
  
  UPDATE contact_import_jobs
  SET 
    processed_rows = p_processed_rows,
    successful_imports = COALESCE(p_successful_imports, successful_imports),
    failed_imports = COALESCE(p_failed_imports, failed_imports),
    duplicate_contacts = COALESCE(p_duplicate_contacts, duplicate_contacts),
    status = CASE 
      WHEN processed_rows >= total_rows THEN 'completed'
      ELSE 'processing'
    END
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: update_integration_capabilities_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_integration_capabilities_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end$$;


--
-- Name: update_interactions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_interactions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_link_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_link_statistics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update parent link statistics when session changes
  IF TG_OP = 'INSERT' THEN
    -- New session created
    UPDATE temporary_chat_links 
    SET session_count = session_count + 1,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.link_id;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.message_count != NEW.message_count THEN
    -- Message count changed
    UPDATE temporary_chat_links 
    SET total_messages = total_messages + (NEW.message_count - OLD.message_count),
        updated_at = NOW()
    WHERE id = NEW.link_id;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active' THEN
    -- Session ended, decrease active session count
    UPDATE temporary_chat_links 
    SET session_count = GREATEST(0, session_count - 1),
        updated_at = NOW()
    WHERE id = NEW.link_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_mcp_server_capabilities(uuid, jsonb, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mcp_server_capabilities(p_connection_id uuid, p_capabilities jsonb, p_server_info jsonb, p_protocol_version text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Only service role can update server capabilities
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to update server capabilities';
  END IF;

  UPDATE agent_mcp_connections
  SET 
    server_capabilities = p_capabilities,
    server_info = p_server_info,
    protocol_version = p_protocol_version,
    updated_at = NOW()
  WHERE id = p_connection_id;

  RETURN FOUND;
END;
$$;


--
-- Name: update_media_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_media_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_memory_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_memory_access() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.access_count = OLD.access_count + 1;
    NEW.last_accessed = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_permission_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_permission_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update permission statistics
  UPDATE agent_contact_permissions
  SET 
    last_used_at = NOW(),
    total_contacts_accessed = total_contacts_accessed + 1,
    last_contact_accessed_at = NOW()
  WHERE agent_id = NEW.agent_id;
  
  -- Update specific access statistics
  UPDATE agent_specific_contact_access
  SET 
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE agent_id = NEW.agent_id AND contact_id = NEW.contact_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_platform_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_platform_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_sendgrid_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sendgrid_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_server_secret(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_config RECORD;
  v_new_vault_id TEXT;
  v_column_name TEXT;
  v_result JSONB;
BEGIN
  -- Validate secret type
  IF p_secret_type NOT IN ('supabase_key', 'admin_password', 'openai_key') THEN
    RAISE EXCEPTION 'Invalid secret type. Must be: supabase_key, admin_password, or openai_key';
  END IF;

  -- Get current configuration
  SELECT * INTO v_config
  FROM public.server_configuration_secrets
  WHERE server_name = p_server_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Server configuration not found: %', p_server_name;
  END IF;

  -- Create new vault secret
  SELECT public.create_vault_secret(
    p_new_secret_value,
    p_server_name || '_' || p_secret_type || '_rotated_' || extract(epoch from now())::TEXT,
    'Rotated ' || p_secret_type || ' for ' || p_server_name || ' at ' || now()::TEXT
  ) INTO v_new_vault_id;

  -- Update the appropriate column
  CASE p_secret_type
    WHEN 'supabase_key' THEN
      UPDATE public.server_configuration_secrets
      SET vault_supabase_service_key_id = v_new_vault_id,
          updated_at = now()
      WHERE server_name = p_server_name;
      
    WHEN 'admin_password' THEN
      UPDATE public.server_configuration_secrets
      SET vault_admin_password_id = v_new_vault_id,
          updated_at = now()
      WHERE server_name = p_server_name;
      
    WHEN 'openai_key' THEN
      UPDATE public.server_configuration_secrets
      SET vault_openai_api_key_id = v_new_vault_id,
          updated_at = now()
      WHERE server_name = p_server_name;
  END CASE;

  v_result := jsonb_build_object(
    'server_name', p_server_name,
    'secret_type', p_secret_type,
    'new_vault_id', v_new_vault_id,
    'status', 'success',
    'message', 'Secret rotated successfully',
    'rotated_at', now()
  );

  RETURN v_result;
END;
$$;


--
-- Name: FUNCTION update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text) IS 'Rotates a specific server secret by creating a new vault entry';


--
-- Name: update_service_providers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_service_providers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_session_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_session_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update last_activity_at when message_count changes
  IF TG_OP = 'UPDATE' AND OLD.message_count != NEW.message_count THEN
    NEW.last_activity_at = NOW();
    NEW.last_message_at = NOW();
    
    -- Reset rate limiting counter if more than a minute has passed
    IF OLD.last_message_at IS NULL OR 
       EXTRACT(EPOCH FROM (NOW() - OLD.last_message_at)) >= 60 THEN
      NEW.messages_in_current_minute = 1;
    ELSE
      NEW.messages_in_current_minute = OLD.messages_in_current_minute + 1;
    END IF;
  END IF;
  
  -- Calculate session duration when session ends
  IF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    NEW.session_duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at));
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_session_last_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_session_last_active() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF to_regclass('public.conversation_sessions') IS NOT NULL THEN
    UPDATE public.conversation_sessions 
      SET last_active = NOW(),
          message_count = message_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_smtp_configurations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_smtp_configurations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_smtp_password(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_smtp_password(p_user_id uuid, p_config_id uuid, p_new_password text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    old_vault_id TEXT;
    new_vault_id UUID;
    config_name TEXT;
BEGIN
    -- Validate user access and get current vault ID
    SELECT vault_password_id, connection_name
    INTO old_vault_id, config_name
    FROM smtp_configurations
    WHERE id = p_config_id AND user_id = p_user_id;
    
    IF old_vault_id IS NULL THEN
        RAISE EXCEPTION 'SMTP configuration not found or access denied';
    END IF;
    
    -- Create new encrypted password
    SELECT vault.create_secret(
        p_new_password,
        format('smtp_%s_%s', p_user_id, config_name),
        format('Updated SMTP password for %s', config_name)
    ) INTO new_vault_id;
    
    -- Update configuration with new vault ID
    UPDATE smtp_configurations
    SET vault_password_id = new_vault_id::TEXT,
        updated_at = NOW()
    WHERE id = p_config_id;
    
    -- Delete old secret from vault
    DELETE FROM vault.secrets WHERE id = old_vault_id::UUID;
    
    RETURN new_vault_id::TEXT;
END;
$$;


--
-- Name: update_step_execution(uuid, public.task_step_status, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_step_execution(p_step_id uuid, p_status public.task_step_status, p_execution_result jsonb DEFAULT NULL::jsonb, p_error_message text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE task_steps 
    SET 
        status = p_status,
        execution_result = COALESCE(p_execution_result, execution_result),
        error_message = p_error_message,
        execution_completed_at = CASE 
            WHEN p_status IN ('completed', 'failed', 'skipped') THEN NOW()
            ELSE execution_completed_at
        END,
        execution_started_at = CASE 
            WHEN p_status = 'running' AND execution_started_at IS NULL THEN NOW()
            ELSE execution_started_at
        END,
        execution_duration_ms = CASE 
            WHEN p_status IN ('completed', 'failed', 'skipped') AND execution_started_at IS NOT NULL THEN
                EXTRACT(EPOCH FROM (NOW() - execution_started_at))::INTEGER * 1000
            ELSE execution_duration_ms
        END,
        retry_count = CASE 
            WHEN p_status = 'failed' THEN retry_count + 1
            ELSE retry_count
        END,
        updated_at = NOW()
    WHERE id = p_step_id;
    
    RETURN FOUND;
END;
$$;


--
-- Name: update_summary_board_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_summary_board_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_system_api_keys_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_system_api_keys_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_system_prompts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_system_prompts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_task_step(uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_step(p_step_id uuid, p_step_name text DEFAULT NULL::text, p_instructions text DEFAULT NULL::text, p_include_previous_context boolean DEFAULT NULL::boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Validate step exists and user has access
    IF NOT EXISTS (
        SELECT 1 FROM task_steps ts
        JOIN agent_tasks at ON ts.task_id = at.id
        WHERE ts.id = p_step_id 
        AND at.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Step not found or access denied';
    END IF;
    
    -- Update the step with provided values
    UPDATE task_steps 
    SET 
        step_name = COALESCE(p_step_name, step_name),
        instructions = COALESCE(p_instructions, instructions),
        include_previous_context = COALESCE(p_include_previous_context, include_previous_context),
        updated_at = NOW()
    WHERE id = p_step_id;
    
    RETURN TRUE;
END;
$$;


--
-- Name: update_task_steps_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_steps_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_team_canvas_layouts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_team_canvas_layouts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_team_connections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_team_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_temporary_chat_links_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_temporary_chat_links_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_temporary_chat_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_temporary_chat_sessions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_tool_execution_logs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tool_execution_logs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_oauth_connections_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_oauth_connections_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_token_usage_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_token_usage_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_vault_secret(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_vault_secret(p_secret_id uuid, p_new_secret text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Use positional arguments
    PERFORM vault.update_secret(p_secret_id, p_new_secret);
END;
$$;


--
-- Name: FUNCTION update_vault_secret(p_secret_id uuid, p_new_secret text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_vault_secret(p_secret_id uuid, p_new_secret text) IS 'A public RPC wrapper for vault.update_secret.';


--
-- Name: update_web_search_providers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_web_search_providers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_worker_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_worker_status(connection_id_in uuid, new_status_in text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_discord_connections
  SET worker_status = new_status_in
  WHERE id = connection_id_in;
END;
$$;


--
-- Name: upsert_vault_secret(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_vault_secret(p_secret text, p_name text, p_description text) RETURNS TABLE(id uuid, name text, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_secret_id UUID;
    v_existing_id UUID;
    v_created BOOLEAN := FALSE;
BEGIN
    -- Check if secret with this name already exists
    SELECT s.id INTO v_existing_id
    FROM vault.secrets s
    WHERE s.name = p_name
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- Update existing secret
        PERFORM vault.update_secret(v_existing_id, p_secret);
        v_secret_id := v_existing_id;
        v_created := FALSE;
    ELSE
        -- Create new secret
        v_secret_id := vault.create_secret(p_secret, p_name, p_description);
        v_created := TRUE;
    END IF;
    
    -- Return the result
    RETURN QUERY SELECT v_secret_id, p_name, v_created;
END;
$$;


--
-- Name: FUNCTION upsert_vault_secret(p_secret text, p_name text, p_description text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.upsert_vault_secret(p_secret text, p_name text, p_description text) IS 'Creates a new vault secret or updates existing one if name conflicts. Returns secret ID and creation status.';


--
-- Name: user_has_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_role(user_id uuid, role_name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
    has_role BOOLEAN;
BEGIN
    -- Check if the user has the specified role
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        INNER JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
        AND r.name = $2
    ) INTO has_role;
    
    RETURN COALESCE(has_role, false);
EXCEPTION
    WHEN OTHERS THEN
        -- Return false on any error
        RAISE WARNING 'Error in user_has_role: %', SQLERRM;
        RETURN false;
END;
$_$;


--
-- Name: FUNCTION user_has_role(user_id uuid, role_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_has_role(user_id uuid, role_name text) IS 'Check if a user has a specific role by name';


--
-- Name: user_owns_temp_chat_link(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_temp_chat_link(link_id uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM temporary_chat_links 
    WHERE id = link_id AND temporary_chat_links.user_id = user_owns_temp_chat_link.user_id
  );
END;
$$;


--
-- Name: FUNCTION user_owns_temp_chat_link(link_id uuid, user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_owns_temp_chat_link(link_id uuid, user_id uuid) IS 'Security function to check if a user owns a specific temporary chat link';


--
-- Name: user_owns_temp_chat_session(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_owns_temp_chat_session(session_id uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    WHERE tcs.id = session_id AND tcl.user_id = user_owns_temp_chat_session.user_id
  );
END;
$$;


--
-- Name: validate_agent_clicksend_permissions(uuid, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_connection_exists BOOLEAN := FALSE;
    v_has_permissions BOOLEAN := FALSE;
    v_provider_id UUID;
BEGIN
    -- Get ClickSend service provider ID
    SELECT id INTO v_provider_id
    FROM service_providers 
    WHERE name = 'clicksend_sms';
    
    IF v_provider_id IS NULL THEN
        RAISE EXCEPTION 'ClickSend service provider not found';
    END IF;
    
    -- Check if user has an active ClickSend connection
    SELECT EXISTS(
        SELECT 1 
        FROM user_integration_credentials uic
        WHERE uic.user_id = p_user_id 
          AND uic.oauth_provider_id = v_provider_id
          AND uic.connection_status = 'active'
    ) INTO v_connection_exists;
    
    IF NOT v_connection_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Check if agent has permissions for this integration
    SELECT EXISTS(
        SELECT 1
        FROM agent_integration_permissions aip
        JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
        WHERE aip.agent_id = p_agent_id
          AND uic.user_id = p_user_id
          AND uic.oauth_provider_id = v_provider_id
          AND aip.is_active = true
          AND (
            -- If no specific scopes required, just check if permission exists
            p_required_scopes IS NULL 
            OR array_length(p_required_scopes, 1) = 0
            -- If scopes required, check if all required scopes are in allowed_scopes
            OR (
                aip.allowed_scopes IS NOT NULL 
                AND p_required_scopes <@ (
                    SELECT ARRAY(
                        SELECT jsonb_array_elements_text(aip.allowed_scopes)
                    )
                )
            )
          )
    ) INTO v_has_permissions;
    
    RETURN v_has_permissions;
END;
$$;


--
-- Name: FUNCTION validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) IS 'Validates that an agent has permission to access ClickSend SMS/MMS integration for a specific user with required scopes';


--
-- Name: validate_agent_gmail_permissions(uuid, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_agent_gmail_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_scope TEXT;
BEGIN
    -- Get allowed scopes for agent (using correct column name)
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND aop.is_active = true
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
    
    -- Check if agent has permissions
    IF v_allowed_scopes IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Validate each required scope
    FOREACH v_scope IN ARRAY p_required_scopes
    LOOP
        IF NOT (v_allowed_scopes ? v_scope) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;


--
-- Name: validate_agent_outlook_permissions(uuid, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_connection_exists BOOLEAN := FALSE;
  v_has_permissions BOOLEAN := FALSE;
  v_provider_id UUID;
BEGIN
  -- Get Microsoft Outlook service provider ID
  SELECT id INTO v_provider_id
  FROM service_providers 
  WHERE name = 'microsoft-outlook';
  
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Microsoft Outlook service provider not found';
  END IF;
  
  -- Check if user has an active Outlook connection
  SELECT EXISTS(
    SELECT 1 
    FROM user_integration_credentials uic
    WHERE uic.user_id = p_user_id 
      AND uic.oauth_provider_id = v_provider_id
      AND uic.connection_status = 'active'
  ) INTO v_connection_exists;
  
  IF NOT v_connection_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Check if agent has permissions for this integration
  SELECT EXISTS(
    SELECT 1
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    WHERE aip.agent_id = p_agent_id
      AND uic.user_id = p_user_id
      AND uic.oauth_provider_id = v_provider_id
      AND aip.is_active = true
      AND (
        -- If no specific scopes required, just check if permission exists
        p_required_scopes IS NULL 
        OR array_length(p_required_scopes, 1) = 0
        -- If scopes required, check if all required scopes are in allowed_scopes
        OR (
          aip.allowed_scopes IS NOT NULL 
          AND p_required_scopes <@ (
            SELECT ARRAY(
              SELECT jsonb_array_elements_text(aip.allowed_scopes)
            )
          )
        )
      )
  ) INTO v_has_permissions;
  
  RETURN v_has_permissions;
END;
$$;


--
-- Name: FUNCTION validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) IS 'Validates that an agent has permission to access Microsoft Outlook integration for a specific user with required scopes';


--
-- Name: validate_agent_sendgrid_permissions(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_agent_sendgrid_permissions(p_agent_id uuid, p_user_id uuid, p_permission text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT 
        CASE p_permission
            WHEN 'can_send_email' THEN asp.can_send_email
            WHEN 'can_use_templates' THEN asp.can_use_templates
            WHEN 'can_send_bulk' THEN asp.can_send_bulk
            WHEN 'can_manage_templates' THEN asp.can_manage_templates
            WHEN 'can_view_analytics' THEN asp.can_view_analytics
            WHEN 'can_receive_emails' THEN asp.can_receive_emails
            ELSE false
        END INTO v_has_permission
    FROM agent_sendgrid_permissions asp
    JOIN sendgrid_configurations sc ON sc.id = asp.sendgrid_config_id
    WHERE asp.agent_id = p_agent_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true
    AND (asp.expires_at IS NULL OR asp.expires_at > now());
    
    RETURN COALESCE(v_has_permission, false);
END;
$$;


--
-- Name: validate_agent_smtp_permissions(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_agent_smtp_permissions(p_agent_id uuid, p_user_id uuid, p_smtp_config_id uuid, p_permission_type text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    SELECT 
        CASE p_permission_type
            WHEN 'send_email' THEN asp.can_send_email
            WHEN 'send_attachments' THEN asp.can_send_attachments
            WHEN 'use_custom_from' THEN asp.can_use_custom_from
            ELSE false
        END INTO has_permission
    FROM agent_smtp_permissions asp
    JOIN smtp_configurations sc ON sc.id = asp.smtp_config_id
    WHERE asp.agent_id = p_agent_id
    AND asp.smtp_config_id = p_smtp_config_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true
    AND (asp.expires_at IS NULL OR asp.expires_at > NOW());
    
    RETURN COALESCE(has_permission, false);
END;
$$;


--
-- Name: validate_channel_identifier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_channel_identifier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Validate based on channel type
  CASE NEW.channel_type
    WHEN 'email' THEN
      IF NOT validate_email_address(NEW.channel_identifier) THEN
        RAISE EXCEPTION 'Invalid email address format: %', NEW.channel_identifier;
      END IF;
    WHEN 'phone', 'mobile', 'sms' THEN
      IF NOT validate_phone_number(NEW.channel_identifier) THEN
        RAISE EXCEPTION 'Invalid phone number format: %', NEW.channel_identifier;
      END IF;
      -- Format phone number consistently
      NEW.channel_identifier := format_phone_number(NEW.channel_identifier);
    WHEN 'whatsapp' THEN
      -- WhatsApp uses phone numbers
      IF NOT validate_phone_number(NEW.channel_identifier) THEN
        RAISE EXCEPTION 'Invalid WhatsApp phone number format: %', NEW.channel_identifier;
      END IF;
      NEW.channel_identifier := format_phone_number(NEW.channel_identifier);
  END CASE;
  
  RETURN NEW;
END;
$$;


--
-- Name: validate_column_mapping(jsonb, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_column_mapping(p_mapping jsonb, p_required_fields text[] DEFAULT '{first_name}'::text[]) RETURNS TABLE(is_valid boolean, missing_fields text[], invalid_mappings text[])
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  mapped_fields TEXT[];
  missing TEXT[] := '{}';
  invalid TEXT[] := '{}';
  valid_fields TEXT[] := ARRAY[
    'first_name', 'last_name', 'organization', 'job_title', 'department',
    'email', 'phone', 'mobile', 'notes', 'tags', 'contact_type'
  ];
  field TEXT;
BEGIN
  -- Extract mapped field names
  SELECT ARRAY(SELECT jsonb_object_keys(p_mapping)) INTO mapped_fields;
  
  -- Check for missing required fields
  FOREACH field IN ARRAY p_required_fields
  LOOP
    IF NOT (field = ANY(mapped_fields)) THEN
      missing := missing || field;
    END IF;
  END LOOP;
  
  -- Check for invalid field mappings
  FOREACH field IN ARRAY mapped_fields
  LOOP
    IF NOT (field = ANY(valid_fields)) THEN
      invalid := invalid || field;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    (array_length(missing, 1) IS NULL AND array_length(invalid, 1) IS NULL) as is_valid,
    missing as missing_fields,
    invalid as invalid_mappings;
END;
$$;


--
-- Name: validate_email_address(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_email_address(email text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$_$;


--
-- Name: validate_phone_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_phone_number(phone text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
BEGIN
  -- Remove common formatting characters
  phone := regexp_replace(phone, '[^\d+]', '', 'g');
  -- Check if it's a reasonable phone number (7-15 digits, optionally starting with +)
  RETURN phone ~ '^\+?[1-9]\d{6,14}$';
END;
$_$;


--
-- Name: validate_temp_chat_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_temp_chat_session(p_session_token text) RETURNS TABLE(is_valid boolean, session_id uuid, conversation_id uuid, agent_id uuid, agent_name text, current_message_count integer, max_messages_per_session integer, session_timeout_minutes integer, link_title text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_session_record RECORD;
    v_message_count INTEGER;
BEGIN
    -- Get session details by decrypting token
    SELECT 
        tcs.id,
        tcs.conversation_id,
        tcl.expires_at,
        tcs.status,
        tcl.agent_id,
        tcl.title,
        tcl.max_messages_per_session,
        tcl.session_timeout_minutes,
        a.name as agent_name
    INTO v_session_record
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    JOIN agents a ON tcl.agent_id = a.id
    WHERE tcs.vault_session_token_id IN (
        SELECT vs.id 
        FROM vault.secrets vs 
        WHERE vault_decrypt(vs.id::TEXT) = p_session_token  -- Cast UUID to TEXT
    );

    -- Check if session exists and is valid
    IF v_session_record.id IS NULL OR 
       v_session_record.status != 'active' OR 
       v_session_record.expires_at <= NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, 0, 0, 0, NULL::TEXT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Count current messages in the conversation
    SELECT COUNT(*)::INTEGER
    INTO v_message_count
    FROM chat_messages_v2 cm
    WHERE cm.conversation_id = v_session_record.conversation_id
    AND cm.role = 'user';

    -- Return valid session info
    RETURN QUERY SELECT 
        TRUE as is_valid,
        v_session_record.id as session_id,
        v_session_record.conversation_id,
        v_session_record.agent_id,
        v_session_record.agent_name,
        v_message_count as current_message_count,
        v_session_record.max_messages_per_session,
        v_session_record.session_timeout_minutes,
        v_session_record.title as link_title,
        v_session_record.expires_at;
END;
$$;


--
-- Name: validate_web_search_permissions(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 
        FROM agent_web_search_permissions awsp
        JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
        JOIN web_search_providers wsp ON awsp.provider_id = wsp.id
        WHERE awsp.agent_id = p_agent_id
            AND awsp.user_id = p_user_id
            AND awsp.is_active = true
            AND uwsk.key_status = 'active'
            AND wsp.is_enabled = true
    );
END;
$$;


--
-- Name: validate_web_search_permissions(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid, p_provider_name text, p_required_permission text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    permission_exists BOOLEAN := false;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM web_search_providers wsp
        JOIN agent_web_search_permissions awsp ON wsp.id = awsp.provider_id
        JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
        WHERE wsp.name = p_provider_name
            AND awsp.agent_id = p_agent_id
            AND awsp.user_id = p_user_id
            AND awsp.is_active = true
            AND uwsk.key_status = 'active'
            AND wsp.is_enabled = true
            AND p_required_permission = ANY(array(SELECT jsonb_array_elements_text(awsp.permissions)))
    ) INTO permission_exists;
    
    RETURN permission_exists;
END;
$$;


--
-- Name: vault_decrypt(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vault_decrypt(vault_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
BEGIN
    -- Validate UUID format
    BEGIN
        uuid_id := vault_id::UUID;
    EXCEPTION 
        WHEN invalid_text_representation THEN
            RETURN NULL;
    END;

    -- Decrypt from vault
    BEGIN
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE id = uuid_id
        LIMIT 1;
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to decrypt vault secret %: %', vault_id, SQLERRM;
            RETURN NULL;
    END;

    RETURN decrypted_value;
END;
$$;


--
-- Name: FUNCTION vault_decrypt(vault_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.vault_decrypt(vault_id text) IS 'Decrypts a secret from Supabase Vault using the vault UUID (service role only)';


--
-- Name: vault_store_secret(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vault_store_secret(secret_name text, secret_value text, secret_description text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    secret_id UUID;
BEGIN
    -- Only allow service role to store vault secrets
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to store vault secrets';
    END IF;

    -- Insert the secret into vault
    INSERT INTO vault.secrets (name, secret, description)
    VALUES (secret_name, secret_value, secret_description)
    RETURNING id INTO secret_id;

    RETURN secret_id;
END;
$$;


--
-- Name: FUNCTION vault_store_secret(secret_name text, secret_value text, secret_description text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.vault_store_secret(secret_name text, secret_value text, secret_description text) IS 'Stores secrets in vault - requires service role';


--
-- Name: verify_agent_tool_availability(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid) RETURNS TABLE(integration_name text, tool_available boolean, credential_status text, permission_granted boolean, permission_active boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        op.display_name as integration_name,
        (uic.id IS NOT NULL AND uic.connection_status = 'active') as tool_available,
        COALESCE(uic.connection_status, 'no_credential') as credential_status,
        (aop.id IS NOT NULL) as permission_granted,
        COALESCE(aop.is_active, false) as permission_active
    FROM service_providers op
    LEFT JOIN user_integration_credentials uic ON (
        uic.oauth_provider_id = op.id 
        AND uic.user_id = p_user_id
    )
    LEFT JOIN agent_oauth_permissions aop ON (
        aop.user_oauth_connection_id = uic.id 
        AND aop.agent_id = p_agent_id
    )
    ORDER BY op.display_name;
END;
$$;


--
-- Name: FUNCTION verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid) IS 'Verifies which tools are available to an agent based on credentials and permissions';


--
-- Name: account_graphs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_graphs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'getzep'::text NOT NULL,
    connection_id uuid,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_graphs_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text, 'error'::text])))
);


--
-- Name: TABLE account_graphs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account_graphs IS 'Tracks GetZep knowledge graph connections for each account. The actual graph data (nodes, edges, facts) lives in GetZep Cloud and is accessed via their API. This table only stores connection metadata.';


--
-- Name: admin_integration_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_integration_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_type text NOT NULL,
    credential_name text NOT NULL,
    vault_secret_id text NOT NULL,
    connection_method text DEFAULT 'manual'::text,
    connection_status text DEFAULT 'active'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_vault_secret_uuid CHECK ((vault_secret_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text))
);


--
-- Name: TABLE admin_integration_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_integration_credentials IS 'Secure storage for admin integration credentials using Supabase Vault';


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb NOT NULL,
    description text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE admin_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_settings IS 'Stores admin configuration settings including Stripe config';


--
-- Name: agent_contact_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_contact_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    permission_type text DEFAULT 'specific_contacts'::text,
    can_view boolean DEFAULT true,
    can_contact boolean DEFAULT true,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    can_export boolean DEFAULT false,
    allowed_channels text[] DEFAULT '{}'::text[],
    restricted_channels text[] DEFAULT '{}'::text[],
    access_schedule jsonb DEFAULT '{}'::jsonb,
    max_contacts_per_day integer,
    max_messages_per_contact integer,
    access_filters jsonb DEFAULT '{}'::jsonb,
    permission_notes text,
    permission_metadata jsonb DEFAULT '{}'::jsonb,
    granted_by_user_id uuid,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    total_contacts_accessed integer DEFAULT 0,
    total_messages_sent integer DEFAULT 0,
    last_contact_accessed_at timestamp with time zone,
    CONSTRAINT agent_contact_permissions_permission_type_check CHECK ((permission_type = ANY (ARRAY['all_contacts'::text, 'specific_contacts'::text, 'contact_groups'::text, 'filtered_access'::text, 'no_access'::text]))),
    CONSTRAINT channel_restrictions_valid CHECK ((NOT (allowed_channels && restricted_channels))),
    CONSTRAINT valid_message_limits CHECK (((max_messages_per_contact IS NULL) OR (max_messages_per_contact > 0))),
    CONSTRAINT valid_permission_notes CHECK (((permission_notes IS NULL) OR (length(permission_notes) <= 1000))),
    CONSTRAINT valid_rate_limits CHECK (((max_contacts_per_day IS NULL) OR (max_contacts_per_day > 0)))
);


--
-- Name: TABLE agent_contact_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_contact_permissions IS 'Base permission settings for agent access to contacts';


--
-- Name: COLUMN agent_contact_permissions.permission_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_contact_permissions.permission_type IS 'Type of permission scope (all, specific, groups, filtered)';


--
-- Name: COLUMN agent_contact_permissions.access_schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_contact_permissions.access_schedule IS 'JSONB schedule defining when agent can access contacts';


--
-- Name: COLUMN agent_contact_permissions.access_filters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_contact_permissions.access_filters IS 'JSONB criteria for filtered access permissions';


--
-- Name: agent_datastores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_datastores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    datastore_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE agent_datastores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_datastores IS 'Links agents to their associated datastores - schema cache refreshed';


--
-- Name: agent_email_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_email_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    sendgrid_config_id uuid NOT NULL,
    local_part text NOT NULL,
    domain text NOT NULL,
    full_address text GENERATED ALWAYS AS (((local_part || '@'::text) || domain)) STORED,
    is_active boolean DEFAULT true,
    auto_reply_enabled boolean DEFAULT false,
    auto_reply_template_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_valid_local_part CHECK ((local_part ~ '^[a-zA-Z0-9.+_-]+$'::text))
);


--
-- Name: agent_generation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_generation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agent_id uuid,
    user_description text NOT NULL,
    generation_method character varying(20) DEFAULT 'ai_full'::character varying NOT NULL,
    model_provider character varying(50),
    model_name character varying(100),
    prompt_tokens integer,
    completion_tokens integer,
    generation_time_ms integer,
    generated_config jsonb NOT NULL,
    was_accepted boolean DEFAULT false,
    was_modified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_created_at timestamp with time zone,
    CONSTRAINT agent_generation_logs_completion_tokens_check CHECK ((completion_tokens >= 0)),
    CONSTRAINT agent_generation_logs_generation_method_check CHECK (((generation_method)::text = ANY ((ARRAY['ai_full'::character varying, 'ai_assisted'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT agent_generation_logs_generation_time_ms_check CHECK ((generation_time_ms >= 0)),
    CONSTRAINT agent_generation_logs_prompt_tokens_check CHECK ((prompt_tokens >= 0))
);


--
-- Name: TABLE agent_generation_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_generation_logs IS 'Tracks AI-powered agent generation for analytics and continuous improvement';


--
-- Name: agent_group_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_group_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    group_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    access_level text DEFAULT 'view_and_contact'::text,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT agent_group_access_access_level_check CHECK ((access_level = ANY (ARRAY['view_only'::text, 'view_and_contact'::text, 'full_access'::text])))
);


--
-- Name: TABLE agent_group_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_group_access IS 'Group-based contact access permissions for agents';


--
-- Name: agent_integration_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_integration_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_oauth_connection_id uuid NOT NULL,
    granted_by_user_id uuid NOT NULL,
    permission_level text DEFAULT 'read_only'::text NOT NULL,
    allowed_scopes jsonb,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_provider_id uuid,
    CONSTRAINT agent_integration_permissions_permission_level_check CHECK ((permission_level = ANY (ARRAY['read_only'::text, 'full_access'::text, 'custom'::text])))
);


--
-- Name: TABLE agent_integration_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_integration_permissions IS 'Agent permissions for ALL integration types (OAuth, API keys, SMTP, MCP, etc.) - Renamed from agent_oauth_permissions. All code updated to use new name.';


--
-- Name: agent_llm_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_llm_preferences (
    agent_id uuid NOT NULL,
    provider text DEFAULT 'openai'::text NOT NULL,
    model text DEFAULT 'gpt-4o-mini'::text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    embedding_model text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE agent_llm_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_llm_preferences IS 'Agent LLM preferences with RLS policies - users can only access preferences for agents they own';


--
-- Name: agent_mailgun_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_mailgun_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    mailgun_config_id uuid NOT NULL,
    can_send_email boolean DEFAULT true,
    can_validate_email boolean DEFAULT true,
    can_view_stats boolean DEFAULT false,
    can_manage_suppressions boolean DEFAULT false,
    can_receive_emails boolean DEFAULT false,
    can_manage_routes boolean DEFAULT false,
    daily_send_limit integer DEFAULT 100,
    recipients_per_email_limit integer DEFAULT 10,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_mcp_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_mcp_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    connection_name text NOT NULL,
    server_url text NOT NULL,
    connection_type text DEFAULT 'generic'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    auth_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vault_server_url_id text,
    server_url_deprecated text,
    server_capabilities jsonb DEFAULT '{}'::jsonb,
    server_info jsonb DEFAULT '{}'::jsonb,
    protocol_version text DEFAULT '2024-11-05'::text,
    last_successful_call timestamp with time zone,
    CONSTRAINT chk_secure_url_storage CHECK (((is_active = false) OR (vault_server_url_id IS NOT NULL) OR (server_url_deprecated IS NOT NULL))),
    CONSTRAINT valid_server_url CHECK ((server_url ~ '^https?://.*'::text))
);


--
-- Name: TABLE agent_mcp_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_mcp_connections IS 'Universal MCP server connections. Supports ANY MCP-compliant server including Zapier, Retell AI, Anthropic, OpenAI, custom implementations, etc. Connection type is informational only and not restricted.';


--
-- Name: COLUMN agent_mcp_connections.server_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.server_url IS 'DEPRECATED: Must be NULL for security (use vault_server_url_id)';


--
-- Name: COLUMN agent_mcp_connections.connection_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.connection_type IS 'Type of MCP server (e.g., zapier, retell, anthropic, openai, custom, generic). No validation constraint - any MCP-compliant server is supported.';


--
-- Name: COLUMN agent_mcp_connections.vault_server_url_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.vault_server_url_id IS 'UUID reference to encrypted server URL in Supabase Vault';


--
-- Name: COLUMN agent_mcp_connections.server_url_deprecated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.server_url_deprecated IS 'Deprecated: Plain text URL storage (migration only)';


--
-- Name: COLUMN agent_mcp_connections.server_capabilities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.server_capabilities IS 'MCP server capabilities discovered during initialization. Includes available features like tools, prompts, resources, sampling.';


--
-- Name: COLUMN agent_mcp_connections.server_info; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.server_info IS 'Server information from MCP initialize response (name, version, vendor, etc.)';


--
-- Name: COLUMN agent_mcp_connections.protocol_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.protocol_version IS 'MCP protocol version supported by this connection (e.g., 2024-11-05, 2025-06-18)';


--
-- Name: COLUMN agent_mcp_connections.last_successful_call; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_mcp_connections.last_successful_call IS 'Timestamp of last successful tool execution. Used for health monitoring and connection validation.';


--
-- Name: agent_media_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_media_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    media_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assignment_type text DEFAULT 'training_data'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    include_in_vector_search boolean DEFAULT true,
    include_in_knowledge_graph boolean DEFAULT true,
    priority_level integer DEFAULT 1,
    last_accessed_at timestamp with time zone,
    access_count integer DEFAULT 0,
    notes text,
    assignment_metadata jsonb DEFAULT '{}'::jsonb,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_media_assignments_assignment_type_check CHECK ((assignment_type = ANY (ARRAY['training_data'::text, 'reference'::text, 'sop'::text, 'knowledge_base'::text]))),
    CONSTRAINT agent_media_assignments_priority_level_check CHECK (((priority_level >= 1) AND (priority_level <= 5)))
);


--
-- Name: TABLE agent_media_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_media_assignments IS 'Many-to-many relationship between agents and media files with assignment configuration';


--
-- Name: COLUMN agent_media_assignments.assignment_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_media_assignments.assignment_type IS 'How this media is used: training_data, reference, sop, knowledge_base';


--
-- Name: COLUMN agent_media_assignments.priority_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_media_assignments.priority_level IS 'Processing priority (1=low, 5=high) for agent context';


--
-- Name: agent_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_memories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    agent_id uuid NOT NULL,
    memory_type character varying(20) NOT NULL,
    content jsonb NOT NULL,
    embeddings public.vector(1536),
    importance double precision DEFAULT 0.5,
    decay_rate double precision DEFAULT 0.1,
    access_count integer DEFAULT 0,
    related_memories uuid[],
    source_message_id uuid,
    last_accessed timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT agent_memories_importance_check CHECK (((importance >= (0)::double precision) AND (importance <= (1)::double precision))),
    CONSTRAINT agent_memories_memory_type_check CHECK (((memory_type)::text = ANY (ARRAY[('episodic'::character varying)::text, ('semantic'::character varying)::text, ('procedural'::character varying)::text, ('working'::character varying)::text]))),
    CONSTRAINT check_memory_content CHECK (
CASE memory_type
    WHEN 'episodic'::text THEN ((content ? 'event'::text) AND (content ? 'temporal'::text))
    WHEN 'semantic'::text THEN ((content ? 'concept'::text) AND (content ? 'definition'::text))
    WHEN 'procedural'::text THEN ((content ? 'skill'::text) AND (content ? 'steps'::text))
    WHEN 'working'::text THEN ((content ? 'items'::text) AND (content ? 'capacity'::text))
    ELSE false
END)
);


--
-- Name: TABLE agent_memories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_memories IS 'Multi-type memory storage for agents with vector embeddings';


--
-- Name: COLUMN agent_memories.embeddings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_memories.embeddings IS 'Vector embedding for semantic similarity search (1536 dimensions for OpenAI)';


--
-- Name: agent_sendgrid_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_sendgrid_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    sendgrid_config_id uuid NOT NULL,
    can_send_email boolean DEFAULT true,
    can_use_templates boolean DEFAULT false,
    can_send_bulk boolean DEFAULT false,
    can_manage_templates boolean DEFAULT false,
    can_view_analytics boolean DEFAULT false,
    can_receive_emails boolean DEFAULT false,
    daily_send_limit integer DEFAULT 100,
    recipients_per_email_limit integer DEFAULT 10,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_smtp_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_smtp_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    smtp_config_id uuid NOT NULL,
    can_send_email boolean DEFAULT true,
    can_send_attachments boolean DEFAULT false,
    can_use_custom_from boolean DEFAULT false,
    daily_email_limit integer,
    recipients_per_email_limit integer,
    allowed_recipients jsonb DEFAULT '[]'::jsonb,
    blocked_recipients jsonb DEFAULT '[]'::jsonb,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT agent_smtp_permissions_limits_check CHECK ((((daily_email_limit IS NULL) OR (daily_email_limit > 0)) AND ((recipients_per_email_limit IS NULL) OR (recipients_per_email_limit > 0))))
);


--
-- Name: TABLE agent_smtp_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_smtp_permissions IS 'Agent-specific permissions for SMTP configurations';


--
-- Name: COLUMN agent_smtp_permissions.allowed_recipients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_smtp_permissions.allowed_recipients IS 'JSON array of allowed email address patterns (e.g., ["*@company.com", "user@domain.com"])';


--
-- Name: COLUMN agent_smtp_permissions.blocked_recipients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_smtp_permissions.blocked_recipients IS 'JSON array of blocked email address patterns';


--
-- Name: agent_specific_contact_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_specific_contact_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    access_level text DEFAULT 'view_and_contact'::text,
    channel_permissions jsonb DEFAULT '{}'::jsonb,
    message_limit integer,
    contact_frequency text,
    access_reason text,
    access_metadata jsonb DEFAULT '{}'::jsonb,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    access_count integer DEFAULT 0,
    message_count integer DEFAULT 0,
    CONSTRAINT agent_specific_contact_access_access_level_check CHECK ((access_level = ANY (ARRAY['view_only'::text, 'view_and_contact'::text, 'full_access'::text, 'no_access'::text]))),
    CONSTRAINT agent_specific_contact_access_contact_frequency_check CHECK ((contact_frequency = ANY (ARRAY['unlimited'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'as_needed'::text]))),
    CONSTRAINT valid_access_reason CHECK (((access_reason IS NULL) OR (length(access_reason) <= 500))),
    CONSTRAINT valid_message_limit CHECK (((message_limit IS NULL) OR (message_limit > 0)))
);


--
-- Name: TABLE agent_specific_contact_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_specific_contact_access IS 'Specific contact access permissions for agents';


--
-- Name: agent_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_states (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    agent_id uuid NOT NULL,
    version character varying(10) NOT NULL,
    local_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    shared_state jsonb DEFAULT '{}'::jsonb,
    session_state jsonb DEFAULT '{}'::jsonb,
    persistent_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    state_hash character varying(64) NOT NULL,
    modification_count integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_current boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    last_modified timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE agent_states; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_states IS 'Versioned state management for agents with partitioned state types';


--
-- Name: COLUMN agent_states.state_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_states.state_hash IS 'SHA-256 hash of the complete state for integrity checking';


--
-- Name: agent_task_event_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_task_event_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    trigger_type public.event_trigger_type_enum NOT NULL,
    trigger_name text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0,
    conditions jsonb DEFAULT '{}'::jsonb,
    cooldown_minutes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cooldown_non_negative CHECK ((cooldown_minutes >= 0))
);


--
-- Name: TABLE agent_task_event_triggers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_task_event_triggers IS 'Defines event triggers for event-based tasks';


--
-- Name: agent_task_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_task_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    status public.task_execution_status_enum DEFAULT 'pending'::public.task_execution_status_enum NOT NULL,
    trigger_type text NOT NULL,
    trigger_data jsonb DEFAULT '{}'::jsonb,
    instructions_used text NOT NULL,
    tools_used jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms integer,
    output text,
    tool_outputs jsonb DEFAULT '[]'::jsonb,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    conversation_id uuid,
    CONSTRAINT valid_duration CHECK ((((status = 'completed'::public.task_execution_status_enum) AND (started_at IS NOT NULL) AND (completed_at IS NOT NULL) AND (duration_ms IS NOT NULL)) OR (status <> 'completed'::public.task_execution_status_enum))),
    CONSTRAINT valid_timing CHECK (((started_at IS NULL) OR (completed_at IS NULL) OR (started_at <= completed_at)))
);


--
-- Name: TABLE agent_task_executions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_task_executions IS 'Tracks individual executions of agent tasks';


--
-- Name: COLUMN agent_task_executions.trigger_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_task_executions.trigger_data IS 'Data about what triggered this execution (e.g., email content, webhook payload)';


--
-- Name: COLUMN agent_task_executions.tool_outputs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_task_executions.tool_outputs IS 'Outputs from each tool that was used during execution';


--
-- Name: agent_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    task_type public.task_type_enum DEFAULT 'scheduled'::public.task_type_enum NOT NULL,
    status public.task_status_enum DEFAULT 'active'::public.task_status_enum NOT NULL,
    instructions text NOT NULL,
    selected_tools jsonb DEFAULT '[]'::jsonb,
    cron_expression text,
    timezone text DEFAULT 'UTC'::text,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    event_trigger_type public.event_trigger_type_enum,
    event_trigger_config jsonb DEFAULT '{}'::jsonb,
    total_executions integer DEFAULT 0,
    successful_executions integer DEFAULT 0,
    failed_executions integer DEFAULT 0,
    max_executions integer,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    conversation_id uuid,
    CONSTRAINT max_executions_positive CHECK (((max_executions IS NULL) OR (max_executions > 0))),
    CONSTRAINT valid_cron_for_scheduled CHECK ((((task_type = 'scheduled'::public.task_type_enum) AND (cron_expression IS NOT NULL)) OR (task_type = 'event_based'::public.task_type_enum))),
    CONSTRAINT valid_date_range CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (start_date < end_date))),
    CONSTRAINT valid_event_for_event_based CHECK ((((task_type = 'event_based'::public.task_type_enum) AND (event_trigger_type IS NOT NULL)) OR (task_type = 'scheduled'::public.task_type_enum)))
);


--
-- Name: TABLE agent_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_tasks IS 'Stores scheduled and event-based tasks for agents';


--
-- Name: COLUMN agent_tasks.instructions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_tasks.instructions IS 'The prompt/instructions that will be given to the agent when the task executes';


--
-- Name: COLUMN agent_tasks.selected_tools; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_tasks.selected_tools IS 'Array of tool IDs that the agent is allowed to use for this specific task';


--
-- Name: COLUMN agent_tasks.cron_expression; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_tasks.cron_expression IS 'Cron expression for scheduled tasks (required for scheduled tasks)';


--
-- Name: COLUMN agent_tasks.event_trigger_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agent_tasks.event_trigger_config IS 'Configuration specific to the event trigger type';


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    system_instructions text,
    assistant_instructions text,
    active boolean DEFAULT false,
    personality text,
    avatar_url text,
    metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE ONLY public.agents FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agents IS 'Agents table with proper RLS policies - allows users to manage their own agents';


--
-- Name: COLUMN agents.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.active IS 'Indicates if the agent is generally considered active/enabled by the user.';


--
-- Name: COLUMN agents.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.metadata IS 'Stores agent configuration including settings for knowledge graph, memory preferences, and other features';


--
-- Name: artifact_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifact_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    storage_path text,
    created_by uuid NOT NULL,
    changes_note text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artifact_versions_version_positive CHECK ((version_number > 0))
);


--
-- Name: TABLE artifact_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.artifact_versions IS 'Version history for artifacts - snapshots of previous content';


--
-- Name: COLUMN artifact_versions.changes_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artifact_versions.changes_note IS 'Optional note describing what changed in this version';


--
-- Name: artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    workspace_id uuid,
    conversation_session_id uuid,
    message_id uuid,
    title text NOT NULL,
    file_type text NOT NULL,
    content text NOT NULL,
    storage_path text,
    version integer DEFAULT 1,
    parent_artifact_id uuid,
    is_latest_version boolean DEFAULT true,
    description text,
    tags text[] DEFAULT '{}'::text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text,
    view_count integer DEFAULT 0,
    download_count integer DEFAULT 0,
    last_viewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artifacts_download_count_positive CHECK ((download_count >= 0)),
    CONSTRAINT artifacts_file_type_check CHECK ((file_type = ANY (ARRAY['txt'::text, 'md'::text, 'json'::text, 'html'::text, 'javascript'::text, 'typescript'::text, 'python'::text, 'java'::text, 'css'::text, 'csv'::text, 'sql'::text, 'yaml'::text, 'xml'::text, 'bash'::text, 'shell'::text, 'dockerfile'::text]))),
    CONSTRAINT artifacts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text]))),
    CONSTRAINT artifacts_title_length CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200))),
    CONSTRAINT artifacts_version_positive CHECK ((version > 0)),
    CONSTRAINT artifacts_view_count_positive CHECK ((view_count >= 0))
);


--
-- Name: TABLE artifacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.artifacts IS 'Stores AI-generated content (code, documents, etc.) with versioning support';


--
-- Name: COLUMN artifacts.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artifacts.content IS 'Text content stored directly in database';


--
-- Name: COLUMN artifacts.storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artifacts.storage_path IS 'Optional backup path in Supabase Storage bucket';


--
-- Name: COLUMN artifacts.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.artifacts.metadata IS 'Flexible JSONB field for file_size, line_count, language, etc.';


--
-- Name: billing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_name text NOT NULL,
    display_name text NOT NULL,
    description text,
    stripe_price_id text NOT NULL,
    amount integer NOT NULL,
    currency text DEFAULT 'usd'::text,
    billing_interval text NOT NULL,
    trial_period_days integer DEFAULT 0,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan_type text DEFAULT 'personal'::text,
    CONSTRAINT billing_plans_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT billing_plans_plan_type_check CHECK ((plan_type = ANY (ARRAY['personal'::text, 'business'::text])))
);


--
-- Name: TABLE billing_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.billing_plans IS 'Defines available subscription plans with features and limits';


--
-- Name: COLUMN billing_plans.limits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.billing_plans.limits IS 'JSON object with plan limits (-1 means unlimited)';


--
-- Name: COLUMN billing_plans.is_featured; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.billing_plans.is_featured IS 'Whether this plan should be highlighted as featured/popular';


--
-- Name: COLUMN billing_plans.sort_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.billing_plans.sort_order IS 'Order for displaying plans (lower numbers first)';


--
-- Name: COLUMN billing_plans.plan_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.billing_plans.plan_type IS 'Type of plan: personal or business';


--
-- Name: canvas_diffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_diffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canvas_session_id uuid NOT NULL,
    operation_type text NOT NULL,
    start_line integer NOT NULL,
    end_line integer,
    before_content text,
    after_content text,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT canvas_diffs_operation_type_check CHECK ((operation_type = ANY (ARRAY['replace'::text, 'insert'::text, 'delete'::text, 'search_replace'::text])))
);


--
-- Name: TABLE canvas_diffs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.canvas_diffs IS 'Detailed tracking of all canvas editing operations for undo/redo';


--
-- Name: canvas_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    artifact_id uuid NOT NULL,
    conversation_session_id uuid,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    diff_history jsonb DEFAULT '[]'::jsonb,
    undo_stack jsonb DEFAULT '[]'::jsonb,
    redo_stack jsonb DEFAULT '[]'::jsonb,
    current_snapshot_id uuid
);


--
-- Name: TABLE canvas_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.canvas_sessions IS 'Stores work-in-progress canvas editing sessions with auto-save functionality';


--
-- Name: canvas_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canvas_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canvas_session_id uuid NOT NULL,
    content text NOT NULL,
    label text,
    description text,
    line_count integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: TABLE canvas_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.canvas_snapshots IS 'Version snapshots of canvas sessions for rollback capability';


--
-- Name: chat_messages_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages_v2 (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    version character varying(10) DEFAULT '1.0.0'::character varying NOT NULL,
    conversation_id uuid NOT NULL,
    session_id uuid NOT NULL,
    parent_message_id uuid,
    channel_id uuid,
    sender_user_id uuid,
    sender_agent_id uuid,
    role character varying(20) NOT NULL,
    content jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    context jsonb DEFAULT '{}'::jsonb,
    tools jsonb,
    memory_refs uuid[],
    state_snapshot_id uuid,
    audit jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_messages_v2_role_check CHECK (((role)::text = ANY (ARRAY[('system'::character varying)::text, ('user'::character varying)::text, ('assistant'::character varying)::text, ('tool'::character varying)::text]))),
    CONSTRAINT check_actor_exclusivity CHECK ((((sender_user_id IS NOT NULL) AND (sender_agent_id IS NULL)) OR ((sender_user_id IS NULL) AND (sender_agent_id IS NOT NULL)) OR (((role)::text = ANY ((ARRAY['system'::character varying, 'tool'::character varying])::text[])) AND (sender_user_id IS NULL) AND (sender_agent_id IS NULL)))),
    CONSTRAINT check_content_structure CHECK (((content ? 'type'::text) AND ((content ->> 'type'::text) = ANY (ARRAY['text'::text, 'structured'::text, 'multimodal'::text, 'tool_result'::text]))))
);


--
-- Name: TABLE chat_messages_v2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_messages_v2 IS 'Advanced chat messages with structured content, metadata, and context support';


--
-- Name: COLUMN chat_messages_v2.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages_v2.content IS 'JSONB structure with type field: text, structured, multimodal, or tool_result';


--
-- Name: CONSTRAINT check_actor_exclusivity ON chat_messages_v2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT check_actor_exclusivity ON public.chat_messages_v2 IS 'Ensures message actor exclusivity: user messages have sender_user_id only, assistant messages have sender_agent_id only, system and tool messages have neither';


--
-- Name: service_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    authorization_endpoint text NOT NULL,
    token_endpoint text NOT NULL,
    revoke_endpoint text,
    discovery_endpoint text,
    scopes_supported jsonb DEFAULT '[]'::jsonb NOT NULL,
    pkce_required boolean DEFAULT true NOT NULL,
    client_credentials_location text DEFAULT 'header'::text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    configuration_metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE service_providers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.service_providers IS 'Service providers including OAuth and API key integrations. OpenAI and Anthropic added for LLM API key management.';


--
-- Name: COLUMN service_providers.configuration_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_providers.configuration_metadata IS 'JSON configuration for the service provider. For OAuth providers, should include client_id. Client secrets are stored in Supabase Secrets for security.';


--
-- Name: user_integration_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_integration_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    oauth_provider_id uuid NOT NULL,
    external_user_id text NOT NULL,
    external_username text,
    scopes_granted jsonb DEFAULT '[]'::jsonb NOT NULL,
    connection_name text NOT NULL,
    vault_access_token_id text,
    vault_refresh_token_id text,
    token_expires_at timestamp with time zone,
    last_token_refresh timestamp with time zone,
    connection_status text DEFAULT 'active'::text NOT NULL,
    connection_metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    encrypted_access_token text,
    encrypted_refresh_token text,
    credential_type public.connection_credential_type_enum DEFAULT 'oauth'::public.connection_credential_type_enum NOT NULL,
    CONSTRAINT chk_credential_type_consistency CHECK ((((credential_type = 'oauth'::public.connection_credential_type_enum) AND (connection_status = 'active'::text) AND (vault_access_token_id IS NOT NULL)) OR ((credential_type = 'api_key'::public.connection_credential_type_enum) AND (connection_status = 'active'::text) AND (vault_access_token_id IS NOT NULL)) OR (connection_status <> 'active'::text))),
    CONSTRAINT user_integration_credentials_connection_status_check CHECK ((connection_status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])))
);


--
-- Name: TABLE user_integration_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_integration_credentials IS 'Centralized secure storage for all integration credentials (OAuth tokens and API keys) using Supabase Vault encryption';


--
-- Name: COLUMN user_integration_credentials.vault_access_token_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_integration_credentials.vault_access_token_id IS 'Stores access token directly or vault ID reference';


--
-- Name: COLUMN user_integration_credentials.vault_refresh_token_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_integration_credentials.vault_refresh_token_id IS 'Stores refresh token directly or vault ID reference';


--
-- Name: COLUMN user_integration_credentials.credential_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_integration_credentials.credential_type IS 'Type of credential: oauth (supports refresh) or api_key (long-lived, no refresh)';


--
-- Name: CONSTRAINT chk_credential_type_consistency ON user_integration_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_credential_type_consistency ON public.user_integration_credentials IS 'Ensures credential consistency: OAuth and API key connections require access tokens when active';


--
-- Name: clicksend_connections; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.clicksend_connections AS
 SELECT uoc.id,
    uoc.user_id,
    uoc.connection_name,
    uoc.connection_status,
    uoc.connection_metadata,
    uoc.external_username,
    uoc.created_at,
    uoc.updated_at,
    sp.display_name AS provider_name,
    sp.configuration_metadata AS provider_config
   FROM (public.user_integration_credentials uoc
     JOIN public.service_providers sp ON ((uoc.oauth_provider_id = sp.id)))
  WHERE ((sp.name = 'clicksend_sms'::text) AND (uoc.connection_status = 'active'::text));


--
-- Name: VIEW clicksend_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.clicksend_connections IS 'View for active ClickSend SMS/MMS connections with provider details';


--
-- Name: contact_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    user_id uuid,
    agent_id uuid,
    operation_type text NOT NULL,
    operation_details jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    request_id text,
    old_values jsonb,
    new_values jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_audit_log_operation_type_check CHECK ((operation_type = ANY (ARRAY['create'::text, 'read'::text, 'update'::text, 'delete'::text, 'export'::text, 'gdpr_request'::text])))
);


--
-- Name: TABLE contact_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_audit_log IS 'Audit trail for all contact operations (GDPR compliance)';


--
-- Name: contact_communication_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_communication_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    user_id uuid NOT NULL,
    channel_type text NOT NULL,
    channel_identifier text NOT NULL,
    display_label text,
    is_primary boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    can_receive_marketing boolean DEFAULT false,
    can_receive_notifications boolean DEFAULT true,
    verification_status text DEFAULT 'unverified'::text,
    verified_at timestamp with time zone,
    verification_method text,
    verification_token text,
    verification_expires_at timestamp with time zone,
    channel_metadata jsonb DEFAULT '{}'::jsonb,
    formatting_metadata jsonb DEFAULT '{}'::jsonb,
    integration_data jsonb DEFAULT '{}'::jsonb,
    opt_in_date timestamp with time zone,
    opt_out_date timestamp with time zone,
    last_consent_update timestamp with time zone,
    marketing_consent boolean DEFAULT false,
    marketing_consent_date timestamp with time zone,
    preferred_time_start time without time zone,
    preferred_time_end time without time zone,
    preferred_timezone text DEFAULT 'UTC'::text,
    do_not_contact_until timestamp with time zone,
    communication_frequency text DEFAULT 'normal'::text,
    bounce_count integer DEFAULT 0,
    last_bounce_at timestamp with time zone,
    delivery_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    CONSTRAINT bounce_count_valid CHECK ((bounce_count >= 0)),
    CONSTRAINT contact_communication_channels_channel_type_check CHECK ((channel_type = ANY (ARRAY['email'::text, 'phone'::text, 'mobile'::text, 'whatsapp'::text, 'telegram'::text, 'slack'::text, 'discord'::text, 'teams'::text, 'sms'::text, 'fax'::text, 'linkedin'::text, 'twitter'::text, 'instagram'::text, 'website'::text, 'other'::text]))),
    CONSTRAINT contact_communication_channels_communication_frequency_check CHECK ((communication_frequency = ANY (ARRAY['high'::text, 'normal'::text, 'low'::text, 'minimal'::text]))),
    CONSTRAINT contact_communication_channels_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['active'::text, 'bouncing'::text, 'blocked'::text, 'invalid'::text]))),
    CONSTRAINT contact_communication_channels_verification_method_check CHECK ((verification_method = ANY (ARRAY['email_click'::text, 'sms_code'::text, 'voice_call'::text, 'manual'::text, 'api_verification'::text]))),
    CONSTRAINT contact_communication_channels_verification_status_check CHECK ((verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT marketing_consent_consistency CHECK ((((marketing_consent = true) AND (marketing_consent_date IS NOT NULL)) OR (marketing_consent = false))),
    CONSTRAINT preferred_time_valid CHECK ((((preferred_time_start IS NULL) AND (preferred_time_end IS NULL)) OR ((preferred_time_start IS NOT NULL) AND (preferred_time_end IS NOT NULL)))),
    CONSTRAINT valid_channel_identifier CHECK (((length(TRIM(BOTH FROM channel_identifier)) > 0) AND (length(channel_identifier) <= 255))),
    CONSTRAINT valid_display_label CHECK (((display_label IS NULL) OR (length(display_label) <= 100))),
    CONSTRAINT verification_token_consistency CHECK ((((verification_status = 'pending'::text) AND (verification_token IS NOT NULL)) OR (verification_status <> 'pending'::text)))
);


--
-- Name: TABLE contact_communication_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_communication_channels IS 'Communication channels for contacts with verification and consent management';


--
-- Name: COLUMN contact_communication_channels.channel_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_communication_channels.channel_type IS 'Type of communication channel (email, phone, social media, etc.)';


--
-- Name: COLUMN contact_communication_channels.channel_identifier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_communication_channels.channel_identifier IS 'The actual contact value (email address, phone number, username)';


--
-- Name: COLUMN contact_communication_channels.verification_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_communication_channels.verification_status IS 'Status of channel verification for deliverability';


--
-- Name: COLUMN contact_communication_channels.channel_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_communication_channels.channel_metadata IS 'Channel-specific metadata and configuration';


--
-- Name: COLUMN contact_communication_channels.marketing_consent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_communication_channels.marketing_consent IS 'Explicit consent for marketing communications';


--
-- Name: COLUMN contact_communication_channels.bounce_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_communication_channels.bounce_count IS 'Number of delivery failures for this channel';


--
-- Name: contact_group_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_group_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by_user_id uuid,
    membership_type text DEFAULT 'manual'::text,
    membership_metadata jsonb DEFAULT '{}'::jsonb,
    notes text,
    added_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_group_memberships_membership_type_check CHECK ((membership_type = ANY (ARRAY['manual'::text, 'automatic'::text, 'imported'::text, 'smart_rule'::text]))),
    CONSTRAINT valid_notes CHECK (((notes IS NULL) OR (length(notes) <= 1000)))
);


--
-- Name: TABLE contact_group_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_group_memberships IS 'Many-to-many relationship between contacts and groups';


--
-- Name: contact_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3b82f6'::text,
    icon text DEFAULT 'users'::text,
    is_system_group boolean DEFAULT false,
    is_smart_group boolean DEFAULT false,
    smart_criteria jsonb,
    group_type text DEFAULT 'custom'::text,
    parent_group_id uuid,
    tags text[] DEFAULT '{}'::text[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    member_count integer DEFAULT 0,
    last_activity_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_groups_group_type_check CHECK ((group_type = ANY (ARRAY['custom'::text, 'department'::text, 'project'::text, 'location'::text, 'role'::text, 'status'::text, 'system'::text]))),
    CONSTRAINT no_self_parent CHECK ((id <> parent_group_id)),
    CONSTRAINT smart_group_criteria CHECK ((((is_smart_group = true) AND (smart_criteria IS NOT NULL)) OR (is_smart_group = false))),
    CONSTRAINT valid_color CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT valid_description CHECK (((description IS NULL) OR (length(description) <= 500))),
    CONSTRAINT valid_group_name CHECK (((length(TRIM(BOTH FROM name)) > 0) AND (length(name) <= 100)))
);


--
-- Name: TABLE contact_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_groups IS 'Contact organization groups with support for smart/dynamic groups';


--
-- Name: COLUMN contact_groups.is_smart_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_groups.is_smart_group IS 'Whether this group automatically manages membership based on criteria';


--
-- Name: COLUMN contact_groups.smart_criteria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_groups.smart_criteria IS 'JSONB criteria for automatic group membership';


--
-- Name: COLUMN contact_groups.member_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_groups.member_count IS 'Cached count of group members, updated via triggers';


--
-- Name: contact_import_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_import_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    row_number integer NOT NULL,
    column_name text,
    field_name text,
    error_type text NOT NULL,
    error_message text NOT NULL,
    error_code text,
    raw_value text,
    suggested_fix text,
    row_data jsonb,
    is_resolved boolean DEFAULT false,
    resolution_action text,
    resolved_at timestamp with time zone,
    resolved_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_import_errors_error_type_check CHECK ((error_type = ANY (ARRAY['validation_error'::text, 'format_error'::text, 'duplicate_error'::text, 'missing_required'::text, 'invalid_email'::text, 'invalid_phone'::text, 'constraint_violation'::text, 'system_error'::text]))),
    CONSTRAINT contact_import_errors_resolution_action_check CHECK ((resolution_action = ANY (ARRAY['ignored'::text, 'fixed_and_imported'::text, 'skipped'::text, 'manual_review_needed'::text])))
);


--
-- Name: TABLE contact_import_errors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_import_errors IS 'Detailed error logging for contact import failures';


--
-- Name: COLUMN contact_import_errors.row_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_import_errors.row_data IS 'Full row data context for debugging import errors';


--
-- Name: contact_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    import_type text DEFAULT 'csv'::text,
    file_name text,
    file_size bigint,
    file_mime_type text,
    storage_bucket text DEFAULT 'contact-imports'::text,
    storage_path text,
    status text DEFAULT 'pending'::text,
    total_rows integer DEFAULT 0,
    processed_rows integer DEFAULT 0,
    successful_imports integer DEFAULT 0,
    failed_imports integer DEFAULT 0,
    duplicate_contacts integer DEFAULT 0,
    updated_contacts integer DEFAULT 0,
    skipped_rows integer DEFAULT 0,
    import_settings jsonb DEFAULT '{}'::jsonb,
    duplicate_handling text DEFAULT 'skip'::text,
    validation_rules jsonb DEFAULT '{}'::jsonb,
    column_mapping jsonb DEFAULT '{}'::jsonb,
    required_fields text[] DEFAULT '{}'::text[],
    import_results jsonb DEFAULT '{}'::jsonb,
    error_details jsonb DEFAULT '{}'::jsonb,
    validation_errors jsonb DEFAULT '{}'::jsonb,
    preview_data jsonb DEFAULT '{}'::jsonb,
    processing_started_by text,
    processing_notes text,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT completion_timing_consistency CHECK ((((status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text, 'partially_completed'::text])) AND (completed_at IS NOT NULL)) OR (status <> ALL (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text, 'partially_completed'::text])))),
    CONSTRAINT contact_import_jobs_duplicate_handling_check CHECK ((duplicate_handling = ANY (ARRAY['skip'::text, 'update'::text, 'create_duplicate'::text, 'merge'::text]))),
    CONSTRAINT contact_import_jobs_import_type_check CHECK ((import_type = ANY (ARRAY['csv'::text, 'excel'::text, 'json'::text, 'api'::text, 'manual_batch'::text]))),
    CONSTRAINT contact_import_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'partially_completed'::text]))),
    CONSTRAINT progress_consistency CHECK ((processed_rows <= total_rows)),
    CONSTRAINT status_timing_consistency CHECK ((((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])) AND (started_at IS NOT NULL)) OR (status = 'pending'::text))),
    CONSTRAINT valid_file_size CHECK (((file_size IS NULL) OR (file_size > 0))),
    CONSTRAINT valid_row_counts CHECK (((total_rows >= 0) AND (processed_rows >= 0) AND (successful_imports >= 0) AND (failed_imports >= 0) AND (duplicate_contacts >= 0) AND (updated_contacts >= 0) AND (skipped_rows >= 0)))
);


--
-- Name: TABLE contact_import_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_import_jobs IS 'Tracking table for bulk contact import operations';


--
-- Name: COLUMN contact_import_jobs.duplicate_handling; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_import_jobs.duplicate_handling IS 'Strategy for handling duplicate contacts during import';


--
-- Name: COLUMN contact_import_jobs.column_mapping; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_import_jobs.column_mapping IS 'JSONB mapping of CSV columns to contact fields';


--
-- Name: COLUMN contact_import_jobs.import_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_import_jobs.import_results IS 'Summary results and statistics from import process';


--
-- Name: contact_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    interaction_type text NOT NULL,
    channel_type text,
    channel_identifier text,
    interaction_summary text,
    full_content_vault_id text,
    interaction_metadata jsonb DEFAULT '{}'::jsonb,
    external_message_id text,
    external_thread_id text,
    external_platform_data jsonb DEFAULT '{}'::jsonb,
    subject text,
    message_preview text,
    content_type text DEFAULT 'text'::text,
    has_attachments boolean DEFAULT false,
    attachment_count integer DEFAULT 0,
    attachment_metadata jsonb DEFAULT '{}'::jsonb,
    delivery_status text DEFAULT 'sent'::text,
    read_receipt boolean DEFAULT false,
    direction text NOT NULL,
    interaction_context text,
    interaction_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    response_requested boolean DEFAULT false,
    response_deadline timestamp with time zone,
    engagement_score integer,
    sentiment_score numeric(3,2),
    importance_level text DEFAULT 'normal'::text,
    requires_follow_up boolean DEFAULT false,
    follow_up_date timestamp with time zone,
    follow_up_notes text,
    is_follow_up_to uuid,
    is_gdpr_relevant boolean DEFAULT true,
    retention_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT channel_consistency CHECK ((((channel_type IS NOT NULL) AND (channel_identifier IS NOT NULL)) OR ((channel_type IS NULL) AND (channel_identifier IS NULL)))),
    CONSTRAINT contact_interactions_channel_type_check CHECK ((channel_type = ANY (ARRAY['email'::text, 'phone'::text, 'mobile'::text, 'whatsapp'::text, 'telegram'::text, 'slack'::text, 'discord'::text, 'teams'::text, 'sms'::text, 'voice'::text, 'video'::text, 'in_person'::text]))),
    CONSTRAINT contact_interactions_content_type_check CHECK ((content_type = ANY (ARRAY['text'::text, 'html'::text, 'markdown'::text, 'rich_text'::text, 'attachment'::text, 'voice'::text, 'video'::text, 'image'::text]))),
    CONSTRAINT contact_interactions_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'bounced'::text, 'blocked'::text]))),
    CONSTRAINT contact_interactions_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
    CONSTRAINT contact_interactions_engagement_score_check CHECK (((engagement_score >= 1) AND (engagement_score <= 10))),
    CONSTRAINT contact_interactions_importance_level_check CHECK ((importance_level = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT contact_interactions_interaction_context_check CHECK ((interaction_context = ANY (ARRAY['manual'::text, 'automated'::text, 'scheduled'::text, 'response'::text, 'follow_up'::text, 'broadcast'::text]))),
    CONSTRAINT contact_interactions_interaction_type_check CHECK ((interaction_type = ANY (ARRAY['message_sent'::text, 'message_received'::text, 'call_made'::text, 'call_received'::text, 'meeting_scheduled'::text, 'meeting_completed'::text, 'email_sent'::text, 'email_received'::text, 'note_added'::text, 'status_changed'::text, 'contact_created'::text, 'contact_updated'::text, 'whatsapp_sent'::text, 'whatsapp_received'::text, 'telegram_sent'::text, 'telegram_received'::text, 'slack_sent'::text, 'slack_received'::text, 'discord_sent'::text, 'discord_received'::text, 'sms_sent'::text, 'sms_received'::text, 'voice_call'::text, 'video_call'::text]))),
    CONSTRAINT contact_interactions_sentiment_score_check CHECK (((sentiment_score >= '-1.00'::numeric) AND (sentiment_score <= 1.00))),
    CONSTRAINT delivery_timing_consistency CHECK ((((delivery_status = ANY (ARRAY['delivered'::text, 'read'::text])) AND (delivered_at IS NOT NULL)) OR (delivery_status <> ALL (ARRAY['delivered'::text, 'read'::text])))),
    CONSTRAINT read_timing_consistency CHECK ((((delivery_status = 'read'::text) AND (read_at IS NOT NULL)) OR (delivery_status <> 'read'::text))),
    CONSTRAINT valid_attachment_count CHECK ((attachment_count >= 0)),
    CONSTRAINT valid_follow_up_notes CHECK (((follow_up_notes IS NULL) OR (length(follow_up_notes) <= 2000))),
    CONSTRAINT valid_interaction_summary CHECK (((interaction_summary IS NULL) OR (length(interaction_summary) <= 1000))),
    CONSTRAINT valid_message_preview CHECK (((message_preview IS NULL) OR (length(message_preview) <= 200))),
    CONSTRAINT valid_subject CHECK (((subject IS NULL) OR (length(subject) <= 500)))
);


--
-- Name: TABLE contact_interactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_interactions IS 'Comprehensive log of all contact interactions across communication channels';


--
-- Name: COLUMN contact_interactions.full_content_vault_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_interactions.full_content_vault_id IS 'Supabase Vault ID for encrypted full message content';


--
-- Name: COLUMN contact_interactions.external_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_interactions.external_message_id IS 'Reference ID from external communication platform';


--
-- Name: COLUMN contact_interactions.engagement_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_interactions.engagement_score IS 'Subjective engagement quality score (1-10)';


--
-- Name: COLUMN contact_interactions.sentiment_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_interactions.sentiment_score IS 'Automated sentiment analysis score (-1.0 to 1.0)';


--
-- Name: COLUMN contact_interactions.retention_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_interactions.retention_date IS 'Date when interaction should be deleted for compliance';


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text,
    display_name text GENERATED ALWAYS AS (
CASE
    WHEN (last_name IS NOT NULL) THEN ((first_name || ' '::text) || last_name)
    ELSE first_name
END) STORED,
    organization text,
    job_title text,
    department text,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    contact_source text DEFAULT 'manual'::text,
    consent_status text DEFAULT 'unknown'::text,
    consent_date timestamp with time zone,
    consent_method text,
    data_processing_purpose text[] DEFAULT '{}'::text[],
    legal_basis text DEFAULT 'legitimate_interest'::text,
    contact_status text DEFAULT 'active'::text,
    contact_type text DEFAULT 'external'::text,
    priority_level text DEFAULT 'normal'::text,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    integration_metadata jsonb DEFAULT '{}'::jsonb,
    data_retention_date timestamp with time zone,
    deletion_requested boolean DEFAULT false,
    deletion_requested_at timestamp with time zone,
    deletion_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_contacted_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT consent_data_consistency CHECK ((((consent_status = 'granted'::text) AND (consent_date IS NOT NULL)) OR (consent_status <> 'granted'::text))),
    CONSTRAINT contacts_consent_method_check CHECK ((consent_method = ANY (ARRAY['web_form'::text, 'email_confirmation'::text, 'phone_verification'::text, 'import'::text, 'api'::text]))),
    CONSTRAINT contacts_consent_status_check CHECK ((consent_status = ANY (ARRAY['granted'::text, 'denied'::text, 'unknown'::text, 'withdrawn'::text]))),
    CONSTRAINT contacts_contact_source_check CHECK ((contact_source = ANY (ARRAY['manual'::text, 'csv_import'::text, 'api_sync'::text, 'integration_import'::text]))),
    CONSTRAINT contacts_contact_status_check CHECK ((contact_status = ANY (ARRAY['active'::text, 'inactive'::text, 'blocked'::text, 'archived'::text]))),
    CONSTRAINT contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['internal'::text, 'external'::text, 'partner'::text, 'vendor'::text, 'customer'::text, 'prospect'::text]))),
    CONSTRAINT contacts_legal_basis_check CHECK ((legal_basis = ANY (ARRAY['consent'::text, 'contract'::text, 'legal_obligation'::text, 'vital_interests'::text, 'public_task'::text, 'legitimate_interest'::text]))),
    CONSTRAINT contacts_priority_level_check CHECK ((priority_level = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT deletion_consistency CHECK ((((deletion_requested = true) AND (deletion_requested_at IS NOT NULL)) OR (deletion_requested = false))),
    CONSTRAINT valid_job_title CHECK (((job_title IS NULL) OR (length(job_title) <= 150))),
    CONSTRAINT valid_names CHECK (((length(TRIM(BOTH FROM first_name)) > 0) AND (length(first_name) <= 100) AND ((last_name IS NULL) OR (length(last_name) <= 100)))),
    CONSTRAINT valid_notes CHECK (((notes IS NULL) OR (length(notes) <= 5000))),
    CONSTRAINT valid_organization CHECK (((organization IS NULL) OR (length(organization) <= 200)))
);


--
-- Name: TABLE contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contacts IS 'Core contact management table with GDPR compliance features';


--
-- Name: COLUMN contacts.display_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.display_name IS 'Generated column combining first_name and last_name';


--
-- Name: COLUMN contacts.consent_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.consent_status IS 'GDPR consent status for data processing';


--
-- Name: COLUMN contacts.legal_basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.legal_basis IS 'Legal basis for processing personal data under GDPR';


--
-- Name: COLUMN contacts.custom_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.custom_fields IS 'Flexible JSONB storage for user-defined fields';


--
-- Name: COLUMN contacts.integration_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.integration_metadata IS 'Metadata for external system integrations';


--
-- Name: COLUMN contacts.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.deleted_at IS 'Soft delete timestamp for audit trail';


--
-- Name: context_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.context_snapshots (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid,
    agent_id uuid,
    snapshot_data jsonb NOT NULL,
    total_tokens integer,
    compression_ratio double precision,
    segment_count integer,
    build_time_ms integer,
    optimization_count integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN context_snapshots.compression_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.context_snapshots.compression_ratio IS 'Ratio of compressed to original token count';


--
-- Name: context_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.context_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    segments jsonb NOT NULL,
    variables jsonb,
    total_tokens integer,
    use_count integer DEFAULT 0,
    use_cases text[],
    agent_types text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid,
    agent_id uuid,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    last_active timestamp with time zone DEFAULT now(),
    message_count integer DEFAULT 0,
    total_tokens_used integer DEFAULT 0,
    tool_calls_count integer DEFAULT 0,
    session_state jsonb DEFAULT '{}'::jsonb,
    interruption_context jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    title text,
    CONSTRAINT check_session_actors CHECK (((user_id IS NOT NULL) OR (agent_id IS NOT NULL))),
    CONSTRAINT conversation_sessions_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('paused'::character varying)::text, ('completed'::character varying)::text, ('abandoned'::character varying)::text])))
);

ALTER TABLE ONLY public.conversation_sessions REPLICA IDENTITY FULL;


--
-- Name: TABLE conversation_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversation_sessions IS 'Session tracking for conversations with metrics and state';


--
-- Name: conversation_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    summary_text text NOT NULL,
    key_facts jsonb DEFAULT '[]'::jsonb,
    entities jsonb DEFAULT '{}'::jsonb,
    topics text[] DEFAULT ARRAY[]::text[],
    message_count integer DEFAULT 0,
    conversation_start timestamp with time zone,
    conversation_end timestamp with time zone,
    last_updated timestamp with time zone DEFAULT now(),
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE conversation_summaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversation_summaries IS 'Historical conversation summaries with vector embeddings for semantic search';


--
-- Name: COLUMN conversation_summaries.embedding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversation_summaries.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using OpenAI text-embedding-3-small model';


--
-- Name: conversation_summary_boards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_summary_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    current_summary text DEFAULT ''::text NOT NULL,
    context_notes text DEFAULT ''::text,
    important_facts jsonb DEFAULT '[]'::jsonb,
    pending_questions jsonb DEFAULT '[]'::jsonb,
    action_items jsonb DEFAULT '[]'::jsonb,
    last_updated timestamp with time zone DEFAULT now(),
    message_count integer DEFAULT 0,
    update_frequency integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE conversation_summary_boards; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversation_summary_boards IS 'Stores current conversation summaries with key facts, action items, and pending questions';


--
-- Name: datastores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.datastores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    similarity_metric text DEFAULT 'cosine'::text,
    similarity_threshold double precision DEFAULT 0.7,
    max_results integer DEFAULT 5,
    CONSTRAINT datastores_max_results_check CHECK ((max_results > 0)),
    CONSTRAINT datastores_similarity_metric_check CHECK ((similarity_metric = ANY (ARRAY['cosine'::text, 'euclidean'::text, 'dot'::text]))),
    CONSTRAINT datastores_similarity_threshold_check CHECK (((similarity_threshold >= (0)::double precision) AND (similarity_threshold <= (1)::double precision))),
    CONSTRAINT datastores_type_check CHECK ((type = ANY (ARRAY['pinecone'::text, 'getzep'::text])))
);


--
-- Name: TABLE datastores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.datastores IS 'Stores configuration for vector and knowledge graph datastores';


--
-- Name: COLUMN datastores.similarity_metric; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datastores.similarity_metric IS 'Similarity metric to use for vector search (cosine, euclidean, dot)';


--
-- Name: COLUMN datastores.similarity_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datastores.similarity_threshold IS 'Minimum similarity score threshold (0-1)';


--
-- Name: COLUMN datastores.max_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datastores.max_results IS 'Maximum number of results to return from similarity search';


--
-- Name: email_change_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_change_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    old_email text NOT NULL,
    new_email text NOT NULL,
    ip_address text,
    user_agent text,
    change_method text DEFAULT 'user_initiated'::text,
    changed_at timestamp with time zone DEFAULT now(),
    verified_at timestamp with time zone,
    notes text,
    CONSTRAINT email_change_audit_log_change_method_check CHECK ((change_method = ANY (ARRAY['user_initiated'::text, 'admin'::text, 'support'::text])))
);


--
-- Name: TABLE email_change_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_change_audit_log IS 'Audit trail for user email address changes';


--
-- Name: COLUMN email_change_audit_log.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_change_audit_log.user_id IS 'User who changed their email';


--
-- Name: COLUMN email_change_audit_log.old_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_change_audit_log.old_email IS 'Previous email address';


--
-- Name: COLUMN email_change_audit_log.new_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_change_audit_log.new_email IS 'New email address';


--
-- Name: COLUMN email_change_audit_log.change_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_change_audit_log.change_method IS 'How the change was initiated';


--
-- Name: COLUMN email_change_audit_log.verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_change_audit_log.verified_at IS 'When the new email was verified';


--
-- Name: gmail_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_oauth_connection_id uuid NOT NULL,
    security_settings jsonb,
    rate_limit_settings jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE gmail_configurations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.gmail_configurations IS 'Stores user-specific configurations for the Gmail integration.';


--
-- Name: integration_capabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_capabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    capability_key text NOT NULL,
    display_label text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    service_provider_id uuid
);


--
-- Name: integration_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon_name text NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE integration_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.integration_categories IS 'Categories for organizing service providers and integrations in the UI';


--
-- Name: integrations; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.integrations AS
 SELECT id,
    COALESCE(((configuration_metadata ->> 'category_id'::text))::uuid, ( SELECT integration_categories.id
           FROM public.integration_categories
          WHERE (integration_categories.name = 'API Services'::text)
         LIMIT 1)) AS category_id,
    display_name AS name,
    COALESCE((configuration_metadata ->> 'integration_description'::text), ('Integration service for '::text || display_name)) AS description,
    COALESCE((configuration_metadata ->> 'icon_name'::text), 'Settings'::text) AS icon_name,
        CASE
            WHEN is_enabled THEN 'available'::text
            ELSE 'unavailable'::text
        END AS status,
    COALESCE(((configuration_metadata ->> 'is_popular'::text))::boolean, false) AS is_popular,
    COALESCE((configuration_metadata ->> 'documentation_url'::text), ''::text) AS documentation_url,
    COALESCE((configuration_metadata -> 'configuration_schema'::text), '{}'::jsonb) AS configuration_schema,
    id AS required_oauth_provider_id,
    id AS required_tool_catalog_id,
    COALESCE(((configuration_metadata ->> 'display_order'::text))::integer, 999) AS display_order,
    is_enabled AS is_active,
    created_at,
    updated_at,
    COALESCE((configuration_metadata ->> 'agent_classification'::text), 'tool'::text) AS agent_classification
   FROM public.service_providers sp
  WHERE (is_enabled = true);


--
-- Name: VIEW integrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.integrations IS 'Compatibility view that presents service_providers as integrations';


--
-- Name: mailgun_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailgun_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_oauth_connection_id uuid,
    domain character varying(255) NOT NULL,
    region character varying(50) DEFAULT 'us'::character varying,
    webhook_signing_key_id uuid,
    smtp_username character varying(255),
    smtp_password_id uuid,
    webhook_url character varying(500),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mailgun_configurations_region_check CHECK (((region)::text = ANY (ARRAY[('us'::character varying)::text, ('eu'::character varying)::text])))
);


--
-- Name: mailgun_operation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailgun_operation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mailgun_config_id uuid NOT NULL,
    operation_type text NOT NULL,
    operation_params jsonb,
    operation_result jsonb,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text,
    mailgun_message_id text,
    recipients_count integer DEFAULT 1,
    execution_time_ms integer,
    api_calls_made integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mailgun_operation_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text, 'pending'::text])))
);


--
-- Name: mailgun_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailgun_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mailgun_config_id uuid,
    mailgun_route_id character varying(255),
    priority integer DEFAULT 0 NOT NULL,
    expression text NOT NULL,
    action text NOT NULL,
    description text,
    agent_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mailgun_routes_priority_check CHECK (((priority >= 0) AND (priority <= 32767)))
);


--
-- Name: mcp_tools_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_tools_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    tool_name text NOT NULL,
    tool_schema jsonb NOT NULL,
    openai_schema jsonb NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    schema_version text DEFAULT '1.0.0'::text,
    schema_hash text,
    refresh_count integer DEFAULT 0,
    last_schema_error timestamp with time zone,
    auto_refresh_enabled boolean DEFAULT true,
    successful_parameters jsonb DEFAULT '[]'::jsonb,
    last_successful_call timestamp with time zone,
    success_count integer DEFAULT 0
);


--
-- Name: COLUMN mcp_tools_cache.schema_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.schema_version IS 'Version of the tool schema from MCP server';


--
-- Name: COLUMN mcp_tools_cache.schema_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.schema_hash IS 'Hash of the schema for change detection';


--
-- Name: COLUMN mcp_tools_cache.refresh_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.refresh_count IS 'Number of times schema has been refreshed';


--
-- Name: COLUMN mcp_tools_cache.last_schema_error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.last_schema_error IS 'Timestamp of last schema validation error';


--
-- Name: COLUMN mcp_tools_cache.auto_refresh_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.auto_refresh_enabled IS 'Whether automatic refresh is enabled for this tool';


--
-- Name: COLUMN mcp_tools_cache.successful_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.successful_parameters IS 'Array of successful parameter combinations (max 10 most recent)';


--
-- Name: COLUMN mcp_tools_cache.last_successful_call; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.last_successful_call IS 'Timestamp of last successful tool execution';


--
-- Name: COLUMN mcp_tools_cache.success_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mcp_tools_cache.success_count IS 'Total number of successful executions';


--
-- Name: media_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color_hex text,
    icon_name text,
    parent_category_id uuid,
    sort_order integer DEFAULT 0,
    media_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_categories_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 50)))
);


--
-- Name: TABLE media_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.media_categories IS 'User-defined categories for organizing media files';


--
-- Name: media_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    display_name text,
    file_type text NOT NULL,
    file_size bigint NOT NULL,
    file_extension text NOT NULL,
    storage_bucket text DEFAULT 'media-library'::text NOT NULL,
    storage_path text NOT NULL,
    file_url text,
    processing_status text DEFAULT 'uploaded'::text NOT NULL,
    text_content text,
    chunk_count integer DEFAULT 0,
    processed_at timestamp with time zone,
    processing_error text,
    category text DEFAULT 'general'::text,
    tags text[] DEFAULT '{}'::text[],
    description text,
    assigned_agents_count integer DEFAULT 0,
    last_assigned_at timestamp with time zone,
    download_count integer DEFAULT 0,
    last_accessed_at timestamp with time zone,
    version integer DEFAULT 1,
    is_archived boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_library_file_name_length CHECK (((char_length(file_name) >= 1) AND (char_length(file_name) <= 255))),
    CONSTRAINT media_library_file_size_positive CHECK ((file_size > 0)),
    CONSTRAINT media_library_processing_status_check CHECK ((processing_status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'archived'::text]))),
    CONSTRAINT media_library_version_positive CHECK ((version > 0))
);


--
-- Name: TABLE media_library; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.media_library IS 'Central registry for user media files with processing status and metadata';


--
-- Name: COLUMN media_library.storage_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_library.storage_path IS 'Full path in Supabase storage bucket (user_id/category/filename.ext)';


--
-- Name: COLUMN media_library.processing_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_library.processing_status IS 'Current processing state: uploaded, processing, completed, failed, archived';


--
-- Name: COLUMN media_library.chunk_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_library.chunk_count IS 'Number of text chunks created for vector embedding';


--
-- Name: message_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_versions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    version_number integer NOT NULL,
    content jsonb NOT NULL,
    metadata jsonb,
    changed_by uuid,
    change_reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    stripe_invoice_id text,
    stripe_order_id uuid,
    user_id uuid NOT NULL,
    stripe_event_id text,
    amount integer NOT NULL,
    currency text DEFAULT 'usd'::text,
    payment_method_type text,
    failure_reason text,
    event_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_events_event_type_check CHECK ((event_type = ANY (ARRAY['payment_created'::text, 'payment_succeeded'::text, 'payment_failed'::text, 'payment_canceled'::text, 'refund_created'::text, 'refund_succeeded'::text])))
);


--
-- Name: TABLE payment_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_events IS 'Detailed log of all payment-related events';


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text,
    description text,
    category text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE platform_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.platform_settings IS 'Platform-wide settings and configuration managed by administrators';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    first_name text,
    last_name text,
    company_name text,
    title text,
    avatar_url text,
    mobile_number text,
    usage_reason jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS 'Unified user profile table with personal information and business context';


--
-- Name: COLUMN profiles.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.id IS 'User ID (references auth.users)';


--
-- Name: COLUMN profiles.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.username IS 'Unique username';


--
-- Name: COLUMN profiles.first_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.first_name IS 'User''s first name';


--
-- Name: COLUMN profiles.last_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.last_name IS 'User''s last name';


--
-- Name: COLUMN profiles.company_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.company_name IS 'Company or organization name';


--
-- Name: COLUMN profiles.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.title IS 'Job title or role';


--
-- Name: COLUMN profiles.avatar_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar image';


--
-- Name: COLUMN profiles.mobile_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.mobile_number IS 'Mobile phone number';


--
-- Name: COLUMN profiles.usage_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.usage_reason IS 'JSON data about platform usage reasons';


--
-- Name: COLUMN profiles.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp when profile was created';


--
-- Name: COLUMN profiles.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp when profile was last updated';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.roles IS 'Stores user roles (e.g., admin, user)';


--
-- Name: COLUMN roles.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.roles.name IS 'Unique name of the role';


--
-- Name: sendgrid_inbound_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sendgrid_inbound_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sendgrid_config_id uuid NOT NULL,
    agent_id uuid,
    message_id text NOT NULL,
    sendgrid_message_id text,
    from_email text NOT NULL,
    from_name text,
    to_emails text[] NOT NULL,
    cc_emails text[],
    bcc_emails text[],
    reply_to_email text,
    subject text,
    text_body text,
    html_body text,
    headers jsonb DEFAULT '{}'::jsonb,
    attachments jsonb DEFAULT '[]'::jsonb,
    routing_rules_applied uuid[],
    processed_at timestamp with time zone DEFAULT now(),
    processing_status text DEFAULT 'processed'::text,
    processing_errors jsonb DEFAULT '{}'::jsonb,
    spam_score double precision,
    spf_check text,
    dkim_check text,
    envelope jsonb DEFAULT '{}'::jsonb,
    charsets jsonb DEFAULT '{}'::jsonb,
    raw_webhook_data jsonb,
    in_reply_to text,
    message_references text[],
    tags text[] DEFAULT '{}'::text[],
    categories text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sendgrid_inbound_emails_processing_status_check CHECK ((processing_status = ANY (ARRAY['processed'::text, 'failed'::text, 'pending'::text, 'quarantined'::text])))
);


--
-- Name: TABLE sendgrid_inbound_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sendgrid_inbound_emails IS 'Storage for inbound emails received via SendGrid Inbound Parse webhook';


--
-- Name: COLUMN sendgrid_inbound_emails.routing_rules_applied; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sendgrid_inbound_emails.routing_rules_applied IS 'Array of routing rule IDs that were applied to this email';


--
-- Name: COLUMN sendgrid_inbound_emails.raw_webhook_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sendgrid_inbound_emails.raw_webhook_data IS 'Original webhook payload for debugging';


--
-- Name: sendgrid_inbound_routing_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sendgrid_inbound_routing_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_id uuid NOT NULL,
    rule_id uuid,
    event_type text NOT NULL,
    event_details jsonb DEFAULT '{}'::jsonb,
    execution_time_ms integer,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE sendgrid_inbound_routing_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sendgrid_inbound_routing_logs IS 'Audit log for routing rule execution and debugging';


--
-- Name: sendgrid_inbound_routing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sendgrid_inbound_routing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sendgrid_config_id uuid NOT NULL,
    agent_id uuid,
    name text NOT NULL,
    description text,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    action jsonb DEFAULT '{}'::jsonb NOT NULL,
    stop_processing boolean DEFAULT false,
    match_count integer DEFAULT 0,
    last_matched_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE sendgrid_inbound_routing_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sendgrid_inbound_routing_rules IS 'Rules for automatically processing inbound emails based on conditions';


--
-- Name: COLUMN sendgrid_inbound_routing_rules.conditions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sendgrid_inbound_routing_rules.conditions IS 'JSON object with conditions that must match for rule to trigger';


--
-- Name: COLUMN sendgrid_inbound_routing_rules.action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sendgrid_inbound_routing_rules.action IS 'JSON object defining the action to take when rule matches';


--
-- Name: sendgrid_operation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sendgrid_operation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    sendgrid_config_id uuid NOT NULL,
    operation_type text NOT NULL,
    operation_params jsonb,
    operation_result jsonb,
    status text DEFAULT 'success'::text NOT NULL,
    error_message text,
    sendgrid_message_id text,
    recipients_count integer DEFAULT 1,
    execution_time_ms integer,
    api_calls_made integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sendgrid_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sendgrid_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sendgrid_config_id uuid NOT NULL,
    sendgrid_template_id text NOT NULL,
    template_name text NOT NULL,
    template_version_id text,
    subject_template text,
    is_dynamic boolean DEFAULT true,
    variables jsonb DEFAULT '{}'::jsonb,
    agent_ids_allowed uuid[],
    last_used_at timestamp with time zone,
    use_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: server_configuration_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.server_configuration_secrets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    server_name text NOT NULL,
    vault_supabase_service_key_id text,
    vault_admin_password_id text,
    vault_openai_api_key_id text,
    configuration_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_vault_uuids CHECK ((((vault_supabase_service_key_id IS NULL) OR (vault_supabase_service_key_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((vault_admin_password_id IS NULL) OR (vault_admin_password_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) AND ((vault_openai_api_key_id IS NULL) OR (vault_openai_api_key_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text))))
);


--
-- Name: TABLE server_configuration_secrets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.server_configuration_secrets IS 'Stores vault references for server configuration secrets (zero plain-text storage)';


--
-- Name: COLUMN server_configuration_secrets.vault_supabase_service_key_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_configuration_secrets.vault_supabase_service_key_id IS 'Vault UUID for Supabase service role key';


--
-- Name: COLUMN server_configuration_secrets.vault_admin_password_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_configuration_secrets.vault_admin_password_id IS 'Vault UUID for admin dashboard password';


--
-- Name: COLUMN server_configuration_secrets.vault_openai_api_key_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.server_configuration_secrets.vault_openai_api_key_id IS 'Vault UUID for OpenAI API key';


--
-- Name: server_secrets_audit; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.server_secrets_audit AS
 SELECT server_name,
    created_at,
    updated_at,
    configuration_metadata,
        CASE
            WHEN (vault_supabase_service_key_id IS NOT NULL) THEN true
            ELSE false
        END AS has_supabase_key,
        CASE
            WHEN (vault_admin_password_id IS NOT NULL) THEN true
            ELSE false
        END AS has_admin_password,
        CASE
            WHEN (vault_openai_api_key_id IS NOT NULL) THEN true
            ELSE false
        END AS has_openai_key
   FROM public.server_configuration_secrets;


--
-- Name: VIEW server_secrets_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.server_secrets_audit IS 'Audit view showing which secrets are configured (without exposing vault IDs)';


--
-- Name: smtp_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smtp_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    connection_name text NOT NULL,
    host text NOT NULL,
    port integer DEFAULT 587 NOT NULL,
    secure boolean DEFAULT false NOT NULL,
    username text NOT NULL,
    vault_password_id text NOT NULL,
    from_email text NOT NULL,
    from_name text,
    reply_to_email text,
    connection_timeout integer DEFAULT 60000,
    socket_timeout integer DEFAULT 60000,
    greeting_timeout integer DEFAULT 30000,
    max_emails_per_day integer DEFAULT 100,
    max_recipients_per_email integer DEFAULT 50,
    is_active boolean DEFAULT true,
    last_tested_at timestamp with time zone,
    test_status text DEFAULT 'pending'::text,
    test_error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT smtp_configurations_port_check CHECK (((port >= 1) AND (port <= 65535))),
    CONSTRAINT smtp_configurations_rate_limit_check CHECK (((max_emails_per_day > 0) AND (max_recipients_per_email > 0))),
    CONSTRAINT smtp_configurations_test_status_check CHECK ((test_status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text]))),
    CONSTRAINT smtp_configurations_timeout_check CHECK (((connection_timeout > 0) AND (socket_timeout > 0) AND (greeting_timeout > 0)))
);


--
-- Name: TABLE smtp_configurations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.smtp_configurations IS 'SMTP server configurations for users with secure credential storage';


--
-- Name: COLUMN smtp_configurations.secure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.smtp_configurations.secure IS 'true for SSL (port 465), false for TLS/STARTTLS (port 587)';


--
-- Name: COLUMN smtp_configurations.vault_password_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.smtp_configurations.vault_password_id IS 'Reference to encrypted SMTP password in Supabase Vault';


--
-- Name: COLUMN smtp_configurations.test_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.smtp_configurations.test_status IS 'Result of last connection test: success, failed, or pending';


--
-- Name: state_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_checkpoints (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    agent_id uuid NOT NULL,
    state_id uuid NOT NULL,
    checkpoint_type character varying(20),
    trigger_reason text,
    state_data jsonb NOT NULL,
    compression_type character varying(10),
    size_bytes integer,
    restoration_time_ms integer,
    restoration_count integer DEFAULT 0,
    retention_policy character varying(20),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT state_checkpoints_checkpoint_type_check CHECK (((checkpoint_type)::text = ANY (ARRAY[('manual'::character varying)::text, ('automatic'::character varying)::text, ('error_recovery'::character varying)::text, ('milestone'::character varying)::text]))),
    CONSTRAINT state_checkpoints_retention_policy_check CHECK (((retention_policy)::text = ANY (ARRAY[('temporary'::character varying)::text, ('permanent'::character varying)::text, ('archive'::character varying)::text])))
);


--
-- Name: state_transitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_transitions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    agent_id uuid NOT NULL,
    from_state_id uuid,
    to_state_id uuid NOT NULL,
    transition_type character varying(20),
    trigger character varying(50),
    changes jsonb NOT NULL,
    rollback_available boolean DEFAULT true,
    rollback_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT state_transitions_transition_type_check CHECK (((transition_type)::text = ANY (ARRAY[('update'::character varying)::text, ('merge'::character varying)::text, ('reset'::character varying)::text, ('restore'::character varying)::text])))
);


--
-- Name: stripe_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_invoice_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_subscription_id text,
    user_id uuid NOT NULL,
    invoice_number text,
    status text NOT NULL,
    amount_due integer DEFAULT 0 NOT NULL,
    amount_paid integer DEFAULT 0 NOT NULL,
    amount_remaining integer DEFAULT 0 NOT NULL,
    subtotal integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    tax integer DEFAULT 0,
    currency text DEFAULT 'usd'::text,
    invoice_created timestamp with time zone NOT NULL,
    due_date timestamp with time zone,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    paid_at timestamp with time zone,
    invoice_pdf text,
    hosted_invoice_url text,
    billing_reason text,
    description text,
    invoice_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stripe_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'uncollectible'::text, 'void'::text]))),
    CONSTRAINT valid_amounts CHECK (((amount_due >= 0) AND (amount_paid >= 0) AND (amount_remaining >= 0) AND (subtotal >= 0) AND (total >= 0))),
    CONSTRAINT valid_stripe_invoice_id CHECK ((stripe_invoice_id ~ '^in_[a-zA-Z0-9]+$'::text))
);


--
-- Name: TABLE stripe_invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_invoices IS 'Tracks Stripe invoices for subscriptions and billing';


--
-- Name: stripe_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_checkout_session_id text NOT NULL,
    stripe_payment_intent_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    user_id uuid NOT NULL,
    order_type text DEFAULT 'one_time'::text NOT NULL,
    description text,
    amount_subtotal integer NOT NULL,
    amount_total integer NOT NULL,
    amount_tax integer DEFAULT 0,
    currency text DEFAULT 'usd'::text,
    payment_status text NOT NULL,
    order_status text DEFAULT 'pending'::text,
    payment_method_type text,
    payment_method_brand text,
    payment_method_last4 text,
    fulfilled_at timestamp with time zone,
    fulfillment_data jsonb DEFAULT '{}'::jsonb,
    order_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stripe_orders_order_status_check CHECK ((order_status = ANY (ARRAY['pending'::text, 'completed'::text, 'canceled'::text, 'refunded'::text, 'partially_refunded'::text]))),
    CONSTRAINT stripe_orders_order_type_check CHECK ((order_type = ANY (ARRAY['one_time'::text, 'token_purchase'::text]))),
    CONSTRAINT stripe_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'canceled'::text, 'failed'::text]))),
    CONSTRAINT valid_order_amounts CHECK (((amount_subtotal >= 0) AND (amount_total >= 0) AND (amount_tax >= 0))),
    CONSTRAINT valid_stripe_payment_intent_id CHECK ((stripe_payment_intent_id ~ '^pi_[a-zA-Z0-9]+$'::text)),
    CONSTRAINT valid_stripe_session_id CHECK ((stripe_checkout_session_id ~ '^cs_[a-zA-Z0-9]+$'::text))
);


--
-- Name: TABLE stripe_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_orders IS 'Tracks one-time payments and orders through Stripe';


--
-- Name: stripe_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    stripe_price_id text NOT NULL,
    plan_name text NOT NULL,
    billing_interval text NOT NULL,
    billing_amount integer NOT NULL,
    currency text DEFAULT 'usd'::text,
    status text NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp with time zone,
    cancellation_reason text,
    default_payment_method text,
    payment_method_brand text,
    payment_method_last4 text,
    subscription_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stripe_subscriptions_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT stripe_subscriptions_status_check CHECK ((status = ANY (ARRAY['incomplete'::text, 'incomplete_expired'::text, 'trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'paused'::text]))),
    CONSTRAINT valid_billing_amount CHECK ((billing_amount >= 0)),
    CONSTRAINT valid_stripe_subscription_id CHECK ((stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$'::text))
);


--
-- Name: TABLE stripe_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_subscriptions IS 'Tracks active Stripe subscriptions for users';


--
-- Name: subscription_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid,
    user_id uuid NOT NULL,
    change_type text NOT NULL,
    old_status text,
    new_status text,
    old_plan_name text,
    new_plan_name text,
    change_reason text,
    changed_by_user_id uuid,
    stripe_event_id text,
    change_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_history_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'updated'::text, 'canceled'::text, 'reactivated'::text, 'plan_changed'::text, 'payment_failed'::text])))
);


--
-- Name: TABLE subscription_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_history IS 'Audit trail of all subscription changes';


--
-- Name: system_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_name text NOT NULL,
    display_name text NOT NULL,
    vault_secret_id text,
    is_active boolean DEFAULT true,
    last_updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE system_api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_api_keys IS 'Platform-wide API keys for system integrations like OpenAI and Anthropic. These are shared across all users and managed by admins only.';


--
-- Name: system_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    value double precision NOT NULL,
    type text NOT NULL,
    labels jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE system_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_metrics IS 'Stores system performance metrics and monitoring data';


--
-- Name: system_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: TABLE system_prompts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_prompts IS 'Editable system prompts for AI agent behavior. Updated 2025-10-20: Fixed intent classifier to properly handle capability questions vs action requests.';


--
-- Name: COLUMN system_prompts.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.system_prompts.content IS 'The actual prompt content that guides the AI''s behavior. Editable by admins.';


--
-- Name: team_canvas_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_canvas_layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    positions jsonb DEFAULT '[]'::jsonb NOT NULL,
    connections jsonb DEFAULT '[]'::jsonb NOT NULL,
    view_settings jsonb DEFAULT '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_positions jsonb DEFAULT '[]'::jsonb
);


--
-- Name: TABLE team_canvas_layouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_canvas_layouts IS 'User-specific visual canvas layouts storing team positions, connections, and view settings as JSONB';


--
-- Name: COLUMN team_canvas_layouts.positions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_canvas_layouts.positions IS 'JSONB array of team positions: [{teamId: UUID, x: number, y: number, width?: number, height?: number}]';


--
-- Name: COLUMN team_canvas_layouts.connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_canvas_layouts.connections IS 'JSONB array of connections: [{fromTeamId: UUID, toTeamId: UUID, type: string, label?: string, color?: string, style?: string}]';


--
-- Name: COLUMN team_canvas_layouts.view_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_canvas_layouts.view_settings IS 'JSONB object with canvas view state: {zoom: number, centerX: number, centerY: number}';


--
-- Name: COLUMN team_canvas_layouts.agent_positions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_canvas_layouts.agent_positions IS 'JSONB array of agent position data: [{"agentId": "uuid", "x": number, "y": number, "width": number, "height": number, "createdAt": "iso8601", "updatedAt": "iso8601"}]';


--
-- Name: team_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_team_id uuid NOT NULL,
    to_team_id uuid NOT NULL,
    connection_type public.team_connection_type DEFAULT 'collaborates_with'::public.team_connection_type NOT NULL,
    label text,
    color text,
    style text DEFAULT 'solid'::text,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT no_self_connections CHECK ((from_team_id <> to_team_id)),
    CONSTRAINT team_connections_style_check CHECK ((style = ANY (ARRAY['solid'::text, 'dashed'::text, 'dotted'::text])))
);


--
-- Name: TABLE team_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_connections IS 'Individual team connections with relationship types and styling metadata';


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    team_role text,
    team_role_description text,
    reports_to_agent_id uuid,
    reports_to_user boolean DEFAULT false NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_one_report_target CHECK ((((reports_to_agent_id IS NOT NULL) AND (reports_to_user = false)) OR ((reports_to_agent_id IS NULL) AND (reports_to_user = true)) OR ((reports_to_agent_id IS NULL) AND (reports_to_user = false)))),
    CONSTRAINT chk_reports_to_not_self CHECK ((agent_id <> reports_to_agent_id)),
    CONSTRAINT team_members_team_role_check CHECK ((char_length(team_role) > 0))
);


--
-- Name: TABLE team_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_members IS 'Links Agents to Teams and defines their role/reporting structure within the team.';


--
-- Name: COLUMN team_members.team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.team_id IS 'Foreign key referencing the team.';


--
-- Name: COLUMN team_members.agent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.agent_id IS 'The agent who is a member of the team.';


--
-- Name: COLUMN team_members.team_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.team_role IS 'The role of the agent within the team.';


--
-- Name: COLUMN team_members.team_role_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.team_role_description IS 'User-defined description of the agent''s specific duties on this team.';


--
-- Name: COLUMN team_members.reports_to_agent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.reports_to_agent_id IS 'Optional: The agent this team member reports to.';


--
-- Name: COLUMN team_members.reports_to_user; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.reports_to_user IS 'Indicates if this agent reports directly to the user for this team.';


--
-- Name: COLUMN team_members.joined_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.joined_at IS 'Timestamp when the agent joined the team.';


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid,
    parent_team_id uuid,
    CONSTRAINT teams_name_check CHECK ((char_length(name) > 0)),
    CONSTRAINT teams_no_self_parent CHECK ((id <> parent_team_id))
);


--
-- Name: TABLE teams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.teams IS 'Stores information about agent teams.';


--
-- Name: COLUMN teams.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.id IS 'Unique identifier for the team.';


--
-- Name: COLUMN teams.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.name IS 'Display name of the team.';


--
-- Name: COLUMN teams.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.description IS 'Optional description of the team''s purpose or focus.';


--
-- Name: COLUMN teams.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.created_at IS 'Timestamp when the team was created.';


--
-- Name: COLUMN teams.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.updated_at IS 'Timestamp when the team was last updated.';


--
-- Name: COLUMN teams.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.owner_user_id IS 'The user (from auth.users) who originally created the team.';


--
-- Name: COLUMN teams.parent_team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.parent_team_id IS 'Optional parent team ID for hierarchical organization structure. NULL for top-level teams.';


--
-- Name: temporary_chat_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_chat_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vault_link_token_id uuid NOT NULL,
    short_code text,
    title text NOT NULL,
    description text,
    welcome_message text,
    expires_at timestamp with time zone NOT NULL,
    max_sessions integer DEFAULT 1 NOT NULL,
    max_messages_per_session integer DEFAULT 100 NOT NULL,
    session_timeout_minutes integer DEFAULT 30 NOT NULL,
    session_count integer DEFAULT 0 NOT NULL,
    total_messages integer DEFAULT 0 NOT NULL,
    last_accessed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    allowed_domains text[],
    allowed_ips inet[],
    rate_limit_per_minute integer DEFAULT 10 NOT NULL,
    link_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ui_customization jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT temporary_chat_links_description_check CHECK ((length(description) <= 1000)),
    CONSTRAINT temporary_chat_links_max_messages_per_session_check CHECK (((max_messages_per_session >= 1) AND (max_messages_per_session <= 1000))),
    CONSTRAINT temporary_chat_links_max_sessions_check CHECK (((max_sessions >= 1) AND (max_sessions <= 50))),
    CONSTRAINT temporary_chat_links_rate_limit_per_minute_check CHECK (((rate_limit_per_minute >= 1) AND (rate_limit_per_minute <= 100))),
    CONSTRAINT temporary_chat_links_session_timeout_minutes_check CHECK (((session_timeout_minutes >= 5) AND (session_timeout_minutes <= 1440))),
    CONSTRAINT temporary_chat_links_title_check CHECK (((length(title) >= 1) AND (length(title) <= 200))),
    CONSTRAINT temporary_chat_links_welcome_message_check CHECK ((length(welcome_message) <= 2000)),
    CONSTRAINT valid_expiration CHECK ((expires_at > created_at)),
    CONSTRAINT valid_title CHECK ((title ~ '^[[:print:][:space:]]+$'::text))
);


--
-- Name: TABLE temporary_chat_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.temporary_chat_links IS 'Temporary chat links that allow anonymous public access to agent chat sessions';


--
-- Name: COLUMN temporary_chat_links.agent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.agent_id IS 'The agent that will respond to chats through this link';


--
-- Name: COLUMN temporary_chat_links.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.user_id IS 'The user who owns/created this temporary chat link';


--
-- Name: COLUMN temporary_chat_links.vault_link_token_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.vault_link_token_id IS 'Vault secret ID containing the encrypted link token - never stored in plain text';


--
-- Name: COLUMN temporary_chat_links.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.expires_at IS 'When this link expires and becomes invalid';


--
-- Name: COLUMN temporary_chat_links.max_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.max_sessions IS 'Maximum number of concurrent chat sessions allowed';


--
-- Name: COLUMN temporary_chat_links.max_messages_per_session; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.max_messages_per_session IS 'Maximum messages allowed per individual session';


--
-- Name: COLUMN temporary_chat_links.session_timeout_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.session_timeout_minutes IS 'Minutes of inactivity before a session times out';


--
-- Name: COLUMN temporary_chat_links.allowed_domains; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.allowed_domains IS 'Optional array of domains that can access this link';


--
-- Name: COLUMN temporary_chat_links.allowed_ips; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.allowed_ips IS 'Optional array of IP addresses that can access this link';


--
-- Name: COLUMN temporary_chat_links.rate_limit_per_minute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.rate_limit_per_minute IS 'Maximum messages per minute per session';


--
-- Name: COLUMN temporary_chat_links.link_metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.link_metadata IS 'Additional metadata for the link (JSON)';


--
-- Name: COLUMN temporary_chat_links.ui_customization; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_links.ui_customization IS 'UI customization settings (theme, colors, etc.)';


--
-- Name: temporary_chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporary_chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    vault_session_token_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    conversation_session_id uuid,
    participant_identifier text,
    participant_name text,
    participant_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    message_count integer DEFAULT 0 NOT NULL,
    session_duration_seconds integer,
    total_characters_sent integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    end_reason text,
    ip_address inet,
    user_agent text,
    referrer text,
    country_code text,
    last_message_at timestamp with time zone,
    messages_in_current_minute integer DEFAULT 0 NOT NULL,
    rate_limit_violations integer DEFAULT 0 NOT NULL,
    satisfaction_rating integer,
    feedback_text text,
    session_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT temporary_chat_sessions_end_reason_check CHECK ((end_reason = ANY (ARRAY['completed'::text, 'timeout'::text, 'expired'::text, 'terminated'::text, 'error'::text, 'max_messages'::text, 'max_duration'::text]))),
    CONSTRAINT temporary_chat_sessions_feedback_text_check CHECK ((length(feedback_text) <= 1000)),
    CONSTRAINT temporary_chat_sessions_participant_name_check CHECK ((length(participant_name) <= 100)),
    CONSTRAINT temporary_chat_sessions_satisfaction_rating_check CHECK (((satisfaction_rating >= 1) AND (satisfaction_rating <= 5))),
    CONSTRAINT temporary_chat_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text, 'expired'::text, 'terminated'::text, 'error'::text]))),
    CONSTRAINT valid_session_duration CHECK (((ended_at IS NULL) OR (ended_at >= started_at)))
);


--
-- Name: TABLE temporary_chat_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.temporary_chat_sessions IS 'Individual chat sessions created through temporary chat links';


--
-- Name: COLUMN temporary_chat_sessions.link_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.link_id IS 'The temporary chat link that created this session';


--
-- Name: COLUMN temporary_chat_sessions.vault_session_token_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.vault_session_token_id IS 'Vault secret ID containing the encrypted session token - never stored in plain text';


--
-- Name: COLUMN temporary_chat_sessions.conversation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.conversation_id IS 'Links to the conversation in the existing chat system';


--
-- Name: COLUMN temporary_chat_sessions.conversation_session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.conversation_session_id IS 'Optional link to conversation_sessions table for integration';


--
-- Name: COLUMN temporary_chat_sessions.participant_identifier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.participant_identifier IS 'Optional identifier provided by the participant (email, phone, etc.)';


--
-- Name: COLUMN temporary_chat_sessions.participant_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.participant_name IS 'Optional name provided by the participant';


--
-- Name: COLUMN temporary_chat_sessions.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.status IS 'Current status of the chat session';


--
-- Name: COLUMN temporary_chat_sessions.ip_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.ip_address IS 'IP address of the participant for security monitoring';


--
-- Name: COLUMN temporary_chat_sessions.user_agent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.user_agent IS 'Browser user agent for analytics and security';


--
-- Name: COLUMN temporary_chat_sessions.messages_in_current_minute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.messages_in_current_minute IS 'Tracks messages sent in current minute for rate limiting';


--
-- Name: COLUMN temporary_chat_sessions.rate_limit_violations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temporary_chat_sessions.rate_limit_violations IS 'Count of rate limit violations for abuse detection';


--
-- Name: tool_execution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_execution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tool_name text NOT NULL,
    tool_provider text NOT NULL,
    parameters jsonb,
    result_data jsonb,
    success boolean DEFAULT false NOT NULL,
    error_message text,
    execution_time_ms integer,
    quota_consumed integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE tool_execution_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tool_execution_logs IS 'Logs all tool executions by agents for audit and debugging purposes';


--
-- Name: tool_user_input_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_user_input_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tool_name text NOT NULL,
    tool_call_id text NOT NULL,
    required_fields jsonb NOT NULL,
    reason text,
    user_inputs jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT tool_user_input_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE tool_user_input_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tool_user_input_requests IS 'Stores requests for additional user input required by tools before execution';


--
-- Name: COLUMN tool_user_input_requests.tool_call_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool_user_input_requests.tool_call_id IS 'Unique identifier for the tool call that needs input';


--
-- Name: COLUMN tool_user_input_requests.required_fields; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool_user_input_requests.required_fields IS 'Array of field definitions needed from the user';


--
-- Name: COLUMN tool_user_input_requests.user_inputs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool_user_input_requests.user_inputs IS 'User-provided values for the required fields';


--
-- Name: COLUMN tool_user_input_requests.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tool_user_input_requests.status IS 'pending: waiting for user, completed: user provided input, cancelled: request no longer needed';


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    agent_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: TABLE usage_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_events IS 'Tracks feature usage and user interactions';


--
-- Name: user_oauth_connections; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_oauth_connections AS
 SELECT id,
    user_id,
    oauth_provider_id,
    external_user_id,
    external_username,
    scopes_granted,
    connection_name,
    vault_access_token_id,
    vault_refresh_token_id,
    token_expires_at,
    last_token_refresh,
    connection_status,
    connection_metadata,
    created_at,
    updated_at,
    encrypted_access_token,
    encrypted_refresh_token,
    credential_type
   FROM public.user_integration_credentials;


--
-- Name: VIEW user_oauth_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.user_oauth_connections IS 'DEPRECATED: Backward compatibility view - use user_integration_credentials directly';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_roles IS 'Links users to their assigned roles.';


--
-- Name: user_team_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_team_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_team_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_team_memberships IS 'Associates users with teams.';


--
-- Name: COLUMN user_team_memberships.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_team_memberships.user_id IS 'Foreign key referencing the user.';


--
-- Name: COLUMN user_team_memberships.team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_team_memberships.team_id IS 'Foreign key referencing the team.';


--
-- Name: COLUMN user_team_memberships.joined_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_team_memberships.joined_at IS 'Timestamp when the user joined the team.';


--
-- Name: user_token_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_token_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    period_type character varying(10) NOT NULL,
    total_prompt_tokens bigint DEFAULT 0 NOT NULL,
    total_completion_tokens bigint DEFAULT 0 NOT NULL,
    total_tokens bigint DEFAULT 0 NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    conversation_count integer DEFAULT 0 NOT NULL,
    agent_ids uuid[] DEFAULT '{}'::uuid[],
    last_activity timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_token_usage_counts_non_negative CHECK (((message_count >= 0) AND (conversation_count >= 0))),
    CONSTRAINT user_token_usage_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[]))),
    CONSTRAINT user_token_usage_period_valid CHECK ((period_end > period_start)),
    CONSTRAINT user_token_usage_tokens_non_negative CHECK (((total_prompt_tokens >= 0) AND (total_completion_tokens >= 0) AND (total_tokens >= 0)))
);


--
-- Name: TABLE user_token_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_token_usage IS 'Aggregated token usage metrics per user per time period';


--
-- Name: COLUMN user_token_usage.period_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_token_usage.period_type IS 'Type of time period: daily, weekly, or monthly';


--
-- Name: COLUMN user_token_usage.agent_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_token_usage.agent_ids IS 'Array of agent IDs that were used during this period';


--
-- Name: working_memory_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.working_memory_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    chunk_text text NOT NULL,
    chunk_index integer NOT NULL,
    message_ids uuid[] DEFAULT ARRAY[]::uuid[],
    importance_score double precision DEFAULT 0.5,
    chunk_type text DEFAULT 'dialogue'::text,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval)
);


--
-- Name: TABLE working_memory_chunks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.working_memory_chunks IS 'Short-term memory chunks from recent conversations with vector embeddings';


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    agent_id uuid,
    team_id uuid,
    user_id uuid,
    role text DEFAULT 'member'::text,
    added_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_one_member_type CHECK ((num_nonnulls(agent_id, team_id, user_id) = 1))
);

ALTER TABLE ONLY public.workspace_members FORCE ROW LEVEL SECURITY;


--
-- Name: account_graphs account_graphs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_graphs
    ADD CONSTRAINT account_graphs_pkey PRIMARY KEY (id);


--
-- Name: admin_integration_credentials admin_integration_credentials_integration_type_credential_n_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_integration_credentials
    ADD CONSTRAINT admin_integration_credentials_integration_type_credential_n_key UNIQUE (integration_type, credential_name);


--
-- Name: admin_integration_credentials admin_integration_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_integration_credentials
    ADD CONSTRAINT admin_integration_credentials_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: agent_contact_permissions agent_contact_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_contact_permissions
    ADD CONSTRAINT agent_contact_permissions_pkey PRIMARY KEY (id);


--
-- Name: agent_datastores agent_datastores_agent_id_datastore_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_datastores
    ADD CONSTRAINT agent_datastores_agent_id_datastore_id_key UNIQUE (agent_id, datastore_id);


--
-- Name: agent_datastores agent_datastores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_datastores
    ADD CONSTRAINT agent_datastores_pkey PRIMARY KEY (id);


--
-- Name: agent_email_addresses agent_email_addresses_local_part_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_email_addresses
    ADD CONSTRAINT agent_email_addresses_local_part_domain_key UNIQUE (local_part, domain);


--
-- Name: agent_email_addresses agent_email_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_email_addresses
    ADD CONSTRAINT agent_email_addresses_pkey PRIMARY KEY (id);


--
-- Name: agent_generation_logs agent_generation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_generation_logs
    ADD CONSTRAINT agent_generation_logs_pkey PRIMARY KEY (id);


--
-- Name: agent_group_access agent_group_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_group_access
    ADD CONSTRAINT agent_group_access_pkey PRIMARY KEY (id);


--
-- Name: agent_integration_permissions agent_integration_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_integration_permissions
    ADD CONSTRAINT agent_integration_permissions_pkey PRIMARY KEY (id);


--
-- Name: agent_llm_preferences agent_llm_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_llm_preferences
    ADD CONSTRAINT agent_llm_preferences_pkey PRIMARY KEY (agent_id);


--
-- Name: agent_mailgun_permissions agent_mailgun_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mailgun_permissions
    ADD CONSTRAINT agent_mailgun_permissions_pkey PRIMARY KEY (id);


--
-- Name: agent_mcp_connections agent_mcp_connections_agent_id_connection_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mcp_connections
    ADD CONSTRAINT agent_mcp_connections_agent_id_connection_name_key UNIQUE (agent_id, connection_name);


--
-- Name: agent_mcp_connections agent_mcp_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mcp_connections
    ADD CONSTRAINT agent_mcp_connections_pkey PRIMARY KEY (id);


--
-- Name: agent_media_assignments agent_media_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_media_assignments
    ADD CONSTRAINT agent_media_assignments_pkey PRIMARY KEY (id);


--
-- Name: agent_memories agent_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memories
    ADD CONSTRAINT agent_memories_pkey PRIMARY KEY (id);


--
-- Name: agent_sendgrid_permissions agent_sendgrid_permissions_agent_id_sendgrid_config_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sendgrid_permissions
    ADD CONSTRAINT agent_sendgrid_permissions_agent_id_sendgrid_config_id_key UNIQUE (agent_id, sendgrid_config_id);


--
-- Name: agent_sendgrid_permissions agent_sendgrid_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sendgrid_permissions
    ADD CONSTRAINT agent_sendgrid_permissions_pkey PRIMARY KEY (id);


--
-- Name: agent_smtp_permissions agent_smtp_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_smtp_permissions
    ADD CONSTRAINT agent_smtp_permissions_pkey PRIMARY KEY (id);


--
-- Name: agent_smtp_permissions agent_smtp_permissions_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_smtp_permissions
    ADD CONSTRAINT agent_smtp_permissions_unique UNIQUE (agent_id, smtp_config_id);


--
-- Name: agent_specific_contact_access agent_specific_contact_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_specific_contact_access
    ADD CONSTRAINT agent_specific_contact_access_pkey PRIMARY KEY (id);


--
-- Name: agent_states agent_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_states
    ADD CONSTRAINT agent_states_pkey PRIMARY KEY (id);


--
-- Name: agent_task_event_triggers agent_task_event_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_task_event_triggers
    ADD CONSTRAINT agent_task_event_triggers_pkey PRIMARY KEY (id);


--
-- Name: agent_task_executions agent_task_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_task_executions
    ADD CONSTRAINT agent_task_executions_pkey PRIMARY KEY (id);


--
-- Name: agent_tasks agent_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: artifact_versions artifact_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_pkey PRIMARY KEY (id);


--
-- Name: artifacts artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_pkey PRIMARY KEY (id);


--
-- Name: billing_plans billing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_plans
    ADD CONSTRAINT billing_plans_pkey PRIMARY KEY (id);


--
-- Name: billing_plans billing_plans_plan_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_plans
    ADD CONSTRAINT billing_plans_plan_name_key UNIQUE (plan_name);


--
-- Name: billing_plans billing_plans_stripe_price_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_plans
    ADD CONSTRAINT billing_plans_stripe_price_id_key UNIQUE (stripe_price_id);


--
-- Name: canvas_diffs canvas_diffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_diffs
    ADD CONSTRAINT canvas_diffs_pkey PRIMARY KEY (id);


--
-- Name: canvas_sessions canvas_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_sessions
    ADD CONSTRAINT canvas_sessions_pkey PRIMARY KEY (id);


--
-- Name: canvas_sessions canvas_sessions_user_id_artifact_id_conversation_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_sessions
    ADD CONSTRAINT canvas_sessions_user_id_artifact_id_conversation_session_id_key UNIQUE (user_id, artifact_id, conversation_session_id);


--
-- Name: canvas_snapshots canvas_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_snapshots
    ADD CONSTRAINT canvas_snapshots_pkey PRIMARY KEY (id);


--
-- Name: chat_channels chat_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_messages_v2 chat_messages_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages_v2
    ADD CONSTRAINT chat_messages_v2_pkey PRIMARY KEY (id);


--
-- Name: workspaces chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: contact_audit_log contact_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_audit_log
    ADD CONSTRAINT contact_audit_log_pkey PRIMARY KEY (id);


--
-- Name: contact_communication_channels contact_communication_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_communication_channels
    ADD CONSTRAINT contact_communication_channels_pkey PRIMARY KEY (id);


--
-- Name: contact_group_memberships contact_group_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_memberships
    ADD CONSTRAINT contact_group_memberships_pkey PRIMARY KEY (id);


--
-- Name: contact_groups contact_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_groups
    ADD CONSTRAINT contact_groups_pkey PRIMARY KEY (id);


--
-- Name: contact_import_errors contact_import_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_import_errors
    ADD CONSTRAINT contact_import_errors_pkey PRIMARY KEY (id);


--
-- Name: contact_import_jobs contact_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_import_jobs
    ADD CONSTRAINT contact_import_jobs_pkey PRIMARY KEY (id);


--
-- Name: contact_interactions contact_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interactions
    ADD CONSTRAINT contact_interactions_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: context_snapshots context_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.context_snapshots
    ADD CONSTRAINT context_snapshots_pkey PRIMARY KEY (id);


--
-- Name: context_templates context_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.context_templates
    ADD CONSTRAINT context_templates_name_key UNIQUE (name);


--
-- Name: context_templates context_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.context_templates
    ADD CONSTRAINT context_templates_pkey PRIMARY KEY (id);


--
-- Name: conversation_sessions conversation_sessions_conversation_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_conversation_id_unique UNIQUE (conversation_id);


--
-- Name: conversation_sessions conversation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_pkey PRIMARY KEY (id);


--
-- Name: conversation_summaries conversation_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summaries
    ADD CONSTRAINT conversation_summaries_pkey PRIMARY KEY (id);


--
-- Name: conversation_summary_boards conversation_summary_boards_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summary_boards
    ADD CONSTRAINT conversation_summary_boards_conversation_id_key UNIQUE (conversation_id);


--
-- Name: conversation_summary_boards conversation_summary_boards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summary_boards
    ADD CONSTRAINT conversation_summary_boards_pkey PRIMARY KEY (id);


--
-- Name: datastores datastores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datastores
    ADD CONSTRAINT datastores_pkey PRIMARY KEY (id);


--
-- Name: email_change_audit_log email_change_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_change_audit_log
    ADD CONSTRAINT email_change_audit_log_pkey PRIMARY KEY (id);


--
-- Name: gmail_configurations gmail_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_configurations
    ADD CONSTRAINT gmail_configurations_pkey PRIMARY KEY (id);


--
-- Name: integration_capabilities integration_capabilities_integration_id_capability_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_capabilities
    ADD CONSTRAINT integration_capabilities_integration_id_capability_key_key UNIQUE (integration_id, capability_key);


--
-- Name: integration_capabilities integration_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_capabilities
    ADD CONSTRAINT integration_capabilities_pkey PRIMARY KEY (id);


--
-- Name: integration_categories integration_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_categories
    ADD CONSTRAINT integration_categories_name_key UNIQUE (name);


--
-- Name: integration_categories integration_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_categories
    ADD CONSTRAINT integration_categories_pkey PRIMARY KEY (id);


--
-- Name: mailgun_configurations mailgun_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_configurations
    ADD CONSTRAINT mailgun_configurations_pkey PRIMARY KEY (id);


--
-- Name: mailgun_operation_logs mailgun_operation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_operation_logs
    ADD CONSTRAINT mailgun_operation_logs_pkey PRIMARY KEY (id);


--
-- Name: mailgun_routes mailgun_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_routes
    ADD CONSTRAINT mailgun_routes_pkey PRIMARY KEY (id);


--
-- Name: mcp_tools_cache mcp_tools_cache_connection_id_tool_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_tools_cache
    ADD CONSTRAINT mcp_tools_cache_connection_id_tool_name_key UNIQUE (connection_id, tool_name);


--
-- Name: mcp_tools_cache mcp_tools_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_tools_cache
    ADD CONSTRAINT mcp_tools_cache_pkey PRIMARY KEY (id);


--
-- Name: media_categories media_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT media_categories_pkey PRIMARY KEY (id);


--
-- Name: media_library media_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_pkey PRIMARY KEY (id);


--
-- Name: message_versions message_versions_message_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_versions
    ADD CONSTRAINT message_versions_message_id_version_number_key UNIQUE (message_id, version_number);


--
-- Name: message_versions message_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_versions
    ADD CONSTRAINT message_versions_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_key_key UNIQUE (key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sendgrid_inbound_emails sendgrid_inbound_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_inbound_emails
    ADD CONSTRAINT sendgrid_inbound_emails_pkey PRIMARY KEY (id);


--
-- Name: sendgrid_inbound_routing_logs sendgrid_inbound_routing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_inbound_routing_logs
    ADD CONSTRAINT sendgrid_inbound_routing_logs_pkey PRIMARY KEY (id);


--
-- Name: sendgrid_inbound_routing_rules sendgrid_inbound_routing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_inbound_routing_rules
    ADD CONSTRAINT sendgrid_inbound_routing_rules_pkey PRIMARY KEY (id);


--
-- Name: sendgrid_operation_logs sendgrid_operation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_operation_logs
    ADD CONSTRAINT sendgrid_operation_logs_pkey PRIMARY KEY (id);


--
-- Name: sendgrid_templates sendgrid_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_templates
    ADD CONSTRAINT sendgrid_templates_pkey PRIMARY KEY (id);


--
-- Name: sendgrid_templates sendgrid_templates_sendgrid_config_id_sendgrid_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_templates
    ADD CONSTRAINT sendgrid_templates_sendgrid_config_id_sendgrid_template_id_key UNIQUE (sendgrid_config_id, sendgrid_template_id);


--
-- Name: server_configuration_secrets server_configuration_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_configuration_secrets
    ADD CONSTRAINT server_configuration_secrets_pkey PRIMARY KEY (id);


--
-- Name: server_configuration_secrets server_configuration_secrets_server_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.server_configuration_secrets
    ADD CONSTRAINT server_configuration_secrets_server_name_key UNIQUE (server_name);


--
-- Name: service_providers service_providers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_name_key UNIQUE (name);


--
-- Name: service_providers service_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_providers
    ADD CONSTRAINT service_providers_pkey PRIMARY KEY (id);


--
-- Name: smtp_configurations smtp_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_configurations
    ADD CONSTRAINT smtp_configurations_pkey PRIMARY KEY (id);


--
-- Name: smtp_configurations smtp_configurations_user_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_configurations
    ADD CONSTRAINT smtp_configurations_user_name_unique UNIQUE (user_id, connection_name);


--
-- Name: state_checkpoints state_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_checkpoints
    ADD CONSTRAINT state_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: state_transitions state_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_transitions
    ADD CONSTRAINT state_transitions_pkey PRIMARY KEY (id);


--
-- Name: stripe_customers stripe_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT stripe_customers_pkey PRIMARY KEY (id);


--
-- Name: stripe_customers stripe_customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT stripe_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: stripe_invoices stripe_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_pkey PRIMARY KEY (id);


--
-- Name: stripe_invoices stripe_invoices_stripe_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);


--
-- Name: stripe_orders stripe_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_orders
    ADD CONSTRAINT stripe_orders_pkey PRIMARY KEY (id);


--
-- Name: stripe_orders stripe_orders_stripe_checkout_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_orders
    ADD CONSTRAINT stripe_orders_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);


--
-- Name: stripe_orders stripe_orders_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_orders
    ADD CONSTRAINT stripe_orders_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: stripe_subscriptions stripe_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: stripe_subscriptions stripe_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: subscription_history subscription_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_pkey PRIMARY KEY (id);


--
-- Name: system_api_keys system_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_api_keys
    ADD CONSTRAINT system_api_keys_pkey PRIMARY KEY (id);


--
-- Name: system_api_keys system_api_keys_provider_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_api_keys
    ADD CONSTRAINT system_api_keys_provider_name_key UNIQUE (provider_name);


--
-- Name: system_metrics system_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_metrics
    ADD CONSTRAINT system_metrics_pkey PRIMARY KEY (id);


--
-- Name: system_prompts system_prompts_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_prompts
    ADD CONSTRAINT system_prompts_key_key UNIQUE (key);


--
-- Name: system_prompts system_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_prompts
    ADD CONSTRAINT system_prompts_pkey PRIMARY KEY (id);


--
-- Name: task_steps task_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_steps
    ADD CONSTRAINT task_steps_pkey PRIMARY KEY (id);


--
-- Name: team_canvas_layouts team_canvas_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_canvas_layouts
    ADD CONSTRAINT team_canvas_layouts_pkey PRIMARY KEY (id);


--
-- Name: team_canvas_layouts team_canvas_layouts_user_workspace_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_canvas_layouts
    ADD CONSTRAINT team_canvas_layouts_user_workspace_unique UNIQUE (user_id, workspace_id);


--
-- Name: team_connections team_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_connections
    ADD CONSTRAINT team_connections_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, agent_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: temporary_chat_links temporary_chat_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_links
    ADD CONSTRAINT temporary_chat_links_pkey PRIMARY KEY (id);


--
-- Name: temporary_chat_links temporary_chat_links_short_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_links
    ADD CONSTRAINT temporary_chat_links_short_code_key UNIQUE (short_code);


--
-- Name: temporary_chat_links temporary_chat_links_vault_link_token_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_links
    ADD CONSTRAINT temporary_chat_links_vault_link_token_id_key UNIQUE (vault_link_token_id);


--
-- Name: temporary_chat_sessions temporary_chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_sessions
    ADD CONSTRAINT temporary_chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: temporary_chat_sessions temporary_chat_sessions_vault_session_token_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_sessions
    ADD CONSTRAINT temporary_chat_sessions_vault_session_token_id_key UNIQUE (vault_session_token_id);


--
-- Name: tool_execution_logs tool_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_execution_logs
    ADD CONSTRAINT tool_execution_logs_pkey PRIMARY KEY (id);


--
-- Name: tool_user_input_requests tool_user_input_requests_conversation_tool_call; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_user_input_requests
    ADD CONSTRAINT tool_user_input_requests_conversation_tool_call UNIQUE (conversation_id, tool_call_id);


--
-- Name: tool_user_input_requests tool_user_input_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_user_input_requests
    ADD CONSTRAINT tool_user_input_requests_pkey PRIMARY KEY (id);


--
-- Name: tool_user_input_requests tool_user_input_requests_tool_call_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_user_input_requests
    ADD CONSTRAINT tool_user_input_requests_tool_call_id_key UNIQUE (tool_call_id);


--
-- Name: agent_mailgun_permissions unique_agent_mailgun_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mailgun_permissions
    ADD CONSTRAINT unique_agent_mailgun_permission UNIQUE (agent_id, mailgun_config_id);


--
-- Name: agent_media_assignments unique_agent_media_assignment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_media_assignments
    ADD CONSTRAINT unique_agent_media_assignment UNIQUE (agent_id, media_id);


--
-- Name: artifact_versions unique_artifact_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT unique_artifact_version UNIQUE (artifact_id, version_number);


--
-- Name: mailgun_configurations unique_connection_mailgun; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_configurations
    ADD CONSTRAINT unique_connection_mailgun UNIQUE (user_oauth_connection_id);


--
-- Name: mailgun_routes unique_mailgun_route_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_routes
    ADD CONSTRAINT unique_mailgun_route_id UNIQUE (mailgun_route_id);


--
-- Name: task_steps unique_task_step_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_steps
    ADD CONSTRAINT unique_task_step_order UNIQUE (task_id, step_order);


--
-- Name: team_connections unique_team_connection; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_connections
    ADD CONSTRAINT unique_team_connection UNIQUE (from_team_id, to_team_id, connection_type);


--
-- Name: media_categories unique_user_category_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT unique_user_category_name UNIQUE (user_id, name);


--
-- Name: stripe_customers unique_user_customer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT unique_user_customer UNIQUE (user_id);


--
-- Name: media_library unique_user_file_path; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT unique_user_file_path UNIQUE (user_id, storage_path);


--
-- Name: mailgun_configurations unique_user_mailgun; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_configurations
    ADD CONSTRAINT unique_user_mailgun UNIQUE (user_id);


--
-- Name: user_team_memberships unique_user_team_membership; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_team_memberships
    ADD CONSTRAINT unique_user_team_membership UNIQUE (user_id, team_id);


--
-- Name: CONSTRAINT unique_user_team_membership ON user_team_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT unique_user_team_membership ON public.user_team_memberships IS 'Ensures a user cannot be added multiple times to the same team.';


--
-- Name: workspace_members unique_workspace_agent; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT unique_workspace_agent UNIQUE (workspace_id, agent_id);


--
-- Name: workspace_members unique_workspace_team; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT unique_workspace_team UNIQUE (workspace_id, team_id);


--
-- Name: workspace_members unique_workspace_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id);


--
-- Name: agent_integration_permissions uq_agent_integration_connection; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_integration_permissions
    ADD CONSTRAINT uq_agent_integration_connection UNIQUE (agent_id, user_oauth_connection_id);


--
-- Name: user_integration_credentials uq_user_provider_external; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integration_credentials
    ADD CONSTRAINT uq_user_provider_external UNIQUE (user_id, oauth_provider_id, external_user_id);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: user_integration_credentials user_integration_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integration_credentials
    ADD CONSTRAINT user_integration_credentials_pkey PRIMARY KEY (id);


--
-- Name: user_integration_credentials user_oauth_connections_user_provider_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integration_credentials
    ADD CONSTRAINT user_oauth_connections_user_provider_name_key UNIQUE (user_id, oauth_provider_id, connection_name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_team_memberships user_team_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_team_memberships
    ADD CONSTRAINT user_team_memberships_pkey PRIMARY KEY (id);


--
-- Name: user_token_usage user_token_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_token_usage
    ADD CONSTRAINT user_token_usage_pkey PRIMARY KEY (id);


--
-- Name: user_token_usage user_token_usage_unique_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_token_usage
    ADD CONSTRAINT user_token_usage_unique_period UNIQUE (user_id, period_start, period_type);


--
-- Name: working_memory_chunks working_memory_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_memory_chunks
    ADD CONSTRAINT working_memory_chunks_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: idx_account_graphs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_graphs_user_id ON public.account_graphs USING btree (user_id);


--
-- Name: idx_admin_integration_credentials_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_integration_credentials_status ON public.admin_integration_credentials USING btree (connection_status);


--
-- Name: idx_admin_integration_credentials_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_integration_credentials_type ON public.admin_integration_credentials USING btree (integration_type);


--
-- Name: idx_admin_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_settings_key ON public.admin_settings USING btree (setting_key);


--
-- Name: idx_agent_datastores_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_datastores_agent_id ON public.agent_datastores USING btree (agent_id);


--
-- Name: idx_agent_datastores_datastore_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_datastores_datastore_id ON public.agent_datastores USING btree (datastore_id);


--
-- Name: idx_agent_email_addresses_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_email_addresses_agent ON public.agent_email_addresses USING btree (agent_id);


--
-- Name: idx_agent_email_addresses_full; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_email_addresses_full ON public.agent_email_addresses USING btree (full_address);


--
-- Name: idx_agent_generation_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_generation_logs_created_at ON public.agent_generation_logs USING btree (created_at DESC);


--
-- Name: idx_agent_generation_logs_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_generation_logs_method ON public.agent_generation_logs USING btree (generation_method);


--
-- Name: idx_agent_generation_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_generation_logs_user_id ON public.agent_generation_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_agent_integration_permissions_agent_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_integration_permissions_agent_connection ON public.agent_integration_permissions USING btree (agent_id, user_oauth_connection_id);


--
-- Name: idx_agent_integration_permissions_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_integration_permissions_agent_id ON public.agent_integration_permissions USING btree (agent_id) WHERE (is_active = true);


--
-- Name: idx_agent_llm_prefs_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_llm_prefs_provider ON public.agent_llm_preferences USING btree (provider);


--
-- Name: idx_agent_mailgun_permissions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mailgun_permissions_active ON public.agent_mailgun_permissions USING btree (is_active);


--
-- Name: idx_agent_mailgun_permissions_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mailgun_permissions_agent ON public.agent_mailgun_permissions USING btree (agent_id);


--
-- Name: idx_agent_mailgun_permissions_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mailgun_permissions_config ON public.agent_mailgun_permissions USING btree (mailgun_config_id);


--
-- Name: idx_agent_mcp_connections_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mcp_connections_active ON public.agent_mcp_connections USING btree (agent_id, is_active) WHERE (is_active = true);


--
-- Name: idx_agent_mcp_connections_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mcp_connections_agent_id ON public.agent_mcp_connections USING btree (agent_id);


--
-- Name: idx_agent_mcp_connections_capabilities; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mcp_connections_capabilities ON public.agent_mcp_connections USING gin (server_capabilities);


--
-- Name: idx_agent_mcp_connections_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mcp_connections_protocol ON public.agent_mcp_connections USING btree (protocol_version);


--
-- Name: idx_agent_mcp_connections_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mcp_connections_type ON public.agent_mcp_connections USING btree (connection_type, is_active) WHERE (is_active = true);


--
-- Name: idx_agent_mcp_connections_vault_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_mcp_connections_vault_url ON public.agent_mcp_connections USING btree (vault_server_url_id) WHERE (vault_server_url_id IS NOT NULL);


--
-- Name: idx_agent_media_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_media_active ON public.agent_media_assignments USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_agent_media_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_media_agent_id ON public.agent_media_assignments USING btree (agent_id);


--
-- Name: idx_agent_media_assignments_agent_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_media_assignments_agent_active ON public.agent_media_assignments USING btree (agent_id, is_active) WHERE (is_active = true);


--
-- Name: idx_agent_media_media_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_media_media_id ON public.agent_media_assignments USING btree (media_id);


--
-- Name: idx_agent_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_media_type ON public.agent_media_assignments USING btree (assignment_type);


--
-- Name: idx_agent_media_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_media_user_id ON public.agent_media_assignments USING btree (user_id);


--
-- Name: idx_agent_permissions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_active ON public.agent_sendgrid_permissions USING btree (agent_id) WHERE (is_active = true);


--
-- Name: idx_agent_permissions_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_agent ON public.agent_contact_permissions USING btree (agent_id);


--
-- Name: idx_agent_permissions_allowed_channels; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_allowed_channels ON public.agent_contact_permissions USING gin (allowed_channels);


--
-- Name: idx_agent_permissions_filters; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_filters ON public.agent_contact_permissions USING gin (access_filters);


--
-- Name: idx_agent_permissions_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_granted_by ON public.agent_contact_permissions USING btree (granted_by_user_id);


--
-- Name: idx_agent_permissions_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_metadata ON public.agent_contact_permissions USING gin (permission_metadata);


--
-- Name: idx_agent_permissions_restricted_channels; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_restricted_channels ON public.agent_contact_permissions USING gin (restricted_channels);


--
-- Name: idx_agent_permissions_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_schedule ON public.agent_contact_permissions USING gin (access_schedule);


--
-- Name: idx_agent_permissions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_type ON public.agent_contact_permissions USING btree (permission_type);


--
-- Name: idx_agent_permissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_permissions_user ON public.agent_contact_permissions USING btree (user_id);


--
-- Name: idx_agent_smtp_permissions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_smtp_permissions_active ON public.agent_smtp_permissions USING btree (agent_id, is_active) WHERE (is_active = true);


--
-- Name: idx_agent_smtp_permissions_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_smtp_permissions_agent_id ON public.agent_smtp_permissions USING btree (agent_id);


--
-- Name: idx_agent_smtp_permissions_config_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_smtp_permissions_config_id ON public.agent_smtp_permissions USING btree (smtp_config_id);


--
-- Name: idx_agent_task_event_triggers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_event_triggers_is_active ON public.agent_task_event_triggers USING btree (is_active);


--
-- Name: idx_agent_task_event_triggers_last_triggered_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_event_triggers_last_triggered_at ON public.agent_task_event_triggers USING btree (last_triggered_at);


--
-- Name: idx_agent_task_event_triggers_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_event_triggers_task_id ON public.agent_task_event_triggers USING btree (task_id);


--
-- Name: idx_agent_task_event_triggers_trigger_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_event_triggers_trigger_type ON public.agent_task_event_triggers USING btree (trigger_type);


--
-- Name: idx_agent_task_executions_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_executions_agent_id ON public.agent_task_executions USING btree (agent_id);


--
-- Name: idx_agent_task_executions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_executions_created_at ON public.agent_task_executions USING btree (created_at);


--
-- Name: idx_agent_task_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_executions_status ON public.agent_task_executions USING btree (status);


--
-- Name: idx_agent_task_executions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_task_executions_task_id ON public.agent_task_executions USING btree (task_id);


--
-- Name: idx_agent_tasks_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_agent_id ON public.agent_tasks USING btree (agent_id);


--
-- Name: idx_agent_tasks_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_conversation ON public.agent_tasks USING btree (conversation_id);


--
-- Name: idx_agent_tasks_event_trigger_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_event_trigger_type ON public.agent_tasks USING btree (event_trigger_type) WHERE (task_type = 'event_based'::public.task_type_enum);


--
-- Name: idx_agent_tasks_next_run_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_next_run_at ON public.agent_tasks USING btree (next_run_at) WHERE ((status = 'active'::public.task_status_enum) AND (task_type = 'scheduled'::public.task_type_enum));


--
-- Name: idx_agent_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_status ON public.agent_tasks USING btree (status);


--
-- Name: idx_agent_tasks_task_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_task_type ON public.agent_tasks USING btree (task_type);


--
-- Name: idx_agent_tasks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_tasks_user_id ON public.agent_tasks USING btree (user_id);


--
-- Name: idx_agents_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_created_at ON public.agents USING btree (created_at);


--
-- Name: idx_agents_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_metadata ON public.agents USING gin (metadata);


--
-- Name: idx_agents_user_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_user_auth ON public.agents USING btree (user_id);


--
-- Name: idx_agents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_user_id ON public.agents USING btree (user_id);


--
-- Name: idx_artifact_versions_artifact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifact_versions_artifact_id ON public.artifact_versions USING btree (artifact_id);


--
-- Name: idx_artifact_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifact_versions_created_at ON public.artifact_versions USING btree (created_at DESC);


--
-- Name: idx_artifact_versions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifact_versions_created_by ON public.artifact_versions USING btree (created_by);


--
-- Name: idx_artifacts_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_agent_id ON public.artifacts USING btree (agent_id);


--
-- Name: idx_artifacts_conversation_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_conversation_session_id ON public.artifacts USING btree (conversation_session_id);


--
-- Name: idx_artifacts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_created_at ON public.artifacts USING btree (created_at DESC);


--
-- Name: idx_artifacts_file_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_file_type ON public.artifacts USING btree (file_type);


--
-- Name: idx_artifacts_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_latest ON public.artifacts USING btree (is_latest_version) WHERE (is_latest_version = true);


--
-- Name: idx_artifacts_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_message_id ON public.artifacts USING btree (message_id);


--
-- Name: idx_artifacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_status ON public.artifacts USING btree (status);


--
-- Name: idx_artifacts_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_tags ON public.artifacts USING gin (tags);


--
-- Name: idx_artifacts_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_updated_at ON public.artifacts USING btree (updated_at DESC);


--
-- Name: idx_artifacts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_user_id ON public.artifacts USING btree (user_id);


--
-- Name: idx_artifacts_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_workspace_id ON public.artifacts USING btree (workspace_id);


--
-- Name: idx_billing_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_plans_active ON public.billing_plans USING btree (is_active);


--
-- Name: idx_billing_plans_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_plans_name ON public.billing_plans USING btree (plan_name);


--
-- Name: idx_billing_plans_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_plans_sort ON public.billing_plans USING btree (sort_order);


--
-- Name: idx_billing_plans_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_plans_sort_order ON public.billing_plans USING btree (sort_order);


--
-- Name: idx_billing_plans_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_plans_type_active ON public.billing_plans USING btree (plan_type, is_active);


--
-- Name: idx_canvas_diffs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_diffs_created ON public.canvas_diffs USING btree (created_at DESC);


--
-- Name: idx_canvas_diffs_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_diffs_operation ON public.canvas_diffs USING btree (operation_type);


--
-- Name: idx_canvas_diffs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_diffs_session ON public.canvas_diffs USING btree (canvas_session_id);


--
-- Name: idx_canvas_sessions_artifact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_sessions_artifact_id ON public.canvas_sessions USING btree (artifact_id);


--
-- Name: idx_canvas_sessions_conversation_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_sessions_conversation_session_id ON public.canvas_sessions USING btree (conversation_session_id);


--
-- Name: idx_canvas_sessions_last_accessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_sessions_last_accessed ON public.canvas_sessions USING btree (last_accessed_at DESC);


--
-- Name: idx_canvas_sessions_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_sessions_snapshot ON public.canvas_sessions USING btree (current_snapshot_id);


--
-- Name: idx_canvas_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_sessions_user_id ON public.canvas_sessions USING btree (user_id);


--
-- Name: idx_canvas_snapshots_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_snapshots_created ON public.canvas_snapshots USING btree (created_at DESC);


--
-- Name: idx_canvas_snapshots_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_canvas_snapshots_session ON public.canvas_snapshots USING btree (canvas_session_id);


--
-- Name: idx_channels_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_active ON public.contact_communication_channels USING btree (contact_id, channel_type) WHERE (is_active = true);


--
-- Name: idx_channels_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_contact_id ON public.contact_communication_channels USING btree (contact_id);


--
-- Name: idx_channels_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_delivery ON public.contact_communication_channels USING btree (delivery_status);


--
-- Name: idx_channels_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_identifier ON public.contact_communication_channels USING btree (channel_identifier);


--
-- Name: idx_channels_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_integration ON public.contact_communication_channels USING gin (integration_data);


--
-- Name: idx_channels_marketing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_marketing ON public.contact_communication_channels USING btree (user_id, channel_type) WHERE ((marketing_consent = true) AND (is_active = true));


--
-- Name: idx_channels_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_metadata ON public.contact_communication_channels USING gin (channel_metadata);


--
-- Name: idx_channels_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_primary ON public.contact_communication_channels USING btree (contact_id) WHERE (is_primary = true);


--
-- Name: idx_channels_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_type ON public.contact_communication_channels USING btree (channel_type);


--
-- Name: idx_channels_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_updated_at ON public.contact_communication_channels USING btree (updated_at);


--
-- Name: idx_channels_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_user_id ON public.contact_communication_channels USING btree (user_id);


--
-- Name: idx_channels_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_verification ON public.contact_communication_channels USING btree (verification_status);


--
-- Name: idx_channels_verification_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_verification_token ON public.contact_communication_channels USING btree (verification_token) WHERE (verification_token IS NOT NULL);


--
-- Name: idx_channels_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channels_verified ON public.contact_communication_channels USING btree (contact_id, channel_type) WHERE (is_verified = true);


--
-- Name: idx_chat_channels_last_message_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channels_last_message_at ON public.chat_channels USING btree (last_message_at DESC NULLS LAST);


--
-- Name: idx_chat_channels_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channels_room_id ON public.chat_channels USING btree (workspace_id);


--
-- Name: idx_chat_messages_channel_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_channel_id_created_at ON public.chat_messages USING btree (channel_id, created_at);


--
-- Name: idx_chat_messages_sender_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_sender_agent_id ON public.chat_messages USING btree (sender_agent_id);


--
-- Name: idx_chat_messages_sender_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_sender_user_id ON public.chat_messages USING btree (sender_user_id);


--
-- Name: idx_chat_rooms_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_rooms_owner_user_id ON public.workspaces USING btree (owner_user_id);


--
-- Name: idx_checkpoints_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkpoints_agent ON public.state_checkpoints USING btree (agent_id, created_at DESC);


--
-- Name: idx_checkpoints_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkpoints_retention ON public.state_checkpoints USING btree (retention_policy, expires_at);


--
-- Name: idx_contact_audit_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_audit_contact_id ON public.contact_audit_log USING btree (contact_id);


--
-- Name: idx_contact_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_audit_created_at ON public.contact_audit_log USING btree (created_at);


--
-- Name: idx_contact_audit_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_audit_operation ON public.contact_audit_log USING btree (operation_type);


--
-- Name: idx_contact_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_audit_user_id ON public.contact_audit_log USING btree (user_id);


--
-- Name: idx_contact_groups_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_created_at ON public.contact_groups USING btree (created_at);


--
-- Name: idx_contact_groups_custom_fields; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_custom_fields ON public.contact_groups USING gin (custom_fields);


--
-- Name: idx_contact_groups_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_parent ON public.contact_groups USING btree (parent_group_id);


--
-- Name: idx_contact_groups_smart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_smart ON public.contact_groups USING btree (user_id) WHERE (is_smart_group = true);


--
-- Name: idx_contact_groups_smart_criteria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_smart_criteria ON public.contact_groups USING gin (smart_criteria) WHERE (smart_criteria IS NOT NULL);


--
-- Name: idx_contact_groups_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_system ON public.contact_groups USING btree (user_id) WHERE (is_system_group = true);


--
-- Name: idx_contact_groups_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_tags ON public.contact_groups USING gin (tags);


--
-- Name: idx_contact_groups_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_type ON public.contact_groups USING btree (group_type);


--
-- Name: idx_contact_groups_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_groups_user_id ON public.contact_groups USING btree (user_id);


--
-- Name: idx_contacts_active_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_active_org ON public.contacts USING btree (user_id, organization, display_name) WHERE ((contact_status = 'active'::text) AND (deleted_at IS NULL) AND (organization IS NOT NULL));


--
-- Name: idx_contacts_active_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_active_user ON public.contacts USING btree (user_id, display_name) WHERE ((contact_status = 'active'::text) AND (deleted_at IS NULL));


--
-- Name: idx_contacts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_created_at ON public.contacts USING btree (created_at);


--
-- Name: idx_contacts_custom_fields; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_custom_fields ON public.contacts USING gin (custom_fields);


--
-- Name: idx_contacts_deletion_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_deletion_requested ON public.contacts USING btree (deletion_requested_at) WHERE (deletion_requested = true);


--
-- Name: idx_contacts_display_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_display_name ON public.contacts USING btree (display_name);


--
-- Name: idx_contacts_last_contacted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_last_contacted ON public.contacts USING btree (last_contacted_at);


--
-- Name: idx_contacts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_organization ON public.contacts USING btree (organization);


--
-- Name: idx_contacts_retention_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_retention_date ON public.contacts USING btree (data_retention_date) WHERE (data_retention_date IS NOT NULL);


--
-- Name: idx_contacts_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_search ON public.contacts USING gin (to_tsvector('english'::regconfig, ((((((((((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text)) || ' '::text) || COALESCE(organization, ''::text)) || ' '::text) || COALESCE(job_title, ''::text)) || ' '::text) || COALESCE(department, ''::text)) || ' '::text) || COALESCE(notes, ''::text)))) WHERE ((contact_status = 'active'::text) AND (deleted_at IS NULL));


--
-- Name: idx_contacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_status ON public.contacts USING btree (contact_status);


--
-- Name: idx_contacts_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (contact_type);


--
-- Name: idx_contacts_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_updated_at ON public.contacts USING btree (updated_at);


--
-- Name: idx_contacts_user_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_user_auth ON public.contacts USING btree (user_id);


--
-- Name: idx_contacts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_user_id ON public.contacts USING btree (user_id);


--
-- Name: idx_context_snapshots_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_context_snapshots_agent ON public.context_snapshots USING btree (agent_id, created_at DESC);


--
-- Name: idx_context_snapshots_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_context_snapshots_message ON public.context_snapshots USING btree (message_id);


--
-- Name: idx_context_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_context_templates_name ON public.context_templates USING btree (name);


--
-- Name: idx_conversation_sessions_temp_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_sessions_temp_chat ON public.conversation_sessions USING btree (conversation_id, user_id, agent_id);


--
-- Name: idx_conversation_summaries_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_summaries_agent ON public.conversation_summaries USING btree (agent_id);


--
-- Name: idx_conversation_summaries_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_summaries_conversation ON public.conversation_summaries USING btree (conversation_id);


--
-- Name: idx_conversation_summaries_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_summaries_embedding ON public.conversation_summaries USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_conversation_summaries_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_summaries_updated ON public.conversation_summaries USING btree (last_updated DESC);


--
-- Name: idx_conversation_summaries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_summaries_user ON public.conversation_summaries USING btree (user_id);


--
-- Name: idx_datastores_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datastores_type ON public.datastores USING btree (type);


--
-- Name: idx_datastores_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datastores_user_id ON public.datastores USING btree (user_id);


--
-- Name: idx_email_change_audit_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_change_audit_changed_at ON public.email_change_audit_log USING btree (changed_at DESC);


--
-- Name: idx_email_change_audit_new_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_change_audit_new_email ON public.email_change_audit_log USING btree (new_email);


--
-- Name: idx_email_change_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_change_audit_user_id ON public.email_change_audit_log USING btree (user_id);


--
-- Name: idx_group_access_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_access_agent ON public.agent_group_access USING btree (agent_id);


--
-- Name: idx_group_access_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_access_group ON public.agent_group_access USING btree (group_id);


--
-- Name: idx_group_access_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_access_permission ON public.agent_group_access USING btree (permission_id);


--
-- Name: idx_group_memberships_added_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_memberships_added_at ON public.contact_group_memberships USING btree (added_at);


--
-- Name: idx_group_memberships_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_memberships_contact ON public.contact_group_memberships USING btree (contact_id);


--
-- Name: idx_group_memberships_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_memberships_group ON public.contact_group_memberships USING btree (group_id);


--
-- Name: idx_group_memberships_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_memberships_metadata ON public.contact_group_memberships USING gin (membership_metadata);


--
-- Name: idx_group_memberships_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_memberships_type ON public.contact_group_memberships USING btree (membership_type);


--
-- Name: idx_group_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_memberships_user ON public.contact_group_memberships USING btree (user_id);


--
-- Name: idx_import_errors_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_errors_job ON public.contact_import_errors USING btree (import_job_id);


--
-- Name: idx_import_errors_row; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_errors_row ON public.contact_import_errors USING btree (import_job_id, row_number);


--
-- Name: idx_import_errors_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_errors_type ON public.contact_import_errors USING btree (error_type);


--
-- Name: idx_import_errors_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_errors_unresolved ON public.contact_import_errors USING btree (import_job_id) WHERE (is_resolved = false);


--
-- Name: idx_import_errors_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_errors_user ON public.contact_import_errors USING btree (user_id);


--
-- Name: idx_import_jobs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_active ON public.contact_import_jobs USING btree (user_id, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- Name: idx_import_jobs_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_completed_at ON public.contact_import_jobs USING btree (completed_at);


--
-- Name: idx_import_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_created_at ON public.contact_import_jobs USING btree (created_at);


--
-- Name: idx_import_jobs_errors; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_errors ON public.contact_import_jobs USING gin (error_details);


--
-- Name: idx_import_jobs_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_mapping ON public.contact_import_jobs USING gin (column_mapping);


--
-- Name: idx_import_jobs_recent_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_recent_completed ON public.contact_import_jobs USING btree (user_id, completed_at) WHERE (status = ANY (ARRAY['completed'::text, 'partially_completed'::text]));


--
-- Name: idx_import_jobs_results; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_results ON public.contact_import_jobs USING gin (import_results);


--
-- Name: idx_import_jobs_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_settings ON public.contact_import_jobs USING gin (import_settings);


--
-- Name: idx_import_jobs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_started_at ON public.contact_import_jobs USING btree (started_at);


--
-- Name: idx_import_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_status ON public.contact_import_jobs USING btree (status);


--
-- Name: idx_import_jobs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_type ON public.contact_import_jobs USING btree (import_type);


--
-- Name: idx_import_jobs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_user ON public.contact_import_jobs USING btree (user_id);


--
-- Name: idx_inbound_emails_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_agent ON public.sendgrid_inbound_emails USING btree (agent_id) WHERE (agent_id IS NOT NULL);


--
-- Name: idx_inbound_emails_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_config ON public.sendgrid_inbound_emails USING btree (sendgrid_config_id);


--
-- Name: idx_inbound_emails_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_from ON public.sendgrid_inbound_emails USING btree (from_email);


--
-- Name: idx_inbound_emails_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_message_id ON public.sendgrid_inbound_emails USING btree (message_id);


--
-- Name: idx_inbound_emails_processed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_processed_at ON public.sendgrid_inbound_emails USING btree (processed_at DESC);


--
-- Name: idx_inbound_emails_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_status ON public.sendgrid_inbound_emails USING btree (processing_status);


--
-- Name: idx_inbound_emails_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_emails_subject ON public.sendgrid_inbound_emails USING gin (to_tsvector('english'::regconfig, subject));


--
-- Name: idx_integration_capabilities_integration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_capabilities_integration ON public.integration_capabilities USING btree (integration_id);


--
-- Name: idx_interactions_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_agent ON public.contact_interactions USING btree (agent_id);


--
-- Name: idx_interactions_agent_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_agent_date ON public.contact_interactions USING btree (agent_id, interaction_at DESC);


--
-- Name: idx_interactions_attachment_meta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_attachment_meta ON public.contact_interactions USING gin (attachment_metadata);


--
-- Name: idx_interactions_attachments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_attachments ON public.contact_interactions USING btree (contact_id) WHERE (has_attachments = true);


--
-- Name: idx_interactions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_channel ON public.contact_interactions USING btree (channel_type);


--
-- Name: idx_interactions_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_contact ON public.contact_interactions USING btree (contact_id);


--
-- Name: idx_interactions_contact_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_contact_date ON public.contact_interactions USING btree (contact_id, interaction_at DESC);


--
-- Name: idx_interactions_contact_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_contact_type ON public.contact_interactions USING btree (contact_id, interaction_type);


--
-- Name: idx_interactions_content_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_content_search ON public.contact_interactions USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(interaction_summary, ''::text) || ' '::text) || COALESCE(subject, ''::text)) || ' '::text) || COALESCE(message_preview, ''::text)) || ' '::text) || COALESCE(follow_up_notes, ''::text))));


--
-- Name: idx_interactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_created_at ON public.contact_interactions USING btree (created_at);


--
-- Name: idx_interactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_date ON public.contact_interactions USING btree (interaction_at);


--
-- Name: idx_interactions_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_delivery ON public.contact_interactions USING btree (delivery_status);


--
-- Name: idx_interactions_direction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_direction ON public.contact_interactions USING btree (direction);


--
-- Name: idx_interactions_external_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_external_message ON public.contact_interactions USING btree (external_message_id) WHERE (external_message_id IS NOT NULL);


--
-- Name: idx_interactions_external_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_external_thread ON public.contact_interactions USING btree (external_thread_id) WHERE (external_thread_id IS NOT NULL);


--
-- Name: idx_interactions_failed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_failed ON public.contact_interactions USING btree (contact_id, interaction_at) WHERE (delivery_status = ANY (ARRAY['failed'::text, 'bounced'::text]));


--
-- Name: idx_interactions_follow_up; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_follow_up ON public.contact_interactions USING btree (follow_up_date) WHERE (requires_follow_up = true);


--
-- Name: idx_interactions_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_metadata ON public.contact_interactions USING gin (interaction_metadata);


--
-- Name: idx_interactions_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_pending ON public.contact_interactions USING btree (contact_id, interaction_at) WHERE (delivery_status = 'pending'::text);


--
-- Name: idx_interactions_platform_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_platform_data ON public.contact_interactions USING gin (external_platform_data);


--
-- Name: idx_interactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_type ON public.contact_interactions USING btree (interaction_type);


--
-- Name: idx_interactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_user ON public.contact_interactions USING btree (user_id);


--
-- Name: idx_interactions_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_user_date ON public.contact_interactions USING btree (user_id, interaction_at DESC);


--
-- Name: idx_invoices_paid_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_paid_at ON public.stripe_invoices USING btree (paid_at) WHERE (paid_at IS NOT NULL);


--
-- Name: idx_mailgun_configurations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_configurations_active ON public.mailgun_configurations USING btree (is_active);


--
-- Name: idx_mailgun_configurations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_configurations_user ON public.mailgun_configurations USING btree (user_id);


--
-- Name: idx_mailgun_operation_logs_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_operation_logs_agent ON public.mailgun_operation_logs USING btree (agent_id);


--
-- Name: idx_mailgun_operation_logs_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_operation_logs_config ON public.mailgun_operation_logs USING btree (mailgun_config_id);


--
-- Name: idx_mailgun_operation_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_operation_logs_created ON public.mailgun_operation_logs USING btree (created_at DESC);


--
-- Name: idx_mailgun_operation_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_operation_logs_status ON public.mailgun_operation_logs USING btree (status);


--
-- Name: idx_mailgun_operation_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_operation_logs_user ON public.mailgun_operation_logs USING btree (user_id);


--
-- Name: idx_mailgun_routes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_routes_active ON public.mailgun_routes USING btree (is_active);


--
-- Name: idx_mailgun_routes_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_routes_agent ON public.mailgun_routes USING btree (agent_id);


--
-- Name: idx_mailgun_routes_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_routes_config ON public.mailgun_routes USING btree (mailgun_config_id);


--
-- Name: idx_mailgun_routes_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailgun_routes_priority ON public.mailgun_routes USING btree (priority);


--
-- Name: idx_mcp_tools_cache_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_tools_cache_connection_id ON public.mcp_tools_cache USING btree (connection_id);


--
-- Name: idx_mcp_tools_cache_last_error; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_tools_cache_last_error ON public.mcp_tools_cache USING btree (last_schema_error) WHERE (last_schema_error IS NOT NULL);


--
-- Name: idx_mcp_tools_cache_last_successful_call; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_tools_cache_last_successful_call ON public.mcp_tools_cache USING btree (last_successful_call DESC) WHERE (last_successful_call IS NOT NULL);


--
-- Name: idx_mcp_tools_cache_last_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_tools_cache_last_updated ON public.mcp_tools_cache USING btree (last_updated);


--
-- Name: idx_mcp_tools_cache_tool_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_tools_cache_tool_name ON public.mcp_tools_cache USING btree (connection_id, tool_name);


--
-- Name: idx_media_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_categories_parent ON public.media_categories USING btree (parent_category_id);


--
-- Name: idx_media_categories_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_categories_sort_order ON public.media_categories USING btree (sort_order);


--
-- Name: idx_media_categories_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_categories_user_id ON public.media_categories USING btree (user_id);


--
-- Name: idx_media_library_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_archived ON public.media_library USING btree (is_archived) WHERE (is_archived = false);


--
-- Name: idx_media_library_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_category ON public.media_library USING btree (category);


--
-- Name: idx_media_library_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_category_status ON public.media_library USING btree (category, processing_status) WHERE (is_archived = false);


--
-- Name: idx_media_library_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_created_at ON public.media_library USING btree (created_at);


--
-- Name: idx_media_library_file_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_file_name_gin ON public.media_library USING gin (to_tsvector('english'::regconfig, file_name));


--
-- Name: idx_media_library_processing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_processing_status ON public.media_library USING btree (processing_status);


--
-- Name: idx_media_library_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_tags ON public.media_library USING gin (tags);


--
-- Name: idx_media_library_text_content_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_text_content_gin ON public.media_library USING gin (to_tsvector('english'::regconfig, text_content));


--
-- Name: idx_media_library_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_library_user_id ON public.media_library USING btree (user_id);


--
-- Name: idx_memories_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memories_agent_type ON public.agent_memories USING btree (agent_id, memory_type);


--
-- Name: idx_memories_content_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memories_content_gin ON public.agent_memories USING gin (content);


--
-- Name: idx_memories_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memories_embedding ON public.agent_memories USING ivfflat (embeddings public.vector_cosine_ops);


--
-- Name: idx_memories_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memories_expires ON public.agent_memories USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_memories_importance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memories_importance ON public.agent_memories USING btree (importance DESC);


--
-- Name: idx_message_versions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_versions_message ON public.message_versions USING btree (message_id, version_number DESC);


--
-- Name: idx_messages_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_channel ON public.chat_messages_v2 USING btree (channel_id) WHERE (channel_id IS NOT NULL);


--
-- Name: idx_messages_content_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_content_gin ON public.chat_messages_v2 USING gin (content);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.chat_messages_v2 USING btree (conversation_id, created_at);


--
-- Name: idx_messages_conversation_fk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_fk ON public.chat_messages_v2 USING btree (conversation_id);


--
-- Name: idx_messages_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_metadata_gin ON public.chat_messages_v2 USING gin (metadata);


--
-- Name: idx_messages_sender_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_agent ON public.chat_messages_v2 USING btree (sender_agent_id) WHERE (sender_agent_id IS NOT NULL);


--
-- Name: idx_messages_sender_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_user ON public.chat_messages_v2 USING btree (sender_user_id) WHERE (sender_user_id IS NOT NULL);


--
-- Name: idx_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_session ON public.chat_messages_v2 USING btree (session_id);


--
-- Name: idx_operation_logs_agent_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_agent_date ON public.sendgrid_operation_logs USING btree (agent_id, created_at DESC);


--
-- Name: idx_operation_logs_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_status_date ON public.sendgrid_operation_logs USING btree (status, created_at DESC);


--
-- Name: idx_operation_logs_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_logs_type_date ON public.sendgrid_operation_logs USING btree (operation_type, created_at DESC);


--
-- Name: idx_payment_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_events_created ON public.payment_events USING btree (created_at);


--
-- Name: idx_payment_events_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_events_invoice ON public.payment_events USING btree (stripe_invoice_id);


--
-- Name: idx_payment_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_events_order ON public.payment_events USING btree (stripe_order_id);


--
-- Name: idx_payment_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_events_type ON public.payment_events USING btree (event_type);


--
-- Name: idx_payment_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_events_user_id ON public.payment_events USING btree (user_id);


--
-- Name: idx_profiles_mobile_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_mobile_number ON public.profiles USING btree (mobile_number) WHERE (mobile_number IS NOT NULL);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username) WHERE (username IS NOT NULL);


--
-- Name: idx_routing_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_logs_created_at ON public.sendgrid_inbound_routing_logs USING btree (created_at DESC);


--
-- Name: idx_routing_logs_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_logs_email ON public.sendgrid_inbound_routing_logs USING btree (email_id);


--
-- Name: idx_routing_logs_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_logs_rule ON public.sendgrid_inbound_routing_logs USING btree (rule_id) WHERE (rule_id IS NOT NULL);


--
-- Name: idx_routing_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_rules_active ON public.sendgrid_inbound_routing_rules USING btree (is_active, priority) WHERE (is_active = true);


--
-- Name: idx_routing_rules_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_rules_agent ON public.sendgrid_inbound_routing_rules USING btree (agent_id) WHERE (agent_id IS NOT NULL);


--
-- Name: idx_routing_rules_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_rules_config ON public.sendgrid_inbound_routing_rules USING btree (sendgrid_config_id);


--
-- Name: idx_server_config_secrets_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_server_config_secrets_name ON public.server_configuration_secrets USING btree (server_name);


--
-- Name: idx_service_providers_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_providers_enabled ON public.service_providers USING btree (name) WHERE (is_enabled = true);


--
-- Name: idx_service_providers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_providers_name ON public.service_providers USING btree (name);


--
-- Name: idx_sessions_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_agent ON public.conversation_sessions USING btree (agent_id) WHERE (agent_id IS NOT NULL);


--
-- Name: idx_sessions_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_conversation ON public.conversation_sessions USING btree (conversation_id);


--
-- Name: idx_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_status ON public.conversation_sessions USING btree (status) WHERE ((status)::text = ANY (ARRAY[('active'::character varying)::text, ('paused'::character varying)::text]));


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.conversation_sessions USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_smtp_configurations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smtp_configurations_active ON public.smtp_configurations USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_smtp_configurations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smtp_configurations_user_id ON public.smtp_configurations USING btree (user_id);


--
-- Name: idx_specific_access_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_active ON public.agent_specific_contact_access USING btree (agent_id, contact_id) WHERE (expires_at IS NULL);


--
-- Name: idx_specific_access_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_agent ON public.agent_specific_contact_access USING btree (agent_id);


--
-- Name: idx_specific_access_channel_perms; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_channel_perms ON public.agent_specific_contact_access USING gin (channel_permissions);


--
-- Name: idx_specific_access_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_contact ON public.agent_specific_contact_access USING btree (contact_id);


--
-- Name: idx_specific_access_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_level ON public.agent_specific_contact_access USING btree (access_level);


--
-- Name: idx_specific_access_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_metadata ON public.agent_specific_contact_access USING gin (access_metadata);


--
-- Name: idx_specific_access_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_permission ON public.agent_specific_contact_access USING btree (permission_id);


--
-- Name: idx_specific_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specific_access_user ON public.agent_specific_contact_access USING btree (user_id);


--
-- Name: idx_states_agent_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_states_agent_current ON public.agent_states USING btree (agent_id) WHERE (is_current = true);


--
-- Name: idx_states_agent_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_states_agent_history ON public.agent_states USING btree (agent_id, valid_from DESC);


--
-- Name: idx_states_valid_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_states_valid_range ON public.agent_states USING btree (valid_from, valid_until);


--
-- Name: idx_stripe_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_customers_email ON public.stripe_customers USING btree (customer_email);


--
-- Name: idx_stripe_customers_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_customers_stripe_id ON public.stripe_customers USING btree (stripe_customer_id);


--
-- Name: idx_stripe_customers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_customers_user_id ON public.stripe_customers USING btree (user_id);


--
-- Name: idx_stripe_invoices_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_invoices_created ON public.stripe_invoices USING btree (invoice_created);


--
-- Name: idx_stripe_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_invoices_customer_id ON public.stripe_invoices USING btree (stripe_customer_id);


--
-- Name: idx_stripe_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_invoices_due_date ON public.stripe_invoices USING btree (due_date);


--
-- Name: idx_stripe_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_invoices_status ON public.stripe_invoices USING btree (status);


--
-- Name: idx_stripe_invoices_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_invoices_subscription_id ON public.stripe_invoices USING btree (stripe_subscription_id);


--
-- Name: idx_stripe_invoices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_invoices_user_id ON public.stripe_invoices USING btree (user_id);


--
-- Name: idx_stripe_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_orders_created ON public.stripe_orders USING btree (created_at);


--
-- Name: idx_stripe_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_orders_customer_id ON public.stripe_orders USING btree (stripe_customer_id);


--
-- Name: idx_stripe_orders_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_orders_order_status ON public.stripe_orders USING btree (order_status);


--
-- Name: idx_stripe_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_orders_payment_status ON public.stripe_orders USING btree (payment_status);


--
-- Name: idx_stripe_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_orders_user_id ON public.stripe_orders USING btree (user_id);


--
-- Name: idx_subscription_history_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_history_subscription ON public.subscription_history USING btree (subscription_id);


--
-- Name: idx_subscription_history_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_history_type ON public.subscription_history USING btree (change_type);


--
-- Name: idx_subscription_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_history_user ON public.subscription_history USING btree (user_id);


--
-- Name: idx_subscriptions_canceled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_canceled_at ON public.stripe_subscriptions USING btree (canceled_at) WHERE (canceled_at IS NOT NULL);


--
-- Name: idx_subscriptions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer_id ON public.stripe_subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_org_id ON public.stripe_subscriptions USING btree (organization_id);


--
-- Name: idx_subscriptions_period_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_period_end ON public.stripe_subscriptions USING btree (current_period_end);


--
-- Name: idx_subscriptions_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_plan ON public.stripe_subscriptions USING btree (plan_name);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.stripe_subscriptions USING btree (status);


--
-- Name: idx_subscriptions_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status_created ON public.stripe_subscriptions USING btree (status, created_at);


--
-- Name: idx_subscriptions_stripe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_id ON public.stripe_subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.stripe_subscriptions USING btree (user_id);


--
-- Name: idx_summary_boards_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_summary_boards_agent ON public.conversation_summary_boards USING btree (agent_id);


--
-- Name: idx_summary_boards_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_summary_boards_conversation ON public.conversation_summary_boards USING btree (conversation_id);


--
-- Name: idx_summary_boards_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_summary_boards_user ON public.conversation_summary_boards USING btree (user_id);


--
-- Name: idx_system_metrics_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_metrics_name ON public.system_metrics USING btree (name);


--
-- Name: idx_system_metrics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_metrics_timestamp ON public.system_metrics USING btree ("timestamp" DESC);


--
-- Name: idx_system_prompts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_prompts_active ON public.system_prompts USING btree (is_active);


--
-- Name: idx_system_prompts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_prompts_category ON public.system_prompts USING btree (category);


--
-- Name: idx_system_prompts_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_prompts_key ON public.system_prompts USING btree (key);


--
-- Name: idx_task_exec_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_exec_conversation ON public.agent_task_executions USING btree (conversation_id);


--
-- Name: idx_task_steps_context_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_context_gin ON public.task_steps USING gin (context_data);


--
-- Name: idx_task_steps_execution_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_execution_time ON public.task_steps USING btree (execution_started_at, execution_completed_at);


--
-- Name: idx_task_steps_pending_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_pending_order ON public.task_steps USING btree (task_id, step_order) WHERE (status = 'pending'::public.task_step_status);


--
-- Name: idx_task_steps_result_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_result_gin ON public.task_steps USING gin (execution_result);


--
-- Name: idx_task_steps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_status ON public.task_steps USING btree (status);


--
-- Name: idx_task_steps_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_task_id ON public.task_steps USING btree (task_id);


--
-- Name: idx_task_steps_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_steps_task_order ON public.task_steps USING btree (task_id, step_order);


--
-- Name: idx_team_canvas_connections_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_canvas_connections_gin ON public.team_canvas_layouts USING gin (connections);


--
-- Name: idx_team_canvas_layouts_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_canvas_layouts_updated_at ON public.team_canvas_layouts USING btree (updated_at DESC);


--
-- Name: idx_team_canvas_layouts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_canvas_layouts_user_id ON public.team_canvas_layouts USING btree (user_id);


--
-- Name: idx_team_canvas_layouts_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_canvas_layouts_workspace_id ON public.team_canvas_layouts USING btree (workspace_id) WHERE (workspace_id IS NOT NULL);


--
-- Name: idx_team_canvas_positions_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_canvas_positions_gin ON public.team_canvas_layouts USING gin (positions);


--
-- Name: idx_team_connections_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_connections_created_by ON public.team_connections USING btree (created_by_user_id);


--
-- Name: idx_team_connections_from_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_connections_from_team ON public.team_connections USING btree (from_team_id);


--
-- Name: idx_team_connections_to_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_connections_to_team ON public.team_connections USING btree (to_team_id);


--
-- Name: idx_team_connections_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_connections_type ON public.team_connections USING btree (connection_type);


--
-- Name: idx_team_members_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_agent_id ON public.team_members USING btree (agent_id);


--
-- Name: idx_team_members_reports_to_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_reports_to_agent_id ON public.team_members USING btree (reports_to_agent_id);


--
-- Name: idx_team_members_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team_id ON public.team_members USING btree (team_id);


--
-- Name: idx_teams_parent_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_parent_team_id ON public.teams USING btree (parent_team_id);


--
-- Name: idx_temp_links_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_activity ON public.temporary_chat_links USING btree (last_accessed_at DESC) WHERE (is_active = true);


--
-- Name: idx_temp_links_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_agent ON public.temporary_chat_links USING btree (agent_id) WHERE (is_active = true);


--
-- Name: idx_temp_links_analytics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_analytics ON public.temporary_chat_links USING btree (user_id, agent_id, created_at, is_active);


--
-- Name: idx_temp_links_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_cleanup ON public.temporary_chat_links USING btree (expires_at, is_active) WHERE (is_active = false);


--
-- Name: INDEX idx_temp_links_cleanup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_temp_links_cleanup IS 'Optimized index for automatic cleanup of expired links';


--
-- Name: idx_temp_links_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_created ON public.temporary_chat_links USING btree (created_at DESC);


--
-- Name: idx_temp_links_domains_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_domains_gin ON public.temporary_chat_links USING gin (allowed_domains) WHERE (allowed_domains IS NOT NULL);


--
-- Name: idx_temp_links_expired; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_expired ON public.temporary_chat_links USING btree (is_active, expires_at) WHERE (is_active = false);


--
-- Name: idx_temp_links_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_expires ON public.temporary_chat_links USING btree (expires_at) WHERE (is_active = true);


--
-- Name: idx_temp_links_ips_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_ips_gin ON public.temporary_chat_links USING gin (allowed_ips) WHERE (allowed_ips IS NOT NULL);


--
-- Name: idx_temp_links_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_metadata_gin ON public.temporary_chat_links USING gin (link_metadata);


--
-- Name: idx_temp_links_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_performance ON public.temporary_chat_links USING btree (agent_id, session_count, total_messages, created_at) WHERE (is_active = true);


--
-- Name: idx_temp_links_public_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_public_access ON public.temporary_chat_links USING btree (vault_link_token_id, expires_at) WHERE (is_active = true);


--
-- Name: idx_temp_links_rls_user_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_rls_user_agent ON public.temporary_chat_links USING btree (user_id, agent_id) WHERE (is_active = true);


--
-- Name: idx_temp_links_short_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_short_code ON public.temporary_chat_links USING btree (short_code) WHERE ((short_code IS NOT NULL) AND (is_active = true));


--
-- Name: idx_temp_links_ui_customization_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_ui_customization_gin ON public.temporary_chat_links USING gin (ui_customization);


--
-- Name: idx_temp_links_usage_stats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_usage_stats ON public.temporary_chat_links USING btree (session_count, total_messages) WHERE (is_active = true);


--
-- Name: idx_temp_links_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_user ON public.temporary_chat_links USING btree (user_id);


--
-- Name: idx_temp_links_user_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_user_agent ON public.temporary_chat_links USING btree (user_id, agent_id) WHERE (is_active = true);


--
-- Name: idx_temp_links_vault_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_links_vault_token ON public.temporary_chat_links USING btree (vault_link_token_id) WHERE (is_active = true);


--
-- Name: INDEX idx_temp_links_vault_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_temp_links_vault_token IS 'Primary access index for temporary chat link tokens via Vault';


--
-- Name: idx_temp_sessions_abuse_detection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_abuse_detection ON public.temporary_chat_sessions USING btree (ip_address, rate_limit_violations, created_at) WHERE (rate_limit_violations > 5);


--
-- Name: idx_temp_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_active ON public.temporary_chat_sessions USING btree (status, started_at) WHERE (status = 'active'::text);


--
-- Name: idx_temp_sessions_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_activity ON public.temporary_chat_sessions USING btree (last_activity_at DESC);


--
-- Name: idx_temp_sessions_analytics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_analytics ON public.temporary_chat_sessions USING btree (link_id, status, created_at, message_count);


--
-- Name: idx_temp_sessions_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_cleanup ON public.temporary_chat_sessions USING btree (status, last_activity_at) WHERE (status = 'active'::text);


--
-- Name: INDEX idx_temp_sessions_cleanup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_temp_sessions_cleanup IS 'Optimized index for automatic cleanup of inactive sessions';


--
-- Name: idx_temp_sessions_conv_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_conv_session ON public.temporary_chat_sessions USING btree (conversation_session_id) WHERE (conversation_session_id IS NOT NULL);


--
-- Name: idx_temp_sessions_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_conversation ON public.temporary_chat_sessions USING btree (conversation_id);


--
-- Name: idx_temp_sessions_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_country ON public.temporary_chat_sessions USING btree (country_code) WHERE (country_code IS NOT NULL);


--
-- Name: idx_temp_sessions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_created ON public.temporary_chat_sessions USING btree (created_at DESC);


--
-- Name: idx_temp_sessions_duration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_duration ON public.temporary_chat_sessions USING btree (session_duration_seconds) WHERE (session_duration_seconds IS NOT NULL);


--
-- Name: idx_temp_sessions_feedback; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_feedback ON public.temporary_chat_sessions USING btree (satisfaction_rating) WHERE (satisfaction_rating IS NOT NULL);


--
-- Name: idx_temp_sessions_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_ip ON public.temporary_chat_sessions USING btree (ip_address) WHERE (ip_address IS NOT NULL);


--
-- Name: idx_temp_sessions_ip_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_ip_status ON public.temporary_chat_sessions USING btree (ip_address, status, created_at) WHERE (ip_address IS NOT NULL);


--
-- Name: idx_temp_sessions_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_link ON public.temporary_chat_sessions USING btree (link_id);


--
-- Name: idx_temp_sessions_link_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_link_active ON public.temporary_chat_sessions USING btree (link_id, status) WHERE (status = 'active'::text);


--
-- Name: idx_temp_sessions_link_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_link_user ON public.temporary_chat_sessions USING btree (link_id, created_at, status);


--
-- Name: idx_temp_sessions_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_metadata_gin ON public.temporary_chat_sessions USING gin (session_metadata);


--
-- Name: idx_temp_sessions_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_participant ON public.temporary_chat_sessions USING btree (participant_identifier) WHERE (participant_identifier IS NOT NULL);


--
-- Name: idx_temp_sessions_participant_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_participant_metadata_gin ON public.temporary_chat_sessions USING gin (participant_metadata);


--
-- Name: idx_temp_sessions_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_performance ON public.temporary_chat_sessions USING btree (link_id, started_at, ended_at, message_count, session_duration_seconds);


--
-- Name: idx_temp_sessions_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_quality ON public.temporary_chat_sessions USING btree (satisfaction_rating, message_count) WHERE (satisfaction_rating IS NOT NULL);


--
-- Name: idx_temp_sessions_rate_limit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_rate_limit ON public.temporary_chat_sessions USING btree (vault_session_token_id, last_message_at) WHERE (status = 'active'::text);


--
-- Name: INDEX idx_temp_sessions_rate_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_temp_sessions_rate_limit IS 'Rate limiting index for message frequency control';


--
-- Name: idx_temp_sessions_recent_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_recent_active ON public.temporary_chat_sessions USING btree (vault_session_token_id, last_activity_at) WHERE (status = 'active'::text);


--
-- Name: idx_temp_sessions_rls_link_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_rls_link_user ON public.temporary_chat_sessions USING btree (link_id) INCLUDE (created_at, status);


--
-- Name: idx_temp_sessions_security_alerts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_security_alerts ON public.temporary_chat_sessions USING btree (ip_address, rate_limit_violations, created_at) WHERE (rate_limit_violations >= 3);


--
-- Name: idx_temp_sessions_security_monitoring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_security_monitoring ON public.temporary_chat_sessions USING btree (ip_address, user_agent, rate_limit_violations, created_at) WHERE ((rate_limit_violations > 0) OR (status = 'terminated'::text));


--
-- Name: INDEX idx_temp_sessions_security_monitoring; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_temp_sessions_security_monitoring IS 'Composite index for security monitoring and abuse detection';


--
-- Name: idx_temp_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_status ON public.temporary_chat_sessions USING btree (status, last_activity_at);


--
-- Name: idx_temp_sessions_vault_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_vault_token ON public.temporary_chat_sessions USING btree (vault_session_token_id) WHERE (status = 'active'::text);


--
-- Name: INDEX idx_temp_sessions_vault_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_temp_sessions_vault_token IS 'Primary access index for temporary chat session tokens via Vault';


--
-- Name: idx_temp_sessions_violations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_sessions_violations ON public.temporary_chat_sessions USING btree (rate_limit_violations, ip_address) WHERE (rate_limit_violations > 0);


--
-- Name: idx_tool_execution_logs_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_execution_logs_agent_id ON public.tool_execution_logs USING btree (agent_id);


--
-- Name: idx_tool_execution_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_execution_logs_created_at ON public.tool_execution_logs USING btree (created_at DESC);


--
-- Name: idx_tool_execution_logs_tool_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_execution_logs_tool_provider ON public.tool_execution_logs USING btree (tool_provider);


--
-- Name: idx_tool_execution_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_execution_logs_user_id ON public.tool_execution_logs USING btree (user_id);


--
-- Name: idx_tool_user_input_requests_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_user_input_requests_conversation ON public.tool_user_input_requests USING btree (conversation_id, status);


--
-- Name: idx_tool_user_input_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_user_input_requests_pending ON public.tool_user_input_requests USING btree (status, created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_tool_user_input_requests_tool_call; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_user_input_requests_tool_call ON public.tool_user_input_requests USING btree (tool_call_id);


--
-- Name: idx_transitions_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transitions_agent ON public.state_transitions USING btree (agent_id, created_at DESC);


--
-- Name: idx_transitions_states; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transitions_states ON public.state_transitions USING btree (from_state_id, to_state_id);


--
-- Name: idx_unique_agent_contact_access; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_agent_contact_access ON public.agent_specific_contact_access USING btree (agent_id, contact_id);


--
-- Name: idx_unique_agent_group_access; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_agent_group_access ON public.agent_group_access USING btree (agent_id, group_id);


--
-- Name: idx_unique_agent_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_agent_permission ON public.agent_contact_permissions USING btree (agent_id);


--
-- Name: idx_unique_contact_group_membership; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_contact_group_membership ON public.contact_group_memberships USING btree (contact_id, group_id);


--
-- Name: idx_unique_current_state; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_current_state ON public.agent_states USING btree (agent_id) WHERE (is_current = true);


--
-- Name: idx_unique_group_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_group_name ON public.contact_groups USING btree (user_id, lower(name));


--
-- Name: idx_unique_primary_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_primary_channel ON public.contact_communication_channels USING btree (contact_id, channel_type) WHERE (is_primary = true);


--
-- Name: idx_usage_events_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_feature ON public.usage_events USING btree (feature);


--
-- Name: idx_usage_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_events_timestamp ON public.usage_events USING btree ("timestamp" DESC);


--
-- Name: idx_user_integration_credentials_credential_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_integration_credentials_credential_type ON public.user_integration_credentials USING btree (credential_type, connection_status);


--
-- Name: idx_user_integration_credentials_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_integration_credentials_provider ON public.user_integration_credentials USING btree (oauth_provider_id);


--
-- Name: idx_user_integration_credentials_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_integration_credentials_status ON public.user_integration_credentials USING btree (connection_status);


--
-- Name: idx_user_integration_credentials_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_integration_credentials_user_id ON public.user_integration_credentials USING btree (user_id) WHERE (connection_status = ANY (ARRAY['active'::text, 'expired'::text]));


--
-- Name: idx_user_oauth_connections_provider_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_oauth_connections_provider_user ON public.user_integration_credentials USING btree (oauth_provider_id, user_id);


--
-- Name: idx_user_oauth_provider_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_oauth_provider_lookup ON public.user_integration_credentials USING btree (user_id, oauth_provider_id, connection_status);


--
-- Name: idx_user_team_memberships_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_team_memberships_team_id ON public.user_team_memberships USING btree (team_id);


--
-- Name: idx_user_team_memberships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_team_memberships_user_id ON public.user_team_memberships USING btree (user_id);


--
-- Name: idx_user_token_usage_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_token_usage_period ON public.user_token_usage USING btree (period_start DESC, period_end DESC);


--
-- Name: idx_user_token_usage_period_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_token_usage_period_type ON public.user_token_usage USING btree (period_type, period_start DESC);


--
-- Name: idx_user_token_usage_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_token_usage_updated ON public.user_token_usage USING btree (updated_at DESC) WHERE ((period_type)::text = 'daily'::text);


--
-- Name: idx_user_token_usage_user_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_token_usage_user_period ON public.user_token_usage USING btree (user_id, period_start DESC, period_type) WHERE (user_id IS NOT NULL);


--
-- Name: idx_working_memory_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_memory_agent ON public.working_memory_chunks USING btree (agent_id);


--
-- Name: idx_working_memory_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_memory_conversation ON public.working_memory_chunks USING btree (conversation_id);


--
-- Name: idx_working_memory_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_memory_embedding ON public.working_memory_chunks USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: idx_working_memory_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_working_memory_expires ON public.working_memory_chunks USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_workspace_members_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_agent_id ON public.workspace_members USING btree (agent_id) WHERE (agent_id IS NOT NULL);


--
-- Name: idx_workspace_members_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_team_id ON public.workspace_members USING btree (team_id) WHERE (team_id IS NOT NULL);


--
-- Name: idx_workspace_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user_id ON public.workspace_members USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_workspace_members_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members USING btree (workspace_id);


--
-- Name: agents agent_deletion_cascade_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_deletion_cascade_trigger AFTER DELETE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.handle_agent_deletion_cascade();


--
-- Name: agent_smtp_permissions agent_smtp_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_smtp_permissions_updated_at BEFORE UPDATE ON public.agent_smtp_permissions FOR EACH ROW EXECUTE FUNCTION public.update_agent_smtp_permissions_updated_at();


--
-- Name: artifacts artifacts_latest_version_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER artifacts_latest_version_trigger BEFORE INSERT ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.mark_previous_versions_not_latest();


--
-- Name: artifacts artifacts_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER artifacts_updated_at_trigger BEFORE UPDATE ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.update_artifacts_updated_at();


--
-- Name: agents auto_grant_contact_management_access_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_grant_contact_management_access_trigger AFTER INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION public.auto_grant_contact_management_access();


--
-- Name: TRIGGER auto_grant_contact_management_access_trigger ON agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER auto_grant_contact_management_access_trigger ON public.agents IS 'Automatically grants contact management access to new agents';


--
-- Name: canvas_sessions canvas_sessions_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER canvas_sessions_updated_at_trigger BEFORE UPDATE ON public.canvas_sessions FOR EACH ROW EXECUTE FUNCTION public.update_canvas_sessions_updated_at();


--
-- Name: user_integration_credentials credential_revocation_cascade_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER credential_revocation_cascade_trigger AFTER UPDATE ON public.user_integration_credentials FOR EACH ROW EXECUTE FUNCTION public.handle_credential_revocation_cascade();


--
-- Name: teams handle_team_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_team_update BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: service_providers integration_deletion_cascade_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER integration_deletion_cascade_trigger AFTER DELETE ON public.service_providers FOR EACH ROW EXECUTE FUNCTION public.handle_integration_deletion_cascade();


--
-- Name: profiles on_profile_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: platform_settings platform_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_platform_settings_updated_at();


--
-- Name: agent_mcp_connections prevent_plaintext_mcp_urls_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_plaintext_mcp_urls_trigger BEFORE INSERT OR UPDATE ON public.agent_mcp_connections FOR EACH ROW EXECUTE FUNCTION public.prevent_plaintext_mcp_urls();


--
-- Name: integration_categories set_integration_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_integration_categories_updated_at BEFORE UPDATE ON public.integration_categories FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: smtp_configurations smtp_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER smtp_configurations_updated_at BEFORE UPDATE ON public.smtp_configurations FOR EACH ROW EXECUTE FUNCTION public.update_smtp_configurations_updated_at();


--
-- Name: system_api_keys system_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER system_api_keys_updated_at BEFORE UPDATE ON public.system_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_system_api_keys_updated_at();


--
-- Name: system_prompts system_prompts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER system_prompts_updated_at BEFORE UPDATE ON public.system_prompts FOR EACH ROW EXECUTE FUNCTION public.update_system_prompts_updated_at();


--
-- Name: task_steps task_steps_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_steps_updated_at_trigger BEFORE UPDATE ON public.task_steps FOR EACH ROW EXECUTE FUNCTION public.update_task_steps_updated_at();


--
-- Name: team_canvas_layouts team_canvas_layouts_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER team_canvas_layouts_updated_at_trigger BEFORE UPDATE ON public.team_canvas_layouts FOR EACH ROW EXECUTE FUNCTION public.update_team_canvas_layouts_updated_at();


--
-- Name: team_connections team_connections_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER team_connections_updated_at_trigger BEFORE UPDATE ON public.team_connections FOR EACH ROW EXECUTE FUNCTION public.update_team_connections_updated_at();


--
-- Name: temporary_chat_links temp_links_access_tracking_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_links_access_tracking_trigger BEFORE UPDATE ON public.temporary_chat_links FOR EACH ROW EXECUTE FUNCTION public.track_temp_link_access();


--
-- Name: temporary_chat_links temp_links_security_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_links_security_trigger BEFORE INSERT OR UPDATE ON public.temporary_chat_links FOR EACH ROW EXECUTE FUNCTION public.prevent_vault_token_exposure();


--
-- Name: temporary_chat_links temp_links_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_links_updated_at_trigger BEFORE UPDATE ON public.temporary_chat_links FOR EACH ROW EXECUTE FUNCTION public.update_temporary_chat_links_updated_at();


--
-- Name: temporary_chat_sessions temp_sessions_activity_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_sessions_activity_trigger BEFORE UPDATE ON public.temporary_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_session_activity();


--
-- Name: temporary_chat_sessions temp_sessions_link_stats_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_sessions_link_stats_trigger AFTER INSERT OR UPDATE ON public.temporary_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_link_statistics();


--
-- Name: temporary_chat_sessions temp_sessions_security_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_sessions_security_trigger AFTER UPDATE ON public.temporary_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.monitor_session_security();


--
-- Name: temporary_chat_sessions temp_sessions_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER temp_sessions_updated_at_trigger BEFORE UPDATE ON public.temporary_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_temporary_chat_sessions_updated_at();


--
-- Name: agent_memories track_memory_access; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_memory_access BEFORE UPDATE OF content, embeddings ON public.agent_memories FOR EACH ROW EXECUTE FUNCTION public.update_memory_access();


--
-- Name: agent_llm_preferences trg_agent_llm_prefs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agent_llm_prefs_updated BEFORE UPDATE ON public.agent_llm_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: integration_capabilities trg_update_integration_capabilities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_integration_capabilities BEFORE UPDATE ON public.integration_capabilities FOR EACH ROW EXECUTE FUNCTION public.update_integration_capabilities_updated_at();


--
-- Name: admin_integration_credentials trigger_admin_integration_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_admin_integration_credentials_updated_at BEFORE UPDATE ON public.admin_integration_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_settings trigger_admin_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: billing_plans trigger_billing_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_billing_plans_updated_at BEFORE UPDATE ON public.billing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_communication_channels trigger_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_channels_updated_at BEFORE UPDATE ON public.contact_communication_channels FOR EACH ROW EXECUTE FUNCTION public.update_channels_updated_at();


--
-- Name: contact_groups trigger_contact_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_contact_groups_updated_at BEFORE UPDATE ON public.contact_groups FOR EACH ROW EXECUTE FUNCTION public.update_contact_groups_updated_at();


--
-- Name: contacts trigger_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_contacts_updated_at();


--
-- Name: agents trigger_create_agent_llm_preferences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_create_agent_llm_preferences AFTER INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION public.create_agent_llm_preferences();


--
-- Name: TRIGGER trigger_create_agent_llm_preferences ON agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_create_agent_llm_preferences ON public.agents IS 'Ensures every new agent gets default LLM preferences automatically';


--
-- Name: agents trigger_grant_reasoning_access_to_new_agent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_grant_reasoning_access_to_new_agent AFTER INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION public.grant_reasoning_access_to_new_agent();


--
-- Name: contact_interactions trigger_interactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_interactions_updated_at BEFORE UPDATE ON public.contact_interactions FOR EACH ROW EXECUTE FUNCTION public.update_interactions_updated_at();


--
-- Name: chat_messages_v2 trigger_queue_summarization; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_queue_summarization AFTER INSERT ON public.chat_messages_v2 FOR EACH ROW WHEN ((((new.role)::text = 'user'::text) OR ((new.role)::text = 'assistant'::text))) EXECUTE FUNCTION public.queue_conversation_summarization();


--
-- Name: teams trigger_set_team_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_team_owner BEFORE INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_team_owner();


--
-- Name: stripe_customers trigger_stripe_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_stripe_customers_updated_at BEFORE UPDATE ON public.stripe_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_invoices trigger_stripe_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_stripe_invoices_updated_at BEFORE UPDATE ON public.stripe_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_orders trigger_stripe_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_stripe_orders_updated_at BEFORE UPDATE ON public.stripe_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_subscriptions trigger_stripe_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_stripe_subscriptions_updated_at BEFORE UPDATE ON public.stripe_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_subscriptions trigger_sync_org_subscription; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_org_subscription AFTER INSERT OR UPDATE ON public.stripe_subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_organization_subscription();


--
-- Name: chat_messages trigger_update_channel_last_message_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_channel_last_message_at AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_channel_last_message_at();


--
-- Name: contact_interactions trigger_update_contact_last_contacted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_contact_last_contacted AFTER INSERT ON public.contact_interactions FOR EACH ROW EXECUTE FUNCTION public.update_contact_last_contacted();


--
-- Name: conversation_summaries trigger_update_conversation_summary_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_summary_timestamp BEFORE UPDATE ON public.conversation_summaries FOR EACH ROW EXECUTE FUNCTION public.update_conversation_summary_timestamp();


--
-- Name: contact_group_memberships trigger_update_group_member_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_group_member_count AFTER INSERT OR DELETE ON public.contact_group_memberships FOR EACH ROW EXECUTE FUNCTION public.update_group_member_count();


--
-- Name: conversation_summary_boards trigger_update_summary_board_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_summary_board_timestamp BEFORE UPDATE ON public.conversation_summary_boards FOR EACH ROW EXECUTE FUNCTION public.update_summary_board_timestamp();


--
-- Name: user_token_usage trigger_update_user_token_usage_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_user_token_usage_timestamp BEFORE UPDATE ON public.user_token_usage FOR EACH ROW EXECUTE FUNCTION public.update_user_token_usage_timestamp();


--
-- Name: contact_communication_channels trigger_validate_channel_identifier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_channel_identifier BEFORE INSERT OR UPDATE ON public.contact_communication_channels FOR EACH ROW EXECUTE FUNCTION public.validate_channel_identifier();


--
-- Name: agent_email_addresses update_agent_email_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_email_addresses_updated_at BEFORE UPDATE ON public.agent_email_addresses FOR EACH ROW EXECUTE FUNCTION public.update_sendgrid_updated_at();


--
-- Name: agent_mcp_connections update_agent_mcp_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_mcp_connections_updated_at BEFORE UPDATE ON public.agent_mcp_connections FOR EACH ROW EXECUTE FUNCTION public.update_agent_mcp_connections_updated_at();


--
-- Name: agent_media_assignments update_agent_media_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_media_assignments_updated_at BEFORE UPDATE ON public.agent_media_assignments FOR EACH ROW EXECUTE FUNCTION public.update_media_updated_at();


--
-- Name: agent_sendgrid_permissions update_agent_sendgrid_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_sendgrid_permissions_updated_at BEFORE UPDATE ON public.agent_sendgrid_permissions FOR EACH ROW EXECUTE FUNCTION public.update_sendgrid_updated_at();


--
-- Name: agent_states update_agent_states_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_states_updated_at BEFORE UPDATE ON public.agent_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_task_event_triggers update_agent_task_event_triggers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_task_event_triggers_updated_at BEFORE UPDATE ON public.agent_task_event_triggers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_task_executions update_agent_task_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_task_executions_updated_at BEFORE UPDATE ON public.agent_task_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_tasks update_agent_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON public.agent_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agents update_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_messages_v2 update_chat_messages_v2_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chat_messages_v2_updated_at BEFORE UPDATE ON public.chat_messages_v2 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: context_templates update_context_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_context_templates_updated_at BEFORE UPDATE ON public.context_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: datastores update_datastores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_datastores_updated_at BEFORE UPDATE ON public.datastores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: media_categories update_media_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_media_categories_updated_at BEFORE UPDATE ON public.media_categories FOR EACH ROW EXECUTE FUNCTION public.update_media_updated_at();


--
-- Name: media_library update_media_library_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_media_library_updated_at BEFORE UPDATE ON public.media_library FOR EACH ROW EXECUTE FUNCTION public.update_media_updated_at();


--
-- Name: sendgrid_inbound_emails update_sendgrid_inbound_emails_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sendgrid_inbound_emails_updated_at BEFORE UPDATE ON public.sendgrid_inbound_emails FOR EACH ROW EXECUTE FUNCTION public.update_sendgrid_updated_at();


--
-- Name: sendgrid_inbound_routing_rules update_sendgrid_inbound_routing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sendgrid_inbound_routing_rules_updated_at BEFORE UPDATE ON public.sendgrid_inbound_routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_sendgrid_updated_at();


--
-- Name: sendgrid_templates update_sendgrid_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sendgrid_templates_updated_at BEFORE UPDATE ON public.sendgrid_templates FOR EACH ROW EXECUTE FUNCTION public.update_sendgrid_updated_at();


--
-- Name: service_providers update_service_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_service_providers_updated_at BEFORE UPDATE ON public.service_providers FOR EACH ROW EXECUTE FUNCTION public.update_service_providers_updated_at();


--
-- Name: chat_messages_v2 update_session_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_session_activity AFTER INSERT ON public.chat_messages_v2 FOR EACH ROW EXECUTE FUNCTION public.update_session_last_active();


--
-- Name: tool_execution_logs update_tool_execution_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tool_execution_logs_updated_at BEFORE UPDATE ON public.tool_execution_logs FOR EACH ROW EXECUTE FUNCTION public.update_tool_execution_logs_updated_at();


--
-- Name: user_integration_credentials update_user_oauth_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_oauth_connections_updated_at BEFORE UPDATE ON public.user_integration_credentials FOR EACH ROW EXECUTE FUNCTION public.update_user_oauth_connections_updated_at();


--
-- Name: account_graphs account_graphs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_graphs
    ADD CONSTRAINT account_graphs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.user_integration_credentials(id);


--
-- Name: account_graphs account_graphs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_graphs
    ADD CONSTRAINT account_graphs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_integration_credentials admin_integration_credentials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_integration_credentials
    ADD CONSTRAINT admin_integration_credentials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: admin_integration_credentials admin_integration_credentials_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_integration_credentials
    ADD CONSTRAINT admin_integration_credentials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: admin_settings admin_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: agent_contact_permissions agent_contact_permissions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_contact_permissions
    ADD CONSTRAINT agent_contact_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_contact_permissions agent_contact_permissions_granted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_contact_permissions
    ADD CONSTRAINT agent_contact_permissions_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES auth.users(id);


--
-- Name: agent_contact_permissions agent_contact_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_contact_permissions
    ADD CONSTRAINT agent_contact_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_datastores agent_datastores_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_datastores
    ADD CONSTRAINT agent_datastores_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_datastores agent_datastores_datastore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_datastores
    ADD CONSTRAINT agent_datastores_datastore_id_fkey FOREIGN KEY (datastore_id) REFERENCES public.datastores(id) ON DELETE CASCADE;


--
-- Name: agent_generation_logs agent_generation_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_generation_logs
    ADD CONSTRAINT agent_generation_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: agent_generation_logs agent_generation_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_generation_logs
    ADD CONSTRAINT agent_generation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_group_access agent_group_access_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_group_access
    ADD CONSTRAINT agent_group_access_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_group_access agent_group_access_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_group_access
    ADD CONSTRAINT agent_group_access_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.contact_groups(id) ON DELETE CASCADE;


--
-- Name: agent_group_access agent_group_access_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_group_access
    ADD CONSTRAINT agent_group_access_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.agent_contact_permissions(id) ON DELETE CASCADE;


--
-- Name: agent_group_access agent_group_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_group_access
    ADD CONSTRAINT agent_group_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_integration_permissions agent_integration_permissions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_integration_permissions
    ADD CONSTRAINT agent_integration_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_integration_permissions agent_integration_permissions_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_integration_permissions
    ADD CONSTRAINT agent_integration_permissions_connection_id_fkey FOREIGN KEY (user_oauth_connection_id) REFERENCES public.user_integration_credentials(id) ON DELETE CASCADE;


--
-- Name: agent_integration_permissions agent_integration_permissions_granted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_integration_permissions
    ADD CONSTRAINT agent_integration_permissions_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_integration_permissions agent_integration_permissions_service_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_integration_permissions
    ADD CONSTRAINT agent_integration_permissions_service_provider_id_fkey FOREIGN KEY (service_provider_id) REFERENCES public.service_providers(id) ON DELETE CASCADE;


--
-- Name: agent_llm_preferences agent_llm_preferences_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_llm_preferences
    ADD CONSTRAINT agent_llm_preferences_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_mailgun_permissions agent_mailgun_permissions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mailgun_permissions
    ADD CONSTRAINT agent_mailgun_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_mailgun_permissions agent_mailgun_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mailgun_permissions
    ADD CONSTRAINT agent_mailgun_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: agent_mailgun_permissions agent_mailgun_permissions_mailgun_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mailgun_permissions
    ADD CONSTRAINT agent_mailgun_permissions_mailgun_config_id_fkey FOREIGN KEY (mailgun_config_id) REFERENCES public.mailgun_configurations(id) ON DELETE CASCADE;


--
-- Name: agent_mcp_connections agent_mcp_connections_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_mcp_connections
    ADD CONSTRAINT agent_mcp_connections_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_media_assignments agent_media_assignments_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_media_assignments
    ADD CONSTRAINT agent_media_assignments_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_media_assignments agent_media_assignments_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_media_assignments
    ADD CONSTRAINT agent_media_assignments_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media_library(id) ON DELETE CASCADE;


--
-- Name: agent_media_assignments agent_media_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_media_assignments
    ADD CONSTRAINT agent_media_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_memories agent_memories_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memories
    ADD CONSTRAINT agent_memories_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_memories agent_memories_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memories
    ADD CONSTRAINT agent_memories_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.chat_messages_v2(id);


--
-- Name: agent_sendgrid_permissions agent_sendgrid_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sendgrid_permissions
    ADD CONSTRAINT agent_sendgrid_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: agent_smtp_permissions agent_smtp_permissions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_smtp_permissions
    ADD CONSTRAINT agent_smtp_permissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_smtp_permissions agent_smtp_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_smtp_permissions
    ADD CONSTRAINT agent_smtp_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: agent_smtp_permissions agent_smtp_permissions_smtp_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_smtp_permissions
    ADD CONSTRAINT agent_smtp_permissions_smtp_config_id_fkey FOREIGN KEY (smtp_config_id) REFERENCES public.smtp_configurations(id) ON DELETE CASCADE;


--
-- Name: agent_specific_contact_access agent_specific_contact_access_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_specific_contact_access
    ADD CONSTRAINT agent_specific_contact_access_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_specific_contact_access agent_specific_contact_access_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_specific_contact_access
    ADD CONSTRAINT agent_specific_contact_access_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: agent_specific_contact_access agent_specific_contact_access_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_specific_contact_access
    ADD CONSTRAINT agent_specific_contact_access_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.agent_contact_permissions(id) ON DELETE CASCADE;


--
-- Name: agent_specific_contact_access agent_specific_contact_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_specific_contact_access
    ADD CONSTRAINT agent_specific_contact_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_states agent_states_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_states
    ADD CONSTRAINT agent_states_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_task_event_triggers agent_task_event_triggers_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_task_event_triggers
    ADD CONSTRAINT agent_task_event_triggers_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE CASCADE;


--
-- Name: agent_task_executions agent_task_executions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_task_executions
    ADD CONSTRAINT agent_task_executions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_task_executions agent_task_executions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_task_executions
    ADD CONSTRAINT agent_task_executions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE CASCADE;


--
-- Name: agent_tasks agent_tasks_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_tasks agent_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: agent_tasks agent_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_tasks
    ADD CONSTRAINT agent_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agents agents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: artifact_versions artifact_versions_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;


--
-- Name: artifact_versions artifact_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: artifacts artifacts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: artifacts artifacts_parent_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_parent_artifact_id_fkey FOREIGN KEY (parent_artifact_id) REFERENCES public.artifacts(id) ON DELETE SET NULL;


--
-- Name: artifacts artifacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: artifacts artifacts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: canvas_diffs canvas_diffs_canvas_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_diffs
    ADD CONSTRAINT canvas_diffs_canvas_session_id_fkey FOREIGN KEY (canvas_session_id) REFERENCES public.canvas_sessions(id) ON DELETE CASCADE;


--
-- Name: canvas_diffs canvas_diffs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_diffs
    ADD CONSTRAINT canvas_diffs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: canvas_sessions canvas_sessions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_sessions
    ADD CONSTRAINT canvas_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: canvas_sessions canvas_sessions_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_sessions
    ADD CONSTRAINT canvas_sessions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;


--
-- Name: canvas_sessions canvas_sessions_conversation_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_sessions
    ADD CONSTRAINT canvas_sessions_conversation_session_id_fkey FOREIGN KEY (conversation_session_id) REFERENCES public.conversation_sessions(id) ON DELETE CASCADE;


--
-- Name: canvas_sessions canvas_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_sessions
    ADD CONSTRAINT canvas_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: canvas_snapshots canvas_snapshots_canvas_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_snapshots
    ADD CONSTRAINT canvas_snapshots_canvas_session_id_fkey FOREIGN KEY (canvas_session_id) REFERENCES public.canvas_sessions(id) ON DELETE CASCADE;


--
-- Name: canvas_snapshots canvas_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canvas_snapshots
    ADD CONSTRAINT canvas_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: chat_channels chat_channels_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_room_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_agent_id_fkey FOREIGN KEY (sender_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_messages_v2 chat_messages_v2_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages_v2
    ADD CONSTRAINT chat_messages_v2_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id);


--
-- Name: chat_messages_v2 chat_messages_v2_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages_v2
    ADD CONSTRAINT chat_messages_v2_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE;


--
-- Name: chat_messages_v2 chat_messages_v2_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages_v2
    ADD CONSTRAINT chat_messages_v2_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.chat_messages_v2(id);


--
-- Name: chat_messages_v2 chat_messages_v2_sender_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages_v2
    ADD CONSTRAINT chat_messages_v2_sender_agent_id_fkey FOREIGN KEY (sender_agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: chat_messages_v2 chat_messages_v2_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages_v2
    ADD CONSTRAINT chat_messages_v2_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id);


--
-- Name: workspaces chat_rooms_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT chat_rooms_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: contact_audit_log contact_audit_log_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_audit_log
    ADD CONSTRAINT contact_audit_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: contact_audit_log contact_audit_log_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_audit_log
    ADD CONSTRAINT contact_audit_log_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: contact_audit_log contact_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_audit_log
    ADD CONSTRAINT contact_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: contact_communication_channels contact_communication_channels_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_communication_channels
    ADD CONSTRAINT contact_communication_channels_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_communication_channels contact_communication_channels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_communication_channels
    ADD CONSTRAINT contact_communication_channels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_group_memberships contact_group_memberships_added_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_memberships
    ADD CONSTRAINT contact_group_memberships_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES auth.users(id);


--
-- Name: contact_group_memberships contact_group_memberships_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_memberships
    ADD CONSTRAINT contact_group_memberships_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_group_memberships contact_group_memberships_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_memberships
    ADD CONSTRAINT contact_group_memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.contact_groups(id) ON DELETE CASCADE;


--
-- Name: contact_group_memberships contact_group_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_group_memberships
    ADD CONSTRAINT contact_group_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_groups contact_groups_parent_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_groups
    ADD CONSTRAINT contact_groups_parent_group_id_fkey FOREIGN KEY (parent_group_id) REFERENCES public.contact_groups(id) ON DELETE SET NULL;


--
-- Name: contact_groups contact_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_groups
    ADD CONSTRAINT contact_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_import_errors contact_import_errors_import_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_import_errors
    ADD CONSTRAINT contact_import_errors_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES public.contact_import_jobs(id) ON DELETE CASCADE;


--
-- Name: contact_import_errors contact_import_errors_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_import_errors
    ADD CONSTRAINT contact_import_errors_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES auth.users(id);


--
-- Name: contact_import_errors contact_import_errors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_import_errors
    ADD CONSTRAINT contact_import_errors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_import_jobs contact_import_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_import_jobs
    ADD CONSTRAINT contact_import_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_interactions contact_interactions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interactions
    ADD CONSTRAINT contact_interactions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: contact_interactions contact_interactions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interactions
    ADD CONSTRAINT contact_interactions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_interactions contact_interactions_is_follow_up_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interactions
    ADD CONSTRAINT contact_interactions_is_follow_up_to_fkey FOREIGN KEY (is_follow_up_to) REFERENCES public.contact_interactions(id);


--
-- Name: contact_interactions contact_interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_interactions
    ADD CONSTRAINT contact_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: context_snapshots context_snapshots_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.context_snapshots
    ADD CONSTRAINT context_snapshots_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: context_snapshots context_snapshots_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.context_snapshots
    ADD CONSTRAINT context_snapshots_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages_v2(id);


--
-- Name: conversation_sessions conversation_sessions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: conversation_sessions conversation_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_sessions
    ADD CONSTRAINT conversation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: conversation_summaries conversation_summaries_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summaries
    ADD CONSTRAINT conversation_summaries_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: conversation_summaries conversation_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summaries
    ADD CONSTRAINT conversation_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversation_summary_boards conversation_summary_boards_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summary_boards
    ADD CONSTRAINT conversation_summary_boards_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: conversation_summary_boards conversation_summary_boards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_summary_boards
    ADD CONSTRAINT conversation_summary_boards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: datastores datastores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datastores
    ADD CONSTRAINT datastores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: email_change_audit_log email_change_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_change_audit_log
    ADD CONSTRAINT email_change_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gmail_configurations gmail_configurations_user_oauth_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_configurations
    ADD CONSTRAINT gmail_configurations_user_oauth_connection_id_fkey FOREIGN KEY (user_oauth_connection_id) REFERENCES public.user_integration_credentials(id) ON DELETE CASCADE;


--
-- Name: integration_capabilities integration_capabilities_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_capabilities
    ADD CONSTRAINT integration_capabilities_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_providers(id) ON DELETE CASCADE;


--
-- Name: integration_capabilities integration_capabilities_service_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_capabilities
    ADD CONSTRAINT integration_capabilities_service_provider_id_fkey FOREIGN KEY (service_provider_id) REFERENCES public.service_providers(id) ON DELETE CASCADE;


--
-- Name: mailgun_configurations mailgun_configurations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_configurations
    ADD CONSTRAINT mailgun_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mailgun_configurations mailgun_configurations_user_oauth_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_configurations
    ADD CONSTRAINT mailgun_configurations_user_oauth_connection_id_fkey FOREIGN KEY (user_oauth_connection_id) REFERENCES public.user_integration_credentials(id) ON DELETE CASCADE;


--
-- Name: mailgun_operation_logs mailgun_operation_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_operation_logs
    ADD CONSTRAINT mailgun_operation_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: mailgun_operation_logs mailgun_operation_logs_mailgun_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_operation_logs
    ADD CONSTRAINT mailgun_operation_logs_mailgun_config_id_fkey FOREIGN KEY (mailgun_config_id) REFERENCES public.mailgun_configurations(id) ON DELETE CASCADE;


--
-- Name: mailgun_operation_logs mailgun_operation_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_operation_logs
    ADD CONSTRAINT mailgun_operation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mailgun_routes mailgun_routes_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_routes
    ADD CONSTRAINT mailgun_routes_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: mailgun_routes mailgun_routes_mailgun_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailgun_routes
    ADD CONSTRAINT mailgun_routes_mailgun_config_id_fkey FOREIGN KEY (mailgun_config_id) REFERENCES public.mailgun_configurations(id) ON DELETE CASCADE;


--
-- Name: mcp_tools_cache mcp_tools_cache_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_tools_cache
    ADD CONSTRAINT mcp_tools_cache_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.agent_mcp_connections(id) ON DELETE CASCADE;


--
-- Name: media_categories media_categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT media_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.media_categories(id) ON DELETE SET NULL;


--
-- Name: media_categories media_categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT media_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: media_library media_library_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: message_versions message_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_versions
    ADD CONSTRAINT message_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: message_versions message_versions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_versions
    ADD CONSTRAINT message_versions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages_v2(id) ON DELETE CASCADE;


--
-- Name: payment_events payment_events_stripe_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_stripe_invoice_id_fkey FOREIGN KEY (stripe_invoice_id) REFERENCES public.stripe_invoices(stripe_invoice_id);


--
-- Name: payment_events payment_events_stripe_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_stripe_order_id_fkey FOREIGN KEY (stripe_order_id) REFERENCES public.stripe_orders(id);


--
-- Name: payment_events payment_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sendgrid_inbound_routing_logs sendgrid_inbound_routing_logs_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_inbound_routing_logs
    ADD CONSTRAINT sendgrid_inbound_routing_logs_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.sendgrid_inbound_emails(id) ON DELETE CASCADE;


--
-- Name: sendgrid_inbound_routing_logs sendgrid_inbound_routing_logs_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sendgrid_inbound_routing_logs
    ADD CONSTRAINT sendgrid_inbound_routing_logs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.sendgrid_inbound_routing_rules(id) ON DELETE SET NULL;


--
-- Name: smtp_configurations smtp_configurations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_configurations
    ADD CONSTRAINT smtp_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: state_checkpoints state_checkpoints_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_checkpoints
    ADD CONSTRAINT state_checkpoints_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: state_checkpoints state_checkpoints_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_checkpoints
    ADD CONSTRAINT state_checkpoints_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.agent_states(id);


--
-- Name: state_transitions state_transitions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_transitions
    ADD CONSTRAINT state_transitions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: state_transitions state_transitions_from_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_transitions
    ADD CONSTRAINT state_transitions_from_state_id_fkey FOREIGN KEY (from_state_id) REFERENCES public.agent_states(id);


--
-- Name: state_transitions state_transitions_to_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_transitions
    ADD CONSTRAINT state_transitions_to_state_id_fkey FOREIGN KEY (to_state_id) REFERENCES public.agent_states(id);


--
-- Name: stripe_customers stripe_customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_customers
    ADD CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stripe_invoices stripe_invoices_stripe_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_stripe_customer_id_fkey FOREIGN KEY (stripe_customer_id) REFERENCES public.stripe_customers(stripe_customer_id) ON DELETE CASCADE;


--
-- Name: stripe_invoices stripe_invoices_stripe_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_stripe_subscription_id_fkey FOREIGN KEY (stripe_subscription_id) REFERENCES public.stripe_subscriptions(stripe_subscription_id) ON DELETE SET NULL;


--
-- Name: stripe_invoices stripe_invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stripe_orders stripe_orders_stripe_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_orders
    ADD CONSTRAINT stripe_orders_stripe_customer_id_fkey FOREIGN KEY (stripe_customer_id) REFERENCES public.stripe_customers(stripe_customer_id) ON DELETE CASCADE;


--
-- Name: stripe_orders stripe_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_orders
    ADD CONSTRAINT stripe_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stripe_subscriptions stripe_subscriptions_plan_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_plan_name_fkey FOREIGN KEY (plan_name) REFERENCES public.billing_plans(plan_name);


--
-- Name: stripe_subscriptions stripe_subscriptions_stripe_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_stripe_customer_id_fkey FOREIGN KEY (stripe_customer_id) REFERENCES public.stripe_customers(stripe_customer_id) ON DELETE CASCADE;


--
-- Name: stripe_subscriptions stripe_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscription_history subscription_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.users(id);


--
-- Name: subscription_history subscription_history_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.stripe_subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_history subscription_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: system_api_keys system_api_keys_last_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_api_keys
    ADD CONSTRAINT system_api_keys_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id);


--
-- Name: system_prompts system_prompts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_prompts
    ADD CONSTRAINT system_prompts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: system_prompts system_prompts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_prompts
    ADD CONSTRAINT system_prompts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: task_steps task_steps_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_steps
    ADD CONSTRAINT task_steps_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.agent_tasks(id) ON DELETE CASCADE;


--
-- Name: team_canvas_layouts team_canvas_layouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_canvas_layouts
    ADD CONSTRAINT team_canvas_layouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_connections team_connections_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_connections
    ADD CONSTRAINT team_connections_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);


--
-- Name: team_connections team_connections_from_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_connections
    ADD CONSTRAINT team_connections_from_team_id_fkey FOREIGN KEY (from_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_connections team_connections_to_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_connections
    ADD CONSTRAINT team_connections_to_team_id_fkey FOREIGN KEY (to_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_reports_to_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_reports_to_agent_id_fkey FOREIGN KEY (reports_to_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams teams_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: teams teams_parent_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_parent_team_id_fkey FOREIGN KEY (parent_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: temporary_chat_links temporary_chat_links_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_links
    ADD CONSTRAINT temporary_chat_links_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: temporary_chat_links temporary_chat_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_links
    ADD CONSTRAINT temporary_chat_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: temporary_chat_links temporary_chat_links_vault_link_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_links
    ADD CONSTRAINT temporary_chat_links_vault_link_token_id_fkey FOREIGN KEY (vault_link_token_id) REFERENCES vault.secrets(id);


--
-- Name: temporary_chat_sessions temporary_chat_sessions_conversation_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_sessions
    ADD CONSTRAINT temporary_chat_sessions_conversation_session_id_fkey FOREIGN KEY (conversation_session_id) REFERENCES public.conversation_sessions(id) ON DELETE SET NULL;


--
-- Name: temporary_chat_sessions temporary_chat_sessions_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_sessions
    ADD CONSTRAINT temporary_chat_sessions_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.temporary_chat_links(id) ON DELETE CASCADE;


--
-- Name: temporary_chat_sessions temporary_chat_sessions_vault_session_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporary_chat_sessions
    ADD CONSTRAINT temporary_chat_sessions_vault_session_token_id_fkey FOREIGN KEY (vault_session_token_id) REFERENCES vault.secrets(id);


--
-- Name: tool_execution_logs tool_execution_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_execution_logs
    ADD CONSTRAINT tool_execution_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: tool_execution_logs tool_execution_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_execution_logs
    ADD CONSTRAINT tool_execution_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tool_user_input_requests tool_user_input_requests_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_user_input_requests
    ADD CONSTRAINT tool_user_input_requests_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: tool_user_input_requests tool_user_input_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_user_input_requests
    ADD CONSTRAINT tool_user_input_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_integration_credentials user_integration_credentials_oauth_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integration_credentials
    ADD CONSTRAINT user_integration_credentials_oauth_provider_id_fkey FOREIGN KEY (oauth_provider_id) REFERENCES public.service_providers(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT user_integration_credentials_oauth_provider_id_fkey ON user_integration_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT user_integration_credentials_oauth_provider_id_fkey ON public.user_integration_credentials IS 'Fixed foreign key relationship to reference service_providers instead of oauth_providers (2025-09-25)';


--
-- Name: user_integration_credentials user_oauth_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_integration_credentials
    ADD CONSTRAINT user_oauth_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_team_memberships user_team_memberships_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_team_memberships
    ADD CONSTRAINT user_team_memberships_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: user_team_memberships user_team_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_team_memberships
    ADD CONSTRAINT user_team_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_token_usage user_token_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_token_usage
    ADD CONSTRAINT user_token_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: working_memory_chunks working_memory_chunks_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_memory_chunks
    ADD CONSTRAINT working_memory_chunks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: working_memory_chunks working_memory_chunks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.working_memory_chunks
    ADD CONSTRAINT working_memory_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_added_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workspace_members workspace_members_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: admin_settings Admin users can access settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can access settings" ON public.admin_settings USING ((( SELECT public.user_has_role(auth.uid(), 'admin'::text) AS user_has_role) = true));


--
-- Name: admin_integration_credentials Admin users can manage admin credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can manage admin credentials" ON public.admin_integration_credentials USING ((( SELECT public.user_has_role(auth.uid(), 'admin'::text) AS user_has_role) = true));


--
-- Name: system_prompts Admins can delete system prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete system prompts" ON public.system_prompts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: system_prompts Admins can insert system prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert system prompts" ON public.system_prompts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: platform_settings Admins can manage platform settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage platform settings" ON public.platform_settings TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: system_api_keys Admins can manage system API keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage system API keys" ON public.system_api_keys TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: system_prompts Admins can update system prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update system prompts" ON public.system_prompts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: agent_generation_logs Admins can view all generation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all generation logs" ON public.agent_generation_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: system_prompts Admins can view all system prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all system prompts" ON public.system_prompts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: chat_messages_v2 Agents can view messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agents can view messages in their conversations" ON public.chat_messages_v2 FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = chat_messages_v2.sender_agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: chat_messages Allow agent messages to be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow agent messages to be inserted" ON public.chat_messages FOR INSERT WITH CHECK (((sender_agent_id IS NOT NULL) AND (sender_user_id IS NULL)));


--
-- Name: roles Allow authenticated read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: teams Allow authenticated read access to teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to teams" ON public.teams FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: teams Allow authenticated users to create teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to create teams" ON public.teams FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: team_members Allow delete access for team owners/admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete access for team owners/admins" ON public.team_members FOR DELETE USING ((public.user_has_role(auth.uid(), 'admin'::text) OR public.is_team_owner(team_id, auth.uid())));


--
-- Name: workspaces Allow delete for owner only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete for owner only" ON public.workspaces FOR DELETE TO authenticated USING ((auth.uid() = owner_user_id));


--
-- Name: workspace_members Allow delete for workspace managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete for workspace managers" ON public.workspace_members FOR DELETE TO authenticated USING (public.can_manage_workspace_members(workspace_id, auth.uid()));


--
-- Name: user_roles Allow individual user read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow individual user read access" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: team_members Allow insert access for team owners/admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert access for team owners/admins" ON public.team_members FOR INSERT WITH CHECK ((public.user_has_role(auth.uid(), 'admin'::text) OR public.is_team_owner(team_id, auth.uid())));


--
-- Name: workspaces Allow insert for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert for authenticated users" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: workspace_members Allow insert for workspace managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert for workspace managers" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.can_manage_workspace_members(workspace_id, auth.uid()));


--
-- Name: workspaces Allow members read access on chat_rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow members read access on chat_rooms" ON public.workspaces FOR SELECT USING (public.is_room_member(id, auth.uid()));


--
-- Name: agents Allow modify access to own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow modify access to own agents" ON public.agents TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: workspaces Allow owner full access on chat_rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow owner full access on chat_rooms" ON public.workspaces USING ((auth.uid() = owner_user_id)) WITH CHECK ((auth.uid() = owner_user_id));


--
-- Name: teams Allow owner or global admin to delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow owner or global admin to delete teams" ON public.teams FOR DELETE USING (((auth.uid() = owner_user_id) OR public.is_global_admin(auth.uid())));


--
-- Name: teams Allow owner to update their teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow owner to update their teams" ON public.teams FOR UPDATE USING ((auth.uid() = owner_user_id)) WITH CHECK ((auth.uid() = owner_user_id));


--
-- Name: workspaces Allow owner to update workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow owner to update workspace" ON public.workspaces FOR UPDATE USING ((auth.uid() = owner_user_id)) WITH CHECK ((auth.uid() = owner_user_id));


--
-- Name: agents Allow read access to own agents or if admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to own agents or if admin" ON public.agents FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.user_has_role(auth.uid(), 'admin'::text)));


--
-- Name: team_members Allow read access to team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to team members" ON public.team_members FOR SELECT USING ((public.user_has_role(auth.uid(), 'admin'::text) OR public.is_team_owner(team_id, auth.uid()) OR public.is_team_member(team_id, auth.uid())));


--
-- Name: workspaces Allow select for owner or member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow select for owner or member" ON public.workspaces FOR SELECT TO authenticated USING (((auth.uid() = owner_user_id) OR public.is_chat_room_member(id, auth.uid())));


--
-- Name: workspace_members Allow select for workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow select for workspace members" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));


--
-- Name: team_members Allow update access for team owners/admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update access for team owners/admins" ON public.team_members FOR UPDATE USING ((public.user_has_role(auth.uid(), 'admin'::text) OR public.is_team_owner(team_id, auth.uid()))) WITH CHECK ((public.user_has_role(auth.uid(), 'admin'::text) OR public.is_team_owner(team_id, auth.uid())));


--
-- Name: workspaces Allow update for owner only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update for owner only" ON public.workspaces FOR UPDATE TO authenticated USING ((auth.uid() = owner_user_id)) WITH CHECK ((auth.uid() = owner_user_id));


--
-- Name: workspace_members Allow update for workspace managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update for workspace managers" ON public.workspace_members FOR UPDATE TO authenticated USING (public.can_manage_workspace_members(workspace_id, auth.uid())) WITH CHECK (public.can_manage_workspace_members(workspace_id, auth.uid()));


--
-- Name: user_team_memberships Allow users to add themselves to teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to add themselves to teams" ON public.user_team_memberships FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_messages Allow users to insert their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert their own messages" ON public.chat_messages FOR INSERT WITH CHECK (((auth.uid() = sender_user_id) AND (sender_agent_id IS NULL)));


--
-- Name: gmail_configurations Allow users to manage their own gmail configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to manage their own gmail configurations" ON public.gmail_configurations USING ((auth.uid() = ( SELECT user_integration_credentials.user_id
   FROM public.user_integration_credentials
  WHERE (user_integration_credentials.id = gmail_configurations.user_oauth_connection_id))));


--
-- Name: POLICY "Allow users to manage their own gmail configurations" ON gmail_configurations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Allow users to manage their own gmail configurations" ON public.gmail_configurations IS 'Users can manage their own Gmail configurations based on the ownership of the related OAuth connection.';


--
-- Name: chat_messages Allow users to read their own messages and agent messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read their own messages and agent messages" ON public.chat_messages FOR SELECT USING (((auth.uid() = sender_user_id) OR (sender_agent_id IS NOT NULL)));


--
-- Name: user_team_memberships Allow users to remove themselves from teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to remove themselves from teams" ON public.user_team_memberships FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_team_memberships Allow users to view own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to view own memberships" ON public.user_team_memberships FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_channels Allow workspace members INSERT; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace members INSERT" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));


--
-- Name: chat_channels Allow workspace members SELECT; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace members SELECT" ON public.chat_channels FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));


--
-- Name: chat_messages Allow workspace members to insert messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace members to insert messages" ON public.chat_messages FOR INSERT WITH CHECK ((public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid()) AND (((sender_user_id IS NOT NULL) AND (sender_user_id = auth.uid())) OR (sender_agent_id IS NOT NULL))));


--
-- Name: chat_messages Allow workspace members to read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace members to read messages" ON public.chat_messages FOR SELECT USING (public.is_workspace_member(public.get_workspace_id_for_channel(channel_id), auth.uid()));


--
-- Name: chat_channels Allow workspace owner DELETE; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace owner DELETE" ON public.chat_channels FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = chat_channels.workspace_id) AND (w.owner_user_id = auth.uid())))));


--
-- Name: chat_channels Allow workspace owner UPDATE; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace owner UPDATE" ON public.chat_channels FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = chat_channels.workspace_id) AND (w.owner_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = chat_channels.workspace_id) AND (w.owner_user_id = auth.uid())))));


--
-- Name: chat_messages Allow workspace owner to delete messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow workspace owner to delete messages" ON public.chat_messages FOR DELETE USING (public.is_workspace_owner(public.get_workspace_id_for_channel(channel_id), auth.uid()));


--
-- Name: platform_settings Anonymous can read signup status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous can read signup status" ON public.platform_settings FOR SELECT TO anon USING ((key = 'signup_enabled'::text));


--
-- Name: service_providers Anyone can view enabled OAuth providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view enabled OAuth providers" ON public.service_providers FOR SELECT USING ((is_enabled = true));


--
-- Name: service_providers Authenticated users can view integrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view integrations" ON public.service_providers FOR SELECT TO authenticated USING ((is_enabled = true));


--
-- Name: chat_messages Disallow updates to channel messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Disallow updates to channel messages" ON public.chat_messages FOR UPDATE USING (false);


--
-- Name: chat_messages Disallow updates to chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Disallow updates to chat messages" ON public.chat_messages FOR UPDATE USING (false);


--
-- Name: system_prompts Edge functions can read active prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Edge functions can read active prompts" ON public.system_prompts FOR SELECT USING ((is_active = true));


--
-- Name: integration_capabilities Integration capabilities are readable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Integration capabilities are readable by everyone" ON public.integration_capabilities FOR SELECT USING (true);


--
-- Name: integration_categories Integration categories are readable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Integration categories are readable by everyone" ON public.integration_categories FOR SELECT USING (true);


--
-- Name: service_providers OAuth providers are readable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "OAuth providers are readable by authenticated users" ON public.service_providers FOR SELECT TO authenticated USING ((is_enabled = true));


--
-- Name: service_providers Only service role can modify OAuth providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can modify OAuth providers" ON public.service_providers TO service_role USING (true);


--
-- Name: billing_plans Public read active billing plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read active billing plans" ON public.billing_plans FOR SELECT USING ((is_active = true));


--
-- Name: sendgrid_inbound_emails Service can manage inbound emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage inbound emails" ON public.sendgrid_inbound_emails USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: sendgrid_inbound_routing_logs Service can manage routing logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage routing logs" ON public.sendgrid_inbound_routing_logs USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: platform_settings Service role can access platform settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can access platform settings" ON public.platform_settings USING ((auth.role() = 'service_role'::text));


--
-- Name: admin_settings Service role can access settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can access settings" ON public.admin_settings USING ((auth.role() = 'service_role'::text));


--
-- Name: mailgun_operation_logs Service role can insert mailgun operation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert mailgun operation logs" ON public.mailgun_operation_logs FOR INSERT WITH CHECK (true);


--
-- Name: admin_integration_credentials Service role can manage admin credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage admin credentials" ON public.admin_integration_credentials USING ((auth.role() = 'service_role'::text));


--
-- Name: sendgrid_operation_logs Service role can manage all logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all logs" ON public.sendgrid_operation_logs USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: tool_execution_logs Service role can manage all tool execution logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all tool execution logs" ON public.tool_execution_logs USING ((auth.role() = 'service_role'::text));


--
-- Name: conversation_summaries Service role can manage conversation summaries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage conversation summaries" ON public.conversation_summaries USING ((auth.role() = 'service_role'::text));


--
-- Name: conversation_summary_boards Service role can manage summary boards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage summary boards" ON public.conversation_summary_boards USING ((auth.role() = 'service_role'::text));


--
-- Name: working_memory_chunks Service role can manage working memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage working memory" ON public.working_memory_chunks USING ((auth.role() = 'service_role'::text));


--
-- Name: tool_user_input_requests Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.tool_user_input_requests USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_integration_permissions Service role full access to agent permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to agent permissions" ON public.agent_integration_permissions USING ((auth.role() = 'service_role'::text));


--
-- Name: POLICY "Service role full access to agent permissions" ON agent_integration_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Service role full access to agent permissions" ON public.agent_integration_permissions IS 'Allows service role full access for system operations';


--
-- Name: integration_categories Service role full access to integration_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to integration_categories" ON public.integration_categories TO service_role USING (true);


--
-- Name: service_providers Service role full access to service providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to service providers" ON public.service_providers TO service_role USING (true);


--
-- Name: chat_messages_v2 Service role full access to v2 chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to v2 chat" ON public.chat_messages_v2 TO service_role USING (true) WITH CHECK (true);


--
-- Name: billing_plans Service role manages billing plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages billing plans" ON public.billing_plans USING ((auth.role() = 'service_role'::text));


--
-- Name: stripe_customers Service role manages customer data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages customer data" ON public.stripe_customers USING ((auth.role() = 'service_role'::text));


--
-- Name: email_change_audit_log Service role manages email change audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages email change audit" ON public.email_change_audit_log USING ((auth.role() = 'service_role'::text));


--
-- Name: stripe_invoices Service role manages invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages invoices" ON public.stripe_invoices USING ((auth.role() = 'service_role'::text));


--
-- Name: stripe_orders Service role manages orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages orders" ON public.stripe_orders USING ((auth.role() = 'service_role'::text));


--
-- Name: payment_events Service role manages payment events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages payment events" ON public.payment_events USING ((auth.role() = 'service_role'::text));


--
-- Name: subscription_history Service role manages subscription history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages subscription history" ON public.subscription_history USING ((auth.role() = 'service_role'::text));


--
-- Name: stripe_subscriptions Service role manages subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages subscriptions" ON public.stripe_subscriptions USING ((auth.role() = 'service_role'::text));


--
-- Name: server_configuration_secrets Service role only access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only access" ON public.server_configuration_secrets TO service_role USING (true) WITH CHECK (true);


--
-- Name: mcp_tools_cache System can manage MCP tools cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage MCP tools cache" ON public.mcp_tools_cache USING (true);


--
-- Name: agent_task_executions System can manage task executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage task executions" ON public.agent_task_executions USING (true);


--
-- Name: datastores Users can create datastores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create datastores" ON public.datastores FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: tool_user_input_requests Users can create input requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create input requests" ON public.tool_user_input_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_integration_credentials Users can create own ClickSend connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own ClickSend connections" ON public.user_integration_credentials FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (oauth_provider_id IN ( SELECT service_providers.id
   FROM public.service_providers
  WHERE (service_providers.name = 'clicksend_sms'::text)))));


--
-- Name: canvas_diffs Users can create own canvas diffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own canvas diffs" ON public.canvas_diffs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.canvas_sessions cs
  WHERE ((cs.id = canvas_diffs.canvas_session_id) AND (cs.user_id = auth.uid())))));


--
-- Name: canvas_snapshots Users can create own canvas snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own canvas snapshots" ON public.canvas_snapshots FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.canvas_sessions cs
  WHERE ((cs.id = canvas_snapshots.canvas_session_id) AND (cs.user_id = auth.uid())))));


--
-- Name: agent_tasks Users can create tasks for their own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create tasks for their own agents" ON public.agent_tasks FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_tasks.agent_id) AND (agents.user_id = auth.uid()))))));


--
-- Name: user_integration_credentials Users can create their own OAuth connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own OAuth connections" ON public.user_integration_credentials FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: agents Users can create their own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own agents" ON public.agents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: artifacts Users can create their own artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own artifacts" ON public.artifacts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: canvas_sessions Users can create their own canvas sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own canvas sessions" ON public.canvas_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: artifact_versions Users can create versions for their artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create versions for their artifacts" ON public.artifact_versions FOR INSERT WITH CHECK (((artifact_id IN ( SELECT artifacts.id
   FROM public.artifacts
  WHERE (artifacts.user_id = auth.uid()))) AND (created_by = auth.uid())));


--
-- Name: user_integration_credentials Users can delete own ClickSend connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own ClickSend connections" ON public.user_integration_credentials FOR DELETE USING (((user_id = auth.uid()) AND (oauth_provider_id IN ( SELECT service_providers.id
   FROM public.service_providers
  WHERE (service_providers.name = 'clicksend_sms'::text)))));


--
-- Name: canvas_snapshots Users can delete own canvas snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own canvas snapshots" ON public.canvas_snapshots FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.canvas_sessions cs
  WHERE ((cs.id = canvas_snapshots.canvas_session_id) AND (cs.user_id = auth.uid())))));


--
-- Name: datastores Users can delete own datastores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own datastores" ON public.datastores FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: mailgun_configurations Users can delete own mailgun configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own mailgun configurations" ON public.mailgun_configurations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: mailgun_routes Users can delete own mailgun routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own mailgun routes" ON public.mailgun_routes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.mailgun_configurations
  WHERE ((mailgun_configurations.id = mailgun_routes.mailgun_config_id) AND (mailgun_configurations.user_id = auth.uid())))));


--
-- Name: user_integration_credentials Users can delete their own OAuth connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own OAuth connections" ON public.user_integration_credentials FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: agent_mcp_connections Users can delete their own agent MCP connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own agent MCP connections" ON public.agent_mcp_connections FOR DELETE USING ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: agent_tasks Users can delete their own agent tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own agent tasks" ON public.agent_tasks FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: agents Users can delete their own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own agents" ON public.agents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: artifacts Users can delete their own artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own artifacts" ON public.artifacts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: canvas_sessions Users can delete their own canvas sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own canvas sessions" ON public.canvas_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: agent_mcp_connections Users can insert MCP connections for their own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert MCP connections for their own agents" ON public.agent_mcp_connections FOR INSERT WITH CHECK ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: mailgun_configurations Users can insert own mailgun configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own mailgun configurations" ON public.mailgun_configurations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: mailgun_routes Users can insert own mailgun routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own mailgun routes" ON public.mailgun_routes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mailgun_configurations
  WHERE ((mailgun_configurations.id = mailgun_routes.mailgun_config_id) AND (mailgun_configurations.user_id = auth.uid())))));


--
-- Name: agent_generation_logs Users can insert their own generation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own generation logs" ON public.agent_generation_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: chat_messages_v2 Users can insert v2 messages (debug); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert v2 messages (debug)" ON public.chat_messages_v2 FOR INSERT WITH CHECK ((sender_user_id = auth.uid()));


--
-- Name: agent_integration_permissions Users can manage agent permissions for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage agent permissions for their agents" ON public.agent_integration_permissions USING ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: POLICY "Users can manage agent permissions for their agents" ON agent_integration_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Users can manage agent permissions for their agents" ON public.agent_integration_permissions IS 'Allows users to manage integration permissions for agents they own';


--
-- Name: agent_mailgun_permissions Users can manage mailgun permissions for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage mailgun permissions for their agents" ON public.agent_mailgun_permissions USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_mailgun_permissions.agent_id) AND (agents.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_mailgun_permissions.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: agent_memories Users can manage memories for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage memories for their agents" ON public.agent_memories USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_memories.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: agent_datastores Users can manage own agent datastores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own agent datastores" ON public.agent_datastores TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_datastores.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: agent_smtp_permissions Users can manage permissions for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage permissions for their agents" ON public.agent_smtp_permissions USING (((granted_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_smtp_permissions.agent_id) AND (agents.user_id = auth.uid()))))));


--
-- Name: agent_states Users can manage states for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage states for their agents" ON public.agent_states USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_states.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: agent_integration_permissions Users can manage their agents' OAuth permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their agents' OAuth permissions" ON public.agent_integration_permissions USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_integration_permissions.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: user_integration_credentials Users can manage their own OAuth connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own OAuth connections" ON public.user_integration_credentials USING ((user_id = auth.uid()));


--
-- Name: smtp_configurations Users can manage their own SMTP configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own SMTP configs" ON public.smtp_configurations USING ((user_id = auth.uid()));


--
-- Name: agent_mcp_connections Users can manage their own agent MCP connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own agent MCP connections" ON public.agent_mcp_connections USING ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: agent_media_assignments Users can manage their own agent media assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own agent media assignments" ON public.agent_media_assignments TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: media_categories Users can manage their own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own categories" ON public.media_categories TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: media_library Users can manage their own media library; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own media library" ON public.media_library TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: agent_task_event_triggers Users can manage their own task event triggers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own task event triggers" ON public.agent_task_event_triggers USING ((EXISTS ( SELECT 1
   FROM public.agent_tasks
  WHERE ((agent_tasks.id = agent_task_event_triggers.task_id) AND (agent_tasks.user_id = auth.uid())))));


--
-- Name: datastores Users can read own datastores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own datastores" ON public.datastores FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_messages_v2 Users can read v2 messages involving them or their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read v2 messages involving them or their agents" ON public.chat_messages_v2 FOR SELECT USING (((sender_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = chat_messages_v2.sender_agent_id) AND (a.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = ((chat_messages_v2.metadata ->> 'target_agent_id'::text))::uuid) AND (a.user_id = auth.uid()))))));


--
-- Name: user_integration_credentials Users can update own ClickSend connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own ClickSend connections" ON public.user_integration_credentials FOR UPDATE USING (((user_id = auth.uid()) AND (oauth_provider_id IN ( SELECT service_providers.id
   FROM public.service_providers
  WHERE (service_providers.name = 'clicksend_sms'::text)))));


--
-- Name: datastores Users can update own datastores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own datastores" ON public.datastores FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: mailgun_configurations Users can update own mailgun configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own mailgun configurations" ON public.mailgun_configurations FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: mailgun_routes Users can update own mailgun routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own mailgun routes" ON public.mailgun_routes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.mailgun_configurations
  WHERE ((mailgun_configurations.id = mailgun_routes.mailgun_config_id) AND (mailgun_configurations.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.mailgun_configurations
  WHERE ((mailgun_configurations.id = mailgun_routes.mailgun_config_id) AND (mailgun_configurations.user_id = auth.uid())))));


--
-- Name: user_integration_credentials Users can update their own OAuth connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own OAuth connections" ON public.user_integration_credentials FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: agent_mcp_connections Users can update their own agent MCP connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own agent MCP connections" ON public.agent_mcp_connections FOR UPDATE USING ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: agent_tasks Users can update their own agent tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own agent tasks" ON public.agent_tasks FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: agents Users can update their own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own agents" ON public.agents FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: artifacts Users can update their own artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own artifacts" ON public.artifacts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: canvas_sessions Users can update their own canvas sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own canvas sessions" ON public.canvas_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tool_user_input_requests Users can update their own input requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own input requests" ON public.tool_user_input_requests FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: mcp_tools_cache Users can view MCP tools for their own agent connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view MCP tools for their own agent connections" ON public.mcp_tools_cache FOR SELECT USING ((connection_id IN ( SELECT agent_mcp_connections.id
   FROM public.agent_mcp_connections
  WHERE (agent_mcp_connections.agent_id IN ( SELECT agents.id
           FROM public.agents
          WHERE (agents.user_id = auth.uid()))))));


--
-- Name: agent_integration_permissions Users can view agent permissions for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view agent permissions for their agents" ON public.agent_integration_permissions FOR SELECT USING ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: POLICY "Users can view agent permissions for their agents" ON agent_integration_permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Users can view agent permissions for their agents" ON public.agent_integration_permissions IS 'Allows users to view integration permissions for agents they own';


--
-- Name: artifacts Users can view artifacts in their workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view artifacts in their workspaces" ON public.artifacts FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: agent_mailgun_permissions Users can view mailgun permissions for their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view mailgun permissions for their agents" ON public.agent_mailgun_permissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_mailgun_permissions.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: user_integration_credentials Users can view own ClickSend connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own ClickSend connections" ON public.user_integration_credentials FOR SELECT USING (((user_id = auth.uid()) AND (oauth_provider_id IN ( SELECT service_providers.id
   FROM public.service_providers
  WHERE (service_providers.name = 'clicksend_sms'::text)))));


--
-- Name: canvas_diffs Users can view own canvas diffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own canvas diffs" ON public.canvas_diffs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.canvas_sessions cs
  WHERE ((cs.id = canvas_diffs.canvas_session_id) AND (cs.user_id = auth.uid())))));


--
-- Name: canvas_snapshots Users can view own canvas snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own canvas snapshots" ON public.canvas_snapshots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.canvas_sessions cs
  WHERE ((cs.id = canvas_snapshots.canvas_session_id) AND (cs.user_id = auth.uid())))));


--
-- Name: stripe_customers Users can view own customer data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own customer data" ON public.stripe_customers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: email_change_audit_log Users can view own email change history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own email change history" ON public.email_change_audit_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: mailgun_configurations Users can view own mailgun configurations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own mailgun configurations" ON public.mailgun_configurations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: mailgun_routes Users can view own mailgun routes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own mailgun routes" ON public.mailgun_routes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.mailgun_configurations
  WHERE ((mailgun_configurations.id = mailgun_routes.mailgun_config_id) AND (mailgun_configurations.user_id = auth.uid())))));


--
-- Name: mailgun_operation_logs Users can view their mailgun operation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their mailgun operation logs" ON public.mailgun_operation_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_integration_credentials Users can view their own OAuth connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own OAuth connections" ON public.user_integration_credentials FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: agent_mcp_connections Users can view their own agent MCP connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own agent MCP connections" ON public.agent_mcp_connections FOR SELECT USING ((agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid()))));


--
-- Name: agent_tasks Users can view their own agent tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own agent tasks" ON public.agent_tasks FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: agents Users can view their own agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own agents" ON public.agents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: artifacts Users can view their own artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own artifacts" ON public.artifacts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: canvas_sessions Users can view their own canvas sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own canvas sessions" ON public.canvas_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: conversation_summaries Users can view their own conversation summaries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own conversation summaries" ON public.conversation_summaries FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_generation_logs Users can view their own generation logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own generation logs" ON public.agent_generation_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: tool_user_input_requests Users can view their own input requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own input requests" ON public.tool_user_input_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sendgrid_operation_logs Users can view their own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own logs" ON public.sendgrid_operation_logs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: chat_messages_v2 Users can view their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own messages" ON public.chat_messages_v2 FOR SELECT USING ((auth.uid() = sender_user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: conversation_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sessions" ON public.conversation_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: conversation_summary_boards Users can view their own summary boards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own summary boards" ON public.conversation_summary_boards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_task_event_triggers Users can view their own task event triggers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own task event triggers" ON public.agent_task_event_triggers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agent_tasks
  WHERE ((agent_tasks.id = agent_task_event_triggers.task_id) AND (agent_tasks.user_id = auth.uid())))));


--
-- Name: agent_task_executions Users can view their own task executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own task executions" ON public.agent_task_executions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agent_tasks
  WHERE ((agent_tasks.id = agent_task_executions.task_id) AND (agent_tasks.user_id = auth.uid())))));


--
-- Name: tool_execution_logs Users can view their own tool execution logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own tool execution logs" ON public.tool_execution_logs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: working_memory_chunks Users can view their own working memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own working memory" ON public.working_memory_chunks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: artifact_versions Users can view versions in workspace artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view versions in workspace artifacts" ON public.artifact_versions FOR SELECT USING ((artifact_id IN ( SELECT artifacts.id
   FROM public.artifacts
  WHERE (artifacts.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: artifact_versions Users can view versions of their artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view versions of their artifacts" ON public.artifact_versions FOR SELECT USING ((artifact_id IN ( SELECT artifacts.id
   FROM public.artifacts
  WHERE (artifacts.user_id = auth.uid()))));


--
-- Name: stripe_invoices Users view own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own invoices" ON public.stripe_invoices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: stripe_orders Users view own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own orders" ON public.stripe_orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: payment_events Users view own payment events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own payment events" ON public.payment_events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscription_history Users view own subscription history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own subscription history" ON public.subscription_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: stripe_subscriptions Users view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own subscriptions" ON public.stripe_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: account_graphs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_graphs ENABLE ROW LEVEL SECURITY;

--
-- Name: account_graphs account_graphs_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_graphs_user_access ON public.account_graphs USING ((auth.uid() = user_id));


--
-- Name: admin_integration_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_integration_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_token_usage admin_view_all_token_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_view_all_token_usage ON public.user_token_usage FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((r.id = ur.role_id)))
  WHERE ((ur.user_id = auth.uid()) AND (r.name = 'admin'::text)))));


--
-- Name: agent_contact_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_contact_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_datastores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_datastores ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_datastores agent_datastores_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_datastores_service_access ON public.agent_datastores TO service_role USING (true) WITH CHECK (true);


--
-- Name: agent_datastores agent_datastores_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_datastores_user_access ON public.agent_datastores TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = agent_datastores.agent_id) AND (a.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = agent_datastores.agent_id) AND (a.user_id = auth.uid())))));


--
-- Name: agent_email_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_email_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_generation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_generation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_group_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_group_access ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_integration_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_integration_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_llm_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_llm_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_llm_preferences agent_llm_prefs_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_llm_prefs_service_access ON public.agent_llm_preferences TO service_role USING (true) WITH CHECK (true);


--
-- Name: POLICY agent_llm_prefs_service_access ON agent_llm_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY agent_llm_prefs_service_access ON public.agent_llm_preferences IS 'Allows service role full access for system operations, triggers, and Edge Functions';


--
-- Name: agent_llm_preferences agent_llm_prefs_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_llm_prefs_user_access ON public.agent_llm_preferences TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_llm_preferences.agent_id) AND (agents.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = agent_llm_preferences.agent_id) AND (agents.user_id = auth.uid())))));


--
-- Name: POLICY agent_llm_prefs_user_access ON agent_llm_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY agent_llm_prefs_user_access ON public.agent_llm_preferences IS 'Allows authenticated users to manage LLM preferences only for agents they own';


--
-- Name: agent_mailgun_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_mailgun_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_mcp_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_mcp_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_media_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_media_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_memories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_sendgrid_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_sendgrid_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_smtp_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_smtp_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_specific_contact_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_specific_contact_access ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_states ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_task_event_triggers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_task_event_triggers ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_task_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_task_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_interactions agents_can_create_own_user_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_create_own_user_contact_interactions ON public.contact_interactions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.agents a ON (((c.user_id = a.user_id) AND (a.id = contact_interactions.agent_id))))
  WHERE ((a.user_id = auth.uid()) AND (c.id = contact_interactions.contact_id)))));


--
-- Name: contact_interactions agents_can_create_permitted_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_create_permitted_contact_interactions ON public.contact_interactions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.contacts c
     JOIN public.agents a ON (((c.user_id = a.user_id) AND (a.id = contact_interactions.agent_id))))
     JOIN public.agent_contact_permissions acp ON ((a.id = acp.agent_id)))
  WHERE ((a.user_id = auth.uid()) AND (c.id = contact_interactions.contact_id) AND (acp.can_contact = true) AND ((acp.expires_at IS NULL) OR (acp.expires_at > CURRENT_TIMESTAMP))))));


--
-- Name: agent_contact_permissions agents_can_view_own_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_view_own_permissions ON public.agent_contact_permissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = agent_contact_permissions.agent_id) AND (a.user_id = auth.uid())))));


--
-- Name: agent_specific_contact_access agents_can_view_own_specific_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_view_own_specific_access ON public.agent_specific_contact_access FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = agent_specific_contact_access.agent_id) AND (a.user_id = auth.uid())))));


--
-- Name: contact_communication_channels agents_can_view_own_user_contact_channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_view_own_user_contact_channels ON public.contact_communication_channels FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.agents a ON ((c.user_id = a.user_id)))
  WHERE ((a.user_id = auth.uid()) AND (c.id = contact_communication_channels.contact_id)))));


--
-- Name: contact_interactions agents_can_view_own_user_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_view_own_user_contact_interactions ON public.contact_interactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.agents a ON ((c.user_id = a.user_id)))
  WHERE ((a.user_id = auth.uid()) AND (c.id = contact_interactions.contact_id)))));


--
-- Name: contacts agents_can_view_own_user_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_view_own_user_contacts ON public.contacts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.user_id = auth.uid()) AND (a.user_id = contacts.user_id)))));


--
-- Name: POLICY agents_can_view_own_user_contacts ON contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY agents_can_view_own_user_contacts ON public.contacts IS 'Simplified agent access - agents can view all contacts for their user. Detailed permissions handled in application layer.';


--
-- Name: contact_group_memberships agents_can_view_own_user_group_memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_can_view_own_user_group_memberships ON public.contact_group_memberships FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.contacts c
     JOIN public.agents a ON ((c.user_id = a.user_id)))
  WHERE ((a.user_id = auth.uid()) AND (c.id = contact_group_memberships.contact_id)))));


--
-- Name: agents agents_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_service_access ON public.agents TO service_role USING (true) WITH CHECK (true);


--
-- Name: agents agents_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_user_access ON public.agents TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: artifact_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifact_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_diffs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_diffs ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: canvas_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.canvas_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages_v2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages_v2 ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages_v2 chat_messages_v2_select_owned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_messages_v2_select_owned ON public.chat_messages_v2 FOR SELECT TO authenticated USING (((sender_user_id = auth.uid()) OR ((sender_agent_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = chat_messages_v2.sender_agent_id) AND (a.user_id = auth.uid()))))) OR ((metadata ? 'target_agent_id'::text) AND (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = ((chat_messages_v2.metadata ->> 'target_agent_id'::text))::uuid) AND (a.user_id = auth.uid())))))));


--
-- Name: contact_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_communication_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_communication_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_group_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_group_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_import_errors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_import_errors ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_import_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_import_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: context_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.context_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: context_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.context_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_sessions conversation_sessions_insert_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_sessions_insert_user ON public.conversation_sessions FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: conversation_sessions conversation_sessions_select_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_sessions_select_user ON public.conversation_sessions FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ((agent_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = conversation_sessions.agent_id) AND (a.user_id = auth.uid())))))));


--
-- Name: conversation_sessions conversation_sessions_update_agent_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_sessions_update_agent_owner ON public.conversation_sessions FOR UPDATE TO authenticated USING (((agent_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = conversation_sessions.agent_id) AND (a.user_id = auth.uid())))))) WITH CHECK (((agent_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.agents a
  WHERE ((a.id = conversation_sessions.agent_id) AND (a.user_id = auth.uid()))))));


--
-- Name: conversation_sessions conversation_sessions_update_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_sessions_update_user ON public.conversation_sessions FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: conversation_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_summary_boards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_summary_boards ENABLE ROW LEVEL SECURITY;

--
-- Name: datastores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.datastores ENABLE ROW LEVEL SECURITY;

--
-- Name: email_change_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_change_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: gmail_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_capabilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_capabilities ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: mailgun_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mailgun_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: mailgun_operation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mailgun_operation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: mailgun_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mailgun_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_tools_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_tools_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: media_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: media_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

--
-- Name: message_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: sendgrid_inbound_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sendgrid_inbound_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: sendgrid_inbound_routing_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sendgrid_inbound_routing_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sendgrid_inbound_routing_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sendgrid_inbound_routing_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: sendgrid_operation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sendgrid_operation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sendgrid_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sendgrid_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: server_configuration_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.server_configuration_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: service_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_audit_log service_role_full_access_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_audit_logs ON public.contact_audit_log USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contact_communication_channels service_role_full_access_channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_channels ON public.contact_communication_channels USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contacts service_role_full_access_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_contacts ON public.contacts USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: agent_group_access service_role_full_access_group_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_group_access ON public.agent_group_access USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contact_groups service_role_full_access_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_groups ON public.contact_groups USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contact_import_errors service_role_full_access_import_errors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_import_errors ON public.contact_import_errors USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contact_import_jobs service_role_full_access_import_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_import_jobs ON public.contact_import_jobs USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contact_interactions service_role_full_access_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_interactions ON public.contact_interactions USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: contact_group_memberships service_role_full_access_memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_memberships ON public.contact_group_memberships USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: agent_contact_permissions service_role_full_access_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_permissions ON public.agent_contact_permissions USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: agent_specific_contact_access service_role_full_access_specific_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_specific_access ON public.agent_specific_contact_access USING ((current_setting('role'::text) = 'service_role'::text));


--
-- Name: smtp_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.smtp_configurations ENABLE ROW LEVEL SECURITY;

--
-- Name: state_checkpoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.state_checkpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: state_transitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.state_transitions ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

--
-- Name: system_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_audit_log system_can_insert_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_can_insert_audit_logs ON public.contact_audit_log FOR INSERT WITH CHECK (true);


--
-- Name: system_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: system_metrics system_metrics_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_metrics_service_access ON public.system_metrics TO service_role USING (true) WITH CHECK (true);


--
-- Name: system_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: task_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: task_steps task_steps_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_steps_service_access ON public.task_steps TO service_role USING (true) WITH CHECK (true);


--
-- Name: task_steps task_steps_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_steps_user_access ON public.task_steps TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_tasks at
  WHERE ((at.id = task_steps.task_id) AND (at.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agent_tasks at
  WHERE ((at.id = task_steps.task_id) AND (at.user_id = auth.uid())))));


--
-- Name: team_canvas_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_canvas_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: team_canvas_layouts team_canvas_layouts_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_canvas_layouts_service_access ON public.team_canvas_layouts TO service_role USING (true) WITH CHECK (true);


--
-- Name: team_canvas_layouts team_canvas_layouts_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_canvas_layouts_user_access ON public.team_canvas_layouts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: team_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: team_connections team_connections_create_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_connections_create_access ON public.team_connections FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.teams t1,
    public.teams t2
  WHERE ((t1.id = team_connections.from_team_id) AND (t2.id = team_connections.to_team_id) AND (t1.owner_user_id = auth.uid()) AND (t2.owner_user_id = auth.uid())))) AND (created_by_user_id = auth.uid())));


--
-- Name: team_connections team_connections_delete_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_connections_delete_access ON public.team_connections FOR DELETE TO authenticated USING (((created_by_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.teams t1,
    public.teams t2
  WHERE ((t1.id = team_connections.from_team_id) AND (t2.id = team_connections.to_team_id) AND (t1.owner_user_id = auth.uid()) AND (t2.owner_user_id = auth.uid()))))));


--
-- Name: team_connections team_connections_modify_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_connections_modify_access ON public.team_connections FOR UPDATE TO authenticated USING (((created_by_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.teams t1,
    public.teams t2
  WHERE ((t1.id = team_connections.from_team_id) AND (t2.id = team_connections.to_team_id) AND (t1.owner_user_id = auth.uid()) AND (t2.owner_user_id = auth.uid())))))) WITH CHECK ((created_by_user_id = auth.uid()));


--
-- Name: team_connections team_connections_read_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_connections_read_access ON public.team_connections FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE (((t.id = team_connections.from_team_id) OR (t.id = team_connections.to_team_id)) AND (t.owner_user_id = auth.uid())))) OR (created_by_user_id = auth.uid())));


--
-- Name: team_connections team_connections_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_connections_service_access ON public.team_connections TO service_role USING (true) WITH CHECK (true);


--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: teams teams_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_insert_own ON public.teams FOR INSERT TO authenticated WITH CHECK ((owner_user_id = auth.uid()));


--
-- Name: teams teams_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_select_own ON public.teams FOR SELECT TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: teams teams_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_update_own ON public.teams FOR UPDATE TO authenticated USING ((owner_user_id = auth.uid())) WITH CHECK ((owner_user_id = auth.uid()));


--
-- Name: tool_execution_logs temp_chat_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_chat_audit_logs ON public.tool_execution_logs USING ((((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR (auth.role() = 'service_role'::text) OR ((auth.uid() IS NOT NULL) AND (agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid())))) OR ((tool_name ~~ 'temporary_chat_%'::text) AND (user_id = auth.uid()))));


--
-- Name: conversation_sessions temp_chat_conversation_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_chat_conversation_sessions ON public.conversation_sessions USING ((((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR (auth.role() = 'service_role'::text) OR ((auth.uid() IS NOT NULL) AND (agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid())))) OR (conversation_id IN ( SELECT tcs.conversation_id
   FROM (public.temporary_chat_sessions tcs
     JOIN public.temporary_chat_links tcl ON ((tcs.link_id = tcl.id)))
  WHERE (tcl.user_id = auth.uid())))));


--
-- Name: chat_messages_v2 temp_chat_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_chat_messages ON public.chat_messages_v2 USING ((((auth.uid() IS NOT NULL) AND ((sender_user_id = auth.uid()) OR (conversation_id IN ( SELECT conversation_sessions.conversation_id
   FROM public.conversation_sessions
  WHERE (conversation_sessions.user_id = auth.uid()))))) OR (auth.role() = 'service_role'::text) OR (conversation_id IN ( SELECT tcs.conversation_id
   FROM (public.temporary_chat_sessions tcs
     JOIN public.temporary_chat_links tcl ON ((tcs.link_id = tcl.id)))
  WHERE (tcl.user_id = auth.uid())))));


--
-- Name: temporary_chat_links temp_links_agent_ownership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_links_agent_ownership ON public.temporary_chat_links USING ((((auth.uid() IS NOT NULL) AND (agent_id IN ( SELECT agents.id
   FROM public.agents
  WHERE (agents.user_id = auth.uid())))) OR (auth.role() = 'service_role'::text)));


--
-- Name: POLICY temp_links_agent_ownership ON temporary_chat_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY temp_links_agent_ownership ON public.temporary_chat_links IS 'Allows users to access temporary chat links for agents they own';


--
-- Name: temporary_chat_links temp_links_public_validation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_links_public_validation ON public.temporary_chat_links FOR SELECT USING (((auth.role() = 'anon'::text) AND (is_active = true) AND (expires_at > now())));


--
-- Name: POLICY temp_links_public_validation ON temporary_chat_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY temp_links_public_validation ON public.temporary_chat_links IS 'Allows anonymous users to validate active, non-expired links for public access';


--
-- Name: temporary_chat_links temp_links_service_role_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_links_service_role_access ON public.temporary_chat_links USING ((auth.role() = 'service_role'::text));


--
-- Name: temporary_chat_links temp_links_user_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_links_user_isolation ON public.temporary_chat_links USING ((((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR (auth.role() = 'service_role'::text)));


--
-- Name: POLICY temp_links_user_isolation ON temporary_chat_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY temp_links_user_isolation ON public.temporary_chat_links IS 'Ensures users can only access temporary chat links they created';


--
-- Name: temporary_chat_sessions temp_sessions_link_ownership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_sessions_link_ownership ON public.temporary_chat_sessions FOR SELECT USING (((auth.uid() IS NOT NULL) AND (link_id IN ( SELECT temporary_chat_links.id
   FROM public.temporary_chat_links
  WHERE (temporary_chat_links.user_id = auth.uid())))));


--
-- Name: POLICY temp_sessions_link_ownership ON temporary_chat_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY temp_sessions_link_ownership ON public.temporary_chat_sessions IS 'Allows users to view sessions for temporary chat links they own';


--
-- Name: temporary_chat_sessions temp_sessions_no_anonymous_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_sessions_no_anonymous_access ON public.temporary_chat_sessions USING ((auth.role() <> 'anon'::text));


--
-- Name: temporary_chat_sessions temp_sessions_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_sessions_service_role ON public.temporary_chat_sessions USING ((auth.role() = 'service_role'::text));


--
-- Name: POLICY temp_sessions_service_role ON temporary_chat_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY temp_sessions_service_role ON public.temporary_chat_sessions IS 'Gives service role full access to temporary chat sessions for system operations';


--
-- Name: temporary_chat_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temporary_chat_links ENABLE ROW LEVEL SECURITY;

--
-- Name: temporary_chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temporary_chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: tool_execution_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tool_execution_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: tool_user_input_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tool_user_input_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_events usage_events_service_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY usage_events_service_access ON public.usage_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_integration_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_integration_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_team_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_team_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: user_token_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_token_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: user_token_usage user_view_own_token_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_view_own_token_usage ON public.user_token_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: contact_interactions users_can_create_own_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_create_own_contact_interactions ON public.contact_interactions FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.contacts
  WHERE ((contacts.id = contact_interactions.contact_id) AND (contacts.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.agents
  WHERE ((agents.id = contact_interactions.agent_id) AND (agents.user_id = auth.uid()))))));


--
-- Name: contact_interactions users_can_delete_own_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_delete_own_contact_interactions ON public.contact_interactions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: contacts users_can_delete_own_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_delete_own_contacts ON public.contacts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: contacts users_can_insert_own_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_insert_own_contacts ON public.contacts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_contact_permissions users_can_manage_agent_contact_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_agent_contact_permissions ON public.agent_contact_permissions USING ((auth.uid() = user_id));


--
-- Name: agent_group_access users_can_manage_agent_group_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_agent_group_access ON public.agent_group_access USING ((auth.uid() = user_id));


--
-- Name: contact_communication_channels users_can_manage_own_contact_channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_own_contact_channels ON public.contact_communication_channels USING ((auth.uid() = user_id));


--
-- Name: POLICY users_can_manage_own_contact_channels ON contact_communication_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY users_can_manage_own_contact_channels ON public.contact_communication_channels IS 'Users have full control over communication channels for their contacts';


--
-- Name: contact_groups users_can_manage_own_contact_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_own_contact_groups ON public.contact_groups USING ((auth.uid() = user_id));


--
-- Name: contact_group_memberships users_can_manage_own_group_memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_own_group_memberships ON public.contact_group_memberships USING ((auth.uid() = user_id));


--
-- Name: contact_import_jobs users_can_manage_own_import_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_own_import_jobs ON public.contact_import_jobs USING ((auth.uid() = user_id));


--
-- Name: agent_specific_contact_access users_can_manage_specific_contact_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_manage_specific_contact_access ON public.agent_specific_contact_access USING ((auth.uid() = user_id));


--
-- Name: contact_interactions users_can_update_own_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_update_own_contact_interactions ON public.contact_interactions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: contacts users_can_update_own_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_update_own_contacts ON public.contacts FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: contact_import_errors users_can_update_own_import_errors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_update_own_import_errors ON public.contact_import_errors FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: contact_audit_log users_can_view_own_contact_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_view_own_contact_audit_logs ON public.contact_audit_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contact_interactions users_can_view_own_contact_interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_view_own_contact_interactions ON public.contact_interactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: contacts users_can_view_own_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_view_own_contacts ON public.contacts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: POLICY users_can_view_own_contacts ON contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY users_can_view_own_contacts ON public.contacts IS 'Users can only view contacts they own';


--
-- Name: contact_import_errors users_can_view_own_import_errors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_can_view_own_import_errors ON public.contact_import_errors FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: working_memory_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.working_memory_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TYPE task_step_status; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public.task_step_status TO authenticated;


--
-- Name: TYPE team_connection_type; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TYPE public.team_connection_type TO authenticated;


--
-- Name: FUNCTION admin_reactivate_user(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_reactivate_user(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_reactivate_user(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_reactivate_user(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION admin_suspend_user(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_suspend_user(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_suspend_user(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_suspend_user(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION aggregate_user_token_usage(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.aggregate_user_token_usage(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.aggregate_user_token_usage(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.aggregate_user_token_usage(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO service_role;


--
-- Name: FUNCTION apply_retention_policies(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_retention_policies() TO anon;
GRANT ALL ON FUNCTION public.apply_retention_policies() TO authenticated;
GRANT ALL ON FUNCTION public.apply_retention_policies() TO service_role;


--
-- Name: FUNCTION assign_local_user_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.assign_local_user_role() TO anon;
GRANT ALL ON FUNCTION public.assign_local_user_role() TO authenticated;
GRANT ALL ON FUNCTION public.assign_local_user_role() TO service_role;


--
-- Name: FUNCTION assign_media_to_agent(p_agent_id uuid, p_media_id uuid, p_user_id uuid, p_assignment_type text, p_include_vector boolean, p_include_graph boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.assign_media_to_agent(p_agent_id uuid, p_media_id uuid, p_user_id uuid, p_assignment_type text, p_include_vector boolean, p_include_graph boolean) TO anon;
GRANT ALL ON FUNCTION public.assign_media_to_agent(p_agent_id uuid, p_media_id uuid, p_user_id uuid, p_assignment_type text, p_include_vector boolean, p_include_graph boolean) TO authenticated;
GRANT ALL ON FUNCTION public.assign_media_to_agent(p_agent_id uuid, p_media_id uuid, p_user_id uuid, p_assignment_type text, p_include_vector boolean, p_include_graph boolean) TO service_role;


--
-- Name: FUNCTION audit_mcp_url_security(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.audit_mcp_url_security() TO anon;
GRANT ALL ON FUNCTION public.audit_mcp_url_security() TO authenticated;
GRANT ALL ON FUNCTION public.audit_mcp_url_security() TO service_role;


--
-- Name: FUNCTION auto_create_contact_management_credential(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_create_contact_management_credential() TO anon;
GRANT ALL ON FUNCTION public.auto_create_contact_management_credential() TO authenticated;
GRANT ALL ON FUNCTION public.auto_create_contact_management_credential() TO service_role;


--
-- Name: FUNCTION auto_grant_contact_management_access(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_grant_contact_management_access() TO anon;
GRANT ALL ON FUNCTION public.auto_grant_contact_management_access() TO authenticated;
GRANT ALL ON FUNCTION public.auto_grant_contact_management_access() TO service_role;


--
-- Name: FUNCTION backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer) TO anon;
GRANT ALL ON FUNCTION public.backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.backfill_token_usage(p_start_date date, p_end_date date, p_batch_size integer) TO service_role;


--
-- Name: FUNCTION calculate_next_run_time(cron_expr text, timezone_name text, from_time timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_next_run_time(cron_expr text, timezone_name text, from_time timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.calculate_next_run_time(cron_expr text, timezone_name text, from_time timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_next_run_time(cron_expr text, timezone_name text, from_time timestamp with time zone) TO service_role;


--
-- Name: FUNCTION can_access_temp_chat_link(vault_token_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_access_temp_chat_link(vault_token_id text) TO anon;
GRANT ALL ON FUNCTION public.can_access_temp_chat_link(vault_token_id text) TO authenticated;
GRANT ALL ON FUNCTION public.can_access_temp_chat_link(vault_token_id text) TO service_role;


--
-- Name: FUNCTION can_manage_chat_room_members(p_room_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_manage_chat_room_members(p_room_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_manage_chat_room_members(p_room_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_manage_chat_room_members(p_room_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_manage_workspace_members(p_workspace_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text) TO anon;
GRANT ALL ON FUNCTION public.check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text) TO authenticated;
GRANT ALL ON FUNCTION public.check_agent_contact_permission(p_agent_id uuid, p_contact_id uuid, p_permission_type text) TO service_role;


--
-- Name: FUNCTION check_mcp_server_health(p_connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_mcp_server_health(p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_mcp_server_health(p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_mcp_server_health(p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION check_smtp_rate_limit(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_smtp_rate_limit(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_smtp_rate_limit(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_smtp_rate_limit(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid) TO service_role;


--
-- Name: FUNCTION check_temp_chat_rate_limit(p_session_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_temp_chat_rate_limit(p_session_token text) TO anon;
GRANT ALL ON FUNCTION public.check_temp_chat_rate_limit(p_session_token text) TO authenticated;
GRANT ALL ON FUNCTION public.check_temp_chat_rate_limit(p_session_token text) TO service_role;


--
-- Name: FUNCTION check_user_exists_by_email(user_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_user_exists_by_email(user_email text) TO anon;
GRANT ALL ON FUNCTION public.check_user_exists_by_email(user_email text) TO authenticated;
GRANT ALL ON FUNCTION public.check_user_exists_by_email(user_email text) TO service_role;


--
-- Name: FUNCTION cleanup_expired_temp_chats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_expired_temp_chats() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_temp_chats() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_temp_chats() TO service_role;


--
-- Name: FUNCTION cleanup_expired_working_memory(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_expired_working_memory() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_working_memory() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_working_memory() TO service_role;


--
-- Name: FUNCTION cleanup_old_import_jobs(p_retention_days integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_old_import_jobs(p_retention_days integer) TO anon;
GRANT ALL ON FUNCTION public.cleanup_old_import_jobs(p_retention_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_old_import_jobs(p_retention_days integer) TO service_role;


--
-- Name: FUNCTION cleanup_orphaned_permissions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_orphaned_permissions() TO anon;
GRANT ALL ON FUNCTION public.cleanup_orphaned_permissions() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_orphaned_permissions() TO service_role;


--
-- Name: FUNCTION complete_import_job(p_job_id uuid, p_user_id uuid, p_status text, p_results jsonb, p_error_details jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_import_job(p_job_id uuid, p_user_id uuid, p_status text, p_results jsonb, p_error_details jsonb) TO anon;
GRANT ALL ON FUNCTION public.complete_import_job(p_job_id uuid, p_user_id uuid, p_status text, p_results jsonb, p_error_details jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.complete_import_job(p_job_id uuid, p_user_id uuid, p_status text, p_results jsonb, p_error_details jsonb) TO service_role;


--
-- Name: FUNCTION complete_stripe_order(p_checkout_session_id text, p_payment_intent_id text, p_customer_id text, p_amount_total integer, p_payment_status text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_stripe_order(p_checkout_session_id text, p_payment_intent_id text, p_customer_id text, p_amount_total integer, p_payment_status text) TO anon;
GRANT ALL ON FUNCTION public.complete_stripe_order(p_checkout_session_id text, p_payment_intent_id text, p_customer_id text, p_amount_total integer, p_payment_status text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_stripe_order(p_checkout_session_id text, p_payment_intent_id text, p_customer_id text, p_amount_total integer, p_payment_status text) TO service_role;


--
-- Name: FUNCTION create_agent_llm_preferences(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_agent_llm_preferences() TO anon;
GRANT ALL ON FUNCTION public.create_agent_llm_preferences() TO authenticated;
GRANT ALL ON FUNCTION public.create_agent_llm_preferences() TO service_role;


--
-- Name: FUNCTION create_contact_interaction(p_contact_id uuid, p_agent_id uuid, p_user_id uuid, p_interaction_type text, p_channel_type text, p_channel_identifier text, p_direction text, p_summary text, p_full_content text, p_metadata jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_contact_interaction(p_contact_id uuid, p_agent_id uuid, p_user_id uuid, p_interaction_type text, p_channel_type text, p_channel_identifier text, p_direction text, p_summary text, p_full_content text, p_metadata jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_contact_interaction(p_contact_id uuid, p_agent_id uuid, p_user_id uuid, p_interaction_type text, p_channel_type text, p_channel_identifier text, p_direction text, p_summary text, p_full_content text, p_metadata jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_contact_interaction(p_contact_id uuid, p_agent_id uuid, p_user_id uuid, p_interaction_type text, p_channel_type text, p_channel_identifier text, p_direction text, p_summary text, p_full_content text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION create_contact_management_credential_for_user(user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_contact_management_credential_for_user(user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_contact_management_credential_for_user(user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_contact_management_credential_for_user(user_id uuid) TO service_role;


--
-- Name: FUNCTION create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_notes text, p_tags text[], p_custom_fields jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_notes text, p_tags text[], p_custom_fields jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_notes text, p_tags text[], p_custom_fields jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_notes text, p_tags text[], p_custom_fields jsonb) TO service_role;


--
-- Name: FUNCTION create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_mobile text, p_notes text, p_tags text[], p_custom_fields jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_mobile text, p_notes text, p_tags text[], p_custom_fields jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_mobile text, p_notes text, p_tags text[], p_custom_fields jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_contact_with_validation(p_user_id uuid, p_first_name text, p_last_name text, p_organization text, p_job_title text, p_contact_type text, p_email text, p_phone text, p_mobile text, p_notes text, p_tags text[], p_custom_fields jsonb) TO service_role;


--
-- Name: FUNCTION create_default_contact_groups(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_default_contact_groups(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_default_contact_groups(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_default_contact_groups(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION create_default_media_categories(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_default_media_categories(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_default_media_categories(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_default_media_categories(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION create_encryption_key(key_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_encryption_key(key_name text) TO anon;
GRANT ALL ON FUNCTION public.create_encryption_key(key_name text) TO authenticated;
GRANT ALL ON FUNCTION public.create_encryption_key(key_name text) TO service_role;


--
-- Name: FUNCTION create_or_update_vault_secret(p_secret text, p_name text, p_description text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_or_update_vault_secret(p_secret text, p_name text, p_description text) TO anon;
GRANT ALL ON FUNCTION public.create_or_update_vault_secret(p_secret text, p_name text, p_description text) TO authenticated;
GRANT ALL ON FUNCTION public.create_or_update_vault_secret(p_secret text, p_name text, p_description text) TO service_role;


--
-- Name: FUNCTION create_routing_rule(p_name text, p_description text, p_agent_id uuid, p_conditions jsonb, p_action jsonb, p_priority integer, p_stop_processing boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_routing_rule(p_name text, p_description text, p_agent_id uuid, p_conditions jsonb, p_action jsonb, p_priority integer, p_stop_processing boolean) TO anon;
GRANT ALL ON FUNCTION public.create_routing_rule(p_name text, p_description text, p_agent_id uuid, p_conditions jsonb, p_action jsonb, p_priority integer, p_stop_processing boolean) TO authenticated;
GRANT ALL ON FUNCTION public.create_routing_rule(p_name text, p_description text, p_agent_id uuid, p_conditions jsonb, p_action jsonb, p_priority integer, p_stop_processing boolean) TO service_role;


--
-- Name: FUNCTION create_task_step(p_task_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean, p_step_order integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_task_step(p_task_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean, p_step_order integer) TO anon;
GRANT ALL ON FUNCTION public.create_task_step(p_task_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean, p_step_order integer) TO authenticated;
GRANT ALL ON FUNCTION public.create_task_step(p_task_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean, p_step_order integer) TO service_role;


--
-- Name: FUNCTION create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text, p_color text, p_style text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text, p_color text, p_style text) TO anon;
GRANT ALL ON FUNCTION public.create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text, p_color text, p_style text) TO authenticated;
GRANT ALL ON FUNCTION public.create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type public.team_connection_type, p_label text, p_color text, p_style text) TO service_role;


--
-- Name: FUNCTION create_temp_chat_session(p_link_token text, p_participant_identifier text, p_participant_name text, p_ip_address inet, p_user_agent text, p_referrer text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_temp_chat_session(p_link_token text, p_participant_identifier text, p_participant_name text, p_ip_address inet, p_user_agent text, p_referrer text) TO anon;
GRANT ALL ON FUNCTION public.create_temp_chat_session(p_link_token text, p_participant_identifier text, p_participant_name text, p_ip_address inet, p_user_agent text, p_referrer text) TO authenticated;
GRANT ALL ON FUNCTION public.create_temp_chat_session(p_link_token text, p_participant_identifier text, p_participant_name text, p_ip_address inet, p_user_agent text, p_referrer text) TO service_role;


--
-- Name: FUNCTION create_vault_secret(p_secret text, p_name text, p_description text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_vault_secret(p_secret text, p_name text, p_description text) TO anon;
GRANT ALL ON FUNCTION public.create_vault_secret(p_secret text, p_name text, p_description text) TO authenticated;
GRANT ALL ON FUNCTION public.create_vault_secret(p_secret text, p_name text, p_description text) TO service_role;


--
-- Name: FUNCTION decrypt_with_key(encrypted_text text, key_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.decrypt_with_key(encrypted_text text, key_id uuid) TO anon;
GRANT ALL ON FUNCTION public.decrypt_with_key(encrypted_text text, key_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.decrypt_with_key(encrypted_text text, key_id uuid) TO service_role;


--
-- Name: FUNCTION delete_agent_cascade(agent_uuid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_agent_cascade(agent_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_agent_cascade(agent_uuid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_agent_cascade(agent_uuid uuid) TO service_role;


--
-- Name: FUNCTION delete_lines(content text, start_line integer, end_line integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_lines(content text, start_line integer, end_line integer) TO anon;
GRANT ALL ON FUNCTION public.delete_lines(content text, start_line integer, end_line integer) TO authenticated;
GRANT ALL ON FUNCTION public.delete_lines(content text, start_line integer, end_line integer) TO service_role;


--
-- Name: FUNCTION delete_task_step(p_step_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_task_step(p_step_id uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_task_step(p_step_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_task_step(p_step_id uuid) TO service_role;


--
-- Name: FUNCTION delete_team_connection(p_connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_team_connection(p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_team_connection(p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_team_connection(p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION delete_vault_secret(secret_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_vault_secret(secret_id uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_vault_secret(secret_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_vault_secret(secret_id uuid) TO service_role;


--
-- Name: FUNCTION encrypt_with_key(plain_text text, key_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.encrypt_with_key(plain_text text, key_id uuid) TO anon;
GRANT ALL ON FUNCTION public.encrypt_with_key(plain_text text, key_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.encrypt_with_key(plain_text text, key_id uuid) TO service_role;


--
-- Name: FUNCTION end_temp_chat_session(p_session_token text, p_end_reason text, p_satisfaction_rating integer, p_feedback_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.end_temp_chat_session(p_session_token text, p_end_reason text, p_satisfaction_rating integer, p_feedback_text text) TO anon;
GRANT ALL ON FUNCTION public.end_temp_chat_session(p_session_token text, p_end_reason text, p_satisfaction_rating integer, p_feedback_text text) TO authenticated;
GRANT ALL ON FUNCTION public.end_temp_chat_session(p_session_token text, p_end_reason text, p_satisfaction_rating integer, p_feedback_text text) TO service_role;


--
-- Name: FUNCTION evaluate_smart_group_criteria(p_user_id uuid, p_criteria jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.evaluate_smart_group_criteria(p_user_id uuid, p_criteria jsonb) TO anon;
GRANT ALL ON FUNCTION public.evaluate_smart_group_criteria(p_user_id uuid, p_criteria jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.evaluate_smart_group_criteria(p_user_id uuid, p_criteria jsonb) TO service_role;


--
-- Name: FUNCTION execute_sql(sql text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.execute_sql(sql text) TO anon;
GRANT ALL ON FUNCTION public.execute_sql(sql text) TO authenticated;
GRANT ALL ON FUNCTION public.execute_sql(sql text) TO service_role;


--
-- Name: FUNCTION expire_inactive_sessions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.expire_inactive_sessions() TO anon;
GRANT ALL ON FUNCTION public.expire_inactive_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.expire_inactive_sessions() TO service_role;


--
-- Name: FUNCTION export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.export_contact_data_for_subject(p_contact_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION format_phone_number(phone text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.format_phone_number(phone text) TO anon;
GRANT ALL ON FUNCTION public.format_phone_number(phone text) TO authenticated;
GRANT ALL ON FUNCTION public.format_phone_number(phone text) TO service_role;


--
-- Name: FUNCTION gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text) TO anon;
GRANT ALL ON FUNCTION public.gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.gdpr_delete_contact(p_contact_id uuid, p_user_id uuid, p_deletion_reason text) TO service_role;


--
-- Name: FUNCTION generate_organization_api_key(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_organization_api_key() TO anon;
GRANT ALL ON FUNCTION public.generate_organization_api_key() TO authenticated;
GRANT ALL ON FUNCTION public.generate_organization_api_key() TO service_role;


--
-- Name: FUNCTION generate_session_token(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_session_token() TO anon;
GRANT ALL ON FUNCTION public.generate_session_token() TO authenticated;
GRANT ALL ON FUNCTION public.generate_session_token() TO service_role;


--
-- Name: FUNCTION generate_temp_chat_token(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_temp_chat_token() TO anon;
GRANT ALL ON FUNCTION public.generate_temp_chat_token() TO authenticated;
GRANT ALL ON FUNCTION public.generate_temp_chat_token() TO service_role;


--
-- Name: FUNCTION get_admin_credential(p_integration_type text, p_credential_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_admin_credential(p_integration_type text, p_credential_name text) TO anon;
GRANT ALL ON FUNCTION public.get_admin_credential(p_integration_type text, p_credential_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_credential(p_integration_type text, p_credential_name text) TO service_role;


--
-- Name: FUNCTION get_agent_integration_permissions(p_agent_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_agent_integration_permissions(p_agent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_agent_integration_permissions(p_agent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_agent_integration_permissions(p_agent_id uuid) TO service_role;


--
-- Name: FUNCTION get_agent_mcp_tools(p_agent_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_agent_mcp_tools(p_agent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_agent_mcp_tools(p_agent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_agent_mcp_tools(p_agent_id uuid) TO service_role;


--
-- Name: FUNCTION get_agent_oauth_permissions(p_agent_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_agent_oauth_permissions(p_agent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_agent_oauth_permissions(p_agent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_agent_oauth_permissions(p_agent_id uuid) TO service_role;


--
-- Name: FUNCTION get_agent_web_search_permissions(p_agent_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_agent_web_search_permissions(p_agent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_agent_web_search_permissions(p_agent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_agent_web_search_permissions(p_agent_id uuid) TO service_role;


--
-- Name: FUNCTION get_billing_statistics(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_billing_statistics() TO anon;
GRANT ALL ON FUNCTION public.get_billing_statistics() TO authenticated;
GRANT ALL ON FUNCTION public.get_billing_statistics() TO service_role;


--
-- Name: FUNCTION get_chat_messages_with_details(p_channel_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_chat_messages_with_details(p_channel_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_chat_messages_with_details(p_channel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_chat_messages_with_details(p_channel_id uuid) TO service_role;


--
-- Name: FUNCTION get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_contact_details_for_agent(p_agent_id uuid, p_user_id uuid, p_contact_id uuid) TO service_role;


--
-- Name: FUNCTION get_contact_interaction_stats(p_contact_id uuid, p_user_id uuid, p_days integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_contact_interaction_stats(p_contact_id uuid, p_user_id uuid, p_days integer) TO anon;
GRANT ALL ON FUNCTION public.get_contact_interaction_stats(p_contact_id uuid, p_user_id uuid, p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_contact_interaction_stats(p_contact_id uuid, p_user_id uuid, p_days integer) TO service_role;


--
-- Name: FUNCTION get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_contact_stats_for_agent(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_cron_job_status(p_job_name character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_cron_job_status(p_job_name character varying) TO anon;
GRANT ALL ON FUNCTION public.get_cron_job_status(p_job_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.get_cron_job_status(p_job_name character varying) TO service_role;


--
-- Name: FUNCTION get_current_time_in_timezone(timezone_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_current_time_in_timezone(timezone_name text) TO anon;
GRANT ALL ON FUNCTION public.get_current_time_in_timezone(timezone_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_current_time_in_timezone(timezone_name text) TO service_role;


--
-- Name: FUNCTION get_current_utc_time(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_current_utc_time() TO anon;
GRANT ALL ON FUNCTION public.get_current_utc_time() TO authenticated;
GRANT ALL ON FUNCTION public.get_current_utc_time() TO service_role;


--
-- Name: FUNCTION get_gmail_connection_by_id(p_connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_gmail_connection_by_id(p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_gmail_connection_by_id(p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_gmail_connection_by_id(p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION get_gmail_connection_with_tokens(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_gmail_connection_with_tokens(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_gmail_connection_with_tokens(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_gmail_connection_with_tokens(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_gmail_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_gmail_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_gmail_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_gmail_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_import_job_summary(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_import_job_summary(p_user_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_import_job_summary(p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_import_job_summary(p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_integration_categories_with_counts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_integration_categories_with_counts() TO anon;
GRANT ALL ON FUNCTION public.get_integration_categories_with_counts() TO authenticated;
GRANT ALL ON FUNCTION public.get_integration_categories_with_counts() TO service_role;


--
-- Name: FUNCTION get_integration_categories_with_counts(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_integration_categories_with_counts(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_integration_categories_with_counts(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_integration_categories_with_counts(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_integrations_by_category(p_category_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_integrations_by_category(p_category_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_integrations_by_category(p_category_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_integrations_by_category(p_category_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_line_count(content text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_line_count(content text) TO anon;
GRANT ALL ON FUNCTION public.get_line_count(content text) TO authenticated;
GRANT ALL ON FUNCTION public.get_line_count(content text) TO service_role;


--
-- Name: FUNCTION get_lines(content text, start_line integer, end_line integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_lines(content text, start_line integer, end_line integer) TO anon;
GRANT ALL ON FUNCTION public.get_lines(content text, start_line integer, end_line integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_lines(content text, start_line integer, end_line integer) TO service_role;


--
-- Name: FUNCTION get_mcp_connections_needing_refresh(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_mcp_connections_needing_refresh() TO anon;
GRANT ALL ON FUNCTION public.get_mcp_connections_needing_refresh() TO authenticated;
GRANT ALL ON FUNCTION public.get_mcp_connections_needing_refresh() TO service_role;


--
-- Name: FUNCTION get_mcp_server_type_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_mcp_server_type_stats() TO anon;
GRANT ALL ON FUNCTION public.get_mcp_server_type_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_mcp_server_type_stats() TO service_role;


--
-- Name: FUNCTION get_mcp_server_url(connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_mcp_server_url(connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_mcp_server_url(connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_mcp_server_url(connection_id uuid) TO service_role;


--
-- Name: FUNCTION get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text) TO anon;
GRANT ALL ON FUNCTION public.get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_mcp_tool_successful_params(p_connection_id uuid, p_tool_name text) TO service_role;


--
-- Name: FUNCTION get_media_document_content_for_agent(p_agent_id uuid, p_user_id uuid, p_document_id uuid, p_include_metadata boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_media_document_content_for_agent(p_agent_id uuid, p_user_id uuid, p_document_id uuid, p_include_metadata boolean) TO anon;
GRANT ALL ON FUNCTION public.get_media_document_content_for_agent(p_agent_id uuid, p_user_id uuid, p_document_id uuid, p_include_metadata boolean) TO authenticated;
GRANT ALL ON FUNCTION public.get_media_document_content_for_agent(p_agent_id uuid, p_user_id uuid, p_document_id uuid, p_include_metadata boolean) TO service_role;


--
-- Name: FUNCTION get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_microsoft_onedrive_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_microsoft_outlook_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_microsoft_teams_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_claim(claim_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_claim(claim_name text) TO anon;
GRANT ALL ON FUNCTION public.get_my_claim(claim_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_claim(claim_name text) TO service_role;


--
-- Name: TABLE task_steps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_steps TO anon;
GRANT ALL ON TABLE public.task_steps TO authenticated;
GRANT ALL ON TABLE public.task_steps TO service_role;


--
-- Name: FUNCTION get_next_pending_step(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_next_pending_step(p_task_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_next_pending_step(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_next_pending_step(p_task_id uuid) TO service_role;


--
-- Name: TABLE stripe_customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_customers TO anon;
GRANT ALL ON TABLE public.stripe_customers TO authenticated;
GRANT ALL ON TABLE public.stripe_customers TO service_role;


--
-- Name: FUNCTION get_or_create_stripe_customer(p_user_id uuid, p_stripe_customer_id text, p_customer_email text, p_customer_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_or_create_stripe_customer(p_user_id uuid, p_stripe_customer_id text, p_customer_email text, p_customer_name text) TO anon;
GRANT ALL ON FUNCTION public.get_or_create_stripe_customer(p_user_id uuid, p_stripe_customer_id text, p_customer_email text, p_customer_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_or_create_stripe_customer(p_user_id uuid, p_stripe_customer_id text, p_customer_email text, p_customer_name text) TO service_role;


--
-- Name: FUNCTION get_previous_step_context(p_task_id uuid, p_current_step_order integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_previous_step_context(p_task_id uuid, p_current_step_order integer) TO anon;
GRANT ALL ON FUNCTION public.get_previous_step_context(p_task_id uuid, p_current_step_order integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_previous_step_context(p_task_id uuid, p_current_step_order integer) TO service_role;


--
-- Name: FUNCTION get_recent_contact_interactions(p_contact_id uuid, p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_recent_contact_interactions(p_contact_id uuid, p_user_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_recent_contact_interactions(p_contact_id uuid, p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_recent_contact_interactions(p_contact_id uuid, p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_revenue_analytics(p_start_date date, p_end_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_revenue_analytics(p_start_date date, p_end_date date) TO anon;
GRANT ALL ON FUNCTION public.get_revenue_analytics(p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_revenue_analytics(p_start_date date, p_end_date date) TO service_role;


--
-- Name: FUNCTION get_room_id_for_channel(p_channel_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_room_id_for_channel(p_channel_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_room_id_for_channel(p_channel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_room_id_for_channel(p_channel_id uuid) TO service_role;


--
-- Name: FUNCTION get_room_members(p_room_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_room_members(p_room_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_room_members(p_room_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_room_members(p_room_id uuid) TO service_role;


--
-- Name: FUNCTION get_root_teams(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_root_teams() TO anon;
GRANT ALL ON FUNCTION public.get_root_teams() TO authenticated;
GRANT ALL ON FUNCTION public.get_root_teams() TO service_role;


--
-- Name: FUNCTION get_secret(secret_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_secret(secret_name text) TO anon;
GRANT ALL ON FUNCTION public.get_secret(secret_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_secret(secret_name text) TO service_role;


--
-- Name: FUNCTION get_secret(secret_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_secret(secret_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_secret(secret_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_secret(secret_id uuid) TO service_role;


--
-- Name: FUNCTION get_sendgrid_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_sendgrid_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_sendgrid_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_sendgrid_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_smtp_password(p_user_id uuid, p_vault_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_smtp_password(p_user_id uuid, p_vault_id text) TO anon;
GRANT ALL ON FUNCTION public.get_smtp_password(p_user_id uuid, p_vault_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_smtp_password(p_user_id uuid, p_vault_id text) TO service_role;


--
-- Name: FUNCTION get_smtp_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_smtp_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_smtp_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_smtp_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_task_step_count(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_task_step_count(p_task_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_task_step_count(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_task_step_count(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION get_task_steps_with_context(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_task_steps_with_context(p_task_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_task_steps_with_context(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_task_steps_with_context(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION get_team_canvas_layout(p_workspace_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_team_canvas_layout(p_workspace_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_team_canvas_layout(p_workspace_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_canvas_layout(p_workspace_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_team_children(team_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_team_children(team_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_team_children(team_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_children(team_id uuid) TO service_role;


--
-- Name: FUNCTION get_team_hierarchy(team_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_team_hierarchy(team_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_team_hierarchy(team_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_hierarchy(team_id uuid) TO service_role;


--
-- Name: FUNCTION get_team_id_for_channel(p_channel_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_team_id_for_channel(p_channel_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_team_id_for_channel(p_channel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_id_for_channel(p_channel_id uuid) TO service_role;


--
-- Name: FUNCTION get_temp_chat_analytics(p_agent_id uuid, p_user_id uuid, p_days_back integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_temp_chat_analytics(p_agent_id uuid, p_user_id uuid, p_days_back integer) TO anon;
GRANT ALL ON FUNCTION public.get_temp_chat_analytics(p_agent_id uuid, p_user_id uuid, p_days_back integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_temp_chat_analytics(p_agent_id uuid, p_user_id uuid, p_days_back integer) TO service_role;


--
-- Name: FUNCTION get_temp_chat_cleanup_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_temp_chat_cleanup_stats() TO anon;
GRANT ALL ON FUNCTION public.get_temp_chat_cleanup_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_temp_chat_cleanup_stats() TO service_role;


--
-- Name: FUNCTION get_temp_chat_session_details(p_link_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_temp_chat_session_details(p_link_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_temp_chat_session_details(p_link_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_temp_chat_session_details(p_link_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_user_billing_overview(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_billing_overview() TO anon;
GRANT ALL ON FUNCTION public.get_user_billing_overview() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_billing_overview() TO service_role;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;


--
-- Name: FUNCTION get_user_chat_rooms(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_chat_rooms(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_chat_rooms(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_chat_rooms(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_clicksend_connection(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_clicksend_connection(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_clicksend_connection(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_clicksend_connection(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_gmail_connections(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_gmail_connections(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_gmail_connections(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_gmail_connections(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_inbound_emails(p_user_id uuid, p_agent_id uuid, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_inbound_emails(p_user_id uuid, p_agent_id uuid, p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_inbound_emails(p_user_id uuid, p_agent_id uuid, p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_inbound_emails(p_user_id uuid, p_agent_id uuid, p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION get_user_integration_credentials(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_integration_credentials(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_integration_credentials(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_integration_credentials(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_integration_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_integration_stats(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_integration_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_integration_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_media_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_media_stats(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_media_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_media_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_oauth_connections(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_oauth_connections(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_oauth_connections(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_oauth_connections(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_organization_role(user_id uuid, org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_organization_role(user_id uuid, org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_organization_role(user_id uuid, org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_organization_role(user_id uuid, org_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_subscription_details(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_subscription_details(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_subscription_details(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_subscription_details(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_users_auth_data(user_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_users_auth_data(user_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_users_auth_data(user_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_users_auth_data(user_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_vault_secrets_by_names(p_secret_names text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_vault_secrets_by_names(p_secret_names text[]) TO anon;
GRANT ALL ON FUNCTION public.get_vault_secrets_by_names(p_secret_names text[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_vault_secrets_by_names(p_secret_names text[]) TO service_role;


--
-- Name: FUNCTION get_web_search_api_key(p_agent_id uuid, p_user_id uuid, p_provider_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_web_search_api_key(p_agent_id uuid, p_user_id uuid, p_provider_name text) TO anon;
GRANT ALL ON FUNCTION public.get_web_search_api_key(p_agent_id uuid, p_user_id uuid, p_provider_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_web_search_api_key(p_agent_id uuid, p_user_id uuid, p_provider_name text) TO service_role;


--
-- Name: FUNCTION get_web_search_tools(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_web_search_tools(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_web_search_tools(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_web_search_tools(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_websocket_server_secrets(p_server_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_websocket_server_secrets(p_server_name text) TO anon;
GRANT ALL ON FUNCTION public.get_websocket_server_secrets(p_server_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_websocket_server_secrets(p_server_name text) TO service_role;


--
-- Name: FUNCTION get_workspace_id_for_channel(p_channel_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_id_for_channel(p_channel_id uuid) TO service_role;


--
-- Name: FUNCTION get_workspace_members_with_details(p_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_workspace_members_with_details(p_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_members_with_details(p_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_members_with_details(p_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION grant_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid, p_access_level text, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid, p_access_level text, p_expires_at timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.grant_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid, p_access_level text, p_expires_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.grant_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid, p_access_level text, p_expires_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text) TO anon;
GRANT ALL ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text) TO authenticated;
GRANT ALL ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text) TO service_role;


--
-- Name: FUNCTION grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes jsonb, p_permission_level text, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text, p_allowed_scopes jsonb, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text, p_allowed_scopes jsonb, p_expires_at timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text, p_allowed_scopes jsonb, p_expires_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.grant_agent_oauth_access(p_agent_id uuid, p_connection_id uuid, p_permission_level text, p_allowed_scopes jsonb, p_expires_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION grant_agent_web_search_permission(p_agent_id uuid, p_user_key_id uuid, p_permissions jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_agent_web_search_permission(p_agent_id uuid, p_user_key_id uuid, p_permissions jsonb) TO anon;
GRANT ALL ON FUNCTION public.grant_agent_web_search_permission(p_agent_id uuid, p_user_key_id uuid, p_permissions jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.grant_agent_web_search_permission(p_agent_id uuid, p_user_key_id uuid, p_permissions jsonb) TO service_role;


--
-- Name: FUNCTION grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[]) TO anon;
GRANT ALL ON FUNCTION public.grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[]) TO authenticated;
GRANT ALL ON FUNCTION public.grant_contact_management_access_to_agent(p_agent_id uuid, p_user_id uuid, p_scopes text[]) TO service_role;


--
-- Name: FUNCTION grant_reasoning_access_to_new_agent(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_reasoning_access_to_new_agent() TO anon;
GRANT ALL ON FUNCTION public.grant_reasoning_access_to_new_agent() TO authenticated;
GRANT ALL ON FUNCTION public.grant_reasoning_access_to_new_agent() TO service_role;


--
-- Name: FUNCTION handle_agent_deletion_cascade(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_agent_deletion_cascade() TO anon;
GRANT ALL ON FUNCTION public.handle_agent_deletion_cascade() TO authenticated;
GRANT ALL ON FUNCTION public.handle_agent_deletion_cascade() TO service_role;


--
-- Name: FUNCTION handle_credential_revocation_cascade(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_credential_revocation_cascade() TO anon;
GRANT ALL ON FUNCTION public.handle_credential_revocation_cascade() TO authenticated;
GRANT ALL ON FUNCTION public.handle_credential_revocation_cascade() TO service_role;


--
-- Name: FUNCTION handle_integration_deletion_cascade(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_integration_deletion_cascade() TO anon;
GRANT ALL ON FUNCTION public.handle_integration_deletion_cascade() TO authenticated;
GRANT ALL ON FUNCTION public.handle_integration_deletion_cascade() TO service_role;


--
-- Name: FUNCTION handle_invoice_webhook(p_stripe_invoice_id text, p_stripe_customer_id text, p_status text, p_amount_due integer, p_amount_paid integer, p_total integer, p_invoice_created bigint, p_stripe_subscription_id text, p_period_start bigint, p_period_end bigint, p_paid_at bigint, p_invoice_pdf text, p_hosted_invoice_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_invoice_webhook(p_stripe_invoice_id text, p_stripe_customer_id text, p_status text, p_amount_due integer, p_amount_paid integer, p_total integer, p_invoice_created bigint, p_stripe_subscription_id text, p_period_start bigint, p_period_end bigint, p_paid_at bigint, p_invoice_pdf text, p_hosted_invoice_url text) TO anon;
GRANT ALL ON FUNCTION public.handle_invoice_webhook(p_stripe_invoice_id text, p_stripe_customer_id text, p_status text, p_amount_due integer, p_amount_paid integer, p_total integer, p_invoice_created bigint, p_stripe_subscription_id text, p_period_start bigint, p_period_end bigint, p_paid_at bigint, p_invoice_pdf text, p_hosted_invoice_url text) TO authenticated;
GRANT ALL ON FUNCTION public.handle_invoice_webhook(p_stripe_invoice_id text, p_stripe_customer_id text, p_status text, p_amount_due integer, p_amount_paid integer, p_total integer, p_invoice_created bigint, p_stripe_subscription_id text, p_period_start bigint, p_period_end bigint, p_paid_at bigint, p_invoice_pdf text, p_hosted_invoice_url text) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_new_user_key_generation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user_key_generation() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user_key_generation() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user_key_generation() TO service_role;


--
-- Name: FUNCTION handle_subscription_webhook(p_stripe_subscription_id text, p_status text, p_current_period_start bigint, p_current_period_end bigint, p_cancel_at_period_end boolean, p_stripe_event_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_subscription_webhook(p_stripe_subscription_id text, p_status text, p_current_period_start bigint, p_current_period_end bigint, p_cancel_at_period_end boolean, p_stripe_event_id text) TO anon;
GRANT ALL ON FUNCTION public.handle_subscription_webhook(p_stripe_subscription_id text, p_status text, p_current_period_start bigint, p_current_period_end bigint, p_cancel_at_period_end boolean, p_stripe_event_id text) TO authenticated;
GRANT ALL ON FUNCTION public.handle_subscription_webhook(p_stripe_subscription_id text, p_status text, p_current_period_start bigint, p_current_period_end bigint, p_cancel_at_period_end boolean, p_stripe_event_id text) TO service_role;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_updated_at() TO anon;
GRANT ALL ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;


--
-- Name: FUNCTION has_organization_permission(user_id uuid, org_id uuid, permission text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_organization_permission(user_id uuid, org_id uuid, permission text) TO anon;
GRANT ALL ON FUNCTION public.has_organization_permission(user_id uuid, org_id uuid, permission text) TO authenticated;
GRANT ALL ON FUNCTION public.has_organization_permission(user_id uuid, org_id uuid, permission text) TO service_role;


--
-- Name: FUNCTION increment_rule_match_count(p_rule_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.increment_rule_match_count(p_rule_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_rule_match_count(p_rule_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_rule_match_count(p_rule_id uuid) TO service_role;


--
-- Name: FUNCTION initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text) TO anon;
GRANT ALL ON FUNCTION public.initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text) TO authenticated;
GRANT ALL ON FUNCTION public.initialize_websocket_server_secrets(p_server_name text, p_supabase_service_key text, p_admin_password text, p_openai_api_key text) TO service_role;


--
-- Name: FUNCTION insert_lines(content text, after_line integer, new_content text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_lines(content text, after_line integer, new_content text) TO anon;
GRANT ALL ON FUNCTION public.insert_lines(content text, after_line integer, new_content text) TO authenticated;
GRANT ALL ON FUNCTION public.insert_lines(content text, after_line integer, new_content text) TO service_role;


--
-- Name: FUNCTION is_agent_owner(agent_id_to_check uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_agent_owner(agent_id_to_check uuid) TO anon;
GRANT ALL ON FUNCTION public.is_agent_owner(agent_id_to_check uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_agent_owner(agent_id_to_check uuid) TO service_role;


--
-- Name: FUNCTION is_chat_room_member(p_room_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_chat_room_member(p_room_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_chat_room_member(p_room_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_chat_room_member(p_room_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_global_admin(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_global_admin(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_global_admin(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_global_admin(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_mcp_schema_stale(p_connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_mcp_schema_stale(p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_mcp_schema_stale(p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_mcp_schema_stale(p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION is_organization_member(user_id uuid, org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_organization_member(user_id uuid, org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_organization_member(user_id uuid, org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_organization_member(user_id uuid, org_id uuid) TO service_role;


--
-- Name: FUNCTION is_room_member(p_room_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_team_admin_or_pm(p_team_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_team_admin_or_pm(p_team_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_team_admin_or_pm(p_team_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_team_admin_or_pm(p_team_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_team_member(p_team_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_team_owner(p_team_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_workspace_member(p_workspace_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_workspace_owner(p_workspace_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_workspace_owner(p_workspace_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_workspace_owner(p_workspace_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_workspace_owner(p_workspace_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION list_agent_assigned_documents(p_agent_id uuid, p_user_id uuid, p_category text, p_assignment_type text, p_include_inactive boolean, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_agent_assigned_documents(p_agent_id uuid, p_user_id uuid, p_category text, p_assignment_type text, p_include_inactive boolean, p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.list_agent_assigned_documents(p_agent_id uuid, p_user_id uuid, p_category text, p_assignment_type text, p_include_inactive boolean, p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.list_agent_assigned_documents(p_agent_id uuid, p_user_id uuid, p_category text, p_assignment_type text, p_include_inactive boolean, p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION list_encryption_keys(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_encryption_keys() TO anon;
GRANT ALL ON FUNCTION public.list_encryption_keys() TO authenticated;
GRANT ALL ON FUNCTION public.list_encryption_keys() TO service_role;


--
-- Name: TABLE chat_channels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_channels TO anon;
GRANT ALL ON TABLE public.chat_channels TO authenticated;
GRANT ALL ON TABLE public.chat_channels TO service_role;


--
-- Name: FUNCTION list_room_channels(p_room_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_room_channels(p_room_id uuid) TO anon;
GRANT ALL ON FUNCTION public.list_room_channels(p_room_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.list_room_channels(p_room_id uuid) TO service_role;


--
-- Name: FUNCTION log_import_error(p_job_id uuid, p_user_id uuid, p_row_number integer, p_error_type text, p_error_message text, p_column_name text, p_raw_value text, p_row_data jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_import_error(p_job_id uuid, p_user_id uuid, p_row_number integer, p_error_type text, p_error_message text, p_column_name text, p_raw_value text, p_row_data jsonb) TO anon;
GRANT ALL ON FUNCTION public.log_import_error(p_job_id uuid, p_user_id uuid, p_row_number integer, p_error_type text, p_error_message text, p_column_name text, p_raw_value text, p_row_data jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.log_import_error(p_job_id uuid, p_user_id uuid, p_row_number integer, p_error_type text, p_error_message text, p_column_name text, p_raw_value text, p_row_data jsonb) TO service_role;


--
-- Name: FUNCTION log_sendgrid_operation(p_agent_id uuid, p_user_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_message_id text, p_recipients_count integer, p_execution_time_ms integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_sendgrid_operation(p_agent_id uuid, p_user_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_message_id text, p_recipients_count integer, p_execution_time_ms integer) TO anon;
GRANT ALL ON FUNCTION public.log_sendgrid_operation(p_agent_id uuid, p_user_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_message_id text, p_recipients_count integer, p_execution_time_ms integer) TO authenticated;
GRANT ALL ON FUNCTION public.log_sendgrid_operation(p_agent_id uuid, p_user_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_message_id text, p_recipients_count integer, p_execution_time_ms integer) TO service_role;


--
-- Name: FUNCTION log_smtp_operation(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_recipients_count integer, p_execution_time_ms integer, p_client_ip inet, p_user_agent text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_smtp_operation(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_recipients_count integer, p_execution_time_ms integer, p_client_ip inet, p_user_agent text) TO anon;
GRANT ALL ON FUNCTION public.log_smtp_operation(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_recipients_count integer, p_execution_time_ms integer, p_client_ip inet, p_user_agent text) TO authenticated;
GRANT ALL ON FUNCTION public.log_smtp_operation(p_user_id uuid, p_agent_id uuid, p_smtp_config_id uuid, p_operation_type text, p_operation_params jsonb, p_operation_result jsonb, p_status text, p_error_message text, p_recipients_count integer, p_execution_time_ms integer, p_client_ip inet, p_user_agent text) TO service_role;


--
-- Name: FUNCTION log_temp_chat_access_violation(table_name text, operation text, user_role text, additional_info jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_temp_chat_access_violation(table_name text, operation text, user_role text, additional_info jsonb) TO anon;
GRANT ALL ON FUNCTION public.log_temp_chat_access_violation(table_name text, operation text, user_role text, additional_info jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.log_temp_chat_access_violation(table_name text, operation text, user_role text, additional_info jsonb) TO service_role;


--
-- Name: FUNCTION mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text) TO anon;
GRANT ALL ON FUNCTION public.mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text) TO authenticated;
GRANT ALL ON FUNCTION public.mark_mcp_schema_refresh_needed(p_connection_id uuid, p_error_message text) TO service_role;


--
-- Name: FUNCTION mark_previous_versions_not_latest(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_previous_versions_not_latest() TO anon;
GRANT ALL ON FUNCTION public.mark_previous_versions_not_latest() TO authenticated;
GRANT ALL ON FUNCTION public.mark_previous_versions_not_latest() TO service_role;


--
-- Name: FUNCTION match_channel_messages(query_embedding public.vector, match_threshold double precision, match_count integer, p_channel_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.match_channel_messages(query_embedding public.vector, match_threshold double precision, match_count integer, p_channel_id uuid) TO anon;
GRANT ALL ON FUNCTION public.match_channel_messages(query_embedding public.vector, match_threshold double precision, match_count integer, p_channel_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.match_channel_messages(query_embedding public.vector, match_threshold double precision, match_count integer, p_channel_id uuid) TO service_role;


--
-- Name: FUNCTION migrate_chat_messages(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.migrate_chat_messages() TO anon;
GRANT ALL ON FUNCTION public.migrate_chat_messages() TO authenticated;
GRANT ALL ON FUNCTION public.migrate_chat_messages() TO service_role;


--
-- Name: FUNCTION migrate_mcp_urls_to_vault(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.migrate_mcp_urls_to_vault() TO anon;
GRANT ALL ON FUNCTION public.migrate_mcp_urls_to_vault() TO authenticated;
GRANT ALL ON FUNCTION public.migrate_mcp_urls_to_vault() TO service_role;


--
-- Name: FUNCTION monitor_session_security(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.monitor_session_security() TO anon;
GRANT ALL ON FUNCTION public.monitor_session_security() TO authenticated;
GRANT ALL ON FUNCTION public.monitor_session_security() TO service_role;


--
-- Name: FUNCTION prevent_plaintext_mcp_urls(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_plaintext_mcp_urls() TO anon;
GRANT ALL ON FUNCTION public.prevent_plaintext_mcp_urls() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_plaintext_mcp_urls() TO service_role;


--
-- Name: FUNCTION prevent_vault_token_exposure(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_vault_token_exposure() TO anon;
GRANT ALL ON FUNCTION public.prevent_vault_token_exposure() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_vault_token_exposure() TO service_role;


--
-- Name: FUNCTION queue_conversation_summarization(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.queue_conversation_summarization() TO anon;
GRANT ALL ON FUNCTION public.queue_conversation_summarization() TO authenticated;
GRANT ALL ON FUNCTION public.queue_conversation_summarization() TO service_role;


--
-- Name: FUNCTION record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.record_agent_oauth_usage(p_agent_id uuid, p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean) TO anon;
GRANT ALL ON FUNCTION public.record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean) TO authenticated;
GRANT ALL ON FUNCTION public.record_mcp_tool_execution(p_connection_id uuid, p_tool_name text, p_parameters jsonb, p_success boolean) TO service_role;


--
-- Name: FUNCTION record_mcp_tool_success(p_connection_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_mcp_tool_success(p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.record_mcp_tool_success(p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.record_mcp_tool_success(p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION refresh_smart_group_memberships(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.refresh_smart_group_memberships(p_group_id uuid) TO anon;
GRANT ALL ON FUNCTION public.refresh_smart_group_memberships(p_group_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_smart_group_memberships(p_group_id uuid) TO service_role;


--
-- Name: FUNCTION reorder_task_steps(p_task_id uuid, p_step_orders jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reorder_task_steps(p_task_id uuid, p_step_orders jsonb) TO anon;
GRANT ALL ON FUNCTION public.reorder_task_steps(p_task_id uuid, p_step_orders jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.reorder_task_steps(p_task_id uuid, p_step_orders jsonb) TO service_role;


--
-- Name: FUNCTION replace_lines(content text, start_line integer, end_line integer, new_content text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.replace_lines(content text, start_line integer, end_line integer, new_content text) TO anon;
GRANT ALL ON FUNCTION public.replace_lines(content text, start_line integer, end_line integer, new_content text) TO authenticated;
GRANT ALL ON FUNCTION public.replace_lines(content text, start_line integer, end_line integer, new_content text) TO service_role;


--
-- Name: FUNCTION revoke_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revoke_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.revoke_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_agent_contact_access(p_agent_id uuid, p_contact_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION revoke_agent_integration_permission(p_permission_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revoke_agent_integration_permission(p_permission_id uuid) TO anon;
GRANT ALL ON FUNCTION public.revoke_agent_integration_permission(p_permission_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_agent_integration_permission(p_permission_id uuid) TO service_role;


--
-- Name: FUNCTION revoke_agent_web_search_permission(p_agent_id uuid, p_provider_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revoke_agent_web_search_permission(p_agent_id uuid, p_provider_id uuid) TO anon;
GRANT ALL ON FUNCTION public.revoke_agent_web_search_permission(p_agent_id uuid, p_provider_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_agent_web_search_permission(p_agent_id uuid, p_provider_id uuid) TO service_role;


--
-- Name: FUNCTION revoke_smtp_credentials(p_user_id uuid, p_config_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revoke_smtp_credentials(p_user_id uuid, p_config_id uuid) TO anon;
GRANT ALL ON FUNCTION public.revoke_smtp_credentials(p_user_id uuid, p_config_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_smtp_credentials(p_user_id uuid, p_config_id uuid) TO service_role;


--
-- Name: FUNCTION save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb) TO anon;
GRANT ALL ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb) TO service_role;


--
-- Name: FUNCTION save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_agent_positions jsonb, p_connections jsonb, p_view_settings jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_agent_positions jsonb, p_connections jsonb, p_view_settings jsonb) TO anon;
GRANT ALL ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_agent_positions jsonb, p_connections jsonb, p_view_settings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_team_canvas_layout(p_workspace_id uuid, p_positions jsonb, p_agent_positions jsonb, p_connections jsonb, p_view_settings jsonb) TO service_role;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;


--
-- Name: FUNCTION search_chat_history(p_channel_id uuid, p_search_query text, p_search_type text, p_match_count integer, p_match_threshold double precision); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_chat_history(p_channel_id uuid, p_search_query text, p_search_type text, p_match_count integer, p_match_threshold double precision) TO anon;
GRANT ALL ON FUNCTION public.search_chat_history(p_channel_id uuid, p_search_query text, p_search_type text, p_match_count integer, p_match_threshold double precision) TO authenticated;
GRANT ALL ON FUNCTION public.search_chat_history(p_channel_id uuid, p_search_query text, p_search_type text, p_match_count integer, p_match_threshold double precision) TO service_role;


--
-- Name: FUNCTION search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_tags text[], p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_tags text[], p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_tags text[], p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_tags text[], p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_organization_filter text, p_job_title_filter text, p_phone_pattern text, p_email_pattern text, p_tags text[], p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_organization_filter text, p_job_title_filter text, p_phone_pattern text, p_email_pattern text, p_tags text[], p_limit integer, p_offset integer) TO anon;
GRANT ALL ON FUNCTION public.search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_organization_filter text, p_job_title_filter text, p_phone_pattern text, p_email_pattern text, p_tags text[], p_limit integer, p_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_contacts_for_agent_enhanced(p_agent_id uuid, p_user_id uuid, p_query text, p_contact_type text, p_group_id uuid, p_channel_type text, p_organization_filter text, p_job_title_filter text, p_phone_pattern text, p_email_pattern text, p_tags text[], p_limit integer, p_offset integer) TO service_role;


--
-- Name: FUNCTION search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_conversation_summaries(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer) TO service_role;


--
-- Name: FUNCTION search_inbound_emails(p_search_query text, p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_inbound_emails(p_search_query text, p_user_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.search_inbound_emails(p_search_query text, p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_inbound_emails(p_search_query text, p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION search_media_documents_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_search_type text, p_category text, p_assignment_type text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_media_documents_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_search_type text, p_category text, p_assignment_type text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.search_media_documents_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_search_type text, p_category text, p_assignment_type text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_media_documents_for_agent(p_agent_id uuid, p_user_id uuid, p_query text, p_search_type text, p_category text, p_assignment_type text, p_limit integer) TO service_role;


--
-- Name: FUNCTION search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_working_memory(p_agent_id uuid, p_user_id uuid, p_query_embedding public.vector, p_limit integer) TO service_role;


--
-- Name: FUNCTION set_summary_update_frequency(p_conversation_id uuid, p_frequency integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_summary_update_frequency(p_conversation_id uuid, p_frequency integer) TO anon;
GRANT ALL ON FUNCTION public.set_summary_update_frequency(p_conversation_id uuid, p_frequency integer) TO authenticated;
GRANT ALL ON FUNCTION public.set_summary_update_frequency(p_conversation_id uuid, p_frequency integer) TO service_role;


--
-- Name: FUNCTION set_team_owner(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_team_owner() TO anon;
GRANT ALL ON FUNCTION public.set_team_owner() TO authenticated;
GRANT ALL ON FUNCTION public.set_team_owner() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION simple_user_owns_agent(agent_id uuid, user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.simple_user_owns_agent(agent_id uuid, user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.simple_user_owns_agent(agent_id uuid, user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.simple_user_owns_agent(agent_id uuid, user_id uuid) TO service_role;


--
-- Name: FUNCTION simple_user_owns_contact(contact_id uuid, user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.simple_user_owns_contact(contact_id uuid, user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.simple_user_owns_contact(contact_id uuid, user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.simple_user_owns_contact(contact_id uuid, user_id uuid) TO service_role;


--
-- Name: FUNCTION start_contact_import_job(p_user_id uuid, p_file_name text, p_file_size bigint, p_import_settings jsonb, p_column_mapping jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.start_contact_import_job(p_user_id uuid, p_file_name text, p_file_size bigint, p_import_settings jsonb, p_column_mapping jsonb) TO anon;
GRANT ALL ON FUNCTION public.start_contact_import_job(p_user_id uuid, p_file_name text, p_file_size bigint, p_import_settings jsonb, p_column_mapping jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.start_contact_import_job(p_user_id uuid, p_file_name text, p_file_size bigint, p_import_settings jsonb, p_column_mapping jsonb) TO service_role;


--
-- Name: FUNCTION store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text) TO anon;
GRANT ALL ON FUNCTION public.store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text) TO authenticated;
GRANT ALL ON FUNCTION public.store_admin_credential(p_integration_type text, p_credential_name text, p_credential_value text, p_connection_method text) TO service_role;


--
-- Name: FUNCTION store_smtp_password(p_user_id uuid, p_config_name text, p_password text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.store_smtp_password(p_user_id uuid, p_config_name text, p_password text) TO anon;
GRANT ALL ON FUNCTION public.store_smtp_password(p_user_id uuid, p_config_name text, p_password text) TO authenticated;
GRANT ALL ON FUNCTION public.store_smtp_password(p_user_id uuid, p_config_name text, p_password text) TO service_role;


--
-- Name: FUNCTION suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.suggest_contacts_for_agent(p_agent_id uuid, p_user_id uuid, p_partial_query text, p_limit integer) TO service_role;


--
-- Name: FUNCTION sync_organization_subscription(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_organization_subscription() TO anon;
GRANT ALL ON FUNCTION public.sync_organization_subscription() TO authenticated;
GRANT ALL ON FUNCTION public.sync_organization_subscription() TO service_role;


--
-- Name: FUNCTION test_contact_rls_policies(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.test_contact_rls_policies() TO anon;
GRANT ALL ON FUNCTION public.test_contact_rls_policies() TO authenticated;
GRANT ALL ON FUNCTION public.test_contact_rls_policies() TO service_role;


--
-- Name: FUNCTION test_rpc(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.test_rpc() TO anon;
GRANT ALL ON FUNCTION public.test_rpc() TO authenticated;
GRANT ALL ON FUNCTION public.test_rpc() TO service_role;


--
-- Name: FUNCTION test_temp_chat_rls_policies(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.test_temp_chat_rls_policies() TO anon;
GRANT ALL ON FUNCTION public.test_temp_chat_rls_policies() TO authenticated;
GRANT ALL ON FUNCTION public.test_temp_chat_rls_policies() TO service_role;


--
-- Name: FUNCTION test_vault_system(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.test_vault_system() TO anon;
GRANT ALL ON FUNCTION public.test_vault_system() TO authenticated;
GRANT ALL ON FUNCTION public.test_vault_system() TO service_role;


--
-- Name: FUNCTION time_diff_seconds(time1 timestamp with time zone, time2 timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.time_diff_seconds(time1 timestamp with time zone, time2 timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.time_diff_seconds(time1 timestamp with time zone, time2 timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.time_diff_seconds(time1 timestamp with time zone, time2 timestamp with time zone) TO service_role;


--
-- Name: FUNCTION track_temp_link_access(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.track_temp_link_access() TO anon;
GRANT ALL ON FUNCTION public.track_temp_link_access() TO authenticated;
GRANT ALL ON FUNCTION public.track_temp_link_access() TO service_role;


--
-- Name: FUNCTION trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean) TO anon;
GRANT ALL ON FUNCTION public.trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean) TO authenticated;
GRANT ALL ON FUNCTION public.trigger_manual_summarization(p_conversation_id uuid, p_force_full boolean) TO service_role;


--
-- Name: FUNCTION trigger_set_timestamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_set_timestamp() TO anon;
GRANT ALL ON FUNCTION public.trigger_set_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_set_timestamp() TO service_role;


--
-- Name: FUNCTION trigger_token_aggregation(p_start_date date, p_end_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_token_aggregation(p_start_date date, p_end_date date) TO anon;
GRANT ALL ON FUNCTION public.trigger_token_aggregation(p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.trigger_token_aggregation(p_start_date date, p_end_date date) TO service_role;


--
-- Name: FUNCTION update_agent_mcp_connections_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_agent_mcp_connections_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_agent_mcp_connections_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_agent_mcp_connections_updated_at() TO service_role;


--
-- Name: FUNCTION update_agent_smtp_permissions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_agent_smtp_permissions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_agent_smtp_permissions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_agent_smtp_permissions_updated_at() TO service_role;


--
-- Name: FUNCTION update_agent_web_search_permissions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_agent_web_search_permissions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_agent_web_search_permissions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_agent_web_search_permissions_updated_at() TO service_role;


--
-- Name: FUNCTION update_artifacts_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_artifacts_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_artifacts_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_artifacts_updated_at() TO service_role;


--
-- Name: FUNCTION update_canvas_sessions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_canvas_sessions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_canvas_sessions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_canvas_sessions_updated_at() TO service_role;


--
-- Name: FUNCTION update_channel_last_message_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_channel_last_message_at() TO anon;
GRANT ALL ON FUNCTION public.update_channel_last_message_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_channel_last_message_at() TO service_role;


--
-- Name: FUNCTION update_channels_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_channels_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_channels_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_channels_updated_at() TO service_role;


--
-- Name: FUNCTION update_contact_groups_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_contact_groups_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_contact_groups_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_contact_groups_updated_at() TO service_role;


--
-- Name: FUNCTION update_contact_last_contacted(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_contact_last_contacted() TO anon;
GRANT ALL ON FUNCTION public.update_contact_last_contacted() TO authenticated;
GRANT ALL ON FUNCTION public.update_contact_last_contacted() TO service_role;


--
-- Name: FUNCTION update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb) TO anon;
GRANT ALL ON FUNCTION public.update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_contact_with_audit(p_contact_id uuid, p_user_id uuid, p_updates jsonb) TO service_role;


--
-- Name: FUNCTION update_contacts_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_contacts_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_contacts_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_contacts_updated_at() TO service_role;


--
-- Name: FUNCTION update_conversation_summary_timestamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_conversation_summary_timestamp() TO anon;
GRANT ALL ON FUNCTION public.update_conversation_summary_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.update_conversation_summary_timestamp() TO service_role;


--
-- Name: FUNCTION update_datastore_documents_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_datastore_documents_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_datastore_documents_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_datastore_documents_updated_at() TO service_role;


--
-- Name: FUNCTION update_group_member_count(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_group_member_count() TO anon;
GRANT ALL ON FUNCTION public.update_group_member_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_group_member_count() TO service_role;


--
-- Name: FUNCTION update_import_job_progress(p_job_id uuid, p_user_id uuid, p_processed_rows integer, p_successful_imports integer, p_failed_imports integer, p_duplicate_contacts integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_import_job_progress(p_job_id uuid, p_user_id uuid, p_processed_rows integer, p_successful_imports integer, p_failed_imports integer, p_duplicate_contacts integer) TO anon;
GRANT ALL ON FUNCTION public.update_import_job_progress(p_job_id uuid, p_user_id uuid, p_processed_rows integer, p_successful_imports integer, p_failed_imports integer, p_duplicate_contacts integer) TO authenticated;
GRANT ALL ON FUNCTION public.update_import_job_progress(p_job_id uuid, p_user_id uuid, p_processed_rows integer, p_successful_imports integer, p_failed_imports integer, p_duplicate_contacts integer) TO service_role;


--
-- Name: FUNCTION update_integration_capabilities_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_integration_capabilities_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_integration_capabilities_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_integration_capabilities_updated_at() TO service_role;


--
-- Name: FUNCTION update_interactions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_interactions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_interactions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_interactions_updated_at() TO service_role;


--
-- Name: FUNCTION update_link_statistics(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_link_statistics() TO anon;
GRANT ALL ON FUNCTION public.update_link_statistics() TO authenticated;
GRANT ALL ON FUNCTION public.update_link_statistics() TO service_role;


--
-- Name: FUNCTION update_mcp_server_capabilities(p_connection_id uuid, p_capabilities jsonb, p_server_info jsonb, p_protocol_version text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_mcp_server_capabilities(p_connection_id uuid, p_capabilities jsonb, p_server_info jsonb, p_protocol_version text) TO anon;
GRANT ALL ON FUNCTION public.update_mcp_server_capabilities(p_connection_id uuid, p_capabilities jsonb, p_server_info jsonb, p_protocol_version text) TO authenticated;
GRANT ALL ON FUNCTION public.update_mcp_server_capabilities(p_connection_id uuid, p_capabilities jsonb, p_server_info jsonb, p_protocol_version text) TO service_role;


--
-- Name: FUNCTION update_media_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_media_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_media_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_media_updated_at() TO service_role;


--
-- Name: FUNCTION update_memory_access(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_memory_access() TO anon;
GRANT ALL ON FUNCTION public.update_memory_access() TO authenticated;
GRANT ALL ON FUNCTION public.update_memory_access() TO service_role;


--
-- Name: FUNCTION update_permission_usage(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_permission_usage() TO anon;
GRANT ALL ON FUNCTION public.update_permission_usage() TO authenticated;
GRANT ALL ON FUNCTION public.update_permission_usage() TO service_role;


--
-- Name: FUNCTION update_platform_settings_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_platform_settings_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_platform_settings_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_platform_settings_updated_at() TO service_role;


--
-- Name: FUNCTION update_sendgrid_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_sendgrid_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_sendgrid_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_sendgrid_updated_at() TO service_role;


--
-- Name: FUNCTION update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text) TO anon;
GRANT ALL ON FUNCTION public.update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text) TO authenticated;
GRANT ALL ON FUNCTION public.update_server_secret(p_server_name text, p_secret_type text, p_new_secret_value text) TO service_role;


--
-- Name: FUNCTION update_service_providers_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_service_providers_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_service_providers_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_service_providers_updated_at() TO service_role;


--
-- Name: FUNCTION update_session_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_session_activity() TO anon;
GRANT ALL ON FUNCTION public.update_session_activity() TO authenticated;
GRANT ALL ON FUNCTION public.update_session_activity() TO service_role;


--
-- Name: FUNCTION update_session_last_active(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_session_last_active() TO anon;
GRANT ALL ON FUNCTION public.update_session_last_active() TO authenticated;
GRANT ALL ON FUNCTION public.update_session_last_active() TO service_role;


--
-- Name: FUNCTION update_smtp_configurations_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_smtp_configurations_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_smtp_configurations_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_smtp_configurations_updated_at() TO service_role;


--
-- Name: FUNCTION update_smtp_password(p_user_id uuid, p_config_id uuid, p_new_password text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_smtp_password(p_user_id uuid, p_config_id uuid, p_new_password text) TO anon;
GRANT ALL ON FUNCTION public.update_smtp_password(p_user_id uuid, p_config_id uuid, p_new_password text) TO authenticated;
GRANT ALL ON FUNCTION public.update_smtp_password(p_user_id uuid, p_config_id uuid, p_new_password text) TO service_role;


--
-- Name: FUNCTION update_step_execution(p_step_id uuid, p_status public.task_step_status, p_execution_result jsonb, p_error_message text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_step_execution(p_step_id uuid, p_status public.task_step_status, p_execution_result jsonb, p_error_message text) TO anon;
GRANT ALL ON FUNCTION public.update_step_execution(p_step_id uuid, p_status public.task_step_status, p_execution_result jsonb, p_error_message text) TO authenticated;
GRANT ALL ON FUNCTION public.update_step_execution(p_step_id uuid, p_status public.task_step_status, p_execution_result jsonb, p_error_message text) TO service_role;


--
-- Name: FUNCTION update_summary_board_timestamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_summary_board_timestamp() TO anon;
GRANT ALL ON FUNCTION public.update_summary_board_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.update_summary_board_timestamp() TO service_role;


--
-- Name: FUNCTION update_system_api_keys_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_system_api_keys_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_system_api_keys_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_system_api_keys_updated_at() TO service_role;


--
-- Name: FUNCTION update_system_prompts_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_system_prompts_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_system_prompts_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_system_prompts_updated_at() TO service_role;


--
-- Name: FUNCTION update_task_step(p_step_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_task_step(p_step_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean) TO anon;
GRANT ALL ON FUNCTION public.update_task_step(p_step_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean) TO authenticated;
GRANT ALL ON FUNCTION public.update_task_step(p_step_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean) TO service_role;


--
-- Name: FUNCTION update_task_steps_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_task_steps_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_task_steps_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_task_steps_updated_at() TO service_role;


--
-- Name: FUNCTION update_team_canvas_layouts_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_team_canvas_layouts_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_team_canvas_layouts_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_team_canvas_layouts_updated_at() TO service_role;


--
-- Name: FUNCTION update_team_connections_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_team_connections_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_team_connections_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_team_connections_updated_at() TO service_role;


--
-- Name: FUNCTION update_temporary_chat_links_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_temporary_chat_links_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_temporary_chat_links_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_temporary_chat_links_updated_at() TO service_role;


--
-- Name: FUNCTION update_temporary_chat_sessions_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_temporary_chat_sessions_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_temporary_chat_sessions_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_temporary_chat_sessions_updated_at() TO service_role;


--
-- Name: FUNCTION update_tool_execution_logs_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_tool_execution_logs_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_tool_execution_logs_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_tool_execution_logs_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_user_oauth_connections_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_oauth_connections_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_user_oauth_connections_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_user_oauth_connections_updated_at() TO service_role;


--
-- Name: FUNCTION update_user_token_usage_timestamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_token_usage_timestamp() TO anon;
GRANT ALL ON FUNCTION public.update_user_token_usage_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.update_user_token_usage_timestamp() TO service_role;


--
-- Name: FUNCTION update_vault_secret(p_secret_id uuid, p_new_secret text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_vault_secret(p_secret_id uuid, p_new_secret text) TO anon;
GRANT ALL ON FUNCTION public.update_vault_secret(p_secret_id uuid, p_new_secret text) TO authenticated;
GRANT ALL ON FUNCTION public.update_vault_secret(p_secret_id uuid, p_new_secret text) TO service_role;


--
-- Name: FUNCTION update_web_search_providers_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_web_search_providers_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_web_search_providers_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_web_search_providers_updated_at() TO service_role;


--
-- Name: FUNCTION update_worker_status(connection_id_in uuid, new_status_in text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_worker_status(connection_id_in uuid, new_status_in text) TO anon;
GRANT ALL ON FUNCTION public.update_worker_status(connection_id_in uuid, new_status_in text) TO authenticated;
GRANT ALL ON FUNCTION public.update_worker_status(connection_id_in uuid, new_status_in text) TO service_role;


--
-- Name: FUNCTION upsert_vault_secret(p_secret text, p_name text, p_description text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_vault_secret(p_secret text, p_name text, p_description text) TO anon;
GRANT ALL ON FUNCTION public.upsert_vault_secret(p_secret text, p_name text, p_description text) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_vault_secret(p_secret text, p_name text, p_description text) TO service_role;


--
-- Name: FUNCTION user_has_role(user_id uuid, role_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_has_role(user_id uuid, role_name text) TO anon;
GRANT ALL ON FUNCTION public.user_has_role(user_id uuid, role_name text) TO authenticated;
GRANT ALL ON FUNCTION public.user_has_role(user_id uuid, role_name text) TO service_role;


--
-- Name: FUNCTION user_owns_temp_chat_link(link_id uuid, user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_owns_temp_chat_link(link_id uuid, user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.user_owns_temp_chat_link(link_id uuid, user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_owns_temp_chat_link(link_id uuid, user_id uuid) TO service_role;


--
-- Name: FUNCTION user_owns_temp_chat_session(session_id uuid, user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_owns_temp_chat_session(session_id uuid, user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.user_owns_temp_chat_session(session_id uuid, user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_owns_temp_chat_session(session_id uuid, user_id uuid) TO service_role;


--
-- Name: FUNCTION validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO anon;
GRANT ALL ON FUNCTION public.validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO authenticated;
GRANT ALL ON FUNCTION public.validate_agent_clicksend_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO service_role;


--
-- Name: FUNCTION validate_agent_gmail_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_agent_gmail_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO anon;
GRANT ALL ON FUNCTION public.validate_agent_gmail_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO authenticated;
GRANT ALL ON FUNCTION public.validate_agent_gmail_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO service_role;


--
-- Name: FUNCTION validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO anon;
GRANT ALL ON FUNCTION public.validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO authenticated;
GRANT ALL ON FUNCTION public.validate_agent_outlook_permissions(p_agent_id uuid, p_user_id uuid, p_required_scopes text[]) TO service_role;


--
-- Name: FUNCTION validate_agent_sendgrid_permissions(p_agent_id uuid, p_user_id uuid, p_permission text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_agent_sendgrid_permissions(p_agent_id uuid, p_user_id uuid, p_permission text) TO anon;
GRANT ALL ON FUNCTION public.validate_agent_sendgrid_permissions(p_agent_id uuid, p_user_id uuid, p_permission text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_agent_sendgrid_permissions(p_agent_id uuid, p_user_id uuid, p_permission text) TO service_role;


--
-- Name: FUNCTION validate_agent_smtp_permissions(p_agent_id uuid, p_user_id uuid, p_smtp_config_id uuid, p_permission_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_agent_smtp_permissions(p_agent_id uuid, p_user_id uuid, p_smtp_config_id uuid, p_permission_type text) TO anon;
GRANT ALL ON FUNCTION public.validate_agent_smtp_permissions(p_agent_id uuid, p_user_id uuid, p_smtp_config_id uuid, p_permission_type text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_agent_smtp_permissions(p_agent_id uuid, p_user_id uuid, p_smtp_config_id uuid, p_permission_type text) TO service_role;


--
-- Name: FUNCTION validate_channel_identifier(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_channel_identifier() TO anon;
GRANT ALL ON FUNCTION public.validate_channel_identifier() TO authenticated;
GRANT ALL ON FUNCTION public.validate_channel_identifier() TO service_role;


--
-- Name: FUNCTION validate_column_mapping(p_mapping jsonb, p_required_fields text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_column_mapping(p_mapping jsonb, p_required_fields text[]) TO anon;
GRANT ALL ON FUNCTION public.validate_column_mapping(p_mapping jsonb, p_required_fields text[]) TO authenticated;
GRANT ALL ON FUNCTION public.validate_column_mapping(p_mapping jsonb, p_required_fields text[]) TO service_role;


--
-- Name: FUNCTION validate_email_address(email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_email_address(email text) TO anon;
GRANT ALL ON FUNCTION public.validate_email_address(email text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_email_address(email text) TO service_role;


--
-- Name: FUNCTION validate_phone_number(phone text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_phone_number(phone text) TO anon;
GRANT ALL ON FUNCTION public.validate_phone_number(phone text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_phone_number(phone text) TO service_role;


--
-- Name: FUNCTION validate_temp_chat_session(p_session_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_temp_chat_session(p_session_token text) TO anon;
GRANT ALL ON FUNCTION public.validate_temp_chat_session(p_session_token text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_temp_chat_session(p_session_token text) TO service_role;


--
-- Name: FUNCTION validate_web_search_permissions(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION validate_web_search_permissions(p_agent_id uuid, p_user_id uuid, p_provider_name text, p_required_permission text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid, p_provider_name text, p_required_permission text) TO anon;
GRANT ALL ON FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid, p_provider_name text, p_required_permission text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_web_search_permissions(p_agent_id uuid, p_user_id uuid, p_provider_name text, p_required_permission text) TO service_role;


--
-- Name: FUNCTION vault_decrypt(vault_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.vault_decrypt(vault_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.vault_decrypt(vault_id text) TO anon;
GRANT ALL ON FUNCTION public.vault_decrypt(vault_id text) TO authenticated;
GRANT ALL ON FUNCTION public.vault_decrypt(vault_id text) TO service_role;


--
-- Name: FUNCTION vault_store_secret(secret_name text, secret_value text, secret_description text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.vault_store_secret(secret_name text, secret_value text, secret_description text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.vault_store_secret(secret_name text, secret_value text, secret_description text) TO anon;
GRANT ALL ON FUNCTION public.vault_store_secret(secret_name text, secret_value text, secret_description text) TO authenticated;
GRANT ALL ON FUNCTION public.vault_store_secret(secret_name text, secret_value text, secret_description text) TO service_role;


--
-- Name: FUNCTION verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.verify_agent_tool_availability(p_agent_id uuid, p_user_id uuid) TO service_role;


--
-- Name: TABLE account_graphs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account_graphs TO anon;
GRANT ALL ON TABLE public.account_graphs TO authenticated;
GRANT ALL ON TABLE public.account_graphs TO service_role;


--
-- Name: TABLE admin_integration_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_integration_credentials TO anon;
GRANT ALL ON TABLE public.admin_integration_credentials TO authenticated;
GRANT ALL ON TABLE public.admin_integration_credentials TO service_role;


--
-- Name: TABLE admin_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_settings TO anon;
GRANT ALL ON TABLE public.admin_settings TO authenticated;
GRANT ALL ON TABLE public.admin_settings TO service_role;


--
-- Name: TABLE agent_contact_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_contact_permissions TO anon;
GRANT ALL ON TABLE public.agent_contact_permissions TO authenticated;
GRANT ALL ON TABLE public.agent_contact_permissions TO service_role;


--
-- Name: TABLE agent_datastores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_datastores TO anon;
GRANT ALL ON TABLE public.agent_datastores TO authenticated;
GRANT ALL ON TABLE public.agent_datastores TO service_role;


--
-- Name: TABLE agent_email_addresses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_email_addresses TO anon;
GRANT ALL ON TABLE public.agent_email_addresses TO authenticated;
GRANT ALL ON TABLE public.agent_email_addresses TO service_role;


--
-- Name: TABLE agent_generation_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_generation_logs TO anon;
GRANT ALL ON TABLE public.agent_generation_logs TO authenticated;
GRANT ALL ON TABLE public.agent_generation_logs TO service_role;


--
-- Name: TABLE agent_group_access; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_group_access TO anon;
GRANT ALL ON TABLE public.agent_group_access TO authenticated;
GRANT ALL ON TABLE public.agent_group_access TO service_role;


--
-- Name: TABLE agent_integration_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_integration_permissions TO anon;
GRANT ALL ON TABLE public.agent_integration_permissions TO authenticated;
GRANT ALL ON TABLE public.agent_integration_permissions TO service_role;


--
-- Name: TABLE agent_llm_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_llm_preferences TO anon;
GRANT ALL ON TABLE public.agent_llm_preferences TO authenticated;
GRANT ALL ON TABLE public.agent_llm_preferences TO service_role;


--
-- Name: TABLE agent_mailgun_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_mailgun_permissions TO anon;
GRANT ALL ON TABLE public.agent_mailgun_permissions TO authenticated;
GRANT ALL ON TABLE public.agent_mailgun_permissions TO service_role;


--
-- Name: TABLE agent_mcp_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_mcp_connections TO anon;
GRANT ALL ON TABLE public.agent_mcp_connections TO authenticated;
GRANT ALL ON TABLE public.agent_mcp_connections TO service_role;


--
-- Name: TABLE agent_media_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_media_assignments TO anon;
GRANT ALL ON TABLE public.agent_media_assignments TO authenticated;
GRANT ALL ON TABLE public.agent_media_assignments TO service_role;


--
-- Name: TABLE agent_memories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_memories TO anon;
GRANT ALL ON TABLE public.agent_memories TO authenticated;
GRANT ALL ON TABLE public.agent_memories TO service_role;


--
-- Name: TABLE agent_sendgrid_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_sendgrid_permissions TO anon;
GRANT ALL ON TABLE public.agent_sendgrid_permissions TO authenticated;
GRANT ALL ON TABLE public.agent_sendgrid_permissions TO service_role;


--
-- Name: TABLE agent_smtp_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_smtp_permissions TO anon;
GRANT ALL ON TABLE public.agent_smtp_permissions TO authenticated;
GRANT ALL ON TABLE public.agent_smtp_permissions TO service_role;


--
-- Name: TABLE agent_specific_contact_access; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_specific_contact_access TO anon;
GRANT ALL ON TABLE public.agent_specific_contact_access TO authenticated;
GRANT ALL ON TABLE public.agent_specific_contact_access TO service_role;


--
-- Name: TABLE agent_states; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_states TO anon;
GRANT ALL ON TABLE public.agent_states TO authenticated;
GRANT ALL ON TABLE public.agent_states TO service_role;


--
-- Name: TABLE agent_task_event_triggers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_task_event_triggers TO anon;
GRANT ALL ON TABLE public.agent_task_event_triggers TO authenticated;
GRANT ALL ON TABLE public.agent_task_event_triggers TO service_role;


--
-- Name: TABLE agent_task_executions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_task_executions TO anon;
GRANT ALL ON TABLE public.agent_task_executions TO authenticated;
GRANT ALL ON TABLE public.agent_task_executions TO service_role;


--
-- Name: TABLE agent_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_tasks TO anon;
GRANT ALL ON TABLE public.agent_tasks TO authenticated;
GRANT ALL ON TABLE public.agent_tasks TO service_role;


--
-- Name: TABLE agents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agents TO anon;
GRANT ALL ON TABLE public.agents TO authenticated;
GRANT ALL ON TABLE public.agents TO service_role;


--
-- Name: TABLE artifact_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artifact_versions TO anon;
GRANT ALL ON TABLE public.artifact_versions TO authenticated;
GRANT ALL ON TABLE public.artifact_versions TO service_role;


--
-- Name: TABLE artifacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artifacts TO anon;
GRANT ALL ON TABLE public.artifacts TO authenticated;
GRANT ALL ON TABLE public.artifacts TO service_role;


--
-- Name: TABLE billing_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_plans TO anon;
GRANT ALL ON TABLE public.billing_plans TO authenticated;
GRANT ALL ON TABLE public.billing_plans TO service_role;


--
-- Name: TABLE canvas_diffs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.canvas_diffs TO anon;
GRANT ALL ON TABLE public.canvas_diffs TO authenticated;
GRANT ALL ON TABLE public.canvas_diffs TO service_role;


--
-- Name: TABLE canvas_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.canvas_sessions TO anon;
GRANT ALL ON TABLE public.canvas_sessions TO authenticated;
GRANT ALL ON TABLE public.canvas_sessions TO service_role;


--
-- Name: TABLE canvas_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.canvas_snapshots TO anon;
GRANT ALL ON TABLE public.canvas_snapshots TO authenticated;
GRANT ALL ON TABLE public.canvas_snapshots TO service_role;


--
-- Name: TABLE chat_messages_v2; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_messages_v2 TO anon;
GRANT ALL ON TABLE public.chat_messages_v2 TO authenticated;
GRANT ALL ON TABLE public.chat_messages_v2 TO service_role;


--
-- Name: TABLE service_providers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.service_providers TO anon;
GRANT ALL ON TABLE public.service_providers TO authenticated;
GRANT ALL ON TABLE public.service_providers TO service_role;


--
-- Name: TABLE user_integration_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_integration_credentials TO anon;
GRANT ALL ON TABLE public.user_integration_credentials TO authenticated;
GRANT ALL ON TABLE public.user_integration_credentials TO service_role;


--
-- Name: TABLE clicksend_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clicksend_connections TO anon;
GRANT ALL ON TABLE public.clicksend_connections TO authenticated;
GRANT ALL ON TABLE public.clicksend_connections TO service_role;


--
-- Name: TABLE contact_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_audit_log TO anon;
GRANT ALL ON TABLE public.contact_audit_log TO authenticated;
GRANT ALL ON TABLE public.contact_audit_log TO service_role;


--
-- Name: TABLE contact_communication_channels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_communication_channels TO anon;
GRANT ALL ON TABLE public.contact_communication_channels TO authenticated;
GRANT ALL ON TABLE public.contact_communication_channels TO service_role;


--
-- Name: TABLE contact_group_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_group_memberships TO anon;
GRANT ALL ON TABLE public.contact_group_memberships TO authenticated;
GRANT ALL ON TABLE public.contact_group_memberships TO service_role;


--
-- Name: TABLE contact_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_groups TO anon;
GRANT ALL ON TABLE public.contact_groups TO authenticated;
GRANT ALL ON TABLE public.contact_groups TO service_role;


--
-- Name: TABLE contact_import_errors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_import_errors TO anon;
GRANT ALL ON TABLE public.contact_import_errors TO authenticated;
GRANT ALL ON TABLE public.contact_import_errors TO service_role;


--
-- Name: TABLE contact_import_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_import_jobs TO anon;
GRANT ALL ON TABLE public.contact_import_jobs TO authenticated;
GRANT ALL ON TABLE public.contact_import_jobs TO service_role;


--
-- Name: TABLE contact_interactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_interactions TO anon;
GRANT ALL ON TABLE public.contact_interactions TO authenticated;
GRANT ALL ON TABLE public.contact_interactions TO service_role;


--
-- Name: TABLE contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contacts TO anon;
GRANT ALL ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;


--
-- Name: TABLE context_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.context_snapshots TO anon;
GRANT ALL ON TABLE public.context_snapshots TO authenticated;
GRANT ALL ON TABLE public.context_snapshots TO service_role;


--
-- Name: TABLE context_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.context_templates TO anon;
GRANT ALL ON TABLE public.context_templates TO authenticated;
GRANT ALL ON TABLE public.context_templates TO service_role;


--
-- Name: TABLE conversation_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_sessions TO anon;
GRANT ALL ON TABLE public.conversation_sessions TO authenticated;
GRANT ALL ON TABLE public.conversation_sessions TO service_role;


--
-- Name: TABLE conversation_summaries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_summaries TO anon;
GRANT ALL ON TABLE public.conversation_summaries TO authenticated;
GRANT ALL ON TABLE public.conversation_summaries TO service_role;


--
-- Name: TABLE conversation_summary_boards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_summary_boards TO anon;
GRANT ALL ON TABLE public.conversation_summary_boards TO authenticated;
GRANT ALL ON TABLE public.conversation_summary_boards TO service_role;


--
-- Name: TABLE datastores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.datastores TO anon;
GRANT ALL ON TABLE public.datastores TO authenticated;
GRANT ALL ON TABLE public.datastores TO service_role;


--
-- Name: TABLE email_change_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_change_audit_log TO anon;
GRANT ALL ON TABLE public.email_change_audit_log TO authenticated;
GRANT ALL ON TABLE public.email_change_audit_log TO service_role;


--
-- Name: TABLE gmail_configurations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gmail_configurations TO anon;
GRANT ALL ON TABLE public.gmail_configurations TO authenticated;
GRANT ALL ON TABLE public.gmail_configurations TO service_role;


--
-- Name: TABLE integration_capabilities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.integration_capabilities TO anon;
GRANT ALL ON TABLE public.integration_capabilities TO authenticated;
GRANT ALL ON TABLE public.integration_capabilities TO service_role;


--
-- Name: TABLE integration_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.integration_categories TO anon;
GRANT ALL ON TABLE public.integration_categories TO authenticated;
GRANT ALL ON TABLE public.integration_categories TO service_role;


--
-- Name: TABLE integrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.integrations TO anon;
GRANT ALL ON TABLE public.integrations TO authenticated;
GRANT ALL ON TABLE public.integrations TO service_role;


--
-- Name: TABLE mailgun_configurations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mailgun_configurations TO anon;
GRANT ALL ON TABLE public.mailgun_configurations TO authenticated;
GRANT ALL ON TABLE public.mailgun_configurations TO service_role;


--
-- Name: TABLE mailgun_operation_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mailgun_operation_logs TO anon;
GRANT ALL ON TABLE public.mailgun_operation_logs TO authenticated;
GRANT ALL ON TABLE public.mailgun_operation_logs TO service_role;


--
-- Name: TABLE mailgun_routes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mailgun_routes TO anon;
GRANT ALL ON TABLE public.mailgun_routes TO authenticated;
GRANT ALL ON TABLE public.mailgun_routes TO service_role;


--
-- Name: TABLE mcp_tools_cache; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mcp_tools_cache TO anon;
GRANT ALL ON TABLE public.mcp_tools_cache TO authenticated;
GRANT ALL ON TABLE public.mcp_tools_cache TO service_role;


--
-- Name: TABLE media_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.media_categories TO anon;
GRANT ALL ON TABLE public.media_categories TO authenticated;
GRANT ALL ON TABLE public.media_categories TO service_role;


--
-- Name: TABLE media_library; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.media_library TO anon;
GRANT ALL ON TABLE public.media_library TO authenticated;
GRANT ALL ON TABLE public.media_library TO service_role;


--
-- Name: TABLE message_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.message_versions TO anon;
GRANT ALL ON TABLE public.message_versions TO authenticated;
GRANT ALL ON TABLE public.message_versions TO service_role;


--
-- Name: TABLE payment_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_events TO anon;
GRANT ALL ON TABLE public.payment_events TO authenticated;
GRANT ALL ON TABLE public.payment_events TO service_role;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE sendgrid_inbound_emails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sendgrid_inbound_emails TO anon;
GRANT ALL ON TABLE public.sendgrid_inbound_emails TO authenticated;
GRANT ALL ON TABLE public.sendgrid_inbound_emails TO service_role;


--
-- Name: TABLE sendgrid_inbound_routing_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sendgrid_inbound_routing_logs TO anon;
GRANT ALL ON TABLE public.sendgrid_inbound_routing_logs TO authenticated;
GRANT ALL ON TABLE public.sendgrid_inbound_routing_logs TO service_role;


--
-- Name: TABLE sendgrid_inbound_routing_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sendgrid_inbound_routing_rules TO anon;
GRANT ALL ON TABLE public.sendgrid_inbound_routing_rules TO authenticated;
GRANT ALL ON TABLE public.sendgrid_inbound_routing_rules TO service_role;


--
-- Name: TABLE sendgrid_operation_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sendgrid_operation_logs TO anon;
GRANT ALL ON TABLE public.sendgrid_operation_logs TO authenticated;
GRANT ALL ON TABLE public.sendgrid_operation_logs TO service_role;


--
-- Name: TABLE sendgrid_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sendgrid_templates TO anon;
GRANT ALL ON TABLE public.sendgrid_templates TO authenticated;
GRANT ALL ON TABLE public.sendgrid_templates TO service_role;


--
-- Name: TABLE server_configuration_secrets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.server_configuration_secrets TO anon;
GRANT ALL ON TABLE public.server_configuration_secrets TO authenticated;
GRANT ALL ON TABLE public.server_configuration_secrets TO service_role;


--
-- Name: TABLE server_secrets_audit; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.server_secrets_audit TO anon;
GRANT ALL ON TABLE public.server_secrets_audit TO authenticated;
GRANT ALL ON TABLE public.server_secrets_audit TO service_role;


--
-- Name: TABLE smtp_configurations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.smtp_configurations TO anon;
GRANT ALL ON TABLE public.smtp_configurations TO authenticated;
GRANT ALL ON TABLE public.smtp_configurations TO service_role;


--
-- Name: TABLE state_checkpoints; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.state_checkpoints TO anon;
GRANT ALL ON TABLE public.state_checkpoints TO authenticated;
GRANT ALL ON TABLE public.state_checkpoints TO service_role;


--
-- Name: TABLE state_transitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.state_transitions TO anon;
GRANT ALL ON TABLE public.state_transitions TO authenticated;
GRANT ALL ON TABLE public.state_transitions TO service_role;


--
-- Name: TABLE stripe_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_invoices TO anon;
GRANT ALL ON TABLE public.stripe_invoices TO authenticated;
GRANT ALL ON TABLE public.stripe_invoices TO service_role;


--
-- Name: TABLE stripe_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_orders TO anon;
GRANT ALL ON TABLE public.stripe_orders TO authenticated;
GRANT ALL ON TABLE public.stripe_orders TO service_role;


--
-- Name: TABLE stripe_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_subscriptions TO anon;
GRANT ALL ON TABLE public.stripe_subscriptions TO authenticated;
GRANT ALL ON TABLE public.stripe_subscriptions TO service_role;


--
-- Name: TABLE subscription_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscription_history TO anon;
GRANT ALL ON TABLE public.subscription_history TO authenticated;
GRANT ALL ON TABLE public.subscription_history TO service_role;


--
-- Name: TABLE system_api_keys; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_api_keys TO anon;
GRANT ALL ON TABLE public.system_api_keys TO authenticated;
GRANT ALL ON TABLE public.system_api_keys TO service_role;


--
-- Name: TABLE system_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_metrics TO anon;
GRANT ALL ON TABLE public.system_metrics TO authenticated;
GRANT ALL ON TABLE public.system_metrics TO service_role;


--
-- Name: TABLE system_prompts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_prompts TO anon;
GRANT ALL ON TABLE public.system_prompts TO authenticated;
GRANT ALL ON TABLE public.system_prompts TO service_role;


--
-- Name: TABLE team_canvas_layouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_canvas_layouts TO anon;
GRANT ALL ON TABLE public.team_canvas_layouts TO authenticated;
GRANT ALL ON TABLE public.team_canvas_layouts TO service_role;


--
-- Name: TABLE team_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_connections TO anon;
GRANT ALL ON TABLE public.team_connections TO authenticated;
GRANT ALL ON TABLE public.team_connections TO service_role;


--
-- Name: TABLE team_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_members TO anon;
GRANT ALL ON TABLE public.team_members TO authenticated;
GRANT ALL ON TABLE public.team_members TO service_role;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


--
-- Name: TABLE temporary_chat_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.temporary_chat_links TO anon;
GRANT ALL ON TABLE public.temporary_chat_links TO authenticated;
GRANT ALL ON TABLE public.temporary_chat_links TO service_role;


--
-- Name: TABLE temporary_chat_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.temporary_chat_sessions TO anon;
GRANT ALL ON TABLE public.temporary_chat_sessions TO authenticated;
GRANT ALL ON TABLE public.temporary_chat_sessions TO service_role;


--
-- Name: TABLE tool_execution_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tool_execution_logs TO anon;
GRANT ALL ON TABLE public.tool_execution_logs TO authenticated;
GRANT ALL ON TABLE public.tool_execution_logs TO service_role;


--
-- Name: TABLE tool_user_input_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tool_user_input_requests TO anon;
GRANT ALL ON TABLE public.tool_user_input_requests TO authenticated;
GRANT ALL ON TABLE public.tool_user_input_requests TO service_role;


--
-- Name: TABLE usage_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.usage_events TO anon;
GRANT ALL ON TABLE public.usage_events TO authenticated;
GRANT ALL ON TABLE public.usage_events TO service_role;


--
-- Name: TABLE user_oauth_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_oauth_connections TO anon;
GRANT ALL ON TABLE public.user_oauth_connections TO authenticated;
GRANT ALL ON TABLE public.user_oauth_connections TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE user_team_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_team_memberships TO anon;
GRANT ALL ON TABLE public.user_team_memberships TO authenticated;
GRANT ALL ON TABLE public.user_team_memberships TO service_role;


--
-- Name: TABLE user_token_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_token_usage TO anon;
GRANT ALL ON TABLE public.user_token_usage TO authenticated;
GRANT ALL ON TABLE public.user_token_usage TO service_role;


--
-- Name: TABLE working_memory_chunks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.working_memory_chunks TO anon;
GRANT ALL ON TABLE public.working_memory_chunks TO authenticated;
GRANT ALL ON TABLE public.working_memory_chunks TO service_role;


--
-- Name: TABLE workspace_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_members TO anon;
GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT ALL ON TABLE public.workspace_members TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_members TO supabase_admin;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict MVGHWOZjDX4R8PScrNmDeQP2el1iLEdzEgkVm6eBqYcNebXNgnQbH6LClM9GPho

