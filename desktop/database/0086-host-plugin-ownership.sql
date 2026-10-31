-- Preserve effective host access once, then honor explicit account/agent revocation.
CREATE TABLE public.desktop_host_plugin_migrations (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plugin_name text NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,plugin_name)
);
ALTER TABLE public.desktop_host_plugin_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_host_plugin_migrations FROM anon,authenticated;
GRANT ALL ON public.desktop_host_plugin_migrations TO service_role;

CREATE FUNCTION public.desktop_seed_host_plugins(p_user uuid,p_packages jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; fresh text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('host-plugins:'||p_user::text,0));
 FOR item IN SELECT value FROM jsonb_array_elements(p_packages) LOOP
  IF item->>'name' NOT IN ('agentopia-browser','agentopia-files-terminal','agentopia-computer','agentopia-workspace-agents','agentopia-documents-planning','agentopia-schedules','composio') THEN RAISE EXCEPTION 'Unknown host plugin.'; END IF;
  INSERT INTO desktop_plugins(user_id,name,package,digest,source) VALUES(p_user,item->>'name',item->'package',item->>'digest','bundled') ON CONFLICT DO NOTHING;
  fresh=NULL;
  INSERT INTO desktop_host_plugin_migrations(user_id,plugin_name) VALUES(p_user,item->>'name') ON CONFLICT DO NOTHING RETURNING plugin_name INTO fresh;
  IF fresh IS NOT NULL THEN
   INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) SELECT p_user,fresh,id,true FROM agents WHERE user_id=p_user ON CONFLICT DO NOTHING;
   -- Existing drafts had these host capabilities implicitly. Preserve their
   -- selections and fields; a new revision asks accepted previews to refresh.
   UPDATE desktop_creation_tool_scopes s SET grants=(SELECT jsonb_agg(value ORDER BY value->>'name' COLLATE "C") FROM jsonb_array_elements(s.grants||jsonb_build_array(jsonb_build_object('name',fresh,'digest',item->>'digest')))),revision=revision+1,write_id=gen_random_uuid(),updated_at=now()
   WHERE s.user_id=p_user AND s.bound_agent_id IS NULL AND NOT EXISTS(SELECT 1 FROM desktop_creation_retirements r WHERE r.user_id=s.user_id AND r.creation_id=s.creation_id)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.grants) g WHERE g->>'name'=fresh);
  END IF;
 END LOOP;
 -- Replace the historical implicit Serper grant. Existing explicit assignments win.
 fresh=NULL;
 INSERT INTO desktop_host_plugin_migrations(user_id,plugin_name) VALUES(p_user,'search-explicit-v1') ON CONFLICT DO NOTHING RETURNING plugin_name INTO fresh;
 IF fresh IS NOT NULL THEN
  UPDATE desktop_agent_plugins g SET enabled=false FROM agents a WHERE g.user_id=p_user AND g.agent_id=a.id AND a.user_id=p_user AND g.plugin_name IN ('serper-search','tavily-search') AND coalesce((a.metadata#>>'{settings,web_search_enabled}')='true',false)=false;
  INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled)
  SELECT p_user,'serper-search',a.id,coalesce((a.metadata#>>'{settings,web_search_enabled}')='true',false) FROM agents a WHERE a.user_id=p_user
  AND NOT EXISTS(SELECT 1 FROM desktop_agent_plugins g WHERE g.user_id=p_user AND g.agent_id=a.id AND g.plugin_name IN ('serper-search','tavily-search')) ON CONFLICT DO NOTHING;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_seed_host_plugins(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_seed_host_plugins(uuid,jsonb) TO service_role;

CREATE FUNCTION public.desktop_default_host_plugin_grants() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id)
 SELECT NEW.user_id,name,NEW.id FROM desktop_plugins WHERE user_id=NEW.user_id AND source='bundled' AND name IN ('agentopia-browser','agentopia-files-terminal','agentopia-computer','agentopia-workspace-agents','agentopia-documents-planning','agentopia-schedules','composio') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_default_host_plugin_grants AFTER INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION public.desktop_default_host_plugin_grants();
NOTIFY pgrst,'reload schema';
