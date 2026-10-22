-- Normalize scopes for Pinecone connections: include upsert capability
BEGIN;

UPDATE user_oauth_connections c
SET scopes_granted = (
  CASE 
    WHEN NOT (c.scopes_granted @> '["vector_upsert"]'::jsonb)
    THEN (c.scopes_granted || '["vector_upsert"]'::jsonb)
    ELSE c.scopes_granted
  END
), updated_at = NOW()
FROM service_providers p
WHERE c.oauth_provider_id = p.id
  AND LOWER(p.name) = 'pinecone';

COMMIT;


