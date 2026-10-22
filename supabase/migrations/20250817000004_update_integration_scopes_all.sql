-- Normalize scopes across known providers based on capabilities
BEGIN;

-- Gmail: read/send email (OAuth-managed)
UPDATE user_oauth_connections c
SET scopes_granted = '["email_read","email_send"]'::jsonb,
    updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) = 'gmail'
  AND (c.scopes_granted IS NULL OR c.scopes_granted = '[]'::jsonb);

-- SendGrid: outbound email
UPDATE user_oauth_connections c
SET scopes_granted = '["email_send"]'::jsonb,
    updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) = 'sendgrid'
  AND (c.scopes_granted IS NULL OR c.scopes_granted = '[]'::jsonb);

-- Mailgun: outbound email (and inbound via webhook handled externally)
UPDATE user_oauth_connections c
SET scopes_granted = '["email_send"]'::jsonb,
    updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) = 'mailgun'
  AND (c.scopes_granted IS NULL OR c.scopes_granted = '[]'::jsonb);

-- Web search providers: Serper, SerpAPI, Brave
UPDATE user_oauth_connections c
SET scopes_granted = '["web_search","news_search","image_search"]'::jsonb,
    updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) IN ('serper api','serper','serpapi','brave search api','brave')
  AND (c.scopes_granted IS NULL OR c.scopes_granted = '[]'::jsonb);

COMMIT;


