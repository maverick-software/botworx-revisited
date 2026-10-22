-- Rollback State Management Schema
-- Removes all state management tables, functions, and types

-- Drop functions
DROP FUNCTION IF EXISTS get_current_state(UUID);
DROP FUNCTION IF EXISTS create_state_checkpoint(UUID, TEXT, checkpoint_type_enum, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS restore_state_checkpoint(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS cleanup_expired_states();
DROP FUNCTION IF EXISTS get_state_statistics(UUID);

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS state_sync_events;
DROP TABLE IF EXISTS state_locks;
DROP TABLE IF EXISTS state_transitions;
DROP TABLE IF EXISTS state_checkpoints;
DROP TABLE IF EXISTS conversation_sessions;
DROP TABLE IF EXISTS agent_states;

-- Drop types
DROP TYPE IF EXISTS lock_type_enum;
DROP TYPE IF EXISTS checkpoint_type_enum;
DROP TYPE IF EXISTS state_type_enum;