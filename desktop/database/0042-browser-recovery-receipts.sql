-- Restoring a page and closing a tab must not run again when a native provider
-- redelivers the same call. Native children retain their own receipt scope.
CREATE UNIQUE INDEX desktop_browser_recovery_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name IN ('browser_restore','browser_close') AND arguments ? 'provider_call_id';
