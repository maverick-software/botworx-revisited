# SMS Agent Interaction - Codebase Analysis Research

## Overview
This research document analyzes the current Agentopia codebase to understand how to implement two-way SMS communication between users and agents via ClickSend.

## Conversation Tracking System

### Current Conversation Structure
Based on the schema analysis, Agentopia uses a sophisticated conversation tracking system:

**Key Tables:**
- `chat_messages_v2`: Main message storage with conversation_id and session_id
- `conversation_sessions`: Session management linking users/agents to conversations
- `chat_channels`: Channel management for different communication methods

**Conversation ID Structure:**
```sql
-- chat_messages_v2 schema
conversation_id UUID NOT NULL,
session_id UUID NOT NULL,
sender_user_id UUID REFERENCES auth.users(id),
sender_agent_id UUID REFERENCES agents(id),
```

**Critical Finding**: Yes, conversation tracking is fully possible! Each conversation has:
1. **conversation_id**: Unique identifier for the entire conversation
2. **session_id**: Unique identifier for specific session within conversation  
3. **User/Agent linking**: Direct foreign key relationships

## Current Channels System

### ChannelsTab Implementation
Location: `src/components/modals/agent-settings/ChannelsTab.tsx`

**Current SMS Support:**
- SMS channel exists in the UI (`sms_enabled` boolean)
- Uses `getConnectedProviders('sms')` function
- Supports provider selection and credential management
- Has infrastructure for SMS provider permissions

**SMS Provider Mapping:**
```typescript
providers: getConnectedProviders('sms')
```

**Key Functions:**
- `openSmsProviderModal`: Handles SMS provider selection
- `mapScopeToCapability`: Maps OAuth scopes to tool names for ClickSend

## ClickSend Integration Status

### Current Implementation
- ClickSend SMS sending is fully implemented
- Edge function: `supabase/functions/clicksend-api/index.ts`
- MCP tool integration complete
- Webhook receiving capability: **NOT IMPLEMENTED**

### ClickSend API Capabilities (from web research)
**Inbound SMS Methods:**
1. **Polling**: Periodically fetch messages via API
2. **Webhook**: Real-time push to specified URL

**Webhook Configuration:**
- Requires HTTPS endpoint
- Receives POST data in `x-www-form-urlencoded` format
- Configured via ClickSend Dashboard > Messaging Settings > Inbound Rules

## Database Schema Analysis

### Required Tables for SMS Interaction
**Existing Tables (can be leveraged):**
- `chat_messages_v2`: Store SMS messages as conversation messages
- `conversation_sessions`: Track SMS-based conversations
- `user_integration_credentials`: ClickSend credentials already supported
- `agent_integration_permissions`: ClickSend permissions already configured

**Missing Tables (need to create):**
- `sms_conversations`: Map phone numbers to conversation_ids
- `sms_interaction_settings`: Per-agent SMS interaction configuration

## Technical Architecture

### Message Flow Design
1. **Outbound SMS**: Agent → ClickSend API → User's phone
2. **Inbound SMS**: User's phone → ClickSend → Webhook → Agentopia → Agent conversation

### Conversation Linking Strategy
**Phone Number to Conversation Mapping:**
```sql
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  phone_number TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  UNIQUE(agent_id, phone_number)
);
```

## Integration Points

### Frontend Changes Required
1. **ChannelsTab Enhancement**: Add SMS interaction toggle dropdown
2. **Agent Settings**: SMS interaction configuration UI
3. **Chat Interface**: Display SMS channel indicators

### Backend Changes Required
1. **Webhook Handler**: New edge function for ClickSend webhooks
2. **Database Schema**: SMS conversation mapping tables
3. **Message Router**: Route inbound SMS to correct conversations

## Risk Assessment

### Technical Risks
- **Phone Number Validation**: Ensure consistent international format
- **Conversation Persistence**: Handle long-running SMS conversations
- **Rate Limiting**: ClickSend API limits and costs
- **Security**: Webhook authentication and validation

### Business Risks
- **SMS Costs**: Per-message charges from ClickSend
- **Privacy**: Phone number storage and handling
- **Spam Prevention**: Prevent abuse of SMS channels

## Feasibility Conclusion

**✅ HIGHLY FEASIBLE**

The existing Agentopia architecture provides excellent foundation:
- Conversation tracking system is robust and extensible
- ClickSend integration is already implemented for outbound SMS
- Channel management system supports new communication methods
- Database schema can accommodate SMS conversation mapping

**Key Success Factors:**
1. Proper phone number to conversation_id mapping
2. Secure webhook implementation
3. Clear user consent and privacy handling
4. Cost management and rate limiting

## Next Steps
1. Create detailed implementation plan
2. Design database schema extensions
3. Plan webhook security and validation
4. Design user interface enhancements
