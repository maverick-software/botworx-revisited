ALTER TABLE public.desktop_projects
 ADD COLUMN instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=8000),
 ADD COLUMN file_ids uuid[] NOT NULL DEFAULT '{}' CHECK(cardinality(file_ids)<=20),
 ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision>0);
ALTER TABLE public.desktop_goals ADD COLUMN project_id uuid REFERENCES public.desktop_projects(id) ON DELETE SET NULL;

CREATE FUNCTION public.desktop_save_project(p_user uuid,p_id uuid,p_name text,p_reference uuid,p_instructions text,p_files uuid[],p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result desktop_projects;
BEGIN
 IF p_id IS NULL THEN
  INSERT INTO desktop_projects(user_id,name,reference_id,instructions,file_ids)
   VALUES(p_user,trim(p_name),p_reference,p_instructions,p_files) RETURNING * INTO result;
 ELSE
  UPDATE desktop_projects SET name=trim(p_name),reference_id=p_reference,instructions=p_instructions,file_ids=p_files,revision=revision+1
   WHERE id=p_id AND user_id=p_user AND revision=p_revision RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project changed or is unavailable. Reopen project settings before saving.'; END IF;
 END IF;
 RETURN to_jsonb(result);
END $$;

CREATE FUNCTION public.desktop_move_project_chat(p_user uuid,p_conversation uuid,p_project uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE conversation_id=p_conversation AND status='running') THEN
  RAISE EXCEPTION 'Finish or cancel the active response before moving this chat.';
 END IF;
 IF p_project IS NULL THEN
  DELETE FROM desktop_project_chats WHERE conversation_id=p_conversation AND user_id=p_user;
 ELSE
  PERFORM 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  INSERT INTO desktop_project_chats(conversation_id,project_id,user_id) VALUES(p_conversation,p_project,p_user)
   ON CONFLICT(conversation_id) DO UPDATE SET project_id=EXCLUDED.project_id;
 END IF;
END $$;

CREATE FUNCTION public.desktop_begin_project_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb,p_project uuid,p_revision bigint)
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
   'file_ids',CASE WHEN p_options->>'permission'='chat' THEN '[]'::jsonb ELSE to_jsonb(project.file_ids) END);
 END IF;
 result=desktop_begin_chat_with_options(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files);
 IF p_project IS NOT NULL AND p_conversation IS NULL THEN
  INSERT INTO desktop_project_chats(conversation_id,project_id,user_id) VALUES((result->>'conversation_id')::uuid,p_project,p_user);
 END IF;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('project',snapshot) WHERE id=(result->>'user_message_id')::uuid;
 RETURN result||jsonb_build_object('project',snapshot);
END $$;

REVOKE ALL ON FUNCTION public.desktop_save_project(uuid,uuid,text,uuid,text,uuid[],bigint),public.desktop_move_project_chat(uuid,uuid,uuid),public.desktop_begin_project_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_project(uuid,uuid,text,uuid,text,uuid[],bigint),public.desktop_move_project_chat(uuid,uuid,uuid),public.desktop_begin_project_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
