-- Catalog summaries are passive builder context. They grant no execution access.
CREATE FUNCTION public.desktop_validate_builder_resources(p_resources jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,extensions AS $$
DECLARE kind text; entry jsonb;
BEGIN
 IF jsonb_typeof(p_resources) IS DISTINCT FROM 'object' OR NOT(p_resources ?& ARRAY['revision','apps','skills']) OR p_resources - ARRAY['revision','apps','skills']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid passive builder resource catalog'; END IF;
 IF p_resources->'revision'<>'null'::jsonb AND (jsonb_typeof(p_resources->'revision') IS DISTINCT FROM 'number' OR p_resources->>'revision' !~ '^[1-9][0-9]*$' OR (p_resources->>'revision')::numeric>9007199254740991) THEN RAISE EXCEPTION 'Invalid builder catalog revision'; END IF;
 IF jsonb_typeof(p_resources->'apps') IS DISTINCT FROM 'array' OR jsonb_typeof(p_resources->'skills') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid builder catalog arrays'; END IF;
 IF jsonb_array_length(p_resources->'apps')+jsonb_array_length(p_resources->'skills')>500 THEN RAISE EXCEPTION 'Too many builder catalog entries'; END IF;
 FOREACH kind IN ARRAY ARRAY['apps','skills'] LOOP
  IF (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(p_resources->kind)) THEN RAISE EXCEPTION 'Duplicate builder catalog identifier'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_resources->kind) LOOP
   IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR NOT(entry ?& ARRAY['id','name','description','enabled','configured','assigned']) OR entry - ARRAY['id','name','description','digest','enabled','configured','assigned']<>'{}'::jsonb
    OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string' OR entry->>'id' !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$'
    OR jsonb_typeof(entry->'name') IS DISTINCT FROM 'string' OR length(trim(entry->>'name'))<1 OR length(entry->>'name')>100
    OR jsonb_typeof(entry->'description') IS DISTINCT FROM 'string' OR length(entry->>'description')>1000
    OR jsonb_typeof(entry->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(entry->'configured') IS DISTINCT FROM 'boolean' OR jsonb_typeof(entry->'assigned') IS DISTINCT FROM 'boolean'
    OR entry ? 'digest' AND (jsonb_typeof(entry->'digest') IS DISTINCT FROM 'string' OR entry->>'digest' !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'Invalid passive builder catalog entry'; END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.desktop_validate_builder_resources(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_validate_builder_resources(jsonb) TO service_role;

-- Pin the two existing checks before extending them. All ownership, request
-- identity, policy, attachment and execution-context checks remain byte-for-byte.
DO $migration$
DECLARE definition text; needle text; signature text;
BEGIN
 signature='public.desktop_begin_scoped_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb,uuid)';
 SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
 needle='reference - ARRAY[''name'',''description'',''instructions'',''behavior'',''appearance'']<>''{}''::jsonb';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected passive builder field validator'; END IF;
 definition=replace(definition,needle,'reference - ARRAY[''name'',''description'',''instructions'',''behavior'',''appearance'',''resources'']<>''{}''::jsonb');
 needle='  FOREACH key IN ARRAY ARRAY[''name'',''description'',''instructions''] LOOP';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected passive builder text validator'; END IF;
 EXECUTE replace(definition,needle,'  IF reference ? ''resources'' THEN PERFORM public.desktop_validate_builder_resources(reference->''resources''); END IF;'||chr(10)||needle);
END $migration$;
