-- Keep the applied provisioning migration immutable; disambiguate the snapshot variable from the legacy message context column.
CREATE OR REPLACE FUNCTION public.desktop_begin_memory_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb,p_project uuid,p_revision bigint,p_plan uuid,p_plan_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; v_memory_sources jsonb; previous jsonb;
BEGIN
 result=desktop_begin_plan_chat(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files,p_project,p_revision,p_plan,p_plan_revision);
 IF coalesce((result->>'existing')::boolean,false) THEN
  SELECT metadata->'project_memory' INTO previous FROM chat_messages_v2 WHERE id=(result->>'user_message_id')::uuid;
  RETURN result||jsonb_build_object('project_memory',coalesce(previous,'[]'::jsonb));
 END IF;
 v_memory_sources='[]'::jsonb;
 IF p_project IS NOT NULL AND result->'project'->>'memory_enabled'='true' AND p_options->>'permission'<>'chat' THEN
  v_memory_sources=desktop_search_project_chats(p_user,p_project,(result->>'conversation_id')::uuid,left(p_text,200),6);
 END IF;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('project_memory',v_memory_sources) WHERE id=(result->>'user_message_id')::uuid;
 RETURN result||jsonb_build_object('project_memory',v_memory_sources);
END $$;
NOTIFY pgrst,'reload schema';
