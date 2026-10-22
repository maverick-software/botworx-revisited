-- Migration: 20250720130000_fix_token_expiry_calculation.sql
-- Purpose: Modify OAuth functions to calculate expiry inside the database to avoid clock skew.

-- PHASE 1: Update store_oauth_token function
CREATE OR REPLACE FUNCTION public.store_oauth_token(
    p_user_id UUID,
    p_provider TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT DEFAULT NULL,
    p_expires_in INTEGER DEFAULT 3599, -- Google default is 3599 seconds
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
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;

    -- Calculate expires_at inside the database
    v_expires_at := now() + (p_expires_in * '1 second'::interval);

    -- Revoke any existing active tokens for this user/provider combination
    UPDATE public.user_oauth_tokens
    SET revoked_at = now(), updated_at = now()
    WHERE user_id = p_user_id AND provider = p_provider AND revoked_at IS NULL;

    -- Store tokens in vault... (rest of the function is the same)
    v_secret_name := format('oauth_access_%s_%s_%s', p_provider, p_user_id, extract(epoch from now()));
    SELECT vault.create_secret(p_access_token, v_secret_name, 'Access Token') INTO v_access_token_id;

    IF p_refresh_token IS NOT NULL THEN
        v_secret_name := format('oauth_refresh_%s_%s_%s', p_provider, p_user_id, extract(epoch from now()));
        SELECT vault.create_secret(p_refresh_token, v_secret_name, 'Refresh Token') INTO v_refresh_token_id;
    END IF;

    INSERT INTO public.user_oauth_tokens (
        user_id, provider, vault_access_token_id, vault_refresh_token_id, expires_at, scopes_granted
    ) VALUES (
        p_user_id, p_provider, v_access_token_id, v_refresh_token_id, v_expires_at, p_scopes_granted
    ) RETURNING id INTO v_record_id;

    RETURN v_record_id;
END;
$$;

-- PHASE 2: Update update_oauth_token function
CREATE OR REPLACE FUNCTION public.update_oauth_token(
    p_user_id UUID,
    p_provider TEXT,
    p_new_access_token TEXT,
    p_new_refresh_token TEXT DEFAULT NULL,
    p_new_expires_in INTEGER DEFAULT 3599
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
    v_new_expires_at TIMESTAMPTZ;
BEGIN
    -- Validate service role access
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: This function requires service role access';
    END IF;
    
    -- Calculate new expires_at inside the database
    v_new_expires_at := now() + (p_new_expires_in * '1 second'::interval);

    -- Get current token record
    SELECT id, vault_access_token_id, vault_refresh_token_id
    INTO v_current_record
    FROM public.user_oauth_tokens
    WHERE user_id = p_user_id AND provider = p_provider AND revoked_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active token found to update';
    END IF;

    -- Store new tokens... (rest of the function is the same)
    v_secret_name := format('oauth_access_%s_%s_%s_refreshed', p_provider, p_user_id, extract(epoch from now()));
    SELECT vault.create_secret(p_new_access_token, v_secret_name, 'Refreshed Access Token') INTO v_new_access_token_id;

    IF p_new_refresh_token IS NOT NULL THEN
        v_secret_name := format('oauth_refresh_%s_%s_%s_refreshed', p_provider, p_user_id, extract(epoch from now()));
        SELECT vault.create_secret(p_new_refresh_token, v_secret_name, 'Refreshed Refresh Token') INTO v_new_refresh_token_id;
    ELSE
        v_new_refresh_token_id := v_current_record.vault_refresh_token_id;
    END IF;

    UPDATE public.user_oauth_tokens
    SET vault_access_token_id = v_new_access_token_id,
        vault_refresh_token_id = v_new_refresh_token_id,
        expires_at = v_new_expires_at,
        updated_at = now()
    WHERE id = v_current_record.id;

    -- Clean up old tokens...
    DELETE FROM vault.secrets WHERE id = v_current_record.vault_access_token_id;
    IF p_new_refresh_token IS NOT NULL AND v_current_record.vault_refresh_token_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_current_record.vault_refresh_token_id;
    END IF;

    RETURN v_current_record.id;
END;
$$; 