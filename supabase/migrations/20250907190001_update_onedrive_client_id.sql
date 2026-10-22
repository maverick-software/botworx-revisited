-- Update Microsoft OneDrive service provider with Client ID
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'::jsonb),
  '{client_id}',
  '"5cff4997-8832-4e8b-930b-95ca311adcf1"'::jsonb
)
WHERE name = 'microsoft-onedrive';
