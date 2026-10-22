# Tool Availability Cascade System

**Date:** January 25, 2025  
**Purpose:** Document the proper cascade relationship between integrations, credentials, agent permissions, and tool availability  
**Status:** ✅ IMPLEMENTED  

## Overview

The tool availability system follows a strict cascade relationship where each level depends on the previous level. When any level is removed or revoked, all dependent levels are automatically cleaned up.

## Cascade Flow Diagram

```
1. INTEGRATION CATALOG
   ↓ (enabled/available)
2. USER CREDENTIALS  
   ↓ (valid/active)
3. AGENT PERMISSIONS
   ↓ (granted/active)  
4. TOOL AVAILABILITY
```

## Detailed Cascade Relationships

### Level 1: Integration Catalog (`oauth_providers`)
- **Source:** Tool/integration definitions in the system
- **Examples:** Gmail, SMTP, Mailgun, Web Search APIs, GetZep
- **When removed:** All user credentials and agent permissions cascade delete

### Level 2: User Credentials (`user_integration_credentials`)  
- **Source:** User-provided API keys, OAuth tokens stored in Supabase Vault
- **Status:** `active`, `expired`, `revoked`, `disconnected`
- **When revoked/deleted:** All agent permissions for this credential cascade delete
- **Foreign Key:** `oauth_provider_id → oauth_providers(id) ON DELETE CASCADE`

### Level 3: Agent Permissions (`agent_oauth_permissions`)
- **Source:** User grants specific credentials to specific agents
- **Status:** `is_active` boolean, granted/revoked timestamps  
- **When agent deleted:** All permissions for that agent cascade delete
- **When credential deleted:** All permissions for that credential cascade delete
- **Foreign Keys:**
  - `agent_id → agents(id) ON DELETE CASCADE`
  - `user_oauth_connection_id → user_integration_credentials(id) ON DELETE CASCADE`

### Level 4: Tool Availability (Runtime)
- **Source:** Computed dynamically based on active permissions
- **Examples:** Gmail tools in chat, SMTP send_email capability, Web search functions
- **Availability Logic:** `credential.status = 'active' AND permission.is_active = true`

## Database Schema Implementation

### Foreign Key Constraints with CASCADE
```sql
-- Agent permissions cascade when agent is deleted
ALTER TABLE agent_oauth_permissions 
ADD CONSTRAINT agent_oauth_permissions_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- Agent permissions cascade when credential is deleted  
ALTER TABLE agent_oauth_permissions 
ADD CONSTRAINT agent_integration_permissions_connection_id_fkey 
FOREIGN KEY (user_oauth_connection_id) REFERENCES user_integration_credentials(id) ON DELETE CASCADE;
```

### Cascade Triggers
```sql
-- Trigger when credentials are revoked
CREATE TRIGGER credential_revocation_cascade_trigger
    AFTER UPDATE ON user_integration_credentials
    FOR EACH ROW
    EXECUTE FUNCTION handle_credential_revocation_cascade();
```

## Tool Availability Logic

### Runtime Tool Discovery
1. **Agent requests tools** (via chat context or function calling)
2. **System queries active permissions:**
   ```sql
   SELECT DISTINCT op.name as provider
   FROM agent_oauth_permissions aop
   JOIN user_integration_credentials uic ON aop.user_oauth_connection_id = uic.id  
   JOIN oauth_providers op ON uic.oauth_provider_id = op.id
   WHERE aop.agent_id = $agent_id 
     AND aop.is_active = true
     AND uic.connection_status = 'active'
   ```
3. **Tools are filtered by available credentials**
4. **Only permitted tools are exposed to agent**

### Example: Gmail Tool Availability
```typescript
// In GmailMCPToolsService.listTools()
const { data: permissions } = await supabase
  .from('agent_oauth_permissions')
  .select(`
    allowed_scopes,
    is_active,
    user_integration_credentials(
      oauth_provider_id,
      oauth_providers(name)
    )
  `)
  .eq('agent_id', agentId)
  .eq('user_integration_credentials.user_id', userId)
  .eq('is_active', true);

// Filter for Gmail provider  
const gmailPermissions = permissions.filter(p => 
  p.user_integration_credentials?.oauth_providers?.name === 'gmail'
);

// Return empty array if no valid permissions
if (!gmailPermissions.length) return [];
```

