

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






COMMENT ON SCHEMA "public" IS 'Cleaned up all database objects from the failed custom Vault implementation.';



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


CREATE TYPE "public"."connection_credential_type_enum" AS ENUM (
    'oauth',
    'api_key'
);


ALTER TYPE "public"."connection_credential_type_enum" OWNER TO "postgres";


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


CREATE TYPE "public"."email_direction_enum" AS ENUM (
    'inbound',
    'outbound'
);


ALTER TYPE "public"."email_direction_enum" OWNER TO "postgres";


CREATE TYPE "public"."event_trigger_type_enum" AS ENUM (
    'email_received',
    'integration_webhook',
    'time_based',
    'manual',
    'agent_mentioned',
    'file_uploaded',
    'workspace_message'
);


ALTER TYPE "public"."event_trigger_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."integration_agent_classification_enum" AS ENUM (
    'tool',
    'channel'
);


ALTER TYPE "public"."integration_agent_classification_enum" OWNER TO "postgres";


CREATE TYPE "public"."integration_connection_status_enum" AS ENUM (
    'connected',
    'disconnected',
    'error',
    'pending'
);


ALTER TYPE "public"."integration_connection_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."integration_status_enum" AS ENUM (
    'available',
    'beta',
    'coming_soon',
    'deprecated'
);


ALTER TYPE "public"."integration_status_enum" OWNER TO "postgres";


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


