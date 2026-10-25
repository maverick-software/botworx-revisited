-- A new-agent draft has a resource principal before it has a saved agent.
-- No connection secret, saved-agent placeholder or execution grant is created here.
CREATE TABLE public.desktop_creation_tool_scopes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 creation_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 write_id uuid NOT NULL, grants jsonb NOT NULL CHECK(jsonb_typeof(grants)='array'),
 bound_agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
 bound_revision bigint, binding boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,creation_id),CHECK((bound_agent_id IS NULL)=(bound_revision IS NULL)),
 CHECK(bound_revision IS NULL OR bound_revision BETWEEN 1 AND revision)
);
ALTER TABLE public.desktop_creation_tool_scopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_creation_tool_scopes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.desktop_creation_tool_scopes TO service_role;

CREATE FUNCTION public.desktop_check_creation_tool_identity() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.creation_id<>OLD.creation_id) THEN RAISE EXCEPTION 'A creation resource principal cannot change identity'; END IF;
 IF NEW.bound_agent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM agents WHERE id=NEW.bound_agent_id AND user_id=NEW.user_id AND metadata->>'desktop_creation_id'=NEW.creation_id::text) THEN RAISE EXCEPTION 'The saved agent belongs to another owner or creation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_creation_tool_identity BEFORE INSERT OR UPDATE ON public.desktop_creation_tool_scopes FOR EACH ROW EXECUTE FUNCTION public.desktop_check_creation_tool_identity();
REVOKE ALL ON FUNCTION public.desktop_check_creation_tool_identity() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.desktop_require_creation_tool_commit() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes;
BEGIN
 IF NEW.metadata->>'desktop_creation_id' IS NOT NULL THEN
  SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE user_id=NEW.user_id AND creation_id::text=NEW.metadata->>'desktop_creation_id';
  IF FOUND AND NOT scope.binding AND scope.bound_agent_id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'This creation has a staged app selection. Save its confirmed selection with the agent'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_agent_creation_tool_commit BEFORE INSERT OR UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.desktop_require_creation_tool_commit();
REVOKE ALL ON FUNCTION public.desktop_require_creation_tool_commit() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.desktop_creation_tool_scope(p_user uuid,p_creation uuid) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version',1,'id',id,'owner',user_id,'creationId',creation_id,'revision',revision,'writeId',write_id,'grants',grants,'boundAgentId',bound_agent_id,'boundRevision',bound_revision)
 FROM desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation;
$$;

CREATE FUNCTION public.desktop_validate_creation_plugin_grants(p_user uuid,p_grants jsonb) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grant_row jsonb; plugin desktop_plugins; adapters integer:=0; key text;
BEGIN
 IF jsonb_typeof(p_grants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_grants)>100 THEN RAISE EXCEPTION 'Choose up to 100 installed apps'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_grants) g WHERE jsonb_typeof(g) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'Invalid draft app selection'; END IF;
 IF (SELECT count(*)<>count(DISTINCT value->>'name') FROM jsonb_array_elements(p_grants)) THEN RAISE EXCEPTION 'Choose distinct apps'; END IF;
 FOR grant_row IN SELECT value FROM jsonb_array_elements(p_grants) ORDER BY (value->>'name') COLLATE "C" LOOP
  FOR key IN SELECT jsonb_object_keys(grant_row) LOOP IF key NOT IN ('name','digest') THEN RAISE EXCEPTION 'Draft app selection cannot contain credentials or authority fields'; END IF; END LOOP;
  IF jsonb_typeof(grant_row->'name') IS DISTINCT FROM 'string' OR length(grant_row->>'name')>64 OR grant_row->>'name' !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' OR position('..' in grant_row->>'name')>0 OR position('--' in grant_row->>'name')>0 OR jsonb_typeof(grant_row->'digest') IS DISTINCT FROM 'string' OR grant_row->>'digest' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Choose installed apps with their reviewed versions'; END IF;
  SELECT * INTO plugin FROM desktop_plugins WHERE user_id=p_user AND name=grant_row->>'name' FOR UPDATE;
  IF NOT FOUND OR NOT plugin.enabled OR plugin.digest<>grant_row->>'digest' THEN RAISE EXCEPTION 'An app was disabled, removed or changed. Refresh its reviewed selection'; END IF;
  IF plugin.source='legacy' THEN RAISE EXCEPTION 'An existing protected connection belongs to its original agent. Install a reviewed package for this draft'; END IF;
  IF plugin.package#>>'{manifest,extensions,com.agentopia,adapter}' IS NOT NULL THEN adapters=adapters+1; END IF;
 END LOOP;
 IF adapters>1 THEN RAISE EXCEPTION 'Choose one search provider for this draft'; END IF;
END $$;

