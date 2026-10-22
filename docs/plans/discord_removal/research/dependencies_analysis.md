# Dependencies Analysis - Discord Components (DATABASE PROTECTION PRIORITY)

## 🛡️ CRITICAL DATABASE PROTECTION SUMMARY

**DANGER ZONES IDENTIFIED:**
- 🚨 **10 Supabase Edge Functions** directly query `agent_discord_connections`
- 🚨 **8 Edge Functions** directly access Discord columns in `agents` table
- 🚨 **CASCADE DELETE** constraint could trigger unexpected data loss
- 🚨 **RLS Policies** protect Discord data - removal affects security

## Database Table Dependencies

### agent_discord_connections Table References

#### **🔴 HIGH-RISK Edge Functions (Direct Table Access):**
1. **`update-enabled-guilds/index.ts`** (Lines 75, 90, 108)
   - SELECT, UPDATE, INSERT operations
   - Guild management functionality
   - **Risk**: Function will break completely

2. **`manage-discord-worker/index.ts`** (Lines 108, 193, 205) 
   - Worker lifecycle management
   - Status tracking operations
   - **Risk**: Worker management system failure

3. **`discord-interaction-handler/index.ts`** (Lines 119, 208, 291, 318)
   - Core Discord interaction processing
   - Status updates and error handling
   - **Risk**: All Discord interactions will fail

4. **`discord-disconnect/index.ts`** (Lines 55, 57)
   - Connection cleanup operations
   - **Risk**: Cleanup functions will fail

5. **`get-enabled-guilds/index.ts`** (Line 41)
   - Guild status queries
   - **Risk**: Status checking will break

6. **`discord-webhook/index.ts`** (Line 43)
   - Webhook processing
   - **Risk**: Webhook handling will fail

7. **`admin-get-dashboard-stats/index.ts`** (Line 97)
   - Administrative statistics
   - **Risk**: Admin dashboard corruption

8. **`admin-get-agents/index.ts`** (Line 109)
   - Agent management queries
   - **Risk**: Admin agent views will break

9. **`admin-force-stop-worker/index.ts`** (Line 59)
   - Emergency worker shutdown
   - **Risk**: Admin controls will fail

#### **🟡 MEDIUM-RISK External Service References:**
10. **`services/discord-worker/src/worker.ts`** (Line 163)
    - Direct table name reference: `tableName = 'agent_discord_connections'`
    - **Risk**: Service will crash on startup

11. **`discord-gateway-client/index.js`** (Line 42)
    - TODO comment about querying the table
    - **Risk**: Low - commented code

## Discord Columns in agents Table Dependencies

### **🔴 CRITICAL Column References (discord_bot_key, discord_bot_token_*, etc.):**

#### **Edge Functions with Direct Column Access:**
1. **`register-agent-commands/index.ts`**
   - Lines 64, 75, 91: Reads `discord_app_id, discord_bot_key`
   - **Risk**: Command registration will fail

2. **`manage-discord-worker/index.ts`**
   - Lines 79, 96, 97, 151: Reads `discord_bot_key` for worker management
   - **Risk**: Worker startup will fail

3. **`securely-update-discord-token/index.ts`**
   - Lines 38, 39, 42, 60: Updates `discord_bot_key`
   - **Risk**: Token update functions will crash

4. **`update-agent-discord-token/index.ts`**
   - Line 81: Updates `discord_bot_key`
   - **Risk**: Legacy token update will fail

5. **`get-discord-agent-tokens/index.ts`**
   - Lines 9, 78, 82, 83, 95: Extensive `discord_bot_key` usage
   - **Risk**: Token retrieval system failure

6. **`discord-webhook/index.ts`**
   - Line 102: Uses `discord_bot_key` for authorization
   - **Risk**: Webhook authentication will fail

7. **`discord-interaction-handler/index.ts`**
   - Lines 217, 242: Reads `discord_bot_key`
   - **Risk**: All Discord interactions will fail

8. **`discord-get-guild-channels/index.ts`**
   - Lines 36, 40, 46: Reads `discord_bot_key`
   - **Risk**: Guild channel queries will fail

9. **`discord-get-bot-guilds/index.ts`**
   - Lines 44, 49, 50, 58: Reads `discord_bot_key`
   - **Risk**: Bot guild discovery will fail

10. **`discord-disconnect/index.ts`**
    - Lines 43, 46: Sets `discord_bot_key` to NULL
    - **Risk**: Disconnect cleanup will fail

11. **`discord-connect/index.ts`**
    - Line 77: Updates `discord_bot_key`
    - **Risk**: Connection establishment will fail

## Type System Dependencies

### **🟡 TypeScript Interface Dependencies:**
1. **`supabase/functions/_shared/database.types.ts`**
   - Lines 47, 83: `agent_discord_connections` type definitions
   - Lines 231-235, 248-252, 265-269: Discord column types in agents
   - **Risk**: Compilation failures across all TypeScript code

2. **`src/types/index.ts`**
   - Line 5: Exports `AgentDiscordConnection` type
   - **Risk**: Frontend compilation will break

3. **`src/types/database.types.ts` and `src/types/database.types.tscd`**
   - Multiple references to Discord types
   - **Risk**: Type safety violations

