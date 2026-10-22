-- These RPCs call desktop_agent_profile, which locks rows and lazily records
-- updated agent definitions. STABLE makes PostgREST run even POST requests in
-- READ ONLY transactions, preventing a receiving chat from validating its grant.
-- Keep the ownership, scope, revocation checks, locks and grants unchanged.
ALTER FUNCTION public.desktop_chat_delivery_snapshot(uuid,uuid,uuid,text,uuid,boolean) VOLATILE;
ALTER FUNCTION public.desktop_validate_chat_delivery(uuid,uuid) VOLATILE;
ALTER FUNCTION public.desktop_validate_chat_delivery_request(uuid,uuid) VOLATILE;
NOTIFY pgrst,'reload schema';
