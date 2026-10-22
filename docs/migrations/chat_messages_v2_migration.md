# Chat Messages V2 Migration - Complete

## Overview
This document describes the migration from the legacy `chat_messages` v1 table to the modern `chat_messages_v2` table.

## Migration Date
January 5, 2025

## Changes Made

### 1. Database Migration
**File**: `supabase/migrations/20250105000000_drop_chat_messages_v1.sql`

- Dropped the old `chat_messages` table
- Removed all associated indexes, triggers, and RLS policies
- Added documentation comment to `chat_messages_v2`

### 2. Code Updates

#### supabase/functions/chat/chat_history.ts
- **Removed**: V1 fallback logic in `getRelevantChatHistory()`
- **Updated**: `saveUserMessage()` to use only `chat_messages_v2`
- **Updated**: `saveAgentResponse()` to use only `chat_messages_v2`
- **Added**: Proper V2 message format with required fields:
  - `conversation_id` (required)
  - `session_id` (required)
  - `content` as JSONB with `{type: 'text', text: string}` format
  - `role` field

#### src/pages/ChatPage.tsx
- **Fixed**: Query to use `chat_messages_v2` instead of `chat_messages`

#### src/pages/AgentChatPage.tsx
- **Added**: `conversationRefreshKey` to force reload when clicking same conversation
- **Fixed**: Chat history loading issues

### 3. Compatibility Layer Status
**File**: `supabase/functions/chat/adapters/compatibility_layer.ts`

⚠️ **Note**: This file still contains dual-write logic for backwards compatibility during gradual migration. Since we're now V2-only, this file may need further cleanup or can be deprecated entirely.

## V2 Table Schema

The `chat_messages_v2` table uses an advanced JSON-based structure:

```sql
CREATE TABLE chat_messages_v2 (
  id UUID PRIMARY KEY,
  version VARCHAR(10) DEFAULT '1.0.0',
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  parent_message_id UUID,
  channel_id UUID,
  sender_user_id UUID,
  sender_agent_id UUID,
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content JSONB NOT NULL CHECK (content->>'type' IN ('text', 'structured', 'multimodal', 'tool_result')),
  metadata JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  tools JSONB,
  memory_refs UUID[],
  state_snapshot_id UUID,
  audit JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Key Differences from V1

| Feature | V1 (chat_messages) | V2 (chat_messages_v2) |
|---------|-------------------|----------------------|
| Content Format | Plain TEXT | JSONB with structured types |
| Conversation Tracking | None | conversation_id + session_id |
| Message Hierarchy | Flat | parent_message_id for threading |
| Role Types | Inferred from sender | Explicit role field |
| Metadata | Limited | Rich JSONB metadata + context |
| Tools Support | None | Native tools JSONB field |
| Memory Integration | None | memory_refs array |
| State Management | None | state_snapshot_id |

## Benefits of V2

1. **Structured Content**: JSONB format allows for rich message types (text, structured, multimodal)
2. **Conversation Management**: Proper conversation and session tracking
3. **Message Threading**: Support for parent-child message relationships
4. **Tool Integration**: Native support for tool calls and results
5. **Memory System**: Integration with agent memory systems
6. **Audit Trail**: Built-in audit logging
7. **Extensibility**: JSONB fields allow easy schema evolution

## Migration Checklist

- [x] Update chat history retrieval to use V2
- [x] Update message saving to use V2 format
- [x] Remove V1 fallback logic
- [x] Create database migration to drop V1 table
- [x] Update frontend to use V2 table
- [x] Fix conversation loading issues
- [ ] Test all chat functionality
- [ ] Clean up compatibility layer (optional)
- [ ] Update API documentation

## Testing

After deploying this migration, test the following:

1. **Direct Agent Chats**: Create new conversations with agents
2. **Conversation History**: Click on existing conversations in sidebar
3. **Message Sending**: Send and receive messages
4. **Real-time Updates**: Verify real-time message subscription works
5. **Workspace Channels**: Test channel-based messaging (if applicable)

## Rollback Plan

⚠️ **Important**: This migration is **destructive**. The old `chat_messages` table will be permanently deleted.

If rollback is needed:
1. Restore database from backup before migration
2. Do NOT run migration `20250105000000_drop_chat_messages_v1.sql`
3. Keep V1 fallback logic in place

## Deployment Command

```powershell
# Push the migration to Supabase
supabase db push --include-all

# Or push specific migration
supabase db push --include-migrations 20250105000000_drop_chat_messages_v1
```

## Post-Migration

After successful deployment:
1. Monitor error logs for any V1 table references
2. Check Supabase Dashboard for query errors
3. Verify chat functionality in production
4. Update team documentation

## Additional Notes

- All existing chat history in V2 table will be preserved
- New messages will automatically use V2 format
- No data migration needed (V2 table already contains all recent data)
- Compatibility layer can be simplified or removed in future updates

---

**Migration Author**: System Update  
**Review Date**: January 5, 2025  
**Status**: Ready for Deployment

