-- Add Conversation Memory Tools as a service provider
-- These tools allow agents to search conversation history and summaries

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
  'conversation_memory',
  'Conversation Memory',
  'https://internal',  -- Not OAuth, internal tools
  'https://internal',  -- Not OAuth, internal tools
  NULL,
  '[]'::jsonb,
  false,
  'header',
  true,
  jsonb_build_object(
    'auth_type', 'none',
    'provider_type', 'mcp',
    'description', 'Search and retrieve conversation history, summaries, and context using vector similarity. Part of the Working Memory System.',
    'capabilities', jsonb_build_array(
      'search_working_memory',
      'search_conversation_summaries',
      'get_conversation_summary_board'
    ),
    'edge_function', 'conversation-memory-mcp',
    'is_internal', true,
    'requires_credentials', false
  )
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  configuration_metadata = EXCLUDED.configuration_metadata,
  updated_at = NOW();

-- Add tool descriptions for better agent understanding
COMMENT ON TABLE conversation_summary_boards IS 'Stores current conversation summaries with key facts, action items, and pending questions';
COMMENT ON TABLE conversation_summaries IS 'Historical conversation summaries with vector embeddings for semantic search';
COMMENT ON TABLE working_memory_chunks IS 'Short-term memory chunks from recent conversations with vector embeddings';
