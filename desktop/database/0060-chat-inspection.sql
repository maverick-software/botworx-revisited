-- Explicit chat inspection is separate from automatic project-memory recall.
-- Only the trusted desktop broker can call these functions.
CREATE FUNCTION public.desktop_chat_inspection_access(p_user uuid,p_request uuid,p_project uuid,p_thread text,p_chat uuid,p_active boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE source desktop_requests;membership uuid;target_project uuid;
BEGIN
 SELECT * INTO source FROM desktop_requests WHERE id=p_request AND user_id=p_user;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM conversation_sessions c WHERE c.conversation_id=source.conversation_id AND c.user_id=p_user AND coalesce(c.session_state->>'desktop_archived','false')<>'true')
  OR NOT EXISTS(SELECT 1 FROM agents a WHERE a.id=source.agent_id AND a.user_id=p_user AND a.active) THEN
  RAISE EXCEPTION 'The requesting chat is no longer active';
 END IF;
 SELECT project_id INTO membership FROM desktop_project_chats WHERE conversation_id=source.conversation_id AND user_id=p_user;
 IF membership IS DISTINCT FROM p_project THEN RAISE EXCEPTION 'The requesting chat changed project scope'; END IF;
 IF p_active AND NOT (
  p_thread IS NULL AND source.status='running' OR p_thread IS NOT NULL AND EXISTS(
   SELECT 1 FROM desktop_codex_turns t WHERE t.request_id=p_request AND t.user_id=p_user AND (
    t.thread_id=p_thread AND source.status='running'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.state->'children')='array' THEN t.state->'children' ELSE '[]' END) c WHERE c->>'threadId'=p_thread AND c->>'status'='running')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.state->'reports')='array' THEN t.state->'reports' ELSE '[]' END) r WHERE r->'state'->>'threadId'=p_thread AND r->>'status'='running')
   ))
 ) THEN RAISE EXCEPTION 'This chat turn is no longer active'; END IF;
 IF source.agent_instance_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM desktop_agent_instances i JOIN desktop_agent_profiles p ON p.agent_id=i.agent_id AND p.user_id=i.user_id
  WHERE i.id=source.agent_instance_id AND i.user_id=p_user AND i.agent_id=source.agent_id
   AND i.project_id IS NOT DISTINCT FROM membership AND i.agent_revision=p.revision
 ) THEN RAISE EXCEPTION 'The requesting agent assignment changed'; END IF;
 IF NOT desktop_agent_project_visible(p_user,p_project,p_project) THEN RAISE EXCEPTION 'The project is unavailable'; END IF;
 IF p_chat IS NOT NULL THEN
  IF p_chat=source.conversation_id THEN RAISE EXCEPTION 'The current chat is already supplied as conversation context'; END IF;
  IF NOT EXISTS(SELECT 1 FROM conversation_sessions c WHERE c.conversation_id=p_chat AND c.user_id=p_user AND coalesce(c.session_state->>'desktop_archived','false')<>'true') THEN RAISE EXCEPTION 'This chat is unavailable in the current scope'; END IF;
  SELECT project_id INTO target_project FROM desktop_project_chats WHERE conversation_id=p_chat AND user_id=p_user;
  IF NOT desktop_agent_project_visible(p_user,p_project,target_project) THEN RAISE EXCEPTION 'This chat is unavailable in the current scope'; END IF;
 END IF;
END $$;

