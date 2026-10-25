-- Discard revokes a creation permanently while retaining its content and receipts.
CREATE TABLE public.desktop_creation_retirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 creation_id uuid NOT NULL,write_id uuid NOT NULL,
 revision bigint NOT NULL CHECK(revision BETWEEN 0 AND 9007199254740991),
 saved_agent_id uuid,retired_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,creation_id)
);
ALTER TABLE public.desktop_creation_retirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_creation_retirements FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.desktop_creation_retirements TO service_role;

CREATE FUNCTION public.desktop_creation_retirement(p_user uuid,p_creation uuid) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version',1,'id',id,'owner',user_id,'creationId',creation_id,'writeId',write_id,'revision',revision,'savedAgentId',saved_agent_id,'retiredAt',retired_at)
 FROM desktop_creation_retirements WHERE user_id=p_user AND creation_id=p_creation;
$$;
CREATE FUNCTION public.desktop_require_active_creation(p_user uuid,p_creation uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_user IS NULL OR p_creation IS NULL THEN RAISE EXCEPTION 'Choose an owned creation identity'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_creation_retirements WHERE user_id=p_user AND creation_id=p_creation) THEN RAISE EXCEPTION 'This creation was discarded. Recover its fields into a new creation to continue'; END IF;
END $$;
CREATE FUNCTION public.desktop_retire_creation(p_user uuid,p_creation uuid,p_revision bigint,p_write uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes; saved uuid;
BEGIN
 IF p_user IS NULL OR p_creation IS NULL OR p_write IS NULL OR p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740991 THEN RAISE EXCEPTION 'Review the current creation app revision before discarding'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 IF EXISTS(SELECT 1 FROM desktop_creation_retirements WHERE user_id=p_user AND creation_id=p_creation) THEN RETURN desktop_creation_retirement(p_user,p_creation); END IF;
 SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR UPDATE;
 IF coalesce(scope.revision,0)<>p_revision THEN RAISE EXCEPTION 'The creation app selection changed. Review its current revision before discarding'; END IF;
 SELECT id INTO saved FROM agents WHERE user_id=p_user AND metadata->>'desktop_creation_id'=p_creation::text;
 INSERT INTO desktop_creation_retirements(user_id,creation_id,write_id,revision,saved_agent_id) VALUES(p_user,p_creation,p_write,p_revision,saved);
 RETURN desktop_creation_retirement(p_user,p_creation);
END $$;

CREATE FUNCTION public.desktop_immutable_creation_retirement() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'A discarded creation cannot be reactivated';
END $$;
CREATE TRIGGER desktop_creation_retirement_immutable BEFORE UPDATE OR DELETE ON public.desktop_creation_retirements FOR EACH ROW EXECUTE FUNCTION public.desktop_immutable_creation_retirement();

CREATE FUNCTION public.desktop_guard_retired_creation() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE owner_id uuid; creation uuid;
BEGIN
 IF TG_TABLE_NAME='agents' THEN
  IF TG_OP='UPDATE' AND NEW.id=OLD.id AND NEW.user_id=OLD.user_id AND NEW.metadata->>'desktop_creation_id' IS NOT DISTINCT FROM OLD.metadata->>'desktop_creation_id' THEN RETURN NEW; END IF;
  owner_id=NEW.user_id;creation=(NEW.metadata->>'desktop_creation_id')::uuid;
 ELSE owner_id=NEW.user_id;creation=NEW.creation_id; END IF;
 IF creation IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||creation::text,0));
  PERFORM desktop_require_active_creation(owner_id,creation);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_creation_not_retired BEFORE INSERT OR UPDATE ON public.desktop_creation_tool_scopes FOR EACH ROW EXECUTE FUNCTION public.desktop_guard_retired_creation();
CREATE TRIGGER desktop_new_agent_creation_not_retired BEFORE INSERT OR UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.desktop_guard_retired_creation();
CREATE TRIGGER desktop_preview_creation_not_retired BEFORE INSERT ON public.desktop_preview_requests FOR EACH ROW EXECUTE FUNCTION public.desktop_guard_retired_creation();

REVOKE ALL ON FUNCTION public.desktop_creation_retirement(uuid,uuid),public.desktop_require_active_creation(uuid,uuid),public.desktop_retire_creation(uuid,uuid,bigint,uuid),public.desktop_immutable_creation_retirement(),public.desktop_guard_retired_creation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_creation_retirement(uuid,uuid),public.desktop_require_active_creation(uuid,uuid),public.desktop_retire_creation(uuid,uuid,bigint,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
