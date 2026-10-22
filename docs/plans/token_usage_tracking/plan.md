# Token Usage Tracking System - Implementation Plan

## Project Overview

**Objective**: Implement a comprehensive token usage tracking system with admin UI for monitoring LLM token consumption across all user accounts.

**Scope**: 
- Database schema for storing token usage metrics
- Backend system to capture and aggregate token usage from chat messages
- Admin UI modal on the User Management page
- Real-time token tracking per user account
- Historical usage data and analytics

**Constraints**:
- Files must be 200-300 lines maximum
- Must follow existing admin UI patterns
- Must integrate with current chat system (v2 only)
- Must not affect chat performance
- Must handle historical data migration

---

## Background Research Summary

### Existing System Analysis

**1. Current Chat System (V2)**
- Token data is already being captured in `chat_messages_v2.metadata` field
- Structure includes: `prompt_tokens`, `completion_tokens`, `total_tokens`
- Data is captured per message via LLM Debug Modal integration
- Located in: `supabase/functions/chat/processor/types.ts` (ProcessingMetrics interface)

**2. User Management Page**
- Location: `src/pages/AdminUserManagement.tsx`
- Pattern: Table-based UI with modals for detailed views
- Uses Edge Function: `admin-get-users` for data fetching
- Pagination: 20 users per page
- Search functionality with debounce (500ms)
- Existing modals: `EditUserRolesModal`, `ConfirmationModal`

**3. Database Schema**
- **profiles** table: Stores user information (id, full_name, etc.)
- **chat_messages_v2** table: Contains messages with metadata field (JSONB)
- **conversation_sessions** table: Links conversations to users and agents
- No existing token usage aggregation table

**4. Admin UI Pattern**
- Uses Shadcn/UI components (Dialog, Button, Table)
- Consistent modal structure with header, content, and actions
- Color scheme: muted backgrounds, border separations
- Icons from lucide-react
- Responsive design with Tailwind CSS

---

## Proposed Architecture

### Database Layer

**New Table: `user_token_usage`**
```sql
CREATE TABLE user_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_prompt_tokens BIGINT DEFAULT 0,
  total_completion_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);
```

**Indexes**:
- `idx_token_usage_user_period` ON (user_id, period_start DESC)
- `idx_token_usage_period` ON (period_start DESC, period_end DESC)

### Backend Layer

**Edge Function: `admin-get-user-token-usage`**
- Input: `user_id`, `start_date`, `end_date`
- Returns: Aggregated token usage data
- Queries: `chat_messages_v2.metadata` for real-time stats

**Edge Function: `aggregate-token-usage`**  
- Scheduled via Supabase Cron (daily at midnight)
- Aggregates previous day's token usage
- Updates `user_token_usage` table
- Handles historical backfill

**Database Function: `calculate_user_token_usage`**
- Pure SQL function for performance
- Aggregates token data from `chat_messages_v2`
- Can be called directly or via Edge Function

### Frontend Layer

**Component: `TokenUsageModal.tsx`**
- Props: `isOpen`, `onClose`, `userId`, `userEmail`
- Displays:
  - Current period usage (daily, weekly, monthly)
  - Historical usage chart
  - Token breakdown (input/output)
  - Cost estimation (if pricing configured)
  - Conversation/message counts

**Integration Point**:
- Add "Token Usage" button to User Management table actions
- Similar to "Edit Roles" button
- Icon: `<BarChart3>` or `<Activity>` from lucide-react

---

## File Structure

```
/docs/plans/token_usage_tracking/
├── research/
│   ├── 01_database_schema_research.md
│   ├── 02_chat_metadata_structure_research.md
│   ├── 03_admin_ui_patterns_research.md
│   ├── 04_edge_function_patterns_research.md
│   ├── 05_aggregation_strategy_research.md
│   └── 06_frontend_charting_research.md
├── implementation/
│   ├── 01_database_migration_notes.md
│   ├── 02_edge_functions_implementation_notes.md
│   ├── 03_frontend_modal_implementation_notes.md
│   ├── 04_integration_testing_notes.md
│   └── 05_backfill_migration_notes.md
├── backups/
│   └── (will contain backed up files)
└── plan.md (this file)
```

---

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Supabase Edge Functions (Deno), PostgreSQL
- **Charting**: Recharts or Chart.js (to be determined in research)
- **State Management**: React hooks (useState, useEffect, useCallback)
- **Data Fetching**: Supabase client

---

## Success Criteria

1. ✅ Admin can view token usage for any user
2. ✅ Token data is accurately aggregated from chat messages
3. ✅ Historical data is preserved and queryable
4. ✅ UI is consistent with existing admin patterns
5. ✅ System handles large data volumes efficiently
6. ✅ No performance impact on chat system
7. ✅ Token usage updates in near real-time (or with acceptable delay)
8. ✅ Cost estimation feature (optional, nice-to-have)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large historical data migration | High | Batch processing, background job |
| Performance on chat writes | High | Async aggregation, separate table |
| Inaccurate token counting | Medium | Validation queries, testing |
| UI complexity with large datasets | Medium | Pagination, date range filters |
| Cost calculation accuracy | Low | Make it optional, clearly labeled as estimate |

---

## Next Steps

1. **Research Phase**: Detailed investigation of each component
2. **Planning Phase**: Create mini-plans for each WBS item
3. **Implementation Phase**: Execute plan with backups
4. **Testing Phase**: Validate accuracy and performance
5. **Refinement Phase**: Optimize and polish UI/UX
6. **Cleanup Phase**: Archive backups, update README

---

**Created**: October 22, 2025  
**Status**: Planning Phase  
**Expected Completion**: TBD

