-- A creation retry returns the original agent without overwriting later edits.
CREATE UNIQUE INDEX desktop_agent_creation_owner ON public.agents(user_id,(metadata->>'desktop_creation_id'))
 WHERE metadata ? 'desktop_creation_id';
CREATE FUNCTION public.desktop_create_agent_presentation(p_user uuid,p_creation uuid,p_name text,p_description text,p_instructions text,p_provider text,p_model text,p_appearance jsonb,p_avatar text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE result uuid; fingerprint text; prior text; starter jsonb; ids text[]:='{}'; bytes bytea;
BEGIN
 IF p_user IS NULL OR p_creation IS NULL OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 OR p_provider IS NULL OR p_provider NOT IN ('openrouter','openai-oauth') OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 200 OR p_description IS NULL OR length(p_description)>4000 OR p_instructions IS NULL OR length(p_instructions)>100000 THEN RAISE EXCEPTION 'Invalid agent settings'; END IF;
 IF p_appearance IS NULL OR jsonb_typeof(p_appearance)<>'object' OR p_appearance->'version' IS DISTINCT FROM '1'::jsonb OR coalesce(p_appearance->>'icon','') NOT IN ('bot','book','compass','pen','briefcase','code','flask','shield') OR coalesce(p_appearance->>'color','') NOT IN ('gray','blue','green','amber','violet','rose') OR NOT p_appearance ? 'starters' THEN RAISE EXCEPTION 'Invalid agent appearance'; END IF;
 IF p_appearance->'starters'<>'null'::jsonb THEN
  IF jsonb_typeof(p_appearance->'starters')<>'array' OR jsonb_array_length(p_appearance->'starters')>6 THEN RAISE EXCEPTION 'Use up to six conversation starters'; END IF;
  FOR starter IN SELECT value FROM jsonb_array_elements(p_appearance->'starters') LOOP
   IF jsonb_typeof(starter)<>'object' OR jsonb_typeof(starter->'id') IS DISTINCT FROM 'string' OR coalesce(starter->>'id','') !~ '^[a-zA-Z0-9_-]{1,64}$' OR starter->>'id'=ANY(ids) OR jsonb_typeof(starter->'title') IS DISTINCT FROM 'string' OR coalesce(length(trim(starter->>'title')),0) NOT BETWEEN 1 AND 80 OR jsonb_typeof(starter->'prompt') IS DISTINCT FROM 'string' OR coalesce(length(trim(starter->>'prompt')),0)<1 OR length(starter->>'prompt')>2000 THEN RAISE EXCEPTION 'Invalid conversation starter'; END IF;
   ids=array_append(ids,starter->>'id');
  END LOOP;
 END IF;
 IF p_avatar IS NOT NULL THEN
  IF length(p_avatar)>132000 OR p_avatar !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' THEN RAISE EXCEPTION 'Invalid local profile image'; END IF;
  bytes=decode(substring(p_avatar FROM 23),'base64');
  IF octet_length(bytes)>96000 OR octet_length(bytes)<33 OR substring(bytes FROM 1 FOR 8)<>decode('89504e470d0a1a0a','hex') OR substring(bytes FROM 13 FOR 4)<>convert_to('IHDR','UTF8') OR substring(bytes FROM 17 FOR 8)<>decode('0000008000000080','hex') THEN RAISE EXCEPTION 'Invalid profile thumbnail'; END IF;
 END IF;
 fingerprint=encode(sha256(convert_to(jsonb_build_object('name',trim(p_name),'description',p_description,'instructions',p_instructions,'provider',p_provider,'model',p_model,'appearance',p_appearance,'avatar',p_avatar)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 SELECT id,metadata->>'desktop_creation_fingerprint' INTO result,prior FROM agents WHERE user_id=p_user AND metadata->>'desktop_creation_id'=p_creation::text;
 IF FOUND THEN
  IF prior IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION 'This draft already created an agent. Reopen the agent library to review it before creating another'; END IF;
  RETURN result;
 END IF;
 result=desktop_save_agent(p_user,NULL,p_name,p_description,p_instructions,p_provider,p_model);
 UPDATE agents SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('desktop_presentation',p_appearance,'desktop_creation_id',p_creation::text,'desktop_creation_fingerprint',fingerprint),avatar_url=p_avatar WHERE id=result AND user_id=p_user;
 PERFORM desktop_agent_profile(p_user,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text) TO service_role;
