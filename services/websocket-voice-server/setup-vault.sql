-- Supabase Vault Setup for WebSocket Voice Server
-- Run this in your Supabase SQL Editor

-- 1. Create vault secret creation function (if not exists)
CREATE OR REPLACE FUNCTION public.create_vault_secret(
  p_secret TEXT,
  p_name TEXT, 
  p_description TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Only service role can create vault secrets
  IF current_setting('role') != 'service_role' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to create vault secrets';
  END IF;
  
  -- Create secret in vault
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO secret_id;
  
  RETURN secret_id::TEXT;
END;
$$;

-- 2. Create vault decryption function (if not exists)
CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
BEGIN
    -- Only service role can decrypt
    IF current_setting('role') != 'service_role' AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to decrypt vault secrets';
    END IF;

    -- Validate UUID format
    BEGIN
        uuid_id := vault_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;

    -- Decrypt from vault
    BEGIN
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE id = uuid_id
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        decrypted_value := NULL;
    END;

    RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create table for server configuration secrets
CREATE TABLE IF NOT EXISTS public.server_configuration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name TEXT NOT NULL UNIQUE,
  vault_supabase_service_key_id TEXT, -- Vault UUID for Supabase service role key
  vault_admin_password_id TEXT,       -- Vault UUID for admin password
  configuration_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Ensure vault IDs are valid UUIDs
  CONSTRAINT chk_vault_uuids CHECK (
    (vault_supabase_service_key_id IS NULL OR 
     vault_supabase_service_key_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AND
    (vault_admin_password_id IS NULL OR
     vault_admin_password_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_vault_secret TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_decrypt TO service_role;
GRANT ALL ON TABLE public.server_configuration_secrets TO service_role;

-- 5. Create function to initialize server secrets
CREATE OR REPLACE FUNCTION public.initialize_websocket_server_secrets(
  p_server_name TEXT,
  p_supabase_service_key TEXT,
  p_admin_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_key_vault_id TEXT;
  v_admin_pass_vault_id TEXT;
  v_result JSONB;
BEGIN
  -- Only service role can initialize secrets
  IF current_setting('role') != 'service_role' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to initialize server secrets';
  END IF;

  -- Store Supabase service key in vault
  SELECT public.create_vault_secret(
    p_supabase_service_key,
    p_server_name || '_supabase_service_key',
    'Supabase service role key for ' || p_server_name
  ) INTO v_supabase_key_vault_id;

  -- Store admin password in vault
  SELECT public.create_vault_secret(
    p_admin_password,
    p_server_name || '_admin_password',
    'Admin password for ' || p_server_name
  ) INTO v_admin_pass_vault_id;

  -- Insert or update server configuration
  INSERT INTO public.server_configuration_secrets (
    server_name,
    vault_supabase_service_key_id,
    vault_admin_password_id,
    configuration_metadata
  ) VALUES (
    p_server_name,
    v_supabase_key_vault_id,
    v_admin_pass_vault_id,
    jsonb_build_object(
      'initialized_at', now(),
      'initialized_by', current_user
    )
  )
  ON CONFLICT (server_name) DO UPDATE SET
    vault_supabase_service_key_id = v_supabase_key_vault_id,
    vault_admin_password_id = v_admin_pass_vault_id,
    updated_at = now();

  -- Return the vault IDs
  v_result := jsonb_build_object(
    'server_name', p_server_name,
    'vault_supabase_service_key_id', v_supabase_key_vault_id,
    'vault_admin_password_id', v_admin_pass_vault_id,
    'status', 'success'
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initialize_websocket_server_secrets TO service_role;

-- 6. Create function to retrieve server secrets
CREATE OR REPLACE FUNCTION public.get_websocket_server_secrets(p_server_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_supabase_key TEXT;
  v_admin_password TEXT;
  v_result JSONB;
BEGIN
  -- Only service role can retrieve secrets
  IF current_setting('role') != 'service_role' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to retrieve server secrets';
  END IF;

  -- Get the configuration
  SELECT * INTO v_config
  FROM public.server_configuration_secrets
  WHERE server_name = p_server_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Server configuration not found: %', p_server_name;
  END IF;

  -- Decrypt the secrets
  SELECT public.vault_decrypt(v_config.vault_supabase_service_key_id) INTO v_supabase_key;
  SELECT public.vault_decrypt(v_config.vault_admin_password_id) INTO v_admin_password;

  -- Return decrypted secrets
  v_result := jsonb_build_object(
    'SUPABASE_SERVICE_ROLE_KEY', v_supabase_key,
    'ADMIN_PASSWORD', v_admin_password
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_websocket_server_secrets TO service_role;

-- 7. Example usage (commented out - uncomment and run with your actual values)
/*
SELECT public.initialize_websocket_server_secrets(
  'voice-websocket-server',
  'your-actual-supabase-service-role-key-here',
  'your-desired-admin-password-here'
);
*/

COMMENT ON TABLE public.server_configuration_secrets IS 'Stores vault references for server configuration secrets (zero plain-text storage)';
COMMENT ON FUNCTION public.create_vault_secret IS 'Creates an encrypted secret in Supabase Vault and returns the vault UUID';
COMMENT ON FUNCTION public.vault_decrypt IS 'Decrypts a secret from Supabase Vault using the vault UUID';
COMMENT ON FUNCTION public.initialize_websocket_server_secrets IS 'Initializes all secrets for a WebSocket server in Supabase Vault';
COMMENT ON FUNCTION public.get_websocket_server_secrets IS 'Retrieves and decrypts all secrets for a WebSocket server';

