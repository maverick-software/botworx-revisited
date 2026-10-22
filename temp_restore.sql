

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."account_tool_environment_status_enum" AS ENUM (
    'inactive',
    'pending_creation',
    'creating',
    'active',
    'error_creation',
    'pending_deletion',
    'deleting',
    'error_deletion',
    'unresponsive',
    'scaling',
    'pending_provision',
    'provisioning',
    'error_provisioning',
    'pending_deprovision',
    'deprovisioning',
    'deprovisioned',
    'error_deprovisioning',
    'awaiting_heartbeat'
);


ALTER TYPE "public"."account_tool_environment_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."account_tool_environment_status_enum" IS 'Adds awaiting_heartbeat status for when a toolbox is provisioned but first contact from DTMA is pending. Retains WBS v2.1 statuses and prior values.';



CREATE TYPE "public"."account_tool_installation_status_enum" AS ENUM (
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
    'disabled',
    'pending_deploy',
    'deploying',
    'running',
    'error',
    'pending_delete',
    'deleting'
);


ALTER TYPE "public"."account_tool_installation_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."account_tool_installation_status_enum" IS 'Reflects WBS v2.1 statuses for tool instances on a toolbox, retaining some prior more granular values.';



CREATE TYPE "public"."agent_tool_credential_status_enum" AS ENUM (
    'active',
    'revoked',
    'requires_reauth',
    'error'
);


ALTER TYPE "public"."agent_tool_credential_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."catalog_tool_status_enum" AS ENUM (
    'available',
    'beta',
    'experimental',
    'deprecated',
    'archived'
);


ALTER TYPE "public"."catalog_tool_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."chat_member_type" AS ENUM (
    'user',
    'agent',
    'team'
);


ALTER TYPE "public"."chat_member_type" OWNER TO "postgres";


CREATE TYPE "public"."droplet_status_enum" AS ENUM (
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


ALTER TYPE "public"."droplet_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."room_member_details" AS (
	"member_entry_id" "uuid",
	"room_id" "uuid",
	"member_type" "text",
	"member_id" "uuid",
	"added_at" timestamp with time zone,
	"member_name" "text",
	"member_avatar_url" "text"
);


ALTER TYPE "public"."room_member_details" OWNER TO "postgres";


CREATE TYPE "public"."tool_installation_status_enum" AS ENUM (
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


ALTER TYPE "public"."tool_installation_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."tool_packaging_type_enum" AS ENUM (
    'docker_image'
);


ALTER TYPE "public"."tool_packaging_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id AND w.owner_user_id = p_user_id
    UNION ALL
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id AND wm.role = 'moderator' -- Or other managing roles
  );
$$;


ALTER FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text" DEFAULT NULL::"text", "description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_secret_id UUID;
BEGIN
    -- Ensure supabase_vault.secrets table exists (basic check)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'supabase_vault' AND table_name = 'secrets'
    ) THEN
        RAISE EXCEPTION 'Supabase Vault (supabase_vault.secrets table) not found. Ensure Vault is enabled and initialized.';
    END IF;

    INSERT INTO supabase_vault.secrets (secret, name, description)
    VALUES (secret_value, name, description)
    RETURNING id INTO new_secret_id;

    RETURN new_secret_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error for debugging, then re-raise to ensure transaction rollback if applicable
        RAISE WARNING 'Error in create_vault_secret: % - %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;


ALTER FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text", "description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text", "description" "text") IS 'Creates a new secret in Supabase Vault and returns its UUID. Inputs: secret_value, optional name, optional description.';



CREATE OR REPLACE FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") IS 'Deletes a secret from Supabase Vault by its UUID. Returns true if deletion was successful, false if not found.';



CREATE OR REPLACE FUNCTION "public"."generate_organization_api_key"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN 'agnt_' || encode(gen_random_bytes(32), 'base64');
END;
$$;


ALTER FUNCTION "public"."generate_organization_api_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agent_mcp_servers"("p_agent_id" "uuid") RETURNS TABLE("instance_id" "uuid", "instance_name" "text", "mcp_endpoint_path" "text", "mcp_transport_type" "text", "mcp_capabilities" "jsonb", "access_level" "text", "is_active" boolean, "status_on_toolbox" "public"."account_tool_installation_status_enum")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    ati.id,
    ati.instance_name_on_toolbox,
    ati.mcp_endpoint_path,
    ati.mcp_transport_type,
    ati.mcp_server_capabilities,
    amsa.access_level,
    amsa.is_active,
    ati.status_on_toolbox
  FROM account_tool_instances ati
  JOIN agent_mcp_server_access amsa ON ati.id = amsa.account_tool_instance_id
  WHERE amsa.agent_id = p_agent_id
    AND amsa.is_active = true
    AND ati.mcp_server_type = 'mcp_server'
    AND ati.status_on_toolbox IN ('active', 'running');
$$;


