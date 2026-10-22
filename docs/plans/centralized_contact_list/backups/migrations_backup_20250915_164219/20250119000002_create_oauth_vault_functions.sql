-- Secure OAuth Token Management Functions using Supabase Vault
-- Migration: 20250119000002_create_oauth_vault_functions.sql
-- Purpose: Create secure wrapper functions for OAuth token storage/retrieval

-- PHASE 1: OAuth Token Storage Function
CREATE OR REPLACE FUNCTION public.store_oauth_token(
    p_user_id UUID,
    p_provider TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_scopes_granted JSONB DEFAULT '[]'::jsonb
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_access_token_id UUID;
    v_refresh_token_id UUID;
    v_secret_name TEXT;
    v_record_id UUID;
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;

    -- Validate inputs
    IF p_user_id IS NULL OR p_provider IS NULL OR p_access_token IS NULL THEN
        RAISE EXCEPTION 'Missing required parameters';
    END IF;

    -- Revoke any existing active tokens for this user/provider combination
    UPDATE public.user_oauth_tokens
    SET revoked_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id 
      AND provider = p_provider 
      AND revoked_at IS NULL;

    -- Store access token in vault using correct Supabase Vault API
    v_secret_name := format('oauth_access_%s_%s_%s', p_provider, p_user_id, extract(epoch from now()));
    
    SELECT vault.create_secret(
        p_access_token,
        v_secret_name,
        format('OAuth access token for user %s provider %s', p_user_id, p_provider)
    ) INTO v_access_token_id;

    -- Store refresh token if provided
    IF p_refresh_token IS NOT NULL THEN
        v_secret_name := format('oauth_refresh_%s_%s_%s', p_provider, p_user_id, extract(epoch from now()));
        
        SELECT vault.create_secret(
            p_refresh_token,
            v_secret_name,
            format('OAuth refresh token for user %s provider %s', p_user_id, p_provider)
        ) INTO v_refresh_token_id;
    END IF;

    -- Store token metadata
    INSERT INTO public.user_oauth_tokens (
        user_id,
        provider,
        vault_access_token_id,
        vault_refresh_token_id,
        expires_at,
        scopes_granted,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_provider,
        v_access_token_id,
        v_refresh_token_id,
        p_expires_at,
        p_scopes_granted,
        now(),
        now()
    ) RETURNING id INTO v_record_id;

    -- Log the token storage (for audit purposes)
    RAISE NOTICE 'Stored OAuth token for user % provider % with record ID %', p_user_id, p_provider, v_record_id;

    RETURN v_record_id;
END;
$$;

-- PHASE 2: OAuth Token Retrieval Function
CREATE OR REPLACE FUNCTION public.get_oauth_token(
    p_user_id UUID,
    p_provider TEXT
) 
RETURNS TABLE(
    record_id UUID,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    scopes_granted JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_token_record RECORD;
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;

    -- Get token metadata
    SELECT 
        t.id,
        t.vault_access_token_id,
        t.vault_refresh_token_id,
        t.expires_at,
        t.scopes_granted,
        t.created_at
    INTO v_token_record
    FROM public.user_oauth_tokens t
    WHERE t.user_id = p_user_id 
      AND t.provider = p_provider
      AND t.revoked_at IS NULL
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No valid token found for user % and provider %', p_user_id, p_provider;
    END IF;

    -- Return decrypted tokens using correct Vault decrypted_secrets view
    RETURN QUERY
    SELECT
        v_token_record.id,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_token_record.vault_access_token_id),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_token_record.vault_refresh_token_id),
        v_token_record.expires_at,
        v_token_record.scopes_granted,
        v_token_record.created_at;
END;
$$;

-- PHASE 3: OAuth Token Revocation Function
CREATE OR REPLACE FUNCTION public.revoke_oauth_token(
    p_user_id UUID,
    p_provider TEXT
) 
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_token_ids UUID[];
    v_affected_count INTEGER;
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;

    -- Get vault secret IDs to delete
    SELECT ARRAY_AGG(vault_access_token_id) || 
           ARRAY_AGG(vault_refresh_token_id) FILTER (WHERE vault_refresh_token_id IS NOT NULL)
    INTO v_token_ids
    FROM public.user_oauth_tokens
    WHERE user_id = p_user_id 
      AND provider = p_provider
      AND revoked_at IS NULL;

    IF v_token_ids IS NULL OR array_length(v_token_ids, 1) = 0 THEN
        RETURN FALSE;
    END IF;

    -- Mark as revoked in metadata table
    UPDATE public.user_oauth_tokens
    SET revoked_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id 
      AND provider = p_provider
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    -- Delete from vault (secure erasure)
    DELETE FROM vault.secrets 
    WHERE id = ANY(v_token_ids);

    RAISE NOTICE 'Revoked % OAuth token records for user % provider %', v_affected_count, p_user_id, p_provider;

    RETURN v_affected_count > 0;
END;
$$;

