ALTER TABLE public.desktop_tool_calls ADD COLUMN approval jsonb;

CREATE FUNCTION public.desktop_save_mcp_connection(p_user uuid,p_id uuid,p_agent uuid,p_name text,p_url text,p_token text DEFAULT NULL,p_clear_token boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE old_token uuid;new_token uuid;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.';END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter a connection name.';END IF;
 IF EXISTS(SELECT 1 FROM agent_mcp_connections WHERE id=p_id AND agent_id<>p_agent) THEN RAISE EXCEPTION 'Connection not found.';END IF;
 IF p_url IS NOT NULL THEN
  PERFORM desktop_store_setting_secret(p_user,'mcp',p_id::text,p_url,jsonb_build_object('agentId',p_agent,'name',trim(p_name),'host',''));
 ELSE
  UPDATE agent_mcp_connections SET connection_name=trim(p_name),updated_at=now() WHERE id=p_id AND agent_id=p_agent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Connection not found.';END IF;
 END IF;
 IF p_token IS NOT NULL OR p_clear_token THEN
  IF p_token IS NOT NULL AND length(p_token)>8192 THEN RAISE EXCEPTION 'The access token is too long.';END IF;
  SELECT (auth_config->>'desktop_token_id')::uuid INTO old_token FROM agent_mcp_connections WHERE id=p_id FOR UPDATE;
  IF NOT p_clear_token AND coalesce(length(p_token),0)>0 THEN SELECT vault.create_secret(p_token,'desktop:mcp-auth:'||gen_random_uuid()::text,'Agentopia MCP bearer credential') INTO new_token;END IF;
  UPDATE agent_mcp_connections SET auth_config=jsonb_set(coalesce(auth_config,'{}'),'{desktop_token_id}',coalesce(to_jsonb(new_token::text),'null'::jsonb)),updated_at=now() WHERE id=p_id;
  IF old_token IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=old_token AND name LIKE 'desktop:mcp-auth:%';END IF;
 END IF;
 RETURN p_id;
END $$;
CREATE FUNCTION public.desktop_cleanup_mcp_auth() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
BEGIN
 DELETE FROM vault.secrets WHERE id::text=OLD.auth_config->>'desktop_token_id' AND name LIKE 'desktop:mcp-auth:%';RETURN OLD;
END $$;
CREATE TRIGGER desktop_mcp_auth_cleanup AFTER DELETE ON public.agent_mcp_connections FOR EACH ROW EXECUTE FUNCTION public.desktop_cleanup_mcp_auth();
REVOKE ALL ON FUNCTION public.desktop_save_mcp_connection(uuid,uuid,uuid,text,text,text,boolean),public.desktop_cleanup_mcp_auth() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_mcp_connection(uuid,uuid,uuid,text,text,text,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
