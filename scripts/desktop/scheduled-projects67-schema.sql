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
