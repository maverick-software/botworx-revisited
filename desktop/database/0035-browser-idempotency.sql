-- Browser inputs may have external effects. Repeated native tool deliveries
-- cannot dispatch an action again, including concurrent deliveries.
CREATE UNIQUE INDEX desktop_browser_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name IN ('browser_list','browser_open','browser_snapshot','browser_action')
 AND arguments ? 'provider_call_id';
