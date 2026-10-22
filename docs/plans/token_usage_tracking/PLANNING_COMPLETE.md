# Token Usage Tracking System - Planning Phase Complete ✅

**Project**: Token Usage Tracking System  
**Phase**: Planning & Design  
**Status**: ✅ **COMPLETE**  
**Date**: October 22, 2025

---

## 🎯 Objective

Design a comprehensive token usage tracking and analytics system for Agentopia's admin panel that allows administrators to monitor, analyze, and manage token consumption across all user accounts.

---

## ✅ Completed Planning Phases

### Phase 1: Research (Complete)
- ✅ Database schema research
- ✅ Token data structure investigation (`chat_messages_v2.metadata`)
- ✅ Admin UI pattern analysis
- ✅ Edge Function pattern research
- ✅ Aggregation strategy research
- ✅ Frontend charting library selection (Recharts)

**Research Documents Created**:
1. `research/01_database_schema_research.md` - Table structure, indexes, foreign keys
2. `research/06_frontend_charting_research.md` - Comprehensive library comparison

---

### Phase 2: Planning & Design (Complete)

#### 2.1 Database Design ✅
**Document**: `planning/01_database_design.md`

**Key Deliverables**:
- Complete table schema for `user_token_usage`
- Indexes optimized for query patterns
- RLS policies for admin and user access
- Database functions:
  - `aggregate_user_token_usage()` - Aggregates tokens from raw messages
  - `backfill_token_usage()` - Backfills historical data in batches
  - `update_user_token_usage_timestamp()` - Automatic timestamp updates
- Complete migration SQL ready for deployment
- Rollback plan documented
- Performance testing queries

**Table Structure**:
```sql
CREATE TABLE user_token_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  period_type VARCHAR(10) CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  total_prompt_tokens BIGINT DEFAULT 0,
  total_completion_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  agent_ids UUID[],
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_token_usage_unique_period UNIQUE (user_id, period_start, period_type)
);
```

---

#### 2.2 API Design ✅
**Document**: `planning/02_api_design.md`

**Key Deliverables**:
- 3 Edge Function endpoint specifications:
  1. `get-user-token-usage` - Fetch aggregated usage data with filters
  2. `aggregate-token-usage` - Manual trigger for aggregation
  3. `backfill-token-usage` - Historical data backfill
- Complete TypeScript type definitions
- Request/response schemas for all endpoints
- Error handling strategy with error codes
- Authorization logic (admin check functions)
- CORS configuration
- Rate limiting considerations

**TypeScript Types File**: `src/types/token-usage.ts`

**Example API Flow**:
```
Admin clicks "View Usage" for user
  ↓
Frontend calls get-user-token-usage Edge Function
  ↓
Edge Function verifies admin status via RLS
  ↓
Database query fetches aggregated data
  ↓
Response includes: usage[], summary, pagination
  ↓
Frontend renders TokenUsageModal with charts and tables
```

---

#### 2.3 Frontend Design ✅
**Document**: `planning/03_frontend_design.md`

**Key Deliverables**:
- Complete component hierarchy (8 components)
- Component specifications with props and state
- Custom hook: `useTokenUsage` for data fetching
- Integration plan for AdminUserManagement page
- Responsive design breakpoints
- Styling guidelines matching existing theme
- Error state designs
- Loading state designs
- Empty state designs
- CSV export functionality
- Accessibility (a11y) requirements

**Component Hierarchy**:
```
TokenUsageModal (Main Container)
├── TokenUsageHeader (User info + filters)
├── TokenUsageSummary (4 stat cards)
│   └── StatCard (Reusable metric display)
├── TokenUsageChart (Recharts line/bar chart)
├── TokenUsageTable (Detailed records with pagination)
│   └── AgentsList (Agent avatars in table)
└── TokenUsageFooter (Export, Refresh, Close buttons)
```

**Custom Hook**:
```typescript
const {
  usage,
  summary,
  isLoading,
  error,
  totalRecords,
  refetch,
  exportCSV
} = useTokenUsage({
  userId,
  dateRange,
  periodType,
  sortBy,
  sortOrder,
  currentPage,
  enabled: isOpen
});
```

---

#### 2.4 Aggregation Workflow ✅
**Document**: `planning/04_aggregation_workflow.md`

**Key Deliverables**:
- Supabase pg_cron job configuration
- Daily aggregation schedule (1:00 AM UTC)
- Backfill strategy (30-day batches)
- Error handling & recovery procedures
- Automatic catch-up logic for missed days
- Monitoring queries and health checks
- Performance optimization strategies
- Deployment checklist

**Cron Job Schedule**:
```
┌─────────────┬─────────────────────────────────────────────┐
│   Schedule  │               Description                   │
├─────────────┼─────────────────────────────────────────────┤
│ Daily Cron  │ Runs at 1:00 AM UTC every day              │
│             │ Aggregates previous day's data             │
│             │ Catches up any missed days                 │
└─────────────┴─────────────────────────────────────────────┘
```

