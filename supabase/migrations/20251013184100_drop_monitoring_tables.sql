-- Drop unused monitoring system tables
-- Date: October 13, 2025
-- Reason: Monitoring system exists in code but is not actively running - tables are empty

-- Investigation findings:
-- 1. system_health: Only used for SELECT query (health check test), never written to
-- 2. system_alerts: Has INSERT code but table is empty - monitoring system not running
-- 3. Code exists in chat/core/monitoring/monitoring_system.ts but monitoring is not active
-- 4. Tables are placeholders for a monitoring system that was planned but not deployed

DROP TABLE IF EXISTS public.system_health CASCADE;
DROP TABLE IF EXISTS public.system_alerts CASCADE;

-- Migration note:
-- If system monitoring is implemented in future, these tables can be recreated
-- Current monitoring code is present but not actively executing/writing data

