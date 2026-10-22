-- Import is an explicit human operation. Old definitions remain unchanged.
ALTER TABLE public.desktop_scheduled_tasks
 ADD COLUMN legacy_task_id uuid,
 ADD COLUMN legacy_updated_at timestamptz;
CREATE UNIQUE INDEX desktop_schedule_legacy_import ON public.desktop_scheduled_tasks(user_id,legacy_task_id) WHERE legacy_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.desktop_schedule_task_json(p public.desktop_scheduled_tasks) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',p.id,'owner',p.user_id,'revision',p.revision,'status',p.status,'cadence',p.cadence,'anchor',p.anchor,'nextAt',p.next_at,'missed',p.missed,'snapshot',p.snapshot,'note',p.note,'legacyTaskId',p.legacy_task_id,'legacyUpdatedAt',p.legacy_updated_at)
$$;

CREATE FUNCTION public.desktop_import_legacy_schedule(p_user uuid,p_legacy uuid,p_updated timestamptz,p_value jsonb,p_next timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE legacy agent_tasks; result desktop_scheduled_tasks; saved jsonb;
BEGIN
 -- The source row serializes competing import requests, including retry after
 -- a lost response. A deleted imported task is retained and cannot be revived.
 SELECT * INTO legacy FROM agent_tasks WHERE id=p_legacy AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This earlier schedule is unavailable.'; END IF;
 SELECT * INTO result FROM desktop_scheduled_tasks WHERE user_id=p_user AND legacy_task_id=p_legacy;
 IF FOUND THEN
  IF result.status='deleted' THEN RAISE EXCEPTION 'This earlier schedule was already imported and its new task was deleted.'; END IF;
  RETURN desktop_schedule_task_json(result);
 END IF;
 IF legacy.status<>'paused' OR legacy.updated_at IS DISTINCT FROM p_updated THEN RAISE EXCEPTION 'This earlier schedule changed. Reload it before importing.'; END IF;
 IF (p_value->'snapshot'->>'agentId')::uuid IS DISTINCT FROM legacy.agent_id THEN RAISE EXCEPTION 'The imported task must use its original agent.'; END IF;
 saved=desktop_save_schedule(p_user,gen_random_uuid(),NULL,p_value,'paused',p_next);
 UPDATE desktop_scheduled_tasks SET legacy_task_id=p_legacy,legacy_updated_at=p_updated WHERE id=(saved->>'id')::uuid RETURNING * INTO result;
 RETURN desktop_schedule_task_json(result);
END $$;
REVOKE ALL ON FUNCTION desktop_import_legacy_schedule(uuid,uuid,timestamptz,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_import_legacy_schedule(uuid,uuid,timestamptz,jsonb,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
