-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- Then run the initialize command at the bottom with your actual password

-- 1. Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.vault_decrypt(TEXT);
DROP FUNCTION IF EXISTS public.initialize_websocket_server_secrets(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_websocket_server_secrets(TEXT);

-- 2. Create vault functions
CREATE FUNCTION public.create_vault_secret(p_secret TEXT, p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE secret_id UUID;
BEGIN
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO secret_id;
  RETURN secret_id::TEXT;
END;
$$;

CREATE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE decrypted_value TEXT; uuid_id UUID;
BEGIN
  uuid_id := vault_id::UUID;
  SELECT decrypted_secret INTO decrypted_value FROM vault.decrypted_secrets WHERE id = uuid_id LIMIT 1;
  RETURN decrypted_value;
END;
$$;

-- 3. Create table
CREATE TABLE IF NOT EXISTS public.server_configuration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_name TEXT NOT NULL UNIQUE,
  vault_supabase_service_key_id TEXT,
  vault_admin_password_id TEXT,
  configuration_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create helper function
CREATE FUNCTION public.initialize_websocket_server_secrets(p_server_name TEXT, p_supabase_service_key TEXT, p_admin_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_supabase_key_vault_id TEXT; v_admin_pass_vault_id TEXT;
BEGIN
  SELECT public.create_vault_secret(p_supabase_service_key, p_server_name || '_supabase_key', 'Supabase key') INTO v_supabase_key_vault_id;
  SELECT public.create_vault_secret(p_admin_password, p_server_name || '_admin_pass', 'Admin password') INTO v_admin_pass_vault_id;
  
  INSERT INTO public.server_configuration_secrets (server_name, vault_supabase_service_key_id, vault_admin_password_id)
  VALUES (p_server_name, v_supabase_key_vault_id, v_admin_pass_vault_id)
  ON CONFLICT (server_name) DO UPDATE SET 
    vault_supabase_service_key_id = v_supabase_key_vault_id,
    vault_admin_password_id = v_admin_pass_vault_id,
    updated_at = now();
  
  RETURN jsonb_build_object('status', 'success', 'vault_supabase_key_id', v_supabase_key_vault_id, 'vault_admin_pass_id', v_admin_pass_vault_id);
END;
$$;

CREATE FUNCTION public.get_websocket_server_secrets(p_server_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_config RECORD; v_key TEXT; v_pass TEXT;
BEGIN
  SELECT * INTO v_config FROM public.server_configuration_secrets WHERE server_name = p_server_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Server not found'; END IF;
  
  SELECT public.vault_decrypt(v_config.vault_supabase_service_key_id) INTO v_key;
  SELECT public.vault_decrypt(v_config.vault_admin_password_id) INTO v_pass;
  
  RETURN jsonb_build_object('SUPABASE_SERVICE_ROLE_KEY', v_key, 'ADMIN_PASSWORD', v_pass);
END;
$$;

-- 5. NOW RUN THIS TO INITIALIZE (CHANGE THE PASSWORD!)
SELECT public.initialize_websocket_server_secrets(
  'voice-websocket-server',
  current_setting('app.settings.supabase_service_role_key'),
  'ChangeThisPassword123!'
);

