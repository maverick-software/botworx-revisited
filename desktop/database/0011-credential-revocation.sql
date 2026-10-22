-- The original trigger retained the table name used before integrations were
-- renamed. Revocation must succeed and remove effective agent permissions.
CREATE OR REPLACE FUNCTION public.handle_credential_revocation_cascade() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.connection_status='revoked' AND OLD.connection_status IS DISTINCT FROM 'revoked' THEN
  UPDATE agents SET metadata=jsonb_set(coalesce(metadata,'{}'),'{credential_revoked}',jsonb_build_array(NEW.id::text))
   WHERE user_id=NEW.user_id AND id IN(SELECT agent_id FROM agent_integration_permissions WHERE user_oauth_connection_id=NEW.id);
  UPDATE agent_integration_permissions SET is_active=false,updated_at=now() WHERE user_oauth_connection_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_credential_revocation_cascade() FROM PUBLIC,anon,authenticated;