ALTER FUNCTION "public"."get_agent_mcp_servers"("p_agent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agent_mcp_servers"("p_agent_id" "uuid") IS 'Returns all MCP servers accessible to an agent';



CREATE OR REPLACE FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") RETURNS TABLE("permission_id" "uuid", "connection_id" "uuid", "provider_name" "text", "provider_display_name" "text", "connection_name" "text", "permission_level" "text", "allowed_scopes" "jsonb", "expires_at" timestamp with time zone, "usage_count" integer, "last_used_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  JOIN oauth_providers op ON uoc.oauth_provider_id = op.id
  WHERE aop.agent_id = p_agent_id
    AND aop.is_active = true
    AND uoc.connection_status = 'active'
    AND (aop.expires_at IS NULL OR aop.expires_at > now());
$$;


ALTER FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") IS 'Returns OAuth permissions for an agent';



CREATE OR REPLACE FUNCTION "public"."get_available_mcp_servers"("p_user_id" "uuid") RETURNS TABLE("instance_id" "uuid", "instance_name" "text", "mcp_endpoint_path" "text", "mcp_transport_type" "text", "mcp_capabilities" "jsonb", "status_on_toolbox" "public"."account_tool_installation_status_enum", "environment_id" "uuid", "environment_status" "public"."account_tool_environment_status_enum")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    ati.id,
    ati.instance_name_on_toolbox,
    ati.mcp_endpoint_path,
    ati.mcp_transport_type,
    ati.mcp_server_capabilities,
    ati.status_on_toolbox,
    ate.id,
    ate.status
  FROM account_tool_instances ati
  JOIN account_tool_environments ate ON ati.account_tool_environment_id = ate.id
  WHERE ate.user_id = p_user_id
    AND ati.mcp_server_type = 'mcp_server'
    AND ati.status_on_toolbox IN ('active', 'running', 'pending_install', 'installing')
  ORDER BY ati.created_at DESC;
$$;


ALTER FUNCTION "public"."get_available_mcp_servers"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_mcp_servers"("p_user_id" "uuid") IS 'Returns all MCP servers available in user environments';



CREATE OR REPLACE FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") RETURNS TABLE("id" "uuid", "channel_id" "uuid", "sender_user_id" "uuid", "sender_agent_id" "uuid", "content" "text", "metadata" "jsonb", "embedding" "public"."vector", "created_at" timestamp with time zone, "user_profile" "jsonb", "agent" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_claim"("claim_name" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim_name;
$$;


ALTER FUNCTION "public"."get_my_claim"("claim_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_claim"("claim_name" "text") IS 'Retrieves a specific text claim from the current session''s JWT claims.';



CREATE OR REPLACE FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT room_id
  FROM chat_channels
  WHERE id = p_channel_id;
$$;


ALTER FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_room_members"("p_room_id" "uuid") RETURNS SETOF "public"."room_member_details"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_room_members"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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


ALTER FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context_window_size" integer DEFAULT 20 NOT NULL,
    "context_window_token_limit" integer DEFAULT 8000 NOT NULL,
    CONSTRAINT "chat_rooms_name_check" CHECK (("char_length"("name") > 0))
);

ALTER TABLE ONLY "public"."workspaces" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspaces" IS 'Top-level container for chat channels and members, similar to a Discord server.';



COMMENT ON COLUMN "public"."workspaces"."id" IS 'Unique identifier for the chat room.';



COMMENT ON COLUMN "public"."workspaces"."name" IS 'User-defined name for the chat room.';



COMMENT ON COLUMN "public"."workspaces"."owner_user_id" IS 'The user who created and owns the chat room.';



COMMENT ON COLUMN "public"."workspaces"."created_at" IS 'Timestamp when the chat room was created.';



COMMENT ON COLUMN "public"."workspaces"."context_window_size" IS 'Maximum number of recent messages to include in the context for agents in this workspace.';



COMMENT ON COLUMN "public"."workspaces"."context_window_token_limit" IS 'Maximum number of tokens allowed in the context window sent to agents.';



CREATE OR REPLACE FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") RETURNS SETOF "public"."workspaces"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cr.*
  FROM public.chat_rooms cr
  WHERE public.is_room_member(cr.id, p_user_id); -- Filter rooms using the helper
$$;


ALTER FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") RETURNS TABLE("connection_id" "uuid", "provider_name" "text", "provider_display_name" "text", "external_username" "text", "connection_name" "text", "scopes_granted" "jsonb", "connection_status" "text", "token_expires_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    uoc.id,
    op.name,
    op.display_name,
    uoc.external_username,
    uoc.connection_name,
    uoc.scopes_granted,
    uoc.connection_status,
    uoc.token_expires_at
  FROM user_oauth_connections uoc
  JOIN oauth_providers op ON uoc.oauth_provider_id = op.id
  WHERE uoc.user_id = p_user_id
    AND uoc.connection_status IN ('active', 'expired');
$$;


ALTER FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") IS 'Returns all OAuth connections for a user';



CREATE OR REPLACE FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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


ALTER FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") RETURNS TABLE("id" "uuid", "role" "text", "created_at" timestamp with time zone, "workspace_id" "uuid", "user_id" "uuid", "agent_id" "uuid", "team_id" "uuid", "user_profile" "jsonb", "agent" "jsonb", "team" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text" DEFAULT 'read_only'::"text", "p_allowed_tools" "jsonb" DEFAULT NULL::"jsonb", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_access_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the user ID for the agent
    SELECT user_id INTO v_user_id 
    FROM agents 
    WHERE id = p_agent_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Verify the user owns the MCP server instance
    IF NOT EXISTS (
        SELECT 1 
        FROM account_tool_instances ati
        JOIN account_tool_environments ate ON ati.account_tool_environment_id = ate.id
        WHERE ati.id = p_instance_id 
        AND ate.user_id = v_user_id
        AND ati.mcp_server_type = 'mcp_server'
    ) THEN
        RAISE EXCEPTION 'MCP server instance not found or access denied';
    END IF;
    
    -- Insert or update the access record
    INSERT INTO agent_mcp_server_access (
        agent_id,
        account_tool_instance_id,
        granted_by_user_id,
        access_level,
        allowed_tools,
        expires_at
    ) VALUES (
        p_agent_id,
        p_instance_id,
        v_user_id,
        p_access_level,
        p_allowed_tools,
        p_expires_at
    )
    ON CONFLICT (agent_id, account_tool_instance_id) 
    DO UPDATE SET
        access_level = EXCLUDED.access_level,
        allowed_tools = EXCLUDED.allowed_tools,
        expires_at = EXCLUDED.expires_at,
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_access_id;
    
    RETURN v_access_id;
END;
$$;


ALTER FUNCTION "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone) IS 'Grants agent access to an MCP server';



CREATE OR REPLACE FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text" DEFAULT 'read_only'::"text", "p_allowed_scopes" "jsonb" DEFAULT NULL::"jsonb", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) IS 'Grants agent access to user OAuth connection';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Use the new table name here
  INSERT INTO public.user_profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_key_generation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
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


ALTER FUNCTION "public"."handle_new_user_key_generation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user_key_generation"() IS 'Trigger function to generate a unique encryption key (using pgcrypto from extensions schema) and store it.';



CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_organization_permission"("user_id" "uuid", "org_id" "uuid", "permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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


ALTER FUNCTION "public"."has_organization_permission"("user_id" "uuid", "org_id" "uuid", "permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agents
    WHERE id = agent_id_to_check AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_global_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."is_global_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_organization_member"("user_id" "uuid", "org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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


ALTER FUNCTION "public"."is_organization_member"("user_id" "uuid", "org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "topic" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    CONSTRAINT "chat_channels_name_check" CHECK (("char_length"("name") > 0))
);

ALTER TABLE ONLY "public"."chat_channels" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_channels" IS 'Represents individual channels within a chat room, similar to Discord channels.';



COMMENT ON COLUMN "public"."chat_channels"."id" IS 'Unique identifier for the channel.';



COMMENT ON COLUMN "public"."chat_channels"."workspace_id" IS 'The chat room this channel belongs to.';



COMMENT ON COLUMN "public"."chat_channels"."name" IS 'Name of the channel (e.g., #general, #random).';



COMMENT ON COLUMN "public"."chat_channels"."topic" IS 'Optional topic description for the channel.';



COMMENT ON COLUMN "public"."chat_channels"."created_at" IS 'Timestamp when the channel was created.';



COMMENT ON COLUMN "public"."chat_channels"."last_message_at" IS 'Timestamp of the last message sent in this channel (for sorting).';



CREATE OR REPLACE FUNCTION "public"."list_room_channels"("p_room_id" "uuid") RETURNS SETOF "public"."chat_channels"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."list_room_channels"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") RETURNS TABLE("id" "uuid", "channel_id" "uuid", "content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") IS 'Records OAuth connection usage by agent';



CREATE OR REPLACE FUNCTION "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID for the agent
    SELECT user_id INTO v_user_id 
    FROM agents 
    WHERE id = p_agent_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Update the access record to inactive
    UPDATE agent_mcp_server_access 
    SET is_active = false, updated_at = now()
    WHERE agent_id = p_agent_id 
    AND account_tool_instance_id = p_instance_id
    AND granted_by_user_id = v_user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") IS 'Revokes agent access to an MCP server';



CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "sender_agent_id" "uuid",
    "sender_user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb",
    CONSTRAINT "chat_messages_content_check" CHECK (("char_length"("content") > 0)),
    CONSTRAINT "chk_sender_not_null" CHECK ((("sender_agent_id" IS NOT NULL) OR ("sender_user_id" IS NOT NULL)))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_messages" IS 'Stores individual messages within chat sessions.';



COMMENT ON COLUMN "public"."chat_messages"."id" IS 'Unique identifier for the message.';



COMMENT ON COLUMN "public"."chat_messages"."channel_id" IS 'The chat session this message belongs to.';



COMMENT ON COLUMN "public"."chat_messages"."sender_agent_id" IS 'The agent that sent the message (if applicable).';



COMMENT ON COLUMN "public"."chat_messages"."sender_user_id" IS 'The user that sent the message (if applicable).';



COMMENT ON COLUMN "public"."chat_messages"."content" IS 'The textual content of the message.';



COMMENT ON COLUMN "public"."chat_messages"."created_at" IS 'Timestamp when the message was created.';



COMMENT ON COLUMN "public"."chat_messages"."embedding" IS 'Vector embedding of the message content.';



COMMENT ON COLUMN "public"."chat_messages"."metadata" IS 'JSONB field for storing arbitrary metadata, e.g., mentions.';



CREATE OR REPLACE FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text" DEFAULT 'text'::"text", "p_match_count" integer DEFAULT 5, "p_match_threshold" double precision DEFAULT 0.7) RETURNS SETOF "public"."chat_messages"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_team_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.owner_user_id = auth.uid();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_team_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_channel_last_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.chat_channels
    SET last_message_at = NEW.created_at
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_channel_last_message_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.agent_discord_connections
  SET worker_status = new_status_in
  WHERE id = connection_id_in;
END;
$$;


ALTER FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    has_role boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = $2
    ) INTO has_role;
    RETURN has_role;
END;
$_$;


ALTER FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_organization_slug"("slug" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
BEGIN
    -- Slug must be 3-50 characters, lowercase, alphanumeric with hyphens
    RETURN slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$';
END;
$_$;


ALTER FUNCTION "public"."validate_organization_slug"("slug" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_tool_environments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "do_droplet_id" bigint,
    "public_ip_address" "inet",
    "status" "public"."account_tool_environment_status_enum" DEFAULT 'inactive'::"public"."account_tool_environment_status_enum" NOT NULL,
    "region_slug" "text" NOT NULL,
    "size_slug" "text" NOT NULL,
    "image_slug" "text" NOT NULL,
    "last_heartbeat_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "description" "text",
    "dtma_bearer_token" "text",
    "dtma_last_known_version" "text",
    "dtma_health_details_json" "jsonb",
    "provisioning_error_message" "text"
);


ALTER TABLE "public"."account_tool_environments" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_tool_environments" IS 'Stores information about shared DigitalOcean Droplets provisioned for a user account''s tool environment.';



COMMENT ON COLUMN "public"."account_tool_environments"."user_id" IS 'The user account this tool environment belongs to.';



COMMENT ON COLUMN "public"."account_tool_environments"."do_droplet_id" IS 'The DigitalOcean ID of the provisioned droplet.';



COMMENT ON COLUMN "public"."account_tool_environments"."status" IS 'Current status of the account tool environment, aligned with WBS v2.1 definitions.';



COMMENT ON COLUMN "public"."account_tool_environments"."image_slug" IS 'Base OS image slug used for the droplet (e.g., "ubuntu-22-04-x64").';



COMMENT ON COLUMN "public"."account_tool_environments"."last_heartbeat_at" IS 'Timestamp of the last successful contact from the DTMA on this environment.';



COMMENT ON COLUMN "public"."account_tool_environments"."name" IS 'User-defined name for the Toolbox, e.g., "My Primary Toolbox"';



COMMENT ON COLUMN "public"."account_tool_environments"."description" IS 'Optional description for the Toolbox.';



COMMENT ON COLUMN "public"."account_tool_environments"."dtma_bearer_token" IS 'Bearer token for the DTMA on this environment to authenticate with the backend.';



COMMENT ON COLUMN "public"."account_tool_environments"."dtma_last_known_version" IS 'Last known version of the DTMA running on this environment.';



COMMENT ON COLUMN "public"."account_tool_environments"."dtma_health_details_json" IS 'Health details reported by DTMA (e.g., disk, CPU, memory).';



COMMENT ON COLUMN "public"."account_tool_environments"."provisioning_error_message" IS 'Records errors specifically from the provisioning/deprovisioning lifecycle of the environment.';



CREATE TABLE IF NOT EXISTS "public"."account_tool_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_tool_environment_id" "uuid" NOT NULL,
    "tool_catalog_id" "uuid" NOT NULL,
    "status_on_toolbox" "public"."account_tool_installation_status_enum" DEFAULT 'pending_install'::"public"."account_tool_installation_status_enum" NOT NULL,
    "config_values" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instance_name_on_toolbox" "text",
    "port_mapping_json" "jsonb",
    "last_heartbeat_from_dtma" timestamp with time zone,
    "version" "text",
    "base_config_override_json" "jsonb",
    "instance_error_message" "text",
    "mcp_server_type" "text",
    "mcp_endpoint_path" "text",
    "mcp_transport_type" "text",
    "mcp_server_capabilities" "jsonb",
    "mcp_discovery_metadata" "jsonb",
    CONSTRAINT "account_tool_instances_mcp_server_type_check" CHECK ((("mcp_server_type" IS NULL) OR ("mcp_server_type" = ANY (ARRAY['standard_tool'::"text", 'mcp_server'::"text"])))),
    CONSTRAINT "account_tool_instances_mcp_transport_type_check" CHECK ((("mcp_transport_type" IS NULL) OR ("mcp_transport_type" = ANY (ARRAY['stdio'::"text", 'sse'::"text", 'websocket'::"text"])))),
    CONSTRAINT "chk_mcp_server_required_fields" CHECK ((("mcp_server_type" IS NULL) OR ("mcp_server_type" = 'standard_tool'::"text") OR (("mcp_server_type" = 'mcp_server'::"text") AND ("mcp_transport_type" IS NOT NULL))))
);


ALTER TABLE "public"."account_tool_instances" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_tool_instances" IS 'Generic tool instances deployed on an account_tool_environment (Toolbox).';



COMMENT ON COLUMN "public"."account_tool_instances"."account_tool_environment_id" IS 'The ID of the account tool environment.';



COMMENT ON COLUMN "public"."account_tool_instances"."tool_catalog_id" IS 'The ID of the tool from the tool catalog.';



COMMENT ON COLUMN "public"."account_tool_instances"."status_on_toolbox" IS 'Current status of the tool instance on the Toolbox, aligned with WBS v2.1 definitions.';



COMMENT ON COLUMN "public"."account_tool_instances"."config_values" IS 'The configuration values for the tool.';



COMMENT ON COLUMN "public"."account_tool_instances"."created_at" IS 'Timestamp when the tool installation record was created.';



COMMENT ON COLUMN "public"."account_tool_instances"."updated_at" IS 'Timestamp when the tool installation record was last updated.';



COMMENT ON COLUMN "public"."account_tool_instances"."instance_name_on_toolbox" IS 'User-defined or auto-generated name for the tool instance on the Toolbox.';



COMMENT ON COLUMN "public"."account_tool_instances"."port_mapping_json" IS 'Port mapping for the tool instance container, e.g., {"container_port": 8080, "host_port": 49152}.';



COMMENT ON COLUMN "public"."account_tool_instances"."last_heartbeat_from_dtma" IS 'Timestamp of the last heartbeat received from DTMA for this specific tool instance (if applicable).';



COMMENT ON COLUMN "public"."account_tool_instances"."version" IS 'Version of the tool (from tool_catalog at deployment, may be updated by DTMA).';



COMMENT ON COLUMN "public"."account_tool_instances"."base_config_override_json" IS 'User-provided overrides for non-credential configurations of the tool instance.';



COMMENT ON COLUMN "public"."account_tool_instances"."instance_error_message" IS 'Error message specific to this tool instance.';



COMMENT ON COLUMN "public"."account_tool_instances"."mcp_server_type" IS 'Type of container: standard_tool or mcp_server';



COMMENT ON COLUMN "public"."account_tool_instances"."mcp_endpoint_path" IS 'MCP server endpoint path (e.g., /mcp)';



COMMENT ON COLUMN "public"."account_tool_instances"."mcp_transport_type" IS 'MCP transport protocol: stdio, sse, or websocket';



COMMENT ON COLUMN "public"."account_tool_instances"."mcp_server_capabilities" IS 'JSON object containing MCP server capabilities';



COMMENT ON COLUMN "public"."account_tool_instances"."mcp_discovery_metadata" IS 'JSON object containing MCP discovery metadata';



CREATE TABLE IF NOT EXISTS "public"."agent_datastores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "datastore_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_datastores" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_datastores" IS 'Junction table connecting agents to their associated datastores';



CREATE TABLE IF NOT EXISTS "public"."agent_discord_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "guild_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discord_app_id" "text" NOT NULL,
    "inactivity_timeout_minutes" integer DEFAULT 10,
    "worker_status" "text" DEFAULT 'inactive'::"text",
    "discord_public_key" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY "public"."agent_discord_connections" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_discord_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_discord_connections" IS 'Stores the specific Discord channels an agent is connected to.';



COMMENT ON COLUMN "public"."agent_discord_connections"."guild_id" IS 'Discord Server ID the agent connection is linked to (can be NULL initially).';



CREATE TABLE IF NOT EXISTS "public"."agent_droplet_tools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_droplet_id" "uuid" NOT NULL,
    "tool_catalog_id" "uuid" NOT NULL,
    "version_to_install" "text" NOT NULL,
    "actual_installed_version" "text",
    "status" "public"."tool_installation_status_enum" DEFAULT 'pending_install'::"public"."tool_installation_status_enum" NOT NULL,
    "config_values" "jsonb" DEFAULT '{}'::"jsonb",
    "runtime_details" "jsonb" DEFAULT '{}'::"jsonb",
    "error_message" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_droplet_tools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_droplets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "do_droplet_id" bigint,
    "ip_address" "inet",
    "status" "public"."droplet_status_enum" DEFAULT 'pending_creation'::"public"."droplet_status_enum" NOT NULL,
    "region_slug" "text" NOT NULL,
    "size_slug" "text" NOT NULL,
    "image_slug" "text" NOT NULL,
    "do_created_at" timestamp with time zone,
    "last_heartbeat_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "tags" "text"[],
    "configuration" "jsonb",
    "dtma_auth_token" "text",
    "dtma_last_known_version" "text",
    "dtma_last_reported_status" "jsonb"
);


ALTER TABLE "public"."agent_droplets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agent_droplets"."name" IS 'The name of the droplet assigned during creation, usually includes agent ID.';



COMMENT ON COLUMN "public"."agent_droplets"."tags" IS 'Tags applied to the droplet in DigitalOcean, also stored for reference.';



COMMENT ON COLUMN "public"."agent_droplets"."configuration" IS 'Configuration used to provision the droplet (region, size, image, etc.).';



COMMENT ON COLUMN "public"."agent_droplets"."dtma_auth_token" IS 'Secure authentication token for the Droplet Tool Management Agent to communicate with the backend.';



COMMENT ON COLUMN "public"."agent_droplets"."dtma_last_known_version" IS 'Last reported version of the DTMA software running on the droplet.';



COMMENT ON COLUMN "public"."agent_droplets"."dtma_last_reported_status" IS 'Last reported detailed status payload from the DTMA heartbeat.';



CREATE TABLE IF NOT EXISTS "public"."agent_mcp_server_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "account_tool_instance_id" "uuid" NOT NULL,
    "granted_by_user_id" "uuid" NOT NULL,
    "access_level" "text" DEFAULT 'read_only'::"text" NOT NULL,
    "allowed_tools" "jsonb",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_mcp_server_access_access_level_check" CHECK (("access_level" = ANY (ARRAY['read_only'::"text", 'full_access'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."agent_mcp_server_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_mcp_server_access" IS 'Defines which agents can access which MCP servers with specific permissions';



CREATE TABLE IF NOT EXISTS "public"."agent_oauth_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_oauth_connection_id" "uuid" NOT NULL,
    "granted_by_user_id" "uuid" NOT NULL,
    "permission_level" "text" DEFAULT 'read_only'::"text" NOT NULL,
    "allowed_scopes" "jsonb",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_oauth_permissions_permission_level_check" CHECK (("permission_level" = ANY (ARRAY['read_only'::"text", 'full_access'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."agent_oauth_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_oauth_permissions" IS 'Agent permissions to access user OAuth connections';



CREATE TABLE IF NOT EXISTS "public"."agent_tool_capability_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_toolbelt_item_id" "uuid" NOT NULL,
    "capability_name" "text" NOT NULL,
    "is_allowed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_tool_capability_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_tool_capability_permissions" IS 'Granular permissions for an agent regarding specific capabilities of a tool in their Toolbelt.';



COMMENT ON COLUMN "public"."agent_tool_capability_permissions"."capability_name" IS 'Name of the capability, matching a key in tool_catalog.required_capabilities_schema.';



CREATE TABLE IF NOT EXISTS "public"."agent_tool_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_toolbelt_item_id" "uuid" NOT NULL,
    "credential_type" "text" NOT NULL,
    "encrypted_credentials" "text" NOT NULL,
    "account_identifier" "text",
    "last_validated_at" timestamp with time zone,
    "status" "public"."agent_tool_credential_status_enum" DEFAULT 'active'::"public"."agent_tool_credential_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_tool_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_tool_credentials" IS 'Stores agent-specific credentials for a tool in their Toolbelt.';



COMMENT ON COLUMN "public"."agent_tool_credentials"."credential_type" IS 'Type of credential, e.g., "oauth2", "api_key".';



COMMENT ON COLUMN "public"."agent_tool_credentials"."encrypted_credentials" IS 'Encrypted credentials or a reference to them in Supabase Vault.';



COMMENT ON COLUMN "public"."agent_tool_credentials"."account_identifier" IS 'A user-friendly identifier for the account associated with the credential.';



CREATE TABLE IF NOT EXISTS "public"."agent_toolbelt_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "account_tool_instance_id" "uuid" NOT NULL,
    "is_active_for_agent" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_toolbelt_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_toolbelt_items" IS 'Specific tool instances from a Toolbox that an agent has added to their Toolbelt.';



COMMENT ON COLUMN "public"."agent_toolbelt_items"."is_active_for_agent" IS 'Indicates if the agent has currently enabled this tool in their toolbelt.';



CREATE TABLE IF NOT EXISTS "public"."agent_toolbox_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "account_tool_environment_id" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_toolbox_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_toolbox_access" IS 'Links agents to Toolboxes (account_tool_environments) they have permission to use.';



CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "discord_channel" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "discord_bot_key" "text",
    "system_instructions" "text",
    "assistant_instructions" "text",
    "discord_bot_token_encrypted" "text",
    "discord_user_id" "text",
    "discord_bot_token_id" "text",
    "active" boolean DEFAULT false,
    "personality" "text",
    "avatar_url" "text"
);

