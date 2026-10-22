
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
