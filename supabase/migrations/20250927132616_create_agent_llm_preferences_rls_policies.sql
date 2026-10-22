-- Create RLS policies for agent_llm_preferences table
-- This ensures users can only access LLM preferences for agents they own
-- Follows the same security model as the agents table

BEGIN;

-- Enable RLS on agent_llm_preferences table
ALTER TABLE public.agent_llm_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "agent_llm_prefs_user_access" ON public.agent_llm_preferences;
DROP POLICY IF EXISTS "agent_llm_prefs_service_access" ON public.agent_llm_preferences;

-- Create comprehensive policy for authenticated users
-- Users can only access LLM preferences for agents they own
CREATE POLICY "agent_llm_prefs_user_access" ON public.agent_llm_preferences
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_llm_preferences.agent_id 
      AND agents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = agent_llm_preferences.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Create policy for service role to have full access
-- This is needed for Edge Functions, triggers, and admin operations
CREATE POLICY "agent_llm_prefs_service_access" ON public.agent_llm_preferences
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure proper permissions are granted
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_llm_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_llm_preferences TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.agent_llm_preferences IS 'Agent LLM preferences with RLS policies - users can only access preferences for agents they own';

-- Add comments on policies for clarity
COMMENT ON POLICY "agent_llm_prefs_user_access" ON public.agent_llm_preferences IS 
  'Allows authenticated users to manage LLM preferences only for agents they own';

COMMENT ON POLICY "agent_llm_prefs_service_access" ON public.agent_llm_preferences IS 
  'Allows service role full access for system operations, triggers, and Edge Functions';

COMMIT;
