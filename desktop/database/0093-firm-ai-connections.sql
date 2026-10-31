-- Extend the existing owned agent/chat paths. No identities or content change.
BEGIN;
ALTER TABLE public.desktop_codex_threads DROP CONSTRAINT desktop_codex_threads_provider_check;
ALTER TABLE public.desktop_codex_threads ADD CONSTRAINT desktop_codex_threads_provider_check CHECK(provider IN ('openai-oauth','openrouter','sylvana','openai-api'));
ALTER TABLE public.desktop_preview_codex_threads DROP CONSTRAINT desktop_preview_codex_threads_provider_check;
ALTER TABLE public.desktop_preview_codex_threads ADD CONSTRAINT desktop_preview_codex_threads_provider_check CHECK(provider IN ('openai-oauth','openrouter','sylvana','openai-api'));
DO $$ DECLARE f record; definition text; updated text; BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'desktop_%' AND p.prokind='f' LOOP
  definition:=pg_get_functiondef(f.oid);
  updated:=regexp_replace(definition,'''openai-oauth''\s*,\s*''openrouter''','''openai-oauth'',''openrouter'',''sylvana'',''openai-api''','g');
  updated:=regexp_replace(updated,'''openrouter''\s*,\s*''openai-oauth''','''openrouter'',''openai-oauth'',''sylvana'',''openai-api''','g');
  IF updated IS DISTINCT FROM definition THEN EXECUTE updated; END IF;
 END LOOP;
END $$;
COMMIT;
