-- Serialize removal with assignment so a concurrent assignment cannot leave
-- an active untracked connection after a plugin has been removed.
CREATE FUNCTION public.desktop_remove_plugin(p_user uuid,p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE plugin desktop_plugins; item record;
BEGIN
 SELECT * INTO plugin FROM desktop_plugins WHERE user_id=p_user AND name=p_name FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plugin not found.'; END IF;
 IF plugin.source='bundled' THEN RAISE EXCEPTION 'Bundled plugins can be disabled.';END IF;
 FOR item IN SELECT agent_id,connection_id FROM desktop_plugin_connections WHERE user_id=p_user AND plugin_name=p_name LOOP
  PERFORM desktop_store_setting_secret(p_user,'mcp',item.connection_id::text,NULL,jsonb_build_object('agentId',item.agent_id,'name','','host',''));
 END LOOP;
 DELETE FROM desktop_plugins WHERE user_id=p_user AND name=p_name;
END $$;
REVOKE ALL ON FUNCTION public.desktop_remove_plugin(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_remove_plugin(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
