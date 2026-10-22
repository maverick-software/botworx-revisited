-- Seed missing Gmail capabilities into integration_capabilities
-- Ensures Channels modal can display all MCP-native Gmail tools

DO $$
DECLARE
  gmail_integration_id uuid;
BEGIN
  SELECT id INTO gmail_integration_id FROM integrations WHERE lower(name) = 'gmail' LIMIT 1;
  IF gmail_integration_id IS NULL THEN
    RAISE NOTICE 'Gmail integration not found; skipping capability seed.';
    RETURN;
  END IF;

  -- Send Email
  INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
  VALUES (gmail_integration_id, 'send_email', 'Send Email', 1)
  ON CONFLICT (integration_id, capability_key) DO NOTHING;

  -- Read Emails
  INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
  VALUES (gmail_integration_id, 'read_emails', 'Read Emails', 2)
  ON CONFLICT (integration_id, capability_key) DO NOTHING;

  -- Search Emails
  INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
  VALUES (gmail_integration_id, 'search_emails', 'Search Emails', 3)
  ON CONFLICT (integration_id, capability_key) DO NOTHING;

  -- Email Actions (modify)
  INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
  VALUES (gmail_integration_id, 'email_actions', 'Email Actions', 4)
  ON CONFLICT (integration_id, capability_key) DO NOTHING;
END $$;


