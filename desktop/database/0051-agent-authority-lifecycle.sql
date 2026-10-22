DO $$ DECLARE definition text; BEGIN
 definition=pg_get_functiondef('public.desktop_reserve_agent_invocation(uuid,uuid,text,text,uuid,text,jsonb,jsonb,bigint,uuid)'::regprocedure);
 IF strpos(definition,'INSERT INTO conversation_sessions(user_id,agent_id,title) VALUES(p_user,p_target,')=0 THEN RAISE EXCEPTION 'Unrecognized named conversation insertion'; END IF;
 definition=replace(definition,'INSERT INTO conversation_sessions(user_id,agent_id,title) VALUES(p_user,p_target,','INSERT INTO conversation_sessions(conversation_id,user_id,agent_id,title) VALUES(gen_random_uuid(),p_user,p_target,');
 definition=replace(definition,'''instance_id'',caller.id,''project_id'',caller.project_id)', '''instance_id'',caller.id,''project_id'',caller.project_id,''goal_id'',source_options->>''goalId'')');
 definition=replace(definition,'IF source_options->>''mode''<>''chat''',$body$
 IF caller.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_projects WHERE id=caller.project_id AND user_id=p_user AND revision=(source_project->>'revision')::bigint) THEN RAISE EXCEPTION 'The originating project changed. Review the assignment before delegating'; END IF;
 IF source_options->>'mode'<>'chat'$body$);
 EXECUTE definition;
 definition=pg_get_functiondef('public.desktop_agent_request_scope(uuid,uuid,text)'::regprocedure);
 definition=replace(definition,'grant_profile=desktop_agent_profile(p_user,(grant_value->>''agent_id'')::uuid);',$body$
 IF grant_value->>'goal_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_goals WHERE id=(grant_value->>'goal_id')::uuid AND user_id=p_user AND status='running') THEN RAISE EXCEPTION 'The originating goal was paused or completed'; END IF;
 grant_profile=desktop_agent_profile(p_user,(grant_value->>'agent_id')::uuid);$body$);
 EXECUTE definition;
END $$;
NOTIFY pgrst,'reload schema';
