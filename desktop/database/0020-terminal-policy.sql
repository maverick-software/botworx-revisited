-- Role lookup uses the caller's own role rows. The legacy user_has_role RPC
-- remains restricted to the trusted broker by the desktop baseline.
DROP POLICY desktop_terminal_read ON public.desktop_terminal_runs;
CREATE POLICY desktop_terminal_read ON public.desktop_terminal_runs FOR SELECT TO authenticated
 USING (user_id=auth.uid() AND EXISTS (
  SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
  WHERE ur.user_id=auth.uid() AND r.name='admin'
 ));
NOTIFY pgrst,'reload schema';