CREATE FUNCTION public.desktop_chat_inspection_summary(p_user uuid,p_chat uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH entry AS (
  SELECT c.*,pc.project_id,p.name AS project_name,a.name AS agent_name,
   r.id AS request_id,r.status AS request_status,r.updated_at AS request_updated,n.updated_at AS native_updated,n.state
  FROM conversation_sessions c
  LEFT JOIN desktop_project_chats pc ON pc.conversation_id=c.conversation_id AND pc.user_id=p_user
  LEFT JOIN desktop_projects p ON p.id=pc.project_id AND p.user_id=p_user
  LEFT JOIN agents a ON a.id=coalesce(nullif(c.session_state->>'desktop_active_agent','')::uuid,c.agent_id) AND a.user_id=p_user
  LEFT JOIN LATERAL(SELECT * FROM desktop_requests r WHERE r.conversation_id=c.conversation_id AND r.user_id=p_user ORDER BY r.created_at DESC,r.id DESC LIMIT 1) r ON true
  LEFT JOIN desktop_codex_turns n ON n.request_id=r.id AND n.user_id=p_user
  WHERE c.conversation_id=p_chat AND c.user_id=p_user
 ), activity AS (
  SELECT e.*,
   EXISTS(SELECT 1 FROM desktop_tool_calls t WHERE t.request_id=e.request_id AND t.user_id=p_user AND t.status='awaiting_approval')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.state->'approvals')='array' THEN e.state->'approvals' ELSE '[]' END) a WHERE a->>'status'='pending') AS pending,
   (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.state->'children')='array' THEN e.state->'children' ELSE '[]' END) child
    WHERE child->>'status'='running' OR child->>'delivery' IN('running','waiting')) AS active_children,
   EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.state->'reports')='array' THEN e.state->'reports' ELSE '[]' END) report WHERE report->>'status'='running') AS reporting
  FROM entry e
 ) SELECT jsonb_build_object('conversation_id',conversation_id,'title',left(coalesce(title,'Untitled chat'),240),
  'agent_id',coalesce(nullif(session_state->>'desktop_active_agent','')::uuid,agent_id),'agent_name',left(agent_name,200),
  'project_id',project_id,'project_name',left(project_name,200),'pinned',coalesce(session_state->>'desktop_pinned','false')='true',
  'status',CASE WHEN pending THEN 'awaiting_approval' WHEN request_status='running' OR active_children>0 OR reporting THEN 'running' ELSE coalesce(request_status,'idle') END,
  'primary_status',request_status,'active_children',active_children,'last_active',last_active,
  'updated_at',greatest(last_active,request_updated,native_updated)) FROM activity
$$;

CREATE FUNCTION public.desktop_inspect_chats(p_user uuid,p_request uuid,p_project uuid,p_thread text,p_query text,p_limit integer,p_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;total bigint;
BEGIN
 PERFORM desktop_chat_inspection_access(p_user,p_request,p_project,p_thread,NULL);
 IF p_query IS NULL OR length(p_query)>200 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Use up to 200 search characters, 1 to 50 chats and a valid offset'; END IF;
 WITH visible AS (
  SELECT c.conversation_id,coalesce(c.last_active,c.started_at) AS stamp
  FROM conversation_sessions c
  LEFT JOIN desktop_project_chats pc ON pc.conversation_id=c.conversation_id AND pc.user_id=p_user
  LEFT JOIN agents a ON a.id=coalesce(nullif(c.session_state->>'desktop_active_agent','')::uuid,c.agent_id) AND a.user_id=p_user
  WHERE c.user_id=p_user AND c.conversation_id<>(SELECT conversation_id FROM desktop_requests WHERE id=p_request AND user_id=p_user)
   AND coalesce(c.session_state->>'desktop_archived','false')<>'true'
   AND desktop_agent_project_visible(p_user,p_project,pc.project_id)
   AND (p_query='' OR strpos(lower(coalesce(c.title,'')||' '||coalesce(a.name,'')),lower(p_query))>0)
 ), page AS (SELECT * FROM visible ORDER BY stamp DESC NULLS LAST,conversation_id LIMIT p_limit OFFSET p_offset)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(desktop_chat_inspection_summary(p_user,page.conversation_id) ORDER BY page.stamp DESC NULLS LAST,page.conversation_id),'[]') INTO total,result FROM page;
 RETURN jsonb_build_object('chats',result,'total',total,'offset',p_offset,'next_offset',CASE WHEN p_offset+p_limit<total THEN p_offset+p_limit ELSE NULL END);
END $$;

