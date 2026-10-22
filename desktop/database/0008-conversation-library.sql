-- Conversation library controls are owned by the authenticated desktop user.
CREATE FUNCTION public.desktop_manage_conversation(p_user uuid,p_conversation uuid,p_action text,p_title text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c conversation_sessions;
BEGIN
 SELECT * INTO c FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
 IF p_action IN ('archive','delete') AND EXISTS(SELECT 1 FROM desktop_requests WHERE conversation_id=p_conversation AND status='running') THEN
  RAISE EXCEPTION 'Finish or stop the response before changing this conversation';
 END IF;
 IF p_action='rename' THEN
  IF length(trim(p_title)) NOT BETWEEN 1 AND 120 OR p_title IS NULL THEN RAISE EXCEPTION 'Enter a title between 1 and 120 characters'; END IF;
  UPDATE conversation_sessions SET title=trim(p_title) WHERE id=c.id;
 ELSIF p_action IN ('pin','unpin') THEN
  UPDATE conversation_sessions SET session_state=coalesce(session_state,'{}')||jsonb_build_object('desktop_pinned',p_action='pin') WHERE id=c.id;
 ELSIF p_action IN ('archive','unarchive') THEN
  UPDATE conversation_sessions SET session_state=coalesce(session_state,'{}')||jsonb_build_object('desktop_archived',p_action='archive') WHERE id=c.id;
 ELSIF p_action='delete' THEN
  DELETE FROM conversation_sessions WHERE id=c.id;
 ELSE RAISE EXCEPTION 'Unsupported conversation action';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_manage_conversation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_manage_conversation(uuid,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