CREATE TYPE "public"."task_execution_status_enum" AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."task_execution_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_status_enum" AS ENUM (
    'active',
    'paused',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."task_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_type_enum" AS ENUM (
    'scheduled',
    'event_based'
);


ALTER TYPE "public"."task_type_enum" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."calculate_next_run_time"("cron_expr" "text", "timezone_name" "text" DEFAULT 'UTC'::"text", "from_time" timestamp with time zone DEFAULT "now"()) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- This is a placeholder. In practice, you'd implement proper cron parsing
    -- or call out to a function that uses a cron library
    -- For now, we'll return a simple future time
    RETURN from_time + INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."calculate_next_run_time"("cron_expr" "text", "timezone_name" "text", "from_time" timestamp with time zone) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."create_routing_rule"("p_name" "text", "p_description" "text", "p_agent_id" "uuid", "p_conditions" "jsonb", "p_action" "jsonb", "p_priority" integer DEFAULT 0, "p_stop_processing" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."create_routing_rule"("p_name" "text", "p_description" "text", "p_agent_id" "uuid", "p_conditions" "jsonb", "p_action" "jsonb", "p_priority" integer, "p_stop_processing" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Use positional arguments as shown in Supabase documentation
    RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;


ALTER FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") IS 'A public RPC wrapper for vault.create_secret.';



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


CREATE OR REPLACE FUNCTION "public"."get_agent_integration_permissions"("p_agent_id" "uuid") RETURNS TABLE("permission_id" "uuid", "agent_id" "uuid", "connection_id" "uuid", "connection_name" "text", "external_username" "text", "provider_name" "text", "provider_display_name" "text", "allowed_scopes" "jsonb", "is_active" boolean, "permission_level" "text", "granted_at" timestamp with time zone, "granted_by_user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
    INNER JOIN oauth_providers op ON op.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = auth.uid()
    AND aop.is_active = true
    ORDER BY aop.granted_at DESC;
$$;


ALTER FUNCTION "public"."get_agent_integration_permissions"("p_agent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agent_integration_permissions"("p_agent_id" "uuid") IS 'Get all integration permissions for an agent';



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



CREATE OR REPLACE FUNCTION "public"."get_agent_web_search_permissions"("p_agent_id" "uuid") RETURNS TABLE("permission_id" "uuid", "agent_id" "uuid", "provider_id" "uuid", "provider_name" "text", "provider_display_name" "text", "key_id" "uuid", "key_name" "text", "permissions" "jsonb", "is_active" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_agent_web_search_permissions"("p_agent_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_gmail_connection_by_id"("p_connection_id" "uuid") RETURNS TABLE("connection_id" "uuid", "connection_name" "text", "external_username" "text", "scopes_granted" "jsonb", "connection_status" "text", "connection_metadata" "jsonb", "configuration" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
    AND oauth_provider_id = (SELECT id FROM oauth_providers WHERE name = 'gmail');
$$;


ALTER FUNCTION "public"."get_gmail_connection_by_id"("p_connection_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_gmail_connection_with_tokens"("p_user_id" "uuid") RETURNS TABLE("connection_id" "uuid", "external_username" "text", "scopes_granted" "jsonb", "connection_status" "text", "vault_access_token_id" "text", "vault_refresh_token_id" "text", "connection_metadata" "jsonb", "configuration" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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
    AND uoc.oauth_provider_id = (SELECT id FROM oauth_providers WHERE name = 'gmail')
    AND uoc.connection_status = 'active'
    LIMIT 1;
$$;


ALTER FUNCTION "public"."get_gmail_connection_with_tokens"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_gmail_connection_with_tokens"("p_user_id" "uuid") IS 'Get Gmail connection with vault token IDs for edge function use';



CREATE OR REPLACE FUNCTION "public"."get_gmail_tools"("p_agent_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    JOIN oauth_providers op ON op.id = uoc.oauth_provider_id
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


ALTER FUNCTION "public"."get_gmail_tools"("p_agent_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_integration_categories_with_counts"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "icon_name" "text", "display_order" integer, "total_integrations" bigint, "available_integrations" bigint, "user_connected_integrations" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_integration_categories_with_counts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_integrations_by_category"("p_category_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "icon_name" "text", "status" "public"."integration_status_enum", "is_popular" boolean, "documentation_url" "text", "display_order" integer, "user_connection_status" "public"."integration_connection_status_enum", "user_connection_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_integrations_by_category"("p_category_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_secret"("secret_name" "text") RETURNS TABLE("key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT decrypted_secret AS key
    FROM vault.decrypted_secrets
    WHERE name = secret_name;
END;
$$;


ALTER FUNCTION "public"."get_secret"("secret_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_secret"("secret_name" "text") IS 'Retrieve a decrypted secret from vault by name';



CREATE OR REPLACE FUNCTION "public"."get_secret"("secret_id" "uuid") RETURNS TABLE("key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT decrypted_secret AS key
    FROM vault.decrypted_secrets
    WHERE id = secret_id;
END;
$$;


ALTER FUNCTION "public"."get_secret"("secret_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_secret"("secret_id" "uuid") IS 'Retrieve a decrypted secret from vault by ID';



CREATE OR REPLACE FUNCTION "public"."get_sendgrid_tools"("p_agent_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_sendgrid_tools"("p_agent_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_user_gmail_connections"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("connection_id" "uuid", "connection_name" "text", "external_username" "text", "scopes_granted" "jsonb", "connection_status" "text", "connection_metadata" "jsonb", "configuration" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 
        id AS connection_id,
        connection_name,
        external_username,
        scopes_granted,
        connection_status,
        connection_metadata,
        '{}'::jsonb AS configuration,
        created_at
    FROM user_oauth_connections
    WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND oauth_provider_id = (SELECT id FROM oauth_providers WHERE name = 'gmail')
    ORDER BY created_at DESC;
$$;


ALTER FUNCTION "public"."get_user_gmail_connections"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_gmail_connections"("p_user_id" "uuid") IS 'Get all Gmail connections for a user';



CREATE OR REPLACE FUNCTION "public"."get_user_inbound_emails"("p_user_id" "uuid" DEFAULT "auth"."uid"(), "p_agent_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("email_id" "uuid", "from_email" "text", "from_name" "text", "subject" "text", "processed_at" timestamp with time zone, "has_attachments" boolean, "agent_id" "uuid", "routing_rules_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_user_inbound_emails"("p_user_id" "uuid", "p_agent_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_integration_stats"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("total_available_integrations" bigint, "total_connected_integrations" bigint, "total_categories" bigint, "recent_connections" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_user_integration_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_mailgun_config"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "domain" character varying, "region" character varying, "webhook_url" character varying, "is_active" boolean, "api_key_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.domain,
        mc.region,
        mc.webhook_url,
        mc.is_active,
        uoc.vault_access_token_id as api_key_id
    FROM mailgun_configurations mc
    JOIN user_oauth_connections uoc ON mc.user_oauth_connection_id = uoc.id
    WHERE mc.user_id = p_user_id
    AND mc.is_active = true
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_user_mailgun_config"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_mailgun_routes"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "mailgun_route_id" character varying, "priority" integer, "expression" "text", "action" "text", "description" "text", "agent_id" "uuid", "agent_name" character varying, "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id,
        mr.mailgun_route_id,
        mr.priority,
        mr.expression,
        mr.action,
        mr.description,
        mr.agent_id,
        a.name as agent_name,
        mr.is_active
    FROM mailgun_routes mr
    JOIN mailgun_configurations mc ON mr.mailgun_config_id = mc.id
    LEFT JOIN agents a ON mr.agent_id = a.id
    WHERE mc.user_id = p_user_id
    ORDER BY mr.priority ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_mailgun_routes"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("connection_id" "uuid", "provider_name" "text", "provider_display_name" "text", "external_username" "text", "connection_name" "text", "scopes_granted" "jsonb", "connection_status" "text", "credential_type" "text", "token_expires_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Validate that user can only access their own connections
    IF p_user_id != auth.uid() AND NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: can only view own connections';
    END IF;

    RETURN QUERY
    SELECT 
        uoc.id as connection_id,
        op.name as provider_name,
        op.display_name as provider_display_name,
        uoc.external_username,
        uoc.connection_name,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.credential_type::TEXT as credential_type,
        uoc.token_expires_at,
        uoc.created_at,
        uoc.updated_at
    FROM user_oauth_connections uoc
    INNER JOIN oauth_providers op ON op.id = uoc.oauth_provider_id
    WHERE uoc.user_id = p_user_id
    ORDER BY uoc.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") IS 'Get all OAuth and API key connections for a user, including credential type';



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


CREATE OR REPLACE FUNCTION "public"."get_user_web_search_keys"() RETURNS TABLE("key_id" "uuid", "key_name" "text", "provider_id" "uuid", "provider_name" "text", "provider_display_name" "text", "key_status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uwsk.id as key_id,
        uwsk.key_name,
        uwsk.provider_id,
        wsp.name as provider_name,
        wsp.display_name as provider_display_name,
        uwsk.key_status,
        uwsk.created_at
    FROM user_web_search_keys uwsk
    JOIN web_search_providers wsp ON uwsk.provider_id = wsp.id
    WHERE uwsk.user_id = auth.uid()
        AND uwsk.key_status = 'active'
        AND wsp.is_enabled = true
    ORDER BY wsp.display_name, uwsk.key_name;
END;
$$;


ALTER FUNCTION "public"."get_user_web_search_keys"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vault_secrets_by_names"("p_secret_names" "text"[]) RETURNS TABLE("id" "uuid", "name" "text", "decrypted_secret" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'vault', 'public'
    AS $$
    SELECT
        s.id,
        s.name,
        ds.decrypted_secret
    FROM vault.secrets s
    JOIN vault.decrypted_secrets ds ON s.id = ds.id
    WHERE s.name = ANY(p_secret_names);
$$;


ALTER FUNCTION "public"."get_vault_secrets_by_names"("p_secret_names" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_vault_secrets_by_names"("p_secret_names" "text"[]) IS 'Retrieves decrypted secrets from the Vault by their unique names.';



CREATE OR REPLACE FUNCTION "public"."get_web_search_api_key"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_web_search_api_key"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_web_search_tools"("p_agent_id" "uuid", "p_user_id" "uuid") RETURNS TABLE("tool_name" "text", "provider_name" "text", "provider_display_name" "text", "supported_features" "jsonb", "permissions" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_web_search_tools"("p_agent_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."grant_agent_integration_permission"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_allowed_scopes" "jsonb", "p_permission_level" "text" DEFAULT 'custom'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the connection belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM user_oauth_connections 
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
        is_active,
        granted_by_user_id
    ) VALUES (
        p_agent_id,
        p_connection_id,
        p_allowed_scopes,
        p_permission_level,
        true,
        v_user_id
    )
    ON CONFLICT (agent_id, user_oauth_connection_id) 
    DO UPDATE SET
        allowed_scopes = EXCLUDED.allowed_scopes,
        permission_level = EXCLUDED.permission_level,
        is_active = true,
        granted_by_user_id = EXCLUDED.granted_by_user_id,
        updated_at = now()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;


ALTER FUNCTION "public"."grant_agent_integration_permission"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_allowed_scopes" "jsonb", "p_permission_level" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."grant_agent_integration_permission"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_allowed_scopes" "jsonb", "p_permission_level" "text") IS 'Grant integration permission to an agent';



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



CREATE OR REPLACE FUNCTION "public"."grant_agent_web_search_permission"("p_agent_id" "uuid", "p_user_key_id" "uuid", "p_permissions" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."grant_agent_web_search_permission"("p_agent_id" "uuid", "p_user_key_id" "uuid", "p_permissions" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."increment_rule_match_count"("p_rule_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE sendgrid_inbound_routing_rules
    SET match_count = match_count + 1,
        last_matched_at = now()
    WHERE id = p_rule_id;
END;
$$;


ALTER FUNCTION "public"."increment_rule_match_count"("p_rule_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."log_email_activity"("p_mailgun_message_id" character varying, "p_agent_id" "uuid", "p_user_id" "uuid", "p_direction" "public"."email_direction_enum", "p_from_address" character varying, "p_to_address" character varying, "p_subject" "text", "p_status" character varying, "p_event_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO email_logs (
        mailgun_message_id,
        agent_id,
        user_id,
        direction,
        from_address,
        to_address,
        subject,
        status,
        event_data,
        processed_at
    ) VALUES (
        p_mailgun_message_id,
        p_agent_id,
        p_user_id,
        p_direction,
        p_from_address,
        p_to_address,
        p_subject,
        p_status,
        p_event_data,
        NOW()
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_email_activity"("p_mailgun_message_id" character varying, "p_agent_id" "uuid", "p_user_id" "uuid", "p_direction" "public"."email_direction_enum", "p_from_address" character varying, "p_to_address" character varying, "p_subject" "text", "p_status" character varying, "p_event_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_sendgrid_operation"("p_agent_id" "uuid", "p_user_id" "uuid", "p_operation_type" "text", "p_operation_params" "jsonb" DEFAULT NULL::"jsonb", "p_operation_result" "jsonb" DEFAULT NULL::"jsonb", "p_status" "text" DEFAULT 'success'::"text", "p_error_message" "text" DEFAULT NULL::"text", "p_message_id" "text" DEFAULT NULL::"text", "p_recipients_count" integer DEFAULT 1, "p_execution_time_ms" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."log_sendgrid_operation"("p_agent_id" "uuid", "p_user_id" "uuid", "p_operation_type" "text", "p_operation_params" "jsonb", "p_operation_result" "jsonb", "p_status" "text", "p_error_message" "text", "p_message_id" "text", "p_recipients_count" integer, "p_execution_time_ms" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."migrate_chat_messages"() RETURNS integer
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."migrate_chat_messages"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_chat_messages"() IS 'Migrates existing chat_messages to the new chat_messages_v2 structure';



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



CREATE OR REPLACE FUNCTION "public"."revoke_agent_integration_permission"("p_permission_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the permission belongs to the user's agent
    IF NOT EXISTS (
        SELECT 1 
        FROM agent_oauth_permissions aop
        INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
        WHERE aop.id = p_permission_id 
        AND uoc.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Permission not found or access denied';
    END IF;
    
    -- Update the permission to revoke it
    UPDATE agent_oauth_permissions
    SET 
        is_active = false,
        updated_at = now()
    WHERE id = p_permission_id;
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."revoke_agent_integration_permission"("p_permission_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revoke_agent_integration_permission"("p_permission_id" "uuid") IS 'Revoke integration permission from an agent';



CREATE OR REPLACE FUNCTION "public"."revoke_agent_web_search_permission"("p_agent_id" "uuid", "p_provider_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."revoke_agent_web_search_permission"("p_agent_id" "uuid", "p_provider_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."search_inbound_emails"("p_search_query" "text", "p_user_id" "uuid" DEFAULT "auth"."uid"(), "p_limit" integer DEFAULT 50) RETURNS TABLE("email_id" "uuid", "from_email" "text", "subject" "text", "processed_at" timestamp with time zone, "rank" real)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."search_inbound_emails"("p_search_query" "text", "p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_team_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.owner_user_id = auth.uid();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_team_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_rpc"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 'RPC is working!'::text;
$$;


ALTER FUNCTION "public"."test_rpc"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."test_rpc"() IS 'Test RPC functionality';



CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_agent_web_search_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_agent_web_search_permissions_updated_at"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_datastore_documents_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_datastore_documents_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_memory_access"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.access_count = OLD.access_count + 1;
    NEW.last_accessed = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_memory_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_oauth_providers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_oauth_providers_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sendgrid_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sendgrid_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_last_active"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE conversation_sessions 
    SET last_active = NOW(),
        message_count = message_count + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_session_last_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tool_execution_logs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tool_execution_logs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_oauth_connections_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_oauth_connections_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_web_search_keys_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_web_search_keys_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vault_secret"("p_secret_id" "uuid", "p_new_secret" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Use positional arguments
    PERFORM vault.update_secret(p_secret_id, p_new_secret);
END;
$$;


ALTER FUNCTION "public"."update_vault_secret"("p_secret_id" "uuid", "p_new_secret" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_vault_secret"("p_secret_id" "uuid", "p_new_secret" "text") IS 'A public RPC wrapper for vault.update_secret.';



CREATE OR REPLACE FUNCTION "public"."update_web_search_providers_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_web_search_providers_updated_at"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."validate_agent_gmail_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_required_scopes" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    AND uoc.oauth_provider_id = (SELECT id FROM oauth_providers WHERE name = 'gmail');
    
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


ALTER FUNCTION "public"."validate_agent_gmail_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_required_scopes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_agent_sendgrid_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."validate_agent_sendgrid_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_organization_slug"("slug" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
BEGIN
    -- Slug must be 3-50 characters, lowercase, alphanumeric with hyphens
    RETURN slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$';
END;
$_$;


ALTER FUNCTION "public"."validate_organization_slug"("slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text", "p_required_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text", "p_required_permission" "text") OWNER TO "postgres";


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
    "provisioning_error_message" "text",
    "do_droplet_name" "text"
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



COMMENT ON COLUMN "public"."account_tool_environments"."do_droplet_name" IS 'The actual name assigned by DigitalOcean (may differ from intended name due to conflicts or DO policies)';



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
    "instance_error_message" "text"
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



CREATE TABLE IF NOT EXISTS "public"."admin_operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "server_id" "text" NOT NULL,
    "server_name" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "success" boolean DEFAULT false NOT NULL,
    "error" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_operation_logs_operation_check" CHECK (("operation" = ANY (ARRAY['deploy'::"text", 'start'::"text", 'stop'::"text", 'restart'::"text", 'delete'::"text", 'configure'::"text"])))
);


ALTER TABLE "public"."admin_operation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_datastores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "datastore_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_datastores" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_datastores" IS 'Junction table connecting agents to their associated datastores';



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



CREATE TABLE IF NOT EXISTS "public"."agent_email_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "sendgrid_config_id" "uuid" NOT NULL,
    "local_part" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "full_address" "text" GENERATED ALWAYS AS ((("local_part" || '@'::"text") || "domain")) STORED,
    "is_active" boolean DEFAULT true,
    "auto_reply_enabled" boolean DEFAULT false,
    "auto_reply_template_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_valid_local_part" CHECK (("local_part" ~ '^[a-zA-Z0-9.+_-]+$'::"text"))
);


ALTER TABLE "public"."agent_email_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_memories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "memory_type" character varying(20) NOT NULL,
    "content" "jsonb" NOT NULL,
    "embeddings" "public"."vector"(1536),
    "importance" double precision DEFAULT 0.5,
    "decay_rate" double precision DEFAULT 0.1,
    "access_count" integer DEFAULT 0,
    "related_memories" "uuid"[],
    "source_message_id" "uuid",
    "last_accessed" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "agent_memories_importance_check" CHECK ((("importance" >= (0)::double precision) AND ("importance" <= (1)::double precision))),
    CONSTRAINT "agent_memories_memory_type_check" CHECK ((("memory_type")::"text" = ANY ((ARRAY['episodic'::character varying, 'semantic'::character varying, 'procedural'::character varying, 'working'::character varying])::"text"[]))),
    CONSTRAINT "check_memory_content" CHECK (
CASE "memory_type"
    WHEN 'episodic'::"text" THEN (("content" ? 'event'::"text") AND ("content" ? 'temporal'::"text"))
    WHEN 'semantic'::"text" THEN (("content" ? 'concept'::"text") AND ("content" ? 'definition'::"text"))
    WHEN 'procedural'::"text" THEN (("content" ? 'skill'::"text") AND ("content" ? 'steps'::"text"))
    WHEN 'working'::"text" THEN (("content" ? 'items'::"text") AND ("content" ? 'capacity'::"text"))
    ELSE false
END)
);


ALTER TABLE "public"."agent_memories" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_memories" IS 'Multi-type memory storage for agents with vector embeddings';



COMMENT ON COLUMN "public"."agent_memories"."embeddings" IS 'Vector embedding for semantic similarity search (1536 dimensions for OpenAI)';



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



CREATE TABLE IF NOT EXISTS "public"."agent_sendgrid_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "sendgrid_config_id" "uuid" NOT NULL,
    "can_send_email" boolean DEFAULT true,
    "can_use_templates" boolean DEFAULT false,
    "can_send_bulk" boolean DEFAULT false,
    "can_manage_templates" boolean DEFAULT false,
    "can_view_analytics" boolean DEFAULT false,
    "can_receive_emails" boolean DEFAULT false,
    "daily_send_limit" integer DEFAULT 100,
    "recipients_per_email_limit" integer DEFAULT 10,
    "granted_by" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_sendgrid_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_task_event_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "trigger_type" "public"."event_trigger_type_enum" NOT NULL,
    "trigger_name" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_triggered_at" timestamp with time zone,
    "trigger_count" integer DEFAULT 0,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "cooldown_minutes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cooldown_non_negative" CHECK (("cooldown_minutes" >= 0))
);


ALTER TABLE "public"."agent_task_event_triggers" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_task_event_triggers" IS 'Defines event triggers for event-based tasks';



CREATE TABLE IF NOT EXISTS "public"."agent_task_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "public"."task_execution_status_enum" DEFAULT 'pending'::"public"."task_execution_status_enum" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "trigger_data" "jsonb" DEFAULT '{}'::"jsonb",
    "instructions_used" "text" NOT NULL,
    "tools_used" "jsonb" DEFAULT '[]'::"jsonb",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "output" "text",
    "tool_outputs" "jsonb" DEFAULT '[]'::"jsonb",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_duration" CHECK (((("status" = 'completed'::"public"."task_execution_status_enum") AND ("started_at" IS NOT NULL) AND ("completed_at" IS NOT NULL) AND ("duration_ms" IS NOT NULL)) OR ("status" <> 'completed'::"public"."task_execution_status_enum"))),
    CONSTRAINT "valid_timing" CHECK ((("started_at" IS NULL) OR ("completed_at" IS NULL) OR ("started_at" <= "completed_at")))
);


ALTER TABLE "public"."agent_task_executions" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_task_executions" IS 'Tracks individual executions of agent tasks';



COMMENT ON COLUMN "public"."agent_task_executions"."trigger_data" IS 'Data about what triggered this execution (e.g., email content, webhook payload)';



COMMENT ON COLUMN "public"."agent_task_executions"."tool_outputs" IS 'Outputs from each tool that was used during execution';



CREATE TABLE IF NOT EXISTS "public"."agent_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "task_type" "public"."task_type_enum" DEFAULT 'scheduled'::"public"."task_type_enum" NOT NULL,
    "status" "public"."task_status_enum" DEFAULT 'active'::"public"."task_status_enum" NOT NULL,
    "instructions" "text" NOT NULL,
    "selected_tools" "jsonb" DEFAULT '[]'::"jsonb",
    "cron_expression" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "next_run_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "event_trigger_type" "public"."event_trigger_type_enum",
    "event_trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "total_executions" integer DEFAULT 0,
    "successful_executions" integer DEFAULT 0,
    "failed_executions" integer DEFAULT 0,
    "max_executions" integer,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "max_executions_positive" CHECK ((("max_executions" IS NULL) OR ("max_executions" > 0))),
    CONSTRAINT "valid_cron_for_scheduled" CHECK (((("task_type" = 'scheduled'::"public"."task_type_enum") AND ("cron_expression" IS NOT NULL)) OR ("task_type" = 'event_based'::"public"."task_type_enum"))),
    CONSTRAINT "valid_date_range" CHECK ((("start_date" IS NULL) OR ("end_date" IS NULL) OR ("start_date" < "end_date"))),
    CONSTRAINT "valid_event_for_event_based" CHECK (((("task_type" = 'event_based'::"public"."task_type_enum") AND ("event_trigger_type" IS NOT NULL)) OR ("task_type" = 'scheduled'::"public"."task_type_enum")))
);


ALTER TABLE "public"."agent_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_tasks" IS 'Stores scheduled and event-based tasks for agents';



COMMENT ON COLUMN "public"."agent_tasks"."instructions" IS 'The prompt/instructions that will be given to the agent when the task executes';



COMMENT ON COLUMN "public"."agent_tasks"."selected_tools" IS 'Array of tool IDs that the agent is allowed to use for this specific task';



COMMENT ON COLUMN "public"."agent_tasks"."cron_expression" IS 'Cron expression for scheduled tasks (required for scheduled tasks)';



COMMENT ON COLUMN "public"."agent_tasks"."event_trigger_config" IS 'Configuration specific to the event trigger type';



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



CREATE TABLE IF NOT EXISTS "public"."agent_web_search_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "user_key_id" "uuid" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_web_search_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "system_instructions" "text",
    "assistant_instructions" "text",
    "active" boolean DEFAULT false,
    "personality" "text",
    "avatar_url" "text"
);

ALTER TABLE ONLY "public"."agents" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agents"."active" IS 'Indicates if the agent is generally considered active/enabled by the user.';



CREATE TABLE IF NOT EXISTS "public"."chat_messages_v2" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "version" character varying(10) DEFAULT '1.0.0'::character varying NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "parent_message_id" "uuid",
    "channel_id" "uuid",
    "sender_user_id" "uuid",
    "sender_agent_id" "uuid",
    "role" character varying(20) NOT NULL,
    "content" "jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "tools" "jsonb",
    "memory_refs" "uuid"[],
    "state_snapshot_id" "uuid",
    "audit" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_v2_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['system'::character varying, 'user'::character varying, 'assistant'::character varying, 'tool'::character varying])::"text"[]))),
    CONSTRAINT "check_actor_exclusivity" CHECK (((("sender_user_id" IS NOT NULL) AND ("sender_agent_id" IS NULL)) OR (("sender_user_id" IS NULL) AND ("sender_agent_id" IS NOT NULL)) OR ((("role")::"text" = 'system'::"text") AND ("sender_user_id" IS NULL) AND ("sender_agent_id" IS NULL)))),
    CONSTRAINT "check_content_structure" CHECK ((("content" ? 'type'::"text") AND (("content" ->> 'type'::"text") = ANY (ARRAY['text'::"text", 'structured'::"text", 'multimodal'::"text", 'tool_result'::"text"]))))
);


ALTER TABLE "public"."chat_messages_v2" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_messages_v2" IS 'Advanced chat messages with structured content, metadata, and context support';



COMMENT ON COLUMN "public"."chat_messages_v2"."content" IS 'JSONB structure with type field: text, structured, multimodal, or tool_result';



CREATE TABLE IF NOT EXISTS "public"."context_snapshots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid",
    "agent_id" "uuid",
    "snapshot_data" "jsonb" NOT NULL,
    "total_tokens" integer,
    "compression_ratio" double precision,
    "segment_count" integer,
    "build_time_ms" integer,
    "optimization_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."context_snapshots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."context_snapshots"."compression_ratio" IS 'Ratio of compressed to original token count';



CREATE TABLE IF NOT EXISTS "public"."context_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "segments" "jsonb" NOT NULL,
    "variables" "jsonb",
    "total_tokens" integer,
    "use_count" integer DEFAULT 0,
    "use_cases" "text"[],
    "agent_types" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."context_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."datastore_documents" (
    "id" "text" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "text_content" "text",
    "chunk_count" integer DEFAULT 0,
    "processed_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "datastore_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."datastore_documents" OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mailgun_message_id" character varying(255),
    "agent_id" "uuid",
    "user_id" "uuid",
    "direction" "public"."email_direction_enum" NOT NULL,
    "from_address" character varying(255),
    "to_address" character varying(255),
    "subject" "text",
    "status" character varying(50),
    "event_data" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_direction" CHECK (("direction" = ANY (ARRAY['inbound'::"public"."email_direction_enum", 'outbound'::"public"."email_direction_enum"])))
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_logs" IS 'Logs all email activity (sent and received) through Mailgun';



COMMENT ON COLUMN "public"."email_logs"."direction" IS 'Whether email was inbound or outbound';



CREATE TABLE IF NOT EXISTS "public"."gmail_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_oauth_connection_id" "uuid" NOT NULL,
    "security_settings" "jsonb",
    "rate_limit_settings" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gmail_configurations" OWNER TO "postgres";


COMMENT ON TABLE "public"."gmail_configurations" IS 'Stores user-specific configurations for the Gmail integration.';



CREATE TABLE IF NOT EXISTS "public"."gmail_operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "operation_type" "text" NOT NULL,
    "operation_params" "jsonb",
    "operation_result" "jsonb",
    "status" "text" NOT NULL,
    "error_message" "text",
    "quota_consumed" integer DEFAULT 0,
    "execution_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gmail_operation_logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'error'::"text", 'unauthorized'::"text"])))
);


ALTER TABLE "public"."gmail_operation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text",
    "status" "public"."integration_status_enum" DEFAULT 'available'::"public"."integration_status_enum",
    "is_popular" boolean DEFAULT false,
    "documentation_url" "text",
    "configuration_schema" "jsonb" DEFAULT '{}'::"jsonb",
    "required_oauth_provider_id" "uuid",
    "required_tool_catalog_id" "uuid",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "agent_classification" "public"."integration_agent_classification_enum" DEFAULT 'tool'::"public"."integration_agent_classification_enum" NOT NULL
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."integrations" IS 'Available integrations that can be configured by users, displayed in the integrations UI';



COMMENT ON COLUMN "public"."integrations"."agent_classification" IS 'Classification for agent usage: tool (functional/utility) or channel (communication)';



CREATE TABLE IF NOT EXISTS "public"."mailgun_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_oauth_connection_id" "uuid",
    "domain" character varying(255) NOT NULL,
    "region" character varying(50) DEFAULT 'us'::character varying,
    "webhook_signing_key_id" "uuid",
    "smtp_username" character varying(255),
    "smtp_password_id" "uuid",
    "webhook_url" character varying(500),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mailgun_configurations_region_check" CHECK ((("region")::"text" = ANY ((ARRAY['us'::character varying, 'eu'::character varying])::"text"[])))
);


ALTER TABLE "public"."mailgun_configurations" OWNER TO "postgres";


COMMENT ON TABLE "public"."mailgun_configurations" IS 'Stores Mailgun API configuration and settings for each user';



COMMENT ON COLUMN "public"."mailgun_configurations"."domain" IS 'The Mailgun domain for sending emails';



COMMENT ON COLUMN "public"."mailgun_configurations"."region" IS 'Mailgun region (us or eu)';



CREATE TABLE IF NOT EXISTS "public"."mailgun_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mailgun_config_id" "uuid",
    "mailgun_route_id" character varying(255),
    "priority" integer DEFAULT 0 NOT NULL,
    "expression" "text" NOT NULL,
    "action" "text" NOT NULL,
    "description" "text",
    "agent_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mailgun_routes_priority_check" CHECK ((("priority" >= 0) AND ("priority" <= 32767)))
);


ALTER TABLE "public"."mailgun_routes" OWNER TO "postgres";


COMMENT ON TABLE "public"."mailgun_routes" IS 'Defines email routing rules for inbound emails via Mailgun';



COMMENT ON COLUMN "public"."mailgun_routes"."priority" IS 'Route priority (0-32767, lower = higher priority)';



COMMENT ON COLUMN "public"."mailgun_routes"."expression" IS 'Mailgun route expression for matching emails';



COMMENT ON COLUMN "public"."mailgun_routes"."action" IS 'Action to take when route matches';



CREATE TABLE IF NOT EXISTS "public"."memory_consolidations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "source_memories" "uuid"[] NOT NULL,
    "consolidated_memory_id" "uuid",
    "consolidation_type" character varying(20),
    "tokens_saved" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memory_consolidations_consolidation_type_check" CHECK ((("consolidation_type")::"text" = ANY ((ARRAY['merge'::character varying, 'summarize'::character varying, 'abstract'::character varying])::"text"[])))
);


ALTER TABLE "public"."memory_consolidations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_versions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content" "jsonb" NOT NULL,
    "metadata" "jsonb",
    "changed_by" "uuid",
    "change_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_versions" OWNER TO "postgres";


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


COMMENT ON TABLE "public"."oauth_providers" IS 'Unified provider table supporting both OAuth providers (like Gmail) and API key providers (like web search APIs). API key providers use this table for consistency but store keys differently.';



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



CREATE TABLE IF NOT EXISTS "public"."sendgrid_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "api_key_vault_id" "uuid" NOT NULL,
    "from_email" "text" NOT NULL,
    "from_name" "text",
    "reply_to_email" "text",
    "inbound_domain" "text",
    "inbound_webhook_url" "text",
    "inbound_parse_settings" "jsonb" DEFAULT '{"send_raw": false, "check_spf": true, "spam_check": true}'::"jsonb",
    "max_emails_per_day" integer DEFAULT 1000,
    "max_recipients_per_email" integer DEFAULT 100,
    "enable_tracking" "jsonb" DEFAULT '{"opens": true, "clicks": true, "unsubscribes": true}'::"jsonb",
    "allowed_domains" "text"[],
    "require_approval" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_valid_from_email" CHECK (("from_email" ~ '^[^@]+@[^@]+\.[^@]+$'::"text"))
);


ALTER TABLE "public"."sendgrid_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sendgrid_inbound_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sendgrid_config_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "message_id" "text" NOT NULL,
    "sendgrid_message_id" "text",
    "from_email" "text" NOT NULL,
    "from_name" "text",
    "to_emails" "text"[] NOT NULL,
    "cc_emails" "text"[],
    "bcc_emails" "text"[],
    "reply_to_email" "text",
    "subject" "text",
    "text_body" "text",
    "html_body" "text",
    "headers" "jsonb" DEFAULT '{}'::"jsonb",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "routing_rules_applied" "uuid"[],
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "processing_status" "text" DEFAULT 'processed'::"text",
    "processing_errors" "jsonb" DEFAULT '{}'::"jsonb",
    "spam_score" double precision,
    "spf_check" "text",
    "dkim_check" "text",
    "envelope" "jsonb" DEFAULT '{}'::"jsonb",
    "charsets" "jsonb" DEFAULT '{}'::"jsonb",
    "raw_webhook_data" "jsonb",
    "in_reply_to" "text",
    "message_references" "text"[],
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sendgrid_inbound_emails_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['processed'::"text", 'failed'::"text", 'pending'::"text", 'quarantined'::"text"])))
);


ALTER TABLE "public"."sendgrid_inbound_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."sendgrid_inbound_emails" IS 'Storage for inbound emails received via SendGrid Inbound Parse webhook';



COMMENT ON COLUMN "public"."sendgrid_inbound_emails"."routing_rules_applied" IS 'Array of routing rule IDs that were applied to this email';



COMMENT ON COLUMN "public"."sendgrid_inbound_emails"."raw_webhook_data" IS 'Original webhook payload for debugging';



CREATE TABLE IF NOT EXISTS "public"."sendgrid_inbound_routing_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "uuid" NOT NULL,
    "rule_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_details" "jsonb" DEFAULT '{}'::"jsonb",
    "execution_time_ms" integer,
    "success" boolean DEFAULT true,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sendgrid_inbound_routing_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."sendgrid_inbound_routing_logs" IS 'Audit log for routing rule execution and debugging';



CREATE TABLE IF NOT EXISTS "public"."sendgrid_inbound_routing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sendgrid_config_id" "uuid" NOT NULL,
    "agent_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "action" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stop_processing" boolean DEFAULT false,
    "match_count" integer DEFAULT 0,
    "last_matched_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sendgrid_inbound_routing_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."sendgrid_inbound_routing_rules" IS 'Rules for automatically processing inbound emails based on conditions';



COMMENT ON COLUMN "public"."sendgrid_inbound_routing_rules"."conditions" IS 'JSON object with conditions that must match for rule to trigger';



COMMENT ON COLUMN "public"."sendgrid_inbound_routing_rules"."action" IS 'JSON object defining the action to take when rule matches';



CREATE TABLE IF NOT EXISTS "public"."sendgrid_operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sendgrid_config_id" "uuid" NOT NULL,
    "operation_type" "text" NOT NULL,
    "operation_params" "jsonb",
    "operation_result" "jsonb",
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "sendgrid_message_id" "text",
    "recipients_count" integer DEFAULT 1,
    "execution_time_ms" integer,
    "api_calls_made" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sendgrid_operation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sendgrid_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sendgrid_config_id" "uuid" NOT NULL,
    "sendgrid_template_id" "text" NOT NULL,
    "template_name" "text" NOT NULL,
    "template_version_id" "text",
    "subject_template" "text",
    "is_dynamic" boolean DEFAULT true,
    "variables" "jsonb" DEFAULT '{}'::"jsonb",
    "agent_ids_allowed" "uuid"[],
    "last_used_at" timestamp with time zone,
    "use_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sendgrid_templates" OWNER TO "postgres";


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
    "is_public" boolean DEFAULT true,
    "created_by" "uuid"
);


ALTER TABLE "public"."tool_catalog" OWNER TO "postgres";


COMMENT ON TABLE "public"."tool_catalog" IS 'Admin-curated list of available tools that can be deployed on Toolboxes. Includes generic MCP Server entry for foreign key constraints.';



COMMENT ON COLUMN "public"."tool_catalog"."required_secrets_schema" IS 'JSON schema defining secrets required by the tool.';



COMMENT ON COLUMN "public"."tool_catalog"."docker_image_url" IS 'The Docker image URL for deploying this tool.';



COMMENT ON COLUMN "public"."tool_catalog"."required_config_schema" IS 'JSON schema for basic configuration options.';



COMMENT ON COLUMN "public"."tool_catalog"."required_capabilities_schema" IS 'JSON schema defining capabilities the tool offers.';



COMMENT ON COLUMN "public"."tool_catalog"."created_by" IS 'The user who created the tool catalog entry.';



CREATE TABLE IF NOT EXISTS "public"."tool_execution_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tool_name" "text" NOT NULL,
    "tool_provider" "text" NOT NULL,
    "parameters" "jsonb",
    "result_data" "jsonb",
    "success" boolean DEFAULT false NOT NULL,
    "error_message" "text",
    "execution_time_ms" integer,
    "quota_consumed" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tool_execution_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."tool_execution_logs" IS 'Logs all tool executions by agents for audit and debugging purposes';



CREATE TABLE IF NOT EXISTS "public"."user_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "connection_name" "text",
    "connection_status" "public"."integration_connection_status_enum" DEFAULT 'pending'::"public"."integration_connection_status_enum",
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "oauth_connection_id" "uuid",
    "tool_instance_id" "uuid",
    "last_sync_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_oauth_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "oauth_provider_id" "uuid" NOT NULL,
    "external_user_id" "text" NOT NULL,
    "external_username" "text",
    "scopes_granted" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "connection_name" "text" NOT NULL,
    "vault_access_token_id" "text",
    "vault_refresh_token_id" "text",
    "token_expires_at" timestamp with time zone,
    "last_token_refresh" timestamp with time zone,
    "connection_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "connection_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "encrypted_access_token" "text",
    "encrypted_refresh_token" "text",
    "credential_type" "public"."connection_credential_type_enum" DEFAULT 'oauth'::"public"."connection_credential_type_enum" NOT NULL,
    CONSTRAINT "chk_credential_type_consistency" CHECK (((("credential_type" = 'oauth'::"public"."connection_credential_type_enum") AND ("connection_status" = 'active'::"text") AND ("vault_access_token_id" IS NOT NULL)) OR (("credential_type" = 'api_key'::"public"."connection_credential_type_enum") AND ("connection_status" = 'active'::"text") AND ("vault_access_token_id" IS NOT NULL)) OR ("connection_status" <> 'active'::"text"))),
    CONSTRAINT "user_oauth_connections_connection_status_check" CHECK (("connection_status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."user_oauth_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_oauth_connections" IS 'User-specific OAuth and API key connections with credential storage';



COMMENT ON COLUMN "public"."user_oauth_connections"."vault_access_token_id" IS 'Stores access token directly or vault ID reference';



COMMENT ON COLUMN "public"."user_oauth_connections"."vault_refresh_token_id" IS 'Stores refresh token directly or vault ID reference';



COMMENT ON COLUMN "public"."user_oauth_connections"."credential_type" IS 'Type of credential: oauth (supports refresh) or api_key (long-lived, no refresh)';



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



CREATE TABLE IF NOT EXISTS "public"."user_web_search_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "vault_api_key_id" "uuid" NOT NULL,
    "key_name" "text",
    "quota_limit" integer,
    "quota_used" integer DEFAULT 0,
    "quota_reset_at" timestamp with time zone,
    "key_status" "text" DEFAULT 'active'::"text",
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_web_search_keys_key_status_check" CHECK (("key_status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'expired'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."user_web_search_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."web_search_operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "operation_type" "text" NOT NULL,
    "query_text" "text",
    "results_count" integer DEFAULT 0,
    "tokens_used" integer DEFAULT 0,
    "quota_consumed" integer DEFAULT 1,
    "execution_time_ms" integer,
    "success" boolean DEFAULT true,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "web_search_operation_logs_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['web_search'::"text", 'news_search'::"text", 'image_search'::"text", 'scrape_and_summarize'::"text"])))
);


ALTER TABLE "public"."web_search_operation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."web_search_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "base_url" "text" NOT NULL,
    "auth_type" "text" DEFAULT 'api_key'::"text" NOT NULL,
    "api_key_header" "text" DEFAULT 'X-API-KEY'::"text" NOT NULL,
    "api_key_prefix" "text" DEFAULT ''::"text",
    "supported_features" "jsonb" DEFAULT '[]'::"jsonb",
    "rate_limits" "jsonb" DEFAULT '{}'::"jsonb",
    "configuration" "jsonb" DEFAULT '{}'::"jsonb",
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "web_search_providers_auth_type_check" CHECK (("auth_type" = ANY (ARRAY['api_key'::"text", 'bearer_token'::"text"])))
);


ALTER TABLE "public"."web_search_providers" OWNER TO "postgres";


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


ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "account_tool_environment_active_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_dtma_bearer_token_key" UNIQUE ("dtma_bearer_token");



COMMENT ON CONSTRAINT "account_tool_environments_dtma_bearer_token_key" ON "public"."account_tool_environments" IS 'Ensures dtma_bearer_token is unique across all tool environments for secure lookup.';



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_operation_logs"
    ADD CONSTRAINT "admin_operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_agent_id_datastore_id_key" UNIQUE ("agent_id", "datastore_id");



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."agent_email_addresses"
    ADD CONSTRAINT "agent_email_addresses_local_part_domain_key" UNIQUE ("local_part", "domain");



ALTER TABLE ONLY "public"."agent_email_addresses"
    ADD CONSTRAINT "agent_email_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_memories"
    ADD CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_sendgrid_permissions"
    ADD CONSTRAINT "agent_sendgrid_permissions_agent_id_sendgrid_config_id_key" UNIQUE ("agent_id", "sendgrid_config_id");



ALTER TABLE ONLY "public"."agent_sendgrid_permissions"
    ADD CONSTRAINT "agent_sendgrid_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_task_event_triggers"
    ADD CONSTRAINT "agent_task_event_triggers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_task_executions"
    ADD CONSTRAINT "agent_task_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_capability_permissions"
    ADD CONSTRAINT "agent_tool_capability_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_tool_credentials"
    ADD CONSTRAINT "agent_tool_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_toolbelt_items"
    ADD CONSTRAINT "agent_toolbelt_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_toolbox_access"
    ADD CONSTRAINT "agent_toolbox_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_web_search_permissions"
    ADD CONSTRAINT "agent_web_search_permissions_agent_id_provider_id_key" UNIQUE ("agent_id", "provider_id");



ALTER TABLE ONLY "public"."agent_web_search_permissions"
    ADD CONSTRAINT "agent_web_search_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages_v2"
    ADD CONSTRAINT "chat_messages_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."context_snapshots"
    ADD CONSTRAINT "context_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."context_templates"
    ADD CONSTRAINT "context_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."context_templates"
    ADD CONSTRAINT "context_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."datastore_documents"
    ADD CONSTRAINT "datastore_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."datastores"
    ADD CONSTRAINT "datastores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_configurations"
    ADD CONSTRAINT "gmail_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_operation_logs"
    ADD CONSTRAINT "gmail_operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_categories"
    ADD CONSTRAINT "integration_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."integration_categories"
    ADD CONSTRAINT "integration_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mailgun_configurations"
    ADD CONSTRAINT "mailgun_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mailgun_routes"
    ADD CONSTRAINT "mailgun_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_consolidations"
    ADD CONSTRAINT "memory_consolidations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_versions"
    ADD CONSTRAINT "message_versions_message_id_version_number_key" UNIQUE ("message_id", "version_number");



ALTER TABLE ONLY "public"."message_versions"
    ADD CONSTRAINT "message_versions_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."sendgrid_configurations"
    ADD CONSTRAINT "sendgrid_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendgrid_configurations"
    ADD CONSTRAINT "sendgrid_configurations_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."sendgrid_inbound_emails"
    ADD CONSTRAINT "sendgrid_inbound_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendgrid_inbound_routing_logs"
    ADD CONSTRAINT "sendgrid_inbound_routing_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendgrid_inbound_routing_rules"
    ADD CONSTRAINT "sendgrid_inbound_routing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendgrid_operation_logs"
    ADD CONSTRAINT "sendgrid_operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendgrid_templates"
    ADD CONSTRAINT "sendgrid_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sendgrid_templates"
    ADD CONSTRAINT "sendgrid_templates_sendgrid_config_id_sendgrid_template_id_key" UNIQUE ("sendgrid_config_id", "sendgrid_template_id");



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



ALTER TABLE ONLY "public"."tool_execution_logs"
    ADD CONSTRAINT "tool_execution_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mailgun_configurations"
    ADD CONSTRAINT "unique_connection_mailgun" UNIQUE ("user_oauth_connection_id");



ALTER TABLE ONLY "public"."mailgun_routes"
    ADD CONSTRAINT "unique_mailgun_route_id" UNIQUE ("mailgun_route_id");



ALTER TABLE ONLY "public"."mailgun_configurations"
    ADD CONSTRAINT "unique_user_mailgun" UNIQUE ("user_id");



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



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_user_id_integration_id_connection_name_key" UNIQUE ("user_id", "integration_id", "connection_name");



ALTER TABLE ONLY "public"."user_oauth_connections"
    ADD CONSTRAINT "user_oauth_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_oauth_connections"
    ADD CONSTRAINT "user_oauth_connections_user_provider_name_key" UNIQUE ("user_id", "oauth_provider_id", "connection_name");



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



ALTER TABLE ONLY "public"."user_web_search_keys"
    ADD CONSTRAINT "user_web_search_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_web_search_keys"
    ADD CONSTRAINT "user_web_search_keys_user_id_provider_id_key_name_key" UNIQUE ("user_id", "provider_id", "key_name");



ALTER TABLE ONLY "public"."web_search_operation_logs"
    ADD CONSTRAINT "web_search_operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."web_search_providers"
    ADD CONSTRAINT "web_search_providers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."web_search_providers"
    ADD CONSTRAINT "web_search_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_operation_logs_admin_user_id" ON "public"."admin_operation_logs" USING "btree" ("admin_user_id");



CREATE INDEX "idx_admin_operation_logs_operation" ON "public"."admin_operation_logs" USING "btree" ("operation");



CREATE INDEX "idx_admin_operation_logs_server_id" ON "public"."admin_operation_logs" USING "btree" ("server_id");



CREATE INDEX "idx_admin_operation_logs_success" ON "public"."admin_operation_logs" USING "btree" ("success");



CREATE INDEX "idx_admin_operation_logs_timestamp" ON "public"."admin_operation_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_agent_datastores_agent_id" ON "public"."agent_datastores" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_datastores_datastore_id" ON "public"."agent_datastores" USING "btree" ("datastore_id");



CREATE INDEX "idx_agent_droplet_tools_agent_droplet_id" ON "public"."agent_droplet_tools" USING "btree" ("agent_droplet_id");



CREATE INDEX "idx_agent_droplet_tools_status" ON "public"."agent_droplet_tools" USING "btree" ("status");



CREATE INDEX "idx_agent_droplet_tools_tool_catalog_id" ON "public"."agent_droplet_tools" USING "btree" ("tool_catalog_id");



CREATE INDEX "idx_agent_droplets_agent_id" ON "public"."agent_droplets" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_droplets_do_droplet_id" ON "public"."agent_droplets" USING "btree" ("do_droplet_id");



CREATE INDEX "idx_agent_droplets_status" ON "public"."agent_droplets" USING "btree" ("status");



CREATE INDEX "idx_agent_email_addresses_agent" ON "public"."agent_email_addresses" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_email_addresses_full" ON "public"."agent_email_addresses" USING "btree" ("full_address");



CREATE INDEX "idx_agent_oauth_permissions_agent_connection" ON "public"."agent_oauth_permissions" USING "btree" ("agent_id", "user_oauth_connection_id");



CREATE INDEX "idx_agent_oauth_permissions_agent_id" ON "public"."agent_oauth_permissions" USING "btree" ("agent_id") WHERE ("is_active" = true);



CREATE INDEX "idx_agent_permissions_active" ON "public"."agent_sendgrid_permissions" USING "btree" ("agent_id") WHERE ("is_active" = true);



CREATE INDEX "idx_agent_task_event_triggers_is_active" ON "public"."agent_task_event_triggers" USING "btree" ("is_active");



CREATE INDEX "idx_agent_task_event_triggers_last_triggered_at" ON "public"."agent_task_event_triggers" USING "btree" ("last_triggered_at");



CREATE INDEX "idx_agent_task_event_triggers_task_id" ON "public"."agent_task_event_triggers" USING "btree" ("task_id");



CREATE INDEX "idx_agent_task_event_triggers_trigger_type" ON "public"."agent_task_event_triggers" USING "btree" ("trigger_type");



CREATE INDEX "idx_agent_task_executions_agent_id" ON "public"."agent_task_executions" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_task_executions_created_at" ON "public"."agent_task_executions" USING "btree" ("created_at");



CREATE INDEX "idx_agent_task_executions_status" ON "public"."agent_task_executions" USING "btree" ("status");



CREATE INDEX "idx_agent_task_executions_task_id" ON "public"."agent_task_executions" USING "btree" ("task_id");



CREATE INDEX "idx_agent_tasks_agent_id" ON "public"."agent_tasks" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_tasks_event_trigger_type" ON "public"."agent_tasks" USING "btree" ("event_trigger_type") WHERE ("task_type" = 'event_based'::"public"."task_type_enum");



CREATE INDEX "idx_agent_tasks_next_run_at" ON "public"."agent_tasks" USING "btree" ("next_run_at") WHERE (("status" = 'active'::"public"."task_status_enum") AND ("task_type" = 'scheduled'::"public"."task_type_enum"));



CREATE INDEX "idx_agent_tasks_status" ON "public"."agent_tasks" USING "btree" ("status");



CREATE INDEX "idx_agent_tasks_task_type" ON "public"."agent_tasks" USING "btree" ("task_type");



CREATE INDEX "idx_agent_tasks_user_id" ON "public"."agent_tasks" USING "btree" ("user_id");



CREATE INDEX "idx_agent_web_search_permissions_agent" ON "public"."agent_web_search_permissions" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_web_search_permissions_user" ON "public"."agent_web_search_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_agents_created_at" ON "public"."agents" USING "btree" ("created_at");



CREATE INDEX "idx_agents_user_id" ON "public"."agents" USING "btree" ("user_id");



CREATE INDEX "idx_ata_account_tool_environment_id" ON "public"."agent_toolbox_access" USING "btree" ("account_tool_environment_id");



CREATE INDEX "idx_ata_agent_id" ON "public"."agent_toolbox_access" USING "btree" ("agent_id");



CREATE INDEX "idx_atc_agent_toolbelt_item_id" ON "public"."agent_tool_credentials" USING "btree" ("agent_toolbelt_item_id");



CREATE INDEX "idx_atcp_agent_toolbelt_item_id" ON "public"."agent_tool_capability_permissions" USING "btree" ("agent_toolbelt_item_id");



CREATE INDEX "idx_ate_do_droplet_name" ON "public"."account_tool_environments" USING "btree" ("do_droplet_name");



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



CREATE INDEX "idx_consolidations_agent" ON "public"."memory_consolidations" USING "btree" ("agent_id", "created_at" DESC);



CREATE INDEX "idx_context_snapshots_agent" ON "public"."context_snapshots" USING "btree" ("agent_id", "created_at" DESC);



CREATE INDEX "idx_context_snapshots_message" ON "public"."context_snapshots" USING "btree" ("message_id");



CREATE INDEX "idx_context_templates_name" ON "public"."context_templates" USING "btree" ("name");



CREATE INDEX "idx_datastore_documents_agent_id" ON "public"."datastore_documents" USING "btree" ("agent_id");



CREATE INDEX "idx_datastore_documents_created_at" ON "public"."datastore_documents" USING "btree" ("created_at");



CREATE INDEX "idx_datastore_documents_status" ON "public"."datastore_documents" USING "btree" ("status");



CREATE INDEX "idx_datastores_type" ON "public"."datastores" USING "btree" ("type");



CREATE INDEX "idx_datastores_user_id" ON "public"."datastores" USING "btree" ("user_id");



CREATE INDEX "idx_email_logs_agent" ON "public"."email_logs" USING "btree" ("agent_id");



CREATE INDEX "idx_email_logs_direction" ON "public"."email_logs" USING "btree" ("direction");



CREATE INDEX "idx_email_logs_mailgun_id" ON "public"."email_logs" USING "btree" ("mailgun_message_id");



CREATE INDEX "idx_email_logs_processed" ON "public"."email_logs" USING "btree" ("processed_at" DESC);



CREATE INDEX "idx_email_logs_status" ON "public"."email_logs" USING "btree" ("status");



CREATE INDEX "idx_email_logs_user" ON "public"."email_logs" USING "btree" ("user_id");



CREATE INDEX "idx_gmail_operation_logs_agent_id" ON "public"."gmail_operation_logs" USING "btree" ("agent_id");



CREATE INDEX "idx_gmail_operation_logs_created_at" ON "public"."gmail_operation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_gmail_operation_logs_status" ON "public"."gmail_operation_logs" USING "btree" ("status");



CREATE INDEX "idx_gmail_operation_logs_user_id" ON "public"."gmail_operation_logs" USING "btree" ("user_id");



CREATE INDEX "idx_inbound_emails_agent" ON "public"."sendgrid_inbound_emails" USING "btree" ("agent_id") WHERE ("agent_id" IS NOT NULL);



CREATE INDEX "idx_inbound_emails_config" ON "public"."sendgrid_inbound_emails" USING "btree" ("sendgrid_config_id");



CREATE INDEX "idx_inbound_emails_from" ON "public"."sendgrid_inbound_emails" USING "btree" ("from_email");



CREATE INDEX "idx_inbound_emails_message_id" ON "public"."sendgrid_inbound_emails" USING "btree" ("message_id");



CREATE INDEX "idx_inbound_emails_processed_at" ON "public"."sendgrid_inbound_emails" USING "btree" ("processed_at" DESC);



CREATE INDEX "idx_inbound_emails_status" ON "public"."sendgrid_inbound_emails" USING "btree" ("processing_status");



CREATE INDEX "idx_inbound_emails_subject" ON "public"."sendgrid_inbound_emails" USING "gin" ("to_tsvector"('"english"'::"regconfig", "subject"));



CREATE INDEX "idx_integrations_agent_classification" ON "public"."integrations" USING "btree" ("agent_classification");



CREATE INDEX "idx_integrations_category_id" ON "public"."integrations" USING "btree" ("category_id");



CREATE INDEX "idx_integrations_popular" ON "public"."integrations" USING "btree" ("is_popular");



CREATE INDEX "idx_integrations_status" ON "public"."integrations" USING "btree" ("status");



CREATE INDEX "idx_mailgun_configurations_active" ON "public"."mailgun_configurations" USING "btree" ("is_active");



CREATE INDEX "idx_mailgun_configurations_user" ON "public"."mailgun_configurations" USING "btree" ("user_id");



CREATE INDEX "idx_mailgun_routes_active" ON "public"."mailgun_routes" USING "btree" ("is_active");



CREATE INDEX "idx_mailgun_routes_agent" ON "public"."mailgun_routes" USING "btree" ("agent_id");



CREATE INDEX "idx_mailgun_routes_config" ON "public"."mailgun_routes" USING "btree" ("mailgun_config_id");



CREATE INDEX "idx_mailgun_routes_priority" ON "public"."mailgun_routes" USING "btree" ("priority");



CREATE INDEX "idx_memories_agent_type" ON "public"."agent_memories" USING "btree" ("agent_id", "memory_type");



CREATE INDEX "idx_memories_content_gin" ON "public"."agent_memories" USING "gin" ("content");



CREATE INDEX "idx_memories_embedding" ON "public"."agent_memories" USING "ivfflat" ("embeddings" "public"."vector_cosine_ops");



CREATE INDEX "idx_memories_expires" ON "public"."agent_memories" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_memories_importance" ON "public"."agent_memories" USING "btree" ("importance" DESC);



CREATE INDEX "idx_message_versions_message" ON "public"."message_versions" USING "btree" ("message_id", "version_number" DESC);



CREATE INDEX "idx_messages_channel" ON "public"."chat_messages_v2" USING "btree" ("channel_id") WHERE ("channel_id" IS NOT NULL);



CREATE INDEX "idx_messages_content_gin" ON "public"."chat_messages_v2" USING "gin" ("content");



CREATE INDEX "idx_messages_conversation" ON "public"."chat_messages_v2" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_messages_metadata_gin" ON "public"."chat_messages_v2" USING "gin" ("metadata");



CREATE INDEX "idx_messages_sender_agent" ON "public"."chat_messages_v2" USING "btree" ("sender_agent_id") WHERE ("sender_agent_id" IS NOT NULL);



CREATE INDEX "idx_messages_sender_user" ON "public"."chat_messages_v2" USING "btree" ("sender_user_id") WHERE ("sender_user_id" IS NOT NULL);



CREATE INDEX "idx_messages_session" ON "public"."chat_messages_v2" USING "btree" ("session_id");



CREATE INDEX "idx_oauth_providers_enabled" ON "public"."oauth_providers" USING "btree" ("name") WHERE ("is_enabled" = true);



CREATE INDEX "idx_oauth_providers_name" ON "public"."oauth_providers" USING "btree" ("name");



CREATE INDEX "idx_operation_logs_agent_date" ON "public"."sendgrid_operation_logs" USING "btree" ("agent_id", "created_at" DESC);



CREATE INDEX "idx_operation_logs_status_date" ON "public"."sendgrid_operation_logs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_operation_logs_type_date" ON "public"."sendgrid_operation_logs" USING "btree" ("operation_type", "created_at" DESC);



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



CREATE INDEX "idx_routing_logs_created_at" ON "public"."sendgrid_inbound_routing_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_routing_logs_email" ON "public"."sendgrid_inbound_routing_logs" USING "btree" ("email_id");



CREATE INDEX "idx_routing_logs_rule" ON "public"."sendgrid_inbound_routing_logs" USING "btree" ("rule_id") WHERE ("rule_id" IS NOT NULL);



CREATE INDEX "idx_routing_rules_active" ON "public"."sendgrid_inbound_routing_rules" USING "btree" ("is_active", "priority") WHERE ("is_active" = true);



CREATE INDEX "idx_routing_rules_agent" ON "public"."sendgrid_inbound_routing_rules" USING "btree" ("agent_id") WHERE ("agent_id" IS NOT NULL);



CREATE INDEX "idx_routing_rules_config" ON "public"."sendgrid_inbound_routing_rules" USING "btree" ("sendgrid_config_id");



CREATE INDEX "idx_sendgrid_configs_user" ON "public"."sendgrid_configurations" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_team_members_agent_id" ON "public"."team_members" USING "btree" ("agent_id");



CREATE INDEX "idx_team_members_reports_to_agent_id" ON "public"."team_members" USING "btree" ("reports_to_agent_id");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_tool_catalog_categories" ON "public"."tool_catalog" USING "gin" ("categories");



CREATE INDEX "idx_tool_catalog_category" ON "public"."tool_catalog" USING "btree" ("category");



CREATE INDEX "idx_tool_catalog_name" ON "public"."tool_catalog" USING "btree" ("name");



CREATE INDEX "idx_tool_catalog_status" ON "public"."tool_catalog" USING "btree" ("status");



CREATE INDEX "idx_tool_execution_logs_agent_id" ON "public"."tool_execution_logs" USING "btree" ("agent_id");



CREATE INDEX "idx_tool_execution_logs_created_at" ON "public"."tool_execution_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tool_execution_logs_tool_provider" ON "public"."tool_execution_logs" USING "btree" ("tool_provider");



CREATE INDEX "idx_tool_execution_logs_user_id" ON "public"."tool_execution_logs" USING "btree" ("user_id");



CREATE INDEX "idx_user_integrations_integration_id" ON "public"."user_integrations" USING "btree" ("integration_id");



CREATE INDEX "idx_user_integrations_status" ON "public"."user_integrations" USING "btree" ("connection_status");



CREATE INDEX "idx_user_integrations_user_id" ON "public"."user_integrations" USING "btree" ("user_id");



CREATE INDEX "idx_user_oauth_connections_credential_type" ON "public"."user_oauth_connections" USING "btree" ("credential_type", "connection_status");



CREATE INDEX "idx_user_oauth_connections_provider" ON "public"."user_oauth_connections" USING "btree" ("oauth_provider_id");



CREATE INDEX "idx_user_oauth_connections_provider_user" ON "public"."user_oauth_connections" USING "btree" ("oauth_provider_id", "user_id");



CREATE INDEX "idx_user_oauth_connections_status" ON "public"."user_oauth_connections" USING "btree" ("connection_status");



CREATE INDEX "idx_user_oauth_connections_user_id" ON "public"."user_oauth_connections" USING "btree" ("user_id") WHERE ("connection_status" = ANY (ARRAY['active'::"text", 'expired'::"text"]));



CREATE INDEX "idx_user_oauth_provider_lookup" ON "public"."user_oauth_connections" USING "btree" ("user_id", "oauth_provider_id", "connection_status");



CREATE INDEX "idx_user_ssh_keys_fingerprint" ON "public"."user_ssh_keys" USING "btree" ("fingerprint");



CREATE INDEX "idx_user_ssh_keys_user_id" ON "public"."user_ssh_keys" USING "btree" ("user_id");



CREATE INDEX "idx_user_team_memberships_team_id" ON "public"."user_team_memberships" USING "btree" ("team_id");



CREATE INDEX "idx_user_team_memberships_user_id" ON "public"."user_team_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_user_web_search_keys_provider" ON "public"."user_web_search_keys" USING "btree" ("provider_id");



CREATE INDEX "idx_user_web_search_keys_user_id" ON "public"."user_web_search_keys" USING "btree" ("user_id");



CREATE INDEX "idx_web_search_logs_agent_id" ON "public"."web_search_operation_logs" USING "btree" ("agent_id");



CREATE INDEX "idx_web_search_logs_created_at" ON "public"."web_search_operation_logs" USING "btree" ("created_at");



CREATE INDEX "idx_web_search_providers_name" ON "public"."web_search_providers" USING "btree" ("name");



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



CREATE OR REPLACE TRIGGER "set_integration_categories_updated_at" BEFORE UPDATE ON "public"."integration_categories" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_integrations_updated_at" BEFORE UPDATE ON "public"."integrations" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_tool_catalog_timestamp" BEFORE UPDATE ON "public"."tool_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_tool_catalog_updated_at" BEFORE UPDATE ON "public"."tool_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_user_integrations_updated_at" BEFORE UPDATE ON "public"."user_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "track_memory_access" BEFORE UPDATE OF "content", "embeddings" ON "public"."agent_memories" FOR EACH ROW EXECUTE FUNCTION "public"."update_memory_access"();



CREATE OR REPLACE TRIGGER "trigger_set_team_owner" BEFORE INSERT ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."set_team_owner"();



CREATE OR REPLACE TRIGGER "trigger_update_channel_last_message_at" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_last_message_at"();



CREATE OR REPLACE TRIGGER "update_admin_operation_logs_updated_at" BEFORE UPDATE ON "public"."admin_operation_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_email_addresses_updated_at" BEFORE UPDATE ON "public"."agent_email_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_sendgrid_updated_at"();



CREATE OR REPLACE TRIGGER "update_agent_sendgrid_permissions_updated_at" BEFORE UPDATE ON "public"."agent_sendgrid_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_sendgrid_updated_at"();



CREATE OR REPLACE TRIGGER "update_agent_task_event_triggers_updated_at" BEFORE UPDATE ON "public"."agent_task_event_triggers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_task_executions_updated_at" BEFORE UPDATE ON "public"."agent_task_executions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_tasks_updated_at" BEFORE UPDATE ON "public"."agent_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_web_search_permissions_updated_at" BEFORE UPDATE ON "public"."agent_web_search_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_agent_web_search_permissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_messages_v2_updated_at" BEFORE UPDATE ON "public"."chat_messages_v2" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_context_templates_updated_at" BEFORE UPDATE ON "public"."context_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_datastore_documents_updated_at" BEFORE UPDATE ON "public"."datastore_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_datastore_documents_updated_at"();



CREATE OR REPLACE TRIGGER "update_datastores_updated_at" BEFORE UPDATE ON "public"."datastores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mailgun_configurations_updated_at" BEFORE UPDATE ON "public"."mailgun_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mailgun_routes_updated_at" BEFORE UPDATE ON "public"."mailgun_routes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_oauth_providers_updated_at" BEFORE UPDATE ON "public"."oauth_providers" FOR EACH ROW EXECUTE FUNCTION "public"."update_oauth_providers_updated_at"();



CREATE OR REPLACE TRIGGER "update_sendgrid_configurations_updated_at" BEFORE UPDATE ON "public"."sendgrid_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_sendgrid_updated_at"();



CREATE OR REPLACE TRIGGER "update_sendgrid_inbound_emails_updated_at" BEFORE UPDATE ON "public"."sendgrid_inbound_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_sendgrid_updated_at"();



CREATE OR REPLACE TRIGGER "update_sendgrid_inbound_routing_rules_updated_at" BEFORE UPDATE ON "public"."sendgrid_inbound_routing_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_sendgrid_updated_at"();



CREATE OR REPLACE TRIGGER "update_sendgrid_templates_updated_at" BEFORE UPDATE ON "public"."sendgrid_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_sendgrid_updated_at"();



CREATE OR REPLACE TRIGGER "update_session_activity" AFTER INSERT ON "public"."chat_messages_v2" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_last_active"();



CREATE OR REPLACE TRIGGER "update_tool_execution_logs_updated_at" BEFORE UPDATE ON "public"."tool_execution_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_tool_execution_logs_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_oauth_connections_updated_at" BEFORE UPDATE ON "public"."user_oauth_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_oauth_connections_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_web_search_keys_updated_at" BEFORE UPDATE ON "public"."user_web_search_keys" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_web_search_keys_updated_at"();



CREATE OR REPLACE TRIGGER "update_web_search_providers_updated_at" BEFORE UPDATE ON "public"."web_search_providers" FOR EACH ROW EXECUTE FUNCTION "public"."update_web_search_providers_updated_at"();



ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "account_tool_environment_activ_account_tool_environment_id_fkey" FOREIGN KEY ("account_tool_environment_id") REFERENCES "public"."account_tool_environments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_tool_instances"
    ADD CONSTRAINT "account_tool_environment_active_tools_tool_catalog_id_fkey" FOREIGN KEY ("tool_catalog_id") REFERENCES "public"."tool_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."account_tool_environments"
    ADD CONSTRAINT "account_tool_environments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_operation_logs"
    ADD CONSTRAINT "admin_operation_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_datastores"
    ADD CONSTRAINT "agent_datastores_datastore_id_fkey" FOREIGN KEY ("datastore_id") REFERENCES "public"."datastores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_agent_droplet_id_fkey" FOREIGN KEY ("agent_droplet_id") REFERENCES "public"."agent_droplets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_droplet_tools"
    ADD CONSTRAINT "agent_droplet_tools_tool_catalog_id_fkey" FOREIGN KEY ("tool_catalog_id") REFERENCES "public"."tool_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."agent_droplets"
    ADD CONSTRAINT "agent_droplets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_email_addresses"
    ADD CONSTRAINT "agent_email_addresses_sendgrid_config_id_fkey" FOREIGN KEY ("sendgrid_config_id") REFERENCES "public"."sendgrid_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_memories"
    ADD CONSTRAINT "agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_memories"
    ADD CONSTRAINT "agent_memories_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "public"."chat_messages_v2"("id");



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_oauth_permissions"
    ADD CONSTRAINT "agent_oauth_permissions_user_oauth_connection_id_fkey" FOREIGN KEY ("user_oauth_connection_id") REFERENCES "public"."user_oauth_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_sendgrid_permissions"
    ADD CONSTRAINT "agent_sendgrid_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_sendgrid_permissions"
    ADD CONSTRAINT "agent_sendgrid_permissions_sendgrid_config_id_fkey" FOREIGN KEY ("sendgrid_config_id") REFERENCES "public"."sendgrid_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_task_event_triggers"
    ADD CONSTRAINT "agent_task_event_triggers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_task_executions"
    ADD CONSTRAINT "agent_task_executions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_task_executions"
    ADD CONSTRAINT "agent_task_executions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."agent_web_search_permissions"
    ADD CONSTRAINT "agent_web_search_permissions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."web_search_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_web_search_permissions"
    ADD CONSTRAINT "agent_web_search_permissions_user_key_id_fkey" FOREIGN KEY ("user_key_id") REFERENCES "public"."user_web_search_keys"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."chat_messages_v2"
    ADD CONSTRAINT "chat_messages_v2_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id");



ALTER TABLE ONLY "public"."chat_messages_v2"
    ADD CONSTRAINT "chat_messages_v2_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."chat_messages_v2"("id");



ALTER TABLE ONLY "public"."chat_messages_v2"
    ADD CONSTRAINT "chat_messages_v2_sender_agent_id_fkey" FOREIGN KEY ("sender_agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."chat_messages_v2"
    ADD CONSTRAINT "chat_messages_v2_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "chat_rooms_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."context_snapshots"
    ADD CONSTRAINT "context_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."context_snapshots"
    ADD CONSTRAINT "context_snapshots_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages_v2"("id");



ALTER TABLE ONLY "public"."datastore_documents"
    ADD CONSTRAINT "datastore_documents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."datastores"
    ADD CONSTRAINT "datastores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gmail_configurations"
    ADD CONSTRAINT "gmail_configurations_user_oauth_connection_id_fkey" FOREIGN KEY ("user_oauth_connection_id") REFERENCES "public"."user_oauth_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_operation_logs"
    ADD CONSTRAINT "gmail_operation_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_operation_logs"
    ADD CONSTRAINT "gmail_operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."integration_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mailgun_configurations"
    ADD CONSTRAINT "mailgun_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mailgun_configurations"
    ADD CONSTRAINT "mailgun_configurations_user_oauth_connection_id_fkey" FOREIGN KEY ("user_oauth_connection_id") REFERENCES "public"."user_oauth_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mailgun_routes"
    ADD CONSTRAINT "mailgun_routes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mailgun_routes"
    ADD CONSTRAINT "mailgun_routes_mailgun_config_id_fkey" FOREIGN KEY ("mailgun_config_id") REFERENCES "public"."mailgun_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_consolidations"
    ADD CONSTRAINT "memory_consolidations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_consolidations"
    ADD CONSTRAINT "memory_consolidations_consolidated_memory_id_fkey" FOREIGN KEY ("consolidated_memory_id") REFERENCES "public"."agent_memories"("id");



ALTER TABLE ONLY "public"."message_versions"
    ADD CONSTRAINT "message_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."message_versions"
    ADD CONSTRAINT "message_versions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages_v2"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."sendgrid_configurations"
    ADD CONSTRAINT "sendgrid_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sendgrid_inbound_emails"
    ADD CONSTRAINT "sendgrid_inbound_emails_sendgrid_config_id_fkey" FOREIGN KEY ("sendgrid_config_id") REFERENCES "public"."sendgrid_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sendgrid_inbound_routing_logs"
    ADD CONSTRAINT "sendgrid_inbound_routing_logs_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."sendgrid_inbound_emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sendgrid_inbound_routing_logs"
    ADD CONSTRAINT "sendgrid_inbound_routing_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."sendgrid_inbound_routing_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sendgrid_inbound_routing_rules"
    ADD CONSTRAINT "sendgrid_inbound_routing_rules_sendgrid_config_id_fkey" FOREIGN KEY ("sendgrid_config_id") REFERENCES "public"."sendgrid_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sendgrid_operation_logs"
    ADD CONSTRAINT "sendgrid_operation_logs_sendgrid_config_id_fkey" FOREIGN KEY ("sendgrid_config_id") REFERENCES "public"."sendgrid_configurations"("id");



ALTER TABLE ONLY "public"."sendgrid_templates"
    ADD CONSTRAINT "sendgrid_templates_sendgrid_config_id_fkey" FOREIGN KEY ("sendgrid_config_id") REFERENCES "public"."sendgrid_configurations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_reports_to_agent_id_fkey" FOREIGN KEY ("reports_to_agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tool_catalog"
    ADD CONSTRAINT "tool_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tool_execution_logs"
    ADD CONSTRAINT "tool_execution_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tool_execution_logs"
    ADD CONSTRAINT "tool_execution_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."user_web_search_keys"
    ADD CONSTRAINT "user_web_search_keys_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."web_search_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."web_search_operation_logs"
    ADD CONSTRAINT "web_search_operation_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."web_search_providers"("id");



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



CREATE POLICY "Admin can create account tool instances" ON "public"."account_tool_instances" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admin can delete account tool instances" ON "public"."account_tool_instances" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admin can update all account tool instances" ON "public"."account_tool_instances" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admin can view all account tool environments" ON "public"."account_tool_environments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admin can view all account tool instances" ON "public"."account_tool_instances" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admin users can insert operation logs" ON "public"."admin_operation_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "Admin users can view all operation logs" ON "public"."admin_operation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "Admins can create tool catalog entries" ON "public"."tool_catalog" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "Admins can update tool catalog entries" ON "public"."tool_catalog" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "Admins can view all tool catalog entries" ON "public"."tool_catalog" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "Agents can view messages in their conversations" ON "public"."chat_messages_v2" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "chat_messages_v2"."sender_agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow agent messages to be inserted" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("sender_agent_id" IS NOT NULL) AND ("sender_user_id" IS NULL)));



CREATE POLICY "Allow authenticated read access" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access to teams" ON "public"."teams" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow delete access for team owners/admins" ON "public"."team_members" FOR DELETE USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow delete for owner only" ON "public"."workspaces" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow delete for workspace managers" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



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



CREATE POLICY "Allow select for owner or member" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "owner_user_id") OR "public"."is_chat_room_member"("id", "auth"."uid"())));



CREATE POLICY "Allow select for workspace members" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING ("public"."is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow update access for team owners/admins" ON "public"."team_members" FOR UPDATE USING (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()))) WITH CHECK (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));



CREATE POLICY "Allow update for owner only" ON "public"."workspaces" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Allow update for workspace managers" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"())) WITH CHECK ("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));



CREATE POLICY "Allow users to add themselves to teams" ON "public"."user_team_memberships" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to insert their own messages" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_user_id") AND ("sender_agent_id" IS NULL)));



