CREATE TABLE public.desktop_file_operations (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid REFERENCES public.desktop_requests(id) ON DELETE SET NULL,
 tool_id uuid REFERENCES public.desktop_tool_calls(id) ON DELETE SET NULL,
 source text NOT NULL CHECK(source IN('user','agent')),
 action text NOT NULL CHECK(action IN('move','remove','create_folder')),
 status text NOT NULL CHECK(status IN('prepared','applying','completed','denied','failed','interrupted','restoring','restored')),
 phase text NOT NULL DEFAULT 'apply' CHECK(phase IN('apply','restore')),
 dedup_key text,
 preview jsonb NOT NULL,
 result jsonb,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX desktop_file_operation_request ON public.desktop_file_operations(user_id,request_id,dedup_key) WHERE request_id IS NOT NULL;
CREATE INDEX desktop_file_operation_owner ON public.desktop_file_operations(user_id,created_at DESC);
ALTER TABLE public.desktop_file_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_file_operations_owner ON public.desktop_file_operations FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_file_operations TO authenticated;
GRANT ALL ON public.desktop_file_operations TO service_role;
NOTIFY pgrst,'reload schema';
