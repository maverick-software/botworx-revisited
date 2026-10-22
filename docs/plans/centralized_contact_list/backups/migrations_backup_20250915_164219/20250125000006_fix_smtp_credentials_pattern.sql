-- Fix SMTP to follow standard credentials pattern
-- This migration aligns SMTP with SendGrid/Mailgun pattern

-- Step 1: Add SMTP as an oauth provider (even though it's not OAuth)
INSERT INTO service_providers (name, display_name, authorization_endpoint, token_endpoint, scopes_supported, is_enabled)
VALUES (
  'smtp',
  'SMTP Server',
  '', -- Not used for API key auth
  '', -- Not used for API key auth
  '[]'::jsonb, -- No OAuth scopes
  true
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_enabled = EXCLUDED.is_enabled;

-- Step 2: Create function to migrate existing SMTP configurations to new pattern
CREATE OR REPLACE FUNCTION migrate_smtp_configurations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_record RECORD;
  oauth_provider_id UUID;
  connection_name TEXT;
BEGIN
  -- Get SMTP provider ID
  SELECT id INTO oauth_provider_id 
  FROM service_providers 
  WHERE name = 'smtp';
  
  IF oauth_provider_id IS NULL THEN
    RAISE EXCEPTION 'SMTP provider not found in service_providers';
  END IF;
  
  -- Migrate each existing SMTP configuration
  FOR config_record IN 
    SELECT * FROM smtp_configurations 
    WHERE user_id IS NOT NULL
  LOOP
    -- Create connection name
    connection_name := COALESCE(config_record.connection_name, 'SMTP Connection');
    
    -- Insert into user_oauth_connections
    INSERT INTO user_oauth_connections (
      user_id,
      oauth_provider_id,
      connection_name,
      credential_type,
      connection_status,
      vault_access_token_id,
      external_username,
      external_user_id,
      created_at,
      updated_at
    ) VALUES (
      config_record.user_id,
      oauth_provider_id,
      connection_name,
      'api_key',
      CASE WHEN config_record.is_active THEN 'active' ELSE 'disconnected' END,
      config_record.vault_password_id::TEXT, -- Store vault ID as access token
      config_record.username,
      config_record.user_id::TEXT, -- Use user_id as external_user_id
      config_record.created_at,
      config_record.updated_at
    ) ON CONFLICT (user_id, oauth_provider_id) DO UPDATE SET
      connection_name = EXCLUDED.connection_name,
      connection_status = EXCLUDED.connection_status,
      vault_access_token_id = EXCLUDED.vault_access_token_id,
      external_username = EXCLUDED.external_username,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
  
  RAISE NOTICE 'Migrated % SMTP configurations to user_oauth_connections', 
    (SELECT COUNT(*) FROM smtp_configurations WHERE user_id IS NOT NULL);
END;
$$;

-- Step 3: Run the migration
SELECT migrate_smtp_configurations();

-- Step 4: Add connection_id to smtp_configurations to link to user_oauth_connections
ALTER TABLE smtp_configurations 
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES user_oauth_connections(id) ON DELETE CASCADE;

-- Step 5: Update existing configurations with connection_id
UPDATE smtp_configurations 
SET connection_id = uoc.id
FROM user_oauth_connections uoc, service_providers op
WHERE smtp_configurations.user_id = uoc.user_id 
  AND uoc.oauth_provider_id = op.id
  AND op.name = 'smtp'
  AND uoc.connection_name = COALESCE(smtp_configurations.connection_name, 'SMTP Connection');

-- Step 6: Create function to create SMTP connection following standard pattern
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
  
  -- Create connection record
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
  
  -- Create SMTP configuration
  INSERT INTO smtp_configurations (
    user_id,
    connection_id,
    connection_name,
    host,
    port,
    secure,
    username,
    vault_password_id,
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
    p_username,
    v_vault_id,
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

-- Step 7: Create function to update SMTP connection
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
    SELECT vault_password_id INTO v_vault_id
    FROM smtp_configurations
    WHERE id = p_config_id;
    
    UPDATE vault.secrets 
    SET secret = p_password
    WHERE id = v_vault_id;
  END IF;
  
  -- Update connection record
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
  
  -- Update SMTP configuration
  UPDATE smtp_configurations SET
    connection_name = COALESCE(p_connection_name, connection_name),
    username = COALESCE(p_username, username),
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

-- Step 8: Create function to delete SMTP connection
CREATE OR REPLACE FUNCTION delete_smtp_connection(
  p_user_id UUID,
  p_config_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_connection_id UUID;
  v_vault_id UUID;
BEGIN
  -- Get connection and vault IDs
  SELECT connection_id, vault_password_id 
  INTO v_connection_id, v_vault_id
  FROM smtp_configurations
  WHERE id = p_config_id AND user_id = p_user_id;
  
  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'SMTP configuration not found';
  END IF;
  
  -- Delete vault secret
  DELETE FROM vault.secrets WHERE id = v_vault_id;
  
  -- Delete configuration (connection will be deleted by CASCADE)
  DELETE FROM smtp_configurations WHERE id = p_config_id;
  
  -- Delete connection record
  DELETE FROM user_oauth_connections WHERE id = v_connection_id;
END;
$$;

-- Step 9: Update RLS policies to work with new pattern
-- The existing RLS policies should work, but let's ensure they're compatible

-- Step 10: Clean up the migration function
DROP FUNCTION IF EXISTS migrate_smtp_configurations();

COMMENT ON FUNCTION create_smtp_connection IS 'Creates SMTP connection following standard credentials pattern';
COMMENT ON FUNCTION update_smtp_connection IS 'Updates SMTP connection and configuration';
COMMENT ON FUNCTION delete_smtp_connection IS 'Deletes SMTP connection and cleans up vault secrets';
