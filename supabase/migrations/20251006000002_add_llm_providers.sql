-- Add OpenAI and Anthropic as service providers for LLM API keys
-- These will be used with the existing integration credentials system
-- Note: Using dummy OAuth endpoints since service_providers requires them, 
-- but actual auth will use API keys via user_integration_credentials

-- Insert OpenAI provider
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'openai',
  'OpenAI',
  'https://platform.openai.com/api-keys', -- Not OAuth, but required field
  'https://platform.openai.com/api-keys', -- Not OAuth, but required field
  NULL,
  '[]'::jsonb,
  false,
  'header',
  true,
  jsonb_build_object(
    'auth_type', 'api_key',
    'api_base_url', 'https://api.openai.com/v1',
    'docs_url', 'https://platform.openai.com/docs',
    'api_key_url', 'https://platform.openai.com/api-keys',
    'requires_api_key', true,
    'models', jsonb_build_array('gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'),
    'capabilities', jsonb_build_array('chat', 'completion', 'embeddings', 'tools'),
    'description', 'OpenAI LLM API for GPT models (GPT-4, GPT-4o, GPT-3.5)'
  )
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Insert Anthropic provider
INSERT INTO service_providers (
  name,
  display_name,
  authorization_endpoint,
  token_endpoint,
  revoke_endpoint,
  scopes_supported,
  pkce_required,
  client_credentials_location,
  is_enabled,
  configuration_metadata
) VALUES (
  'anthropic',
  'Anthropic',
  'https://console.anthropic.com/settings/keys', -- Not OAuth, but required field
  'https://console.anthropic.com/settings/keys', -- Not OAuth, but required field
  NULL,
  '[]'::jsonb,
  false,
  'header',
  true,
  jsonb_build_object(
    'auth_type', 'api_key',
    'api_base_url', 'https://api.anthropic.com/v1',
    'docs_url', 'https://docs.anthropic.com',
    'api_key_url', 'https://console.anthropic.com/settings/keys',
    'requires_api_key', true,
    'models', jsonb_build_array(
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307'
    ),
    'capabilities', jsonb_build_array('chat', 'completion', 'tools', 'streaming'),
    'description', 'Anthropic Claude API for Claude models (Claude 4.5, Claude 4, Claude 3.x)'
  )
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = now();

-- Add helpful comment
COMMENT ON TABLE service_providers IS 'Service providers including OAuth and API key integrations. OpenAI and Anthropic added for LLM API key management.';

