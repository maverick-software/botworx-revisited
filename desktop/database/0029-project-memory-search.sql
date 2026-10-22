-- Explicit searches require all search terms; automatic context retrieval keeps broader ranked relevance.
CREATE FUNCTION public.desktop_search_project_chats_all(p_user uuid,p_project uuid,p_exclude uuid,p_query text,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE terms text[]; query tsquery; result jsonb;
BEGIN
 IF p_query IS NULL OR length(p_query)>200 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Use a search of up to 200 characters and 1 to 20 results'; END IF;
 PERFORM 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project is unavailable for your account'; END IF;
 terms=tsvector_to_array(to_tsvector('english',p_query));
 IF cardinality(terms)=0 THEN RETURN '[]'::jsonb; END IF;
 query=plainto_tsquery('english',p_query);
 SELECT coalesce(jsonb_agg(to_jsonb(hit) ORDER BY hit.rank DESC,hit.created_at DESC,hit.message_id),'[]'::jsonb) INTO result FROM (
  SELECT m.id AS message_id,m.conversation_id,c.title,m.role,m.created_at,m.desktop_sequence,
   desktop_memory_excerpt(m.content->>'text',terms) AS excerpt,
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
REVOKE ALL ON FUNCTION public.desktop_search_project_chats_all(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_search_project_chats_all(uuid,uuid,uuid,text,integer) TO service_role;
NOTIFY pgrst,'reload schema';

-- Integer offsets cover the complete saved text while each returned page remains bounded.
CREATE OR REPLACE FUNCTION public.desktop_read_project_chat_page(p_user uuid,p_project uuid,p_conversation uuid,p_message uuid,p_offset integer,p_characters integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sources jsonb; original text; size integer; result jsonb;
BEGIN
 IF p_offset IS NULL OR p_offset<0 OR p_characters IS NULL OR p_characters NOT BETWEEN 1 AND 12000 THEN RAISE EXCEPTION 'Choose a valid source offset and up to 12,000 characters'; END IF;
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
NOTIFY pgrst,'reload schema';
