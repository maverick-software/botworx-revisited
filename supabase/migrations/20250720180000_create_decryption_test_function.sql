-- Migration: 20250720180000_create_decryption_test_function.sql
-- Purpose: Create a simple test function to isolate and diagnose the decryption issue.

CREATE OR REPLACE FUNCTION public.test_decrypt_latest_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_latest_secret_id UUID;
    v_decrypted_token TEXT;
BEGIN
    -- Step 1: Find the UUID of the most recent 'gmail' access token secret.
    RAISE NOTICE 'Finding the latest gmail access token secret ID...';
    
    SELECT vault_access_token_id
    INTO v_latest_secret_id
    FROM public.user_oauth_tokens
    WHERE provider = 'gmail'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test failed: No token records found in user_oauth_tokens.';
    END IF;

    RAISE NOTICE 'Found secret ID: %', v_latest_secret_id;

    -- Step 2: Attempt to decrypt this specific secret directly.
    RAISE NOTICE 'Attempting to decrypt secret ID % directly...', v_latest_secret_id;

    SELECT decrypted_secret
    INTO v_decrypted_token
    FROM vault.decrypted_secrets
    WHERE id = v_latest_secret_id;

    IF NOT FOUND THEN
        -- This is where the pgsodium error likely happens if decryption fails.
        RAISE EXCEPTION 'Test failed: Secret with ID % not found in vault.decrypted_secrets, or decryption failed.', v_latest_secret_id;
    END IF;

    RAISE NOTICE 'Decryption successful!';

    -- Step 3: Return a success message with part of the token.
    RETURN 'Decryption successful. Token starts with: ' || left(v_decrypted_token, 10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_decrypt_latest_token() TO service_role;

COMMENT ON FUNCTION public.test_decrypt_latest_token() IS 'A diagnostic function to test the core decryption functionality of the Vault.'; 