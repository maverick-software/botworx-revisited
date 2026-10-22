### State Management

### What it is
Durable agent/user/session state with checkpoints, transitions, and real-time sync.

### Purpose
- Persist important variables and progress
- Enable rollback via checkpoints
- Coordinate concurrent access with locks

### How it’s integrated
- `StateManager` provides APIs used by the processor/handlers
- Persistence component writes to DB and caches
- Synchronizer emits events for listeners

### How to interact
- Use `StateManager` to read/write state per `agent_id`/session
- Control via V2 `options.state.*` (e.g., `save_checkpoint`, `include_shared`)

### How to extend
- Add new tables/columns for additional state domains
- Add policies and RLS updates for multi-tenant access
- Implement custom sync transports in `state_synchronizer.ts`

### Troubleshooting
- RLS failures → ensure policies reference `agents.user_id`, not `created_by`
- Index errors → confirm index columns (`started_at` vs `created_at`)

### Files & Edge Functions
- `supabase/functions/chat/core/state/state_manager.ts`
- `supabase/functions/chat/core/state/state_persistence.ts`
- `supabase/functions/chat/core/state/state_synchronizer.ts`
- `supabase/functions/chat/core/state/state_versioning.ts`
- DB migrations: `supabase/migrations/*state*`
- Edge entry: `supabase/functions/chat/index.ts`
