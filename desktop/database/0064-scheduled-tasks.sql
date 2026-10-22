-- Desktop schedules are opt-in. Existing agent_tasks remain unchanged and paused.
CREATE TABLE public.desktop_scheduled_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),status text NOT NULL CHECK(status IN ('active','paused','completed','deleted')),
 cadence jsonb NOT NULL CHECK(jsonb_typeof(cadence)='object' AND cadence->>'kind' IN ('once','interval','cron')),
 anchor timestamptz NOT NULL,next_at timestamptz,missed text NOT NULL CHECK(missed IN ('skip','latest')),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),note text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.desktop_scheduled_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES desktop_scheduled_tasks(id) ON DELETE CASCADE,task_revision integer NOT NULL,
 request_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,scheduled_for timestamptz NOT NULL,
 trigger text NOT NULL CHECK(trigger IN ('schedule','manual')),status text NOT NULL CHECK(status IN ('pending','starting','running','held','completed','failed','cancelled','skipped')),
 snapshot jsonb NOT NULL,conversation_id uuid,error text,unread boolean NOT NULL DEFAULT false,
 started_at timestamptz,request_created_at timestamptz,finished_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX desktop_schedule_occurrence ON desktop_scheduled_runs(task_id,scheduled_for) WHERE trigger='schedule';
CREATE UNIQUE INDEX desktop_schedule_open_run ON desktop_scheduled_runs(task_id) WHERE status IN ('pending','starting','running','held');
CREATE INDEX desktop_schedules_owner_due ON desktop_scheduled_tasks(user_id,next_at) WHERE status='active';
CREATE INDEX desktop_schedule_runs_owner ON desktop_scheduled_runs(user_id,created_at DESC);
ALTER TABLE desktop_requests ADD COLUMN scheduled_run_id uuid REFERENCES desktop_scheduled_runs(id) ON DELETE SET NULL;
ALTER TABLE desktop_scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE desktop_scheduled_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON desktop_scheduled_tasks,desktop_scheduled_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON desktop_scheduled_tasks,desktop_scheduled_runs TO service_role;

CREATE FUNCTION public.desktop_schedule_task_json(p public.desktop_scheduled_tasks) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',p.id,'owner',p.user_id,'revision',p.revision,'status',p.status,'cadence',p.cadence,'anchor',p.anchor,'nextAt',p.next_at,'missed',p.missed,'snapshot',p.snapshot,'note',p.note)
$$;
CREATE FUNCTION public.desktop_schedule_run_json(p public.desktop_scheduled_runs) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',p.id,'taskId',p.task_id,'owner',p.user_id,'taskRevision',p.task_revision,'requestId',p.request_id,'scheduledFor',p.scheduled_for,'trigger',p.trigger,'status',p.status,'snapshot',p.snapshot,'conversationId',p.conversation_id,'error',p.error,'unread',p.unread,'requestCreatedAt',p.request_created_at)
$$;

