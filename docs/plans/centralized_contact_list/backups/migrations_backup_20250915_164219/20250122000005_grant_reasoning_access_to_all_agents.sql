-- Grant reasoning tool access to all agents automatically
-- Simple approach: when agent is created, insert the right permissions

-- Skip this migration if required tables don't exist (for shadow database compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations_renamed') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integration_credentials') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_integration_permissions') THEN
        RAISE NOTICE 'Skipping reasoning access grant - required tables do not exist yet';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating reasoning access grant trigger - required tables exist';
    
    EXECUTE $MIGRATION$
    -- Create trigger to automatically grant reasoning access to new agents
CREATE OR REPLACE FUNCTION grant_reasoning_access_to_new_agent()
RETURNS TRIGGER AS $FUNC$
DECLARE
  reasoning_integration_id UUID;
  reasoning_credential_id UUID;
BEGIN
  -- Get the Advanced Reasoning integration ID
  SELECT id INTO reasoning_integration_id 
  FROM integrations_renamed 
  WHERE name = 'Advanced Reasoning' 
  LIMIT 1;
  
  IF reasoning_integration_id IS NULL THEN
    RAISE NOTICE 'Advanced Reasoning integration not found, skipping permission grant';
    RETURN NEW;
  END IF;
  
  -- Check if internal reasoning credential already exists for this user
  SELECT id INTO reasoning_credential_id
  FROM user_integration_credentials
  WHERE user_id = NEW.user_id 
  AND connection_name = 'Internal Reasoning System';
  
  -- If not found, create it
  IF reasoning_credential_id IS NULL THEN
    INSERT INTO user_integration_credentials (
      user_id,
      oauth_provider_id,
      connection_name,
      external_username,
      external_user_id,
      credential_type,
      connection_status,
      scopes_granted,
      vault_access_token_id,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      '00000000-0000-0000-0000-000000000002'::uuid, -- Internal system OAuth provider
      'Internal Reasoning System',
      'system',
      'internal_system_' || NEW.user_id,
      'api_key'::connection_credential_type_enum,
      'active',
      '["reasoning_execute_chain", "reasoning_inductive", "reasoning_deductive", "reasoning_abductive", "iterative_processing", "confidence_tracking", "memory_integration", "safety_controls"]'::jsonb,
      'internal_reasoning_token',
      NOW(),
      NOW()
    ) 
    RETURNING id INTO reasoning_credential_id;
  END IF;
  

  
  -- Grant reasoning permissions to the new agent
  INSERT INTO agent_integration_permissions (
    agent_id,
    user_oauth_connection_id,
    allowed_scopes,
    permission_level,
    granted_by_user_id,
    is_active,
    granted_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    reasoning_credential_id,
    '["reasoning_execute_chain", "reasoning_inductive", "reasoning_deductive", "reasoning_abductive", "iterative_processing", "confidence_tracking", "memory_integration", "safety_controls"]'::jsonb,
    'full_access',
    NEW.user_id,
    true,
    NOW(),
    NOW(),
    NOW()
  ) ON CONFLICT (agent_id, user_oauth_connection_id) DO NOTHING;
  
  RETURN NEW;
END;
$FUNC$ LANGUAGE plpgsql;

-- Create trigger for new agents
DROP TRIGGER IF EXISTS trigger_grant_reasoning_access_to_new_agent ON agents;
CREATE TRIGGER trigger_grant_reasoning_access_to_new_agent
  AFTER INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION grant_reasoning_access_to_new_agent();

-- Note: Existing agents are handled by separate SQL script (grant_reasoning_permissions.sql)
    $MIGRATION$;
END $$;
