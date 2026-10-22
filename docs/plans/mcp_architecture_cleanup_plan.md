# 🏗️ MCP Architecture Cleanup & Edge Function Implementation Plan

## **Phase 1: Fix Current Broken Implementation (URGENT)**

### **Problem**: Tool definitions don't exist in database
- `oauth_providers` table has NO `tool_definitions` column
- Current `FunctionCallingManager` tries to access non-existent field
- Tools must be mapped from provider name + scopes, not database

### **Solution**: Create provider-specific tool mappings
```typescript
// New approach: Map provider + scopes to tool definitions
const PROVIDER_TOOL_MAPPINGS = {
  gmail: {
    'https://www.googleapis.com/auth/gmail.readonly': ['gmail_read_emails', 'gmail_search_emails'],
    'https://www.googleapis.com/auth/gmail.send': ['gmail_send_email'],
    'https://www.googleapis.com/auth/gmail.modify': ['gmail_email_actions']
  },
  serper_api: {
    'web_search': ['web_search'],
    'news_search': ['news_search'], 
    'image_search': ['image_search'],
    'local_search': ['local_search']
  },
  smtp: {
    'send_email': ['smtp_send_email'],
    'email_templates': ['smtp_email_templates'],
    'email_stats': ['smtp_email_stats']
  }
};
```

---

## **Phase 2: Create Proper Edge Function**

### **Database Schema (Current Reality)**
```sql
-- EXISTING TABLES (verified)
agent_integration_permissions (
  agent_id -> agents(id),
  user_oauth_connection_id -> user_integration_credentials(id),
  allowed_scopes JSONB,
  permission_level,
  is_active
)

user_integration_credentials (
  user_id,
  oauth_provider_id -> oauth_providers(id),
  connection_name,
  connection_status
)

oauth_providers (
  name,           -- 'gmail', 'serper_api', 'smtp'
  display_name,   -- 'Gmail', 'Serper API', 'SMTP Server'
  -- NO tool_definitions column!
)
```

### **Edge Function Query**
```sql
-- Single query to get all authorized tools
SELECT 
  aip.agent_id,
  aip.allowed_scopes,
  uic.connection_name,
  op.name as provider_name,
  op.display_name
FROM agent_integration_permissions aip
JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id  
JOIN oauth_providers op ON uic.oauth_provider_id = op.id
WHERE aip.agent_id = $1 
  AND uic.user_id = $2
  AND aip.is_active = true
  AND uic.connection_status = 'active';
```

---

## **Phase 3: Database Cleanup & Renaming**

### **Tables to Remove** ❌
```sql
-- Remove deprecated tables
DROP TABLE user_oauth_connections;           -- Deprecated, replaced by user_integration_credentials
DROP TABLE tool_catalog;                     -- Not used in MCP architecture  
DROP TABLE agent_tool_capability_permissions; -- Related to tool_catalog
```

### **Tables to Rename** 🔄
```sql
-- Better naming for MCP-specific tables
ALTER TABLE mcp_tools_cache RENAME TO zapier_mcp_tools_cache;
ALTER TABLE agent_mcp_connections RENAME TO agent_zapier_mcp_connections;
```

### **Security Fix: Vault URLs** 🔐
```sql
-- Fix exposed URLs in agent_zapier_mcp_connections
ALTER TABLE agent_zapier_mcp_connections 
ADD COLUMN vault_server_url_id UUID REFERENCES vault.secrets(id);

-- Migrate existing URLs to vault
-- Update server_url column to reference vault instead of plain text
```

---

## **Phase 4: Documentation Updates**

### **README.md Updates**
- ❌ Remove references to `user_oauth_connections` 
- ✅ Update to `user_integration_credentials`
- ❌ Remove `tool_catalog` references
- ✅ Document new MCP architecture

### **New Documentation Needed**
- Tool provider mapping system
- Scope-to-tool conversion logic  
- MCP vs Direct tool integration patterns

---

## **Phase 5: Implementation Steps**

### **Step 1: Fix Current Broken Code** (1-2 hours)
1. Update `FunctionCallingManager` to use hardcoded provider mappings
2. Remove broken `tool_definitions` database access
3. Test with existing Gmail/Serper/SMTP integrations

### **Step 2: Create Edge Function** (2-3 hours) 
1. Create `supabase/functions/get-agent-tools/index.ts`
2. Implement single database query + provider mapping
3. Add proper error handling and caching
4. Update chat function to call edge function

### **Step 3: Database Cleanup** (1-2 hours)
1. Create migration to remove deprecated tables
2. Rename MCP tables with better names
3. Implement vault security for Zapier URLs
4. Update all references in codebase

### **Step 4: Testing & Documentation** (1 hour)
1. Test tool discovery with all providers
2. Update README and documentation
3. Verify no broken references remain

---

## **Expected Outcomes**

### **Performance** 🚀
- **Single database query** instead of 4 provider queries
- **Edge function caching** for better performance  
- **Proper MCP architecture** with clean separation

### **Security** 🔐
- **Vault-secured Zapier URLs** instead of plain text
- **Proper permission validation** through unified system
- **Clean table structure** without deprecated references

### **Maintainability** 🛠️
- **Clear table naming** that reflects actual usage
- **Single source of truth** for tool authorization
- **Documented provider mapping** system

---

## **Risk Assessment**

### **High Risk** ⚠️
- Current implementation is completely broken (tool_definitions doesn't exist)
- Must fix immediately to restore chat functionality

### **Medium Risk** ⚠️  
- Database cleanup could affect other parts of system
- Need careful testing of all integrations

### **Low Risk** ✅
- Edge function creation is additive, won't break existing
- Documentation updates are safe

---

## **Next Actions**

1. **IMMEDIATE**: Fix broken FunctionCallingManager (Phase 1)
2. **TODAY**: Create proper edge function (Phase 2)  
3. **THIS WEEK**: Plan database cleanup (Phase 3)
4. **ONGOING**: Update documentation (Phase 4)
