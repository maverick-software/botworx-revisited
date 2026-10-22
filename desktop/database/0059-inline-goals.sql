-- New goal entry points use NULL for unlimited work. Existing saved limits remain intact.
ALTER TABLE public.desktop_goals ALTER COLUMN max_turns DROP DEFAULT;
CREATE OR REPLACE FUNCTION public.desktop_implement_plan(p_user uuid,p_plan uuid,p_revision bigint,p_turns integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE selected desktop_plans;result desktop_goals;chat_id uuid;
BEGIN
 SELECT conversation_id INTO chat_id FROM desktop_plans WHERE id=p_plan AND user_id=p_user;
 PERFORM 1 FROM conversation_sessions WHERE conversation_id=chat_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.';END IF;
 SELECT * INTO selected FROM desktop_plans WHERE id=p_plan AND user_id=p_user FOR UPDATE;
 IF selected.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'The plan changed. Review its latest version before implementing.';END IF;
 IF p_turns IS NOT NULL AND p_turns NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Choose no turn limit or a whole number from 1 to 1000.';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(selected.steps) s WHERE s->>'status'<>'completed') THEN RAISE EXCEPTION 'Every plan step is already marked complete.';END IF;
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE user_id=p_user AND status='running') OR EXISTS(SELECT 1 FROM desktop_goals WHERE user_id=p_user AND status='running') THEN RAISE EXCEPTION 'Finish or pause the current work before implementing a plan.';END IF;
 UPDATE desktop_plans SET approved_content_revision=content_revision,revision=revision+1,updated_by='user',source_request=NULL,updated_at=now() WHERE id=p_plan RETURNING * INTO selected;
 INSERT INTO desktop_goals(user_id,agent_id,conversation_id,project_id,objective,max_turns,plan_id,plan_snapshot)
  SELECT p_user,selected.agent_id,selected.conversation_id,(SELECT project_id FROM desktop_project_chats WHERE conversation_id=selected.conversation_id AND user_id=p_user),
   'Implement the approved plan: '||selected.title,p_turns,selected.id,to_jsonb(selected) RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.desktop_implement_plan(uuid,uuid,bigint,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_implement_plan(uuid,uuid,bigint,integer) TO service_role;
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
 UPDATE desktop_goals g SET conversation_id=source.conversation_id,updated_at=now()
 FROM (
  SELECT DISTINCT ON(g.id) g.id,r.conversation_id
  FROM desktop_goals g
  JOIN chat_messages_v2 m ON m.metadata->>'goal_id'=g.id::text
  JOIN desktop_requests r ON r.user_message_id=m.id AND r.user_id=g.user_id
  WHERE g.conversation_id IS NULL
  ORDER BY g.id,r.created_at,r.id
 ) source
 WHERE g.id=source.id AND g.conversation_id IS NULL;

$$;
REVOKE ALL ON FUNCTION public.desktop_recover_goal_turns() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_recover_goal_turns() TO service_role;
NOTIFY pgrst,'reload schema';
