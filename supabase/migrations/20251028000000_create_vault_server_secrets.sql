-- Migration: Create Supabase Vault integration for server secrets
-- Description: Implements enterprise-grade secret management for WebSocket server using Supabase Vault
-- Author: AI Assistant
-- Date: 2025-10-28

-- ============================================================================
-- PART 1: Core Vault Functions
-- ============================================================================

-- Function to create encrypted secrets in Supabase Vault
CREATE OR REPLACE FUNCTION public.create_vault_secret(
  p_secret TEXT,
  p_name TEXT, 
  p_description TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.create_vault_secret IS 'Creates an encrypted secret in Supabase Vault and returns the vault UUID';

-- Function to decrypt secrets from Supabase Vault
CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.vault_decrypt IS 'Decrypts a secret from Supabase Vault using the vault UUID (service role only)';

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION public.create_vault_secret TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_decrypt TO service_role;

-- ============================================================================
-- PART 2: Server Configuration Table
-- ============================================================================

-- Table to store vault references for server configuration secrets
CREATE TABLE IF NOT EXISTS public.server_configuration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name TEXT NOT NULL UNIQUE,
  vault_supabase_service_key_id TEXT,
  vault_admin_password_id TEXT,
  vault_openai_api_key_id TEXT,
  configuration_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Ensure vault IDs are valid UUIDs when provided
  CONSTRAINT chk_vault_uuids CHECK (
    (vault_supabase_service_key_id IS NULL OR 
     vault_supabase_service_key_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AND
    (vault_admin_password_id IS NULL OR
     vault_admin_password_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AND
    (vault_openai_api_key_id IS NULL OR
     vault_openai_api_key_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);

COMMENT ON TABLE public.server_configuration_secrets IS 'Stores vault references for server configuration secrets (zero plain-text storage)';
COMMENT ON COLUMN public.server_configuration_secrets.vault_supabase_service_key_id IS 'Vault UUID for Supabase service role key';
COMMENT ON COLUMN public.server_configuration_secrets.vault_admin_password_id IS 'Vault UUID for admin dashboard password';
COMMENT ON COLUMN public.server_configuration_secrets.vault_openai_api_key_id IS 'Vault UUID for OpenAI API key';

-- Create index for fast server name lookups
CREATE INDEX IF NOT EXISTS idx_server_config_secrets_name ON public.server_configuration_secrets (server_name);

-- Enable RLS
ALTER TABLE public.server_configuration_secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access
CREATE POLICY "Service role only access"
  ON public.server_configuration_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions to service role
GRANT ALL ON TABLE public.server_configuration_secrets TO service_role;

-- ============================================================================
-- PART 3: Helper Functions for Server Secret Management
-- ============================================================================

-- Function to initialize all secrets for a WebSocket server
CREATE OR REPLACE FUNCTION public.initialize_websocket_server_secrets(
  p_server_name TEXT,
  p_supabase_service_key TEXT,
  p_admin_password TEXT,
  p_openai_api_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.initialize_websocket_server_secrets IS 'Initializes all secrets for a WebSocket server in Supabase Vault';

GRANT EXECUTE ON FUNCTION public.initialize_websocket_server_secrets TO service_role;

-- Function to retrieve and decrypt all server secrets
CREATE OR REPLACE FUNCTION public.get_websocket_server_secrets(p_server_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.get_websocket_server_secrets IS 'Retrieves and decrypts all secrets for a WebSocket server (service role only)';

GRANT EXECUTE ON FUNCTION public.get_websocket_server_secrets TO service_role;

-- Function to update a specific server secret
CREATE OR REPLACE FUNCTION public.update_server_secret(
  p_server_name TEXT,
  p_secret_type TEXT,
  p_new_secret_value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.update_server_secret IS 'Rotates a specific server secret by creating a new vault entry';

GRANT EXECUTE ON FUNCTION public.update_server_secret TO service_role;

-- ============================================================================
-- PART 4: Audit and Monitoring
-- ============================================================================

-- Create a view for monitoring vault usage
CREATE OR REPLACE VIEW public.server_secrets_audit AS
SELECT 
  server_name,
  created_at,
  updated_at,
  configuration_metadata,
  CASE 
    WHEN vault_supabase_service_key_id IS NOT NULL THEN true 
    ELSE false 
  END as has_supabase_key,
  CASE 
    WHEN vault_admin_password_id IS NOT NULL THEN true 
    ELSE false 
  END as has_admin_password,
  CASE 
    WHEN vault_openai_api_key_id IS NOT NULL THEN true 
    ELSE false 
  END as has_openai_key
FROM public.server_configuration_secrets;

COMMENT ON VIEW public.server_secrets_audit IS 'Audit view showing which secrets are configured (without exposing vault IDs)';

GRANT SELECT ON public.server_secrets_audit TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE '✅ Vault server secrets migration completed successfully';
  RAISE NOTICE '📝 Next step: Run initialize_websocket_server_secrets() to set up your server secrets';
END $$;

