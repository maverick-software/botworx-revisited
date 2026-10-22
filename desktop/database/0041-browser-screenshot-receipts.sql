-- Screenshots share private page pixels. Preserve one durable receipt per
-- provider call and native thread, including concurrent call delivery.
CREATE UNIQUE INDEX desktop_browser_screenshot_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name = 'browser_screenshot' AND arguments ? 'provider_call_id';
