-- Ensure tool catalog entries exist for Gmail tools (idempotent)
DO $$
DECLARE
  v_catalog_id uuid;
  v_gmail_integration uuid;
BEGIN
  -- Optional: link to tool_catalog if your schema uses it
  SELECT id INTO v_catalog_id FROM tool_catalog WHERE name = 'Gmail' LIMIT 1;
  SELECT id INTO v_gmail_integration FROM integrations WHERE name = 'Gmail' LIMIT 1;

  -- Create catalog if missing (ensure required columns incl. tool_name)
  IF v_catalog_id IS NULL THEN
    INSERT INTO tool_catalog (id, tool_name, name, description, package_identifier, docker_image_url)
    VALUES (gen_random_uuid(), 'gmail', 'Gmail', 'Gmail provider tools', 'ghcr.io/agentopia/gmail-tool', 'ghcr.io/agentopia/gmail-tool:latest')
    RETURNING id INTO v_catalog_id;
  ELSE
    -- Ensure tool_name is set if row exists but is missing
    UPDATE tool_catalog
      SET tool_name = COALESCE(tool_name, 'gmail'),
          package_identifier = COALESCE(package_identifier, 'ghcr.io/agentopia/gmail-tool'),
          docker_image_url = COALESCE(docker_image_url, 'ghcr.io/agentopia/gmail-tool:latest')
    WHERE id = v_catalog_id;
  END IF;

  -- Seed minimal tool_catalog row is enough; some environments may not have tool_definitions table
  -- Ensure the catalog entry has core metadata
  UPDATE tool_catalog
    SET provider = COALESCE(provider, 'gmail'),
        category = COALESCE(category, 'email'),
        package_identifier = COALESCE(package_identifier, 'ghcr.io/agentopia/gmail-tool'),
        docker_image_url = COALESCE(docker_image_url, 'ghcr.io/agentopia/gmail-tool:latest'),
        version = COALESCE(version, '1.0.0')
  WHERE id = v_catalog_id;
END $$;


