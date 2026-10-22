-- Reviewed keyboard and select inputs may submit data or trigger website work.
-- Preserve one receipt per native request/child/provider call before dispatch.
CREATE UNIQUE INDEX desktop_browser_input_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name IN ('browser_select','browser_press') AND arguments ? 'provider_call_id';
