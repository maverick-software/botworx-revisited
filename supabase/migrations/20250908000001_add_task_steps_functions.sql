-- Task Steps Management Functions
-- Date: August 29, 2025
-- Purpose: Database functions for task step CRUD operations and workflow management

BEGIN;

-- Function to create a new task step
CREATE OR REPLACE FUNCTION create_task_step(
    p_task_id UUID,
    p_step_name TEXT,
    p_instructions TEXT,
    p_include_previous_context BOOLEAN DEFAULT false,
    p_step_order INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_step_id UUID;
    next_order INTEGER;
BEGIN
    -- Validate task exists and user has access
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks 
        WHERE id = p_task_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;
    
    -- Calculate next step order if not provided
    IF p_step_order IS NULL THEN
        SELECT COALESCE(MAX(step_order), 0) + 1 
        INTO next_order
        FROM task_steps 
        WHERE task_id = p_task_id;
    ELSE
        next_order := p_step_order;
        
        -- Shift existing steps if inserting in middle
        UPDATE task_steps 
        SET step_order = step_order + 1,
            updated_at = NOW()
        WHERE task_id = p_task_id 
        AND step_order >= p_step_order;
    END IF;
    
    -- Create the new step
    INSERT INTO task_steps (
        task_id,
        step_order,
        step_name,
        instructions,
        include_previous_context
    ) VALUES (
        p_task_id,
        next_order,
        p_step_name,
        p_instructions,
        p_include_previous_context
    ) RETURNING id INTO new_step_id;
    
    RETURN new_step_id;
END;
$$;

-- Function to update a task step
CREATE OR REPLACE FUNCTION update_task_step(
    p_step_id UUID,
    p_step_name TEXT DEFAULT NULL,
    p_instructions TEXT DEFAULT NULL,
    p_include_previous_context BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate step exists and user has access
    IF NOT EXISTS (
        SELECT 1 FROM task_steps ts
        JOIN agent_tasks at ON ts.task_id = at.id
        WHERE ts.id = p_step_id 
        AND at.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Step not found or access denied';
    END IF;
    
    -- Update the step with provided values
    UPDATE task_steps 
    SET 
        step_name = COALESCE(p_step_name, step_name),
        instructions = COALESCE(p_instructions, instructions),
        include_previous_context = COALESCE(p_include_previous_context, include_previous_context),
        updated_at = NOW()
    WHERE id = p_step_id;
    
    RETURN TRUE;
END;
$$;

-- Function to delete a task step
CREATE OR REPLACE FUNCTION delete_task_step(p_step_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    step_task_id UUID;
    step_order_to_delete INTEGER;
BEGIN
    -- Get step details and validate access
    SELECT task_id, step_order 
    INTO step_task_id, step_order_to_delete
    FROM task_steps ts
    JOIN agent_tasks at ON ts.task_id = at.id
    WHERE ts.id = p_step_id 
    AND at.user_id = auth.uid();
    
    IF step_task_id IS NULL THEN
        RAISE EXCEPTION 'Step not found or access denied';
    END IF;
    
    -- Prevent deletion of the last step
    IF (SELECT COUNT(*) FROM task_steps WHERE task_id = step_task_id) <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last step - tasks must have at least one step';
    END IF;
    
    -- Delete the step
    DELETE FROM task_steps WHERE id = p_step_id;
    
    -- Reorder remaining steps to close gaps
    UPDATE task_steps 
    SET step_order = step_order - 1,
        updated_at = NOW()
    WHERE task_id = step_task_id 
    AND step_order > step_order_to_delete;
    
    RETURN TRUE;
END;
$$;

-- Function to reorder task steps
CREATE OR REPLACE FUNCTION reorder_task_steps(
    p_task_id UUID,
    p_step_orders JSONB -- Array of {stepId: UUID, newOrder: INTEGER}
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    step_update JSONB;
    step_id UUID;
    new_order INTEGER;
BEGIN
    -- Validate task access
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks 
        WHERE id = p_task_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;
    
    -- Update each step's order
    FOR step_update IN SELECT * FROM jsonb_array_elements(p_step_orders)
    LOOP
        step_id := (step_update->>'stepId')::UUID;
        new_order := (step_update->>'newOrder')::INTEGER;
        
        -- Validate step belongs to task
        IF NOT EXISTS (
            SELECT 1 FROM task_steps 
            WHERE id = step_id 
            AND task_id = p_task_id
        ) THEN
            RAISE EXCEPTION 'Step % does not belong to task %', step_id, p_task_id;
        END IF;
        
        -- Update step order
        UPDATE task_steps 
        SET step_order = new_order,
            updated_at = NOW()
        WHERE id = step_id;
    END LOOP;
    
    RETURN TRUE;
END;
$$;

-- Function to get all steps for a task with execution context
CREATE OR REPLACE FUNCTION get_task_steps_with_context(p_task_id UUID)
RETURNS TABLE (
    step_id UUID,
    step_order INTEGER,
    step_name TEXT,
    instructions TEXT,
    include_previous_context BOOLEAN,
    context_data JSONB,
    status task_step_status,
    execution_result JSONB,
    previous_step_result JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate task access
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks 
        WHERE id = p_task_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Task not found or access denied';
    END IF;
    
    RETURN QUERY
    SELECT 
        ts.id as step_id,
        ts.step_order,
        ts.step_name,
        ts.instructions,
        ts.include_previous_context,
        ts.context_data,
        ts.status,
        ts.execution_result,
        -- Get previous step result if context is enabled
        CASE 
            WHEN ts.include_previous_context AND ts.step_order > 1 THEN
                (SELECT prev.execution_result 
                 FROM task_steps prev 
                 WHERE prev.task_id = ts.task_id 
                 AND prev.step_order = ts.step_order - 1)
            ELSE '{}'::jsonb
        END as previous_step_result,
        ts.created_at,
        ts.updated_at
    FROM task_steps ts
    WHERE ts.task_id = p_task_id
    ORDER BY ts.step_order;
END;
$$;

-- Function to update step execution status and result
CREATE OR REPLACE FUNCTION update_step_execution(
    p_step_id UUID,
    p_status task_step_status,
    p_execution_result JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE task_steps 
    SET 
        status = p_status,
        execution_result = COALESCE(p_execution_result, execution_result),
        error_message = p_error_message,
        execution_completed_at = CASE 
            WHEN p_status IN ('completed', 'failed', 'skipped') THEN NOW()
            ELSE execution_completed_at
        END,
        execution_started_at = CASE 
            WHEN p_status = 'running' AND execution_started_at IS NULL THEN NOW()
            ELSE execution_started_at
        END,
        execution_duration_ms = CASE 
            WHEN p_status IN ('completed', 'failed', 'skipped') AND execution_started_at IS NOT NULL THEN
                EXTRACT(EPOCH FROM (NOW() - execution_started_at))::INTEGER * 1000
            ELSE execution_duration_ms
        END,
        retry_count = CASE 
            WHEN p_status = 'failed' THEN retry_count + 1
            ELSE retry_count
        END,
        updated_at = NOW()
    WHERE id = p_step_id;
    
    RETURN FOUND;
END;
$$;

-- Grant execution permissions on all functions
GRANT EXECUTE ON FUNCTION create_task_step(UUID, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_task_step(UUID, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_task_step(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reorder_task_steps(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_task_steps_with_context(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_step_execution(UUID, task_step_status, JSONB, TEXT) TO authenticated, service_role;

-- Verification and logging
DO $$
DECLARE
    total_tasks INTEGER;
    total_steps INTEGER;
    migration_success_rate NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_tasks FROM agent_tasks;
    SELECT COUNT(*) INTO total_steps FROM task_steps;
    
    migration_success_rate := CASE 
        WHEN total_tasks > 0 THEN (total_steps::numeric / total_tasks * 100)
        ELSE 100
    END;
    
    RAISE NOTICE '📊 Task-to-Steps Migration Complete:';
    RAISE NOTICE '   Original tasks: %', total_tasks;
    RAISE NOTICE '   Steps created: %', total_steps;
    RAISE NOTICE '   Success rate: %.1f%%', migration_success_rate;
    
    IF migration_success_rate >= 95 THEN
        RAISE NOTICE '✅ Migration highly successful';
    ELSIF migration_success_rate >= 80 THEN
        RAISE NOTICE '⚠️  Migration mostly successful with some skipped tasks';
    ELSE
        RAISE WARNING '❌ Migration had significant issues - manual review required';
    END IF;
END $$;

COMMIT;
