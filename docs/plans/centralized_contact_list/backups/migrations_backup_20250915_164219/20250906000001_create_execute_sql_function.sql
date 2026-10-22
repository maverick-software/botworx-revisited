-- Create execute_sql function for pg_cron scheduling
-- Purpose: Allow Edge Functions to execute SQL commands for task scheduling

BEGIN;

-- Create the execute_sql function that pg_cron needs
-- Note: Parameter name must match the RPC call parameter name
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

-- Grant permissions to service_role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.execute_sql(TEXT) IS 'Executes SQL commands for pg_cron scheduling from Edge Functions';

COMMIT;