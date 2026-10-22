-- Excerpts preserve the saved characters; text-search headlines may trim numeric suffixes at their boundaries.
CREATE FUNCTION public.desktop_memory_excerpt(p_text text,p_terms text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE position integer; start_at integer; end_at integer; boundary integer;
BEGIN
 IF p_text IS NULL THEN RETURN ''; END IF;
 IF length(p_text)<=1800 THEN RETURN p_text; END IF;
 SELECT min(nullif(strpos(lower(p_text),term),0)) INTO position FROM unnest(p_terms) term;
 start_at=greatest(1,coalesce(position,1)-400);end_at=least(length(p_text),start_at+1799);
 IF start_at>1 THEN
  boundary=strpos(reverse(substr(p_text,greatest(1,start_at-100),least(100,start_at-1))),' ');
  IF boundary>0 THEN start_at=start_at-boundary; END IF;
 END IF;
 IF end_at<length(p_text) THEN
  boundary=strpos(substr(p_text,end_at+1,100),' ');IF boundary>0 THEN end_at=end_at+boundary-1; END IF;
 END IF;
 RETURN CASE WHEN start_at>1 THEN '… ' ELSE '' END||substr(p_text,start_at,end_at-start_at+1)||CASE WHEN end_at<length(p_text) THEN ' …' ELSE '' END;
END $$;
REVOKE ALL ON FUNCTION public.desktop_memory_excerpt(text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_memory_excerpt(text,text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.desktop_search_project_chats(p_user uuid,p_project uuid,p_exclude uuid,p_query text,p_limit integer)
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
NOTIFY pgrst,'reload schema';
