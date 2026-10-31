-- Forward migration. Earlier SQL files and retained content keep their bytes.
DO $brand$
DECLARE item record; definition text; former text := 'agen'||'topia';
BEGIN
 FOR item IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'desktop_%' AND p.prokind='f'
 LOOP
  definition:=pg_get_functiondef(item.oid);
  IF position(former in lower(definition))>0 THEN
   definition:=replace(replace(replace(definition,upper(former),'SYLVANA'),initcap(former),'Sylvana'),former,'sylvana');
   EXECUTE definition;
  END IF;
 END LOOP;
 -- Owned metadata keys can change without deleting grants or connection rows.
 FOR item IN SELECT c.conrelid::regclass AS relation,c.conname,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c WHERE c.contype='f' AND c.confrelid IN ('public.desktop_plugins'::regclass,'public.desktop_agent_plugins'::regclass)
 LOOP
  IF position('ON UPDATE' in item.definition)=0 THEN
   EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',item.relation,item.conname);
   EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON UPDATE CASCADE',item.relation,item.conname,item.definition);
  END IF;
 END LOOP;
END $brand$;

CREATE FUNCTION public.desktop_rebrand_package(p_user uuid,p_name text,p_expected text,p_new_name text,p_package jsonb,p_digest text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved desktop_plugins; former text:='agen'||'topia';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,91));
 SELECT * INTO STRICT saved FROM desktop_plugins WHERE user_id=p_user AND name=p_name FOR UPDATE;
 IF saved.digest<>p_expected OR NOT (saved.package#>'{manifest,extensions}' ? ('com.'||former)) THEN RAISE EXCEPTION 'Retained plugin changed during migration'; END IF;
 IF p_new_name<>replace(p_name,former||'-','sylvana-') OR p_package#>>'{manifest,name}'<>p_new_name OR p_digest!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid renamed plugin'; END IF;
 UPDATE desktop_plugins SET name=p_new_name,package=p_package,digest=p_digest WHERE user_id=p_user AND name=p_name;
END $$;
REVOKE ALL ON FUNCTION public.desktop_rebrand_package(uuid,text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_rebrand_package(uuid,text,text,text,jsonb,text) TO service_role;
