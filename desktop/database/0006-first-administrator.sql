-- Complete first-owner role assignment inside the Auth account transaction so
-- an interrupted desktop request cannot leave the installation without an admin.
CREATE FUNCTION public.desktop_assign_first_administrator() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
BEGIN
 IF NEW.raw_user_meta_data->>'agentopia_first_administrator'='true' THEN
  PERFORM pg_advisory_xact_lock(724919004);
  IF (SELECT count(*) FROM auth.users)=1 AND NOT EXISTS(
   SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE r.name='admin'
  ) THEN
   INSERT INTO public.user_roles(user_id,role_id) SELECT NEW.id,id FROM public.roles WHERE name='admin' ON CONFLICT DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_first_administrator AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.desktop_assign_first_administrator();
REVOKE EXECUTE ON FUNCTION public.desktop_assign_first_administrator() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_assign_first_administrator() TO service_role;
