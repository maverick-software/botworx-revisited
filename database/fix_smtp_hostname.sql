-- Fix SMTP.com hostname in existing connection
-- This updates the connection_metadata to use the correct hostname

UPDATE user_integration_credentials 
SET connection_metadata = jsonb_set(
  connection_metadata, 
  '{host}', 
  '"send.smtp.com"'
)
WHERE 
  connection_metadata->>'host' = 'smtp.smtp.com'
  AND connection_metadata->>'provider_preset' = 'smtpcom';

-- Verify the update
SELECT 
  id,
  connection_name,
  connection_metadata->>'host' as hostname,
  connection_metadata->>'port' as port,
  connection_metadata->>'provider_preset' as preset
FROM user_integration_credentials 
WHERE connection_metadata->>'provider_preset' = 'smtpcom';
