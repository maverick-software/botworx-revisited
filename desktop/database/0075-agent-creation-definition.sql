-- Basic fields, appearance and custom behavior commit in one creation transaction.
-- Existing creation endpoints and deployed migration checksums remain immutable.
CREATE FUNCTION public.desktop_create_agent_definition(p_user uuid,p_creation uuid,p_name text,p_description text,p_instructions text,p_provider text,p_model text,p_appearance jsonb,p_avatar text,p_behavior jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE result uuid; prior text; fingerprint text; existed boolean; profile jsonb; skills jsonb;
BEGIN
 PERFORM desktop_validate_preview_behavior(p_behavior);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_behavior->'policy'->'delegateAgents')='array' THEN p_behavior->'policy'->'delegateAgents' ELSE '[]'::jsonb END) d(id)
  WHERE NOT EXISTS(SELECT 1 FROM agents a WHERE a.id=d.id::uuid AND a.user_id=p_user AND a.active)) THEN RAISE EXCEPTION 'Choose permitted agents from your own account'; END IF;
 fingerprint=encode(sha256(convert_to(p_behavior::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 SELECT id,metadata->>'desktop_creation_behavior_fingerprint' INTO result,prior FROM agents WHERE user_id=p_user AND metadata->>'desktop_creation_id'=p_creation::text;
 existed=FOUND;
 IF existed AND prior IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'This draft already created an agent with different behavior. Open it before creating another'; END IF;
 result=desktop_create_agent_presentation(p_user,p_creation,p_name,p_description,p_instructions,p_provider,p_model,p_appearance,p_avatar);
 IF existed THEN RETURN result; END IF;
 SELECT coalesce(jsonb_agg(skill||jsonb_build_object('sha256',encode(sha256(convert_to(skill->>'content','UTF8')),'hex'))),'[]'::jsonb) INTO skills FROM jsonb_array_elements(p_behavior->'skills') s(skill);
 profile=desktop_agent_profile(p_user,result);
 PERFORM desktop_save_agent_profile(p_user,result,(profile->>'revision')::bigint,p_behavior||jsonb_build_object('skills',skills));
 UPDATE agents SET metadata=metadata||jsonb_build_object('desktop_creation_behavior_fingerprint',fingerprint) WHERE id=result AND user_id=p_user;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.desktop_create_agent_definition(uuid,uuid,text,text,text,text,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_create_agent_definition(uuid,uuid,text,text,text,text,text,jsonb,text,jsonb) TO service_role;
