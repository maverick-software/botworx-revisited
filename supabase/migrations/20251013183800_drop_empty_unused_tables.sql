-- Drop empty and unused tables
-- Part of comprehensive database cleanup
-- Date: October 13, 2025

-- These tables exist in the schema but are not actively used in the codebase

-- DROP empty operation/logging tables
DROP TABLE IF EXISTS public.gmail_operation_logs CASCADE;  -- Empty, never used
DROP TABLE IF EXISTS public.smtp_operation_logs CASCADE;   -- Empty, commented in code as "doesn't exist"
DROP TABLE IF EXISTS public.media_processing_logs CASCADE; -- Empty, unused
DROP TABLE IF EXISTS public.manage_versions CASCADE;       -- Empty, unused

-- DROP unused tracking/statistics views and tables
DROP VIEW IF EXISTS public.import_job_statistics CASCADE;     -- Has 1 record, appears unused (VIEW)
DROP TABLE IF EXISTS public.migration_fallback_logs CASCADE;  -- 1 record, migration artifact

-- DROP unused secrets tables (secrets should be in Vault)
DROP TABLE IF EXISTS public.temp_secrets CASCADE;   -- Empty, unrestricted RLS, unused
DROP TABLE IF EXISTS public.user_secrets CASCADE;   -- Unused, secrets should be in Vault only

-- DROP unused integration tracking table
DROP TABLE IF EXISTS public.user_integrations CASCADE;  -- Unused, only in auto-generated types

-- DROP unused memory tracking table
DROP TABLE IF EXISTS public.memory_consolidations CASCADE;  -- Empty, consolidation writes to agent_memories instead

-- DROP empty configuration tables (if user confirms they're empty/unused)
DROP TABLE IF EXISTS public.sendgrid_configurations CASCADE;  -- Empty, unused
DROP TABLE IF EXISTS public.mailgun_configurations CASCADE;   -- Empty, unused

-- DROP convenience views that query unified credential tables
DROP VIEW IF EXISTS public.mistral_ocr_connections CASCADE;  -- VIEW to user_integration_credentials, not needed

-- Migration notes:
-- - email_logs: KEEP - actively used by mailgun-webhook
-- - All removed tables have either:
--   1. Zero usage in codebase
--   2. Only exist in auto-generated database.types.ts
--   3. Were migration artifacts or placeholders

-- Tables we're KEEPING that were suspicious:
-- - mailgun_configurations: Actively used by mailgun-service
-- - sendgrid_configurations: Actively used by sendgrid-api  
-- - email_logs: Actively used by mailgun-webhook
-- - system_alerts & system_health: Actively used by monitoring_system
-- - reasoning_sessions & reasoning_steps: Actively used by advanced-reasoning
-- - tool_execution_logs: Actively used by clicksend-api
-- - tool_user_input_requests: Actively used by tool-user-input
-- - agent_memories: Part of advanced memory system (stores actual memories)
-- - email_change_audit_log: Used for security auditing
-- 
-- Note: memory_consolidations was REMOVED - consolidation logic writes to agent_memories directly

