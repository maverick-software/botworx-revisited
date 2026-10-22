-- Create Multi-Step Task Workflow System
-- Date: August 29, 2025
-- Purpose: Add sequential step support to scheduled tasks with context passing

BEGIN;

-- Create enum for task step status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_step_status') THEN
        CREATE TYPE task_step_status AS ENUM (
            'pending',
            'running', 
            'completed',
            'failed',
            'skipped'
        );
    END IF;
END
$$;

-- Task Steps Table
-- Stores individual steps within a scheduled task for sequential execution
CREATE TABLE IF NOT EXISTS task_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
    
    -- Step identification and ordering
    step_order INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    instructions TEXT NOT NULL,
    
    -- Context management
    include_previous_context BOOLEAN NOT NULL DEFAULT false,
    context_data JSONB DEFAULT '{}'::jsonb,
    
    -- Execution tracking
    status task_step_status NOT NULL DEFAULT 'pending',
    execution_result JSONB DEFAULT '{}'::jsonb,
    execution_started_at TIMESTAMPTZ,
    execution_completed_at TIMESTAMPTZ,
    execution_duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT task_steps_step_order_positive CHECK (step_order > 0),
    CONSTRAINT task_steps_retry_count_non_negative CHECK (retry_count >= 0),
    CONSTRAINT task_steps_step_name_length CHECK (char_length(step_name) BETWEEN 1 AND 100),
    CONSTRAINT task_steps_instructions_length CHECK (char_length(instructions) BETWEEN 10 AND 5000),
    CONSTRAINT unique_task_step_order UNIQUE (task_id, step_order)
);

-- Performance indexes for common query patterns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_task_id') THEN
        CREATE INDEX idx_task_steps_task_id ON task_steps(task_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_task_order') THEN
        CREATE INDEX idx_task_steps_task_order ON task_steps(task_id, step_order);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_status') THEN
        CREATE INDEX idx_task_steps_status ON task_steps(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_pending_order') THEN
        CREATE INDEX idx_task_steps_pending_order ON task_steps(task_id, step_order) WHERE status = 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_execution_time') THEN
        CREATE INDEX idx_task_steps_execution_time ON task_steps(execution_started_at, execution_completed_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_context_gin') THEN
        CREATE INDEX idx_task_steps_context_gin ON task_steps USING GIN (context_data);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_steps_result_gin') THEN
        CREATE INDEX idx_task_steps_result_gin ON task_steps USING GIN (execution_result);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can access steps for their own agent tasks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'task_steps_user_access') THEN
        CREATE POLICY task_steps_user_access ON task_steps
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM agent_tasks at
                    WHERE at.id = task_id
                    AND at.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM agent_tasks at
                    WHERE at.id = task_id
                    AND at.user_id = auth.uid()
                )
            );
    END IF;
END
$$;

-- Service role has full access for system operations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'task_steps_service_access') THEN
        CREATE POLICY task_steps_service_access ON task_steps
            FOR ALL TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- Update trigger for task_steps
CREATE OR REPLACE FUNCTION update_task_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'task_steps_updated_at_trigger') THEN
        CREATE TRIGGER task_steps_updated_at_trigger
            BEFORE UPDATE ON task_steps
            FOR EACH ROW
            EXECUTE FUNCTION update_task_steps_updated_at();
    END IF;
END
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON task_steps TO authenticated;
GRANT USAGE ON TYPE task_step_status TO authenticated;

-- Add table comments for documentation
COMMENT ON TABLE task_steps IS 'Individual steps within scheduled tasks supporting sequential execution with context passing';
COMMENT ON COLUMN task_steps.step_order IS 'Execution order of steps within a task (1, 2, 3...)';
COMMENT ON COLUMN task_steps.include_previous_context IS 'Whether to include previous step execution result as context';
COMMENT ON COLUMN task_steps.context_data IS 'JSONB storage for context data passed from previous steps';
COMMENT ON COLUMN task_steps.execution_result IS 'JSONB storage for step execution results and agent responses';
COMMENT ON TYPE task_step_status IS 'Enum defining step execution states: pending, running, completed, failed, skipped';

COMMIT;
