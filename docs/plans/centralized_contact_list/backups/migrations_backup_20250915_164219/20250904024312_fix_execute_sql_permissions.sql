-- Fix execute_sql function permissions and ensure it's accessible
-- Purpose: Ensure execute_sql function can be called by Edge Functions

BEGIN;

-- Recreate the execute_sql function with proper permissions
CREATE OR REPLACE FUNCTION public.execute_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Execute the provided SQL
    EXECUTE sql;
END;
$$;

-- Grant permissions to all roles that might need it
GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO authenticated;

-- Ensure the function is in the public schema and accessible
ALTER FUNCTION public.execute_sql(TEXT) OWNER TO postgres;

-- Add comment for documentation
COMMENT ON FUNCTION public.execute_sql(TEXT) IS 'Executes SQL commands for pg_cron scheduling from Edge Functions. Used by agent-tasks function for task scheduling.';

COMMIT;
