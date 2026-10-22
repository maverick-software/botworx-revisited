# Database Schema Analysis - Discord Components

## Executive Summary
The Discord integration in Agentopia involves one dedicated table (`agent_discord_connections`) and five Discord-related columns in the `agents` table. The schema analysis reveals complex relationships that require careful handling during removal.

## Primary Discord Table: agent_discord_connections

### Table Structure
```sql
CREATE TABLE IF NOT EXISTS "public"."agent_discord_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "guild_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discord_app_id" "text" NOT NULL,
    "inactivity_timeout_minutes" integer DEFAULT 10,
    "worker_status" "text" DEFAULT 'inactive'::"text",
    "discord_public_key" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL
);
```

### Key Relationships
- **Primary Key**: `id` (UUID)
- **Foreign Key**: `agent_id` → `agents.id` (CASCADE DELETE)
- **Unique Constraint**: `agent_discord_connections_agent_id_unique` (One connection per agent)

### Indexes
- `idx_agent_discord_connections_agent_id` - For efficient agent lookups
- `idx_agent_discord_connections_guild_id` - For Discord guild operations

### Row Level Security (RLS)
- **Policy**: "Allow full access to connections for own agents"
- **Function**: Uses `is_agent_owner(agent_id)` function
- **Scope**: SELECT, INSERT, UPDATE, DELETE for authenticated users

### Permissions
- `anon`: ALL
- `authenticated`: ALL  
- `service_role`: ALL

## Discord Columns in agents Table

### Column Definitions
```sql
-- In agents table:
"discord_channel" "text",
"discord_bot_key" "text",
"discord_bot_token_encrypted" "text",
"discord_user_id" "text", 
"discord_bot_token_id" "text",
```

### Column Analysis
1. **discord_channel** - Text field for Discord channel reference
2. **discord_bot_key** - Likely unencrypted bot key reference
3. **discord_bot_token_encrypted** - Encrypted Discord bot token
4. **discord_user_id** - Discord user ID associated with the bot
5. **discord_bot_token_id** - Reference ID for the bot token

### Special Note
- `discord_bot_token_encrypted` has explicit comment: 'Stores the Discord bot token, encrypted server-side.'

## Database Dependencies Analysis

### Functions Referencing Discord Tables
Based on grep analysis, the following database functions reference `agent_discord_connections`:

1. **`update_worker_status`** - Updates worker status for connections
   - Parameters: `connection_id_in` (uuid), `new_status_in` (text)
   - Direct dependency on `agent_discord_connections`

### Views or Materialized Views
- No Discord-specific views identified in current schema

### Triggers
- No Discord-specific triggers identified
- Standard `updated_at` triggers may apply to modified tables

## Edge Function Database Usage

### Functions with Direct Table Access
1. **discord-connect** - Bot token validation queries
2. **discord-disconnect** - Connection cleanup operations
3. **discord-get-bot-guilds** - Guild information queries
4. **discord-interaction-handler** - Connection status updates
5. **get-enabled-guilds** - Guild enablement queries
6. **manage-discord-worker** - Worker status management
7. **update-enabled-guilds** - Guild configuration updates
8. **admin-* functions** - Dashboard and management queries

### Query Patterns Identified
- SELECT operations for connection retrieval
- UPDATE operations for status changes
- DELETE operations for cleanup
- INSERT operations for new connections

## Removal Strategy - Database Components

### Phase 1: Data Export (Before Removal)
```sql
-- Export existing Discord data for backup
SELECT * FROM agent_discord_connections;
SELECT id, discord_channel, discord_bot_key, discord_user_id, discord_bot_token_id 
FROM agents 
WHERE discord_channel IS NOT NULL 
   OR discord_bot_key IS NOT NULL 
   OR discord_user_id IS NOT NULL;
```