CREATE FUNCTION public.desktop_inspect_chat(p_user uuid,p_request uuid,p_project uuid,p_thread text,p_chat uuid,p_offset integer,p_message_offset integer,p_limit integer,p_characters integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;total bigint;activity jsonb;
BEGIN
 PERFORM desktop_chat_inspection_access(p_user,p_request,p_project,p_thread,p_chat);
 IF p_offset IS NULL OR p_offset<0 OR p_message_offset IS NULL OR p_message_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 12 OR p_characters IS NULL OR p_characters NOT BETWEEN 1 AND 12000 THEN RAISE EXCEPTION 'Choose valid message offsets, 1 to 12 messages and 1 to 12000 characters'; END IF;
 SELECT count(*) INTO total FROM chat_messages_v2 WHERE conversation_id=p_chat AND role IN('user','assistant');
 SELECT coalesce(jsonb_agg(value ORDER BY position),'[]') INTO result FROM (
  SELECT row_number() OVER(ORDER BY m.created_at,m.desktop_sequence,m.id)-1+p_offset AS position,
   jsonb_build_object('id',m.id,'role',m.role,'created_at',m.created_at,
    'text',substring(coalesce(m.content->>'text','') FROM 1+CASE WHEN row_number() OVER(ORDER BY m.created_at,m.desktop_sequence,m.id)=1 THEN p_message_offset ELSE 0 END FOR p_characters),
    'text_length',length(coalesce(m.content->>'text','')),
    'character_offset',CASE WHEN row_number() OVER(ORDER BY m.created_at,m.desktop_sequence,m.id)=1 THEN least(p_message_offset,length(coalesce(m.content->>'text',''))) ELSE 0 END,
    'status',m.metadata->>'status','agent_id',coalesce(m.metadata->'agent'->>'id',m.sender_agent_id::text),
    'agent_name',left(m.metadata->'agent'->>'name',200),'agent_role',left(m.metadata->'agent'->>'role',500)) AS value
  FROM (SELECT * FROM chat_messages_v2 WHERE conversation_id=p_chat AND role IN('user','assistant') ORDER BY created_at,desktop_sequence,id LIMIT p_limit OFFSET p_offset) m
 ) messages;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'label',left(label,240),'status',status,'created_at',created_at) ORDER BY created_at),'[]') INTO activity FROM (
  SELECT t.name,t.label,t.status,t.created_at FROM desktop_tool_calls t
  WHERE t.user_id=p_user AND t.request_id=(SELECT r.id FROM desktop_requests r WHERE r.user_id=p_user AND r.conversation_id=p_chat ORDER BY r.created_at DESC,r.id DESC LIMIT 1)
  ORDER BY t.created_at DESC,t.id DESC LIMIT 12
 ) recent;
 RETURN jsonb_build_object('chat',desktop_chat_inspection_summary(p_user,p_chat),'messages',result,'total_messages',total,'offset',p_offset,'activities',activity);
END $$;

