-- Migration: Create tool user input request system
-- Purpose: Allow tools to request additional context from users before execution
-- File: 20251011000003_create_tool_user_input_system.sql

-- Create table for user input requests
CREATE TABLE IF NOT EXISTS tool_user_input_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    tool_call_id TEXT NOT NULL UNIQUE,
    required_fields JSONB NOT NULL,
    reason TEXT,
    user_inputs JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Index for quick lookups
    CONSTRAINT tool_user_input_requests_conversation_tool_call UNIQUE (conversation_id, tool_call_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tool_user_input_requests_conversation 
ON tool_user_input_requests(conversation_id, status);

CREATE INDEX IF NOT EXISTS idx_tool_user_input_requests_tool_call 
ON tool_user_input_requests(tool_call_id);

CREATE INDEX IF NOT EXISTS idx_tool_user_input_requests_pending 
ON tool_user_input_requests(status, created_at) 
WHERE status = 'pending';

-- Enable RLS
ALTER TABLE tool_user_input_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own input requests" 
ON tool_user_input_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create input requests" 
ON tool_user_input_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own input requests" 
ON tool_user_input_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access" 
ON tool_user_input_requests
FOR ALL
USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON tool_user_input_requests TO authenticated;
GRANT ALL ON tool_user_input_requests TO service_role;

-- Add helpful comments
COMMENT ON TABLE tool_user_input_requests IS 'Stores requests for additional user input required by tools before execution';
COMMENT ON COLUMN tool_user_input_requests.tool_call_id IS 'Unique identifier for the tool call that needs input';
COMMENT ON COLUMN tool_user_input_requests.required_fields IS 'Array of field definitions needed from the user';
COMMENT ON COLUMN tool_user_input_requests.user_inputs IS 'User-provided values for the required fields';
COMMENT ON COLUMN tool_user_input_requests.status IS 'pending: waiting for user, completed: user provided input, cancelled: request no longer needed';

