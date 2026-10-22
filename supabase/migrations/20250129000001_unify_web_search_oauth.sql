-- Migration to unify web search with OAuth system
-- This allows web search API keys to be treated the same as OAuth tokens

-- Add web search providers to service_providers table
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  scopes_supported,
  created_at,
  updated_at
) VALUES 
(
  'serper_api',
  'Serper API',
  'https://serper.dev', -- Not used for API key auth
  'https://serper.dev', -- Not used for API key auth
  '["web_search", "news_search", "scrape_and_summarize"]'::jsonb,
  NOW(),
  NOW()
),
(
  'serpapi',
  'SerpAPI',
  'https://serpapi.com', -- Not used for API key auth
  'https://serpapi.com', -- Not used for API key auth
  '["web_search", "news_search", "scrape_and_summarize"]'::jsonb,
  NOW(),
  NOW()
),
(
  'brave_search',
  'Brave Search API',
  'https://api.search.brave.com', -- Not used for API key auth
  'https://api.search.brave.com', -- Not used for API key auth
  '["web_search", "news_search", "scrape_and_summarize"]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  scopes_supported = EXCLUDED.scopes_supported,
  updated_at = NOW();

-- Comment explaining the approach
COMMENT ON TABLE service_providers IS 'Unified provider table supporting both OAuth providers (like Gmail) and API key providers (like web search APIs). API key providers use this table for consistency but store keys differently.';

-- Add indices for better performance
CREATE INDEX IF NOT EXISTS idx_service_providers_name ON service_providers(name);
CREATE INDEX IF NOT EXISTS idx_user_oauth_connections_provider_user ON user_oauth_connections(oauth_provider_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_oauth_permissions_agent_connection ON agent_oauth_permissions(agent_id, user_oauth_connection_id);