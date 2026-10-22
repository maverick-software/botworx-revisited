-- Migration: Add credential type differentiation to user_oauth_connections
-- Purpose: Differentiate between OAuth tokens and API keys for proper UI handling
-- Date: 2025-08-03

-- Create enum for credential types
CREATE TYPE "public"."connection_credential_type_enum" AS ENUM (
    'oauth', 
    'api_key'
);

-- Add credential_type column to user_oauth_connections table
ALTER TABLE "public"."user_oauth_connections" 
ADD COLUMN "credential_type" "public"."connection_credential_type_enum" DEFAULT 'oauth'::connection_credential_type_enum NOT NULL;

-- Update existing records based on provider type
-- API key based providers (web search providers)
UPDATE "public"."user_oauth_connections" 
SET "credential_type" = 'api_key'::connection_credential_type_enum
WHERE "oauth_provider_id" IN (
    SELECT id FROM "public"."service_providers" 
    WHERE name IN ('serper_api', 'serpapi', 'brave_search', 'serper', 'serp_api')
);

-- OAuth based providers (traditional OAuth providers)
UPDATE "public"."user_oauth_connections" 
SET "credential_type" = 'oauth'::connection_credential_type_enum
WHERE "oauth_provider_id" IN (
    SELECT id FROM "public"."service_providers" 
    WHERE name IN ('google', 'gmail', 'github', 'microsoft', 'slack', 'discord')
);

-- Modify constraints to handle different credential types
-- Remove the old token consistency constraint
ALTER TABLE "public"."user_oauth_connections" 
DROP CONSTRAINT IF EXISTS "chk_oauth_token_consistency";

-- First, let's see what records might violate the constraint and fix them
-- Set any records with null vault_access_token_id to 'error' status if they're active
UPDATE "public"."user_oauth_connections" 
SET connection_status = 'error'
WHERE connection_status = 'active' AND vault_access_token_id IS NULL;

-- Add new constraint that allows API keys to not have refresh tokens
ALTER TABLE "public"."user_oauth_connections" 
ADD CONSTRAINT "chk_credential_type_consistency" CHECK (
    (
        -- For OAuth connections, access token is required when active
        (credential_type = 'oauth' AND connection_status = 'active' AND vault_access_token_id IS NOT NULL)
        OR
        -- For API key connections, access token is required when active, refresh token not needed
        (credential_type = 'api_key' AND connection_status = 'active' AND vault_access_token_id IS NOT NULL)
        OR
        -- For any non-active connections, no token requirements
        (connection_status != 'active')
    )
);

-- Update table comment
COMMENT ON TABLE "public"."user_oauth_connections" IS 'User-specific OAuth and API key connections with credential storage';

-- Add column comment
COMMENT ON COLUMN "public"."user_oauth_connections"."credential_type" IS 'Type of credential: oauth (supports refresh) or api_key (long-lived, no refresh)';

-- Create index for credential type filtering
CREATE INDEX IF NOT EXISTS "idx_user_oauth_connections_credential_type" 
ON "public"."user_oauth_connections" USING "btree" ("credential_type", "connection_status");

-- Update the get_user_oauth_connections function to include credential_type
DROP FUNCTION IF EXISTS public.get_user_oauth_connections(UUID);

CREATE OR REPLACE FUNCTION public.get_user_oauth_connections(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    connection_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    external_username TEXT,
    connection_name TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    credential_type TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE uoc.user_id = p_user_id
    ORDER BY uoc.created_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_oauth_connections(UUID) TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_user_oauth_connections(UUID) IS 'Get all OAuth and API key connections for a user, including credential type';