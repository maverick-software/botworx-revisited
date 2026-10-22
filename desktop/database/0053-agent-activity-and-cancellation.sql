CREATE INDEX desktop_requests_agent_instance ON public.desktop_requests(agent_instance_id,user_id);
ALTER FUNCTION public.desktop_agent_instance_snapshot(uuid,uuid,uuid) RENAME TO desktop_agent_instance_latest_snapshot;
CREATE FUNCTION public.desktop_agent_instance_snapshot(p_user uuid,p_project uuid,p_instance uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;snapshots jsonb;children jsonb;requests_running boolean;pending boolean;working boolean;stamp timestamptz;
BEGIN
 result=desktop_agent_instance_latest_snapshot(p_user,p_project,p_instance);
 SELECT coalesce(jsonb_agg(jsonb_build_object('state',coalesce(t.state,'{}'),'updated_at',coalesce(t.updated_at,r.updated_at))),'[]'),coalesce(bool_or(r.status='running'),false),greatest(max(r.updated_at),max(t.updated_at))
  INTO snapshots,requests_running,stamp FROM desktop_requests r LEFT JOIN desktop_codex_turns t ON t.request_id=r.id AND t.user_id=p_user WHERE r.user_id=p_user AND r.agent_instance_id=p_instance;
 SELECT coalesce(jsonb_agg(child),'[]') INTO children FROM (
  SELECT DISTINCT ON(child->>'threadId') child FROM jsonb_array_elements(snapshots) snapshot CROSS JOIN LATERAL jsonb_array_elements(coalesce(snapshot->'state'->'children','[]')) child
   ORDER BY child->>'threadId',(snapshot->>'updated_at')::timestamptz DESC
 ) current_children;
 pending=EXISTS(SELECT 1 FROM desktop_tool_calls tool JOIN desktop_requests r ON r.id=tool.request_id AND r.user_id=p_user WHERE tool.user_id=p_user AND r.agent_instance_id=p_instance AND tool.status='awaiting_approval')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(snapshots) snapshot CROSS JOIN LATERAL jsonb_array_elements(coalesce(snapshot->'state'->'approvals','[]')) approval WHERE approval->>'status'='pending');
 working=requests_running OR EXISTS(SELECT 1 FROM jsonb_array_elements(children) child WHERE child->>'status'='running' OR child->>'delivery'='running' OR child->>'delivery'='waiting' AND child->>'status' NOT IN('running','interrupted'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(snapshots) snapshot CROSS JOIN LATERAL jsonb_array_elements(coalesce(snapshot->'state'->'reports','[]')) report WHERE report->>'status'='running');
 RETURN result||jsonb_build_object('status',CASE WHEN pending THEN 'awaiting_approval' WHEN working THEN 'running' ELSE result->>'status' END,
  'updated_at',greatest((result->>'updated_at')::timestamptz,stamp),'active_children',(SELECT count(*) FROM jsonb_array_elements(children) child WHERE child->>'status'='running'));
END $$;

CREATE FUNCTION public.desktop_list_agent_instances_page(p_user uuid,p_agent uuid,p_project uuid,p_limit integer,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user) THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Choose a valid assignment page of 1 to 100 items'; END IF;
 IF p_project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user) THEN RAISE EXCEPTION 'This project is unavailable'; END IF;
 SELECT coalesce(jsonb_agg(snapshot ORDER BY (snapshot->>'updated_at')::timestamptz DESC,id),'[]') INTO result FROM (
  SELECT i.id,desktop_agent_instance_snapshot(p_user,p_project,i.id) AS snapshot FROM desktop_agent_instances i
   WHERE i.user_id=p_user AND i.agent_id=p_agent AND desktop_agent_instance_visible(p_user,p_project,i.id)
   ORDER BY (desktop_agent_instance_snapshot(p_user,p_project,i.id)->>'updated_at')::timestamptz DESC,i.id LIMIT p_limit OFFSET p_offset
 ) hits;
 RETURN result;
END $$;

-- Starting an actual request and cancelling a queued receipt serialize on the
-- same row. A cancellation committed first can never start inference afterward.
DO $$ DECLARE definition text;needle text:='profile=desktop_agent_profile(p_user,p_agent);'; BEGIN
 definition=pg_get_functiondef('public.desktop_begin_agent_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint,bigint,uuid)'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized named-agent startup boundary'; END IF;
 definition=replace(definition,needle,$body$
 IF p_parent IS NOT NULL THEN
  PERFORM 1 FROM desktop_agent_invocations WHERE user_id=p_user AND request_id=p_request AND caller_instance_id=p_parent AND target_agent_id=p_agent AND status='starting' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This named-agent assignment was stopped or was not claimed'; END IF;
 END IF;
 profile=desktop_agent_profile(p_user,p_agent);$body$);
 EXECUTE definition;
END $$;

REVOKE ALL ON FUNCTION public.desktop_agent_instance_snapshot(uuid,uuid,uuid),public.desktop_list_agent_instances_page(uuid,uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_agent_instance_snapshot(uuid,uuid,uuid),public.desktop_list_agent_instances_page(uuid,uuid,uuid,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
