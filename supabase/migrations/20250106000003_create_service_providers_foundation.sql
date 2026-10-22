-- =====================================================
-- SERVICE PROVIDERS MIGRATION - FOUNDATION SETUP
-- =====================================================
-- Create service_providers table to replace oauth_providers
-- Based on existing oauth_providers schema

-- Step 1: Create service_providers table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.service_providers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  display_name text not null,
  authorization_endpoint text not null,
  token_endpoint text not null,
  revoke_endpoint text null,
  discovery_endpoint text null,
  scopes_supported jsonb not null default '[]'::jsonb,
  pkce_required boolean not null default true,
  client_credentials_location text not null default 'header'::text,
  is_enabled boolean not null default true,
  configuration_metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint service_providers_pkey primary key (id),
  constraint service_providers_name_key unique (name)
) TABLESPACE pg_default;

-- Step 2: Create indexes (matching oauth_providers)
CREATE INDEX IF NOT EXISTS idx_service_providers_enabled 
  ON public.service_providers USING btree (name) 
  TABLESPACE pg_default
  WHERE (is_enabled = true);

CREATE INDEX IF NOT EXISTS idx_service_providers_name 
  ON public.service_providers USING btree (name) 
  TABLESPACE pg_default;

-- Step 3: Create triggers (if they don't exist)
DO $$
BEGIN
    -- Create deletion cascade trigger if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'service_providers_deletion_cascade_trigger'
        AND event_object_table = 'service_providers'
    ) THEN
        CREATE TRIGGER service_providers_deletion_cascade_trigger
          AFTER DELETE ON service_providers 
          FOR EACH ROW
          EXECUTE FUNCTION handle_integration_deletion_cascade();
    END IF;

    -- Create updated_at trigger if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_service_providers_updated_at'
        AND event_object_table = 'service_providers'
    ) THEN
        CREATE TRIGGER update_service_providers_updated_at 
          BEFORE UPDATE ON service_providers 
          FOR EACH ROW
          EXECUTE FUNCTION update_oauth_providers_updated_at();
    END IF;
END $$;

-- Step 4: Enable RLS (if not already enabled)
DO $$
BEGIN
    -- Enable RLS if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'service_providers' 
        AND n.nspname = 'public' 
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 5: Create RLS policies (if they don't exist)
DO $$
BEGIN
    -- Create read policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'service_providers' 
        AND policyname = 'Service providers are readable by authenticated users'
    ) THEN
        CREATE POLICY "Service providers are readable by authenticated users"
          ON service_providers FOR SELECT
          TO authenticated
          USING (is_enabled = true);
    END IF;

    -- Create admin policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'service_providers' 
        AND policyname = 'Only service role can modify service providers'
    ) THEN
        CREATE POLICY "Only service role can modify service providers"
          ON service_providers FOR ALL
          TO service_role
          USING (true);
    END IF;
END $$;

-- Step 6: Grant permissions (matching oauth_providers)
GRANT SELECT ON service_providers TO anon, authenticated;
GRANT ALL ON service_providers TO service_role;

-- Step 7: Copy all existing data from oauth_providers (if table exists)
DO $$
BEGIN
    -- Check if oauth_providers table exists before copying data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_providers') THEN
        INSERT INTO service_providers (
          id, name, display_name, authorization_endpoint, token_endpoint,
          revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
          client_credentials_location, is_enabled, configuration_metadata,
          created_at, updated_at
        )
        SELECT 
          id, name, display_name, authorization_endpoint, token_endpoint,
          revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
          client_credentials_location, is_enabled, configuration_metadata,
          created_at, updated_at
        FROM oauth_providers
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Copied data from oauth_providers to service_providers';
    ELSE
        RAISE NOTICE 'oauth_providers table does not exist, skipping data copy';
    END IF;
END $$;

