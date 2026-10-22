-- Add conversation linkage to tasks and executions
ALTER TABLE IF EXISTS public.agent_tasks
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

ALTER TABLE IF EXISTS public.agent_task_executions
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Optional title for conversations (used by UI). Safe add.
ALTER TABLE IF EXISTS public.conversation_sessions
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_agent_tasks_conversation ON public.agent_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_task_exec_conversation ON public.agent_task_executions(conversation_id);


