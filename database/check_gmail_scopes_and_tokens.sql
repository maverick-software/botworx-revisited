-- Check Gmail OAuth scopes currently stored in database
SELECT 
    name, 
    display_name, 
    scopes_supported,
    jsonb_array_length(scopes_supported) as scope_count
FROM service_providers 
WHERE name = 'gmail';

-- Check user Gmail credentials and vault token IDs
SELECT 
    uic.id,
    uic.user_id,
    uic.external_username,
    uic.scopes_granted,
    uic.vault_access_token_id,
    uic.vault_refresh_token_id,
    uic.token_expires_at,
    uic.credential_type,
    op.name as provider_name
FROM user_integration_credentials uic
JOIN service_providers op ON uic.oauth_provider_id = op.id
WHERE op.name = 'gmail'
ORDER BY uic.created_at DESC;

-- Check if vault tokens actually exist
SELECT 
    uic.id as credential_id,
    uic.external_username,
    uic.vault_access_token_id,
    uic.vault_refresh_token_id,
    CASE 
        WHEN uic.vault_access_token_id IS NOT NULL THEN 'Has Access Token ID'
        ELSE 'Missing Access Token ID'
    END as access_token_status,
    CASE 
        WHEN uic.vault_refresh_token_id IS NOT NULL THEN 'Has Refresh Token ID'
        ELSE 'Missing Refresh Token ID'
    END as refresh_token_status
FROM user_integration_credentials uic
JOIN service_providers op ON uic.oauth_provider_id = op.id
WHERE op.name = 'gmail';

-- Check agent permissions for Gmail
SELECT 
    aip.agent_id,
    aip.allowed_scopes,
    uic.external_username,
    uic.scopes_granted,
    op.name as provider_name
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON aip.credential_id = uic.id
JOIN service_providers op ON uic.oauth_provider_id = op.id
WHERE op.name = 'gmail';
