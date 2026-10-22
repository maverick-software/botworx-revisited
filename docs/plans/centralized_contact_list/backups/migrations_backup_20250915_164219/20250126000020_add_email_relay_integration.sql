-- Add Email Relay Integration
-- This migration adds a unified "Email Relay" integration that supports SMTP, SendGrid, and Mailgun

-- First, ensure we have the necessary OAuth providers for email services
INSERT INTO service_providers (name, display_name, authorization_endpoint, token_endpoint, revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required, client_credentials_location, is_enabled, configuration_metadata, created_at, updated_at)
VALUES 
  -- SMTP provider (for SMTP server configurations)
  ('smtp', 'SMTP Server', '', '', NULL, NULL, '["send_email"]'::jsonb, false, 'header', true, '{"description": "Connect to any SMTP server", "setup_type": "smtp_config"}'::jsonb, NOW(), NOW()),
  
  -- SendGrid provider (if not exists)
  ('sendgrid', 'SendGrid', 'https://app.sendgrid.com/oauth/authorize', 'https://api.sendgrid.com/v3/oauth/access_token', 'https://api.sendgrid.com/v3/oauth/revoke', NULL, '["send_email", "email_templates", "email_stats"]'::jsonb, false, 'header', true, '{"description": "High-deliverability email service", "api_key_url": "https://app.sendgrid.com/settings/api_keys"}'::jsonb, NOW(), NOW()),
  
  -- Mailgun provider (if not exists) 
  ('mailgun', 'Mailgun', 'https://app.mailgun.com/oauth/authorize', 'https://api.mailgun.net/v3/oauth/token', NULL, NULL, '["send_email", "email_validation", "email_stats", "suppression_management"]'::jsonb, false, 'header', true, '{"description": "Powerful email service with validation", "api_key_url": "https://app.mailgun.com/app/account/security/api_keys"}'::jsonb, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  scopes_supported = EXCLUDED.scopes_supported,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = NOW();

-- Get the Communications category ID (or create it if needed)
INSERT INTO integration_categories (name, description, icon_name, created_at, updated_at)
VALUES ('Email Services', 'Email sending and marketing services', 'Mail', NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  updated_at = NOW();

-- Get the category ID for Email Services
DO $$
DECLARE
  email_category_id UUID;
  smtp_provider_id UUID;
  sendgrid_provider_id UUID;
  mailgun_provider_id UUID;
  email_relay_integration_id UUID;
BEGIN
  -- Get category ID
  SELECT id INTO email_category_id FROM integration_categories WHERE name = 'Email Services';
  
  -- Get provider IDs
  SELECT id INTO smtp_provider_id FROM service_providers WHERE name = 'smtp';
  SELECT id INTO sendgrid_provider_id FROM service_providers WHERE name = 'sendgrid'; 
  SELECT id INTO mailgun_provider_id FROM service_providers WHERE name = 'mailgun';

  -- Add Email Relay integration
  INSERT INTO integrations (
    name, 
    description, 
    category_id, 
    status, 
    created_at, 
    updated_at
  ) VALUES (
    'Email Relay', 
    'Unified email service supporting SMTP, SendGrid, and Mailgun providers for high-deliverability email sending',
    email_category_id,
    'available',
    NOW(),
    NOW()
  ) RETURNING id INTO email_relay_integration_id;

  -- Add capabilities for Email Relay
  INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
  VALUES 
    (email_relay_integration_id, 'send_email', 'Send transactional and marketing emails', 1, NOW(), NOW()),
    (email_relay_integration_id, 'email_templates', 'Use email templates and branding', 2, NOW(), NOW()),
    (email_relay_integration_id, 'email_stats', 'Track email delivery and engagement', 3, NOW(), NOW()),
    (email_relay_integration_id, 'email_validation', 'Email validation and verification', 4, NOW(), NOW()),
    (email_relay_integration_id, 'smtp_relay', 'SMTP server relay support', 5, NOW(), NOW()),
    (email_relay_integration_id, 'multi_provider', 'Multiple email provider support', 6, NOW(), NOW())
  ON CONFLICT (integration_id, capability_key) DO UPDATE SET
    display_label = EXCLUDED.display_label,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

END $$;
