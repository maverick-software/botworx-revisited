-- Create functions to properly manage encryption keys for vault
-- This will help us understand and fix the vault encryption issue

BEGIN;

-- Function to create a new encryption key
CREATE OR REPLACE FUNCTION public.create_encryption_key(key_name TEXT DEFAULT NULL)
RETURNS UUID AS $$
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
    SELECT pgsodium.create_key(name := final_key_name) INTO new_key_id;
    
    RETURN new_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list available keys
CREATE OR REPLACE FUNCTION public.list_encryption_keys()
RETURNS TABLE(
    key_id UUID,
    key_name TEXT,
    key_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to encrypt data with a specific key
CREATE OR REPLACE FUNCTION public.encrypt_with_key(
    plain_text TEXT,
    key_id UUID
)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt data with a specific key
CREATE OR REPLACE FUNCTION public.decrypt_with_key(
    encrypted_text TEXT,
    key_id UUID
)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to test the vault system
CREATE OR REPLACE FUNCTION public.test_vault_system()
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_encryption_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_encryption_keys() TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_with_key(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_with_key(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.test_vault_system() TO service_role;

COMMIT;
