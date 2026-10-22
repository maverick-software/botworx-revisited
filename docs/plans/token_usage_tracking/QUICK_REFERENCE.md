# Token Usage Tracking - Quick Reference

**Status**: Planning Complete ✅  
**Date**: October 22, 2025

---

## 📚 Documentation Index

| Document | Purpose | Status |
|----------|---------|--------|
| **`plan.md`** | Overall project plan and timeline | ✅ Complete |
| **`wbs_checklist.md`** | Detailed work breakdown structure | ✅ Complete |
| **`PLANNING_COMPLETE.md`** | Planning phase summary | ✅ Complete |
| **`research/01_database_schema_research.md`** | Database design research | ✅ Complete |
| **`research/06_frontend_charting_research.md`** | Charting library selection | ✅ Complete |
| **`planning/01_database_design.md`** | Complete database design with SQL | ✅ Ready for Implementation |
| **`planning/02_api_design.md`** | Edge Function API specifications | ✅ Ready for Implementation |
| **`planning/03_frontend_design.md`** | React component architecture | ✅ Ready for Implementation |
| **`planning/04_aggregation_workflow.md`** | Cron job and backfill design | ✅ Ready for Implementation |

---

## 🚀 Quick Start Implementation Order

### 1. Database (30 min)
```powershell
# Create migration from planning/01_database_design.md
# File: supabase/migrations/20251022000001_create_user_token_usage.sql

supabase db push --include-all
```

### 2. Backend (2-3 hours)
```powershell
# Create 3 Edge Functions from planning/02_api_design.md
# 1. supabase/functions/get-user-token-usage/index.ts
# 2. supabase/functions/aggregate-token-usage/index.ts
# 3. supabase/functions/backfill-token-usage/index.ts

supabase functions deploy get-user-token-usage
supabase functions deploy aggregate-token-usage
supabase functions deploy backfill-token-usage
```

### 3. Frontend (4-5 hours)
```powershell
# Install dependencies
npm install recharts

# Create TypeScript types
# File: src/types/token-usage.ts

# Create custom hook
# File: src/hooks/useTokenUsage.ts

# Create 8 components (see planning/03_frontend_design.md)
# Main: src/components/modals/TokenUsageModal.tsx
# Charts: src/components/charts/TokenUsageChart.tsx
# Admin components: src/components/admin/...

# Integrate into src/pages/AdminUserManagement.tsx
```

### 4. Backfill (15 min)
```powershell
# Call backfill API via admin UI or curl
# See planning/04_aggregation_workflow.md for commands
```

---

## 🎯 Key Features

- ✅ **Daily Aggregation**: Automatic cron job at 1:00 AM UTC
- ✅ **Historical Backfill**: One-time backfill of all existing data
- ✅ **Admin UI**: Modal with charts and tables
- ✅ **Data Visualization**: Line/bar charts via Recharts
- ✅ **Filtering**: Date range, period type (daily/weekly/monthly)
- ✅ **Export**: CSV download capability
- ✅ **Performance**: Pre-aggregated data for fast queries
- ✅ **Security**: RLS policies, admin-only access

---

## 📊 Database Schema (TL;DR)

```sql
CREATE TABLE user_token_usage (
  id UUID PRIMARY KEY,
  user_id UUID,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  period_type VARCHAR(10),  -- 'daily', 'weekly', 'monthly'
  total_prompt_tokens BIGINT,
  total_completion_tokens BIGINT,
  total_tokens BIGINT,
  message_count INTEGER,
  conversation_count INTEGER,
  agent_ids UUID[],
  -- metadata fields...
);
```

---

## 🌐 API Endpoints (TL;DR)

### 1. Get User Token Usage
```typescript
POST /functions/v1/get-user-token-usage
Body: { userId?, startDate?, endDate?, periodType?, limit?, offset? }
Response: { success, data: { usage[], summary, pagination } }
```

### 2. Aggregate Tokens (Admin Only)
```typescript
POST /functions/v1/aggregate-token-usage
Body: { userId?, startDate?, endDate?, force? }
Response: { success, data: { usersProcessed, recordsCreated, ... } }
```

### 3. Backfill Historical (Admin Only)
```typescript
POST /functions/v1/backfill-token-usage
Body: { startDate, endDate, batchSize? }
Response: { success, data: { batches[], summary } }
```

---

## 🎨 UI Components (TL;DR)

```
TokenUsageModal
├── TokenUsageHeader (filters)
├── TokenUsageSummary (4 stat cards)
├── TokenUsageChart (Recharts)
├── TokenUsageTable (paginated data)
└── TokenUsageFooter (export, refresh, close)
```

**Integration**:
- Add "View Usage" button to each user row in AdminUserManagement
- Button opens `TokenUsageModal` with user's data

---

## ⏱️ Estimated Timeline

| Phase | Time | Status |
|-------|------|--------|
| Research | 2 hours | ✅ Complete |
| Planning | 4 hours | ✅ Complete |
| **Implementation** | **8-12 hours** | ⏳ **Next** |
| Testing | 2 hours | Pending |
| Deployment | 1 hour | Pending |
| **Total** | **17-21 hours** | **~30% Complete** |

---

## 🔗 Related Files

- Database schema: `database/current_cloud_schema.sql` (will be updated)
- Chat processing: `supabase/functions/chat/processor/handlers.ts` (token capture)
- Admin page: `src/pages/AdminUserManagement.tsx` (integration point)
- Debug modal: `src/components/modals/LLMDebugModal.tsx` (similar UI pattern)

---

## 💡 Pro Tips

1. **Start with database** - Everything depends on it
2. **Test Edge Functions** - Use Postman/curl before frontend
3. **Mock data first** - Test UI with hardcoded data
4. **Backfill last** - Only after everything works
5. **Monitor cron job** - Check logs daily for first week

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Cron job not running | Check `SELECT * FROM cron.job WHERE jobname = 'aggregate-token-usage-daily';` |
| Missing days | Run backfill function manually |
| Slow aggregation | Check indexes exist, reduce batch size |
| UI not loading | Check Edge Function auth, RLS policies |
| Wrong token counts | Verify metadata structure in raw messages |

---

**Planning Complete**: ✅  
**Ready to Build**: Yes  
**Next Action**: Create database migration

