-- Add model field to agents table for LLM model selection
-- This allows agents to use different language models (GPT-4, Claude, etc.)

BEGIN;

-- Add model column to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4';

-- Add comment for documentation
COMMENT ON COLUMN public.agents.model IS 'The language model used by this agent (e.g., gpt-4, gpt-4-turbo, claude-3-opus, etc.)';

-- Create an index for better query performance when filtering by model
CREATE INDEX IF NOT EXISTS idx_agents_model ON public.agents USING btree (model);

-- Update existing agents to have the default model if they don't have one
UPDATE public.agents 
SET model = 'gpt-4' 
WHERE model IS NULL;

-- Add a check constraint to ensure only valid models are used
ALTER TABLE public.agents 
ADD CONSTRAINT agents_model_check 
CHECK (model IN (
    'gpt-4', 
    'gpt-4-turbo', 
    'gpt-4o',
    'gpt-3.5-turbo', 
    'claude-3-opus', 
    'claude-3-sonnet', 
    'claude-3-haiku',
    'claude-3-5-sonnet'
));

COMMIT;
