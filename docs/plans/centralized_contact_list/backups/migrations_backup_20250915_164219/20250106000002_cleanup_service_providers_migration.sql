-- =====================================================
-- SERVICE PROVIDERS MIGRATION - PHASE 5: CLEANUP
-- =====================================================
-- This migration removes the fallback infrastructure after successful migration
-- ⚠️ ONLY RUN AFTER ALL CODE HAS BEEN UPDATED TO USE service_providers

-- Step 1: Verify zero fallback usage in last 24 hours
DO $$
DECLARE
  fallback_count integer;
BEGIN
  SELECT COUNT(*) INTO fallback_count
  FROM migration_fallback_logs 
  WHERE created_at >= now() - interval '24 hours'
    AND table_name = 'oauth_providers';
  
  IF fallback_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORT: % fallback usages detected in last 24 hours. Migration not complete.', fallback_count;
  END IF;
  
  RAISE NOTICE '✅ Zero fallback usage detected - safe to proceed with cleanup';
END $$;

-- Step 2: Final data consistency check
DO $$
DECLARE
  consistency_results RECORD;
  has_issues boolean := false;
BEGIN
  FOR consistency_results IN 
    SELECT * FROM check_service_providers_consistency()
  LOOP
    IF consistency_results.status != 'OK' THEN
      has_issues := true;
    END IF;
    
    RAISE NOTICE 'Final Consistency Check - %: % - %', 
      consistency_results.check_type,
      consistency_results.status,
      consistency_results.details;
  END LOOP;
  
  IF has_issues THEN
    RAISE EXCEPTION 'MIGRATION ABORT: Data consistency issues detected. Cannot proceed with cleanup.';
  END IF;
  
  RAISE NOTICE '✅ All consistency checks passed - safe to proceed';
END $$;

-- Step 3: Archive fallback logs before cleanup
CREATE TABLE migration_fallback_logs_archive AS 
SELECT 
  *,
  'oauth_providers_to_service_providers_migration'::text as migration_name,
  now() as archived_at
FROM migration_fallback_logs;

-- Add index to archive for future reference
CREATE INDEX IF NOT EXISTS idx_migration_archive_migration_table 
  ON migration_fallback_logs_archive(migration_name, table_name, created_at DESC);

-- Step 4: Log cleanup initiation
INSERT INTO migration_fallback_logs (
  table_name,
  operation_type,
  query_info
) VALUES (
  'oauth_providers',
  'MIGRATION_CLEANUP_START',
  jsonb_build_object(
    'phase', 'cleanup_initiation',
    'timestamp', now(),
    'archived_logs', (SELECT COUNT(*) FROM migration_fallback_logs_archive),
    'action', 'beginning_fallback_removal'
  )
);

-- Step 5: Remove sync trigger (oauth_providers -> service_providers)
DROP TRIGGER IF EXISTS sync_oauth_providers_to_service ON oauth_providers;
DROP FUNCTION IF EXISTS sync_oauth_to_service_providers();

-- Step 6: Remove fallback view and trigger
DROP TRIGGER IF EXISTS oauth_providers_fallback_trigger ON oauth_providers;
DROP VIEW IF EXISTS oauth_providers CASCADE;
DROP FUNCTION IF EXISTS log_oauth_providers_fallback();

-- Step 7: Update foreign key references to point to service_providers
-- This updates all tables that reference oauth_providers to reference service_providers instead

-- Update user_integration_credentials table
DO $$
BEGIN
  -- Check if the foreign key exists and update it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%oauth_provider_id%' 
    AND table_name = 'user_integration_credentials'
  ) THEN
    -- Drop the old foreign key constraint
    ALTER TABLE user_integration_credentials 
    DROP CONSTRAINT IF EXISTS user_integration_credentials_oauth_provider_id_fkey;
    
    -- Add new foreign key constraint to service_providers
    ALTER TABLE user_integration_credentials 
    ADD CONSTRAINT user_integration_credentials_service_provider_id_fkey 
    FOREIGN KEY (oauth_provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Updated user_integration_credentials foreign key to reference service_providers';
  END IF;
END $$;

-- Update agent_integration_permissions table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%oauth_provider_id%' 
    AND table_name = 'agent_integration_permissions'
  ) THEN
    ALTER TABLE agent_integration_permissions 
    DROP CONSTRAINT IF EXISTS agent_integration_permissions_oauth_provider_id_fkey;
    
    ALTER TABLE agent_integration_permissions 
    ADD CONSTRAINT agent_integration_permissions_service_provider_id_fkey 
    FOREIGN KEY (oauth_provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Updated agent_integration_permissions foreign key to reference service_providers';
  END IF;
END $$;

-- Update integration_capabilities table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%integration_id%' 
    AND table_name = 'integration_capabilities'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'integration_capabilities' 
      AND column_name = 'integration_id'
    )
  ) THEN
    -- Check if integration_capabilities.integration_id references oauth_providers
    IF EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
      WHERE kcu.table_name = 'integration_capabilities'
      AND kcu.column_name = 'integration_id'
      AND rc.unique_constraint_name LIKE '%oauth_providers%'
    ) THEN
      ALTER TABLE integration_capabilities 
      DROP CONSTRAINT IF EXISTS integration_capabilities_integration_id_fkey;
      
      ALTER TABLE integration_capabilities 
      ADD CONSTRAINT integration_capabilities_service_provider_id_fkey 
      FOREIGN KEY (integration_id) REFERENCES service_providers(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✅ Updated integration_capabilities foreign key to reference service_providers';
    END IF;
  END IF;
END $$;

-- Step 8: Drop the original oauth_providers table
-- ⚠️ This is the point of no return
DROP TABLE IF EXISTS oauth_providers CASCADE;

DO $$
BEGIN
    RAISE NOTICE '🗑️  Dropped oauth_providers table - migration is now irreversible';
END $$;

-- Step 9: Clean up migration infrastructure
DROP TABLE migration_fallback_logs;
DROP FUNCTION IF EXISTS get_migration_fallback_stats(integer);
DROP FUNCTION IF EXISTS check_service_providers_consistency();

-- Step 10: Create final migration completion log
INSERT INTO migration_fallback_logs_archive (
  table_name,
  operation_type,
  query_info,
  created_at,
  migration_name,
  archived_at
) VALUES (
  'service_providers',
  'MIGRATION_COMPLETE',
  jsonb_build_object(
    'phase', 'cleanup_complete',
    'timestamp', now(),
    'actions_completed', array[
      'removed_sync_triggers',
      'removed_fallback_view',
      'updated_foreign_keys',
      'dropped_oauth_providers_table',
      'cleaned_up_migration_infrastructure'
    ],
    'migration_success', true,
    'final_table', 'service_providers'
  ),
  now(),
  'oauth_providers_to_service_providers_migration',
  now()
);

-- Step 11: Final success message
DO $$
BEGIN
  RAISE NOTICE '🎉 SERVICE PROVIDERS MIGRATION COMPLETE!';
  RAISE NOTICE '✅ oauth_providers → service_providers migration successful';
  RAISE NOTICE '🗑️  Fallback infrastructure removed';
  RAISE NOTICE '📚 Migration logs archived in migration_fallback_logs_archive';
  RAISE NOTICE '⚠️  Migration is now irreversible - oauth_providers table dropped';
  RAISE NOTICE '🚀 System now fully using service_providers table';
END $$;
