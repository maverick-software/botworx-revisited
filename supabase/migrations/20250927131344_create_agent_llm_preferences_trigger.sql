-- Create trigger to automatically create agent_llm_preferences when a new agent is created
-- This ensures every agent has LLM preferences with default values

BEGIN;

-- Create function to handle agent LLM preferences creation
CREATE OR REPLACE FUNCTION create_agent_llm_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default LLM preferences for the new agent
  INSERT INTO public.agent_llm_preferences (
    agent_id,
    provider,
    model,
    params,
    embedding_model
  ) VALUES (
    NEW.id,
    'openai',
    'gpt-4o-mini',
    '{}',
    'text-embedding-3-small'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after agent insertion
CREATE TRIGGER trigger_create_agent_llm_preferences
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION create_agent_llm_preferences();

-- Add comment for documentation
COMMENT ON FUNCTION create_agent_llm_preferences() IS 'Automatically creates default LLM preferences when a new agent is created';
COMMENT ON TRIGGER trigger_create_agent_llm_preferences ON public.agents IS 'Ensures every new agent gets default LLM preferences automatically';

COMMIT;
