import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'desktop/database/0070-scheduled-project-workspaces.sql');
const base=await readFile(path.join(root,'desktop/database/0064-scheduled-tasks.sql'),'utf8');
function original(name){const start=base.indexOf('CREATE FUNCTION public.'+name+'(');assert(start>=0);const end=base.indexOf('END $$;',start);assert(end>start);return base.slice(start,end+7).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');}
let sql=await readFile(path.join(root,'scripts/desktop/scheduled-projects67-schema.sql'),'utf8');
let finish=original('desktop_finish_schedule_run');
finish=finish.replace("WHEN next_at IS NULL AND status='active' THEN 'completed'", "WHEN next_at IS NULL AND status='active' AND NOT EXISTS(SELECT 1 FROM desktop_scheduled_runs sibling WHERE sibling.task_id=target AND sibling.status IN ('pending','starting','running','held')) THEN 'completed'");
finish=finish.replace(" UPDATE desktop_scheduled_tasks SET status=CASE", " IF p_status IN ('held','failed') THEN\n  UPDATE desktop_scheduled_runs SET status='cancelled',error='Another project run needs review. This project was not started.',finished_at=now(),updated_at=now() WHERE task_id=target AND id<>p_run AND status='pending';\n END IF;\n UPDATE desktop_scheduled_tasks SET status=CASE");
let control=original('desktop_control_schedule');
control=control.replace('request_status text;', 'request_status text; scope jsonb; first_run jsonb;');
const insert="  INSERT INTO desktop_scheduled_runs(id,user_id,task_id,task_revision,scheduled_for,trigger,status,snapshot) VALUES(p_run,p_user,p_id,task.revision,now(),'manual','pending',task.snapshot) RETURNING * INTO run;";
assert(control.includes(insert));control=control.replace(insert,`  FOR scope IN SELECT * FROM desktop_schedule_project_snapshots(task.snapshot) LOOP
   INSERT INTO desktop_scheduled_runs(id,user_id,task_id,task_revision,scheduled_for,trigger,status,snapshot)
    VALUES(CASE WHEN first_run IS NULL THEN p_run ELSE gen_random_uuid() END,p_user,p_id,task.revision,now(),'manual','pending',scope) RETURNING * INTO run;
   IF first_run IS NULL THEN first_run=desktop_schedule_run_json(run); END IF;
  END LOOP;
  SELECT * INTO run FROM desktop_scheduled_runs WHERE id=p_run AND task_id=p_id AND user_id=p_user;`);
control=control.replace(" RETURN jsonb_build_object('task'", " PERFORM desktop_settle_schedule_task(p_id);\n SELECT * INTO task FROM desktop_scheduled_tasks WHERE id=p_id AND user_id=p_user;\n RETURN jsonb_build_object('task'");
let claim=original('desktop_claim_schedule_run');
claim=claim.replace("  UPDATE desktop_scheduled_tasks SET status='paused'", "  UPDATE desktop_scheduled_runs sibling SET status='cancelled',error='Another project run needs review. This project was not started.',finished_at=now(),updated_at=now() WHERE sibling.task_id=task.id AND sibling.id<>p_run AND sibling.status='pending';\n  UPDATE desktop_scheduled_tasks SET status='paused'");
let activate=original('desktop_activate_scheduled_request');
activate=activate.replace(" SELECT * INTO req FROM desktop_requests", " IF task.revision<>run.task_revision OR run.snapshot ? 'workspace' AND (run.workspace_started_at IS NULL OR run.snapshot->'workspace'->'resolved'->>'runId' IS DISTINCT FROM run.id::text) THEN RAISE EXCEPTION 'The scheduled workspace changed or is not ready.'; END IF;\n PERFORM desktop_validate_schedule_snapshot(p_user,run.snapshot);\n SELECT * INTO req FROM desktop_requests");
activate=activate.replace(' target:=req.conversation_id;', ` IF (SELECT project_id FROM desktop_project_chats WHERE conversation_id=req.conversation_id AND user_id=p_user) IS DISTINCT FROM (run.snapshot->>'projectId')::uuid
  OR run.snapshot->>'conversationId' IS NOT NULL AND req.conversation_id IS DISTINCT FROM (run.snapshot->>'conversationId')::uuid THEN RAISE EXCEPTION 'The scheduled response belongs to another project or chat.'; END IF;
 -- All selected project context is captured in options.files. Do not let a
 -- delegated child regain the original checkout from project.file_ids.
 IF jsonb_typeof((SELECT metadata->'project' FROM chat_messages_v2 WHERE id=req.user_message_id))='object' THEN
  UPDATE chat_messages_v2 SET metadata=jsonb_set(metadata,'{project,file_ids}','[]') WHERE id=req.user_message_id;
 END IF;
 target:=req.conversation_id;`);
let defer=original('desktop_defer_schedule_run');
defer=defer.replace("run.request_created_at IS NOT NULL OR task.status", "run.request_created_at IS NOT NULL OR run.workspace_started_at IS NOT NULL OR task.status");
sql+='\n'+[finish,control,claim,activate,defer].join('\n\n')+'\n';
sql+=await readFile(path.join(root,'scripts/desktop/scheduled-projects67-recovery.sql'),'utf8');
sql+=`\nREVOKE ALL ON FUNCTION desktop_schedule_path(text),desktop_schedule_project_snapshots(jsonb),desktop_schedule_unresolved(jsonb),desktop_validate_schedule_snapshot(uuid,jsonb),desktop_validate_schedule_workspace(uuid,jsonb),desktop_settle_schedule_task(uuid),desktop_begin_schedule_workspace(uuid,uuid),desktop_resolve_schedule_workspace(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION desktop_schedule_path(text),desktop_schedule_project_snapshots(jsonb),desktop_schedule_unresolved(jsonb),desktop_validate_schedule_snapshot(uuid,jsonb),desktop_validate_schedule_workspace(uuid,jsonb),desktop_settle_schedule_task(uuid),desktop_begin_schedule_workspace(uuid,uuid),desktop_resolve_schedule_workspace(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';\n`;
assert(sql.includes('workspace_started_at')&&sql.includes('desktop_schedule_open_run'));await writeFile(file,sql);console.log(file);
