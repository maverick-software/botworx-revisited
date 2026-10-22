-- A provider can repeat a tool event. One request/call identifier may start only
-- one Windows command, even if future tool dispatch becomes concurrent.
CREATE UNIQUE INDEX desktop_command_call_once ON public.desktop_tool_calls
 (request_id,(arguments->>'provider_call_id'))
 WHERE name='run_command' AND arguments ? 'provider_call_id';