ALTER TABLE ONLY "public"."agents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agents"."discord_bot_token_encrypted" IS 'Stores the Discord bot token, encrypted server-side.';



COMMENT ON COLUMN "public"."agents"."active" IS 'Indicates if the agent is generally considered active/enabled by the user.';



CREATE TABLE IF NOT EXISTS "public"."datastores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "similarity_metric" "text" DEFAULT 'cosine'::"text",
    "similarity_threshold" double precision DEFAULT 0.7,
    "max_results" integer DEFAULT 5,
    CONSTRAINT "datastores_max_results_check" CHECK (("max_results" > 0)),
    CONSTRAINT "datastores_similarity_metric_check" CHECK (("similarity_metric" = ANY (ARRAY['cosine'::"text", 'euclidean'::"text", 'dot'::"text"]))),
    CONSTRAINT "datastores_similarity_threshold_check" CHECK ((("similarity_threshold" >= (0)::double precision) AND ("similarity_threshold" <= (1)::double precision))),
    CONSTRAINT "datastores_type_check" CHECK (("type" = ANY (ARRAY['pinecone'::"text", 'getzep'::"text"])))
);


ALTER TABLE "public"."datastores" OWNER TO "postgres";


COMMENT ON TABLE "public"."datastores" IS 'Stores configuration for vector and knowledge graph datastores';



