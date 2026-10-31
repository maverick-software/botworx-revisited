-- Public binding metadata; secret bytes remain in the existing local Vault.
CREATE TABLE public.desktop_plugin_credentials (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plugin_name text NOT NULL,
 vault_secret_id uuid,
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,plugin_name),
 FOREIGN KEY(user_id,plugin_name) REFERENCES public.desktop_plugins(user_id,name) ON DELETE CASCADE
);
ALTER TABLE public.desktop_plugin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_plugin_credentials FROM anon,authenticated;
GRANT ALL ON public.desktop_plugin_credentials TO service_role;
CREATE FUNCTION public.desktop_store_plugin_credential(p_user uuid,p_plugin text,p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
 IF p_plugin NOT IN ('serper-search','tavily-search') OR NOT EXISTS(SELECT 1 FROM desktop_plugins WHERE user_id=p_user AND name=p_plugin AND source='bundled') THEN RAISE EXCEPTION 'Choose an installed search plugin.'; END IF;
 IF p_secret IS NOT NULL AND (length(trim(p_secret))=0 OR length(p_secret)>4096) THEN RAISE EXCEPTION 'Enter a valid search API key.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('plugin-key:'||p_user::text||':'||p_plugin,0));
 SELECT vault_secret_id INTO old_id FROM desktop_plugin_credentials WHERE user_id=p_user AND plugin_name=p_plugin FOR UPDATE;
 IF p_secret IS NOT NULL THEN SELECT vault.create_secret(trim(p_secret),'desktop-plugin:'||gen_random_uuid()::text,'Account-owned Agentopia plugin credential') INTO new_id; END IF;
 INSERT INTO desktop_plugin_credentials(user_id,plugin_name,vault_secret_id,enabled) VALUES(p_user,p_plugin,new_id,new_id IS NOT NULL)
 ON CONFLICT(user_id,plugin_name) DO UPDATE SET vault_secret_id=new_id,enabled=new_id IS NOT NULL,updated_at=now();
 IF old_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_plugin_credentials WHERE vault_secret_id=old_id) THEN DELETE FROM vault.secrets WHERE id=old_id AND name LIKE 'desktop-plugin:%'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_store_plugin_credential(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_store_plugin_credential(uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
