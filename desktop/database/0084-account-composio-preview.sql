-- Account Composio credentials stay in the local protected OAuth store.
-- PostgreSQL validates the owned, current reviewed selection; the broker checks
-- the current owner OAuth grant and its fingerprint before every dispatch.
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
    OR p.source='bundled' AND p.name='composio-connect' AND d.key='composio'
      AND d.value->>'url'='https://connect.composio.dev/mcp'
      AND d.value#>>'{extensions,com.openai,auth,type}'='oauth'
    OR d.value#>>'{extensions,com.openai,auth,type}' IN ('oauth','mixed') AND desktop_creation_oauth_signature(p_user,c.id,desktop_creation_connection_id(c.id,p.name,d.key)) IS NOT NULL))
  )
 ) THEN RAISE EXCEPTION 'This connection is not selected and ready for this creation'; END IF;
END $$;