COMMENT ON COLUMN "public"."datastores"."similarity_metric" IS 'Similarity metric to use for vector search (cosine, euclidean, dot)';



COMMENT ON COLUMN "public"."datastores"."similarity_threshold" IS 'Minimum similarity score threshold (0-1)';



COMMENT ON COLUMN "public"."datastores"."max_results" IS 'Maximum number of results to return from similarity search';



CREATE TABLE IF NOT EXISTS "public"."mcp_configurations" (
    "id" integer NOT NULL,
    "agent_id" "uuid",
    "is_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."mcp_configurations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mcp_configurations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mcp_configurations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mcp_configurations_id_seq" OWNED BY "public"."mcp_configurations"."id";



CREATE TABLE IF NOT EXISTS "public"."mcp_server_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "version" "text" NOT NULL,
    "docker_image" "text" NOT NULL,
    "icon_url" "text",
    "category" "text",
    "provider" "text" DEFAULT 'community'::"text",
    "capabilities" "jsonb" DEFAULT '[]'::"jsonb",
    "required_permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "configuration_schema" "jsonb" DEFAULT '{}'::"jsonb",
    "oauth_providers" "jsonb" DEFAULT '[]'::"jsonb",
    "documentation_url" "text",
    "repository_url" "text",
    "license" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "is_verified" boolean DEFAULT false,
    "is_published" boolean DEFAULT true,
    "download_count" integer DEFAULT 0,
    "rating_average" numeric(3,2) DEFAULT 0.0,
    "rating_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mcp_server_catalog_provider_check" CHECK (("provider" = ANY (ARRAY['official'::"text", 'community'::"text", 'custom'::"text"]))),
    CONSTRAINT "mcp_server_catalog_rating_average_check" CHECK ((("rating_average" >= (0)::numeric) AND ("rating_average" <= (5)::numeric)))
);


ALTER TABLE "public"."mcp_server_catalog" OWNER TO "postgres";


COMMENT ON TABLE "public"."mcp_server_catalog" IS 'Central catalog of available MCP servers';



CREATE TABLE IF NOT EXISTS "public"."mcp_server_deployments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "catalog_server_id" "uuid",
    "name" "text" NOT NULL,
    "display_name" "text",
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "environment_variables" "jsonb" DEFAULT '{}'::"jsonb",
    "resource_limits" "jsonb" DEFAULT '{}'::"jsonb",
    "health_check_url" "text",
    "internal_endpoint" "text",
    "external_endpoint" "text",
    "container_id" "text",
    "last_health_check" timestamp with time zone,
    "health_status" "text" DEFAULT 'unknown'::"text",
    "error_message" "text",
    "deployment_logs" "jsonb" DEFAULT '[]'::"jsonb",
    "auto_restart" boolean DEFAULT true,
    "restart_count" integer DEFAULT 0,
    "deployed_by" "uuid",
    "deployed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mcp_server_deployments_health_status_check" CHECK (("health_status" = ANY (ARRAY['healthy'::"text", 'unhealthy'::"text", 'unknown'::"text"]))),
    CONSTRAINT "mcp_server_deployments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'deploying'::"text", 'active'::"text", 'error'::"text", 'stopping'::"text", 'stopped'::"text", 'updating'::"text"])))
);


ALTER TABLE "public"."mcp_server_deployments" OWNER TO "postgres";


COMMENT ON TABLE "public"."mcp_server_deployments" IS 'Organization-specific MCP server deployments';



CREATE TABLE IF NOT EXISTS "public"."mcp_servers" (
    "id" integer NOT NULL,
    "config_id" integer,
    "name" character varying(255) NOT NULL,
    "endpoint_url" "text" NOT NULL,
    "vault_api_key_id" "uuid",
    "timeout_ms" integer DEFAULT 5000,
    "max_retries" integer DEFAULT 3,
    "retry_backoff_ms" integer DEFAULT 1000,
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "capabilities" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_servers_max_retries_check" CHECK (("max_retries" >= 0)),
    CONSTRAINT "mcp_servers_retry_backoff_ms_check" CHECK (("retry_backoff_ms" >= 0)),
    CONSTRAINT "mcp_servers_timeout_ms_check" CHECK (("timeout_ms" >= 0))
);


ALTER TABLE "public"."mcp_servers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mcp_servers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."mcp_servers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mcp_servers_id_seq" OWNED BY "public"."mcp_servers"."id";



CREATE TABLE IF NOT EXISTS "public"."oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "authorization_endpoint" "text" NOT NULL,
    "token_endpoint" "text" NOT NULL,
    "revoke_endpoint" "text",
    "discovery_endpoint" "text",
    "scopes_supported" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pkce_required" boolean DEFAULT true NOT NULL,
    "client_credentials_location" "text" DEFAULT 'header'::"text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "configuration_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oauth_providers" OWNER TO "postgres";


COMMENT ON TABLE "public"."oauth_providers" IS 'Central registry of OAuth providers (GitHub, Google, Microsoft, etc.)';



CREATE TABLE IF NOT EXISTS "public"."organization_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_api_keys" IS 'API keys for programmatic access to organization resources';



CREATE TABLE IF NOT EXISTS "public"."organization_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."organization_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_invitations" IS 'Pending invitations to join organizations';



CREATE TABLE IF NOT EXISTS "public"."organization_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "invited_by" "uuid",
    "invited_at" timestamp with time zone,
    "joined_at" timestamp with time zone,
    "last_active_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'viewer'::"text"]))),
    CONSTRAINT "organization_memberships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'suspended'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."organization_memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_memberships" IS 'User memberships in organizations with roles and permissions';



COMMENT ON COLUMN "public"."organization_memberships"."role" IS 'User role within the organization';



COMMENT ON COLUMN "public"."organization_memberships"."permissions" IS 'Additional specific permissions for this user';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "max_mcp_servers" integer DEFAULT 5,
    "max_concurrent_connections" integer DEFAULT 50,
    "logo_url" "text",
    "website_url" "text",
    "contact_email" "text",
    "billing_email" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_valid_slug" CHECK ("public"."validate_organization_slug"("slug")),
    CONSTRAINT "organizations_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Multi-tenant organizations for MCP server management';



COMMENT ON COLUMN "public"."organizations"."slug" IS 'URL-friendly unique identifier for organizations';



COMMENT ON COLUMN "public"."organizations"."max_mcp_servers" IS 'Maximum number of MCP servers allowed for this organization';



COMMENT ON COLUMN "public"."organizations"."max_concurrent_connections" IS 'Maximum concurrent MCP connections allowed';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "mobile" "text",
    "company_name" "text",
    "title" "text",
    "usage_reason" "jsonb",
    "hopes_goals" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."roles" IS 'Stores user roles (e.g., admin, user)';



COMMENT ON COLUMN "public"."roles"."name" IS 'Unique name of the role';



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "team_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "team_role" "text",
    "team_role_description" "text",
    "reports_to_agent_id" "uuid",
    "reports_to_user" boolean DEFAULT false NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_one_report_target" CHECK (((("reports_to_agent_id" IS NOT NULL) AND ("reports_to_user" = false)) OR (("reports_to_agent_id" IS NULL) AND ("reports_to_user" = true)) OR (("reports_to_agent_id" IS NULL) AND ("reports_to_user" = false)))),
    CONSTRAINT "chk_reports_to_not_self" CHECK (("agent_id" <> "reports_to_agent_id")),
    CONSTRAINT "team_members_team_role_check" CHECK (("char_length"("team_role") > 0))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_members" IS 'Links Agents to Teams and defines their role/reporting structure within the team.';



COMMENT ON COLUMN "public"."team_members"."team_id" IS 'Foreign key referencing the team.';



COMMENT ON COLUMN "public"."team_members"."agent_id" IS 'The agent who is a member of the team.';



COMMENT ON COLUMN "public"."team_members"."team_role" IS 'The role of the agent within the team.';



COMMENT ON COLUMN "public"."team_members"."team_role_description" IS 'User-defined description of the agent''s specific duties on this team.';



COMMENT ON COLUMN "public"."team_members"."reports_to_agent_id" IS 'Optional: The agent this team member reports to.';



COMMENT ON COLUMN "public"."team_members"."reports_to_user" IS 'Indicates if this agent reports directly to the user for this team.';



COMMENT ON COLUMN "public"."team_members"."joined_at" IS 'Timestamp when the agent joined the team.';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_user_id" "uuid",
    CONSTRAINT "teams_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Stores information about agent teams.';



COMMENT ON COLUMN "public"."teams"."id" IS 'Unique identifier for the team.';



COMMENT ON COLUMN "public"."teams"."name" IS 'Display name of the team.';



COMMENT ON COLUMN "public"."teams"."description" IS 'Optional description of the team''s purpose or focus.';



COMMENT ON COLUMN "public"."teams"."created_at" IS 'Timestamp when the team was created.';



COMMENT ON COLUMN "public"."teams"."updated_at" IS 'Timestamp when the team was last updated.';



