-- Attribute host-managed approval/operation receipts to the native child that
-- requested them, even after the parent response has been saved.
ALTER TABLE public.desktop_tool_calls ADD COLUMN native_thread_id text;
CREATE INDEX desktop_tool_native_thread ON public.desktop_tool_calls(request_id,native_thread_id) WHERE native_thread_id IS NOT NULL;
