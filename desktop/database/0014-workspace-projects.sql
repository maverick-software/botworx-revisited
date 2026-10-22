CREATE TABLE public.desktop_projects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 reference_id uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,user_id)
);
CREATE TABLE public.desktop_project_chats(
 conversation_id uuid PRIMARY KEY REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 project_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,user_id) REFERENCES public.desktop_projects(id,user_id) ON DELETE CASCADE
);
ALTER TABLE public.desktop_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_project_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_projects_owner ON public.desktop_projects FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY desktop_project_chats_owner ON public.desktop_project_chats FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_projects,public.desktop_project_chats TO authenticated;
GRANT ALL ON public.desktop_projects,public.desktop_project_chats TO service_role;
NOTIFY pgrst,'reload schema';