COMMENT ON COLUMN "public"."teams"."owner_user_id" IS 'The user (from auth.users) who originally created the team.';



CREATE TABLE IF NOT EXISTS "public"."tool_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tool_name" "text" NOT NULL,
    "description" "text",
    "developer_org_name" "text",
    "categories" "text"[],
    "icon_url" "text",
    "documentation_url" "text",
    "packaging_type" "public"."tool_packaging_type_enum" DEFAULT 'docker_image'::"public"."tool_packaging_type_enum" NOT NULL,
    "package_identifier" "text" NOT NULL,
    "version_info" "jsonb" DEFAULT '{"default_version": "latest", "available_versions": ["latest"]}'::"jsonb" NOT NULL,
    "default_config_template" "jsonb" DEFAULT '{}'::"jsonb",
    "required_secrets_schema" "jsonb" DEFAULT '[]'::"jsonb",
    "resource_requirements" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "public"."catalog_tool_status_enum" DEFAULT 'available'::"public"."catalog_tool_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "docker_image_url" "text" NOT NULL,
    "category" "text",
    "required_config_schema" "jsonb",
    "required_capabilities_schema" "jsonb",
    "provider" "text",
    "version" "text" DEFAULT '1.0.0'::"text" NOT NULL,
    "is_public" boolean DEFAULT true
);


ALTER TABLE "public"."tool_catalog" OWNER TO "postgres";


COMMENT ON TABLE "public"."tool_catalog" IS 'Admin-curated list of available tools that can be deployed on Toolboxes.';



COMMENT ON COLUMN "public"."tool_catalog"."required_secrets_schema" IS 'JSON schema defining secrets required by the tool.';



COMMENT ON COLUMN "public"."tool_catalog"."docker_image_url" IS 'The Docker image URL for deploying this tool.';



COMMENT ON COLUMN "public"."tool_catalog"."required_config_schema" IS 'JSON schema for basic configuration options.';



COMMENT ON COLUMN "public"."tool_catalog"."required_capabilities_schema" IS 'JSON schema defining capabilities the tool offers.';