CREATE FUNCTION public.desktop_validate_schedule_snapshot(p_user uuid,p_value jsonb)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE agent uuid:=(p_value->>'agentId')::uuid; project uuid:=(p_value->>'projectId')::uuid; conversation uuid:=(p_value->>'conversationId')::uuid; member uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents a JOIN desktop_agent_profiles p ON p.agent_id=a.id AND p.user_id=p_user WHERE a.id=agent AND a.user_id=p_user AND a.active AND p.revision=(p_value->>'agentRevision')::integer) THEN RAISE EXCEPTION 'The scheduled agent changed or is unavailable. Review the task.'; END IF;
 IF length(btrim(coalesce(p_value->>'name','')))=0 OR length(p_value->>'name')>200 OR length(btrim(coalesce(p_value->>'instructions','')))=0 OR length(p_value->>'instructions')>50000 THEN RAISE EXCEPTION 'Enter a task name and instructions.'; END IF;
 IF project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_projects WHERE id=project AND user_id=p_user AND revision=(p_value->>'projectRevision')::integer) THEN RAISE EXCEPTION 'The scheduled project changed. Review the task.'; END IF;
 IF conversation IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM conversation_sessions WHERE conversation_id=conversation AND user_id=p_user) THEN RAISE EXCEPTION 'The scheduled chat is unavailable.'; END IF;
  SELECT project_id INTO member FROM desktop_project_chats WHERE conversation_id=conversation AND user_id=p_user;
  IF member IS DISTINCT FROM project THEN RAISE EXCEPTION 'The scheduled chat moved to another project.'; END IF;
 END IF;
 IF coalesce(p_value->'options'->>'provider','') NOT IN ('openai-oauth','openrouter') OR nullif(p_value->'options'->>'model','') IS NULL OR coalesce(p_value->'options'->>'permission','') NOT IN ('chat','ask','files','full') OR coalesce(p_value->'options'->>'mode','') NOT IN ('chat','plan') OR p_value->'options'->>'goalId' IS NOT NULL OR coalesce(p_value->'options'->>'harness','codex')<>'codex' THEN RAISE EXCEPTION 'Choose valid scheduled response settings.'; END IF;
 IF jsonb_typeof(p_value->'files') IS DISTINCT FROM 'array' OR jsonb_typeof(p_value->'options'->'files') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid scheduled file context.'; END IF;
 IF jsonb_array_length(p_value->'files')>20 OR jsonb_array_length(p_value->'files')<>jsonb_array_length(p_value->'options'->'files') OR (SELECT count(DISTINCT f->>'id') FROM jsonb_array_elements(p_value->'files') f)<>jsonb_array_length(p_value->'files') OR (SELECT count(DISTINCT f) FROM jsonb_array_elements(p_value->'options'->'files') f)<>jsonb_array_length(p_value->'options'->'files') OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_value->'files') f WHERE nullif(f->>'path','') IS NULL OR coalesce(f->>'kind','') NOT IN ('file','folder') OR coalesce(f->>'id','') !~* '^[a-f0-9-]{36}$' OR NOT (p_value->'options'->'files' ? (f->>'id'))
 ) THEN RAISE EXCEPTION 'Scheduled file bindings changed. Select the context again.'; END IF;
END $$;

