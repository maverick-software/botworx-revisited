# Fix Outlook MCP Schema Issue - ROOT CAUSE

## 🎯 THE REAL PROBLEM

The issue is **NOT** with our retry logic - it's with **STALE TOOL SCHEMAS**!

### What's Happening:
1. ❌ `mcp_tools_cache` has OLD schema saying: `instructions` is required
2. ✅ Zapier MCP server NOW expects: `searchValue` parameter
3. 🔄 LLM uses cached schema → provides `instructions` → Tool fails

### Why Retry Isn't Working:
The LLM is being smart! When we say "Use searchValue, not instructions", it thinks:
- "I'll be safe and provide BOTH parameters!"
- Sends: `{ "searchValue": "", "instructions": "..." }`
- Zapier rejects because it doesn't expect BOTH

## ✅ THE SOLUTION

**Refresh the MCP tool schemas from Zapier!**

### Option 1: Call Refresh Edge Function (Recommended)

```typescript
// Call from frontend or use Supabase Dashboard > Edge Functions
const { data, error } = await supabase.functions.invoke('refresh-mcp-tools', {
  body: { 
    connectionId: 'YOUR_OUTLOOK_MCP_CONNECTION_ID' 
  }
});
```

### Option 2: SQL Query to Find Connection ID

```sql
-- Find your Outlook MCP connection
SELECT 
  id as connection_id,
  agent_id,
  connection_name,
  last_tools_refresh
FROM agent_mcp_connections
WHERE connection_name LIKE '%Outlook%' 
  OR connection_name LIKE '%Microsoft%'
  AND is_active = true;
```

### Option 3: Refresh All MCP Connections

```typescript
// Get all active connections
const { data: connections } = await supabase
  .from('agent_mcp_connections')
  .select('id')
  .eq('is_active', true);

// Refresh each one
for (const conn of connections) {
  await supabase.functions.invoke('refresh-mcp-tools', {
    body: { connectionId: conn.id }
  });
}
```

### Option 4: Frontend UI (If Available)

If you have a UI for MCP connections:
1. Go to Integrations/MCP page
2. Find Outlook/Zapier MCP connection
3. Click "Refresh Tools" button
4. Wait for schema update

## 📊 Verify the Fix

After refreshing, check the schema:

```sql
SELECT 
  tool_name,
  openai_schema->'parameters'->'properties' as parameters
FROM mcp_tools_cache mtc
JOIN agent_mcp_connections amc ON mtc.connection_id = amc.id
WHERE tool_name = 'microsoft_outlook_find_emails'
  AND amc.is_active = true;
```

**Expected Result:**
```json
{
  "searchValue": {
    "type": "string",
    "description": "Search term or empty string for recent emails"
  }
}
```

**NOT:**
```json
{
  "instructions": {
    "type": "string",
    "description": "Search instructions"
  }
}
```

## 🔧 How Tool Discovery Works (MCP Protocol)

```
1. DISCOVERY PHASE (refresh-mcp-tools)
   └─> Connect to Zapier MCP Server
   └─> Call tools/list endpoint
   └─> Receive tool schemas
   └─> Store in mcp_tools_cache

2. TOOL PROVISION (get-agent-tools)
   └─> Read from mcp_tools_cache
   └─> Return schemas to LLM
   
3. EXECUTION (LLM → mcp-execute)
   └─> LLM uses schema to generate tool call
   └─> mcp-execute sends to Zapier
   └─> Zapier validates against CURRENT schema
```

### The Problem:
- **Step 1** (Discovery) happens RARELY (manual or scheduled)
- **Step 2** (Provision) uses CACHED schema
- **Step 3** (Execution) validates against LIVE schema
- **If cached != live → FAILURE!**

## 🚀 Immediate Action Required

**You need to:**
1. Find your Outlook MCP connection ID
2. Call `refresh-mcp-tools` edge function
3. Wait for schema to update
4. Try "show me my emails" again
5. It should work WITHOUT retry!

## 📝 Long-Term Solutions

### 1. Automatic Schema Refresh
Add to your agent startup or periodic job:

```typescript
// Refresh MCP schemas every 24 hours
setInterval(async () => {
  const { data: connections } = await supabase
    .from('agent_mcp_connections')
    .select('id')
    .eq('is_active', true);
    
  for (const conn of connections) {
    await supabase.functions.invoke('refresh-mcp-tools', {
      body: { connectionId: conn.id }
    });
  }
}, 24 * 60 * 60 * 1000); // 24 hours
```

### 2. Schema Version Detection
Enhance `mcp-execute` to detect schema mismatches:

```typescript
if (error.code === -32602 && error.message.includes('Required field')) {
  // Schema mismatch detected!
  console.warn('Schema mismatch - triggering refresh');
  await triggerSchemaRefresh(connectionId);
  
  return {
    success: false,
    error: 'Tool schema outdated. Please refresh and try again.',
    requires_schema_refresh: true
  };
}
```

### 3. TTL on Cached Schemas
Add `last_refreshed` check in `get-agent-tools`:

```typescript
// Check if schema is older than 7 days
const SCHEMA_TTL = 7 * 24 * 60 * 60 * 1000;
if (Date.now() - lastRefreshed > SCHEMA_TTL) {
  // Trigger background refresh
  triggerBackgroundRefresh(connectionId);
  // Still return cached schema for now
}
```

## 🎓 Key Learnings

1. **MCP Discovery != MCP Execution**
   - Discovery gives us schema
   - Execution validates against server's current schema
   - They can diverge!

2. **Cache Can Go Stale**
   - Service providers update their APIs
   - Parameter names change
   - Required fields change
   - We MUST refresh periodically

3. **Retry Can't Fix Schema Issues**
   - If LLM has wrong schema, retry won't help
   - LLM will keep using cached schema
   - Need to fix at SOURCE (mcp_tools_cache)

## ✅ Success Criteria

After fix, you should see:
1. ✅ LLM provides ONLY `searchValue` parameter
2. ✅ NO `instructions` parameter sent
3. ✅ Tool executes successfully on FIRST attempt
4. ✅ NO retry needed!

---

**TL;DR:** Refresh your MCP tool schemas! The cached schema is outdated. Call `refresh-mcp-tools` edge function with your Outlook connection ID.

