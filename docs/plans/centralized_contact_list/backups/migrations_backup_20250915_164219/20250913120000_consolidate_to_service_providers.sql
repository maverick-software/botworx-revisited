-- Consolidate integrations system to use service_providers table directly
-- Remove integrations_renamed table and update all references to use service_providers
-- Date: September 13, 2025

BEGIN;

-- Step 1: Migrate any remaining data from integrations_renamed to service_providers
-- Update service_providers with integration-specific fields from integrations_renamed
DO $$
DECLARE
    integration_record RECORD;
BEGIN
    -- Check if integrations_renamed table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations_renamed') THEN
        RAISE NOTICE 'Migrating data from integrations_renamed to service_providers...';
        
        -- Update service_providers with integration data
        FOR integration_record IN 
            SELECT ir.*, sp.id as provider_id
            FROM integrations_renamed ir
            JOIN service_providers sp ON ir.required_oauth_provider_id = sp.id
        LOOP
            -- Update service_providers with integration metadata
            UPDATE service_providers 
            SET 
                display_name = COALESCE(integration_record.name, display_name),
                configuration_metadata = COALESCE(
                    configuration_metadata || jsonb_build_object(
                        'integration_description', integration_record.description,
                        'icon_name', integration_record.icon_name,
                        'is_popular', integration_record.is_popular,
                        'documentation_url', integration_record.documentation_url,
                        'configuration_schema', integration_record.configuration_schema,
                        'display_order', integration_record.display_order,
                        'agent_classification', integration_record.agent_classification,
                        'category_id', integration_record.category_id
                    ),
                    configuration_metadata
                ),
                updated_at = NOW()
            WHERE id = integration_record.provider_id;
        END LOOP;
        
        RAISE NOTICE 'Data migration from integrations_renamed completed';
    ELSE
        RAISE NOTICE 'integrations_renamed table does not exist, skipping data migration';
    END IF;
END $$;

