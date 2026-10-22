-- Packages contain public connection declarations. Credentials remain in Vault.
CREATE TABLE public.desktop_plugins (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 64),
 package jsonb NOT NULL CHECK(jsonb_typeof(package)='object'),
 digest text NOT NULL,
 source text NOT NULL CHECK(source IN ('bundled','imported','legacy')),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,name)
);
CREATE TABLE public.desktop_agent_plugins (
 user_id uuid NOT NULL,
 plugin_name text NOT NULL,
 agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(user_id,plugin_name,agent_id),
 FOREIGN KEY(user_id,plugin_name) REFERENCES public.desktop_plugins(user_id,name) ON DELETE CASCADE
);
CREATE TABLE public.desktop_plugin_connections (
 user_id uuid NOT NULL,
 plugin_name text NOT NULL,
 agent_id uuid NOT NULL,
 server_name text NOT NULL,
 connection_id uuid NOT NULL UNIQUE REFERENCES public.agent_mcp_connections(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,plugin_name,agent_id,server_name),
 FOREIGN KEY(user_id,plugin_name,agent_id) REFERENCES public.desktop_agent_plugins(user_id,plugin_name,agent_id) ON DELETE CASCADE
);
ALTER TABLE public.desktop_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_agent_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_plugin_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_plugins,public.desktop_agent_plugins,public.desktop_plugin_connections FROM anon,authenticated;
GRANT ALL ON public.desktop_plugins,public.desktop_agent_plugins,public.desktop_plugin_connections TO service_role;

CREATE FUNCTION public.desktop_assign_plugin(p_user uuid,p_name text,p_agent uuid,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE plugin desktop_plugins; item record; connection uuid; adapter text;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 SELECT * INTO plugin FROM desktop_plugins WHERE user_id=p_user AND name=p_name FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plugin not found.'; END IF;
 IF plugin.source='legacy' AND NOT EXISTS(SELECT 1 FROM desktop_agent_plugins WHERE user_id=p_user AND plugin_name=p_name AND agent_id=p_agent) THEN RAISE EXCEPTION 'This existing connection belongs to its original agent.';END IF;
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) VALUES(p_user,p_name,p_agent,p_enabled)
 ON CONFLICT(user_id,plugin_name,agent_id) DO UPDATE SET enabled=p_enabled;
 adapter=plugin.package#>>'{manifest,extensions,com.agentopia,adapter}';
 IF p_enabled AND adapter IS NOT NULL THEN
  UPDATE desktop_agent_plugins g SET enabled=false FROM desktop_plugins p WHERE g.user_id=p_user AND g.agent_id=p_agent AND g.plugin_name<>p_name AND p.user_id=g.user_id AND p.name=g.plugin_name AND p.package#>>'{manifest,extensions,com.agentopia,adapter}' IS NOT NULL;
  UPDATE agents SET metadata=jsonb_set(coalesce(metadata,'{}'),'{settings}',coalesce(metadata->'settings','{}')||'{"web_search_enabled":true}') WHERE id=p_agent;
 END IF;
 IF p_enabled AND plugin.source='imported' THEN
  FOR item IN SELECT key,value FROM jsonb_each(plugin.package#>'{mcp,mcpServers}') LOOP
   IF NOT EXISTS(SELECT 1 FROM desktop_plugin_connections WHERE user_id=p_user AND plugin_name=p_name AND agent_id=p_agent AND server_name=item.key) THEN
    connection=gen_random_uuid();
    PERFORM desktop_save_mcp_connection(p_user,connection,p_agent,left(p_name||' · '||item.key,100),item.value->>'url');
    UPDATE agent_mcp_connections SET server_info=server_info||jsonb_build_object('desktop_plugin',p_name,'desktop_transport',item.value->>'type') WHERE id=connection;
    INSERT INTO desktop_plugin_connections VALUES(p_user,p_name,p_agent,item.key,connection);
   END IF;
  END LOOP;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_assign_plugin(uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_assign_plugin(uuid,text,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
