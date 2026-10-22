-- Update Microsoft Outlook service provider with Client ID
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'),
  '{client_id}',
  '"09b33addd0e87098a504d3c8ae97f0ce9c2ee4041036"'
)
WHERE name = 'microsoft-outlook';
