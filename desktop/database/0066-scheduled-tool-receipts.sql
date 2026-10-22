-- A duplicate native/provider call cannot open another review or save another
-- task. Children retain independent call identifiers under their own threads.
CREATE UNIQUE INDEX desktop_schedule_tool_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name IN('save_scheduled_task','control_scheduled_task') AND arguments ? 'provider_call_id';

-- Compare mutable pause/resume state under the same row lock as the save.
-- Revision alone does not detect these controls, which preserve the definition.
CREATE FUNCTION public.desktop_save_reviewed_schedule(p_user uuid,p_id uuid,p_revision integer,p_previous jsonb,p_value jsonb,p_status text,p_next timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current desktop_scheduled_tasks;
BEGIN
 SELECT * INTO current FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF p_revision IS NULL THEN
  IF FOUND OR p_previous IS NOT NULL THEN RAISE EXCEPTION 'This reviewed operation already has a task. Inspect its saved receipt.'; END IF;
 ELSE
  IF NOT FOUND OR current.revision IS DISTINCT FROM p_revision OR p_previous IS NULL
   OR current.status IS DISTINCT FROM p_previous->>'status'
   OR current.next_at IS DISTINCT FROM (p_previous->>'nextAt')::timestamptz THEN
   RAISE EXCEPTION 'This task changed after review. Propose a fresh operation.';
  END IF;
 END IF;
 RETURN desktop_save_schedule(p_user,p_id,p_revision,p_value,p_status,p_next);
END $$;
REVOKE ALL ON FUNCTION desktop_save_reviewed_schedule(uuid,uuid,integer,jsonb,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_save_reviewed_schedule(uuid,uuid,integer,jsonb,jsonb,text,timestamptz) TO service_role;

CREATE FUNCTION public.desktop_control_reviewed_schedule(p_user uuid,p_id uuid,p_revision integer,p_previous jsonb,p_action text,p_next timestamptz,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current desktop_scheduled_tasks;
BEGIN
 SELECT * INTO current FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR current.revision IS DISTINCT FROM p_revision OR p_previous IS NULL
  OR current.status IS DISTINCT FROM p_previous->>'status'
  OR current.next_at IS DISTINCT FROM (p_previous->>'nextAt')::timestamptz THEN
  RAISE EXCEPTION 'This task changed after review. Propose a fresh operation.';
 END IF;
 RETURN desktop_control_schedule(p_user,p_id,p_revision,p_action,p_next,p_run);
END $$;
REVOKE ALL ON FUNCTION desktop_control_reviewed_schedule(uuid,uuid,integer,jsonb,text,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_control_reviewed_schedule(uuid,uuid,integer,jsonb,text,timestamptz,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
