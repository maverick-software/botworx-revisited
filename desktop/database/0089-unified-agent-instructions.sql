-- Extend only instruction fields. Request text, ownership, replay identities,
-- creation resources and enforced policies retain their existing validation.
DO $migration$
DECLARE definition text; needle text; signature text;
BEGIN
 signature='public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text)';
 SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
 needle='length(p_instructions)>100000';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected creation instruction validator'; END IF;
 EXECUTE replace(definition,needle,'length(p_instructions)>500000');

 signature='public.desktop_begin_scoped_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb,uuid)';
 SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
 needle='length(p_snapshot->>''instructions'')>100000';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected preview instruction validator'; END IF;
 definition=replace(definition,needle,'length(p_snapshot->>''instructions'')>500000');
 needle='length(reference->>''instructions'')>100000';
 IF (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected builder instruction validator'; END IF;
 EXECUTE replace(definition,needle,'length(reference->>''instructions'')>500000');
END $migration$;

CREATE OR REPLACE FUNCTION public.desktop_save_agent(p_user uuid,p_id uuid,p_name text,p_description text,p_instructions text,p_provider text,p_model text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE result uuid;
BEGIN
 IF p_user IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 OR p_provider IS NULL OR p_provider NOT IN ('openrouter','openai-oauth') OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 200 OR p_description IS NULL OR length(p_description)>4000 OR p_instructions IS NULL OR length(p_instructions)>500000 THEN RAISE EXCEPTION 'Invalid agent settings'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO agents(user_id,name,description,system_instructions,assistant_instructions,active,reasoning_config)
  VALUES(p_user,trim(p_name),p_description,p_instructions,p_instructions,true,'{"enabled":false}') RETURNING id INTO result;
 ELSE
  UPDATE agents SET name=trim(p_name),description=p_description,system_instructions=p_instructions,assistant_instructions=p_instructions,reasoning_config='{"enabled":false}'
  WHERE id=p_id AND user_id=p_user RETURNING id INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Agent not found'; END IF;
 END IF;
 UPDATE agent_llm_preferences SET provider=p_provider,model=p_model,params='{}',updated_at=now() WHERE agent_id=result;
 RETURN result;
END $$;

-- Explicit Save commits the unified text and retires the legacy text sources
-- together. Historical definition revisions retain the original fields.
CREATE FUNCTION public.desktop_save_agent_unified(p_user uuid,p_id uuid,p_name text,p_description text,p_instructions text,p_provider text,p_model text,p_behavior jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE current_value jsonb; behavior jsonb;
BEGIN
 IF p_user IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'Choose an owned saved agent'; END IF;
 PERFORM 1 FROM agents WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agent is unavailable for your account'; END IF;
 IF jsonb_typeof(p_behavior) IS DISTINCT FROM 'object' OR jsonb_typeof(p_behavior->'revision') IS DISTINCT FROM 'number' OR p_behavior->>'revision' !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Reload the saved agent definition before saving Instructions'; END IF;
 behavior=p_behavior-'revision';
 PERFORM desktop_validate_preview_behavior(behavior);
 IF behavior->>'role'<>'' OR behavior->>'sops'<>'' OR behavior->>'guardrails'<>'' OR behavior->'skills'<>'[]'::jsonb THEN RAISE EXCEPTION 'Put all written agent guidance in Instructions'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(behavior#>'{policy,delegateAgents}')='array' THEN behavior#>'{policy,delegateAgents}' ELSE '[]'::jsonb END) d(id)
  WHERE NOT EXISTS(SELECT 1 FROM agents a WHERE a.id=d.id::uuid AND a.user_id=p_user AND a.active)) THEN RAISE EXCEPTION 'Choose permitted agents from your own account'; END IF;
 current_value=desktop_agent_profile(p_user,p_id);
 IF (current_value->>'revision')::bigint IS DISTINCT FROM (p_behavior->>'revision')::bigint THEN RAISE EXCEPTION 'This agent changed. Reload its definition before saving'; END IF;
 PERFORM desktop_save_agent(p_user,p_id,p_name,p_description,p_instructions,p_provider,p_model);
 UPDATE desktop_agent_profiles SET handle=behavior->>'handle',role='',sops='',guardrails='',skills='[]'::jsonb,policy=behavior->'policy' WHERE agent_id=p_id AND user_id=p_user;
 PERFORM desktop_agent_profile(p_user,p_id);
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.desktop_save_agent_unified(uuid,uuid,text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_agent_unified(uuid,uuid,text,text,text,text,text,jsonb) TO service_role;
