-- Download metadata is scoped to an owned conversation just like browser reads.
-- Retain one receipt per native provider call, including concurrent delivery.
CREATE UNIQUE INDEX desktop_browser_download_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name = 'browser_downloads' AND arguments ? 'provider_call_id';
