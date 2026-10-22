-- Fix Angela's SMTP scopes to match the new unique capability keys
-- This will ensure her SMTP tools show up in tool discovery

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
      AND aip.agent_id = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'  -- Angela's agent ID
      AND aip.is_active = true
);

-- Verify the fix
SELECT 
    aip.allowed_scopes,
    i.name as integration_name,
    ic.capability_key,
    ic.display_label
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
JOIN service_providers op ON uic.oauth_provider_id = op.id
LEFT JOIN integrations i ON op.id = i.required_oauth_provider_id
LEFT JOIN integration_capabilities ic ON i.id = ic.integration_id
WHERE aip.agent_id = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'
  AND op.name = 'smtp'
  AND aip.is_active = true;
