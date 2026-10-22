-- supabase/migrations/20240730110000_create_get_my_claim_function.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_claim(claim_name TEXT)
RETURNS TEXT -- Assuming the role claim directly returns a text value
LANGUAGE SQL
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim_name;
$$;

COMMENT ON FUNCTION public.get_my_claim(TEXT) IS 'Retrieves a specific text claim from the current session''s JWT claims.';

COMMIT; 