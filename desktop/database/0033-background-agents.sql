-- The native runtime owns thread history. PostgreSQL records the approved
-- execution context and child/report snapshots for ownership, controls and recovery.
ALTER TABLE public.desktop_codex_turns ADD COLUMN context jsonb;
COMMENT ON COLUMN public.desktop_codex_turns.context IS 'Approved native execution context for explicit child recovery. Contains no provider credentials. Service writes only; existing owner SELECT policy applies.';
