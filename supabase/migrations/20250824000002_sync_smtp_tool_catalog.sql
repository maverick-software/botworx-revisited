-- Ensure tool catalog entries exist for SMTP tools (idempotent)
DO $$
DECLARE
  v_catalog_id uuid;
  v_smtp_integration uuid;
  v_email_category_id uuid;
BEGIN
  -- Optional: link to tool_catalog if your schema uses it
  SELECT id INTO v_catalog_id FROM tool_catalog WHERE name = 'SMTP' LIMIT 1;
  SELECT id INTO v_smtp_integration FROM integrations WHERE name = 'SMTP' LIMIT 1;

  -- Create catalog if missing (ensure required columns incl. tool_name)
  IF v_catalog_id IS NULL THEN
    INSERT INTO tool_catalog (id, tool_name, name, description, package_identifier, docker_image_url)
    VALUES (gen_random_uuid(), 'smtp', 'SMTP', 'SMTP email provider tools', 'ghcr.io/agentopia/smtp-tool', 'ghcr.io/agentopia/smtp-tool:latest')
    RETURNING id INTO v_catalog_id;
  ELSE
    -- Ensure tool_name is set if row exists but is missing
    UPDATE tool_catalog
      SET tool_name = COALESCE(tool_name, 'smtp'),
          package_identifier = COALESCE(package_identifier, 'ghcr.io/agentopia/smtp-tool'),
          docker_image_url = COALESCE(docker_image_url, 'ghcr.io/agentopia/smtp-tool:latest')
    WHERE id = v_catalog_id;
  END IF;

  -- Seed minimal tool_catalog row is enough; some environments may not have tool_definitions table
  -- Ensure the catalog entry has core metadata
  UPDATE tool_catalog
    SET provider = COALESCE(provider, 'smtp'),
        category = COALESCE(category, 'email'),
        package_identifier = COALESCE(package_identifier, 'ghcr.io/agentopia/smtp-tool'),
        docker_image_url = COALESCE(docker_image_url, 'ghcr.io/agentopia/smtp-tool:latest'),
        version = COALESCE(version, '1.0.0')
  WHERE id = v_catalog_id;

  -- Get messaging & communication category ID
  SELECT id INTO v_email_category_id FROM integration_categories WHERE name = 'Messaging & Communication' LIMIT 1;
  
  -- Create integration entry if missing
  IF v_smtp_integration IS NULL THEN
    INSERT INTO integrations (
      id, 
      category_id, 
      name, 
      description, 
      icon_name,
      status,
      is_active, 
      configuration_schema
    )
    VALUES (
      gen_random_uuid(),
      v_email_category_id,
      'SMTP',
      'Send emails through SMTP servers with secure credential management and agent permissions',
      'Mail',
      'available',
      true,
      '{
        "type": "smtp",
        "supports_multiple_configs": true,
        "credential_storage": "vault",
        "features": [
          "email_sending",
          "connection_testing",
          "rate_limiting",
          "agent_permissions",
          "secure_credentials"
        ],
        "setup_instructions": "Configure SMTP server settings and grant permissions to agents for autonomous email sending"
      }'::jsonb
    );
  ELSE
    -- Update existing integration with current metadata
    UPDATE integrations
      SET description = COALESCE(description, 'Send emails through SMTP servers with secure credential management and agent permissions'),
          icon_name = COALESCE(icon_name, 'Mail'),
          status = COALESCE(status, 'available'),
          configuration_schema = COALESCE(configuration_schema, '{
            "type": "smtp",
            "supports_multiple_configs": true,
            "credential_storage": "vault",
            "features": [
              "email_sending",
              "connection_testing",
              "rate_limiting",
              "agent_permissions",
              "secure_credentials"
            ],
            "setup_instructions": "Configure SMTP server settings and grant permissions to agents for autonomous email sending"
          }'::jsonb)
    WHERE id = v_smtp_integration;
  END IF;

  RAISE NOTICE 'SMTP tool catalog and integration entries synchronized successfully';
END $$;