-- Recheck live scope after asynchronous reads and before exposing their results.
CREATE FUNCTION public.desktop_validate_chat_inspection(p_user uuid,p_request uuid,p_project uuid,p_thread text,p_chats uuid[])
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE chat uuid;
BEGIN
 IF p_chats IS NULL OR cardinality(p_chats)>50 OR array_position(p_chats,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid chat inspection references'; END IF;
 PERFORM desktop_chat_inspection_access(p_user,p_request,p_project,p_thread,NULL);
 FOREACH chat IN ARRAY p_chats LOOP PERFORM desktop_chat_inspection_access(p_user,p_request,p_project,p_thread,chat); END LOOP;
END $$;

-- Receipts survive worker recovery. Native thread history can retain results from
-- earlier requests in that branch, so those sources must also remain in scope.
-- The native supervisor separately authenticates the exact active inference turn.
CREATE FUNCTION public.desktop_validate_chat_inspection_receipts(p_user uuid,p_request uuid,p_project uuid,p_thread text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE chat uuid;source_conversation uuid;
BEGIN
 SELECT conversation_id INTO source_conversation FROM desktop_requests WHERE id=p_request AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'This chat is unavailable'; END IF;
 FOR chat IN
  SELECT DISTINCT (item->>'conversation_id')::uuid FROM desktop_tool_calls t
   LEFT JOIN desktop_codex_turns n ON n.request_id=t.request_id AND n.user_id=p_user,
   LATERAL jsonb_array_elements(CASE
    WHEN t.name='list_chats' AND jsonb_typeof(t.result->'chats')='array' THEN t.result->'chats'
    WHEN t.name='read_chat' AND jsonb_typeof(t.result->'chat')='object' THEN jsonb_build_array(t.result->'chat') ELSE '[]' END) item
   WHERE t.user_id=p_user AND t.status='completed' AND t.name IN('list_chats','read_chat')
    AND (t.request_id=p_request OR p_thread IS NOT NULL AND (t.native_thread_id=p_thread OR n.thread_id=p_thread))
 LOOP
  PERFORM desktop_chat_inspection_access(p_user,p_request,p_project,p_thread,chat,false);
 END LOOP;
END $$;

-- Automatic project recall uses the same trusted native scope when a child
-- outlives its parent. Existing legacy signatures keep their running-root rules.
CREATE FUNCTION public.desktop_project_memory_scope_access(p_user uuid,p_request uuid,p_thread text,p_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE project uuid;
BEGIN
 SELECT p.id INTO project FROM desktop_requests r
  JOIN chat_messages_v2 message ON message.id=r.user_message_id
  JOIN desktop_project_chats membership ON membership.conversation_id=r.conversation_id AND membership.user_id=p_user
  JOIN desktop_projects p ON p.id=membership.project_id AND p.user_id=p_user
 WHERE r.id=p_request AND r.user_id=p_user AND p.memory_enabled
  AND message.metadata->'project'->>'id'=p.id::text
  AND message.metadata->'project'->>'memory_enabled'='true'
  AND coalesce(message.metadata->'options'->>'permission','chat')<>'chat';
 IF project IS NULL THEN RAISE EXCEPTION 'Project memory is off or this conversation is no longer in its original project'; END IF;
 PERFORM desktop_chat_inspection_access(p_user,p_request,project,p_thread,NULL,p_active);
 RETURN project;
END $$;

CREATE FUNCTION public.desktop_validate_project_memory_scope(p_user uuid,p_request uuid,p_thread text,p_messages uuid[],p_active boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE project uuid;expected bigint;actual bigint;
BEGIN
 project=desktop_project_memory_scope_access(p_user,p_request,p_thread,p_active);
 IF p_messages IS NULL OR cardinality(p_messages)>512 OR array_position(p_messages,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid project conversation sources'; END IF;
 SELECT count(DISTINCT value) INTO expected FROM unnest(p_messages) value;
 SELECT count(DISTINCT m.id) INTO actual FROM chat_messages_v2 m
  JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
  JOIN desktop_project_chats membership ON membership.conversation_id=c.conversation_id AND membership.user_id=p_user AND membership.project_id=project
 WHERE m.id=ANY(p_messages) AND m.role IN('user','assistant') AND (m.role='user' OR m.metadata->>'status'='completed')
  AND coalesce(c.session_state->>'desktop_archived','false')<>'true';
 IF actual<>expected THEN RAISE EXCEPTION 'A project conversation source changed. Review the project and send again.'; END IF;
 RETURN true;
END $$;

DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'desktop_chat_inspection_access(uuid,uuid,uuid,text,uuid,boolean)',
  'desktop_chat_inspection_summary(uuid,uuid)',
  'desktop_inspect_chats(uuid,uuid,uuid,text,text,integer,integer)',
  'desktop_inspect_chat(uuid,uuid,uuid,text,uuid,integer,integer,integer,integer)',
  'desktop_validate_chat_inspection(uuid,uuid,uuid,text,uuid[])',
  'desktop_validate_chat_inspection_receipts(uuid,uuid,uuid,text)',
  'desktop_project_memory_scope_access(uuid,uuid,text,boolean)',
  'desktop_validate_project_memory_scope(uuid,uuid,text,uuid[],boolean)'
 ] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||signature||' TO service_role';
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
