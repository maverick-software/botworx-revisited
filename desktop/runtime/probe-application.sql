SELECT count(*) AS application_tables FROM pg_tables WHERE schemaname = 'public';
SELECT count(*) AS preserved_accounts FROM auth.users;
SELECT r.name, count(*) FROM public.user_roles ur
JOIN public.roles r ON r.id=ur.role_id GROUP BY r.name ORDER BY r.name;
SELECT md5(string_agg(id::text || ':' || encrypted_password, ',' ORDER BY id)) AS password_fingerprint FROM auth.users;
CREATE TRIGGER assign_local_user_role_after_signup AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_local_user_role();
CREATE TRIGGER auto_create_contact_management_credential_trigger AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_create_contact_management_credential();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TABLE public.agentopia_runtime_probe(id uuid PRIMARY KEY, value text NOT NULL);
ALTER TABLE public.agentopia_runtime_probe ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.agentopia_runtime_probe TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agentopia_runtime_probe;
NOTIFY pgrst, 'reload schema';
