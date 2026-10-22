-- Add metadata column to agents table for storing settings and other configuration
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.agents.metadata IS 'Stores agent configuration including settings for knowledge graph, memory preferences, and other features';

-- Create an index for better query performance on metadata
CREATE INDEX IF NOT EXISTS idx_agents_metadata ON public.agents USING GIN (metadata);

-- Update RLS policies to ensure metadata is accessible
-- The existing policies should already cover this, but let's ensure they're correct
DROP POLICY IF EXISTS "Users can view their own agents" ON public.agents;
CREATE POLICY "Users can view their own agents" ON public.agents
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own agents" ON public.agents;
CREATE POLICY "Users can create their own agents" ON public.agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own agents" ON public.agents;
CREATE POLICY "Users can update their own agents" ON public.agents
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own agents" ON public.agents;
CREATE POLICY "Users can delete their own agents" ON public.agents
    FOR DELETE USING (auth.uid() = user_id);