CREATE FUNCTION public.desktop_save_schedule(p_user uuid,p_id uuid,p_revision integer,p_value jsonb,p_status text,p_next timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current desktop_scheduled_tasks; result desktop_scheduled_tasks;
BEGIN
 IF p_status NOT IN ('active','paused') OR p_value->>'missed' NOT IN ('skip','latest') THEN RAISE EXCEPTION 'Choose a task status and missed-run policy.'; END IF;
 PERFORM desktop_validate_schedule_snapshot(p_user,p_value->'snapshot');
 SELECT * INTO current FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF FOUND THEN
  IF current.status='deleted' OR current.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'This task changed. Reload it before saving.'; END IF;
  IF EXISTS(SELECT 1 FROM desktop_scheduled_runs WHERE task_id=p_id AND status IN ('starting','running','held')) THEN RAISE EXCEPTION 'Stop or inspect the current run before changing this task.'; END IF;
  UPDATE desktop_scheduled_runs SET status='cancelled',error='The task was edited before this run started.',finished_at=now(),updated_at=now() WHERE task_id=p_id AND status='pending';
  UPDATE desktop_scheduled_tasks SET revision=revision+1,status=p_status,cadence=p_value->'cadence',anchor=(p_value->>'anchor')::timestamptz,next_at=p_next,missed=p_value->>'missed',snapshot=p_value->'snapshot',note=NULL,updated_at=now() WHERE id=p_id RETURNING * INTO result;
 ELSE
  IF p_revision IS NOT NULL THEN RAISE EXCEPTION 'This task is unavailable.'; END IF;
  INSERT INTO desktop_scheduled_tasks(id,user_id,status,cadence,anchor,next_at,missed,snapshot) VALUES(p_id,p_user,p_status,p_value->'cadence',(p_value->>'anchor')::timestamptz,p_next,p_value->>'missed',p_value->'snapshot') RETURNING * INTO result;
 END IF;
 RETURN desktop_schedule_task_json(result);
END $$;

CREATE FUNCTION public.desktop_stage_schedule_run(p_user uuid,p_id uuid,p_revision integer,p_due timestamptz,p_next timestamptz,p_skip boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs;
BEGIN
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR task.status<>'active' OR task.revision<>p_revision OR task.next_at IS DISTINCT FROM p_due THEN RETURN NULL; END IF;
 IF p_due>clock_timestamp()+interval '1 second' OR p_next IS NOT NULL AND p_next<=p_due THEN RAISE EXCEPTION 'Invalid task occurrence.'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_scheduled_runs WHERE task_id=p_id AND status IN ('pending','starting','running','held')) THEN RETURN NULL; END IF;
 INSERT INTO desktop_scheduled_runs(user_id,task_id,task_revision,scheduled_for,trigger,status,snapshot,error,finished_at)
 VALUES(p_user,p_id,task.revision,p_due,'schedule',CASE WHEN p_skip THEN 'skipped' ELSE 'pending' END,task.snapshot,CASE WHEN p_skip THEN 'Missed while the local scheduler was unavailable.' END,CASE WHEN p_skip THEN now() END)
 ON CONFLICT(task_id,scheduled_for) WHERE trigger='schedule' DO NOTHING RETURNING * INTO run;
 UPDATE desktop_scheduled_tasks SET next_at=p_next,status=CASE WHEN p_skip AND p_next IS NULL THEN 'completed' ELSE status END,updated_at=now() WHERE id=p_id;
 RETURN CASE WHEN run.id IS NULL THEN NULL ELSE desktop_schedule_run_json(run) END;
END $$;

CREATE FUNCTION public.desktop_claim_schedule_run(p_user uuid,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; task_id uuid;
BEGIN
 SELECT r.task_id INTO task_id FROM desktop_scheduled_runs r WHERE r.id=p_run AND r.user_id=p_user;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=task_id AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.status<>'pending' THEN RETURN NULL; END IF;
 IF task.status='deleted' OR task.revision<>run.task_revision OR run.trigger='schedule' AND task.status<>'active' THEN
  UPDATE desktop_scheduled_runs SET status='cancelled',error='Scheduling changed before this response started.',finished_at=now(),updated_at=now() WHERE id=p_run;RETURN NULL;
 END IF;
 BEGIN PERFORM desktop_validate_schedule_snapshot(p_user,run.snapshot);
 EXCEPTION WHEN OTHERS THEN
  UPDATE desktop_scheduled_runs SET status='held',error=SQLERRM,unread=true,updated_at=now() WHERE id=p_run;
  UPDATE desktop_scheduled_tasks SET status='paused',note=SQLERRM,updated_at=now() WHERE id=task_id;RETURN NULL;
 END;
 UPDATE desktop_scheduled_runs SET status='starting',started_at=now(),updated_at=now() WHERE id=p_run RETURNING * INTO run;
 RETURN desktop_schedule_run_json(run);
END $$;

CREATE FUNCTION public.desktop_finish_schedule_run(p_user uuid,p_run uuid,p_status text,p_conversation uuid,p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid;
BEGIN
 IF p_status NOT IN ('completed','failed','cancelled','held') THEN RAISE EXCEPTION 'Invalid scheduled response outcome.'; END IF;
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;IF NOT FOUND THEN RAISE EXCEPTION 'Run unavailable.'; END IF;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.status IN ('completed','failed','cancelled','skipped') THEN RETURN; END IF;
 IF p_conversation IS NOT NULL AND NOT EXISTS(SELECT 1 FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user) THEN RAISE EXCEPTION 'Run conversation unavailable.'; END IF;
 IF p_conversation IS NOT NULL AND EXISTS(SELECT 1 FROM desktop_requests WHERE id=run.request_id AND user_id=p_user AND conversation_id<>p_conversation) THEN RAISE EXCEPTION 'The result belongs to another conversation.'; END IF;
 IF p_status='completed' AND NOT EXISTS(SELECT 1 FROM desktop_requests WHERE id=run.request_id AND user_id=p_user AND status='completed' AND conversation_id=p_conversation) THEN RAISE EXCEPTION 'The scheduled response has no saved completion receipt.'; END IF;
 UPDATE desktop_scheduled_runs SET status=p_status,conversation_id=coalesce(p_conversation,conversation_id),error=left(p_error,4000),unread=true,finished_at=CASE WHEN p_status<>'held' THEN now() END,updated_at=now() WHERE id=p_run;
 UPDATE desktop_scheduled_tasks SET status=CASE WHEN p_status IN ('held','failed') THEN 'paused' WHEN next_at IS NULL AND status='active' THEN 'completed' ELSE status END,note=CASE WHEN p_status IN ('held','failed') THEN left(p_error,4000) ELSE note END,updated_at=now() WHERE id=target;
END $$;

CREATE FUNCTION public.desktop_control_schedule(p_user uuid,p_id uuid,p_revision integer,p_action text,p_next timestamptz,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; request_status text;
BEGIN
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR task.status='deleted' OR task.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'The task changed or is unavailable. Reload it.'; END IF;
 IF p_action='pause' THEN
  UPDATE desktop_scheduled_tasks SET status='paused',updated_at=now() WHERE id=p_id RETURNING * INTO task;
  UPDATE desktop_scheduled_runs SET status='cancelled',error='Scheduling paused before this response started.',finished_at=now(),updated_at=now() WHERE task_id=p_id AND status='pending';
 ELSIF p_action='resume' THEN
  PERFORM desktop_validate_schedule_snapshot(p_user,task.snapshot);
  IF p_next IS NULL OR p_next<=clock_timestamp() THEN RAISE EXCEPTION 'Choose a future time before enabling this task.'; END IF;
  IF EXISTS(SELECT 1 FROM desktop_scheduled_runs WHERE task_id=p_id AND status='held') THEN RAISE EXCEPTION 'Inspect and acknowledge the interrupted run before enabling future runs.'; END IF;
  UPDATE desktop_scheduled_tasks SET status='active',next_at=p_next,note=NULL,updated_at=now() WHERE id=p_id RETURNING * INTO task;
 ELSIF p_action='delete' THEN
  UPDATE desktop_scheduled_tasks SET status='deleted',note='Deleted by you.',next_at=NULL,updated_at=now() WHERE id=p_id RETURNING * INTO task;
  UPDATE desktop_scheduled_runs SET status='cancelled',error='The scheduled task was deleted.',finished_at=now(),updated_at=now() WHERE task_id=p_id AND status IN ('pending','starting','running','held');
 ELSIF p_action='manual' THEN
  IF p_run IS NULL THEN RAISE EXCEPTION 'A manual run needs a stable identifier.'; END IF;
  SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run;
  IF FOUND THEN
   IF run.user_id<>p_user OR run.task_id<>p_id THEN RAISE EXCEPTION 'Run identifier unavailable.'; END IF;
   RETURN jsonb_build_object('task',desktop_schedule_task_json(task),'run',desktop_schedule_run_json(run));
  END IF;
  PERFORM desktop_validate_schedule_snapshot(p_user,task.snapshot);
  IF EXISTS(SELECT 1 FROM desktop_scheduled_runs WHERE task_id=p_id AND status IN ('pending','starting','running','held')) THEN RAISE EXCEPTION 'This task already has work to finish or inspect.'; END IF;
  INSERT INTO desktop_scheduled_runs(id,user_id,task_id,task_revision,scheduled_for,trigger,status,snapshot) VALUES(p_run,p_user,p_id,task.revision,now(),'manual','pending',task.snapshot) RETURNING * INTO run;
 ELSIF p_action IN ('read','dismiss','cancel') THEN
  SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND task_id=p_id AND user_id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Run unavailable.'; END IF;
  IF p_action='read' THEN UPDATE desktop_scheduled_runs SET unread=false,updated_at=now() WHERE id=p_run RETURNING * INTO run;
  ELSIF p_action='cancel' THEN UPDATE desktop_scheduled_runs SET status='cancelled',error='Stopped by you. Completed actions remain in the saved conversation.',finished_at=now(),updated_at=now() WHERE id=p_run AND status IN ('pending','starting','running','held') RETURNING * INTO run;
  ELSE
   IF run.status<>'held' THEN RAISE EXCEPTION 'Only an interrupted run can be acknowledged.'; END IF;
   SELECT status INTO request_status FROM desktop_requests WHERE id=run.request_id AND user_id=p_user;
   IF request_status='running' THEN RAISE EXCEPTION 'Stop or inspect the running response before acknowledging its outcome.'; END IF;
   UPDATE desktop_scheduled_runs SET status=CASE WHEN request_status IN ('completed','failed','cancelled') THEN request_status ELSE 'cancelled' END,error=CASE WHEN request_status='completed' THEN NULL ELSE coalesce(error,'Unconfirmed outcome acknowledged by you; no response was replayed.') END,unread=false,finished_at=now(),updated_at=now() WHERE id=p_run RETURNING * INTO run;
  END IF;
 ELSE RAISE EXCEPTION 'Unknown schedule operation.';
 END IF;
 RETURN jsonb_build_object('task',desktop_schedule_task_json(task),'run',CASE WHEN run.id IS NOT NULL THEN desktop_schedule_run_json(run) END);
END $$;

CREATE FUNCTION public.desktop_activate_scheduled_request(p_user uuid,p_run uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid; req desktop_requests;
BEGIN
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.id IS NULL OR run.status<>'starting' OR task.status='deleted' THEN RAISE EXCEPTION 'This scheduled response was stopped before activation.'; END IF;
 SELECT * INTO req FROM desktop_requests WHERE id=run.request_id AND user_id=p_user;
 IF NOT FOUND OR req.agent_id<>(run.snapshot->>'agentId')::uuid OR req.scheduled_run_id IS NOT NULL AND req.scheduled_run_id<>run.id OR NOT EXISTS(SELECT 1 FROM chat_messages_v2 WHERE id=req.user_message_id AND content->>'text'=run.snapshot->>'instructions' AND metadata->'options'=run.snapshot->'options') THEN RAISE EXCEPTION 'Scheduled request unavailable or its input changed.'; END IF;
 target:=req.conversation_id;
 UPDATE desktop_requests SET scheduled_run_id=run.id WHERE id=req.id;
 UPDATE chat_messages_v2 SET metadata=coalesce(metadata,'{}')||jsonb_build_object('scheduled_task',jsonb_build_object('task_id',task.id,'run_id',run.id,'name',run.snapshot->>'name','scheduled_for',run.scheduled_for)) WHERE id IN(req.user_message_id,req.assistant_message_id);
 UPDATE desktop_scheduled_runs SET status='running',request_created_at=coalesce(request_created_at,now()),conversation_id=target,updated_at=now() WHERE id=p_run;
END $$;

-- Named-agent and cross-chat descendants retain the schedule's original scope.
-- Native children share their originating request and are covered directly.
CREATE FUNCTION public.desktop_validate_scheduled_request(p_user uuid,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE run desktop_scheduled_runs; task desktop_scheduled_tasks; snapshots jsonb:='[]'; member uuid;
BEGIN
 FOR run IN
  WITH RECURSIVE ancestry AS (
   SELECT i.id,i.parent_instance_id,i.request_id,ARRAY[i.id] AS visited FROM desktop_requests r JOIN desktop_agent_instances i ON i.id=r.agent_instance_id AND i.user_id=p_user WHERE r.id=p_request AND r.user_id=p_user
   UNION ALL SELECT p.id,p.parent_instance_id,p.request_id,a.visited||p.id FROM ancestry a JOIN desktop_agent_instances p ON p.id=a.parent_instance_id AND p.user_id=p_user WHERE NOT p.id=ANY(a.visited) AND cardinality(a.visited)<32
  ) SELECT r.* FROM desktop_scheduled_runs r WHERE r.user_id=p_user AND (r.request_id=p_request OR r.request_id IN(SELECT request_id FROM ancestry))
 LOOP
  SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=run.task_id AND user_id=p_user;
  IF NOT FOUND OR task.status='deleted' OR run.request_created_at IS NULL OR run.status IN ('pending','held','cancelled','skipped') THEN RAISE EXCEPTION 'The scheduled assignment was revoked or needs inspection.'; END IF;
  PERFORM desktop_validate_schedule_snapshot(p_user,run.snapshot);
  IF run.conversation_id IS NOT NULL THEN
   SELECT project_id INTO member FROM desktop_project_chats WHERE conversation_id=run.conversation_id AND user_id=p_user;
   IF member IS DISTINCT FROM (run.snapshot->>'projectId')::uuid THEN RAISE EXCEPTION 'The scheduled conversation moved to another project.'; END IF;
  END IF;
  snapshots:=snapshots||jsonb_build_array(run.snapshot);
 END LOOP;
 RETURN snapshots;
END $$;

CREATE FUNCTION public.desktop_schedule_request_ids(p_user uuid,p_task uuid,p_run uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM desktop_scheduled_tasks WHERE id=p_task AND user_id=p_user) THEN RAISE EXCEPTION 'Task unavailable.'; END IF;
 WITH RECURSIVE roots AS (
  SELECT request_id FROM desktop_scheduled_runs WHERE task_id=p_task AND user_id=p_user AND (p_run IS NULL OR id=p_run)
 ), descendants AS (
  SELECT i.id,i.request_id,ARRAY[i.id] visited FROM desktop_agent_instances i WHERE i.user_id=p_user AND i.request_id IN(SELECT request_id FROM roots)
  UNION ALL SELECT i.id,i.request_id,d.visited||i.id FROM descendants d JOIN desktop_agent_instances i ON i.parent_instance_id=d.id AND i.user_id=p_user WHERE NOT i.id=ANY(d.visited) AND cardinality(d.visited)<32
 ), requests AS (SELECT request_id FROM roots UNION SELECT request_id FROM descendants WHERE request_id IS NOT NULL)
 SELECT coalesce(jsonb_agg(request_id ORDER BY request_id),'[]') INTO result FROM requests;
 RETURN result;
END $$;

CREATE FUNCTION public.desktop_defer_schedule_run(p_user uuid,p_run uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid;
BEGIN
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.id IS NULL OR run.status<>'starting' OR run.request_created_at IS NOT NULL OR task.status='deleted' OR task.revision<>run.task_revision OR EXISTS(SELECT 1 FROM desktop_requests WHERE id=run.request_id) THEN RETURN false; END IF;
 UPDATE desktop_scheduled_runs SET status='pending',started_at=NULL,updated_at=now() WHERE id=p_run;RETURN true;
END $$;

CREATE FUNCTION public.desktop_recover_schedule_runs() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 WITH resolved AS (
  UPDATE desktop_scheduled_runs run SET status=request.status,conversation_id=request.conversation_id,error=request.error,unread=true,finished_at=coalesce(run.finished_at,request.updated_at),updated_at=now() FROM desktop_requests request JOIN chat_messages_v2 message ON message.id=request.user_message_id WHERE request.id=run.request_id AND request.user_id=run.user_id AND request.agent_id=(run.snapshot->>'agentId')::uuid AND message.content->>'text'=run.snapshot->>'instructions' AND message.metadata->'options'=run.snapshot->'options' AND run.status IN ('starting','running') AND request.status IN ('completed','failed','cancelled') RETURNING run.task_id,run.status,run.error
 ) UPDATE desktop_scheduled_tasks task SET status=CASE WHEN resolved.status='failed' THEN 'paused' WHEN task.status='active' AND task.next_at IS NULL THEN 'completed' ELSE task.status END,note=CASE WHEN resolved.status='failed' THEN resolved.error ELSE task.note END,updated_at=now() FROM resolved WHERE resolved.task_id=task.id AND task.status<>'deleted';
 -- Activation must commit before native preparation. Its durable marker stays
 -- after chat deletion; a missing request alone cannot prove no inference ran.
 UPDATE desktop_scheduled_runs r SET status=CASE WHEN t.missed='latest' THEN 'pending' ELSE 'skipped' END,started_at=NULL,error=CASE WHEN t.missed='skip' THEN 'Missed before a chat request was activated.' END,updated_at=now() FROM desktop_scheduled_tasks t WHERE t.id=r.task_id AND r.status='starting' AND r.request_created_at IS NULL AND NOT EXISTS(SELECT 1 FROM desktop_requests WHERE id=r.request_id);
 UPDATE desktop_scheduled_tasks t SET status='paused',note='Agentopia closed during a scheduled response. Inspect its saved result before enabling future runs.',updated_at=now() WHERE EXISTS(SELECT 1 FROM desktop_scheduled_runs r WHERE r.task_id=t.id AND r.status IN ('starting','running')) AND t.status<>'deleted';
 UPDATE desktop_scheduled_runs SET status='held',error='Agentopia restarted after this run was claimed. Its outcome needs inspection; it was not replayed.',unread=true,updated_at=now() WHERE status IN ('starting','running');
 -- A pending occurrence was never claimed, so it cannot have submitted inference.
 UPDATE desktop_scheduled_runs r SET status='skipped',error='This pending occurrence was missed while Agentopia was closed.',finished_at=now(),updated_at=now() FROM desktop_scheduled_tasks t WHERE r.task_id=t.id AND r.status='pending' AND t.missed='skip';
END $$;

REVOKE ALL ON FUNCTION desktop_schedule_task_json(desktop_scheduled_tasks),desktop_schedule_run_json(desktop_scheduled_runs),desktop_validate_schedule_snapshot(uuid,jsonb),desktop_save_schedule(uuid,uuid,integer,jsonb,text,timestamptz),desktop_stage_schedule_run(uuid,uuid,integer,timestamptz,timestamptz,boolean),desktop_claim_schedule_run(uuid,uuid),desktop_finish_schedule_run(uuid,uuid,text,uuid,text),desktop_recover_schedule_runs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_schedule_task_json(desktop_scheduled_tasks),desktop_schedule_run_json(desktop_scheduled_runs),desktop_validate_schedule_snapshot(uuid,jsonb),desktop_save_schedule(uuid,uuid,integer,jsonb,text,timestamptz),desktop_stage_schedule_run(uuid,uuid,integer,timestamptz,timestamptz,boolean),desktop_claim_schedule_run(uuid,uuid),desktop_finish_schedule_run(uuid,uuid,text,uuid,text),desktop_recover_schedule_runs() TO service_role;
REVOKE ALL ON FUNCTION desktop_control_schedule(uuid,uuid,integer,text,timestamptz,uuid),desktop_activate_scheduled_request(uuid,uuid),desktop_validate_scheduled_request(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_control_schedule(uuid,uuid,integer,text,timestamptz,uuid),desktop_activate_scheduled_request(uuid,uuid),desktop_validate_scheduled_request(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION desktop_schedule_request_ids(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_schedule_request_ids(uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION desktop_defer_schedule_run(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_defer_schedule_run(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
