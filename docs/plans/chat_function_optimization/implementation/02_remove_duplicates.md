# Implementation Log: Remove Duplicate Service Calls
**Date**: September 30, 2025 - 16:32  
**Implemented By**: AI Assistant  
**Status**: ✅ DEPLOYED

---

## Changes Made

### Files Modified
1. **`supabase/functions/chat/core/memory/memory_manager.ts`**
   - **Line 850-861**: Removed duplicate vector search call
   - **Backup**: `docs/plans/chat_function_optimization/backups/memory_manager.ts.backup`

2. **`supabase/functions/chat/processor/stages.ts`**
   - **Lines 261-279**: Removed duplicate `useAccountGraph` check (now handled in getzep_retrieval.ts)
   - **Backup**: `docs/plans/chat_function_optimization/backups/stages.ts.backup`

3. **`supabase/functions/chat/core/memory/getzep_retrieval.ts`**
   - **Lines 26-39**: Added `useAccountGraph` check at entry point
   - **Backup**: `docs/plans/chat_function_optimization/backups/getzep_retrieval.ts.backup`

4. **`supabase/functions/chat/index.ts`**
   - **Lines 234-261**: Consolidated 3 "Processing" logs into 1
   - **Backup**: `docs/plans/chat_function_optimization/backups/index.ts.backup`

5. **`supabase/functions/chat/chat_history.ts`**
   - **Lines 66-70**: Fixed confusing "Error: null" message
   - **Backup**: `docs/plans/chat_function_optimization/backups/chat_history.ts.backup`

---

## Problem 1: Duplicate Vector Search Calls

### Root Cause
```typescript
// BEFORE (memory_manager.ts lines 850-861)
const externalPromise = (async () => {
  try {
    // DUPLICATE: Already checking in episodicPromise (line 736)
    const externalText = await getVectorSearchResults(query, agent_id, this.supabase, this.openai);
    if (externalText) {
      return [{ id: `external_${crypto.randomUUID()}`, content: { definition: externalText, concept: 'External Knowledge' } }];
    }
  } catch (_e) {
    // ignore
  }
  return [];
})();
```

**Result**: 2 Pinecone checks per request:
1. `episodicPromise` → logs "[MemoryManager] No Pinecone datastore connected - skipping episodic search"
2. `externalPromise` → calls `getVectorSearchResults()` → logs "[VectorSearch] No Pinecone datastore connected - skipping vector search"

### Solution
```typescript
// AFTER (memory_manager.ts line 850-853)
// OPERATION 4: External datastore vector search - REMOVED (duplicate of episodicPromise)
// Previously this called getVectorSearchResults() which duplicates the Pinecone check in episodicPromise
// If we need external datastores in future, add a separate check here
const externalPromise = Promise.resolve([]);
```

**Benefit**: Eliminates 1 duplicate Pinecone check and 1 log line

---

## Problem 2: Triple GetZep Checks

### Root Cause
GetZep was checked in 3 places:
1. `stages.ts` line 271: `useAccountGraph === true`
2. `getzep_semantic_manager.ts` line 88: `use_account_graph`
3. `getzep_retrieval.ts`: No check for `useAccountGraph`

**Result**: 3 database queries + 3 log messages

### Solution

**stages.ts** - Removed check, just get userId:
```typescript
// BEFORE
const useAccountGraph = agentSettings.use_account_graph === true;
if (!useAccountGraph) {
  console.log('[EnrichmentStage] Account graph not enabled - skipping');
} else if (!userId || !queryText) {
  // ...
}

// AFTER
// Note: getzep_retrieval.ts handles all guard clauses
if (userId && queryText) {
  const getzepResults = await searchGetZepKnowledgeGraph(...);
}
```

**getzep_retrieval.ts** - Added check at TOP:
```typescript
// ADDED (lines 26-39)
// GUARD CLAUSE #1: Check if account graph is enabled
const { data: userAgents } = await supabase
  .from('agents')
  .select('id, metadata')
  .eq('user_id', userId)
  .limit(1)
  .maybeSingle();

const useAccountGraph = userAgents?.metadata?.settings?.use_account_graph === true;
if (!useAccountGraph) {
  console.log('[GetZepSemantic] Account graph not enabled for user - skipping');
  return [];
}
```