**Backfill Process**:
1. Determine date range (earliest message → latest aggregated date)
2. Process in 30-day batches
3. Handle errors gracefully (log and continue)
4. Validate totals match raw data
5. Report discrepancies

---

## 📊 Architecture Summary

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  TOKEN USAGE TRACKING FLOW                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CAPTURE (Real-time)                                      │
│     User sends message → Chat function processes             │
│     → LLM returns response with token usage                  │
│     → Tokens stored in chat_messages_v2.metadata            │
│                                                              │
│  2. AGGREGATE (Daily Cron)                                   │
│     Cron job runs at 1:00 AM UTC                            │
│     → aggregate_user_token_usage() function                  │
│     → Reads raw messages from chat_messages_v2               │
│     → Sums tokens per user per day                           │
│     → Inserts/updates user_token_usage table                 │
│                                                              │
│  3. DISPLAY (On-Demand)                                      │
│     Admin clicks "View Usage"                                │
│     → get-user-token-usage Edge Function                     │
│     → Queries user_token_usage (pre-aggregated)              │
│     → Returns data to frontend                               │
│     → TokenUsageModal renders charts and tables              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### System Components

| Layer | Component | Technology | Purpose |
|-------|-----------|------------|---------|
| **Database** | `user_token_usage` table | PostgreSQL | Store aggregated metrics |
| | `aggregate_user_token_usage()` | PL/pgSQL | Aggregate tokens from messages |
| | `backfill_token_usage()` | PL/pgSQL | Backfill historical data |
| | pg_cron job | PostgreSQL Extension | Automated daily aggregation |
| **Backend** | `get-user-token-usage` | Deno Edge Function | Fetch usage data API |
| | `aggregate-token-usage` | Deno Edge Function | Manual aggregation trigger |
| | `backfill-token-usage` | Deno Edge Function | Historical backfill API |
| **Frontend** | `TokenUsageModal` | React + TypeScript | Main UI container |
| | `TokenUsageChart` | Recharts | Data visualization |
| | `useTokenUsage` | Custom Hook | Data fetching logic |

---

## 📁 File Structure

```
docs/plans/token_usage_tracking/
├── plan.md                                    # Main project plan
├── wbs_checklist.md                           # Work breakdown structure
├── PLANNING_COMPLETE.md                       # This file
├── research/
│   ├── 01_database_schema_research.md         # ✅ Database research
│   └── 06_frontend_charting_research.md       # ✅ Charting library research
└── planning/
    ├── 01_database_design.md                  # ✅ Complete DB design
    ├── 02_api_design.md                       # ✅ Complete API design
    ├── 03_frontend_design.md                  # ✅ Complete UI design
    └── 04_aggregation_workflow.md             # ✅ Complete workflow design
```

---

## 🚀 Ready for Implementation

All planning documents are complete and implementation-ready. The next phase is:

### Phase 3: Implementation

#### 3.1 Database Implementation
1. Create migration: `supabase/migrations/20251022000001_create_user_token_usage.sql`
2. Push to cloud: `supabase db push --include-all`
3. Verify table, functions, and cron job created successfully

#### 3.2 Backend Implementation
1. Create `supabase/functions/get-user-token-usage/index.ts`
2. Create `supabase/functions/aggregate-token-usage/index.ts`
3. Create `supabase/functions/backfill-token-usage/index.ts`
4. Deploy: `supabase functions deploy [function-name]`

#### 3.3 Frontend Implementation
1. Install Recharts: `npm install recharts`
2. Create TypeScript types: `src/types/token-usage.ts`
3. Create custom hook: `src/hooks/useTokenUsage.ts`
4. Create components:
   - `src/components/modals/TokenUsageModal.tsx`
   - `src/components/admin/TokenUsageHeader.tsx`
   - `src/components/admin/TokenUsageSummary.tsx`
   - `src/components/admin/StatCard.tsx`
   - `src/components/charts/TokenUsageChart.tsx`
   - `src/components/admin/TokenUsageTable.tsx`
   - `src/components/admin/AgentsList.tsx`
   - `src/components/admin/TokenUsageFooter.tsx`
5. Integrate into `src/pages/AdminUserManagement.tsx`

#### 3.4 Initial Data Backfill
1. Call backfill Edge Function with date range
2. Monitor backfill progress
3. Validate aggregated data matches raw data

---

## 📋 Implementation Checklist

### Database
- [ ] Create migration file with table, functions, indexes, RLS policies
- [ ] Push migration to cloud database
- [ ] Verify cron job is scheduled and active
- [ ] Test aggregation function with sample data

### Backend
- [ ] Implement `get-user-token-usage` Edge Function
- [ ] Implement `aggregate-token-usage` Edge Function
- [ ] Implement `backfill-token-usage` Edge Function
- [ ] Deploy all Edge Functions to Supabase
- [ ] Test Edge Functions with Postman/curl