### Phase 2: Constraint and Index Removal
```sql
-- Remove foreign key constraint
ALTER TABLE agent_discord_connections 
DROP CONSTRAINT agent_discord_connections_agent_id_fkey;

-- Remove unique constraint  
ALTER TABLE agent_discord_connections 
DROP CONSTRAINT agent_discord_connections_agent_id_unique;

-- Remove indexes
DROP INDEX idx_agent_discord_connections_agent_id;
DROP INDEX idx_agent_discord_connections_guild_id;
```

### Phase 3: RLS Policy Removal
```sql
-- Remove RLS policy
DROP POLICY "Allow full access to connections for own agents" 
ON agent_discord_connections;

-- Disable RLS
ALTER TABLE agent_discord_connections DISABLE ROW LEVEL SECURITY;
```

### Phase 4: Table Removal
```sql
-- Drop the entire table
DROP TABLE IF EXISTS agent_discord_connections CASCADE;
```

### Phase 5: Column Removal from agents Table
```sql
-- Remove Discord columns from agents table
ALTER TABLE agents DROP COLUMN IF EXISTS discord_channel;
ALTER TABLE agents DROP COLUMN IF EXISTS discord_bot_key; 
ALTER TABLE agents DROP COLUMN IF EXISTS discord_bot_token_encrypted;
ALTER TABLE agents DROP COLUMN IF EXISTS discord_user_id;
ALTER TABLE agents DROP COLUMN IF EXISTS discord_bot_token_id;
```

### Phase 6: Function Cleanup
```sql
-- Remove Discord-specific function if it becomes unused
DROP FUNCTION IF EXISTS update_worker_status(uuid, text);
```

## Risk Assessment

### High Risk Operations
1. **Foreign Key Cascade**: agent_discord_connections has CASCADE DELETE
   - Risk: Potential data loss if not handled properly
   - Mitigation: Export data first, verify no orphaned records

2. **RLS Policy Dependencies**: Other functions may reference `is_agent_owner`
   - Risk: Breaking other parts of the system
   - Mitigation: Check all functions using `is_agent_owner` before policy removal

3. **Column Removal in agents Table**: Widely used table
   - Risk: Breaking application code that references these columns
   - Mitigation: Update all application code first

### Medium Risk Operations
1. **Index Removal**: Performance implications during transition
2. **Function Removal**: May be referenced by other functions
3. **Permission Changes**: Service accounts may depend on these permissions

### Low Risk Operations
1. **Comment Removal**: Documentation cleanup
2. **Data Export**: Read-only operation

## Migration Script Planning

### Script Structure
1. **Pre-migration validation**
   - Check for active Discord connections
   - Verify Edge Functions are disabled
   - Export existing data

2. **Progressive removal**
   - Start with constraints and indexes
   - Remove policies and security
   - Drop table and columns
   - Clean up functions

3. **Post-migration validation**
   - Check for orphaned references
   - Verify application still builds
   - Confirm no broken foreign keys

### Rollback Considerations
- **Table Recreation**: Would require full schema definition
- **Data Restoration**: Would need exported data
- **Constraint Recreation**: Complex foreign key relationships
- **RLS Policy Recreation**: Exact policy syntax needed

## Verification Queries

### Pre-Removal Data Check
```sql
-- Count existing Discord connections
SELECT COUNT(*) FROM agent_discord_connections;

-- Check agents with Discord data
SELECT COUNT(*) FROM agents 
WHERE discord_channel IS NOT NULL 
   OR discord_bot_key IS NOT NULL;
```

### Post-Removal Verification
```sql
-- Verify table removal
SELECT * FROM information_schema.tables 
WHERE table_name = 'agent_discord_connections';

-- Verify column removal
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'agents' 
  AND column_name LIKE 'discord%';
```

## Next Steps
1. Create detailed migration scripts
2. Test migration in development environment
3. Plan Edge Function coordination
4. Design rollback procedures
5. Schedule maintenance window for production

---

**Dependencies**: This analysis depends on current schema in temp_restore.sql
**Impact**: Database schema changes affect all Edge Functions and frontend components
**Critical Path**: Must disable Edge Functions before schema changes 