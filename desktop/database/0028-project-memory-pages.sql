CREATE FUNCTION public.desktop_read_project_chat_page(p_user uuid,p_project uuid,p_conversation uuid,p_message uuid,p_offset integer,p_characters integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sources jsonb; original text; size integer; result jsonb;
BEGIN
 IF p_offset IS NULL OR p_offset<0 OR p_offset>2000000 OR p_characters IS NULL OR p_characters NOT BETWEEN 1 AND 12000 THEN RAISE EXCEPTION 'Choose a valid source offset and up to 12,000 characters'; END IF;
 sources=desktop_read_project_chat(p_user,p_project,p_conversation,p_message);
 SELECT coalesce(content->>'text','') INTO original FROM chat_messages_v2 WHERE id=p_message AND conversation_id=p_conversation;
 size=length(original);IF p_offset>size THEN RAISE EXCEPTION 'The source offset is beyond this saved message'; END IF;
 SELECT jsonb_agg(CASE WHEN item->>'message_id'=p_message::text THEN item||jsonb_build_object(
  'excerpt',substr(original,p_offset+1,p_characters),'offset',p_offset,'total_characters',size,
  'next_offset',CASE WHEN p_offset+p_characters<size THEN p_offset+p_characters ELSE NULL END,
  'truncated',p_offset>0 OR p_offset+p_characters<size)
 ELSE item||jsonb_build_object('excerpt',left(item->>'excerpt',500),'truncated',length(item->>'excerpt')>500 OR coalesce((item->>'truncated')::boolean,false)) END ORDER BY (item->>'desktop_sequence')::bigint)
 INTO result FROM jsonb_array_elements(sources) item;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.desktop_read_project_chat_page(uuid,uuid,uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_read_project_chat_page(uuid,uuid,uuid,uuid,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
