-- Every source returned through agent tools stays subject to visibility and
-- revision checks before subsequent inference, including after recovery.
ALTER TABLE public.desktop_codex_turns ADD COLUMN agent_references jsonb;
CREATE FUNCTION public.desktop_validate_agent_references(p_user uuid,p_agent uuid,p_project uuid,p_memories jsonb,p_instances uuid[]) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF jsonb_typeof(p_memories)<>'array' OR jsonb_array_length(p_memories)>500 OR cardinality(p_instances)>1000 THEN RAISE EXCEPTION 'Too many agent reference sources'; END IF;
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active) THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_memories) selected WHERE NOT EXISTS(
  SELECT 1 FROM desktop_agent_memories m WHERE m.id=(selected->>'id')::uuid AND m.user_id=p_user AND m.agent_id=p_agent AND m.revision=(selected->>'revision')::bigint AND desktop_agent_memory_visible(p_user,p_project,m.id)))
 OR EXISTS(SELECT 1 FROM unnest(p_instances) selected(id) WHERE NOT EXISTS(
  SELECT 1 FROM desktop_agent_instances i WHERE i.id=selected.id AND i.user_id=p_user AND desktop_agent_instance_visible(p_user,p_project,i.id))) THEN
  RAISE EXCEPTION 'An agent reference was corrected, forgotten or isolated. Start a fresh response with current context';
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.desktop_validate_agent_references(uuid,uuid,uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_validate_agent_references(uuid,uuid,uuid,jsonb,uuid[]) TO service_role;
NOTIFY pgrst,'reload schema';
