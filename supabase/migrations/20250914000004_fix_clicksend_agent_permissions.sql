-- Fix ClickSend agent permissions with duplicate prefix tool names
-- This addresses the issue where tool names were created as "clicksend_sms_clicksend_send_sms" 
-- instead of the correct "clicksend_send_sms"

DO $$
BEGIN
    -- Fix ClickSend permissions with incorrect tool names (duplicate prefix issue)
    UPDATE agent_integration_permissions 
    SET 
        allowed_scopes = '["clicksend_send_sms", "clicksend_send_mms", "clicksend_get_balance", "clicksend_get_sms_history", "clicksend_get_delivery_receipts"]'::jsonb,
        updated_at = NOW()
    WHERE id IN (
        SELECT aip.id
        FROM agent_integration_permissions aip
        JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
        JOIN service_providers sp ON uic.oauth_provider_id = sp.id
        WHERE sp.name = 'clicksend_sms'
          AND aip.is_active = true
          AND (
            -- Fix permissions that have the duplicate prefix issue
            aip.allowed_scopes::text LIKE '%clicksend_sms_clicksend_%'
            OR 
            -- Also fix any that might have the old scope format
            aip.allowed_scopes::text LIKE '%"sms"%' 
            OR aip.allowed_scopes::text LIKE '%"mms"%'
            OR aip.allowed_scopes::text LIKE '%"balance"%'
            OR aip.allowed_scopes::text LIKE '%"history"%'
            OR aip.allowed_scopes::text LIKE '%"delivery_receipts"%'
          )
    );

    RAISE NOTICE 'Fixed ClickSend agent permissions with correct tool names';

    -- Log the update for verification
    RAISE NOTICE 'Updated % ClickSend agent permission records', 
        (SELECT COUNT(*) 
         FROM agent_integration_permissions aip
         JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
         JOIN service_providers sp ON uic.oauth_provider_id = sp.id
         WHERE sp.name = 'clicksend_sms' AND aip.is_active = true);

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing ClickSend agent permissions: %', SQLERRM;
END $$;

-- Verification query to check the results
DO $$
DECLARE
    permission_record RECORD;
BEGIN
    RAISE NOTICE 'ClickSend Agent Permissions After Fix:';
    
    FOR permission_record IN 
        SELECT 
            aip.id,
            aip.agent_id,
            aip.allowed_scopes,
            uic.connection_name,
            sp.name as provider_name
        FROM agent_integration_permissions aip
        JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
        JOIN service_providers sp ON uic.oauth_provider_id = sp.id
        WHERE sp.name = 'clicksend_sms' AND aip.is_active = true
        LIMIT 5
    LOOP
        RAISE NOTICE 'Agent: %, Connection: %, Scopes: %', 
            permission_record.agent_id, 
            permission_record.connection_name,
            permission_record.allowed_scopes;
    END LOOP;
END $$;
