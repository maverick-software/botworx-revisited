-- The initial saved connection identities are committed with the agent itself.
-- This receipt contains reviewed public declarations and opaque grant metadata;
-- protected OAuth credential snapshots stay in the Windows credential store.
CREATE TABLE public.desktop_creation_connection_handoffs (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 creation_id uuid NOT NULL,
 scope_id uuid NOT NULL UNIQUE REFERENCES public.desktop_creation_tool_scopes(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 agent_id uuid NOT NULL,
 connections jsonb NOT NULL CHECK(jsonb_typeof(connections)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,creation_id)
);
ALTER TABLE public.desktop_creation_connection_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_creation_connection_handoffs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.desktop_creation_connection_handoffs TO service_role;

CREATE FUNCTION public.desktop_creation_connection_handoff(p_user uuid,p_creation uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version',1,'owner',h.user_id,'principal',jsonb_build_object('kind','creation','id',h.scope_id,'creationId',h.creation_id,'revision',h.revision),'agentId',h.agent_id,'connections',h.connections)
 FROM desktop_creation_connection_handoffs h JOIN desktop_creation_tool_scopes c ON c.id=h.scope_id AND c.user_id=h.user_id AND c.creation_id=h.creation_id AND c.bound_agent_id=h.agent_id AND c.bound_revision=h.revision
 WHERE h.user_id=p_user AND h.creation_id=p_creation;
$$;

CREATE FUNCTION public.desktop_immutable_creation_connection_handoff() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'The original creation connection mapping cannot be replaced';
END $$;
CREATE TRIGGER desktop_creation_connection_handoff_immutable BEFORE UPDATE OR DELETE ON public.desktop_creation_connection_handoffs FOR EACH ROW EXECUTE FUNCTION public.desktop_immutable_creation_connection_handoff();

ALTER FUNCTION public.desktop_create_agent_with_tools(uuid,uuid,bigint,text,text,text,text,text,jsonb,text,jsonb) RENAME TO desktop_create_agent_with_tools_without_handoff81;
REVOKE ALL ON FUNCTION public.desktop_create_agent_with_tools_without_handoff81(uuid,uuid,bigint,text,text,text,text,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.desktop_create_agent_with_tools(p_user uuid,p_creation uuid,p_tool_revision bigint,p_name text,p_description text,p_instructions text,p_provider text,p_model text,p_appearance jsonb,p_avatar text,p_behavior jsonb DEFAULT NULL) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes; result uuid; already_bound boolean; grant_row jsonb; plugin desktop_plugins; declaration record; link record; authorization_row desktop_creation_authorizations; slots jsonb='[]'::jsonb; source_connection uuid;
BEGIN
 IF p_user IS NULL OR p_creation IS NULL THEN RAISE EXCEPTION 'Choose an owned creation before saving connections'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 PERFORM desktop_require_active_creation(p_user,p_creation);
 SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR UPDATE;
 IF NOT FOUND OR scope.revision IS DISTINCT FROM p_tool_revision THEN RAISE EXCEPTION 'Refresh the creation app selection before saving this agent'; END IF;
 already_bound=scope.bound_agent_id IS NOT NULL;
 result=desktop_create_agent_with_tools_without_handoff81(p_user,p_creation,p_tool_revision,p_name,p_description,p_instructions,p_provider,p_model,p_appearance,p_avatar,p_behavior);
 -- Exact retries keep the original mapping, including after later saved edits.
 -- Older bound creations cannot manufacture a mapping from current settings.
 IF already_bound THEN RETURN result; END IF;
 FOR grant_row IN SELECT value FROM jsonb_array_elements(scope.grants) LOOP
  SELECT * INTO STRICT plugin FROM desktop_plugins WHERE user_id=p_user AND name=grant_row->>'name' AND digest=grant_row->>'digest';
  IF plugin.source<>'imported' THEN CONTINUE; END IF;
  FOR declaration IN SELECT key,value FROM jsonb_each(coalesce(plugin.package#>'{mcp,mcpServers}','{}'::jsonb)) LOOP
   SELECT c.id,c.vault_server_url_id INTO link FROM desktop_plugin_connections l JOIN agent_mcp_connections c ON c.id=l.connection_id AND c.agent_id=l.agent_id
    WHERE l.user_id=p_user AND l.agent_id=result AND l.plugin_name=plugin.name AND l.server_name=declaration.key;
   IF NOT FOUND OR link.vault_server_url_id IS NULL THEN RAISE EXCEPTION 'The initial saved connection mapping could not be retained'; END IF;
   source_connection=desktop_creation_connection_id(scope.id,plugin.name,declaration.key);
   SELECT * INTO authorization_row FROM desktop_creation_authorizations WHERE user_id=p_user AND creation_id=p_creation AND scope_id=scope.id AND connection_id=source_connection AND plugin_name=plugin.name AND plugin_digest=plugin.digest AND server_name=declaration.key AND enabled;
   slots=slots||jsonb_build_array(jsonb_build_object('plugin',plugin.name,'digest',plugin.digest,'server',declaration.key,'sourceConnectionId',source_connection,'connectionId',link.id,'vaultId',link.vault_server_url_id,'address',declaration.value->>'url','grant',authorization_row.authorization_grant,'stamp',authorization_row.target_stamp));
  END LOOP;
 END LOOP;
 INSERT INTO desktop_creation_connection_handoffs(user_id,creation_id,scope_id,revision,agent_id,connections) VALUES(p_user,p_creation,scope.id,scope.revision,result,slots);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.desktop_creation_connection_handoff(uuid,uuid),public.desktop_immutable_creation_connection_handoff(),public.desktop_create_agent_with_tools(uuid,uuid,bigint,text,text,text,text,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_creation_connection_handoff(uuid,uuid),public.desktop_create_agent_with_tools(uuid,uuid,bigint,text,text,text,text,text,jsonb,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
