-- Migration: 20250720120000_fix_get_oauth_token_expiry.sql
-- Purpose: Fix the get_oauth_token function to correctly check for token expiry.

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

    -- Get token metadata, ensuring it is not expired
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
      AND (t.expires_at IS NULL OR t.expires_at > now()) -- FIX: Ensure token is not expired
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No valid, non-expired token found for user % and provider %', p_user_id, p_provider;
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

COMMENT ON FUNCTION public.get_oauth_token IS 'Retrieve and decrypt non-expired OAuth tokens from Supabase Vault'; 