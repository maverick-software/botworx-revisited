ALTER TABLE public.desktop_projects ADD COLUMN memory_enabled boolean NOT NULL DEFAULT false;
CREATE INDEX desktop_message_text_search ON public.chat_messages_v2 USING gin
 (to_tsvector('english',coalesce(content->>'text',''))) WHERE role IN ('user','assistant');

CREATE FUNCTION public.desktop_save_project_memory(p_user uuid,p_id uuid,p_name text,p_reference uuid,p_instructions text,p_files uuid[],p_revision bigint,p_memory boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; previous boolean;
BEGIN
 IF p_id IS NOT NULL THEN
  SELECT memory_enabled INTO previous FROM desktop_projects WHERE id=p_id AND user_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project is unavailable for your account'; END IF;
 END IF;
 result=desktop_save_project(p_user,p_id,p_name,p_reference,p_instructions,p_files,p_revision);
 UPDATE desktop_projects SET memory_enabled=coalesce(p_memory,previous,false)
  WHERE id=(result->>'id')::uuid AND user_id=p_user RETURNING to_jsonb(desktop_projects) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.desktop_search_project_chats(p_user uuid,p_project uuid,p_exclude uuid,p_query text,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE terms text[]; query tsquery; result jsonb;
BEGIN
 IF p_query IS NULL OR length(p_query)>200 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Use a search of up to 200 characters and 1 to 20 results'; END IF;
 PERFORM 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project is unavailable for your account'; END IF;
 terms=tsvector_to_array(to_tsvector('english',p_query));
 IF cardinality(terms)=0 THEN RETURN '[]'::jsonb; END IF;
 query=to_tsquery('english',array_to_string(ARRAY(SELECT quote_literal(t) FROM unnest(terms) t),' | '));
 SELECT coalesce(jsonb_agg(to_jsonb(hit) ORDER BY hit.rank DESC,hit.created_at DESC,hit.message_id),'[]'::jsonb) INTO result FROM (
  SELECT m.id AS message_id,m.conversation_id,c.title,m.role,m.created_at,m.desktop_sequence,
   left(replace(replace(ts_headline('english',m.content->>'text',query,'MaxWords=100,MinWords=20,MaxFragments=2,FragmentDelimiter= … '),'<b>',''),'</b>',''),1800) AS excerpt,
   ts_rank_cd(to_tsvector('english',coalesce(m.content->>'text','')),query) AS rank
  FROM chat_messages_v2 m JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
   JOIN desktop_project_chats membership ON membership.conversation_id=c.conversation_id AND membership.project_id=p_project AND membership.user_id=p_user
  WHERE m.role IN ('user','assistant') AND (m.role='user' OR m.metadata->>'status'='completed')
   AND (p_exclude IS NULL OR m.conversation_id<>p_exclude) AND coalesce(c.session_state->>'desktop_archived','false')<>'true'
   AND to_tsvector('english',coalesce(m.content->>'text',''))@@query
  ORDER BY rank DESC,m.created_at DESC,m.id LIMIT p_limit
 ) hit;
 RETURN result;
END $$;

CREATE FUNCTION public.desktop_project_memory_access(p_user uuid,p_request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project uuid;
BEGIN
 SELECT p.id INTO project FROM desktop_requests r
  JOIN chat_messages_v2 message ON message.id=r.user_message_id
  JOIN desktop_project_chats membership ON membership.conversation_id=r.conversation_id AND membership.user_id=p_user
  JOIN desktop_projects p ON p.id=membership.project_id AND p.user_id=p_user
 WHERE r.id=p_request AND r.user_id=p_user AND r.status='running' AND p.memory_enabled
  AND message.metadata->'project'->>'id'=p.id::text
  AND message.metadata->'project'->>'memory_enabled'='true'
  AND coalesce(message.metadata->'options'->>'permission','chat')<>'chat';
 IF project IS NULL THEN RAISE EXCEPTION 'Project memory is off or this conversation is no longer in its original project'; END IF;
 RETURN project;
END $$;

CREATE FUNCTION public.desktop_read_project_chat(p_user uuid,p_project uuid,p_conversation uuid,p_message uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sequence bigint; result jsonb;
BEGIN
 SELECT m.desktop_sequence INTO sequence FROM chat_messages_v2 m
  JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
  JOIN desktop_project_chats membership ON membership.conversation_id=c.conversation_id AND membership.user_id=p_user AND membership.project_id=p_project
  JOIN desktop_projects p ON p.id=p_project AND p.user_id=p_user
 WHERE m.id=p_message AND m.conversation_id=p_conversation AND m.role IN ('user','assistant')
  AND (m.role='user' OR m.metadata->>'status'='completed') AND coalesce(c.session_state->>'desktop_archived','false')<>'true';
 IF NOT FOUND THEN RAISE EXCEPTION 'This conversation source is unavailable in the project'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(hit) ORDER BY hit.desktop_sequence),'[]'::jsonb) INTO result FROM (
  SELECT m.id AS message_id,m.conversation_id,c.title,m.role,m.created_at,m.desktop_sequence,left(m.content->>'text',6000) AS excerpt,
   length(coalesce(m.content->>'text',''))>6000 AS truncated
  FROM chat_messages_v2 m JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
  WHERE m.conversation_id=p_conversation AND m.desktop_sequence BETWEEN sequence-2 AND sequence+2
   AND m.role IN ('user','assistant') AND (m.role='user' OR m.metadata->>'status'='completed')
  ORDER BY m.desktop_sequence LIMIT 5
 ) hit;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.desktop_begin_project_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb,p_project uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; project desktop_projects; membership uuid; previous jsonb; snapshot jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE id=p_request) THEN
  result=desktop_begin_chat_with_options(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files);
  SELECT metadata->'project' INTO previous FROM chat_messages_v2 WHERE id=(result->>'user_message_id')::uuid;
  IF (previous->>'id')::uuid IS DISTINCT FROM p_project THEN RAISE EXCEPTION 'Request identifier already used with a different project'; END IF;
  RETURN result||jsonb_build_object('project',previous);
 END IF;
 IF p_conversation IS NOT NULL THEN
  PERFORM 1 FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user AND agent_id=p_agent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  SELECT project_id INTO membership FROM desktop_project_chats WHERE conversation_id=p_conversation AND user_id=p_user;
  IF membership IS DISTINCT FROM p_project THEN RAISE EXCEPTION 'Chat moved to another project. Reopen it before sending.'; END IF;
 END IF;
 IF p_project IS NOT NULL THEN
  SELECT * INTO project FROM desktop_projects WHERE id=p_project AND user_id=p_user FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Project context changed. Review it and send again.'; END IF;
  snapshot=jsonb_build_object('id',project.id,'name',project.name,'instructions',project.instructions,'revision',project.revision,
   'memory_enabled',project.memory_enabled,'file_ids',CASE WHEN p_options->>'permission'='chat' THEN '[]'::jsonb ELSE to_jsonb(project.file_ids) END);
 END IF;
 result=desktop_begin_chat_with_options(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files);
 IF p_project IS NOT NULL AND p_conversation IS NULL THEN
  INSERT INTO desktop_project_chats(conversation_id,project_id,user_id) VALUES((result->>'conversation_id')::uuid,p_project,p_user);
 END IF;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('project',snapshot) WHERE id=(result->>'user_message_id')::uuid;
 RETURN result||jsonb_build_object('project',snapshot);
END $$;


CREATE FUNCTION public.desktop_begin_memory_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb,p_project uuid,p_revision bigint,p_plan uuid,p_plan_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; context jsonb; previous jsonb;
BEGIN
 result=desktop_begin_plan_chat(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files,p_project,p_revision,p_plan,p_plan_revision);
 IF coalesce((result->>'existing')::boolean,false) THEN
  SELECT metadata->'project_memory' INTO previous FROM chat_messages_v2 WHERE id=(result->>'user_message_id')::uuid;
  RETURN result||jsonb_build_object('project_memory',coalesce(previous,'[]'::jsonb));
 END IF;
 context='[]'::jsonb;
 IF p_project IS NOT NULL AND result->'project'->>'memory_enabled'='true' AND p_options->>'permission'<>'chat' THEN
  context=desktop_search_project_chats(p_user,p_project,(result->>'conversation_id')::uuid,left(p_text,200),6);
 END IF;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('project_memory',context) WHERE id=(result->>'user_message_id')::uuid;
 RETURN result||jsonb_build_object('project_memory',context);
END $$;

CREATE FUNCTION public.desktop_validate_project_memory(p_user uuid,p_request uuid,p_messages uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE project uuid; expected integer; actual integer;
BEGIN
 project=desktop_project_memory_access(p_user,p_request);
 IF p_messages IS NULL OR cardinality(p_messages)>512 THEN RAISE EXCEPTION 'Too many project sources'; END IF;
 SELECT count(DISTINCT value) INTO expected FROM unnest(p_messages) value;
 SELECT count(DISTINCT m.id) INTO actual FROM chat_messages_v2 m
  JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
  JOIN desktop_project_chats membership ON membership.conversation_id=c.conversation_id AND membership.user_id=p_user AND membership.project_id=project
  WHERE m.id=ANY(p_messages) AND m.role IN ('user','assistant') AND (m.role='user' OR m.metadata->>'status'='completed')
   AND coalesce(c.session_state->>'desktop_archived','false')<>'true';
 IF actual<>expected THEN RAISE EXCEPTION 'A project conversation source changed. Review the project and send again.'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.desktop_validate_project_memory(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_validate_project_memory(uuid,uuid,uuid[]) TO service_role;

CREATE FUNCTION public.desktop_conversation_source(p_user uuid,p_conversation uuid,p_message uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sequence bigint; result jsonb;
BEGIN
 SELECT m.desktop_sequence INTO sequence FROM chat_messages_v2 m JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
  WHERE m.id=p_message AND m.conversation_id=p_conversation AND m.role IN ('user','assistant');
 IF NOT FOUND THEN RAISE EXCEPTION 'This conversation source is unavailable for your account'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(hit) ORDER BY hit.desktop_sequence),'[]'::jsonb) INTO result FROM (
  SELECT m.id AS message_id,m.conversation_id,c.title,m.role,m.created_at,m.desktop_sequence,left(m.content->>'text',100000) AS excerpt,
   length(coalesce(m.content->>'text',''))>100000 AS truncated
  FROM chat_messages_v2 m JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
  WHERE m.conversation_id=p_conversation AND m.desktop_sequence BETWEEN sequence-2 AND sequence+2 AND m.role IN ('user','assistant')
  ORDER BY m.desktop_sequence LIMIT 5
 ) hit;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.desktop_conversation_source(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_conversation_source(uuid,uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.desktop_save_project_memory(uuid,uuid,text,uuid,text,uuid[],bigint,boolean),public.desktop_search_project_chats(uuid,uuid,uuid,text,integer),public.desktop_project_memory_access(uuid,uuid),public.desktop_read_project_chat(uuid,uuid,uuid,uuid),public.desktop_begin_memory_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_project_memory(uuid,uuid,text,uuid,text,uuid[],bigint,boolean),public.desktop_search_project_chats(uuid,uuid,uuid,text,integer),public.desktop_project_memory_access(uuid,uuid),public.desktop_read_project_chat(uuid,uuid,uuid,uuid),public.desktop_begin_memory_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint) TO service_role;

NOTIFY pgrst,'reload schema';