## Frontend Dependencies 

### **🟡 React Hook Dependencies:**
1. **`src/hooks/useAgentDiscordConnection.ts`**
   - Lines 59, 65, 142: Direct database queries
   - **Risk**: React hooks will throw runtime errors

2. **`src/hooks/useAgentDiscordConnection_refactored.ts`**
   - Lines 61, 67, 142: Database operations
   - **Risk**: Refactored hooks will fail

## 🛡️ DATABASE PROTECTION STRATEGY

### **Phase 1: COMPLETE DATA BACKUP (MANDATORY)**
```sql
-- 1. Full database backup before ANY changes
-- Export Discord-related data to multiple formats for safety

-- Complete table backup
CREATE TABLE agent_discord_connections_backup_discord_removal AS 
SELECT * FROM agent_discord_connections;

-- Agents table Discord columns backup
CREATE TABLE agents_discord_columns_backup AS
SELECT id, user_id, name, discord_channel, discord_bot_key, 
       discord_bot_token_encrypted, discord_user_id, discord_bot_token_id
FROM agents 
WHERE discord_channel IS NOT NULL 
   OR discord_bot_key IS NOT NULL 
   OR discord_bot_token_encrypted IS NOT NULL
   OR discord_user_id IS NOT NULL
   OR discord_bot_token_id IS NOT NULL;

-- CSV export for additional safety
COPY agent_discord_connections TO '/tmp/agent_discord_connections_backup.csv' WITH CSV HEADER;
COPY (SELECT * FROM agents_discord_columns_backup) TO '/tmp/agents_discord_backup.csv' WITH CSV HEADER;
```

### **Phase 2: STAGED SAFETY SHUTDOWNS**
1. **Disable Edge Functions FIRST** (prevent new operations)
2. **Stop External Services** (discord-worker, gateway-client)
3. **Create rollback scripts** (before any schema changes)
4. **Verify no active connections** (check for running Discord bots)

### **Phase 3: DATABASE SAFETY CHECKS**
```sql
-- Pre-removal validation queries
SELECT COUNT(*) as active_connections FROM agent_discord_connections WHERE worker_status = 'active';
SELECT COUNT(*) as agents_with_discord FROM agents WHERE discord_bot_key IS NOT NULL;

-- Check for any running processes that might be using the data
SELECT * FROM pg_stat_activity WHERE query LIKE '%agent_discord_connections%';
```

## 🔄 ROLLBACK STRATEGY (DATABASE PROTECTION)

### **Complete Rollback Script Template:**
```sql
-- EMERGENCY ROLLBACK - Restore Discord functionality
BEGIN;

-- 1. Recreate agent_discord_connections table
CREATE TABLE agent_discord_connections (/* full schema */);

-- 2. Restore data from backup
INSERT INTO agent_discord_connections SELECT * FROM agent_discord_connections_backup_discord_removal;

-- 3. Recreate all constraints and indexes
-- (Full constraint recreation commands)

-- 4. Restore agents table columns
ALTER TABLE agents ADD COLUMN discord_channel text;
ALTER TABLE agents ADD COLUMN discord_bot_key text;
-- (Continue for all columns)

-- 5. Restore column data
UPDATE agents SET 
  discord_channel = backup.discord_channel,
  discord_bot_key = backup.discord_bot_key
  -- (Continue for all columns)
FROM agents_discord_columns_backup backup 
WHERE agents.id = backup.id;

-- 6. Recreate RLS policies
-- (Full policy recreation)

COMMIT;
```

## 🚨 CRITICAL SAFETY REQUIREMENTS

### **BEFORE ANY DATABASE CHANGES:**
1. ✅ **Export all Discord data to files** 
2. ✅ **Create rollback scripts**
3. ✅ **Disable all Edge Functions**
4. ✅ **Stop external services**
5. ✅ **Verify no active Discord bots**
6. ✅ **Test rollback in development**

### **DURING REMOVAL:**
1. ✅ **Progressive removal with checkpoints**
2. ✅ **Verify each step before proceeding**
3. ✅ **Monitor for errors after each change**
4. ✅ **Keep rollback scripts ready**

### **AFTER REMOVAL:**
1. ✅ **Verify application still functions**
2. ✅ **Test all non-Discord features**
3. ✅ **Archive backups safely**
4. ✅ **Document completed removal**

## ⚠️ HIGH-RISK REMOVAL ORDER

**MANDATORY ORDER (Database Protection):**
1. **Frontend Components** (prevent new Discord operations)
2. **Edge Functions** (disable backend processing)  
3. **External Services** (shutdown workers/gateway)
4. **Database Schema** (only after everything else is disabled)

## Next Steps - Database Protection Focus

1. **Create comprehensive backup scripts**
2. **Build rollback automation**
3. **Test removal in isolated development environment**
4. **Create Edge Function disable procedures**
5. **Design external service shutdown sequence**

---

**🛡️ DATABASE PROTECTION PRINCIPLE**: No database changes until ALL dependent code is safely disabled
**🔄 ROLLBACK READY**: Every change must be immediately reversible
**📊 VALIDATION**: Every step must be verified before proceeding 