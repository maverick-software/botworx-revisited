-- Hide Individual Email Integrations
-- Now that we have the unified "Email Relay" integration, 
-- we should hide the individual SMTP, SendGrid, and Mailgun integrations

-- Update individual email integrations to be hidden/deprecated
UPDATE integrations 
SET 
  status = 'deprecated',
  updated_at = NOW()
WHERE name IN ('SMTP', 'SendGrid', 'Mailgun', 'Email')
  AND name != 'Email Relay'; -- Keep the unified one

-- Also hide any 'Email' integration if it exists
UPDATE integrations 
SET 
  status = 'deprecated',
  updated_at = NOW()
WHERE (name = 'Email' OR name = 'SMTP Service' OR name = 'Email Service')
  AND name != 'Email Relay';
