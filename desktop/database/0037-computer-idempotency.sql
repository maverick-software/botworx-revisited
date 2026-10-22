-- Windows input is global and may have changed another application's data even
-- if a native delivery is interrupted. Repeated deliveries reuse their receipt.
CREATE UNIQUE INDEX desktop_computer_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name IN ('computer_windows','computer_snapshot','computer_click',
  'computer_type','computer_key','computer_scroll','computer_drag')
 AND arguments ? 'provider_call_id';
