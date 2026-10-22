-- Add Mailgun OAuth Provider
-- This fixes the "Could not find the 'provider_name' column" error

INSERT INTO service_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    client_id_required,
    client_secret_required,
    scope_required,
    is_enabled
)
VALUES (
    'mailgun',
    'Mailgun',
    'https://api.mailgun.net/v3',
    'https://api.mailgun.net/v3',
    false,
    false,
    false,
    true
)
ON CONFLICT (name) DO NOTHING;
