-- Ensure Gmail capabilities exist (idempotent)
DO $$
DECLARE
  v_gmail_id uuid;
BEGIN
  SELECT id INTO v_gmail_id FROM integrations WHERE name = 'Gmail' LIMIT 1;
  IF v_gmail_id IS NULL THEN
    RAISE NOTICE 'Gmail integration not found; skipping capability seed.';
    RETURN;
  END IF;

  -- Insert capabilities if missing
  INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
  VALUES
    (v_gmail_id, 'send_email', 'Send Email', 1),
    (v_gmail_id, 'read_emails', 'Read Emails', 2),
    (v_gmail_id, 'search_emails', 'Search Emails', 3),
    (v_gmail_id, 'email_actions', 'Email Actions', 4)
  ON CONFLICT (integration_id, capability_key) DO NOTHING;
END $$;


