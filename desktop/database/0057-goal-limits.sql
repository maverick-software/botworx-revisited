-- Existing goals retain their limits. NULL explicitly represents no turn cap.
ALTER TABLE public.desktop_goals ALTER COLUMN max_turns DROP NOT NULL;
ALTER TABLE public.desktop_goals DROP CONSTRAINT desktop_goals_max_turns_check;
ALTER TABLE public.desktop_goals ADD CONSTRAINT desktop_goals_max_turns_check CHECK(max_turns IS NULL OR max_turns BETWEEN 1 AND 1000);
ALTER TABLE public.desktop_goals ALTER COLUMN turns_used TYPE bigint;
ALTER TABLE public.desktop_goals ADD CONSTRAINT desktop_goals_usage_safe CHECK(turns_used<=9007199254740991);
ALTER TABLE public.desktop_goals ADD COLUMN token_budget bigint CHECK(token_budget>0 AND token_budget<=9007199254740991);

CREATE OR REPLACE FUNCTION public.desktop_recover_goal_turns() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH usage AS (
  SELECT g.id, least(9007199254740991,coalesce(sum(CASE
   WHEN jsonb_typeof(n.state->'goalTurns')='number'
    AND (n.state->>'goalTurns') ~ '^[0-9]{1,16}$'
   THEN least(9007199254740991,(n.state->>'goalTurns')::bigint)
   ELSE 1 END) FILTER (WHERE r.id IS NOT NULL),0))::bigint AS turns
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
