-- Managed Chrome calls can click, submit, or evaluate scripts in a signed-in
-- browser. Repeated native deliveries must reuse the persisted receipt.
CREATE UNIQUE INDEX desktop_chrome_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name='mcp_call'
 AND arguments->>'connection_id'='f51d9d69-c827-4a9e-a683-47571984d7f7'
 AND arguments ? 'provider_call_id';
