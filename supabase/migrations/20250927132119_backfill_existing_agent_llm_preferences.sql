-- Backfill agent_llm_preferences for existing agents that don't have them
-- This ensures all existing agents get default LLM preferences

BEGIN;

-- Insert default LLM preferences for agents that don't have them yet
INSERT INTO public.agent_llm_preferences (
  agent_id,
  provider,
  model,
  params,
  embedding_model
)
SELECT 
  a.id as agent_id,
  'openai' as provider,
  'gpt-4o-mini' as model,
  '{}' as params,
  'text-embedding-3-small' as embedding_model
FROM public.agents a
LEFT JOIN public.agent_llm_preferences alp ON a.id = alp.agent_id
WHERE alp.agent_id IS NULL;

-- Log how many records were created
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Created LLM preferences for % existing agents', inserted_count;
END $$;

COMMIT;
