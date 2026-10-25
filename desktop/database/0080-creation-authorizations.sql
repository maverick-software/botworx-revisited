-- Credentials remain in protected host storage. This receipt authorizes only a
-- reviewed creation server and an opaque, stable authorization grant.
CREATE TABLE public.desktop_creation_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scope_id uuid NOT NULL REFERENCES public.desktop_creation_tool_scopes(id) ON DELETE CASCADE,
 creation_id uuid NOT NULL,connection_id uuid NOT NULL,
 plugin_name text NOT NULL,plugin_digest text NOT NULL CHECK(plugin_digest ~ '^[a-f0-9]{64}$'),
 server_name text NOT NULL CHECK(length(server_name) BETWEEN 1 AND 1000),
 authorization_grant text NOT NULL CHECK(authorization_grant ~ '^[a-f0-9]{64}$'),
 target_stamp text NOT NULL CHECK(target_stamp ~ '^[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT true,write_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,scope_id,connection_id)
);
ALTER TABLE public.desktop_creation_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_creation_authorizations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.desktop_creation_authorizations TO service_role;

CREATE FUNCTION public.desktop_creation_authorization(p_user uuid,p_creation uuid,p_connection uuid) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version',1,'id',a.id,'owner',a.user_id,'scopeId',a.scope_id,'creationId',a.creation_id,'connectionId',a.connection_id,'plugin',a.plugin_name,'digest',a.plugin_digest,'server',a.server_name,'grant',a.authorization_grant,'stamp',a.target_stamp,'enabled',a.enabled,'writeId',a.write_id,'updatedAt',a.updated_at)
 FROM desktop_creation_authorizations a JOIN desktop_creation_tool_scopes c ON c.id=a.scope_id AND c.user_id=a.user_id AND c.creation_id=a.creation_id
 WHERE a.user_id=p_user AND a.creation_id=p_creation AND a.connection_id=p_connection;
$$;
CREATE FUNCTION public.desktop_set_creation_authorization(p_user uuid,p_creation uuid,p_scope uuid,p_revision bigint,p_connection uuid,p_plugin text,p_digest text,p_server text,p_grant text,p_stamp text,p_write uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes;old desktop_creation_authorizations;
BEGIN
 IF p_user IS NULL OR p_creation IS NULL OR p_scope IS NULL OR p_connection IS NULL OR p_write IS NULL OR p_grant IS NULL OR p_stamp IS NULL OR p_grant !~ '^[a-f0-9]{64}$' OR p_stamp !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Choose an owned creation authorization'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 PERFORM desktop_require_active_creation(p_user,p_creation);
 SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE id=p_scope AND user_id=p_user AND creation_id=p_creation FOR UPDATE;
 IF NOT FOUND OR scope.bound_agent_id IS NOT NULL OR scope.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'The creation selection changed or was saved'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(scope.grants) g JOIN desktop_plugins p ON p.user_id=p_user AND p.name=g->>'name' AND p.digest=g->>'digest' AND p.enabled AND p.source<>'legacy'
  WHERE p.name=p_plugin AND p.digest=p_digest AND p.package#>>ARRAY['mcp','mcpServers',p_server,'extensions','com.openai','auth','type'] IN ('oauth','mixed') AND desktop_creation_connection_id(scope.id,p.name,p_server)=p_connection) THEN RAISE EXCEPTION 'Review the current creation server before authorizing it'; END IF;
 SELECT * INTO old FROM desktop_creation_authorizations WHERE user_id=p_user AND scope_id=p_scope AND connection_id=p_connection FOR UPDATE;
 IF FOUND AND NOT old.enabled AND old.authorization_grant=p_grant THEN RAISE EXCEPTION 'Reconnect this creation server before authorizing it again'; END IF;
 IF FOUND AND old.write_id=p_write AND (old.plugin_name IS DISTINCT FROM p_plugin OR old.plugin_digest IS DISTINCT FROM p_digest OR old.server_name IS DISTINCT FROM p_server OR old.authorization_grant IS DISTINCT FROM p_grant OR old.target_stamp IS DISTINCT FROM p_stamp OR NOT old.enabled) THEN RAISE EXCEPTION 'The authorization write identity was reused'; END IF;
 IF FOUND AND old.enabled AND old.plugin_name=p_plugin AND old.plugin_digest=p_digest AND old.server_name=p_server AND old.authorization_grant=p_grant AND old.target_stamp=p_stamp THEN RETURN desktop_creation_authorization(p_user,p_creation,p_connection); END IF;
 INSERT INTO desktop_creation_authorizations(user_id,scope_id,creation_id,connection_id,plugin_name,plugin_digest,server_name,authorization_grant,target_stamp,write_id)
 VALUES(p_user,p_scope,p_creation,p_connection,p_plugin,p_digest,p_server,p_grant,p_stamp,p_write)
 ON CONFLICT(user_id,scope_id,connection_id) DO UPDATE SET plugin_name=excluded.plugin_name,plugin_digest=excluded.plugin_digest,server_name=excluded.server_name,authorization_grant=excluded.authorization_grant,target_stamp=excluded.target_stamp,enabled=true,write_id=excluded.write_id,updated_at=now();
 RETURN desktop_creation_authorization(p_user,p_creation,p_connection);
END $$;
CREATE FUNCTION public.desktop_revoke_creation_authorization(p_user uuid,p_creation uuid,p_scope uuid,p_connection uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_user IS NULL OR p_creation IS NULL OR p_scope IS NULL OR p_connection IS NULL THEN RAISE EXCEPTION 'Choose an owned creation authorization'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 IF NOT EXISTS(SELECT 1 FROM desktop_creation_tool_scopes WHERE id=p_scope AND user_id=p_user AND creation_id=p_creation) THEN RAISE EXCEPTION 'The creation authorization belongs to another scope'; END IF;
 UPDATE desktop_creation_authorizations SET enabled=false,updated_at=now() WHERE user_id=p_user AND scope_id=p_scope AND connection_id=p_connection AND enabled;
END $$;

CREATE FUNCTION public.desktop_creation_oauth_signature(p_user uuid,p_scope uuid,p_connection uuid) RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
 SELECT encode(digest('['||to_json('creation-oauth-grant-v1'::text)::text||','||to_json(a.user_id::text)::text||','||to_json(c.id::text)::text||','||to_json(c.creation_id::text)::text||','||to_json(c.revision)::text||','||to_json(a.plugin_name)::text||','||to_json(a.plugin_digest)::text||','||to_json(a.server_name)::text||','||to_json(a.authorization_grant)::text||','||to_json(a.target_stamp)::text||']','sha256'),'hex')
 FROM desktop_creation_authorizations a JOIN desktop_creation_tool_scopes c ON c.id=a.scope_id AND c.user_id=a.user_id AND c.creation_id=a.creation_id
 JOIN desktop_plugins p ON p.user_id=a.user_id AND p.name=a.plugin_name AND p.digest=a.plugin_digest AND p.enabled AND p.source<>'legacy'
 WHERE a.user_id=p_user AND a.scope_id=p_scope AND a.connection_id=p_connection AND a.enabled AND c.bound_agent_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM desktop_creation_retirements r WHERE r.user_id=c.user_id AND r.creation_id=c.creation_id)
 AND c.grants @> jsonb_build_array(jsonb_build_object('name',p.name,'digest',p.digest))
 AND desktop_creation_connection_id(c.id,p.name,a.server_name)=a.connection_id
 AND p.package#>>ARRAY['mcp','mcpServers',a.server_name,'extensions','com.openai','auth','type'] IN ('oauth','mixed');
$$;
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
    OR d.value#>>'{extensions,com.openai,auth,type}' IN ('oauth','mixed') AND desktop_creation_oauth_signature(p_user,c.id,desktop_creation_connection_id(c.id,p.name,d.key)) IS NOT NULL))
  )
 ) THEN RAISE EXCEPTION 'This connection is not selected and ready for this creation'; END IF;
