REVOKE ALL ON public.desktop_native_file_review FROM anon,authenticated;
GRANT SELECT ON public.desktop_native_file_review TO authenticated;
GRANT ALL ON public.desktop_native_file_review TO service_role;
NOTIFY pgrst,'reload schema';