CREATE POLICY "Allow users to manage their own gmail configurations" ON "public"."gmail_configurations" USING (("auth"."uid"() = ( SELECT "user_oauth_connections"."user_id"
   FROM "public"."user_oauth_connections"
  WHERE ("user_oauth_connections"."id" = "gmail_configurations"."user_oauth_connection_id"))));



COMMENT ON POLICY "Allow users to manage their own gmail configurations" ON "public"."gmail_configurations" IS 'Users can manage their own Gmail configurations based on the ownership of the related OAuth connection.';



CREATE POLICY "Allow users to read their own messages and agent messages" ON "public"."chat_messages" FOR SELECT USING ((("auth"."uid"() = "sender_user_id") OR ("sender_agent_id" IS NOT NULL)));



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



CREATE POLICY "Authenticated users can view tool catalog" ON "public"."tool_catalog" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Disallow updates to channel messages" ON "public"."chat_messages" FOR UPDATE USING (false);



CREATE POLICY "Disallow updates to chat messages" ON "public"."chat_messages" FOR UPDATE USING (false);



CREATE POLICY "Integration categories are readable by everyone" ON "public"."integration_categories" FOR SELECT USING (true);



CREATE POLICY "Integrations are readable by everyone" ON "public"."integrations" FOR SELECT USING (true);