END $$;
CREATE FUNCTION public.desktop_validate_creation_oauth_binding() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes; source jsonb;signature text;expected text;
BEGIN
 IF NEW.creation_id IS NULL OR NEW.execution_context#>>'{remoteTools,version}' IS DISTINCT FROM '2' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text||':'||NEW.creation_id::text,0));
 SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE user_id=NEW.user_id AND creation_id=NEW.creation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an owned creation resource identity'; END IF;
 FOR source IN SELECT value FROM jsonb_array_elements(NEW.execution_context#>'{remoteTools,sources}') LOOP
  PERFORM desktop_validate_creation_remote_source(NEW.user_id,scope.id,source);
  IF source->>'id' LIKE 'mcp:%' THEN
   expected=desktop_creation_oauth_signature(NEW.user_id,scope.id,substr(source->>'id',5)::uuid);
   IF expected IS NOT NULL THEN
    SELECT value->>'signature' INTO signature FROM jsonb_array_elements(NEW.execution_context#>'{remoteTools,bindings}') WHERE value->>'id'=source->>'id';
    IF signature IS DISTINCT FROM expected THEN RAISE EXCEPTION 'The creation authorization grant changed before acceptance'; END IF;
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_creation_oauth_binding BEFORE INSERT ON public.desktop_preview_requests FOR EACH ROW EXECUTE FUNCTION public.desktop_validate_creation_oauth_binding();

REVOKE ALL ON FUNCTION public.desktop_creation_authorization(uuid,uuid,uuid),public.desktop_set_creation_authorization(uuid,uuid,uuid,bigint,uuid,text,text,text,text,text,uuid),public.desktop_revoke_creation_authorization(uuid,uuid,uuid,uuid),public.desktop_creation_oauth_signature(uuid,uuid,uuid),public.desktop_validate_creation_oauth_binding() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_creation_authorization(uuid,uuid,uuid),public.desktop_set_creation_authorization(uuid,uuid,uuid,bigint,uuid,text,text,text,text,text,uuid),public.desktop_revoke_creation_authorization(uuid,uuid,uuid,uuid),public.desktop_creation_oauth_signature(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