-- Step 8: Create migration logging infrastructure
CREATE TABLE public.migration_fallback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation_type text NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  user_id uuid,
  session_id text,
  query_info jsonb,
  stack_trace text,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_migration_fallback_logs_table_time 
  ON migration_fallback_logs(table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_migration_fallback_logs_operation_time 
  ON migration_fallback_logs(operation_type, created_at DESC);

-- Step 9: Create fallback logging function
CREATE OR REPLACE FUNCTION log_oauth_providers_fallback()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
  current_session text;
  current_ip inet;
  current_user_agent text;
BEGIN
  -- Safely get current user info
  BEGIN
    current_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;
  
  BEGIN
    current_session := current_setting('application_name', true);
  EXCEPTION WHEN OTHERS THEN
    current_session := 'unknown';
  END;
  
  BEGIN
    current_ip := inet_client_addr();
  EXCEPTION WHEN OTHERS THEN
    current_ip := NULL;
  END;
  
  BEGIN
    current_user_agent := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    current_user_agent := NULL;
  END;
  
  -- Log the fallback usage with detailed context
  INSERT INTO migration_fallback_logs (
    table_name, 
    operation_type, 
    user_id,
    session_id,
    query_info,
    stack_trace,
    ip_address,
    user_agent
  ) VALUES (
    'oauth_providers',
    TG_OP,
    current_user_id,
    current_session,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now(),
      'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
      'new_record', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    ),
    pg_backend_pid()::text, -- Use backend PID as stack trace identifier
    current_ip,
    current_user_agent
  );
  
  -- Handle the actual operation on service_providers
  IF TG_OP = 'DELETE' THEN
    DELETE FROM service_providers WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE service_providers SET
      name = NEW.name,
      display_name = NEW.display_name,
      authorization_endpoint = NEW.authorization_endpoint,
      token_endpoint = NEW.token_endpoint,
      revoke_endpoint = NEW.revoke_endpoint,
      discovery_endpoint = NEW.discovery_endpoint,
      scopes_supported = NEW.scopes_supported,
      pkce_required = NEW.pkce_required,
      client_credentials_location = NEW.client_credentials_location,
      is_enabled = NEW.is_enabled,
      configuration_metadata = NEW.configuration_metadata,
      updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint,
      revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
      client_credentials_location, is_enabled, configuration_metadata
    ) VALUES (
      COALESCE(NEW.id, gen_random_uuid()), 
      NEW.name, NEW.display_name, NEW.authorization_endpoint, NEW.token_endpoint,
      NEW.revoke_endpoint, NEW.discovery_endpoint, NEW.scopes_supported, NEW.pkce_required,
      NEW.client_credentials_location, NEW.is_enabled, NEW.configuration_metadata
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      display_name = EXCLUDED.display_name,
      authorization_endpoint = EXCLUDED.authorization_endpoint,
      token_endpoint = EXCLUDED.token_endpoint,
      revoke_endpoint = EXCLUDED.revoke_endpoint,
      discovery_endpoint = EXCLUDED.discovery_endpoint,
      scopes_supported = EXCLUDED.scopes_supported,
      pkce_required = EXCLUDED.pkce_required,
      client_credentials_location = EXCLUDED.client_credentials_location,
      is_enabled = EXCLUDED.is_enabled,
      configuration_metadata = EXCLUDED.configuration_metadata,
      updated_at = now();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create fallback view with logging
CREATE OR REPLACE VIEW oauth_providers_fallback AS
SELECT 
  id, name, display_name, authorization_endpoint, token_endpoint,
  revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
  client_credentials_location, is_enabled, configuration_metadata,
  created_at, updated_at
FROM service_providers;

-- Step 11: Create monitoring functions
CREATE OR REPLACE FUNCTION get_migration_fallback_stats(hours_back integer DEFAULT 24)
RETURNS TABLE (
  table_name text,
  operation_type text,
  usage_count bigint,
  last_used timestamptz,
  unique_sessions bigint,
  unique_users bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mfl.table_name,
    mfl.operation_type,
    COUNT(*) as usage_count,
    MAX(mfl.created_at) as last_used,
    COUNT(DISTINCT mfl.session_id) as unique_sessions,
    COUNT(DISTINCT mfl.user_id) as unique_users
  FROM migration_fallback_logs mfl
  WHERE mfl.created_at >= now() - (hours_back || ' hours')::interval
  GROUP BY mfl.table_name, mfl.operation_type
  ORDER BY usage_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Create data consistency check function
CREATE OR REPLACE FUNCTION check_service_providers_consistency()
RETURNS TABLE (
  check_type text,
  oauth_count bigint,
  service_count bigint,
  status text,
  details text
) AS $$
BEGIN
  -- Check record counts
  RETURN QUERY
  WITH counts AS (
    SELECT 
      (SELECT COUNT(*) FROM oauth_providers) as oauth_count,
      (SELECT COUNT(*) FROM service_providers) as service_count
  )
  SELECT 
    'record_count'::text,
    oauth_count,
    service_count,
    CASE WHEN oauth_count = service_count THEN 'OK' ELSE 'MISMATCH' END::text,
    CASE WHEN oauth_count = service_count 
         THEN 'Record counts match' 
         ELSE 'Record counts differ: oauth=' || oauth_count || ', service=' || service_count 
    END::text
  FROM counts;
  
  -- Check for data drift in updated records
  RETURN QUERY
  SELECT 
    'data_drift'::text,
    COUNT(CASE WHEN op.updated_at != sp.updated_at THEN 1 END)::bigint as oauth_count,
    COUNT(*)::bigint as service_count,
    CASE WHEN COUNT(CASE WHEN op.updated_at != sp.updated_at THEN 1 END) = 0 
         THEN 'OK' ELSE 'DRIFT_DETECTED' END::text,
    CASE WHEN COUNT(CASE WHEN op.updated_at != sp.updated_at THEN 1 END) = 0
         THEN 'No data drift detected'
         ELSE COUNT(CASE WHEN op.updated_at != sp.updated_at THEN 1 END)::text || ' records have data drift'
    END::text
  FROM oauth_providers op
  FULL OUTER JOIN service_providers sp ON op.id = sp.id;
  
  -- Check for missing records
  RETURN QUERY
  SELECT 
    'missing_records'::text,
    COUNT(CASE WHEN sp.id IS NULL THEN 1 END)::bigint as oauth_count,
    COUNT(CASE WHEN op.id IS NULL THEN 1 END)::bigint as service_count,
    CASE WHEN COUNT(CASE WHEN sp.id IS NULL OR op.id IS NULL THEN 1 END) = 0 
         THEN 'OK' ELSE 'MISSING_RECORDS' END::text,
    CASE WHEN COUNT(CASE WHEN sp.id IS NULL OR op.id IS NULL THEN 1 END) = 0
         THEN 'All records present in both tables'
         ELSE 'Missing records detected'
    END::text
  FROM oauth_providers op
  FULL OUTER JOIN service_providers sp ON op.id = sp.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Grant permissions for monitoring functions
GRANT EXECUTE ON FUNCTION get_migration_fallback_stats(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_service_providers_consistency() TO authenticated, service_role;

-- Step 14: Create sync trigger to keep tables in sync during migration
CREATE OR REPLACE FUNCTION sync_oauth_to_service_providers()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync changes from oauth_providers to service_providers
  -- This ensures data consistency during the migration period
  
  IF TG_OP = 'DELETE' THEN
    DELETE FROM service_providers WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE service_providers SET
      name = NEW.name,
      display_name = NEW.display_name,
      authorization_endpoint = NEW.authorization_endpoint,
      token_endpoint = NEW.token_endpoint,
      revoke_endpoint = NEW.revoke_endpoint,
      discovery_endpoint = NEW.discovery_endpoint,
      scopes_supported = NEW.scopes_supported,
      pkce_required = NEW.pkce_required,
      client_credentials_location = NEW.client_credentials_location,
      is_enabled = NEW.is_enabled,
      configuration_metadata = NEW.configuration_metadata,
      updated_at = NEW.updated_at
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint,
      revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
      client_credentials_location, is_enabled, configuration_metadata,
      created_at, updated_at
    ) VALUES (
      NEW.id, NEW.name, NEW.display_name, NEW.authorization_endpoint, NEW.token_endpoint,
      NEW.revoke_endpoint, NEW.discovery_endpoint, NEW.scopes_supported, NEW.pkce_required,
      NEW.client_credentials_location, NEW.is_enabled, NEW.configuration_metadata,
      NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      display_name = EXCLUDED.display_name,
      authorization_endpoint = EXCLUDED.authorization_endpoint,
      token_endpoint = EXCLUDED.token_endpoint,
      revoke_endpoint = EXCLUDED.revoke_endpoint,
      discovery_endpoint = EXCLUDED.discovery_endpoint,
      scopes_supported = EXCLUDED.scopes_supported,
      pkce_required = EXCLUDED.pkce_required,
      client_credentials_location = EXCLUDED.client_credentials_location,
      is_enabled = EXCLUDED.is_enabled,
      configuration_metadata = EXCLUDED.configuration_metadata,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Trigger on oauth_providers view is handled by INSTEAD OF trigger
-- No additional trigger needed here since oauth_providers is a view, not a table

-- Step 15: Log migration completion
INSERT INTO migration_fallback_logs (
  table_name,
  operation_type,
  query_info
) VALUES (
  'service_providers',
  'MIGRATION_PHASE_1_COMPLETE',
  jsonb_build_object(
    'phase', 'foundation_setup',
    'timestamp', now(),
    'tables_created', array['service_providers', 'migration_fallback_logs'],
    'functions_created', array['log_oauth_providers_fallback', 'get_migration_fallback_stats', 'check_service_providers_consistency', 'sync_oauth_to_service_providers'],
    'triggers_created', array['sync_oauth_providers_to_service'],
    'view_created', 'oauth_providers_fallback (monitoring view)'
  )
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ SERVICE PROVIDERS MIGRATION FOUNDATION COMPLETE';
  RAISE NOTICE '📊 Tables: service_providers created and populated';
  RAISE NOTICE '🔄 Sync: oauth_providers changes sync to service_providers';
  RAISE NOTICE '📈 Monitoring: Use get_migration_fallback_stats() to track usage';
  RAISE NOTICE '🔍 Validation: Use check_service_providers_consistency() to verify data';
  RAISE NOTICE '⚠️  Next: Begin updating code files to use service_providers table';
END $$;
