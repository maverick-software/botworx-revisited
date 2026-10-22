-- Drop memory_consolidations table
-- Date: October 13, 2025
-- Reason: Table exists but is never written to - consolidation logic writes directly to agent_memories

-- Investigation findings:
-- 1. Table was created in advanced_json_chat_schema migration
-- 2. Memory consolidation code exists and runs
-- 3. BUT: The consolidation function consolidate_low_importance_memories() writes consolidated
--    memories back into agent_memories table, not into memory_consolidations
-- 4. Result: memory_consolidations table is empty and unused - just a tracking table that was
--    planned but never implemented
--
-- The consolidation process:
-- - Groups low-importance memories from agent_memories
-- - Creates new consolidated entries
-- - Writes them back to agent_memories
-- - Deletes original memories
-- - Never touches memory_consolidations table

DROP TABLE IF EXISTS public.memory_consolidations CASCADE;

-- Migration note:
-- If consolidation tracking is needed in future, can implement with actual logging
-- Current consolidation works fine without this tracking table

