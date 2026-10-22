-- File selection can send bytes immediately through page handlers. A duplicate
-- native call must never select/upload them again; child calls retain scope.
CREATE UNIQUE INDEX desktop_browser_upload_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name='browser_upload' AND arguments ? 'provider_call_id';
