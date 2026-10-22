-- Remove Email Relay and Reactivate Separate Email Provider Integrations
-- Date: January 16, 2025  
-- Purpose: Fix tool discovery by using separate SMTP, SendGrid, and Mailgun integrations instead of unified Email Relay

-- Skip this migration if required tables don't exist (for shadow database compatibility)
DO $$
DECLARE
    smtp_provider_id UUID;
    sendgrid_provider_id UUID;
    mailgun_provider_id UUID;
    smtp_count INTEGER;
    sendgrid_count INTEGER;
    mailgun_count INTEGER;
    smtp_capabilities_count INTEGER;
    sendgrid_capabilities_count INTEGER;
    mailgun_capabilities_count INTEGER;
    fixed_permissions_count INTEGER;
BEGIN
    -- Check if required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_capabilities') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_integration_permissions') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integration_credentials') THEN
        RAISE NOTICE 'Skipping email integrations split migration - required tables do not exist yet';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Proceeding with email integrations split migration - required tables exist';
    -- Get oauth provider IDs using actual names from your data
    SELECT id INTO smtp_provider_id FROM service_providers WHERE name = 'smtp';
    SELECT id INTO sendgrid_provider_id FROM service_providers WHERE name = 'sendgrid';
    SELECT id INTO mailgun_provider_id FROM service_providers WHERE name = 'mailgun';
    
    -- Reactivate SMTP integration (using actual ID from your data)
    UPDATE integrations 
    SET 
        status = 'available',
        required_oauth_provider_id = smtp_provider_id,
        description = 'Connect to any SMTP server for reliable email sending and delivery',
        updated_at = NOW()
    WHERE id = '9cd9e1a9-630d-413a-93c8-b63f8da720c4'; -- SMTP ID from your data
    
    -- Reactivate SendGrid integration (using actual ID from your data)
    UPDATE integrations 
    SET 
        status = 'available',
        required_oauth_provider_id = sendgrid_provider_id,
        description = 'High-deliverability email service with advanced analytics and templates',
        updated_at = NOW()
    WHERE id = 'f56b8ae0-8630-4919-8888-66e89c1fbecd'; -- SendGrid ID from your data
    
    -- Reactivate Mailgun integration (using actual ID from your data)
    UPDATE integrations 
    SET 
        status = 'available',
        required_oauth_provider_id = mailgun_provider_id,
        description = 'Powerful email service with validation, analytics, and suppression management',
        updated_at = NOW()
    WHERE id = '8049e60c-af31-493b-8f23-59340a5940fa'; -- Mailgun ID from your data

    -- =============================================
    -- STEP 3: Add integration capabilities (using existing integration IDs)
    -- =============================================

    -- SMTP capabilities (clear existing and add new ones with unique tool names)
    DELETE FROM integration_capabilities WHERE integration_id = '9cd9e1a9-630d-413a-93c8-b63f8da720c4';
    INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
    VALUES 
        ('9cd9e1a9-630d-413a-93c8-b63f8da720c4', 'smtp_send_email', 'Send Email via SMTP', 1, NOW(), NOW()),
        ('9cd9e1a9-630d-413a-93c8-b63f8da720c4', 'smtp_email_templates', 'SMTP Email Templates', 2, NOW(), NOW()),
        ('9cd9e1a9-630d-413a-93c8-b63f8da720c4', 'smtp_email_stats', 'SMTP Email Statistics', 3, NOW(), NOW());

    -- SendGrid capabilities (clear existing and add new ones with unique tool names)  
    DELETE FROM integration_capabilities WHERE integration_id = 'f56b8ae0-8630-4919-8888-66e89c1fbecd';
    INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
    VALUES 
        ('f56b8ae0-8630-4919-8888-66e89c1fbecd', 'sendgrid_send_email', 'Send Email via SendGrid', 1, NOW(), NOW()),
        ('f56b8ae0-8630-4919-8888-66e89c1fbecd', 'sendgrid_email_templates', 'SendGrid Email Templates', 2, NOW(), NOW()),
        ('f56b8ae0-8630-4919-8888-66e89c1fbecd', 'sendgrid_email_stats', 'SendGrid Email Statistics', 3, NOW(), NOW());

    -- Mailgun capabilities (clear existing and add new ones with unique tool names, includes additional features)
    DELETE FROM integration_capabilities WHERE integration_id = '8049e60c-af31-493b-8f23-59340a5940fa';
    INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order, created_at, updated_at)
    VALUES 
        ('8049e60c-af31-493b-8f23-59340a5940fa', 'mailgun_send_email', 'Send Email via Mailgun', 1, NOW(), NOW()),
        ('8049e60c-af31-493b-8f23-59340a5940fa', 'mailgun_email_templates', 'Mailgun Email Templates', 2, NOW(), NOW()),
        ('8049e60c-af31-493b-8f23-59340a5940fa', 'mailgun_email_stats', 'Mailgun Email Statistics', 3, NOW(), NOW()),
        ('8049e60c-af31-493b-8f23-59340a5940fa', 'mailgun_email_validation', 'Mailgun Email Validation', 4, NOW(), NOW()),
        ('8049e60c-af31-493b-8f23-59340a5940fa', 'mailgun_suppression_management', 'Mailgun Suppression Management', 5, NOW(), NOW());

    RAISE NOTICE '✅ Reactivated SMTP integration (ID: 9cd9e1a9-630d-413a-93c8-b63f8da720c4)';
    RAISE NOTICE '✅ Reactivated SendGrid integration (ID: f56b8ae0-8630-4919-8888-66e89c1fbecd)';
    RAISE NOTICE '✅ Reactivated Mailgun integration (ID: 8049e60c-af31-493b-8f23-59340a5940fa)';

