-- Normalize scopes for GetZep connections: replace legacy 'vector_search' with graph/memory scopes
BEGIN;

-- Update connections where provider is getzep and scopes include 'vector_search'
UPDATE user_oauth_connections c
SET scopes_granted = '["graph_read","graph_write","memory_read","memory_write"]'::jsonb,
    updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) = 'getzep'
  AND (c.scopes_granted @> '["vector_search"]'::jsonb);

-- Optionally: if any GetZep connections have empty scopes, set them to defaults
UPDATE user_oauth_connections c
SET scopes_granted = '["graph_read","graph_write","memory_read","memory_write"]'::jsonb,
    updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) = 'getzep'
  AND (c.scopes_granted IS NULL OR c.scopes_granted = '[]'::jsonb);

COMMIT;


