-- Each standalone project receives its own durable response and file scope.
-- Existing tasks keep their single-project behavior and prior run identifiers.
ALTER TABLE public.desktop_scheduled_runs
 ADD COLUMN target_key uuid GENERATED ALWAYS AS ((snapshot->>'projectId')::uuid) STORED,
 ADD COLUMN workspace_started_at timestamptz;
DROP INDEX public.desktop_schedule_occurrence;
DROP INDEX public.desktop_schedule_open_run;
CREATE UNIQUE INDEX desktop_schedule_occurrence ON public.desktop_scheduled_runs
 (task_id,scheduled_for,COALESCE(target_key,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE trigger='schedule';
CREATE UNIQUE INDEX desktop_schedule_open_run ON public.desktop_scheduled_runs
 (task_id,COALESCE(target_key,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status IN ('pending','starting','running','held');

CREATE OR REPLACE FUNCTION public.desktop_schedule_run_json(p public.desktop_scheduled_runs) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',p.id,'taskId',p.task_id,'owner',p.user_id,'taskRevision',p.task_revision,'requestId',p.request_id,'scheduledFor',p.scheduled_for,'trigger',p.trigger,'status',p.status,'snapshot',p.snapshot,'conversationId',p.conversation_id,'error',p.error,'unread',p.unread,'requestCreatedAt',p.request_created_at,'workspaceStartedAt',p.workspace_started_at)
$$;

-- Lexical comparison only; the host independently verifies real paths,
-- ownership, links and Git metadata before preparing or using a checkout.
CREATE FUNCTION public.desktop_schedule_path(p_path text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=public AS $$
DECLARE result text:=replace(p_path,chr(92),'/');
BEGIN
 IF length(result)=0 OR length(result)>32767 OR result ~ '[[:cntrl:]]' OR result !~ '^(/|[A-Za-z]:/)' OR result ~ '(^|/)\.{1,2}(/|$)' THEN RAISE EXCEPTION 'Invalid scheduled workspace path.'; END IF;
 IF result ~ '^([A-Za-z]:/|//)' THEN result=lower(result); END IF;
 IF result<>'/' AND result !~ '^[a-z]:/$' THEN result=regexp_replace(result,'/+$',''); END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.desktop_schedule_project_snapshots(p_value jsonb) RETURNS SETOF jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE target jsonb; scope jsonb; common jsonb:=p_value->'files'; ids uuid[]:='{}'; project uuid;
BEGIN
 IF NOT p_value ? 'targets' THEN RETURN NEXT p_value; RETURN; END IF;
 IF p_value->>'projectId' IS NOT NULL OR p_value->>'projectRevision' IS NOT NULL OR p_value->>'conversationId' IS NOT NULL OR p_value ? 'workspace'
  OR jsonb_typeof(p_value->'targets') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'targets') NOT BETWEEN 1 AND 20 OR jsonb_typeof(common) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Choose separate new chats and valid project scopes for the scheduled projects.';
 END IF;
 FOR target IN SELECT * FROM jsonb_array_elements(p_value->'targets') LOOP
  project=(target->>'projectId')::uuid;
  IF project IS NULL OR project=ANY(ids) OR coalesce(target->>'projectRevision','') !~ '^[1-9][0-9]*$' OR jsonb_typeof(target->'files') IS DISTINCT FROM 'array' OR NOT (target->'files' @> common) OR target->'workspace' ? 'resolved' THEN
   RAISE EXCEPTION 'The scheduled project scope is invalid, duplicated or changed.';
  END IF;
  ids=array_append(ids,project);
  scope=(p_value-'targets')||jsonb_build_object('projectId',project,'projectRevision',target->'projectRevision','files',target->'files');
  scope=jsonb_set(scope,'{options,files}',coalesce((SELECT jsonb_agg(f->'id' ORDER BY n) FROM jsonb_array_elements(target->'files') WITH ORDINALITY t(f,n)),'[]'));
  IF target ? 'workspace' THEN scope=scope||jsonb_build_object('workspace',target->'workspace'); END IF;
  RETURN NEXT scope;
 END LOOP;
END $$;

CREATE FUNCTION public.desktop_schedule_unresolved(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF p_value->'workspace' ? 'resolved' THEN RETURN false; END IF;
 IF jsonb_typeof(p_value->'targets')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'targets') t WHERE t->'workspace' ? 'resolved') THEN RETURN false; END IF;
 RETURN true;
END $$;
ALTER TABLE public.desktop_scheduled_tasks ADD CONSTRAINT desktop_schedule_saved_workspace_unresolved CHECK(desktop_schedule_unresolved(snapshot));

-- Preserve the previous validator and call it for each independent project.
ALTER FUNCTION public.desktop_validate_schedule_snapshot(uuid,jsonb) RENAME TO desktop_validate_schedule_snapshot_single69;
CREATE FUNCTION public.desktop_validate_schedule_workspace(p_user uuid,p_value jsonb) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE workspace jsonb:=p_value->'workspace'; source jsonb:=workspace->'source'; original jsonb; current_file jsonb; source_context jsonb;
 source_root text; checkout_root text; original_path text; expected text; contained boolean; project_reference uuid;
BEGIN
 IF p_value->>'conversationId' IS NOT NULL OR p_value->>'projectId' IS NULL OR p_value->'options'->>'permission'='chat'
  OR jsonb_typeof(workspace) IS DISTINCT FROM 'object' OR workspace->>'mode' IS DISTINCT FROM 'worktree'
  OR jsonb_typeof(source) IS DISTINCT FROM 'object' OR source->>'kind' IS DISTINCT FROM 'folder'
  OR jsonb_typeof(workspace->'sourceFiles') IS DISTINCT FROM 'array' OR jsonb_array_length(workspace->'sourceFiles') NOT BETWEEN 1 AND 20
  OR workspace->'sourceFiles'->0 IS DISTINCT FROM source OR coalesce(workspace->>'ref','') !~ '^(HEAD|refs/(heads|remotes)/[^[:space:][:cntrl:]]+)$' THEN
  RAISE EXCEPTION 'A scheduled worktree needs its owned project folder, source context and a saved Git reference.';
 END IF;
 source_root=desktop_schedule_path(source->>'path');
 IF source_root IS NULL OR desktop_schedule_path(workspace->>'commonDirectory') IS NULL THEN RAISE EXCEPTION 'The saved Git workspace path is unavailable.'; END IF;
 SELECT reference_id INTO project_reference FROM desktop_projects WHERE id=(p_value->>'projectId')::uuid AND user_id=p_user;
 IF project_reference IS NULL OR project_reference IS DISTINCT FROM (source->>'id')::uuid THEN RAISE EXCEPTION 'The scheduled project folder changed. Review the task.'; END IF;
 source_context=jsonb_set(p_value-'workspace','{files}',workspace->'sourceFiles');
 source_context=jsonb_set(source_context,'{options,files}',(SELECT jsonb_agg(f->'id' ORDER BY n) FROM jsonb_array_elements(workspace->'sourceFiles') WITH ORDINALITY t(f,n)));
 PERFORM desktop_validate_schedule_snapshot_single69(p_user,source_context);
 IF (SELECT count(DISTINCT desktop_schedule_path(f->>'path')) FROM jsonb_array_elements(workspace->'sourceFiles') f)<>jsonb_array_length(workspace->'sourceFiles')
  OR EXISTS(SELECT 1 FROM desktop_projects p,unnest(p.file_ids) AS selected(file_id) WHERE p.id=(p_value->>'projectId')::uuid AND p.user_id=p_user AND NOT(source_context->'options'->'files' ? selected.file_id::text)) THEN
  RAISE EXCEPTION 'The worktree source context changed or repeats a path.';
 END IF;
 IF NOT workspace ? 'resolved' THEN
  IF p_value->'files' IS DISTINCT FROM workspace->'sourceFiles' THEN RAISE EXCEPTION 'The unresolved worktree source grants changed.'; END IF;
  RETURN;
 END IF;
 IF jsonb_typeof(workspace->'resolved') IS DISTINCT FROM 'object' OR coalesce(workspace->'resolved'->>'runId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR coalesce(workspace->'resolved'->>'commit','') !~ '^([a-f0-9]{40}|[a-f0-9]{64})$' THEN RAISE EXCEPTION 'Invalid resolved worktree identity.'; END IF;
 checkout_root=desktop_schedule_path(workspace->'resolved'->>'path');
 IF checkout_root IS NULL OR checkout_root=source_root OR starts_with(checkout_root,source_root||'/') OR starts_with(source_root,checkout_root||'/')
  OR jsonb_array_length(p_value->'files')<>jsonb_array_length(workspace->'sourceFiles') OR desktop_schedule_path(p_value->'files'->0->>'path') IS DISTINCT FROM checkout_root
  OR p_value->'files'->0->>'kind' IS DISTINCT FROM 'folder'
  OR (SELECT count(DISTINCT desktop_schedule_path(f->>'path')) FROM jsonb_array_elements(p_value->'files') f)<>jsonb_array_length(p_value->'files') THEN
  RAISE EXCEPTION 'The resolved checkout overlaps the source or changed its file scope.';
 END IF;
 FOR original IN SELECT * FROM jsonb_array_elements(workspace->'sourceFiles') LOOP
  original_path=desktop_schedule_path(original->>'path');
  contained=original_path=source_root OR starts_with(original_path,source_root||'/');
  expected=CASE WHEN contained THEN checkout_root||substring(original_path FROM length(source_root)+1) ELSE original_path END;
  SELECT f INTO current_file FROM jsonb_array_elements(p_value->'files') f WHERE desktop_schedule_path(f->>'path')=expected AND f->>'kind'=original->>'kind';
  IF current_file IS NULL OR contained AND source_context->'options'->'files' ? (current_file->>'id') OR NOT contained AND current_file IS DISTINCT FROM original THEN
   RAISE EXCEPTION 'A resolved workspace binding escaped its checkout or changed external context.';
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.desktop_validate_schedule_snapshot(p_user uuid,p_value jsonb) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE scope jsonb;
BEGIN
 -- This validates the common agent/model/context, including empty or malformed
 -- common grants, before independently validating project membership/revision.
 PERFORM desktop_validate_schedule_snapshot_single69(p_user,p_value);
 FOR scope IN SELECT * FROM desktop_schedule_project_snapshots(p_value) LOOP
  PERFORM desktop_validate_schedule_snapshot_single69(p_user,scope);
  IF scope->'options'->>'permission'='chat' AND jsonb_array_length(scope->'files')<>0 THEN RAISE EXCEPTION 'Chat only does not share scheduled project files.'; END IF;
  IF scope ? 'workspace' THEN PERFORM desktop_validate_schedule_workspace(p_user,scope); END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.desktop_settle_schedule_task(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE desktop_scheduled_tasks t SET status='completed',updated_at=now()
 WHERE t.id=p_id AND t.status='active' AND t.next_at IS NULL
 AND EXISTS(SELECT 1 FROM desktop_scheduled_runs r WHERE r.task_id=t.id)
 AND NOT EXISTS(SELECT 1 FROM desktop_scheduled_runs r WHERE r.task_id=t.id AND r.status IN ('pending','starting','running','held'))
$$;

CREATE OR REPLACE FUNCTION public.desktop_stage_schedule_run(p_user uuid,p_id uuid,p_revision integer,p_due timestamptz,p_next timestamptz,p_skip boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; scope jsonb; first_run jsonb;
BEGIN
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR task.status<>'active' OR task.revision<>p_revision OR task.next_at IS DISTINCT FROM p_due THEN RETURN NULL; END IF;
 IF p_due>clock_timestamp()+interval '1 second' OR p_next IS NOT NULL AND p_next<=p_due THEN RAISE EXCEPTION 'Invalid task occurrence.'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_scheduled_runs WHERE task_id=p_id AND status IN ('pending','starting','running','held')) THEN RETURN NULL; END IF;
 FOR scope IN SELECT * FROM desktop_schedule_project_snapshots(task.snapshot) LOOP
  INSERT INTO desktop_scheduled_runs(user_id,task_id,task_revision,scheduled_for,trigger,status,snapshot,error,finished_at)
   VALUES(p_user,p_id,task.revision,p_due,'schedule',CASE WHEN p_skip THEN 'skipped' ELSE 'pending' END,scope,CASE WHEN p_skip THEN 'Missed while the local scheduler was unavailable.' END,CASE WHEN p_skip THEN now() END) RETURNING * INTO run;
  IF first_run IS NULL THEN first_run=desktop_schedule_run_json(run); END IF;
 END LOOP;
 UPDATE desktop_scheduled_tasks SET next_at=p_next,status=CASE WHEN p_skip AND p_next IS NULL THEN 'completed' ELSE status END,updated_at=now() WHERE id=p_id;
 RETURN first_run;
END $$;

-- The broker records intent before any Git/filesystem mutation. A restart from
-- this point is held even when no provider request was created.
CREATE FUNCTION public.desktop_begin_schedule_workspace(p_user uuid,p_run uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid;
BEGIN
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.id IS NULL OR run.status<>'starting' OR task.status='deleted' OR task.revision<>run.task_revision OR run.request_created_at IS NOT NULL
  OR NOT run.snapshot ? 'workspace' OR run.snapshot->'workspace' ? 'resolved' OR EXISTS(SELECT 1 FROM desktop_requests WHERE id=run.request_id) THEN
  RAISE EXCEPTION 'The worktree run changed or was already submitted. Inspect its saved outcome.';
 END IF;
 PERFORM desktop_validate_schedule_snapshot(p_user,run.snapshot);
 IF run.workspace_started_at IS NOT NULL THEN RAISE EXCEPTION 'Workspace preparation already started. Inspect its journal before continuing.'; END IF;
 UPDATE desktop_scheduled_runs SET workspace_started_at=now(),updated_at=now() WHERE id=p_run RETURNING * INTO run;
 RETURN desktop_schedule_run_json(run);
END $$;

CREATE FUNCTION public.desktop_resolve_schedule_workspace(p_user uuid,p_run uuid,p_resolution jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid; result jsonb;
BEGIN
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.id IS NULL OR run.status<>'starting' OR task.status='deleted' OR task.revision<>run.task_revision OR run.request_created_at IS NOT NULL
  OR run.workspace_started_at IS NULL OR NOT run.snapshot ? 'workspace' OR EXISTS(SELECT 1 FROM desktop_requests WHERE id=run.request_id)
  OR jsonb_typeof(p_resolution) IS DISTINCT FROM 'object' OR p_resolution-'files'-'resolved'<>'{}'::jsonb
  OR p_resolution->'resolved'->>'runId' IS DISTINCT FROM run.id::text OR jsonb_typeof(p_resolution->'files') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'The prepared worktree scope changed or this response was already submitted.';
 END IF;
 result=jsonb_set(run.snapshot,'{files}',p_resolution->'files');
 result=jsonb_set(result,'{options,files}',coalesce((SELECT jsonb_agg(f->'id' ORDER BY n) FROM jsonb_array_elements(p_resolution->'files') WITH ORDINALITY t(f,n)),'[]'));
 result=jsonb_set(result,'{workspace,resolved}',p_resolution->'resolved');
 PERFORM desktop_validate_schedule_snapshot(p_user,result);
 IF run.snapshot->'workspace' ? 'resolved' THEN
  IF result IS DISTINCT FROM run.snapshot THEN RAISE EXCEPTION 'The worktree was already resolved with another scope. Inspect its saved journal.'; END IF;
 ELSE UPDATE desktop_scheduled_runs SET snapshot=result,updated_at=now() WHERE id=p_run RETURNING * INTO run;
 END IF;
 RETURN desktop_schedule_run_json(run);
END $$;

CREATE OR REPLACE FUNCTION public.desktop_finish_schedule_run(p_user uuid,p_run uuid,p_status text,p_conversation uuid,p_error text)
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
 IF p_status IN ('held','failed') THEN
  UPDATE desktop_scheduled_runs SET status='cancelled',error='Another project run needs review. This project was not started.',finished_at=now(),updated_at=now() WHERE task_id=target AND id<>p_run AND status='pending';
 END IF;
 UPDATE desktop_scheduled_tasks SET status=CASE WHEN p_status IN ('held','failed') THEN 'paused' WHEN next_at IS NULL AND status='active' AND NOT EXISTS(SELECT 1 FROM desktop_scheduled_runs sibling WHERE sibling.task_id=target AND sibling.status IN ('pending','starting','running','held')) THEN 'completed' ELSE status END,note=CASE WHEN p_status IN ('held','failed') THEN left(p_error,4000) ELSE note END,updated_at=now() WHERE id=target;
END $$;

CREATE OR REPLACE FUNCTION public.desktop_control_schedule(p_user uuid,p_id uuid,p_revision integer,p_action text,p_next timestamptz,p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; request_status text; scope jsonb; first_run jsonb;
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
   PERFORM desktop_settle_schedule_task(p_id);
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user;
 RETURN jsonb_build_object('task',desktop_schedule_task_json(task),'run',desktop_schedule_run_json(run));
  END IF;
  PERFORM desktop_validate_schedule_snapshot(p_user,task.snapshot);
  IF EXISTS(SELECT 1 FROM desktop_scheduled_runs WHERE task_id=p_id AND status IN ('pending','starting','running','held')) THEN RAISE EXCEPTION 'This task already has work to finish or inspect.'; END IF;
  FOR scope IN SELECT * FROM desktop_schedule_project_snapshots(task.snapshot) LOOP
   INSERT INTO desktop_scheduled_runs(id,user_id,task_id,task_revision,scheduled_for,trigger,status,snapshot)
    VALUES(CASE WHEN first_run IS NULL THEN p_run ELSE gen_random_uuid() END,p_user,p_id,task.revision,now(),'manual','pending',scope) RETURNING * INTO run;
   IF first_run IS NULL THEN first_run=desktop_schedule_run_json(run); END IF;
  END LOOP;
  SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND task_id=p_id AND user_id=p_user;
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

CREATE OR REPLACE FUNCTION public.desktop_claim_schedule_run(p_user uuid,p_run uuid)
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
  UPDATE desktop_scheduled_runs sibling SET status='cancelled',error='Another project run needs review. This project was not started.',finished_at=now(),updated_at=now() WHERE sibling.task_id=task.id AND sibling.id<>p_run AND sibling.status='pending';
  UPDATE desktop_scheduled_tasks SET status='paused',note=SQLERRM,updated_at=now() WHERE id=task_id;RETURN NULL;
 END;
 UPDATE desktop_scheduled_runs SET status='starting',started_at=now(),updated_at=now() WHERE id=p_run RETURNING * INTO run;
 RETURN desktop_schedule_run_json(run);
END $$;

CREATE OR REPLACE FUNCTION public.desktop_activate_scheduled_request(p_user uuid,p_run uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid; req desktop_requests;
BEGIN
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.id IS NULL OR run.status<>'starting' OR task.status='deleted' THEN RAISE EXCEPTION 'This scheduled response was stopped before activation.'; END IF;
 IF task.revision<>run.task_revision OR run.snapshot ? 'workspace' AND (run.workspace_started_at IS NULL OR run.snapshot->'workspace'->'resolved'->>'runId' IS DISTINCT FROM run.id::text) THEN RAISE EXCEPTION 'The scheduled workspace changed or is not ready.'; END IF;
 PERFORM desktop_validate_schedule_snapshot(p_user,run.snapshot);
 SELECT * INTO req FROM desktop_requests WHERE id=run.request_id AND user_id=p_user;
 IF NOT FOUND OR req.agent_id<>(run.snapshot->>'agentId')::uuid OR req.scheduled_run_id IS NOT NULL AND req.scheduled_run_id<>run.id OR NOT EXISTS(SELECT 1 FROM chat_messages_v2 WHERE id=req.user_message_id AND content->>'text'=run.snapshot->>'instructions' AND metadata->'options'=run.snapshot->'options') THEN RAISE EXCEPTION 'Scheduled request unavailable or its input changed.'; END IF;
 IF (SELECT project_id FROM desktop_project_chats WHERE conversation_id=req.conversation_id AND user_id=p_user) IS DISTINCT FROM (run.snapshot->>'projectId')::uuid
  OR run.snapshot->>'conversationId' IS NOT NULL AND req.conversation_id IS DISTINCT FROM (run.snapshot->>'conversationId')::uuid THEN RAISE EXCEPTION 'The scheduled response belongs to another project or chat.'; END IF;
 -- All selected project context is captured in options.files. Do not let a
 -- delegated child regain the original checkout from project.file_ids.
 IF jsonb_typeof((SELECT metadata->'project' FROM chat_messages_v2 WHERE id=req.user_message_id))='object' THEN
  UPDATE chat_messages_v2 SET metadata=jsonb_set(metadata,'{project,file_ids}','[]') WHERE id=req.user_message_id;
 END IF;
 target:=req.conversation_id;
 UPDATE desktop_requests SET scheduled_run_id=run.id WHERE id=req.id;
 UPDATE chat_messages_v2 SET metadata=coalesce(metadata,'{}')||jsonb_build_object('scheduled_task',jsonb_build_object('task_id',task.id,'run_id',run.id,'name',run.snapshot->>'name','scheduled_for',run.scheduled_for)) WHERE id IN(req.user_message_id,req.assistant_message_id);
 UPDATE desktop_scheduled_runs SET status='running',request_created_at=coalesce(request_created_at,now()),conversation_id=target,updated_at=now() WHERE id=p_run;
END $$;

CREATE OR REPLACE FUNCTION public.desktop_defer_schedule_run(p_user uuid,p_run uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task desktop_scheduled_tasks; run desktop_scheduled_runs; target uuid;
BEGIN
 SELECT task_id INTO target FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user;
 SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=target AND user_id=p_user FOR UPDATE;
 SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND user_id=p_user FOR UPDATE;
 IF run.id IS NULL OR run.status<>'starting' OR run.request_created_at IS NOT NULL OR run.workspace_started_at IS NOT NULL OR task.status='deleted' OR task.revision<>run.task_revision OR EXISTS(SELECT 1 FROM desktop_requests WHERE id=run.request_id) THEN RETURN false; END IF;
 UPDATE desktop_scheduled_runs SET status='pending',started_at=NULL,updated_at=now() WHERE id=p_run;RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.desktop_recover_schedule_runs() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
 WITH resolved AS (
 UPDATE desktop_scheduled_runs run SET status=request.status,conversation_id=request.conversation_id,error=request.error,unread=true,finished_at=coalesce(run.finished_at,request.updated_at),updated_at=now()
 FROM desktop_requests request JOIN chat_messages_v2 message ON message.id=request.user_message_id
 WHERE request.id=run.request_id AND request.user_id=run.user_id AND request.agent_id=(run.snapshot->>'agentId')::uuid
 AND message.content->>'text'=run.snapshot->>'instructions' AND message.metadata->'options'=run.snapshot->'options'
 AND run.status IN ('starting','running') AND request.status IN ('completed','failed','cancelled') RETURNING run.task_id,run.status,run.error
 )
 UPDATE desktop_scheduled_tasks task SET status='paused',note=failed.error,updated_at=now()
 FROM (SELECT DISTINCT ON(task_id) task_id,error FROM resolved WHERE status='failed' ORDER BY task_id) failed
 WHERE failed.task_id=task.id AND task.status<>'deleted';
 -- No chat and no workspace mutation marker jointly prove this reservation
 -- never began execution. An uncertain checkout is always held for review.
 UPDATE desktop_scheduled_runs r SET status=CASE WHEN t.missed='latest' THEN 'pending' ELSE 'skipped' END,started_at=NULL,error=CASE WHEN t.missed='skip' THEN 'Missed before a chat request was activated.' END,updated_at=now()
 FROM desktop_scheduled_tasks t WHERE t.id=r.task_id AND r.status='starting' AND r.request_created_at IS NULL AND r.workspace_started_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM desktop_requests WHERE id=r.request_id);
 UPDATE desktop_scheduled_tasks t SET status='paused',note='Agentopia closed during a scheduled response or workspace preparation. Inspect its saved result before enabling future runs.',updated_at=now()
 WHERE EXISTS(SELECT 1 FROM desktop_scheduled_runs r WHERE r.task_id=t.id AND r.status IN ('starting','running')) AND t.status<>'deleted';
 UPDATE desktop_scheduled_runs SET status='held',error='Agentopia restarted after this run began. Inspect its response or workspace journal; it was not replayed.',unread=true,updated_at=now()
 WHERE status IN ('starting','running');
 UPDATE desktop_scheduled_runs r SET status='cancelled',error='Another project run needs review. This project was not started.',finished_at=now(),updated_at=now()
 FROM desktop_scheduled_tasks t WHERE t.id=r.task_id AND t.status='paused' AND r.status='pending'
 AND EXISTS(SELECT 1 FROM desktop_scheduled_runs sibling WHERE sibling.task_id=t.id AND sibling.status IN ('held','failed'));
 UPDATE desktop_scheduled_runs r SET status='skipped',error='This pending occurrence was missed while Agentopia was closed.',finished_at=now(),updated_at=now()
 FROM desktop_scheduled_tasks t WHERE r.task_id=t.id AND r.status='pending' AND t.missed='skip';
 FOR target IN SELECT id FROM desktop_scheduled_tasks WHERE status='active' AND next_at IS NULL LOOP
  PERFORM desktop_settle_schedule_task(target);
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION desktop_schedule_path(text),desktop_schedule_project_snapshots(jsonb),desktop_schedule_unresolved(jsonb),desktop_validate_schedule_snapshot(uuid,jsonb),desktop_validate_schedule_workspace(uuid,jsonb),desktop_settle_schedule_task(uuid),desktop_begin_schedule_workspace(uuid,uuid),desktop_resolve_schedule_workspace(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_schedule_path(text),desktop_schedule_project_snapshots(jsonb),desktop_schedule_unresolved(jsonb),desktop_validate_schedule_snapshot(uuid,jsonb),desktop_validate_schedule_workspace(uuid,jsonb),desktop_settle_schedule_task(uuid),desktop_begin_schedule_workspace(uuid,uuid),desktop_resolve_schedule_workspace(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
