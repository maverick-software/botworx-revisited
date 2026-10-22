-- Add Gmail OAuth provider entry
INSERT INTO service_providers (id, name, display_name, authorization_endpoint, token_endpoint, scopes_supported, discovery_endpoint)
VALUES (
    gen_random_uuid(),
    'gmail',
    'Gmail',
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://oauth2.googleapis.com/token',
    '["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]'::jsonb,
    'https://accounts.google.com/.well-known/openid-configuration'
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    authorization_endpoint = EXCLUDED.authorization_endpoint,
    token_endpoint = EXCLUDED.token_endpoint,
    scopes_supported = EXCLUDED.scopes_supported,
    discovery_endpoint = EXCLUDED.discovery_endpoint; 