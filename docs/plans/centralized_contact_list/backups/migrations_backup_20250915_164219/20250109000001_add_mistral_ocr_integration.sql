-- Migration: Add Mistral OCR Integration
-- Purpose: Add Mistral AI as a service provider for OCR capabilities
-- Date: January 9, 2025

-- Step 1: Add Mistral AI as a service provider
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  discovery_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'mistral_ai',
  'Mistral AI',
  'https://api.mistral.ai/v1/oauth/authorize', -- Placeholder - Mistral uses API keys
  'https://api.mistral.ai/v1/oauth/token',     -- Placeholder - Mistral uses API keys
  'https://api.mistral.ai/v1/oauth/revoke',    -- Placeholder - Mistral uses API keys
  null,
  '["ocr", "document_processing"]'::jsonb,
  false, -- API key based, no PKCE
  'header',
  true,
  '{
    "api_base_url": "https://api.mistral.ai/v1",
    "ocr_endpoint": "/ocr",
    "supported_formats": ["pdf", "png", "jpg", "jpeg", "gif", "bmp", "tiff", "docx", "pptx"],
    "max_file_size_mb": 20,
    "max_pages": 100,
    "authentication_type": "api_key",
    "header_format": "Bearer {api_key}",
    "pricing_model": "per_page",
    "features": {
      "structured_output": true,
      "image_extraction": true,
      "bbox_annotation": true,
      "document_annotation": true,
      "markdown_output": true,
      "multi_page_support": true
    }
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Step 2: Add helpful comment about the service provider
COMMENT ON TABLE service_providers IS 'Service providers for OAuth and API key integrations including Mistral AI OCR';

-- Step 3: Create helpful views for Mistral OCR integration (conditional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integration_credentials') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW mistral_ocr_connections AS
        SELECT 
            uic.id,
            uic.user_id,
            uic.connection_name,
            uic.connection_status,
            uic.connection_metadata,
            uic.created_at,
            uic.updated_at,
            sp.display_name as provider_name,
            sp.configuration_metadata as provider_config
        FROM user_integration_credentials uic
        JOIN service_providers sp ON uic.oauth_provider_id = sp.id
        WHERE sp.name = ''mistral_ai''
          AND uic.credential_type = ''api_key'';
        ';
        RAISE NOTICE 'Created mistral_ocr_connections view';
    ELSE
        RAISE NOTICE 'Skipping mistral_ocr_connections view - user_integration_credentials table does not exist yet';
    END IF;
END $$;

-- Comment on view (conditional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'mistral_ocr_connections') THEN
        COMMENT ON VIEW mistral_ocr_connections IS 'View for Mistral OCR connections with provider details';
        RAISE NOTICE 'Added comment to mistral_ocr_connections view';
    ELSE
        RAISE NOTICE 'Skipping comment on mistral_ocr_connections view - view does not exist';
    END IF;
END $$;

-- Step 4: Add RLS policies for Mistral OCR (conditional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integration_credentials') THEN
        -- Enable RLS
        ALTER TABLE user_integration_credentials ENABLE ROW LEVEL SECURITY;
        
        -- Users can only see their own Mistral OCR connections
        CREATE POLICY "Users can view own Mistral OCR connections" ON user_integration_credentials
            FOR SELECT USING (
                user_id = auth.uid() AND
                oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
            );

        -- Users can create their own Mistral OCR connections
        CREATE POLICY "Users can create own Mistral OCR connections" ON user_integration_credentials
            FOR INSERT WITH CHECK (
                user_id = auth.uid() AND
                oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
            );

        -- Users can update their own Mistral OCR connections
        CREATE POLICY "Users can update own Mistral OCR connections" ON user_integration_credentials
            FOR UPDATE USING (
                user_id = auth.uid() AND
                oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
            );

        -- Users can delete their own Mistral OCR connections
        CREATE POLICY "Users can delete own Mistral OCR connections" ON user_integration_credentials
            FOR DELETE USING (
                user_id = auth.uid() AND
                oauth_provider_id IN (SELECT id FROM service_providers WHERE name = 'mistral_ai')
            );
            
        RAISE NOTICE 'Created RLS policies for Mistral OCR on user_integration_credentials';
    ELSE
        RAISE NOTICE 'Skipping RLS policies for Mistral OCR - user_integration_credentials table does not exist yet';
    END IF;
END $$;
