# Knowledge Graph Architecture Cleanup

**Date**: October 6, 2025  
**Migration**: `20251006064153_remove_deprecated_graph_tables.sql`  
**Status**: ✅ Ready to Apply

---

## Summary

Removed deprecated local graph caching tables (`graph_nodes`, `graph_edges`, `graph_links`, `graph_ingestion_queue`) that were redundant with GetZep Cloud storage.

## Problem Statement

The original plan attempted to mirror GetZep's knowledge graph data locally in Supabase. This approach was:

- **Redundant**: Duplicated data that already lives in GetZep Cloud
- **Inefficient**: Required constant syncing between GetZep and Supabase
- **Unnecessary**: Added complexity without providing value
- **Error-prone**: Could lead to data inconsistencies between systems

## Solution

**Keep GetZep as the single source of truth for all graph data.**

### Architecture Before:
```
GetZep Cloud (nodes, edges, facts)
     ↓ (sync)
Supabase (graph_nodes, graph_edges, graph_links, graph_ingestion_queue)
     ↓
Application queries local Supabase tables
```

### Architecture After:
```
GetZep Cloud (nodes, edges, facts)
     ↓ (direct API calls)
Application queries GetZep API directly
     ↑
account_graphs table (connection metadata only)
```

## Tables Removed

1. **`graph_nodes`** - Local cache of GetZep nodes (entities, concepts)
2. **`graph_edges`** - Local cache of GetZep edges (relationships, facts)
3. **`graph_links`** - Cross-references between graph and vectors/messages
4. **`graph_ingestion_queue`** - Queue for processing graph updates

## Tables Kept

- **`account_graphs`** - Tracks GetZep connection per account
  - Stores: connection_id, provider, status, settings
  - Purpose: Know which GetZep project is active for each account

## Impact Analysis

### Code Changes Required: ✅ Complete

- ✅ Updated `GraphSettingsPage.tsx` to remove local metric queries
- ✅ Removed references to deprecated tables in UI
- ✅ Updated comments to reflect GetZep API as source of truth

### Code That Will NOT Break:

- **Chat function**: Already uses GetZep API directly for graph operations
- **Memory retrieval**: Queries GetZep API, not local tables
- **Graph search**: Uses GetZep's search endpoints
- **Account settings**: Only reads `account_graphs` table (kept)

### Metrics/Statistics:

**Before**: Attempted to show node/edge counts from local tables  
**After**: Shows "N/A" with explanation that data lives in GetZep Cloud

GetZep's API does not currently expose graph statistics. If needed in the future:
- Option 1: Wait for GetZep to add statistics endpoints
- Option 2: Build separate analytics that periodically queries GetZep

## How to Apply

### 1. Verify No Active Usage
```sql
-- Check if any tables have data
SELECT COUNT(*) FROM graph_nodes;
SELECT COUNT(*) FROM graph_edges;
SELECT COUNT(*) FROM graph_links;
SELECT COUNT(*) FROM graph_ingestion_queue;
```

### 2. Backup (if needed)
```bash
# If you want to keep the data for reference
pg_dump -h your-db-host -U postgres -t graph_nodes -t graph_edges -t graph_links -t graph_ingestion_queue > graph_tables_backup.sql
```

### 3. Apply Migration
```bash
supabase db push
```

### 4. Verify
```sql
-- Should succeed (table kept)
SELECT * FROM account_graphs LIMIT 1;

-- Should fail (tables removed)
SELECT * FROM graph_nodes LIMIT 1;
```

## Rollback Plan

If you need to rollback (unlikely), you would need to:
1. Restore from backup
2. Recreate the tables from the original migration
3. However, this is NOT recommended as the tables were never fully implemented

## Related Files

- Migration: `supabase/migrations/20251006064153_remove_deprecated_graph_tables.sql`
- Original plan: `docs/plans/account_wide_knowledge_graph/plan.md`
- UI updated: `src/pages/GraphSettingsPage.tsx`

## References

- GetZep API Documentation: https://help.getzep.com/
- Original architectural decision: See `docs/plans/account_wide_knowledge_graph/`

---

**Conclusion**: This cleanup simplifies the architecture, reduces maintenance burden, and makes GetZep Cloud the clear source of truth for all knowledge graph data. ✨

