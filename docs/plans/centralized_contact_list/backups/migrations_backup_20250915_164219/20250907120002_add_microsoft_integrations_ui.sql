-- =====================================================
-- MICROSOFT INTEGRATION CATEGORIES MIGRATION
-- =====================================================
-- Add Microsoft integration categories for UI organization
-- Date: September 7, 2025
-- Purpose: Enable proper categorization of Microsoft integrations in the UI

BEGIN;

-- Step 1: Ensure required integration categories exist
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES 
    ('Communication', 'Communication and collaboration tools', 'MessageSquare', 1, true),
    ('Productivity', 'Productivity and workflow tools', 'Mail', 2, true),
    ('Storage', 'File storage and sharing services', 'Cloud', 3, true)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Step 2: Update service_providers configuration metadata to include UI display information
UPDATE service_providers 
SET configuration_metadata = configuration_metadata || '{
    "ui_category": "Communication",
    "ui_description": "Send messages, create meetings, and collaborate in Microsoft Teams channels and chats",
    "ui_icon": "MessageSquare",
    "ui_popular": true,
    "ui_documentation_url": "https://docs.microsoft.com/en-us/graph/api/resources/teams-api-overview"
}'::jsonb
WHERE name = 'microsoft-teams';

UPDATE service_providers 
SET configuration_metadata = configuration_metadata || '{
    "ui_category": "Productivity", 
    "ui_description": "Send emails, manage calendar events, and access contacts in Microsoft Outlook",
    "ui_icon": "Mail",
    "ui_popular": true,
    "ui_documentation_url": "https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview"
}'::jsonb
WHERE name = 'microsoft-outlook';

UPDATE service_providers 
SET configuration_metadata = configuration_metadata || '{
    "ui_category": "Storage",
    "ui_description": "Upload, download, share, and manage files in Microsoft OneDrive",
    "ui_icon": "Cloud",
    "ui_popular": true,
    "ui_documentation_url": "https://docs.microsoft.com/en-us/graph/api/resources/onedrive"
}'::jsonb
WHERE name = 'microsoft-onedrive';

-- Step 3: Verify integration categories were created/updated
DO $$
DECLARE
    v_category RECORD;
    v_provider RECORD;
BEGIN
    RAISE NOTICE 'Integration categories status:';
    
    FOR v_category IN 
        SELECT name, description, display_order, is_active
        FROM integration_categories 
        WHERE name IN ('Communication', 'Productivity', 'Storage')
        ORDER BY display_order
    LOOP
        RAISE NOTICE '  ✓ % (order: %, active: %) - %', 
            v_category.name,
            v_category.display_order,
            v_category.is_active,
            v_category.description;
    END LOOP;
    
    RAISE NOTICE 'Microsoft service provider UI metadata:';
    
    FOR v_provider IN 
        SELECT 
            name, 
            display_name,
            configuration_metadata->>'ui_category' as ui_category,
            configuration_metadata->>'ui_description' as ui_description,
            configuration_metadata->>'ui_icon' as ui_icon,
            configuration_metadata->>'ui_popular' as ui_popular
        FROM service_providers 
        WHERE name LIKE 'microsoft-%'
        ORDER BY name
    LOOP
        RAISE NOTICE '  ✓ % (%) - Category: %, Icon: %, Popular: %', 
            v_provider.display_name,
            v_provider.name,
            v_provider.ui_category,
            v_provider.ui_icon,
            v_provider.ui_popular;
    END LOOP;
END $$;

-- Step 4: Add helpful comments
COMMENT ON TABLE integration_categories IS 'Categories for organizing service providers and integrations in the UI';

COMMIT;

-- Post-migration validation
DO $$
DECLARE
    v_total_categories INTEGER;
    v_microsoft_providers INTEGER;
BEGIN
    -- Count categories and Microsoft providers
    SELECT COUNT(*) INTO v_total_categories FROM integration_categories WHERE is_active = true;
    SELECT COUNT(*) INTO v_microsoft_providers FROM service_providers 
    WHERE name LIKE 'microsoft-%' AND is_enabled = true;
    
    RAISE NOTICE 'Post-migration summary:';
    RAISE NOTICE '  - Total active categories: %', v_total_categories;
    RAISE NOTICE '  - Microsoft service providers: %', v_microsoft_providers;
    RAISE NOTICE '  - Microsoft integrations are ready for UI display via service_providers table';
    
    -- Verify Microsoft providers have UI metadata
    IF EXISTS (
        SELECT 1 FROM service_providers 
        WHERE name LIKE 'microsoft-%' 
        AND (configuration_metadata->>'ui_category' IS NULL OR configuration_metadata->>'ui_description' IS NULL)
    ) THEN
        RAISE EXCEPTION 'Some Microsoft service providers are missing UI metadata';
    END IF;
    
    RAISE NOTICE 'Microsoft integration categories migration completed successfully!';
END $$;
