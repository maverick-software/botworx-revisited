-- Create utility functions for accurate time handling

-- Get current UTC timestamp
CREATE OR REPLACE FUNCTION public.get_current_utc_time()
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

-- Get current time in specific timezone
CREATE OR REPLACE FUNCTION public.get_current_time_in_timezone(timezone_name text DEFAULT 'UTC')
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
AS $$
  SELECT timezone(timezone_name, now());
$$;

-- Calculate time difference in seconds
CREATE OR REPLACE FUNCTION public.time_diff_seconds(
  time1 timestamp with time zone,
  time2 timestamp with time zone
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(EPOCH FROM (time1 - time2))::integer;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_current_utc_time() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_time_in_timezone(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.time_diff_seconds(timestamp with time zone, timestamp with time zone) TO anon, authenticated, service_role;
