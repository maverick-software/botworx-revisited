-- Migrate Existing Single-Instruction Tasks to Multi-Step Model
-- Date: August 29, 2025
-- Purpose: Convert existing agent_tasks to use task_steps for backward compatibility

BEGIN;

-- Migrate existing tasks to step-based model
-- Each existing task becomes a single step in the new system
INSERT INTO task_steps (
    task_id,
    step_order,
    step_name,
    instructions,
    include_previous_context,
    status,
    created_at,
    updated_at
)
SELECT 
    id as task_id,
    1 as step_order,
    COALESCE(NULLIF(name, ''), 'Task Step 1') as step_name,
    COALESCE(NULLIF(instructions, ''), 'No instructions provided') as instructions,
    false as include_previous_context,
    CASE 
        WHEN status = 'completed' THEN 'completed'::task_step_status
        WHEN status = 'failed' THEN 'failed'::task_step_status
        WHEN status = 'cancelled' THEN 'skipped'::task_step_status
        ELSE 'pending'::task_step_status
    END as status,
    created_at,
    updated_at
FROM agent_tasks
WHERE NOT EXISTS (
    -- Only migrate tasks that don't already have steps
    SELECT 1 FROM task_steps ts WHERE ts.task_id = agent_tasks.id
)
AND instructions IS NOT NULL 
AND instructions != '';

-- Add helpful function to get step count for a task
CREATE OR REPLACE FUNCTION get_task_step_count(p_task_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER 
        FROM task_steps 
        WHERE task_id = p_task_id
    );
END;
$$;

-- Add function to get next step for execution
CREATE OR REPLACE FUNCTION get_next_pending_step(p_task_id UUID)
RETURNS task_steps
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_step task_steps;
BEGIN
    SELECT * INTO next_step
    FROM task_steps
    WHERE task_id = p_task_id 
    AND status = 'pending'
    ORDER BY step_order
    LIMIT 1;
    
    RETURN next_step;
END;
$$;

-- Add function to get previous step result for context
CREATE OR REPLACE FUNCTION get_previous_step_context(p_task_id UUID, p_current_step_order INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    previous_result JSONB;
BEGIN
    -- Get the execution result from the immediately previous step
    SELECT execution_result INTO previous_result
    FROM task_steps
    WHERE task_id = p_task_id 
    AND step_order = p_current_step_order - 1
    AND status = 'completed';
    
    RETURN COALESCE(previous_result, '{}'::jsonb);
END;
$$;

-- Grant execution permissions on functions
GRANT EXECUTE ON FUNCTION get_task_step_count(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_next_pending_step(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_previous_step_context(UUID, INTEGER) TO authenticated, service_role;

-- Verification: Log migration statistics
DO $$
DECLARE
    total_tasks INTEGER;
    migrated_steps INTEGER;
    tasks_with_steps INTEGER;
BEGIN
    -- Count totals
    SELECT COUNT(*) INTO total_tasks FROM agent_tasks;
    SELECT COUNT(*) INTO migrated_steps FROM task_steps;
    SELECT COUNT(DISTINCT task_id) INTO tasks_with_steps FROM task_steps;
    
    -- Log results
    RAISE NOTICE '📊 Migration Statistics:';
    RAISE NOTICE '   Total agent_tasks: %', total_tasks;
    RAISE NOTICE '   Total task_steps created: %', migrated_steps;
    RAISE NOTICE '   Tasks with steps: %', tasks_with_steps;
    
    -- Verify migration success
    IF tasks_with_steps >= total_tasks * 0.9 THEN
        RAISE NOTICE '✅ Migration successful - %.1f%% of tasks migrated', (tasks_with_steps::float / total_tasks * 100);
    ELSE
        RAISE WARNING '⚠️  Migration incomplete - only %.1f%% of tasks migrated', (tasks_with_steps::float / total_tasks * 100);
    END IF;
END $$;

COMMIT;
