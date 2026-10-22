-- A native Codex request can contain several automatic turns. Count the saved
-- root turns for that request, retaining the previous one-turn legacy fallback.
CREATE OR REPLACE FUNCTION public.desktop_recover_goal_turns() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH usage AS (
  SELECT g.id, coalesce(sum(CASE
   WHEN jsonb_typeof(n.state->'goalTurns')='number'
    AND (n.state->>'goalTurns') ~ '^[0-9]{1,9}$'
   THEN greatest(1,least(10,(n.state->>'goalTurns')::integer))
   ELSE 1 END) FILTER (WHERE r.id IS NOT NULL),0)::integer AS turns
  FROM desktop_goals g
  LEFT JOIN chat_messages_v2 m ON m.metadata->>'goal_id'=g.id::text
  LEFT JOIN desktop_requests r ON r.user_message_id=m.id AND r.user_id=g.user_id
  LEFT JOIN desktop_codex_turns n ON n.request_id=r.id AND n.user_id=g.user_id
  GROUP BY g.id
 )
 UPDATE desktop_goals g SET turns_used=greatest(g.turns_used,usage.turns),updated_at=now()
 FROM usage WHERE usage.id=g.id AND g.turns_used<usage.turns;
$$;
REVOKE ALL ON FUNCTION public.desktop_recover_goal_turns() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_recover_goal_turns() TO service_role;
NOTIFY pgrst,'reload schema';