CREATE TABLE IF NOT EXISTS "public"."user_oauth_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "oauth_provider_id" "uuid" NOT NULL,
    "external_user_id" "text" NOT NULL,
    "external_username" "text",
    "scopes_granted" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "connection_name" "text",
    "vault_access_token_id" "uuid",
    "vault_refresh_token_id" "uuid",
    "token_expires_at" timestamp with time zone,
    "last_token_refresh" timestamp with time zone,
    "connection_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "connection_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_oauth_token_consistency" CHECK (((("connection_status" = 'active'::"text") AND ("vault_access_token_id" IS NOT NULL)) OR ("connection_status" <> 'active'::"text"))),
    CONSTRAINT "user_oauth_connections_connection_status_check" CHECK (("connection_status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."user_oauth_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_oauth_connections" IS 'User-specific OAuth provider connections with credential storage';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Stores public profile information for users, linked to auth.users';



COMMENT ON COLUMN "public"."user_profiles"."id" IS 'References auth.users.id';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Links users to their assigned roles.';



CREATE TABLE IF NOT EXISTS "public"."user_secrets" (
    "user_id" "uuid" NOT NULL,
    "encryption_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."user_secrets" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_secrets" IS 'Stores per-user encryption keys for sensitive data like bot tokens.';



COMMENT ON COLUMN "public"."user_secrets"."user_id" IS 'Foreign key referencing the user in auth.users.';



COMMENT ON COLUMN "public"."user_secrets"."encryption_key" IS 'Base64 encoded 32-byte encryption key specific to the user.';



CREATE TABLE IF NOT EXISTS "public"."user_ssh_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "public_key_vault_id" "uuid" NOT NULL,
    "private_key_vault_id" "uuid" NOT NULL,
    "key_name" "text" DEFAULT 'default'::"text" NOT NULL,
    "fingerprint" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_ssh_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_ssh_keys" IS 'Metadata for user SSH keys stored securely in Supabase Vault';



COMMENT ON COLUMN "public"."user_ssh_keys"."public_key_vault_id" IS 'UUID reference to public key stored in Supabase Vault';



COMMENT ON COLUMN "public"."user_ssh_keys"."private_key_vault_id" IS 'UUID reference to private key stored in Supabase Vault';



COMMENT ON COLUMN "public"."user_ssh_keys"."key_name" IS 'User-friendly name for the SSH key pair';



COMMENT ON COLUMN "public"."user_ssh_keys"."fingerprint" IS 'SSH key fingerprint for identification and verification';



CREATE TABLE IF NOT EXISTS "public"."user_team_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_team_memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_team_memberships" IS 'Associates users with teams.';



COMMENT ON COLUMN "public"."user_team_memberships"."user_id" IS 'Foreign key referencing the user.';



COMMENT ON COLUMN "public"."user_team_memberships"."team_id" IS 'Foreign key referencing the team.';



COMMENT ON COLUMN "public"."user_team_memberships"."joined_at" IS 'Timestamp when the user joined the team.';



CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "team_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "added_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_one_member_type" CHECK (("num_nonnulls"("agent_id", "team_id", "user_id") = 1))
);

ALTER TABLE ONLY "public"."workspace_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


ALTER TABLE ONLY "public"."mcp_configurations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mcp_configurations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mcp_servers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mcp_servers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "account_tool_environment_active_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_dtma_bearer_token_key" UNIQUE ("dtma_bearer_token");



COMMENT ON CONSTRAINT "account_tool_environments_dtma_bearer_token_key" ON "public"."account_tool_environments" IS 'Ensures dtma_bearer_token is unique across all tool environments for secure lookup.';



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_agent_id_datastore_id_key" UNIQUE ("agent_id", "datastore_id");



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_discord_connections"
    ADD CONSTRAINT "agent_discord_connections_agent_id_unique" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."agent_discord_connections"
    ADD CONSTRAINT "agent_discord_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_agent_id_key" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_do_droplet_id_key" UNIQUE ("do_droplet_id");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_dtma_auth_token_key" UNIQUE ("dtma_auth_token");



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_mcp_server_access"
    ADD CONSTRAINT "agent_mcp_server_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_capability_permissions"
    ADD CONSTRAINT "agent_tool_capability_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_credentials"
    ADD CONSTRAINT "agent_tool_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_toolbelt_items"
    ADD CONSTRAINT "agent_toolbelt_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_toolbox_access"
    ADD CONSTRAINT "agent_toolbox_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."datastores"
    ADD CONSTRAINT "datastores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_configurations"
    ADD CONSTRAINT "mcp_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_server_catalog"
    ADD CONSTRAINT "mcp_server_catalog_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."mcp_server_catalog"
    ADD CONSTRAINT "mcp_server_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_server_deployments"
    ADD CONSTRAINT "mcp_server_deployments_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."mcp_server_deployments"
    ADD CONSTRAINT "mcp_server_deployments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_providers"
    ADD CONSTRAINT "oauth_providers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."oauth_providers"
    ADD CONSTRAINT "oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_api_keys"
    ADD CONSTRAINT "organization_api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."organization_api_keys"
    ADD CONSTRAINT "organization_api_keys_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."organization_api_keys"
    ADD CONSTRAINT "organization_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_email_key" UNIQUE ("organization_id", "email");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "agent_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tool_catalog"
    ADD CONSTRAINT "tool_catalog_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tool_catalog"
    ADD CONSTRAINT "tool_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tool_catalog"
    ADD CONSTRAINT "tool_catalog_tool_name_key" UNIQUE ("tool_name");



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "unique_user_team_membership" UNIQUE ("user_id", "team_id");



COMMENT ON CONSTRAINT "unique_user_team_membership" ON "public"."user_team_memberships" IS 'Ensures a user cannot be added multiple times to the same team.';



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "unique_workspace_agent" UNIQUE ("workspace_id", "agent_id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "unique_workspace_team" UNIQUE ("workspace_id", "team_id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "unique_workspace_user" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "uq_account_env_tool" UNIQUE ("account_tool_environment_id", "tool_catalog_id");



ALTER TABLE ONLY "public"."agent_mcp_server_access"
    ADD CONSTRAINT "uq_agent_mcp_instance" UNIQUE ("agent_id", "account_tool_instance_id");



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "uq_agent_oauth_connection" UNIQUE ("agent_id", "user_oauth_connection_id");



ALTER TABLE ONLY "public"."agent_tool_capability_permissions"
    ADD CONSTRAINT "uq_agent_tool_capability_permission" UNIQUE ("agent_toolbelt_item_id", "capability_name");



ALTER TABLE ONLY "public"."agent_toolbelt_items"
    ADD CONSTRAINT "uq_agent_toolbelt_item" UNIQUE ("agent_id", "account_tool_instance_id");



ALTER TABLE ONLY "public"."agent_toolbox_access"
    ADD CONSTRAINT "uq_agent_toolbox_access" UNIQUE ("agent_id", "account_tool_environment_id");



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "uq_do_droplet_id" UNIQUE ("do_droplet_id");



ALTER TABLE ONLY "public"."user_oauth_connections"
    ADD CONSTRAINT "uq_user_provider_external" UNIQUE ("user_id", "oauth_provider_id", "external_user_id");



ALTER TABLE ONLY "public"."user_oauth_connections"
    ADD CONSTRAINT "user_oauth_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_ssh_keys"
    ADD CONSTRAINT "user_ssh_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ssh_keys"
    ADD CONSTRAINT "user_ssh_keys_user_id_key_name_key" UNIQUE ("user_id", "key_name");



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_account_tool_instances_mcp_server_type" ON "public"."account_tool_instances" USING "btree" ("mcp_server_type") WHERE ("mcp_server_type" = 'mcp_server'::"text");



CREATE INDEX "idx_agent_datastores_agent_id" ON "public"."agent_datastores" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_datastores_datastore_id" ON "public"."agent_datastores" USING "btree" ("datastore_id");



CREATE INDEX "idx_agent_discord_connections_agent_id" ON "public"."agent_discord_connections" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_discord_connections_guild_id" ON "public"."agent_discord_connections" USING "btree" ("guild_id");



CREATE INDEX "idx_agent_droplet_tools_agent_droplet_id" ON "public"."agent_droplet_tools" USING "btree" ("agent_droplet_id");



CREATE INDEX "idx_agent_droplet_tools_status" ON "public"."agent_droplet_tools" USING "btree" ("status");



CREATE INDEX "idx_agent_droplet_tools_tool_catalog_id" ON "public"."agent_droplet_tools" USING "btree" ("tool_catalog_id");



CREATE INDEX "idx_agent_droplets_agent_id" ON "public"."agent_droplets" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_droplets_do_droplet_id" ON "public"."agent_droplets" USING "btree" ("do_droplet_id");



CREATE INDEX "idx_agent_droplets_status" ON "public"."agent_droplets" USING "btree" ("status");



CREATE INDEX "idx_agent_mcp_server_access_agent_id" ON "public"."agent_mcp_server_access" USING "btree" ("agent_id") WHERE ("is_active" = true);



CREATE INDEX "idx_agent_oauth_permissions_agent_id" ON "public"."agent_oauth_permissions" USING "btree" ("agent_id") WHERE ("is_active" = true);



CREATE INDEX "idx_agents_created_at" ON "public"."agents" USING "btree" ("created_at");



CREATE INDEX "idx_agents_user_id" ON "public"."agents" USING "btree" ("user_id");



CREATE INDEX "idx_ata_account_tool_environment_id" ON "public"."agent_toolbox_access" USING "btree" ("account_tool_environment_id");



CREATE INDEX "idx_ata_agent_id" ON "public"."agent_toolbox_access" USING "btree" ("agent_id");



CREATE INDEX "idx_atc_agent_toolbelt_item_id" ON "public"."agent_tool_credentials" USING "btree" ("agent_toolbelt_item_id");



CREATE INDEX "idx_atcp_agent_toolbelt_item_id" ON "public"."agent_tool_capability_permissions" USING "btree" ("agent_toolbelt_item_id");



CREATE INDEX "idx_ate_status" ON "public"."account_tool_environments" USING "btree" ("status");



CREATE INDEX "idx_ate_user_id" ON "public"."account_tool_environments" USING "btree" ("user_id");



CREATE INDEX "idx_ateat_account_tool_environment_id" ON "public"."account_tool_instances" USING "btree" ("account_tool_environment_id");



CREATE INDEX "idx_ateat_status" ON "public"."account_tool_instances" USING "btree" ("status_on_toolbox");



CREATE INDEX "idx_ateat_tool_catalog_id" ON "public"."account_tool_instances" USING "btree" ("tool_catalog_id");



CREATE INDEX "idx_ati_account_tool_instance_id" ON "public"."agent_toolbelt_items" USING "btree" ("account_tool_instance_id");



CREATE INDEX "idx_ati_agent_id" ON "public"."agent_toolbelt_items" USING "btree" ("agent_id");



CREATE INDEX "idx_chat_channels_last_message_at" ON "public"."chat_channels" USING "btree" ("last_message_at" DESC NULLS LAST);



CREATE INDEX "idx_chat_channels_room_id" ON "public"."chat_channels" USING "btree" ("workspace_id");



CREATE INDEX "idx_chat_messages_channel_id_created_at" ON "public"."chat_messages" USING "btree" ("channel_id", "created_at");



CREATE INDEX "idx_chat_messages_sender_agent_id" ON "public"."chat_messages" USING "btree" ("sender_agent_id");



CREATE INDEX "idx_chat_messages_sender_user_id" ON "public"."chat_messages" USING "btree" ("sender_user_id");



CREATE INDEX "idx_chat_rooms_owner_user_id" ON "public"."workspaces" USING "btree" ("owner_user_id");



CREATE INDEX "idx_datastores_type" ON "public"."datastores" USING "btree" ("type");



CREATE INDEX "idx_datastores_user_id" ON "public"."datastores" USING "btree" ("user_id");



CREATE INDEX "idx_mcp_configurations_agent_id" ON "public"."mcp_configurations" USING "btree" ("agent_id");



CREATE INDEX "idx_mcp_server_discovery" ON "public"."account_tool_instances" USING "btree" ("account_tool_environment_id", "mcp_server_type", "status_on_toolbox") WHERE ("mcp_server_type" = 'mcp_server'::"text");



CREATE INDEX "idx_mcp_servers_config_id" ON "public"."mcp_servers" USING "btree" ("config_id");



CREATE INDEX "idx_oauth_providers_enabled" ON "public"."oauth_providers" USING "btree" ("name") WHERE ("is_enabled" = true);



CREATE INDEX "idx_organization_api_keys_hash" ON "public"."organization_api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_organization_api_keys_org_active" ON "public"."organization_api_keys" USING "btree" ("organization_id", "is_active");



CREATE INDEX "idx_organization_invitations_email" ON "public"."organization_invitations" USING "btree" ("email");



CREATE INDEX "idx_organization_invitations_expires" ON "public"."organization_invitations" USING "btree" ("expires_at");



CREATE INDEX "idx_organization_invitations_token" ON "public"."organization_invitations" USING "btree" ("token");



CREATE INDEX "idx_organization_memberships_org" ON "public"."organization_memberships" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_memberships_role" ON "public"."organization_memberships" USING "btree" ("role");



CREATE INDEX "idx_organization_memberships_status" ON "public"."organization_memberships" USING "btree" ("status");



CREATE INDEX "idx_organization_memberships_user" ON "public"."organization_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_organizations_active" ON "public"."organizations" USING "btree" ("is_active");



CREATE INDEX "idx_organizations_slug" ON "public"."organizations" USING "btree" ("slug");



CREATE INDEX "idx_team_members_agent_id" ON "public"."team_members" USING "btree" ("agent_id");



CREATE INDEX "idx_team_members_reports_to_agent_id" ON "public"."team_members" USING "btree" ("reports_to_agent_id");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_tool_catalog_categories" ON "public"."tool_catalog" USING "gin" ("categories");



CREATE INDEX "idx_tool_catalog_category" ON "public"."tool_catalog" USING "btree" ("category");



CREATE INDEX "idx_tool_catalog_name" ON "public"."tool_catalog" USING "btree" ("name");



CREATE INDEX "idx_tool_catalog_status" ON "public"."tool_catalog" USING "btree" ("status");



CREATE INDEX "idx_user_oauth_connections_user_id" ON "public"."user_oauth_connections" USING "btree" ("user_id") WHERE ("connection_status" = ANY (ARRAY['active'::"text", 'expired'::"text"]));



CREATE INDEX "idx_user_oauth_provider_lookup" ON "public"."user_oauth_connections" USING "btree" ("user_id", "oauth_provider_id", "connection_status");



CREATE INDEX "idx_user_ssh_keys_fingerprint" ON "public"."user_ssh_keys" USING "btree" ("fingerprint");



CREATE INDEX "idx_user_ssh_keys_user_id" ON "public"."user_ssh_keys" USING "btree" ("user_id");



CREATE INDEX "idx_user_team_memberships_team_id" ON "public"."user_team_memberships" USING "btree" ("team_id");



CREATE INDEX "idx_user_team_memberships_user_id" ON "public"."user_team_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_agent_id" ON "public"."workspace_members" USING "btree" ("agent_id") WHERE ("agent_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_team_id" ON "public"."workspace_members" USING "btree" ("team_id") WHERE ("team_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_workspace_members_workspace_id" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE OR REPLACE TRIGGER "handle_organization_memberships_updated_at" BEFORE UPDATE ON "public"."organization_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_team_update" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "on_profile_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_user_secrets_update" BEFORE UPDATE ON "public"."user_secrets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_user_ssh_keys_update" BEFORE UPDATE ON "public"."user_ssh_keys" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_account_tool_environment_active_tools_updated_at" BEFORE UPDATE ON "public"."account_tool_instances" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_account_tool_environments_updated_at" BEFORE UPDATE ON "public"."account_tool_environments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_droplet_tools_timestamp" BEFORE UPDATE ON "public"."agent_droplet_tools" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_droplets_timestamp" BEFORE UPDATE ON "public"."agent_droplets" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_tool_capability_permissions_updated_at" BEFORE UPDATE ON "public"."agent_tool_capability_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_tool_credentials_updated_at" BEFORE UPDATE ON "public"."agent_tool_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_toolbelt_items_updated_at" BEFORE UPDATE ON "public"."agent_toolbelt_items" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_agent_toolbox_access_updated_at" BEFORE UPDATE ON "public"."agent_toolbox_access" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_tool_catalog_timestamp" BEFORE UPDATE ON "public"."tool_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_tool_catalog_updated_at" BEFORE UPDATE ON "public"."tool_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_set_team_owner" BEFORE INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."set_team_owner"();



CREATE OR REPLACE TRIGGER "trigger_update_channel_last_message_at" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_last_message_at"();



CREATE OR REPLACE TRIGGER "update_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_datastores_updated_at" BEFORE UPDATE ON "public"."datastores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_configurations_updated_at" BEFORE UPDATE ON "public"."mcp_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_servers_updated_at" BEFORE UPDATE ON "public"."mcp_servers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "account_tool_environment_activ_account_tool_environment_id_fkey" FOREIGN KEY ("account_tool_environment_id") REFERENCES "public"."account_tool_environments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "account_tool_environment_active_tools_tool_catalog_id_fkey" FOREIGN KEY ("tool_catalog_id") REFERENCES "public"."tool_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_datastore_id_fkey" FOREIGN KEY ("datastore_id") REFERENCES "public"."datastores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_discord_connections"
    ADD CONSTRAINT "agent_discord_connections_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_agent_droplet_id_fkey" FOREIGN KEY ("agent_droplet_id") REFERENCES "public"."agent_droplets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_tool_catalog_id_fkey" FOREIGN KEY ("tool_catalog_id") REFERENCES "public"."tool_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_mcp_server_access"
    ADD CONSTRAINT "agent_mcp_server_access_account_tool_instance_id_fkey" FOREIGN KEY ("account_tool_instance_id") REFERENCES "public"."account_tool_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_mcp_server_access"
    ADD CONSTRAINT "agent_mcp_server_access_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_mcp_server_access"
    ADD CONSTRAINT "agent_mcp_server_access_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_user_oauth_connection_id_fkey" FOREIGN KEY ("user_oauth_connection_id") REFERENCES "public"."user_oauth_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tool_capability_permissions"
    ADD CONSTRAINT "agent_tool_capability_permissions_agent_toolbelt_item_id_fkey" FOREIGN KEY ("agent_toolbelt_item_id") REFERENCES "public"."agent_toolbelt_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tool_credentials"
    ADD CONSTRAINT "agent_tool_credentials_agent_toolbelt_item_id_fkey" FOREIGN KEY ("agent_toolbelt_item_id") REFERENCES "public"."agent_toolbelt_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_toolbelt_items"
    ADD CONSTRAINT "agent_toolbelt_items_account_tool_instance_id_fkey" FOREIGN KEY ("account_tool_instance_id") REFERENCES "public"."account_tool_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_toolbelt_items"
    ADD CONSTRAINT "agent_toolbelt_items_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_toolbox_access"
    ADD CONSTRAINT "agent_toolbox_access_account_tool_environment_id_fkey" FOREIGN KEY ("account_tool_environment_id") REFERENCES "public"."account_tool_environments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_toolbox_access"
    ADD CONSTRAINT "agent_toolbox_access_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_room_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_agent_id_fkey" FOREIGN KEY ("sender_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "chat_rooms_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."datastores"
    ADD CONSTRAINT "datastores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcp_configurations"
    ADD CONSTRAINT "mcp_configurations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_server_catalog"
    ADD CONSTRAINT "mcp_server_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcp_server_deployments"
    ADD CONSTRAINT "mcp_server_deployments_catalog_server_id_fkey" FOREIGN KEY ("catalog_server_id") REFERENCES "public"."mcp_server_catalog"("id");



ALTER TABLE ONLY "public"."mcp_server_deployments"
    ADD CONSTRAINT "mcp_server_deployments_deployed_by_fkey" FOREIGN KEY ("deployed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcp_server_deployments"
    ADD CONSTRAINT "mcp_server_deployments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."mcp_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_api_keys"
    ADD CONSTRAINT "organization_api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_api_keys"
    ADD CONSTRAINT "organization_api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey1" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_reports_to_agent_id_fkey" FOREIGN KEY ("reports_to_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_oauth_connections"
    ADD CONSTRAINT "user_oauth_connections_oauth_provider_id_fkey" FOREIGN KEY ("oauth_provider_id") REFERENCES "public"."oauth_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_oauth_connections"
    ADD CONSTRAINT "user_oauth_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_secrets"
    ADD CONSTRAINT "user_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ssh_keys"
    ADD CONSTRAINT "user_ssh_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_team_memberships"
    ADD CONSTRAINT "user_team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



CREATE POLICY "Allow access to own agent MCP configurations" ON "public"."mcp_configurations" USING ((EXISTS ( SELECT 1
   FROM "public"."agents" "a"
  WHERE (("a"."id" = "mcp_configurations"."agent_id") AND ("a"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."agents" "a"
  WHERE (("a"."id" = "mcp_configurations"."agent_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow access to own agent MCP servers" ON "public"."mcp_servers" USING ((EXISTS ( SELECT 1
   FROM ("public"."mcp_configurations" "mc"
     JOIN "public"."agents" "a" ON (("mc"."agent_id" = "a"."id")))
  WHERE (("mc"."id" = "mcp_servers"."config_id") AND ("a"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."mcp_configurations" "mc"
     JOIN "public"."agents" "a" ON (("mc"."agent_id" = "a"."id")))
  WHERE (("mc"."id" = "mcp_servers"."config_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow authenticated read access" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access to teams" ON "public"."teams" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow delete access for team owners/admins" ON "public"."team_members" FOR DELETE USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow delete for owner only" ON "public"."workspaces" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow delete for workspace managers" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow full access to connections for own agents" ON "public"."agent_discord_connections" TO "authenticated" USING ("public"."is_agent_owner"("agent_id")) WITH CHECK ("public"."is_agent_owner"("agent_id"));



CREATE POLICY "Allow individual user CRUD access" ON "public"."user_profiles" TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow individual user read access" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual user select access" ON "public"."user_secrets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual user update access" ON "public"."user_secrets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow insert access for team owners/admins" ON "public"."team_members" FOR INSERT WITH CHECK (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow insert for authenticated users" ON "public"."workspaces" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert for workspace managers" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow members read access on chat_rooms" ON "public"."workspaces" FOR SELECT USING ("public"."is_room_member"("id", "auth"."uid"()));



CREATE POLICY "Allow modify access to own agents" ON "public"."agents" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow owner full access on chat_rooms" ON "public"."workspaces" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow owner or global admin to delete teams" ON "public"."teams" FOR DELETE USING ((("auth"."uid"() = "owner_user_id") OR "public"."is_global_admin"("auth"."uid"())));



CREATE POLICY "Allow owner to update their teams" ON "public"."teams" FOR UPDATE USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow owner to update workspace" ON "public"."workspaces" FOR UPDATE USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow read access to own agents or if admin" ON "public"."agents" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."user_has_role"("auth"."uid"(), 'admin'::"text")));



CREATE POLICY "Allow read access to team members" ON "public"."team_members" FOR SELECT USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()) OR "public"."is_team_member"("team_id", "auth"."uid"())));



CREATE POLICY "Allow room members to insert channel messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (("public"."is_room_member"("public"."get_room_id_for_channel"("channel_id"), "auth"."uid"()) AND ((("sender_user_id" IS NOT NULL) AND ("sender_user_id" = "auth"."uid"())) OR ("sender_agent_id" IS NOT NULL))));



CREATE POLICY "Allow room members to read channel messages" ON "public"."chat_messages" FOR SELECT USING ("public"."is_room_member"("public"."get_room_id_for_channel"("channel_id"), "auth"."uid"()));



CREATE POLICY "Allow room owner to delete channel messages" ON "public"."chat_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."workspaces" "cr"
     JOIN "public"."chat_channels" "cc" ON (("cr"."id" = "cc"."workspace_id")))
  WHERE (("cc"."id" = "chat_messages"."channel_id") AND ("cr"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Allow select for owner or member" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "owner_user_id") OR "public"."is_chat_room_member"("id", "auth"."uid"())));



CREATE POLICY "Allow select for workspace members" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow update access for team owners/admins" ON "public"."team_members" FOR UPDATE USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()))) WITH CHECK (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow update for owner only" ON "public"."workspaces" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow update for workspace managers" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"())) WITH CHECK ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow users to add themselves to teams" ON "public"."user_team_memberships" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to remove themselves from teams" ON "public"."user_team_memberships" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to view own memberships" ON "public"."user_team_memberships" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow workspace members INSERT" ON "public"."chat_channels" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow workspace members SELECT" ON "public"."chat_channels" FOR SELECT TO "authenticated" USING ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow workspace members to insert messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (("public"."is_workspace_member"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()) AND ((("sender_user_id" IS NOT NULL) AND ("sender_user_id" = "auth"."uid"())) OR ("sender_agent_id" IS NOT NULL))));



CREATE POLICY "Allow workspace members to read messages" ON "public"."chat_messages" FOR SELECT USING ("public"."is_workspace_member"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()));



CREATE POLICY "Allow workspace owner DELETE" ON "public"."chat_channels" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "chat_channels"."workspace_id") AND ("w"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Allow workspace owner UPDATE" ON "public"."chat_channels" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "chat_channels"."workspace_id") AND ("w"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspaces" "w"
  WHERE (("w"."id" = "chat_channels"."workspace_id") AND ("w"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Allow workspace owner to delete messages" ON "public"."chat_messages" FOR DELETE USING ("public"."is_workspace_owner"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()));



CREATE POLICY "Anyone can view enabled OAuth providers" ON "public"."oauth_providers" FOR SELECT USING (("is_enabled" = true));



CREATE POLICY "Authenticated users can view tool catalog" ON "public"."tool_catalog" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Disallow updates to channel messages" ON "public"."chat_messages" FOR UPDATE USING (false);



CREATE POLICY "Disallow updates to chat messages" ON "public"."chat_messages" FOR UPDATE USING (false);



CREATE POLICY "Organization admins can manage API keys" ON "public"."organization_api_keys" USING (("organization_id" IN ( SELECT "organization_memberships"."organization_id"
   FROM "public"."organization_memberships"
  WHERE (("organization_memberships"."user_id" = "auth"."uid"()) AND ("organization_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("organization_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Organization admins can manage invitations" ON "public"."organization_invitations" USING (("organization_id" IN ( SELECT "organization_memberships"."organization_id"
   FROM "public"."organization_memberships"
  WHERE (("organization_memberships"."user_id" = "auth"."uid"()) AND ("organization_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("organization_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Organization admins can manage memberships" ON "public"."organization_memberships" USING (("organization_id" IN ( SELECT "organization_memberships_1"."organization_id"
   FROM "public"."organization_memberships" "organization_memberships_1"
  WHERE (("organization_memberships_1"."user_id" = "auth"."uid"()) AND ("organization_memberships_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("organization_memberships_1"."status" = 'active'::"text")))));



CREATE POLICY "Organization owners can update their organizations" ON "public"."organizations" FOR UPDATE USING (("id" IN ( SELECT "organization_memberships"."organization_id"
   FROM "public"."organization_memberships"
  WHERE (("organization_memberships"."user_id" = "auth"."uid"()) AND ("organization_memberships"."role" = 'owner'::"text") AND ("organization_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Service role can manage all SSH keys" ON "public"."user_ssh_keys" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service roles can access all account tool environments" ON "public"."account_tool_environments" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all account tool instances" ON "public"."account_tool_instances" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent tool capability permissions" ON "public"."agent_tool_capability_permissions" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent tool credentials" ON "public"."agent_tool_credentials" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent toolbelt items" ON "public"."agent_toolbelt_items" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent toolbox access" ON "public"."agent_toolbox_access" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can manage tool catalog" ON "public"."tool_catalog" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can create datastores" ON "public"."datastores" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can delete own SSH keys" ON "public"."user_ssh_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own datastores" ON "public"."datastores" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own SSH keys" ON "public"."user_ssh_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage credentials for their agents toolbelt items" ON "public"."agent_tool_credentials" USING (("auth"."uid"() = ( SELECT "a"."user_id"
   FROM ("public"."agents" "a"
     JOIN "public"."agent_toolbelt_items" "ati" ON (("a"."id" = "ati"."agent_id")))
  WHERE ("ati"."id" = "agent_tool_credentials"."agent_toolbelt_item_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "a"."user_id"
   FROM ("public"."agents" "a"
     JOIN "public"."agent_toolbelt_items" "ati" ON (("a"."id" = "ati"."agent_id")))
  WHERE ("ati"."id" = "agent_tool_credentials"."agent_toolbelt_item_id"))));



CREATE POLICY "Users can manage instances on their own account environments" ON "public"."account_tool_instances" USING (("auth"."uid"() = ( SELECT "ate"."user_id"
   FROM "public"."account_tool_environments" "ate"
  WHERE ("ate"."id" = "account_tool_instances"."account_tool_environment_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "ate"."user_id"
   FROM "public"."account_tool_environments" "ate"
  WHERE ("ate"."id" = "account_tool_instances"."account_tool_environment_id"))));



CREATE POLICY "Users can manage own agent datastores" ON "public"."agent_datastores" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_datastores"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage permissions for their agents toolbelt items" ON "public"."agent_tool_capability_permissions" USING (("auth"."uid"() = ( SELECT "a"."user_id"
   FROM ("public"."agents" "a"
     JOIN "public"."agent_toolbelt_items" "ati" ON (("a"."id" = "ati"."agent_id")))
  WHERE ("ati"."id" = "agent_tool_capability_permissions"."agent_toolbelt_item_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "a"."user_id"
   FROM ("public"."agents" "a"
     JOIN "public"."agent_toolbelt_items" "ati" ON (("a"."id" = "ati"."agent_id")))
  WHERE ("ati"."id" = "agent_tool_capability_permissions"."agent_toolbelt_item_id"))));



CREATE POLICY "Users can manage their agents' MCP access" ON "public"."agent_mcp_server_access" USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_mcp_server_access"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their agents' OAuth permissions" ON "public"."agent_oauth_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_oauth_permissions"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own OAuth connections" ON "public"."user_oauth_connections" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own account tool environment" ON "public"."account_tool_environments" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage toolbelt items for their agents" ON "public"."agent_toolbelt_items" USING (("auth"."uid"() = ( SELECT "agents"."user_id"
   FROM "public"."agents"
  WHERE ("agents"."id" = "agent_toolbelt_items"."agent_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "agents"."user_id"
   FROM "public"."agents"
  WHERE ("agents"."id" = "agent_toolbelt_items"."agent_id"))));



CREATE POLICY "Users can manage toolbox access for their agents on their toolb" ON "public"."agent_toolbox_access" USING ((("auth"."uid"() = ( SELECT "agents"."user_id"
   FROM "public"."agents"
  WHERE ("agents"."id" = "agent_toolbox_access"."agent_id"))) AND ("auth"."uid"() = ( SELECT "account_tool_environments"."user_id"
   FROM "public"."account_tool_environments"
  WHERE ("account_tool_environments"."id" = "agent_toolbox_access"."account_tool_environment_id"))))) WITH CHECK ((("auth"."uid"() = ( SELECT "agents"."user_id"
   FROM "public"."agents"
  WHERE ("agents"."id" = "agent_toolbox_access"."agent_id"))) AND ("auth"."uid"() = ( SELECT "account_tool_environments"."user_id"
   FROM "public"."account_tool_environments"
  WHERE ("account_tool_environments"."id" = "agent_toolbox_access"."account_tool_environment_id")))));



CREATE POLICY "Users can read own datastores" ON "public"."datastores" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own SSH keys" ON "public"."user_ssh_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own datastores" ON "public"."datastores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view memberships in their organizations" ON "public"."organization_memberships" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("organization_id" IN ( SELECT "organization_memberships_1"."organization_id"
   FROM "public"."organization_memberships" "organization_memberships_1"
  WHERE (("organization_memberships_1"."user_id" = "auth"."uid"()) AND ("organization_memberships_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("organization_memberships_1"."status" = 'active'::"text"))))));



CREATE POLICY "Users can view organizations they are members of" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "organization_memberships"."organization_id"
   FROM "public"."organization_memberships"
  WHERE (("organization_memberships"."user_id" = "auth"."uid"()) AND ("organization_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Users can view own SSH keys" ON "public"."user_ssh_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their agents' MCP access" ON "public"."agent_mcp_server_access" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_mcp_server_access"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."account_tool_environments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."account_tool_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_datastores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_discord_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_mcp_server_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_oauth_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_capability_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_toolbelt_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_toolbox_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."datastores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_servers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tool_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_oauth_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ssh_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_team_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_chat_room_members"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_workspace_members"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_vault_secret"("secret_value" "text", "name" "text", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organization_api_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organization_api_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organization_api_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_mcp_servers"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_mcp_servers"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_mcp_servers"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_mcp_servers"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_mcp_servers"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_mcp_servers"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_key_generation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_key_generation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_key_generation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_organization_permission"("user_id" "uuid", "org_id" "uuid", "permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_organization_permission"("user_id" "uuid", "org_id" "uuid", "permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_organization_permission"("user_id" "uuid", "org_id" "uuid", "permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_agent_owner"("agent_id_to_check" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_global_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_global_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_global_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_organization_member"("user_id" "uuid", "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_organization_member"("user_id" "uuid", "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_organization_member"("user_id" "uuid", "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin_or_pm"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_owner"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "public"."chat_channels" TO "anon";
GRANT ALL ON TABLE "public"."chat_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channels" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_room_channels"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_room_channels"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_room_channels"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_team_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_team_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_team_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_organization_slug"("slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_organization_slug"("slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_organization_slug"("slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";


















GRANT ALL ON TABLE "public"."account_tool_environments" TO "anon";
GRANT ALL ON TABLE "public"."account_tool_environments" TO "authenticated";
GRANT ALL ON TABLE "public"."account_tool_environments" TO "service_role";



GRANT ALL ON TABLE "public"."account_tool_instances" TO "anon";
GRANT ALL ON TABLE "public"."account_tool_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."account_tool_instances" TO "service_role";



GRANT ALL ON TABLE "public"."agent_datastores" TO "anon";
GRANT ALL ON TABLE "public"."agent_datastores" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_datastores" TO "service_role";



GRANT ALL ON TABLE "public"."agent_discord_connections" TO "anon";
GRANT ALL ON TABLE "public"."agent_discord_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_discord_connections" TO "service_role";



GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "anon";
GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "service_role";



GRANT ALL ON TABLE "public"."agent_droplets" TO "anon";
GRANT ALL ON TABLE "public"."agent_droplets" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_droplets" TO "service_role";



GRANT ALL ON TABLE "public"."agent_mcp_server_access" TO "anon";
GRANT ALL ON TABLE "public"."agent_mcp_server_access" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_mcp_server_access" TO "service_role";



GRANT ALL ON TABLE "public"."agent_oauth_permissions" TO "anon";
GRANT ALL ON TABLE "public"."agent_oauth_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_oauth_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tool_capability_permissions" TO "anon";
GRANT ALL ON TABLE "public"."agent_tool_capability_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tool_capability_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tool_credentials" TO "anon";
GRANT ALL ON TABLE "public"."agent_tool_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tool_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."agent_toolbelt_items" TO "anon";
GRANT ALL ON TABLE "public"."agent_toolbelt_items" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_toolbelt_items" TO "service_role";



GRANT ALL ON TABLE "public"."agent_toolbox_access" TO "anon";
GRANT ALL ON TABLE "public"."agent_toolbox_access" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_toolbox_access" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."datastores" TO "anon";
GRANT ALL ON TABLE "public"."datastores" TO "authenticated";
GRANT ALL ON TABLE "public"."datastores" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_configurations" TO "anon";
GRANT ALL ON TABLE "public"."mcp_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_configurations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mcp_configurations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mcp_configurations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mcp_configurations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_server_catalog" TO "anon";
GRANT ALL ON TABLE "public"."mcp_server_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_server_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_server_deployments" TO "anon";
GRANT ALL ON TABLE "public"."mcp_server_deployments" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_server_deployments" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_servers" TO "anon";
GRANT ALL ON TABLE "public"."mcp_servers" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_servers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mcp_servers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mcp_servers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mcp_servers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_providers" TO "anon";
GRANT ALL ON TABLE "public"."oauth_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_providers" TO "service_role";



GRANT ALL ON TABLE "public"."organization_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."organization_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invitations" TO "anon";
GRANT ALL ON TABLE "public"."organization_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organization_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organization_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."tool_catalog" TO "anon";
GRANT ALL ON TABLE "public"."tool_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."tool_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."user_oauth_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_oauth_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_oauth_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_secrets" TO "anon";
GRANT ALL ON TABLE "public"."user_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."user_ssh_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_ssh_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ssh_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_team_memberships" TO "anon";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."workspace_members" TO "supabase_admin";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
