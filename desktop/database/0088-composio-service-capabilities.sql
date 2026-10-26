-- Service capabilities reuse the existing reviewed plugin and agent grant tables.
-- The existing host-plugin receipt table records only the one-time conversion.
CREATE FUNCTION public.desktop_composio_service_package(p_slug text,p_title text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public,extensions AS $$
BEGIN
 IF p_slug IS NULL OR p_slug !~ '^_?[a-z0-9][a-z0-9_]{0,99}$' OR p_slug IN ('composio','tool_router','composio_tool_router','meta_tools','managed_auth','manage_auth') OR p_title IS NULL OR p_title<>btrim(p_title) OR length(p_title) NOT BETWEEN 1 AND 80 OR p_title ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid Composio service declaration'; END IF;
 RETURN jsonb_build_object(
  'manifest',jsonb_build_object('$schema','https://agent-plugins.org/schemas/1.0.0/plugin.schema.json','name','composio-service-'||left(encode(digest(convert_to(p_slug,'UTF8'),'sha256'),'hex'),32),'version','1.0.0','description','Use '||p_title||' through this account'||chr(8217)||'s Composio connection.','author',jsonb_build_object('name','Agentopia'),'extensions',jsonb_build_object('com.agentopia',jsonb_build_object('composioToolkit',p_slug),'com.openai',jsonb_build_object('interface',jsonb_build_object('displayName',p_title,'shortDescription','Connected through Composio')))),
  'mcp',jsonb_build_object('$schema','https://agent-plugins.org/schemas/1.0.0/mcp.schema.json','mcpServers',jsonb_build_object('service',jsonb_build_object('type','streamable-http','url','https://connect.composio.dev/mcp','extensions',jsonb_build_object('com.openai',jsonb_build_object('auth',jsonb_build_object('type','oauth','client',jsonb_build_object('mode','dcr'),'baseScopes',jsonb_build_array('offline_access'))))))));
END $$;
REVOKE ALL ON FUNCTION public.desktop_composio_service_package(text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.desktop_sync_composio_service_plugins(p_user uuid,p_items jsonb,p_complete_connected_inventory boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE item jsonb; expected jsonb; service_name text; saved desktop_plugins; migrate boolean;
BEGIN
 IF p_user IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>2000 OR p_complete_connected_inventory IS NULL THEN RAISE EXCEPTION 'Invalid connected Composio service inventory'; END IF;
 PERFORM 1 FROM auth.users WHERE id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('composio-services:'||p_user::text,0));
 IF (SELECT count(*)<>count(DISTINCT value->>'slug') FROM jsonb_array_elements(p_items)) THEN RAISE EXCEPTION 'Duplicate Composio service'; END IF;
 migrate=p_complete_connected_inventory AND NOT EXISTS(SELECT 1 FROM desktop_host_plugin_migrations WHERE user_id=p_user AND plugin_name='composio-services-v1');
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'slug') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'digest') IS DISTINCT FROM 'string' OR item->>'digest' !~ '^[a-f0-9]{64}$' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('slug','title','package','digest')) THEN RAISE EXCEPTION 'Invalid Composio service package'; END IF;
  expected=desktop_composio_service_package(item->>'slug',item->>'title');service_name=expected#>>'{manifest,name}';
  IF item->'package' IS DISTINCT FROM expected THEN RAISE EXCEPTION 'The Composio service differs from its pinned declaration'; END IF;
  INSERT INTO desktop_plugins(user_id,name,package,digest,source) VALUES(p_user,service_name,expected,item->>'digest','bundled') ON CONFLICT DO NOTHING;
  SELECT * INTO saved FROM desktop_plugins WHERE user_id=p_user AND name=service_name FOR UPDATE;
  -- Preserve the installed declaration and explicit enablement when a provider changes its display copy.
  IF saved.source<>'bundled' OR saved.package IS DISTINCT FROM desktop_composio_service_package(item->>'slug',saved.package#>>'{manifest,extensions,com.openai,interface,displayName}') THEN RAISE EXCEPTION 'An installed package conflicts with this Composio service'; END IF;
  IF migrate THEN
   INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled)
   SELECT p_user,service_name,g.agent_id,true FROM desktop_agent_plugins g JOIN desktop_plugins p ON p.user_id=g.user_id AND p.name=g.plugin_name
   WHERE g.user_id=p_user AND g.plugin_name='composio-connect' AND g.enabled AND p.source='bundled'
   ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 IF migrate THEN INSERT INTO desktop_host_plugin_migrations(user_id,plugin_name) VALUES(p_user,'composio-services-v1') ON CONFLICT DO NOTHING; END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_sync_composio_service_plugins(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_sync_composio_service_plugins(uuid,jsonb,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.desktop_validate_creation_remote_source(p_user uuid,p_scope uuid,p_source jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM desktop_creation_tool_scopes c CROSS JOIN LATERAL jsonb_array_elements(c.grants) g
  JOIN desktop_plugins p ON p.user_id=c.user_id AND p.name=g->>'name' AND p.digest=g->>'digest' AND p.enabled AND p.source<>'legacy'
  WHERE c.id=p_scope AND c.user_id=p_user AND c.bound_agent_id IS NULL AND p_source->>'plugin'=p.name
  AND NOT EXISTS(SELECT 1 FROM desktop_creation_retirements r WHERE r.user_id=c.user_id AND r.creation_id=c.creation_id) AND (
   p_source->>'id'='web_search' AND p.package#>>'{manifest,extensions,com.agentopia,adapter}' IN ('serper','tavily')
   OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(p.package#>'{mcp,mcpServers}','{}'::jsonb)) d WHERE p_source->>'id'='mcp:'||desktop_creation_connection_id(c.id,p.name,d.key)::text AND (
    coalesce(d.value#>>'{extensions,com.openai,auth,type}','none')='none'
    OR p.source='bundled' AND d.value->>'url'='https://connect.composio.dev/mcp' AND d.value#>>'{extensions,com.openai,auth,type}'='oauth' AND (
     p.name='composio-connect' AND d.key='composio'
     OR d.key='service' AND p.package#>>'{manifest,extensions,com.agentopia,composioToolkit}' IS NOT NULL AND p.package=desktop_composio_service_package(p.package#>>'{manifest,extensions,com.agentopia,composioToolkit}',p.package#>>'{manifest,extensions,com.openai,interface,displayName}'))
    OR d.value#>>'{extensions,com.openai,auth,type}' IN ('oauth','mixed') AND desktop_creation_oauth_signature(p_user,c.id,desktop_creation_connection_id(c.id,p.name,d.key)) IS NOT NULL))
  )
 ) THEN RAISE EXCEPTION 'This connection is not selected and ready for this creation'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
