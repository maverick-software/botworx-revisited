-- The desktop broker owns the private release's application operations.
-- Keep legacy function definitions for future features, while preventing direct
-- calls from public clients from bypassing account administration or vault rules.
DO $$ DECLARE routine record; signature text; BEGIN
 FOR routine IN
  SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 LOOP
  signature:=format('public.%I(%s)',routine.proname,routine.arguments);
  EXECUTE 'REVOKE EXECUTE ON FUNCTION '||signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||signature||' TO service_role';
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