CREATE POLICY "OAuth providers are readable by authenticated users" ON "public"."oauth_providers" FOR SELECT TO "authenticated" USING (("is_enabled" = true));



CREATE POLICY "Only service role can modify OAuth providers" ON "public"."oauth_providers" TO "service_role" USING (true);



CREATE POLICY "Only service role can modify web search providers" ON "public"."web_search_providers" TO "service_role" USING (true);



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



CREATE POLICY "Service can manage inbound emails" ON "public"."sendgrid_inbound_emails" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service can manage routing logs" ON "public"."sendgrid_inbound_routing_logs" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can insert email logs" ON "public"."email_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert operation logs" ON "public"."web_search_operation_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage all SSH keys" ON "public"."user_ssh_keys" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all datastore documents" ON "public"."datastore_documents" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all logs" ON "public"."sendgrid_operation_logs" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage all tool execution logs" ON "public"."tool_execution_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to integration_categories" ON "public"."integration_categories" TO "service_role" USING (true);



CREATE POLICY "Service role full access to integrations" ON "public"."integrations" TO "service_role" USING (true);



CREATE POLICY "Service role has full access to gmail operation logs" ON "public"."gmail_operation_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service roles can access all account tool environments" ON "public"."account_tool_environments" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all account tool instances" ON "public"."account_tool_instances" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent tool capability permissions" ON "public"."agent_tool_capability_permissions" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent tool credentials" ON "public"."agent_tool_credentials" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent toolbelt items" ON "public"."agent_toolbelt_items" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can access all agent toolbox access" ON "public"."agent_toolbox_access" USING (("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service roles can manage tool catalog" ON "public"."tool_catalog" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can manage task executions" ON "public"."agent_task_executions" USING (true);



