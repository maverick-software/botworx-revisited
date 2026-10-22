-- New desktop agents receive connections through explicit plugin assignments.
-- The legacy contact hook synthesizes an internal credential and returns a
-- zero UUID if its historical provider is absent. On a clean installation the
-- subsequent permission insert violates its connection foreign key, rolling
-- back otherwise valid agent creation. Existing credentials and grants stay.
DROP TRIGGER IF EXISTS auto_grant_contact_management_access_trigger ON public.agents;
NOTIFY pgrst,'reload schema';