-- PHASE 4: Token Refresh and Update Function
CREATE OR REPLACE FUNCTION public.update_oauth_token(
    p_user_id UUID,
    p_provider TEXT,
    p_new_access_token TEXT,
    p_new_refresh_token TEXT DEFAULT NULL,
    p_new_expires_at TIMESTAMPTZ DEFAULT NULL
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_current_record RECORD;
    v_new_access_token_id UUID;
    v_new_refresh_token_id UUID;
    v_secret_name TEXT;
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;

    -- Get current token record
    SELECT 
        id,
        vault_access_token_id,
        vault_refresh_token_id,
        scopes_granted
    INTO v_current_record
    FROM public.user_oauth_tokens
    WHERE user_id = p_user_id 
      AND provider = p_provider
      AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active token found to update for user % provider %', p_user_id, p_provider;
    END IF;

    -- Store new access token using correct Vault API
    v_secret_name := format('oauth_access_%s_%s_%s_refreshed', p_provider, p_user_id, extract(epoch from now()));
    
    SELECT vault.create_secret(
        p_new_access_token,
        v_secret_name,
        format('Refreshed OAuth access token for user %s provider %s', p_user_id, p_provider)
    ) INTO v_new_access_token_id;

    -- Store new refresh token if provided
    IF p_new_refresh_token IS NOT NULL THEN
        v_secret_name := format('oauth_refresh_%s_%s_%s_refreshed', p_provider, p_user_id, extract(epoch from now()));
        
        SELECT vault.create_secret(
            p_new_refresh_token,
            v_secret_name,
            format('Refreshed OAuth refresh token for user %s provider %s', p_user_id, p_provider)
        ) INTO v_new_refresh_token_id;
    ELSE
        -- Keep existing refresh token ID if no new one provided
        v_new_refresh_token_id := v_current_record.vault_refresh_token_id;
    END IF;

    -- Update the existing record
    UPDATE public.user_oauth_tokens
    SET vault_access_token_id = v_new_access_token_id,
        vault_refresh_token_id = v_new_refresh_token_id,
        expires_at = p_new_expires_at,
        updated_at = now()
    WHERE id = v_current_record.id;

    -- Delete old access token from vault
    DELETE FROM vault.secrets WHERE id = v_current_record.vault_access_token_id;
    
    -- Delete old refresh token if we have a new one
    IF p_new_refresh_token IS NOT NULL AND v_current_record.vault_refresh_token_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_current_record.vault_refresh_token_id;
    END IF;

    RAISE NOTICE 'Updated OAuth token for user % provider %', p_user_id, p_provider;

    RETURN v_current_record.id;
END;
$$;

-- PHASE 5: Cleanup Function for Expired Tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count INTEGER;
    expired_vault_ids UUID[];
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;

    -- Get vault IDs from expired tokens
    SELECT ARRAY_AGG(vault_access_token_id) || 
           ARRAY_AGG(vault_refresh_token_id) FILTER (WHERE vault_refresh_token_id IS NOT NULL)
    INTO expired_vault_ids
    FROM public.user_oauth_tokens
    WHERE expires_at < now() - INTERVAL '1 day'
      AND revoked_at IS NULL;

    IF expired_vault_ids IS NULL OR array_length(expired_vault_ids, 1) = 0 THEN
        RETURN 0;
    END IF;

    -- Mark as revoked
    UPDATE public.user_oauth_tokens
    SET revoked_at = now(),
        updated_at = now()
    WHERE expires_at < now() - INTERVAL '1 day'
      AND revoked_at IS NULL;

    GET DIAGNOSTICS cleanup_count = ROW_COUNT;

    -- Delete from vault
    DELETE FROM vault.secrets
    WHERE id = ANY(expired_vault_ids);

    RAISE NOTICE 'Cleaned up % expired OAuth token records', cleanup_count;

    RETURN cleanup_count;
END;
$$;

-- PHASE 6: Function Permissions
-- Revoke public access to all functions
REVOKE ALL ON FUNCTION public.store_oauth_token FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_oauth_token FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_oauth_token FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_oauth_token FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_oauth_tokens FROM PUBLIC;

-- Grant execute only to service role
GRANT EXECUTE ON FUNCTION public.store_oauth_token TO service_role;
GRANT EXECUTE ON FUNCTION public.get_oauth_token TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_oauth_token TO service_role;
GRANT EXECUTE ON FUNCTION public.update_oauth_token TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_tokens TO service_role;

-- Add function documentation
COMMENT ON FUNCTION public.store_oauth_token IS 'Securely store OAuth tokens using Supabase Vault encryption';
COMMENT ON FUNCTION public.get_oauth_token IS 'Retrieve and decrypt OAuth tokens from Supabase Vault';
COMMENT ON FUNCTION public.revoke_oauth_token IS 'Revoke and securely delete OAuth tokens from Vault';
COMMENT ON FUNCTION public.update_oauth_token IS 'Update OAuth tokens with new values after refresh';
COMMENT ON FUNCTION public.cleanup_expired_oauth_tokens IS 'Clean up expired OAuth tokens from the system';

DO $$
BEGIN
    RAISE NOTICE 'OAuth Vault functions created successfully';
END $$; 