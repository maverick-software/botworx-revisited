-- Visual input can change a website before an acknowledgement reaches Codex.
-- A native call is dispatched once, with independent parent/child call scope.
CREATE UNIQUE INDEX desktop_browser_pointer_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name IN ('browser_click','browser_move','browser_drag','browser_scroll')
 AND arguments ? 'provider_call_id';
