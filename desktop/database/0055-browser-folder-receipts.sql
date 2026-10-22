-- Folder selection can dispatch website handlers immediately, just like files.
-- Reserve one receipt per native call before review or selection; children have
-- independent call identifiers within their own native thread.
CREATE UNIQUE INDEX desktop_browser_folder_call_once ON public.desktop_tool_calls
 (request_id,COALESCE(native_thread_id,''),(arguments->>'provider_call_id'))
 WHERE name='browser_upload_folder' AND arguments ? 'provider_call_id';
