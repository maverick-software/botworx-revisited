-- Migration: Add Temporary Chat Links Service Provider (Simplified)
-- Description: Registers temporary chat links as an internal service provider
-- Date: 2025-09-18

-- Add temporary chat links service provider
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  scopes_supported,
  pkce_required,
  is_enabled,
  configuration_metadata
) VALUES (
  'temporary_chat_internal',
  'Temporary Chat Links',
  'internal://temporary-chat/auth',
  'internal://temporary-chat/token',
  '[
    "create_link",
    "manage_sessions", 
    "view_analytics"
  ]'::jsonb,
  false,
  true,
  '{
    "internal_service": true,
    "requires_user_credentials": false,
    "supports_public_access": true,
    "rate_limits": {
      "links_per_user_per_day": 100,
      "sessions_per_link": 50,
      "messages_per_session": 1000
    },
    "security_features": {
      "token_encryption": true,
      "session_isolation": true,
      "automatic_cleanup": true
    }
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  is_enabled = EXCLUDED.is_enabled;

-- Create comment for documentation
COMMENT ON TABLE service_providers IS 'Service providers table now includes temporary_chat_internal for temporary chat links functionality';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added temporary chat links service provider';
END $$;
