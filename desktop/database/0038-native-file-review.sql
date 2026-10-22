CREATE TABLE public.desktop_native_file_review(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 change_key text NOT NULL,source_hash text NOT NULL,
 status text NOT NULL CHECK(status IN('ready','restoring','restored','uncertain')),
 paths jsonb NOT NULL,error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_id,change_key)
);
ALTER TABLE public.desktop_native_file_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY native_file_review_owner ON public.desktop_native_file_review FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_native_file_review TO authenticated;
GRANT ALL ON public.desktop_native_file_review TO service_role;
NOTIFY pgrst,'reload schema';
