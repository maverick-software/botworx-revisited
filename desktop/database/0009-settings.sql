-- Restore the settings model used by the original application. These functions
-- are reachable only by the authenticated desktop broker, never the public API.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS slack_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS discord_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.desktop_save_agent_settings(p_user uuid,p_agent uuid,p_section text,p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item uuid; permission uuid; mode text; settings jsonb;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 IF p_section='identity' THEN
  UPDATE agents SET name=p_value->>'name',personality=p_value->>'personality',updated_at=now(),
   metadata=coalesce(metadata,'{}')||jsonb_build_object('mbtiType',p_value->>'mbtiType','purpose',p_value->>'purpose') WHERE id=p_agent;
 ELSIF p_section IN ('capabilities','memory') THEN
  settings=p_value->'settings';
  IF p_section='capabilities' THEN
   FOR item IN SELECT value::uuid FROM jsonb_each_text(settings) WHERE key LIKE '%\_credential' ESCAPE '\' AND value<>'' LOOP
    IF NOT EXISTS(SELECT 1 FROM user_integration_credentials WHERE id=item AND user_id=p_user AND connection_status='active') THEN RAISE EXCEPTION 'Connection not found.'; END IF;
   END LOOP;
  ELSE
   FOR item IN SELECT value::text::uuid FROM jsonb_array_elements_text(p_value->'datastores') LOOP
    IF NOT EXISTS(SELECT 1 FROM datastores WHERE id=item AND user_id=p_user) THEN RAISE EXCEPTION 'Knowledge source not found.'; END IF;
   END LOOP;
   DELETE FROM agent_datastores WHERE agent_id=p_agent;
   INSERT INTO agent_datastores(agent_id,datastore_id) SELECT p_agent,value::uuid FROM jsonb_array_elements_text(p_value->'datastores');
  END IF;
  UPDATE agents SET metadata=jsonb_set(coalesce(metadata,'{}'),'{settings}',coalesce(metadata->'settings','{}')||settings),updated_at=now() WHERE id=p_agent;
 ELSIF p_section='channels' THEN
  UPDATE agents SET email_enabled=(p_value->>'email_enabled')::boolean,sms_enabled=(p_value->>'sms_enabled')::boolean,
   slack_enabled=(p_value->>'slack_enabled')::boolean,discord_enabled=(p_value->>'discord_enabled')::boolean,
   telegram_enabled=(p_value->>'telegram_enabled')::boolean,whatsapp_enabled=(p_value->>'whatsapp_enabled')::boolean,updated_at=now() WHERE id=p_agent;
 ELSIF p_section='documents' THEN
  FOR item IN SELECT value::uuid FROM jsonb_array_elements_text(p_value->'ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM media_library WHERE id=item AND user_id=p_user) THEN RAISE EXCEPTION 'Document not found.'; END IF;
  END LOOP;
  UPDATE agent_media_assignments SET is_active=false WHERE agent_id=p_agent AND user_id=p_user;
  INSERT INTO agent_media_assignments(agent_id,media_id,user_id,is_active)
   SELECT p_agent,value::uuid,p_user,true FROM jsonb_array_elements_text(p_value->'ids')
   ON CONFLICT(agent_id,media_id) DO UPDATE SET is_active=true,updated_at=now();
 ELSIF p_section='sources' THEN
  FOR item IN SELECT value::uuid FROM jsonb_array_elements_text(p_value->'ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM user_integration_credentials WHERE id=item AND user_id=p_user AND connection_status='active') THEN RAISE EXCEPTION 'Connection not found.'; END IF;
  END LOOP;
  UPDATE agent_integration_permissions SET is_active=false WHERE agent_id=p_agent AND granted_by_user_id=p_user;
  INSERT INTO agent_integration_permissions(agent_id,user_oauth_connection_id,granted_by_user_id,permission_level,is_active,service_provider_id)
   SELECT p_agent,c.id,p_user,'read_only',true,c.oauth_provider_id FROM user_integration_credentials c WHERE c.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_value->'ids'))
   ON CONFLICT(agent_id,user_oauth_connection_id) DO UPDATE SET is_active=true,updated_at=now();
 ELSIF p_section='team' THEN
  FOR item IN SELECT value::uuid FROM jsonb_array_elements_text(p_value->'ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM teams WHERE id=item AND owner_user_id=p_user) THEN RAISE EXCEPTION 'Team not found.'; END IF;
  END LOOP;
  DELETE FROM team_members WHERE agent_id=p_agent AND team_id IN(SELECT id FROM teams WHERE owner_user_id=p_user) AND team_id NOT IN(SELECT value::uuid FROM jsonb_array_elements_text(p_value->'ids'));
  INSERT INTO team_members(team_id,agent_id) SELECT value::uuid,p_agent FROM jsonb_array_elements_text(p_value->'ids') ON CONFLICT DO NOTHING;
 ELSIF p_section='contacts' THEN
  mode=p_value->>'mode';
  IF mode NOT IN ('no_access','all_contacts','specific_contacts') THEN RAISE EXCEPTION 'Invalid contact access.'; END IF;
  FOR item IN SELECT value::uuid FROM jsonb_array_elements_text(p_value->'ids') LOOP
   IF NOT EXISTS(SELECT 1 FROM contacts WHERE id=item AND user_id=p_user AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Contact not found.'; END IF;
  END LOOP;
  INSERT INTO agent_contact_permissions(agent_id,user_id,permission_type,can_view,can_contact,can_edit,can_delete,granted_by_user_id)
   VALUES(p_agent,p_user,mode,mode<>'no_access',mode<>'no_access',false,false,p_user)
   ON CONFLICT(agent_id) DO UPDATE SET permission_type=mode,can_view=mode<>'no_access',can_contact=mode<>'no_access' RETURNING id INTO permission;
  DELETE FROM agent_specific_contact_access WHERE agent_id=p_agent;
  IF mode='specific_contacts' THEN
   INSERT INTO agent_specific_contact_access(agent_id,contact_id,permission_id,user_id) SELECT p_agent,value::uuid,permission,p_user FROM jsonb_array_elements_text(p_value->'ids');
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported agent settings section.';
 END IF;
END $$;

CREATE FUNCTION public.desktop_store_setting_secret(p_user uuid,p_scope text,p_id text,p_secret text,p_value jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE old_id uuid; new_id uuid; old_row uuid; provider uuid; agent uuid;
BEGIN
 -- Serialize a credential slot so concurrent replacements cannot lose a write.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_scope||p_id,0));
 IF p_scope IN ('api-key','stripe') THEN
  IF NOT public.user_has_role(p_user,'admin') THEN RAISE EXCEPTION 'Administrator access is required.'; END IF;
 ELSIF p_scope='mcp' THEN
  agent=(p_value->>'agentId')::uuid;
  IF NOT EXISTS(SELECT 1 FROM agents WHERE id=agent AND user_id=p_user) THEN RAISE EXCEPTION 'Agent not found.'; END IF;
 ELSIF p_scope='connection' THEN
  provider=(p_value->>'providerId')::uuid;
  IF p_secret IS NOT NULL AND NOT EXISTS(SELECT 1 FROM service_providers WHERE id=provider AND is_enabled) THEN RAISE EXCEPTION 'Integration provider is disabled or missing.'; END IF;
  IF EXISTS(SELECT 1 FROM user_integration_credentials WHERE id=p_id::uuid AND (user_id<>p_user OR credential_type<>'api_key')) THEN RAISE EXCEPTION 'API connection not found.'; END IF;
 ELSE RAISE EXCEPTION 'Unsupported secret scope.';
 END IF;
 IF p_scope='api-key' THEN
  SELECT vault_secret_id::uuid INTO old_id FROM system_api_keys WHERE provider_name=p_id FOR UPDATE;
 ELSIF p_scope='stripe' THEN
  IF p_id NOT IN ('secret_key','webhook_secret','publishable_key') THEN RAISE EXCEPTION 'Invalid Stripe credential.'; END IF;
  SELECT vault_secret_id::uuid INTO old_id FROM admin_integration_credentials WHERE integration_type='stripe' AND credential_name=p_id FOR UPDATE;
 ELSIF p_scope='connection' THEN
  SELECT vault_access_token_id::uuid INTO old_id FROM user_integration_credentials WHERE id=p_id::uuid AND user_id=p_user FOR UPDATE;
 ELSE
  SELECT id,vault_server_url_id::uuid INTO old_row,old_id FROM agent_mcp_connections WHERE id=p_id::uuid AND agent_id=agent FOR UPDATE;
  IF old_row IS NULL AND EXISTS(SELECT 1 FROM agent_mcp_connections WHERE id=p_id::uuid) THEN RAISE EXCEPTION 'MCP connection not found.'; END IF;
 END IF;
 IF p_secret IS NOT NULL AND length(p_secret)>0 THEN
  SELECT vault.create_secret(p_secret,'desktop:'||gen_random_uuid()::text,'Agentopia managed credential') INTO new_id;
 END IF;
 IF p_scope='api-key' THEN
  INSERT INTO system_api_keys(provider_name,display_name,vault_secret_id,is_active,last_updated_by)
   VALUES(p_id,p_value->>'name',new_id::text,new_id IS NOT NULL,p_user)
   ON CONFLICT(provider_name) DO UPDATE SET vault_secret_id=new_id::text,is_active=new_id IS NOT NULL,last_updated_by=p_user,updated_at=now();
 ELSIF p_scope='stripe' THEN
  IF new_id IS NULL THEN DELETE FROM admin_integration_credentials WHERE integration_type='stripe' AND credential_name=p_id;
  ELSE INSERT INTO admin_integration_credentials(integration_type,credential_name,vault_secret_id,created_by,updated_by)
   VALUES('stripe',p_id,new_id::text,p_user,p_user) ON CONFLICT(integration_type,credential_name) DO UPDATE SET vault_secret_id=new_id::text,connection_method='manual',updated_by=p_user,updated_at=now(); END IF;
 ELSIF p_scope='connection' THEN
  IF new_id IS NULL THEN
   UPDATE user_integration_credentials SET connection_status='revoked',vault_access_token_id=NULL,updated_at=now() WHERE id=p_id::uuid AND user_id=p_user;
   UPDATE agent_integration_permissions SET is_active=false,updated_at=now() WHERE user_oauth_connection_id=p_id::uuid AND granted_by_user_id=p_user;
  ELSE
   INSERT INTO user_integration_credentials(id,user_id,oauth_provider_id,external_user_id,connection_name,credential_type,vault_access_token_id,connection_status)
    VALUES(p_id::uuid,p_user,provider,p_id,p_value->>'name','api_key',new_id::text,'active')
    ON CONFLICT(id) DO UPDATE SET connection_name=p_value->>'name',vault_access_token_id=new_id::text,connection_status='active',updated_at=now();
  END IF;
 ELSE
  IF new_id IS NULL THEN DELETE FROM agent_mcp_connections WHERE id=old_row;
  ELSE INSERT INTO agent_mcp_connections(id,agent_id,connection_name,server_url,vault_server_url_id,connection_type,server_info)
   VALUES(p_id::uuid,agent,p_value->>'name','https://stored.invalid',new_id::text,'generic',jsonb_build_object('display_host',p_value->>'host'))
   ON CONFLICT(id) DO UPDATE SET connection_name=p_value->>'name',vault_server_url_id=new_id::text,server_info=agent_mcp_connections.server_info||jsonb_build_object('display_host',p_value->>'host'),updated_at=now(); END IF;
 END IF;
 -- Keep imported historical secrets; remove only this application's unreferenced
 -- replacements. No secret contents are returned to the renderer.
 IF old_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM system_api_keys WHERE vault_secret_id=old_id::text)
  AND NOT EXISTS(SELECT 1 FROM admin_integration_credentials WHERE vault_secret_id=old_id::text)
  AND NOT EXISTS(SELECT 1 FROM user_integration_credentials WHERE vault_access_token_id=old_id::text OR vault_refresh_token_id=old_id::text)
  AND NOT EXISTS(SELECT 1 FROM agent_mcp_connections WHERE vault_server_url_id=old_id::text) THEN
  DELETE FROM vault.secrets WHERE id=old_id AND name LIKE 'desktop:%';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_save_agent_settings(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.desktop_store_setting_secret(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_agent_settings(uuid,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.desktop_store_setting_secret(uuid,text,text,text,jsonb) TO service_role;