-- Step 2: Update all foreign key references from integrations_renamed to service_providers
-- Update user_integrations table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integrations') THEN
        -- Add new column for service_provider_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_integrations' AND column_name = 'service_provider_id') THEN
            ALTER TABLE user_integrations ADD COLUMN service_provider_id UUID;
        END IF;
        
        -- Update user_integrations to reference service_providers
        UPDATE user_integrations ui
        SET service_provider_id = ir.required_oauth_provider_id
        FROM integrations_renamed ir
        WHERE ui.integration_id = ir.id
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations_renamed');
        
        -- Add foreign key constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_integrations_service_provider_id_fkey') THEN
            ALTER TABLE user_integrations 
            ADD CONSTRAINT user_integrations_service_provider_id_fkey 
            FOREIGN KEY (service_provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Updated user_integrations to reference service_providers';
    END IF;
END $$;

-- Step 3: Update integration_capabilities to reference service_providers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_capabilities') THEN
        -- Add new column for service_provider_id if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_capabilities' AND column_name = 'service_provider_id') THEN
            ALTER TABLE integration_capabilities ADD COLUMN service_provider_id UUID;
        END IF;
        
        -- Update integration_capabilities to reference service_providers directly
        UPDATE integration_capabilities ic
        SET service_provider_id = ir.required_oauth_provider_id
        FROM integrations_renamed ir
        WHERE ic.integration_id = ir.id
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations_renamed');
        
        -- For capabilities that reference service_providers directly (like ClickSend)
        UPDATE integration_capabilities ic
        SET service_provider_id = ic.integration_id
        WHERE ic.service_provider_id IS NULL
        AND EXISTS (SELECT 1 FROM service_providers sp WHERE sp.id = ic.integration_id);
        
        -- Add foreign key constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'integration_capabilities_service_provider_id_fkey') THEN
            ALTER TABLE integration_capabilities 
            ADD CONSTRAINT integration_capabilities_service_provider_id_fkey 
            FOREIGN KEY (service_provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Updated integration_capabilities to reference service_providers';
    END IF;
END $$;

-- Step 4: Update agent_integration_permissions to work with service_providers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_integration_permissions') THEN
        -- Add service_provider_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_integration_permissions' AND column_name = 'service_provider_id') THEN
            ALTER TABLE agent_integration_permissions ADD COLUMN service_provider_id UUID;
        END IF;
        
        -- Update permissions to reference service_providers through user_integration_credentials
        UPDATE agent_integration_permissions aip
        SET service_provider_id = uic.oauth_provider_id
        FROM user_integration_credentials uic
        WHERE aip.user_oauth_connection_id = uic.id
        AND aip.service_provider_id IS NULL;
        
        -- Add foreign key constraint
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'agent_integration_permissions_service_provider_id_fkey') THEN
            ALTER TABLE agent_integration_permissions 
            ADD CONSTRAINT agent_integration_permissions_service_provider_id_fkey 
            FOREIGN KEY (service_provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Updated agent_integration_permissions to reference service_providers';
    END IF;
END $$;

-- Step 5: Create a view to maintain compatibility with integrations queries
CREATE OR REPLACE VIEW integrations AS
SELECT 
    sp.id,
    COALESCE((sp.configuration_metadata->>'category_id')::UUID, 
             (SELECT id FROM integration_categories WHERE name = 'API Services' LIMIT 1)) as category_id,
    sp.display_name as name,
    COALESCE(sp.configuration_metadata->>'integration_description', 
             'Integration service for ' || sp.display_name) as description,
    COALESCE(sp.configuration_metadata->>'icon_name', 'Settings') as icon_name,
    CASE WHEN sp.is_enabled THEN 'available' ELSE 'unavailable' END as status,
    COALESCE((sp.configuration_metadata->>'is_popular')::boolean, false) as is_popular,
    COALESCE(sp.configuration_metadata->>'documentation_url', '') as documentation_url,
    COALESCE(sp.configuration_metadata->'configuration_schema', '{}'::jsonb) as configuration_schema,
    sp.id as required_oauth_provider_id,
    sp.id as required_tool_catalog_id,
    COALESCE((sp.configuration_metadata->>'display_order')::integer, 999) as display_order,
    sp.is_enabled as is_active,
    sp.created_at,
    sp.updated_at,
    COALESCE(sp.configuration_metadata->>'agent_classification', 'tool') as agent_classification
FROM service_providers sp
WHERE sp.is_enabled = true;

COMMENT ON VIEW integrations IS 'Compatibility view that presents service_providers as integrations';

-- Step 6: Update RLS policies for the new integrations view
-- Enable RLS on service_providers if not already enabled
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

-- Create policies for service_providers (integrations access)
DROP POLICY IF EXISTS "Public read access to service providers" ON service_providers;
CREATE POLICY "Public read access to service providers" ON service_providers
    FOR SELECT USING (is_enabled = true);

DROP POLICY IF EXISTS "Service role full access to service providers" ON service_providers;
CREATE POLICY "Service role full access to service providers" ON service_providers
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 7: Drop the integrations_renamed table and related objects
DO $$
BEGIN
    -- Drop dependent views first
    DROP VIEW IF EXISTS integrations_with_categories CASCADE;
    
    -- Drop triggers
    DROP TRIGGER IF EXISTS set_integrations_updated_at ON integrations_renamed;
    
    -- Drop indexes
    DROP INDEX IF EXISTS idx_integrations_agent_classification;
    DROP INDEX IF EXISTS idx_integrations_category_id;
    DROP INDEX IF EXISTS idx_integrations_popular;
    DROP INDEX IF EXISTS idx_integrations_status;
    
    -- Drop foreign key constraints from other tables
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_integrations_integration_id_fkey') THEN
        ALTER TABLE user_integrations DROP CONSTRAINT user_integrations_integration_id_fkey;
    END IF;
    
    -- Drop the table
    DROP TABLE IF EXISTS integrations_renamed CASCADE;
    
    RAISE NOTICE 'Dropped integrations_renamed table and related objects';
END $$;

-- Step 8: Update ClickSend integration to use service_providers correctly
-- Ensure ClickSend appears in the integrations view
UPDATE service_providers 
SET configuration_metadata = configuration_metadata || jsonb_build_object(
    'integration_description', 'Professional SMS and MMS messaging service. Send text messages and multimedia content to mobile phones worldwide with delivery tracking and analytics.',
    'icon_name', 'MessageSquare',
    'is_popular', true,
    'documentation_url', 'https://developers.clicksend.com/',
    'configuration_schema', '{
        "type": "object",
        "properties": {
            "username": {
                "type": "string",
                "title": "ClickSend Username",
                "description": "Your ClickSend account username"
            },
            "api_key": {
                "type": "string",
                "title": "API Key",
                "description": "Your ClickSend API key from the dashboard",
                "format": "password"
            },
            "connection_name": {
                "type": "string",
                "title": "Connection Name",
                "description": "A friendly name for this connection (optional)",
                "default": "ClickSend SMS/MMS"
            },
            "default_sender_id": {
                "type": "string",
                "title": "Default Sender ID",
                "description": "Default sender ID or phone number (optional)"
            }
        },
        "required": ["username", "api_key"]
    }'::jsonb,
    'display_order', 1,
    'agent_classification', 'channel',
    'category_id', (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication' LIMIT 1)::text
)
WHERE name = 'clicksend_sms';

-- Step 9: Verify the migration
DO $$
DECLARE
    service_provider_count INTEGER;
    integration_view_count INTEGER;
    clicksend_count INTEGER;
    capability_count INTEGER;
BEGIN
    -- Check service_providers count
    SELECT COUNT(*) INTO service_provider_count FROM service_providers WHERE is_enabled = true;
    
    -- Check integrations view count
    SELECT COUNT(*) INTO integration_view_count FROM integrations;
    
    -- Check ClickSend specifically
    SELECT COUNT(*) INTO clicksend_count FROM integrations WHERE name LIKE '%ClickSend%';
    
    -- Check integration capabilities
    SELECT COUNT(*) INTO capability_count FROM integration_capabilities WHERE service_provider_id IS NOT NULL;
    
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '📊 Active service providers: %', service_provider_count;
    RAISE NOTICE '🔗 Integrations available: %', integration_view_count;
    RAISE NOTICE '📱 ClickSend integrations: %', clicksend_count;
    RAISE NOTICE '🛠️  Capabilities with service provider links: %', capability_count;
    
    IF clicksend_count = 0 THEN
        RAISE WARNING '⚠️  ClickSend integration not found in integrations view';
    END IF;
END $$;

COMMIT;
