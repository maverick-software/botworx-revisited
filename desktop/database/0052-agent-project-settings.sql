CREATE FUNCTION public.desktop_save_workspace_project(p_user uuid,p_id uuid,p_name text,p_reference uuid,p_instructions text,p_files uuid[],p_revision bigint,p_memory boolean,p_agent_isolated boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 result=desktop_save_project_memory(p_user,p_id,p_name,p_reference,p_instructions,p_files,p_revision,p_memory);
 UPDATE desktop_projects SET agent_memory_isolated=coalesce(p_agent_isolated,agent_memory_isolated) WHERE id=(result->>'id')::uuid AND user_id=p_user RETURNING to_jsonb(desktop_projects) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.desktop_save_workspace_project(uuid,uuid,text,uuid,text,uuid[],bigint,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_workspace_project(uuid,uuid,text,uuid,text,uuid[],bigint,boolean,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
