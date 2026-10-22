-- Clean up SMTP credentials duplication
-- Remove credential fields from smtp_configurations since they're now in user_oauth_connections

-- Step 1: Ensure all existing configurations have connection_id set
-- (This should already be done by the previous migration, but let's be safe)
UPDATE smtp_configurations 
SET connection_id = uoc.id
FROM user_oauth_connections uoc, service_providers op
WHERE smtp_configurations.user_id = uoc.user_id 
  AND uoc.oauth_provider_id = op.id
  AND op.name = 'smtp'
  AND uoc.connection_name = COALESCE(smtp_configurations.connection_name, 'SMTP Connection')
  AND smtp_configurations.connection_id IS NULL;

-- Step 2: Remove credential fields from smtp_configurations
-- These are now stored in user_oauth_connections
ALTER TABLE smtp_configurations 
DROP COLUMN IF EXISTS username,
DROP COLUMN IF EXISTS vault_password_id;

-- Step 3: Update the create_smtp_connection function to not include credential fields in smtp_configurations
CREATE OR REPLACE FUNCTION create_smtp_connection(
  p_user_id UUID,
  p_connection_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_host TEXT,
  p_port INTEGER,
  p_secure BOOLEAN,
  p_from_email TEXT,
  p_from_name TEXT DEFAULT NULL,
  p_reply_to_email TEXT DEFAULT NULL,
  p_connection_timeout INTEGER DEFAULT 60000,
  p_socket_timeout INTEGER DEFAULT 60000,
  p_greeting_timeout INTEGER DEFAULT 30000,
  p_max_emails_per_day INTEGER DEFAULT 100,
  p_max_recipients_per_email INTEGER DEFAULT 50
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_oauth_provider_id UUID;
  v_vault_id UUID;
  v_connection_id UUID;
  v_config_id UUID;
BEGIN
  -- Get SMTP provider ID
  SELECT id INTO v_oauth_provider_id 
  FROM service_providers 
  WHERE name = 'smtp';
  
  IF v_oauth_provider_id IS NULL THEN
    RAISE EXCEPTION 'SMTP provider not found';
  END IF;
  
  -- Store password in vault
  INSERT INTO vault.secrets (name, secret)
  VALUES (
    'smtp_password_' || gen_random_uuid()::text,
    p_password
  )
  RETURNING id INTO v_vault_id;
  
  -- Create connection record (credentials stored here)
  INSERT INTO user_oauth_connections (
    user_id,
    oauth_provider_id,
    connection_name,
    credential_type,
    connection_status,
    vault_access_token_id,
    external_username,
    external_user_id
  ) VALUES (
    p_user_id,
    v_oauth_provider_id,
    p_connection_name,
    'api_key',
    'active',
    v_vault_id::TEXT,
    p_username,
    p_user_id::TEXT
  )
  RETURNING id INTO v_connection_id;
  
  -- Create SMTP configuration (server settings only, no credentials)
  INSERT INTO smtp_configurations (
    user_id,
    connection_id,
    connection_name,
    host,
    port,
    secure,
    from_email,
    from_name,
    reply_to_email,
    connection_timeout,
    socket_timeout,
    greeting_timeout,
    max_emails_per_day,
    max_recipients_per_email,
    is_active
  ) VALUES (
    p_user_id,
    v_connection_id,
    p_connection_name,
    p_host,
    p_port,
    p_secure,
    p_from_email,
    p_from_name,
    p_reply_to_email,
    p_connection_timeout,
    p_socket_timeout,
    p_greeting_timeout,
    p_max_emails_per_day,
    p_max_recipients_per_email,
    true
  )
  RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;

-- Step 4: Update the update_smtp_connection function
CREATE OR REPLACE FUNCTION update_smtp_connection(
  p_user_id UUID,
  p_config_id UUID,
  p_connection_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_host TEXT DEFAULT NULL,
  p_port INTEGER DEFAULT NULL,
  p_secure BOOLEAN DEFAULT NULL,
  p_from_email TEXT DEFAULT NULL,
  p_from_name TEXT DEFAULT NULL,
  p_reply_to_email TEXT DEFAULT NULL,
  p_connection_timeout INTEGER DEFAULT NULL,
  p_socket_timeout INTEGER DEFAULT NULL,
  p_greeting_timeout INTEGER DEFAULT NULL,
  p_max_emails_per_day INTEGER DEFAULT NULL,
  p_max_recipients_per_email INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connection_id UUID;
  v_vault_id UUID;
BEGIN
  -- Get connection ID from config
  SELECT connection_id INTO v_connection_id
  FROM smtp_configurations
  WHERE id = p_config_id AND user_id = p_user_id;
  
  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'SMTP configuration not found';
  END IF;
  
  -- Update password in vault if provided
  IF p_password IS NOT NULL THEN
    SELECT vault_access_token_id::UUID INTO v_vault_id
    FROM user_oauth_connections
    WHERE id = v_connection_id;
    
    UPDATE vault.secrets 
    SET secret = p_password
    WHERE id = v_vault_id;
  END IF;
  
  -- Update connection record (credentials stored here)
  UPDATE user_oauth_connections SET
    connection_name = COALESCE(p_connection_name, connection_name),
    external_username = COALESCE(p_username, external_username),
    connection_status = CASE 
      WHEN p_is_active IS NOT NULL THEN 
        CASE WHEN p_is_active THEN 'active' ELSE 'disconnected' END
      ELSE connection_status
    END,
    updated_at = NOW()
  WHERE id = v_connection_id;
  
  -- Update SMTP configuration (server settings only, no credentials)
  UPDATE smtp_configurations SET
    connection_name = COALESCE(p_connection_name, connection_name),
    host = COALESCE(p_host, host),
    port = COALESCE(p_port, port),
    secure = COALESCE(p_secure, secure),
    from_email = COALESCE(p_from_email, from_email),
    from_name = COALESCE(p_from_name, from_name),
    reply_to_email = COALESCE(p_reply_to_email, reply_to_email),
    connection_timeout = COALESCE(p_connection_timeout, connection_timeout),
    socket_timeout = COALESCE(p_socket_timeout, socket_timeout),
    greeting_timeout = COALESCE(p_greeting_timeout, greeting_timeout),
    max_emails_per_day = COALESCE(p_max_emails_per_day, max_emails_per_day),
    max_recipients_per_email = COALESCE(p_max_recipients_per_email, max_recipients_per_email),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_config_id;
END;
$$;

-- Step 5: Update the SMTP Edge Function to get credentials from user_oauth_connections
-- This will require updating the Edge Function code, but document the change here
COMMENT ON FUNCTION create_smtp_connection IS 'Creates SMTP connection with credentials in user_oauth_connections and server config in smtp_configurations';
COMMENT ON FUNCTION update_smtp_connection IS 'Updates SMTP connection with credentials in user_oauth_connections and server config in smtp_configurations';

-- Step 6: Create helper function to get SMTP credentials for Edge Functions
CREATE OR REPLACE FUNCTION get_smtp_credentials(
  p_config_id UUID,
  p_user_id UUID
) RETURNS TABLE(
  username TEXT,
  password TEXT,
  host TEXT,
  port INTEGER,
  secure BOOLEAN,
  from_email TEXT,
  from_name TEXT,
  reply_to_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uoc.external_username as username,
    vs.secret::TEXT as password,
    sc.host,
    sc.port,
    sc.secure,
    sc.from_email,
    sc.from_name,
    sc.reply_to_email
  FROM smtp_configurations sc
  JOIN user_oauth_connections uoc ON sc.connection_id = uoc.id
  JOIN vault.secrets vs ON uoc.vault_access_token_id::UUID = vs.id
  WHERE sc.id = p_config_id 
    AND sc.user_id = p_user_id
    AND sc.is_active = true
    AND uoc.connection_status = 'active';
END;
$$;

COMMENT ON FUNCTION get_smtp_credentials IS 'Helper function for Edge Functions to get complete SMTP credentials and configuration';