CREATE POLICY "Users can create datastores" ON "public"."datastores" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can create tasks for their own agents" ON "public"."agent_tasks" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_tasks"."agent_id") AND ("agents"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create their own OAuth connections" ON "public"."user_oauth_connections" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own web search keys" ON "public"."user_web_search_keys" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own SSH keys" ON "public"."user_ssh_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own datastores" ON "public"."datastores" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own mailgun configurations" ON "public"."mailgun_configurations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own mailgun routes" ON "public"."mailgun_routes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."mailgun_configurations"
  WHERE (("mailgun_configurations"."id" = "mailgun_routes"."mailgun_config_id") AND ("mailgun_configurations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own OAuth connections" ON "public"."user_oauth_connections" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own agent tasks" ON "public"."agent_tasks" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own datastore documents" ON "public"."datastore_documents" FOR DELETE USING (("agent_id" IN ( SELECT "agents"."id"
   FROM "public"."agents"
  WHERE ("agents"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own web search keys" ON "public"."user_web_search_keys" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert documents for their own agents" ON "public"."datastore_documents" FOR INSERT WITH CHECK (("agent_id" IN ( SELECT "agents"."id"
   FROM "public"."agents"
  WHERE ("agents"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own SSH keys" ON "public"."user_ssh_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own gmail operation logs" ON "public"."gmail_operation_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own mailgun configurations" ON "public"."mailgun_configurations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own mailgun routes" ON "public"."mailgun_routes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mailgun_configurations"
  WHERE (("mailgun_configurations"."id" = "mailgun_routes"."mailgun_config_id") AND ("mailgun_configurations"."user_id" = "auth"."uid"())))));



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



CREATE POLICY "Users can manage memories for their agents" ON "public"."agent_memories" USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_memories"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



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



CREATE POLICY "Users can manage their agents' OAuth permissions" ON "public"."agent_oauth_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "agent_oauth_permissions"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their agents' email addresses" ON "public"."agent_email_addresses" USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their agents' permissions" ON "public"."agent_sendgrid_permissions" USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own OAuth connections" ON "public"."user_oauth_connections" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own SendGrid configs" ON "public"."sendgrid_configurations" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own account tool environment" ON "public"."account_tool_environments" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own task event triggers" ON "public"."agent_task_event_triggers" USING ((EXISTS ( SELECT 1
   FROM "public"."agent_tasks"
  WHERE (("agent_tasks"."id" = "agent_task_event_triggers"."task_id") AND ("agent_tasks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their routing rules" ON "public"."sendgrid_inbound_routing_rules" USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their templates" ON "public"."sendgrid_templates" USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



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



CREATE POLICY "Users can manage web search permissions for their agents" ON "public"."agent_web_search_permissions" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can only access their own integration connections" ON "public"."user_integrations" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own datastores" ON "public"."datastores" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own SSH keys" ON "public"."user_ssh_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own datastores" ON "public"."datastores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own mailgun configurations" ON "public"."mailgun_configurations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own mailgun routes" ON "public"."mailgun_routes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."mailgun_configurations"
  WHERE (("mailgun_configurations"."id" = "mailgun_routes"."mailgun_config_id") AND ("mailgun_configurations"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mailgun_configurations"
  WHERE (("mailgun_configurations"."id" = "mailgun_routes"."mailgun_config_id") AND ("mailgun_configurations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own OAuth connections" ON "public"."user_oauth_connections" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own agent tasks" ON "public"."agent_tasks" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own datastore documents" ON "public"."datastore_documents" FOR UPDATE USING (("agent_id" IN ( SELECT "agents"."id"
   FROM "public"."agents"
  WHERE ("agents"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own web search keys" ON "public"."user_web_search_keys" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view email logs for their agents" ON "public"."email_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agents"
  WHERE (("agents"."id" = "email_logs"."agent_id") AND ("agents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view logs for their agents" ON "public"."web_search_operation_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view memberships in their organizations" ON "public"."organization_memberships" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("organization_id" IN ( SELECT "organization_memberships_1"."organization_id"
   FROM "public"."organization_memberships" "organization_memberships_1"
  WHERE (("organization_memberships_1"."user_id" = "auth"."uid"()) AND ("organization_memberships_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("organization_memberships_1"."status" = 'active'::"text"))))));



CREATE POLICY "Users can view organizations they are members of" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "organization_memberships"."organization_id"
   FROM "public"."organization_memberships"
  WHERE (("organization_memberships"."user_id" = "auth"."uid"()) AND ("organization_memberships"."status" = 'active'::"text")))));



CREATE POLICY "Users can view own SSH keys" ON "public"."user_ssh_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own email logs" ON "public"."email_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own gmail operation logs" ON "public"."gmail_operation_logs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own mailgun configurations" ON "public"."mailgun_configurations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own mailgun routes" ON "public"."mailgun_routes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."mailgun_configurations"
  WHERE (("mailgun_configurations"."id" = "mailgun_routes"."mailgun_config_id") AND ("mailgun_configurations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their agents' email addresses" ON "public"."agent_email_addresses" FOR SELECT USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their agents' permissions" ON "public"."agent_sendgrid_permissions" FOR SELECT USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their inbound emails" ON "public"."sendgrid_inbound_emails" FOR SELECT USING (("sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
   FROM "public"."sendgrid_configurations"
  WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own OAuth connections" ON "public"."user_oauth_connections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own agent tasks" ON "public"."agent_tasks" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own datastore documents" ON "public"."datastore_documents" FOR SELECT USING (("agent_id" IN ( SELECT "agents"."id"
   FROM "public"."agents"
  WHERE ("agents"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own logs" ON "public"."sendgrid_operation_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own messages" ON "public"."chat_messages_v2" FOR SELECT USING (("auth"."uid"() = "sender_user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own task event triggers" ON "public"."agent_task_event_triggers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agent_tasks"
  WHERE (("agent_tasks"."id" = "agent_task_event_triggers"."task_id") AND ("agent_tasks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own task executions" ON "public"."agent_task_executions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agent_tasks"
  WHERE (("agent_tasks"."id" = "agent_task_executions"."task_id") AND ("agent_tasks"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own tool execution logs" ON "public"."tool_execution_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own web search keys" ON "public"."user_web_search_keys" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their routing logs" ON "public"."sendgrid_inbound_routing_logs" FOR SELECT USING (("email_id" IN ( SELECT "sendgrid_inbound_emails"."id"
   FROM "public"."sendgrid_inbound_emails"
  WHERE ("sendgrid_inbound_emails"."sendgrid_config_id" IN ( SELECT "sendgrid_configurations"."id"
           FROM "public"."sendgrid_configurations"
          WHERE ("sendgrid_configurations"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view web search permissions for their agents" ON "public"."agent_web_search_permissions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Web search providers are readable by authenticated users" ON "public"."web_search_providers" FOR SELECT TO "authenticated" USING (("is_enabled" = true));



ALTER TABLE "public"."account_tool_environments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."account_tool_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_operation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_datastores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_email_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_oauth_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_sendgrid_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_task_event_triggers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_task_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_capability_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tool_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_toolbelt_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_toolbox_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_web_search_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."context_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."context_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."datastore_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."datastores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_operation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mailgun_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mailgun_routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_consolidations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sendgrid_configurations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sendgrid_inbound_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sendgrid_inbound_routing_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sendgrid_inbound_routing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sendgrid_operation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sendgrid_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tool_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tool_execution_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_oauth_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ssh_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_team_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_web_search_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."web_search_operation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."web_search_providers" ENABLE ROW LEVEL SECURITY;


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



GRANT ALL ON FUNCTION "public"."calculate_next_run_time"("cron_expr" "text", "timezone_name" "text", "from_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_next_run_time"("cron_expr" "text", "timezone_name" "text", "from_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_next_run_time"("cron_expr" "text", "timezone_name" "text", "from_time" timestamp with time zone) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."create_routing_rule"("p_name" "text", "p_description" "text", "p_agent_id" "uuid", "p_conditions" "jsonb", "p_action" "jsonb", "p_priority" integer, "p_stop_processing" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_routing_rule"("p_name" "text", "p_description" "text", "p_agent_id" "uuid", "p_conditions" "jsonb", "p_action" "jsonb", "p_priority" integer, "p_stop_processing" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_routing_rule"("p_name" "text", "p_description" "text", "p_agent_id" "uuid", "p_conditions" "jsonb", "p_action" "jsonb", "p_priority" integer, "p_stop_processing" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_vault_secret"("secret_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_organization_api_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_organization_api_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_organization_api_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_integration_permissions"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_integration_permissions"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_integration_permissions"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_oauth_permissions"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_web_search_permissions"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_web_search_permissions"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_web_search_permissions"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_messages_with_details"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_gmail_connection_by_id"("p_connection_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_gmail_connection_by_id"("p_connection_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gmail_connection_by_id"("p_connection_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_gmail_connection_with_tokens"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_gmail_connection_with_tokens"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gmail_connection_with_tokens"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_gmail_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_gmail_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gmail_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_integration_categories_with_counts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_integration_categories_with_counts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_integration_categories_with_counts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_integrations_by_category"("p_category_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_integrations_by_category"("p_category_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_integrations_by_category"("p_category_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_claim"("claim_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_room_members"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_secret"("secret_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_secret"("secret_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_secret"("secret_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_secret"("secret_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_secret"("secret_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_secret"("secret_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sendgrid_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sendgrid_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sendgrid_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_chat_rooms"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_gmail_connections"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_gmail_connections"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_gmail_connections"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_inbound_emails"("p_user_id" "uuid", "p_agent_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_inbound_emails"("p_user_id" "uuid", "p_agent_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_inbound_emails"("p_user_id" "uuid", "p_agent_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_integration_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_integration_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_integration_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_mailgun_config"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_mailgun_config"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_mailgun_config"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_mailgun_routes"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_mailgun_routes"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_mailgun_routes"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_oauth_connections"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_role"("user_id" "uuid", "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_web_search_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_web_search_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_web_search_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vault_secrets_by_names"("p_secret_names" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_vault_secrets_by_names"("p_secret_names" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vault_secrets_by_names"("p_secret_names" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_web_search_api_key"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_web_search_api_key"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_web_search_api_key"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_web_search_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_web_search_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_web_search_tools"("p_agent_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_id_for_channel"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_members_with_details"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_agent_integration_permission"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_allowed_scopes" "jsonb", "p_permission_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_agent_integration_permission"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_allowed_scopes" "jsonb", "p_permission_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_agent_integration_permission"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_allowed_scopes" "jsonb", "p_permission_level" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_agent_oauth_access"("p_agent_id" "uuid", "p_connection_id" "uuid", "p_permission_level" "text", "p_allowed_scopes" "jsonb", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_agent_web_search_permission"("p_agent_id" "uuid", "p_user_key_id" "uuid", "p_permissions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_agent_web_search_permission"("p_agent_id" "uuid", "p_user_key_id" "uuid", "p_permissions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_agent_web_search_permission"("p_agent_id" "uuid", "p_user_key_id" "uuid", "p_permissions" "jsonb") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."increment_rule_match_count"("p_rule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_rule_match_count"("p_rule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_rule_match_count"("p_rule_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."log_email_activity"("p_mailgun_message_id" character varying, "p_agent_id" "uuid", "p_user_id" "uuid", "p_direction" "public"."email_direction_enum", "p_from_address" character varying, "p_to_address" character varying, "p_subject" "text", "p_status" character varying, "p_event_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_email_activity"("p_mailgun_message_id" character varying, "p_agent_id" "uuid", "p_user_id" "uuid", "p_direction" "public"."email_direction_enum", "p_from_address" character varying, "p_to_address" character varying, "p_subject" "text", "p_status" character varying, "p_event_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_email_activity"("p_mailgun_message_id" character varying, "p_agent_id" "uuid", "p_user_id" "uuid", "p_direction" "public"."email_direction_enum", "p_from_address" character varying, "p_to_address" character varying, "p_subject" "text", "p_status" character varying, "p_event_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_sendgrid_operation"("p_agent_id" "uuid", "p_user_id" "uuid", "p_operation_type" "text", "p_operation_params" "jsonb", "p_operation_result" "jsonb", "p_status" "text", "p_error_message" "text", "p_message_id" "text", "p_recipients_count" integer, "p_execution_time_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."log_sendgrid_operation"("p_agent_id" "uuid", "p_user_id" "uuid", "p_operation_type" "text", "p_operation_params" "jsonb", "p_operation_result" "jsonb", "p_status" "text", "p_error_message" "text", "p_message_id" "text", "p_recipients_count" integer, "p_execution_time_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_sendgrid_operation"("p_agent_id" "uuid", "p_user_id" "uuid", "p_operation_type" "text", "p_operation_params" "jsonb", "p_operation_result" "jsonb", "p_status" "text", "p_error_message" "text", "p_message_id" "text", "p_recipients_count" integer, "p_execution_time_ms" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_channel_messages"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_chat_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_chat_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_chat_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_agent_oauth_usage"("p_agent_id" "uuid", "p_connection_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_agent_integration_permission"("p_permission_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_agent_integration_permission"("p_permission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_agent_integration_permission"("p_permission_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_agent_web_search_permission"("p_agent_id" "uuid", "p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_agent_web_search_permission"("p_agent_id" "uuid", "p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_agent_web_search_permission"("p_agent_id" "uuid", "p_provider_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_chat_history"("p_channel_id" "uuid", "p_search_query" "text", "p_search_type" "text", "p_match_count" integer, "p_match_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_inbound_emails"("p_search_query" "text", "p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_inbound_emails"("p_search_query" "text", "p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_inbound_emails"("p_search_query" "text", "p_user_id" "uuid", "p_limit" integer) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."test_rpc"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_rpc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_rpc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_agent_web_search_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_agent_web_search_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_agent_web_search_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_channel_last_message_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_datastore_documents_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_datastore_documents_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_datastore_documents_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_memory_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_memory_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_memory_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_oauth_providers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_oauth_providers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_oauth_providers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sendgrid_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sendgrid_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sendgrid_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_last_active"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_last_active"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_last_active"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tool_execution_logs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tool_execution_logs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tool_execution_logs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_oauth_connections_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_oauth_connections_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_oauth_connections_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_web_search_keys_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_web_search_keys_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_web_search_keys_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vault_secret"("p_secret_id" "uuid", "p_new_secret" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_vault_secret"("p_secret_id" "uuid", "p_new_secret" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vault_secret"("p_secret_id" "uuid", "p_new_secret" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_web_search_providers_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_web_search_providers_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_web_search_providers_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_worker_status"("connection_id_in" "uuid", "new_status_in" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("user_id" "uuid", "role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_agent_gmail_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_required_scopes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_agent_gmail_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_required_scopes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_agent_gmail_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_required_scopes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_agent_sendgrid_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_agent_sendgrid_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_agent_sendgrid_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_organization_slug"("slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_organization_slug"("slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_organization_slug"("slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text", "p_required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text", "p_required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_web_search_permissions"("p_agent_id" "uuid", "p_user_id" "uuid", "p_provider_name" "text", "p_required_permission" "text") TO "service_role";



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



GRANT ALL ON TABLE "public"."admin_operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_operation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_datastores" TO "anon";
GRANT ALL ON TABLE "public"."agent_datastores" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_datastores" TO "service_role";



GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "anon";
GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_droplet_tools" TO "service_role";



GRANT ALL ON TABLE "public"."agent_droplets" TO "anon";
GRANT ALL ON TABLE "public"."agent_droplets" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_droplets" TO "service_role";



GRANT ALL ON TABLE "public"."agent_email_addresses" TO "anon";
GRANT ALL ON TABLE "public"."agent_email_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_email_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."agent_memories" TO "anon";
GRANT ALL ON TABLE "public"."agent_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_memories" TO "service_role";



GRANT ALL ON TABLE "public"."agent_oauth_permissions" TO "anon";
GRANT ALL ON TABLE "public"."agent_oauth_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_oauth_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_sendgrid_permissions" TO "anon";
GRANT ALL ON TABLE "public"."agent_sendgrid_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_sendgrid_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_task_event_triggers" TO "anon";
GRANT ALL ON TABLE "public"."agent_task_event_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_task_event_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."agent_task_executions" TO "anon";
GRANT ALL ON TABLE "public"."agent_task_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_task_executions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tasks" TO "anon";
GRANT ALL ON TABLE "public"."agent_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tasks" TO "service_role";



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



GRANT ALL ON TABLE "public"."agent_web_search_permissions" TO "anon";
GRANT ALL ON TABLE "public"."agent_web_search_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_web_search_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages_v2" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages_v2" TO "service_role";



GRANT ALL ON TABLE "public"."context_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."context_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."context_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."context_templates" TO "anon";
GRANT ALL ON TABLE "public"."context_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."context_templates" TO "service_role";



GRANT ALL ON TABLE "public"."datastore_documents" TO "anon";
GRANT ALL ON TABLE "public"."datastore_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."datastore_documents" TO "service_role";



GRANT ALL ON TABLE "public"."datastores" TO "anon";
GRANT ALL ON TABLE "public"."datastores" TO "authenticated";
GRANT ALL ON TABLE "public"."datastores" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_configurations" TO "anon";
GRANT ALL ON TABLE "public"."gmail_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."gmail_operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_operation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."integration_categories" TO "anon";
GRANT ALL ON TABLE "public"."integration_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_categories" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."mailgun_configurations" TO "anon";
GRANT ALL ON TABLE "public"."mailgun_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."mailgun_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."mailgun_routes" TO "anon";
GRANT ALL ON TABLE "public"."mailgun_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."mailgun_routes" TO "service_role";



GRANT ALL ON TABLE "public"."memory_consolidations" TO "anon";
GRANT ALL ON TABLE "public"."memory_consolidations" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_consolidations" TO "service_role";



GRANT ALL ON TABLE "public"."message_versions" TO "anon";
GRANT ALL ON TABLE "public"."message_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_versions" TO "service_role";



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



GRANT ALL ON TABLE "public"."sendgrid_configurations" TO "anon";
GRANT ALL ON TABLE "public"."sendgrid_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."sendgrid_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."sendgrid_inbound_emails" TO "anon";
GRANT ALL ON TABLE "public"."sendgrid_inbound_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."sendgrid_inbound_emails" TO "service_role";



GRANT ALL ON TABLE "public"."sendgrid_inbound_routing_logs" TO "anon";
GRANT ALL ON TABLE "public"."sendgrid_inbound_routing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sendgrid_inbound_routing_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sendgrid_inbound_routing_rules" TO "anon";
GRANT ALL ON TABLE "public"."sendgrid_inbound_routing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."sendgrid_inbound_routing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."sendgrid_operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."sendgrid_operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sendgrid_operation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sendgrid_templates" TO "anon";
GRANT ALL ON TABLE "public"."sendgrid_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."sendgrid_templates" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."tool_catalog" TO "anon";
GRANT ALL ON TABLE "public"."tool_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."tool_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."tool_execution_logs" TO "anon";
GRANT ALL ON TABLE "public"."tool_execution_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."tool_execution_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_integrations" TO "anon";
GRANT ALL ON TABLE "public"."user_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_integrations" TO "service_role";



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



GRANT ALL ON TABLE "public"."user_web_search_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_web_search_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_web_search_keys" TO "service_role";



GRANT ALL ON TABLE "public"."web_search_operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."web_search_operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."web_search_operation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."web_search_providers" TO "anon";
GRANT ALL ON TABLE "public"."web_search_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."web_search_providers" TO "service_role";



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
