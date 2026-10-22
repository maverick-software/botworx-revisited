DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'agentopia_task_executor_minutely';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      PERFORM cron.schedule(
        'agentopia_task_executor_minutely',
        '*/5 * * * *',
        'SELECT net.http_get(url := ''https://txhscptzjrrudnqwavcb.supabase.co/functions/v1/task-executor'')'
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;