### Frontend
- [ ] Install Recharts library
- [ ] Create all TypeScript type definitions
- [ ] Implement `useTokenUsage` custom hook
- [ ] Create all 8 UI components
- [ ] Integrate modal into AdminUserManagement page
- [ ] Test UI with mock data
- [ ] Test UI with real data

### Integration
- [ ] Run historical backfill for all existing data
- [ ] Verify daily cron job runs successfully
- [ ] Test end-to-end flow (message → aggregate → display)
- [ ] Monitor for 7 days to ensure stability
- [ ] Performance test with large datasets

### Cleanup
- [ ] Update WBS checklist with completed tasks
- [ ] Move backups to archive
- [ ] Update main README.md
- [ ] Create cleanup log
- [ ] Provide final summary to user

---

## 🎨 UI Preview (Text Mockup)

```
┌─────────────────────────────────────────────────────────────────┐
│ Token Usage - Charles S. (mail@enspyredigital.com)             │
│ ─────────────────────────────────────────────────────────────── │
│ Date Range: [2025-09-22] to [2025-10-22]  Period: [Daily ▼]    │
│ [Last 7 Days] [Last 30 Days] [Last 90 Days]                     │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ ⚡ Total │ │ 📈 Avg   │ │ 💬 Msgs  │ │ 👥 Agts  │           │
│ │ 45,678   │ │ 1,522/d  │ │ 234      │ │ 5        │           │
│ │ ↓28,901  │ │          │ │ 45 conv. │ │          │           │
│ │ ↑16,777  │ │          │ │          │ │          │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│ Token Usage Timeline                       [Line] [Bar]        │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │                    ╱╲                                      │ │
│ │         ╱╲       ╱    ╲                                    │ │
│ │       ╱    ╲   ╱        ╲    ╱╲                           │ │
│ │     ╱        ╲╱            ╲╱    ╲                         │ │
│ │   ╱                                  ╲                     │ │
│ │─────────────────────────────────────────────────────────│ │
│ │ Sep 22  Sep 29   Oct 6   Oct 13   Oct 20   Oct 22       │ │
│ └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Date       │ Total │ Input │ Output │ Msgs │ Conv │ Agents   │
│ ─────────────────────────────────────────────────────────────── │
│ Oct 22     │ 2,336 │ ↓1,435│ ↑901   │ 12   │ 3    │ [🤖🤖]   │
│ Oct 21     │ 1,987 │ ↓1,234│ ↑753   │ 9    │ 2    │ [🤖]     │
│ Oct 20     │ 3,145 │ ↓1,967│ ↑1,178 │ 15   │ 4    │ [🤖🤖🤖] │
│ ...                                                             │
│ ─────────────────────────────────────────────────────────────── │
│ Showing 1-30 of 30                   [◄ Previous] [Next ►]     │
├─────────────────────────────────────────────────────────────────┤
│ [📥 Export CSV] [🔄 Refresh]                        [Close]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 Expected Performance

| Metric | Value | Notes |
|--------|-------|-------|
| **Aggregation Time** | <10 sec/day | For typical deployment (1,000 msgs/day) |
| **UI Load Time** | <2 seconds | Including chart rendering |
| **Database Size Growth** | ~7 MB/year | 100 active users, daily aggregation |
| **API Response Time** | <500ms | Fetching 30 days of data |
| **Cron Job Duration** | <15 seconds | Daily run at 1:00 AM UTC |

---

## 🔒 Security Considerations

✅ **RLS Policies**:
- Admins can view all users' token usage
- Regular users can only view their own (future feature)
- No public access

✅ **Edge Function Auth**:
- All endpoints require valid JWT
- Admin-only endpoints verify `user_roles` table
- Service role key protected via environment variables

✅ **Data Privacy**:
- No message content stored in aggregated data
- Only metadata (token counts, agent IDs, timestamps)
- Complies with existing privacy policies

---

## ✨ Success Criteria

The token usage tracking system will be considered complete when:

1. ✅ **Database**: `user_token_usage` table exists with correct schema and RLS
2. ✅ **Cron Job**: Daily aggregation runs successfully and catches up missed days
3. ✅ **API**: All 3 Edge Functions deployed and responding correctly
4. ✅ **UI**: Modal opens, displays data, charts render, pagination works
5. ✅ **Data Integrity**: Aggregated totals match raw message data
6. ✅ **Performance**: All operations meet performance targets
7. ✅ **Testing**: Admin can view usage for any user, export CSV, refresh data
8. ✅ **Monitoring**: Health check queries run without errors

---

## 🎉 Next Steps

The planning phase is **complete**. All technical designs are finalized and documented. 

**Ready to proceed with implementation?**

If yes, we can start with:
1. Creating the database migration
2. Implementing the Edge Functions
3. Building the frontend components

**Estimated implementation time**: 8-12 hours

---

**Planning Complete**: ✅  
**Documentation**: 4 comprehensive design documents  
**Ready for Implementation**: Yes  
**Approval**: Awaiting user confirmation to proceed