-- =============================================
-- STEP 3.5: Fix other integrations missing required_oauth_provider_id
-- =============================================

-- Fix Gmail integration (link to gmail oauth provider)
UPDATE integrations 
SET 
    required_oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail'),
    updated_at = NOW()
WHERE id = '774353a7-7ad2-468d-aba4-3e3bc0f7b0fe' -- Gmail ID from your data
  AND required_oauth_provider_id IS NULL;

-- Fix Web Search integration (link to serper_api oauth provider as primary)
UPDATE integrations 
SET 
    required_oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'serper_api'),
    updated_at = NOW()
WHERE id = 'bae4c9c4-a91f-45d3-8f68-6b48ff61adc4' -- Web Search ID from your data
  AND required_oauth_provider_id IS NULL;

-- Fix Slack integration (link to slack oauth provider)
UPDATE integrations 
SET 
    required_oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'slack'),
    updated_at = NOW()
WHERE id = 'e190feb2-f705-457e-a98e-84ea1f493667' -- Slack ID from your data
  AND required_oauth_provider_id IS NULL;

-- =============================================
-- STEP 4: Fix existing agent permissions with empty scopes
-- =============================================

-- Fix Angela's SMTP permissions and any other agents with empty SMTP scopes (use new unique capability keys)
UPDATE agent_integration_permissions 
SET 
    allowed_scopes = '["smtp_send_email", "smtp_email_templates", "smtp_email_stats"]'::jsonb,
    updated_at = NOW()
WHERE id IN (
    SELECT aip.id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name = 'smtp'
      AND aip.is_active = true
      AND (aip.allowed_scopes IS NULL OR aip.allowed_scopes = '[]'::jsonb)
);

-- Fix SendGrid permissions with empty scopes (use new unique capability keys)
UPDATE agent_integration_permissions 
SET 
    allowed_scopes = '["sendgrid_send_email", "sendgrid_email_templates", "sendgrid_email_stats"]'::jsonb,
    updated_at = NOW()
WHERE id IN (
    SELECT aip.id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name = 'sendgrid'
      AND aip.is_active = true
      AND (aip.allowed_scopes IS NULL OR aip.allowed_scopes = '[]'::jsonb)
);

-- Fix Mailgun permissions with empty scopes (use new unique capability keys, includes additional capabilities)
UPDATE agent_integration_permissions 
SET 
    allowed_scopes = '["mailgun_send_email", "mailgun_email_templates", "mailgun_email_stats", "mailgun_email_validation", "mailgun_suppression_management"]'::jsonb,
    updated_at = NOW()
WHERE id IN (
    SELECT aip.id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name = 'mailgun'
      AND aip.is_active = true
      AND (aip.allowed_scopes IS NULL OR aip.allowed_scopes = '[]'::jsonb)
);

-- =============================================
-- STEP 5: Verification queries
-- =============================================

-- Verify new integrations were created
    -- Count reactivated integrations (using actual names from your data)
    SELECT COUNT(*) INTO smtp_count FROM integrations WHERE name = 'SMTP' AND status = 'available';
    SELECT COUNT(*) INTO sendgrid_count FROM integrations WHERE name = 'SendGrid' AND status = 'available';
    SELECT COUNT(*) INTO mailgun_count FROM integrations WHERE name = 'Mailgun' AND status = 'available';
    
    -- Count capabilities (using actual names from your data)
    SELECT COUNT(*) INTO smtp_capabilities_count 
    FROM integration_capabilities ic
    JOIN integrations i ON ic.integration_id = i.id
    WHERE i.name = 'SMTP';
    
    SELECT COUNT(*) INTO sendgrid_capabilities_count 
    FROM integration_capabilities ic
    JOIN integrations i ON ic.integration_id = i.id
    WHERE i.name = 'SendGrid';
    
    SELECT COUNT(*) INTO mailgun_capabilities_count 
    FROM integration_capabilities ic
    JOIN integrations i ON ic.integration_id = i.id
    WHERE i.name = 'Mailgun';
    
    -- Count fixed permissions
    SELECT COUNT(*) INTO fixed_permissions_count
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name IN ('smtp', 'sendgrid', 'mailgun')
      AND aip.is_active = true
      AND aip.allowed_scopes IS NOT NULL
      AND aip.allowed_scopes != '[]'::jsonb;
    
    -- Verification
    IF smtp_count = 1 AND sendgrid_count = 1 AND mailgun_count = 1 THEN
        RAISE NOTICE '✅ All email integrations created successfully';
    ELSE
        RAISE EXCEPTION 'Migration failed: Expected 1 of each integration, got SMTP:%, SendGrid:%, Mailgun:%', 
            smtp_count, sendgrid_count, mailgun_count;
    END IF;
    
    IF smtp_capabilities_count = 3 AND sendgrid_capabilities_count = 3 AND mailgun_capabilities_count = 5 THEN
        RAISE NOTICE '✅ All integration capabilities created successfully';
    ELSE
        RAISE EXCEPTION 'Migration failed: Expected capabilities SMTP:3, SendGrid:3, Mailgun:5, got SMTP:%, SendGrid:%, Mailgun:%',
            smtp_capabilities_count, sendgrid_capabilities_count, mailgun_capabilities_count;
    END IF;
    
    RAISE NOTICE '✅ Fixed % agent permissions with proper email scopes', fixed_permissions_count;
    RAISE NOTICE '✅ Email integration split migration completed successfully!';
END $$;