## Cascade Scenarios

### Scenario 1: User Revokes Gmail Credentials
**Trigger:** User clicks "Disconnect" on Gmail integration  

**Cascade Flow:**
1. `user_integration_credentials.connection_status` → `'revoked'`
2. `credential_revocation_cascade_trigger` fires
3. All `agent_oauth_permissions` with `user_oauth_connection_id` CASCADE DELETE
4. Gmail tools disappear from all agents immediately
5. Any active chat sessions lose Gmail functionality

### Scenario 2: Agent is Deleted  
**Trigger:** User deletes an agent

**Cascade Flow:**
1. `agents` record deleted
2. All `agent_oauth_permissions` with `agent_id` CASCADE DELETE  
3. No tool availability impact for other agents
4. Deleted agent's chat history retains tool call records

### Scenario 3: Integration Removed from Catalog
**Trigger:** System admin removes an integration type

**Cascade Flow:**
1. `oauth_providers` record deleted
2. All `user_integration_credentials` with `oauth_provider_id` CASCADE DELETE
3. All related `agent_oauth_permissions` CASCADE DELETE (via credential deletion)
4. All users lose access to that integration type
5. All agents lose related tools immediately

## UI Modal Synchronization

### Available Tools Modal
- **Shows:** All integrations from `oauth_providers` catalog
- **Filtering:** None (all available integrations shown)
- **Action:** "Set up integration" → credential setup flow

### Connected Tools Modal  
- **Shows:** Agent-specific tool permissions
- **Query:** 
  ```sql
  SELECT * FROM agent_oauth_permissions aop
  JOIN user_integration_credentials uic ON aop.user_oauth_connection_id = uic.id
  WHERE aop.agent_id = $agent_id AND aop.is_active = true
  ```
- **Action:** "Revoke access" → DELETE permission record

### Credentials Page
- **Shows:** User's stored credentials across all integrations  
- **Query:**
  ```sql  
  SELECT * FROM user_integration_credentials 
  WHERE user_id = $user_id
  ```
- **Action:** "Delete credential" → CASCADE to remove all agent permissions

## Testing the Cascade System

### Verification Function
```sql
-- Check tool availability for a specific agent
SELECT * FROM verify_agent_tool_availability('agent-uuid', 'user-uuid');
```

### Test Scenarios
1. **Credential Revocation Test:**
   - Grant Gmail access to agent
   - Verify tools appear in chat
   - Revoke Gmail credential  
   - Verify tools disappear from chat

2. **Agent Deletion Test:**
   - Create agent with multiple tool permissions
   - Delete agent
   - Verify permissions are cleaned up
   - Verify other agents unaffected

3. **Integration Removal Test:**
   - Set up SMTP integration  
   - Grant to multiple agents
   - Remove SMTP from catalog
   - Verify all related data cascades

## Maintenance Functions

### Cleanup Orphaned Permissions
```sql
-- Run periodically to clean up any orphaned permissions
SELECT cleanup_orphaned_permissions();
```

### Audit Tool Availability
```sql
-- Get complete tool availability report
SELECT agent_id, integration_name, tool_available, credential_status 
FROM verify_agent_tool_availability(agent_id, user_id);
```

## Migration Impact

The CASCADE relationships migration (`20250125000032_fix_cascade_relationships.sql`) ensures:

✅ **Proper Foreign Keys:** All relationships have CASCADE DELETE constraints  
✅ **Automatic Cleanup:** Revoked credentials automatically remove agent permissions  
✅ **Consistent State:** No orphaned permissions or disconnected tool availability  
✅ **Real-time Updates:** Tool availability reflects credential status immediately  

## Security Considerations

1. **Credential Revocation:** Immediately removes tool access across all agents
2. **Agent Isolation:** Agent deletion doesn't affect user credentials
3. **Vault Integration:** Deleted credentials remove encrypted secrets from vault  
4. **Permission Audit:** All cascade operations are logged for compliance

---

**Next Steps:** Test the complete cascade system with real credential revocation scenarios to ensure UI and runtime tool availability sync properly.
