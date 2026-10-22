-- A no-access policy must revoke every permission, including advanced policies
-- imported from earlier releases.
CREATE FUNCTION public.desktop_contact_revocation() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.permission_type='no_access' THEN
  NEW.can_view=false; NEW.can_contact=false; NEW.can_edit=false;
  NEW.can_delete=false; NEW.can_export=false;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_contact_revocation BEFORE INSERT OR UPDATE ON public.agent_contact_permissions
FOR EACH ROW EXECUTE FUNCTION public.desktop_contact_revocation();
REVOKE ALL ON FUNCTION public.desktop_contact_revocation() FROM PUBLIC,anon,authenticated;
