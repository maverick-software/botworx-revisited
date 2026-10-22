-- Disposable test fixture only. Refuse to run against either working database.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE email<>'fresh-admin-proof@example.com') THEN
  RAISE EXCEPTION 'Refusing to reset a database containing non-fixture accounts';
 END IF;
END $$;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
DROP SCHEMA agentopia_desktop CASCADE;
DELETE FROM auth.users WHERE email='fresh-admin-proof@example.com';
COMMIT;