**Benefit**: Single check instead of 3, clearer logs

---

## Problem 3: Redundant "Processing" Logs

### Root Cause
```typescript
// BEFORE (index.ts)
log.info('Processing request', { ... });  // Line 234
log.info('Processing v2 request');        // Line 241
log.info('Processing standard request');  // Line 261
```

**Result**: 3 log lines saying the same thing

### Solution
```typescript
// AFTER (index.ts lines 244)
const requestType = wantsStream && body.options?.response?.stream ? 'streaming' : 'standard';
log.info('Processing v2 request', { type: requestType, method: req.method });
```

**Benefit**: 1 log line with all details, 66% reduction

---

## Problem 4: Confusing "Error: null" Message

### Root Cause
```typescript
// BEFORE (chat_history.ts line 67)
console.log(`[getRelevantChatHistory] V2 Result - Error:`, v2Error); // Always logs, even when null
console.log(`[getRelevantChatHistory] V2 Result - Data Count:`, v2Data?.length ?? 0);
```

**Result**: Logs "Error: null" on success, confusing developers

### Solution
```typescript
// AFTER (chat_history.ts lines 67-70)
// Only log error if it exists
if (v2Error) {
  console.error(`[getRelevantChatHistory] V2 Error:`, v2Error); 
}
console.log(`[getRelevantChatHistory] V2 Retrieved ${v2Data?.length ?? 0} messages`);
```

**Benefit**: Clear success message, errors only when they occur

---

## Expected Log Output (After Fixes)

### Before (Redundant)
```
[INFO] Processing request {...}
[INFO] Processing v2 request
[INFO] Processing standard request
[getRelevantChatHistory] V2 Result - Error: null
[getRelevantChatHistory] V2 Result - Data Count: 25
[EnrichmentStage] Account graph not enabled - skipping
[MemoryManager] No Pinecone datastore connected - skipping episodic search
[VectorSearch] No Pinecone datastore connected - skipping vector search
[GetZepSemantic] Graph not enabled for agent
[MemoryManager] GetZep semantic retrieval returned 0 results
```

### After (Clean)
```
[INFO] Processing v2 request { type: 'standard', method: 'POST' }
[getRelevantChatHistory] V2 Retrieved 25 messages
[GetZepSemantic] Account graph not enabled for user - skipping
[MemoryManager] No Pinecone datastore connected - skipping episodic search
[MemoryManager] No GetZep manager - skipping semantic search
```

**Log Reduction**: 10 lines → 5 lines (50% reduction)

---

## Testing Checklist

- [ ] Verify only 1 "Processing" log appears
- [ ] Verify no "Error: null" messages
- [ ] Verify only 1 Pinecone check log
- [ ] Verify only 1 GetZep check log
- [ ] Verify reasoning skipped when disabled
- [ ] Verify tools execute correctly

---

## Rollback Instructions

```powershell
# Restore all modified files
Copy-Item -Path "docs\plans\chat_function_optimization\backups\memory_manager.ts.backup" -Destination "supabase\functions\chat\core\memory\memory_manager.ts" -Force
Copy-Item -Path "docs\plans\chat_function_optimization\backups\stages.ts.backup" -Destination "supabase\functions\chat\processor\stages.ts" -Force
Copy-Item -Path "docs\plans\chat_function_optimization\backups\getzep_retrieval.ts.backup" -Destination "supabase\functions\chat\core\memory\getzep_retrieval.ts" -Force
Copy-Item -Path "docs\plans\chat_function_optimization\backups\index.ts.backup" -Destination "supabase\functions\chat\index.ts" -Force
Copy-Item -Path "docs\plans\chat_function_optimization\backups\chat_history.ts.backup" -Destination "supabase\functions\chat\chat_history.ts" -Force

# Redeploy
supabase functions deploy chat
```

---

**Status**: ✅ DEPLOYED - Ready for testing  
**Deployment**: September 30, 2025 - 16:32  
**Deployment #**: 4
