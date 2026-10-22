SELECT count(*) >= 1 AS persisted_probe FROM public.agentopia_runtime_probe
WHERE value = 'persistent-native-proof';
SELECT count(*) = 2 AS original_accounts FROM auth.users;
SELECT cron.schedule('agentopia-runtime-proof', '1 second',
  $$INSERT INTO public.agentopia_runtime_probe(id,value)
    VALUES (extensions.gen_random_uuid(),'native-cron-proof')$$);
SELECT pg_sleep(3);
SELECT cron.unschedule('agentopia-runtime-proof');
SELECT count(*) >= 1 AS cron_executed FROM public.agentopia_runtime_probe
WHERE value = 'native-cron-proof';
