-- Remove redundant model field from agents table
-- The model selection should be handled by agent_llm_preferences table
-- which is part of the centralized LLM system

BEGIN;

-- Drop the check constraint first
ALTER TABLE public.agents 
DROP CONSTRAINT IF EXISTS agents_model_check;

-- Drop the index
DROP INDEX IF EXISTS idx_agents_model;

-- Remove the model column
ALTER TABLE public.agents 
DROP COLUMN IF EXISTS model;

-- Remove the comment since the column no longer exists
-- (Comments are automatically removed with the column)

COMMIT;
