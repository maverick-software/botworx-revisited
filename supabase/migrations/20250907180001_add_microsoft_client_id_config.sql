-- Migration: Add Microsoft Client ID to service provider configuration
-- This allows the frontend to get the client ID from the database instead of environment variables

-- Update Microsoft Teams service provider with client ID configuration
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'::jsonb),
  '{client_id}',
  '"YOUR_MICROSOFT_CLIENT_ID_HERE"'::jsonb
)
WHERE name = 'microsoft-teams';

-- Update Microsoft Outlook service provider with client ID configuration  
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'::jsonb),
  '{client_id}',
  '"YOUR_MICROSOFT_CLIENT_ID_HERE"'::jsonb
)
WHERE name = 'microsoft-outlook';

-- Update Microsoft OneDrive service provider with client ID configuration
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'::jsonb),
  '{client_id}',
  '"YOUR_MICROSOFT_CLIENT_ID_HERE"'::jsonb
)
WHERE name = 'microsoft-onedrive';

-- Add comment explaining the configuration
COMMENT ON COLUMN service_providers.configuration_metadata IS 
'JSON configuration for the service provider. For OAuth providers, should include client_id. Client secrets are stored in Supabase Secrets for security.';
