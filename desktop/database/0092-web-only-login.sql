-- Retain identities, password hashes and all owned content. The local Auth
-- service only issues desktop sessions through the verified web-login bridge.
CREATE OR REPLACE FUNCTION sylvana_desktop.reject_password_login(event jsonb)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT jsonb_build_object('decision','reject','message','Continue with Sylvana to sign in.','should_logout_user',false);
$$;
REVOKE ALL ON FUNCTION sylvana_desktop.reject_password_login(jsonb) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA sylvana_desktop TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION sylvana_desktop.reject_password_login(jsonb) TO supabase_auth_admin;
