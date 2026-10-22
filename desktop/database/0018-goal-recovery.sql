CREATE FUNCTION public.desktop_recover_goal_turns() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE desktop_goals g SET turns_used=greatest(g.turns_used,
  (SELECT count(*)::integer FROM desktop_requests r JOIN chat_messages_v2 m ON m.id=r.user_message_id
   WHERE r.user_id=g.user_id AND m.metadata->>'goal_id'=g.id::text)),updated_at=now()
 WHERE g.turns_used<(SELECT count(*) FROM desktop_requests r JOIN chat_messages_v2 m ON m.id=r.user_message_id
  WHERE r.user_id=g.user_id AND m.metadata->>'goal_id'=g.id::text);
$$;
REVOKE ALL ON FUNCTION public.desktop_recover_goal_turns() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_recover_goal_turns() TO service_role;
NOTIFY pgrst,'reload schema';