CREATE FUNCTION public.desktop_write_creation_tool_scope(p_user uuid,p_creation uuid,p_revision bigint,p_write uuid,p_grants jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old desktop_creation_tool_scopes; canonical jsonb;
BEGIN
 IF p_user IS NULL OR p_creation IS NULL OR p_write IS NULL OR p_revision IS NULL OR p_revision<0 OR p_revision>=9007199254740991 THEN RAISE EXCEPTION 'Choose a valid creation, revision and write identity'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 SELECT * INTO old FROM desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR UPDATE;
 IF jsonb_typeof(p_grants) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose installed apps'; END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY (value->>'name') COLLATE "C"),'[]'::jsonb) INTO canonical FROM jsonb_array_elements(p_grants);
 IF old.write_id=p_write THEN
  IF old.revision<>p_revision+1 OR old.grants<>canonical THEN RAISE EXCEPTION 'The draft app write identity was reused with different content'; END IF;
  RETURN desktop_creation_tool_scope(p_user,p_creation);
 END IF;
 IF old.bound_agent_id IS NOT NULL THEN RAISE EXCEPTION 'This draft already created an agent. Edit its saved app assignments'; END IF;
 PERFORM desktop_validate_creation_plugin_grants(p_user,p_grants);
 IF coalesce(old.revision,0)<>p_revision THEN RAISE EXCEPTION 'The draft app selection changed. Refresh it before replacing it'; END IF;
 IF EXISTS(SELECT 1 FROM agents WHERE user_id=p_user AND metadata->>'desktop_creation_id'=p_creation::text) THEN RAISE EXCEPTION 'This creation already saved an agent without this app selection'; END IF;
 INSERT INTO desktop_creation_tool_scopes(user_id,creation_id,revision,write_id,grants) VALUES(p_user,p_creation,p_revision+1,p_write,canonical)
 ON CONFLICT(user_id,creation_id) DO UPDATE SET revision=excluded.revision,write_id=excluded.write_id,grants=excluded.grants,updated_at=now();
 RETURN desktop_creation_tool_scope(p_user,p_creation);
END $$;

CREATE FUNCTION public.desktop_create_agent_with_tools(p_user uuid,p_creation uuid,p_tool_revision bigint,p_name text,p_description text,p_instructions text,p_provider text,p_model text,p_appearance jsonb,p_avatar text,p_behavior jsonb DEFAULT NULL) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes; result uuid; existing uuid; grant_row jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR UPDATE;
 IF NOT FOUND OR scope.revision IS DISTINCT FROM p_tool_revision THEN RAISE EXCEPTION 'Refresh the creation app selection before saving this agent'; END IF;
 SELECT id INTO existing FROM agents WHERE user_id=p_user AND metadata->>'desktop_creation_id'=p_creation::text;
 IF existing IS NOT NULL AND scope.bound_agent_id IS DISTINCT FROM existing THEN RAISE EXCEPTION 'This creation already saved an agent without this app selection'; END IF;
 IF scope.bound_agent_id IS NULL THEN UPDATE desktop_creation_tool_scopes SET binding=true WHERE id=scope.id; END IF;
 IF p_behavior IS NULL THEN result=desktop_create_agent_presentation(p_user,p_creation,p_name,p_description,p_instructions,p_provider,p_model,p_appearance,p_avatar);
 ELSE result=desktop_create_agent_definition(p_user,p_creation,p_name,p_description,p_instructions,p_provider,p_model,p_appearance,p_avatar,p_behavior); END IF;
 IF scope.bound_agent_id IS NOT NULL THEN RETURN result; END IF;
 PERFORM desktop_agent_profile(p_user,result);
 PERFORM desktop_validate_creation_plugin_grants(p_user,scope.grants);
 FOR grant_row IN SELECT value FROM jsonb_array_elements(scope.grants) LOOP PERFORM desktop_assign_plugin(p_user,grant_row->>'name',result,true); END LOOP;
 UPDATE desktop_creation_tool_scopes SET bound_agent_id=result,bound_revision=revision,binding=false,updated_at=now() WHERE id=scope.id;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.desktop_creation_tool_scope(uuid,uuid),public.desktop_validate_creation_plugin_grants(uuid,jsonb),public.desktop_write_creation_tool_scope(uuid,uuid,bigint,uuid,jsonb),public.desktop_create_agent_with_tools(uuid,uuid,bigint,text,text,text,text,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_creation_tool_scope(uuid,uuid),public.desktop_validate_creation_plugin_grants(uuid,jsonb),public.desktop_write_creation_tool_scope(uuid,uuid,bigint,uuid,jsonb),public.desktop_create_agent_with_tools(uuid,uuid,bigint,text,text,text,text,text,jsonb,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
