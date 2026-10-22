-- Add missing service providers for new integration modals
-- These are API key providers managed via Vault. No OAuth URLs required.

DO $$
BEGIN
  -- Insert Serper API provider if missing
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'serper_api') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, 
      discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'serper_api',
      'Serper API',
      '',
      '',
      '',
      '["web_search", "news_search", "image_search", "local_search"]'::jsonb,
      jsonb_build_object('credential_type','api_key', 'base_url', 'https://google.serper.dev'),
      true
    );
  END IF;

  -- Insert SerpAPI provider if missing
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'serpapi') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, 
      discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'serpapi',
      'SerpAPI',
      '',
      '',
      '',
      '["web_search", "news_search", "image_search", "video_search", "shopping_search"]'::jsonb,
      jsonb_build_object('credential_type','api_key', 'base_url', 'https://serpapi.com/search'),
      true
    );
  END IF;

  -- Insert Brave Search provider if missing
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'brave_search') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, 
      discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'brave_search',
      'Brave Search API',
      '',
      '',
      '',
      '["web_search", "news_search", "image_search"]'::jsonb,
      jsonb_build_object('credential_type','api_key', 'base_url', 'https://api.search.brave.com/res/v1'),
      true
    );
  END IF;

  -- Ensure Pinecone provider exists (may already be created)
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'pinecone') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, 
      discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'pinecone',
      'Pinecone',
      '',
      '',
      '',
      '["vector_search", "vector_upsert", "vector_delete", "index_stats"]'::jsonb,
      jsonb_build_object('credential_type','api_key'),
      true
    );
  END IF;

  -- Ensure GetZep provider exists (may already be created)
  IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'getzep') THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint, 
      discovery_endpoint, scopes_supported, configuration_metadata, is_enabled
    ) VALUES (
      gen_random_uuid(),
      'getzep',
      'GetZep',
      '',
      '',
      '',
      '["memory_read", "memory_write", "session_management", "knowledge_graph"]'::jsonb,
      jsonb_build_object('credential_type','api_key'),
      true
    );
  END IF;

END$$;

-- Add comment for documentation
COMMENT ON TABLE service_providers IS 'Unified provider table supporting both OAuth providers (like Gmail) and API key providers (like web search APIs, Pinecone, GetZep). API key providers use this table for consistency but store keys in Supabase Vault.';
