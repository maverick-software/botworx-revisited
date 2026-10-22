-- Fix data corruption: Serper API connections wrongly linked to Gmail provider ID
-- Date: January 30, 2025
-- Issue: Records in user_integration_credentials have serper_api in connection_name 
--        but Gmail's oauth_provider_id instead of Serper API's provider ID

BEGIN;

-- Step 1: Identify the corruption
DO $$
DECLARE
    gmail_provider_id UUID;
    serper_provider_id UUID;
    corrupted_count INTEGER;
    rec RECORD;
BEGIN
    -- Get provider IDs
    SELECT id INTO gmail_provider_id FROM service_providers WHERE name = 'gmail';
    SELECT id INTO serper_provider_id FROM service_providers WHERE name = 'serper_api';
    
    RAISE NOTICE '🔍 Gmail Provider ID: %', gmail_provider_id;
    RAISE NOTICE '🔍 Serper API Provider ID: %', serper_provider_id;
    
    -- Count corrupted records
    SELECT COUNT(*) INTO corrupted_count
    FROM user_integration_credentials 
    WHERE oauth_provider_id = gmail_provider_id
    AND (
        connection_name ILIKE '%serper%' OR 
        external_username ILIKE '%serper%' OR
        connection_name = 'serper_api Connection'
    );
    
    RAISE NOTICE '🚨 Found % potentially corrupted records', corrupted_count;
    
    -- Show details of corrupted records
    IF corrupted_count > 0 THEN
        RAISE NOTICE '📋 Corrupted records details:';
        FOR rec IN 
            SELECT id, connection_name, external_username
            FROM user_integration_credentials 
            WHERE oauth_provider_id = gmail_provider_id
            AND (
                connection_name ILIKE '%serper%' OR 
                external_username ILIKE '%serper%' OR
                connection_name = 'serper_api Connection'
            )
        LOOP
            RAISE NOTICE '   • ID: %, Name: "%, Username: "%"', rec.id, rec.connection_name, rec.external_username;
        END LOOP;
        
        -- Fix the corruption
        RAISE NOTICE '🔧 Fixing corrupted records...';
        
        UPDATE user_integration_credentials 
        SET 
            oauth_provider_id = serper_provider_id,
            updated_at = NOW()
        WHERE oauth_provider_id = gmail_provider_id
        AND (
            connection_name ILIKE '%serper%' OR 
            external_username ILIKE '%serper%' OR
            connection_name = 'serper_api Connection'
        );
        
        GET DIAGNOSTICS corrupted_count = ROW_COUNT;
        RAISE NOTICE '✅ Fixed % corrupted records', corrupted_count;
        
    ELSE
        RAISE NOTICE '✅ No data corruption found';
    END IF;
    
END $$;

-- Step 2: Verify the fix worked
DO $$
DECLARE
    gmail_provider_id UUID;
    remaining_corruption INTEGER;
BEGIN
    SELECT id INTO gmail_provider_id FROM service_providers WHERE name = 'gmail';
    
    SELECT COUNT(*) INTO remaining_corruption
    FROM user_integration_credentials 
    WHERE oauth_provider_id = gmail_provider_id
    AND (
        connection_name ILIKE '%serper%' OR 
        external_username ILIKE '%serper%' OR
        connection_name = 'serper_api Connection'
    );
    
    IF remaining_corruption = 0 THEN
        RAISE NOTICE '🎉 Verification successful: No remaining corruption detected';
    ELSE
        RAISE NOTICE '⚠️  Warning: % corrupted records still remain', remaining_corruption;
    END IF;
END $$;

-- Step 3: Show corrected data for verification
DO $$
DECLARE
    serper_provider_id UUID;
    corrected_count INTEGER;
    rec RECORD;
BEGIN
    SELECT id INTO serper_provider_id FROM service_providers WHERE name = 'serper_api';
    
    SELECT COUNT(*) INTO corrected_count
    FROM user_integration_credentials uic
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name = 'serper_api'
    AND (
        uic.connection_name ILIKE '%serper%' OR 
        uic.external_username ILIKE '%serper%' OR
        uic.connection_name = 'serper_api Connection'
    );
    
    RAISE NOTICE '📊 Found % Serper API connections with correct provider ID', corrected_count;
    
    IF corrected_count > 0 THEN
        RAISE NOTICE '📋 Corrected Serper API connections:';
        FOR rec IN 
            SELECT uic.id, uic.connection_name, uic.external_username, op.display_name
            FROM user_integration_credentials uic
            JOIN service_providers op ON uic.oauth_provider_id = op.id
            WHERE op.name = 'serper_api'
            AND (
                uic.connection_name ILIKE '%serper%' OR 
                uic.external_username ILIKE '%serper%' OR
                uic.connection_name = 'serper_api Connection'
            )
        LOOP
            RAISE NOTICE '   ✅ ID: %, Name: "%, Username: "%, Provider: %"', 
                rec.id, rec.connection_name, rec.external_username, rec.display_name;
        END LOOP;
    END IF;
END $$;

COMMIT;
