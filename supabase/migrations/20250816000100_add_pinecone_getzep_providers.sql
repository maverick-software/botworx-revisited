-- Add Pinecone and GetZep to service_providers and integrations
-- These are API key providers managed via Vault. No OAuth URLs required.

DO $$
BEGIN
  -- Ensure service_providers has required columns (schema may vary across envs)
  -- Insert Pinecone provider if missing
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'pinecone') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'pinecone',
      'Pinecone',
      '',
      '',
      '',
      '[]'::jsonb,
      jsonb_build_object('credential_type','api_key'),
      true
    );
  END IF;

  -- Insert GetZep provider if missing
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'getzep') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'getzep',
      'GetZep',
      '',
      '',
      '',
      '[]'::jsonb,
      jsonb_build_object('credential_type','api_key'),
      true
    );
  END IF;
END$$;

-- Link providers to Integrations catalog if present
-- Create integrations if missing under API Integrations category
DO $$
DECLARE
  cat_id UUID;
  pinecone_provider_id UUID;
  getzep_provider_id UUID;
BEGIN
  SELECT id INTO cat_id FROM integration_categories WHERE name = 'API Integrations' LIMIT 1;
  IF cat_id IS NULL THEN
    INSERT INTO integration_categories (name, description, icon_name, display_order)
    VALUES ('API Integrations', 'Connect to external APIs and services', 'Globe', 1)
    RETURNING id INTO cat_id;
  END IF;

  SELECT id INTO pinecone_provider_id FROM service_providers WHERE name = 'pinecone';
  SELECT id INTO getzep_provider_id FROM service_providers WHERE name = 'getzep';

  -- Pinecone integration
  IF NOT EXISTS (SELECT 1 FROM integrations WHERE name = 'Pinecone') THEN
    INSERT INTO integrations (
      id, category_id, name, description, icon_name, status, is_popular, documentation_url, required_oauth_provider_id, display_order
    ) VALUES (
      gen_random_uuid(),
      cat_id,
      'Pinecone',
      'Securely store your Pinecone API key in Vault and enable vector search for agents.',
      'Database',
      'available',
      true,
      'https://docs.pinecone.io/',
      pinecone_provider_id,
      10
    );
  END IF;

  -- GetZep integration
  IF NOT EXISTS (SELECT 1 FROM integrations WHERE name = 'GetZep') THEN
    INSERT INTO integrations (
      id, category_id, name, description, icon_name, status, is_popular, documentation_url, required_oauth_provider_id, display_order
    ) VALUES (
      gen_random_uuid(),
      cat_id,
      'GetZep',
      'Securely store your GetZep API key in Vault and enable knowledge graph retrieval.',
      'Database',
      'available',
      false,
      'https://docs.getzep.com/',
      getzep_provider_id,
      11
    );
  END IF;
END$$;


