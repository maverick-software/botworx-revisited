-- Reviewed package replacement is atomic with connection/credential reconciliation.
-- Keep credentials only for the same server name, literal URL and transport.
CREATE FUNCTION public.desktop_update_plugin(p_user uuid,p_name text,p_expected_digest text,p_package jsonb,p_digest text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE plugin desktop_plugins; item record; grant_row record; connection uuid; next_server jsonb; previous_server jsonb;
BEGIN
 -- Assignment locks its agent before its plugin. Use that same order here.
 PERFORM id FROM agents WHERE user_id=p_user ORDER BY id FOR UPDATE;
 SELECT * INTO plugin FROM desktop_plugins WHERE user_id=p_user AND name=p_name FOR UPDATE;
 IF NOT FOUND OR plugin.source<>'imported' THEN RAISE EXCEPTION 'Choose an imported plugin.';END IF;
 IF plugin.digest IS DISTINCT FROM p_expected_digest THEN RAISE EXCEPTION 'The plugin changed since review.';END IF;
 IF p_package#>>'{manifest,name}' IS DISTINCT FROM p_name OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$'
  OR coalesce(p_package#>>'{manifest,version}','')='' OR p_package#>>'{manifest,version}'=plugin.package#>>'{manifest,version}'
 THEN RAISE EXCEPTION 'Review a different version of this plugin.';END IF;
 FOR item IN SELECT agent_id,server_name,connection_id FROM desktop_plugin_connections WHERE user_id=p_user AND plugin_name=p_name LOOP
  next_server=p_package#>ARRAY['mcp','mcpServers',item.server_name];
  previous_server=plugin.package#>ARRAY['mcp','mcpServers',item.server_name];
  IF next_server IS NULL OR previous_server IS NULL OR next_server->>'url' IS DISTINCT FROM previous_server->>'url'
   OR next_server->>'type' IS DISTINCT FROM previous_server->>'type' THEN
   PERFORM desktop_store_setting_secret(p_user,'mcp',item.connection_id::text,NULL,jsonb_build_object('agentId',item.agent_id,'name','','host',''));
  END IF;
 END LOOP;
 UPDATE desktop_plugins SET package=p_package,digest=p_digest WHERE user_id=p_user AND name=p_name;
 FOR grant_row IN SELECT g.agent_id FROM desktop_agent_plugins g JOIN agents a ON a.id=g.agent_id
  WHERE g.user_id=p_user AND g.plugin_name=p_name AND g.enabled AND a.user_id=p_user AND a.active LOOP
  FOR item IN SELECT key,value FROM jsonb_each(coalesce(p_package#>'{mcp,mcpServers}','{}'::jsonb)) LOOP
   IF NOT EXISTS(SELECT 1 FROM desktop_plugin_connections WHERE user_id=p_user AND plugin_name=p_name AND agent_id=grant_row.agent_id AND server_name=item.key) THEN
    connection=gen_random_uuid();
    PERFORM desktop_save_mcp_connection(p_user,connection,grant_row.agent_id,left(p_name||' · '||item.key,100),item.value->>'url');
    UPDATE agent_mcp_connections SET server_info=server_info||jsonb_build_object('desktop_plugin',p_name,'desktop_transport',item.value->>'type') WHERE id=connection;
    INSERT INTO desktop_plugin_connections VALUES(p_user,p_name,grant_row.agent_id,item.key,connection);
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.desktop_update_plugin(uuid,text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_update_plugin(uuid,text,text,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
