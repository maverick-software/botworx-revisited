-- Migration: Create system-wide Gofr chat agent
-- Description: Creates a universal chat agent similar to ChatGPT/Claude that all users can access
-- Created: 2025-01-04
-- Note: The agent is owned by the first user but accessible to all users via RLS policies

DO $$
DECLARE
  v_first_user_id uuid;
  v_gofr_agent_id uuid;
BEGIN
  -- Get the first user from auth.users to own the system agent
  -- This is just to satisfy foreign key constraints; the agent is accessible to everyone
  SELECT id INTO v_first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no users exist yet, exit gracefully
  IF v_first_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Gofr agent will be created when first user signs up.';
    RETURN;
  END IF;

  -- Check if Gofr agent already exists
  SELECT id INTO v_gofr_agent_id
  FROM public.agents
  WHERE metadata->>'is_system_agent' = 'true' AND name = 'Gofr';

  -- If Gofr agent doesn't exist, create it
  IF v_gofr_agent_id IS NULL THEN
    -- Temporarily disable triggers to avoid auto-grant issues with system agent
    ALTER TABLE public.agents DISABLE TRIGGER auto_grant_contact_management_access_trigger;
    
    INSERT INTO public.agents (
      id,
      user_id,
      name,
      description,
      system_instructions,
      assistant_instructions,
      personality,
      active,
      avatar_url,
      metadata,
      reasoning_config,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_first_user_id,
      'Gofr',
      'Your universal AI assistant. I can help with a wide range of tasks including writing, analysis, coding, research, and creative projects.',
      'You are Gofr, a helpful, harmless, and honest AI assistant. You provide clear, accurate, and thoughtful responses to user queries. You can engage in conversations on a wide variety of topics and help users accomplish their goals.',
      'I''m here to help you with whatever you need. Feel free to ask me questions, request assistance with tasks, or just have a conversation. I''ll do my best to provide helpful, accurate information and support.',
      'helpful, professional, knowledgeable, conversational',
      true,
      null, -- Can be updated later with a custom avatar
      jsonb_build_object(
        'is_system_agent', true,
        'accessible_to_all_users', true,
        'agent_type', 'universal_chat'
      ),
      jsonb_build_object(
        'enabled', true,
        'threshold', 0.3,
        'timeout_ms', 30000,
        'max_iterations', 6,
        'preferred_styles', jsonb_build_array('inductive', 'deductive', 'abductive'),
        'confidence_threshold', 0.85,
        'safety_switch_enabled', true
      ),
      now(),
      now()
    )
    RETURNING id INTO v_gofr_agent_id;
    
    -- Re-enable triggers
    ALTER TABLE public.agents ENABLE TRIGGER auto_grant_contact_management_access_trigger;

    RAISE NOTICE 'Created Gofr system agent with ID: %', v_gofr_agent_id;
  ELSE
    RAISE NOTICE 'Gofr agent already exists with ID: %', v_gofr_agent_id;
  END IF;

END $$;

-- Create a function to get the Gofr agent ID for any user
CREATE OR REPLACE FUNCTION public.get_gofr_agent_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gofr_agent_id uuid;
BEGIN
  -- Get Gofr agent ID by looking for the system agent metadata
  SELECT id INTO v_gofr_agent_id
  FROM public.agents
  WHERE metadata->>'is_system_agent' = 'true' AND name = 'Gofr'
  LIMIT 1;

  RETURN v_gofr_agent_id;
END;
$$;

-- Create RLS policies to allow all authenticated users to read the Gofr agent
-- First, we need to ensure users can see the Gofr agent even though they don't own it

-- Add policy to allow reading system agents
CREATE POLICY "Users can view system agents"
ON public.agents
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  (metadata->>'is_system_agent')::boolean = true
);

-- Add policy to allow users to create conversations with the Gofr agent
-- Note: This assumes you have a conversations or chat_messages table
-- Adjust based on your actual schema

COMMENT ON FUNCTION public.get_gofr_agent_id() IS 
'Returns the UUID of the Gofr system agent that is accessible to all users';

