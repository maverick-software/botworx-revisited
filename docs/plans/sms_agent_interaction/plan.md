# SMS Agent Interaction Implementation Plan

## Project Overview
Enable two-way SMS communication between users and agents using ClickSend's inbound SMS webhook functionality, allowing users to interact with agents via text messages.

## Goals
1. **Primary**: Enable users to send SMS messages to agents and receive responses
2. **Secondary**: Provide agent-level configuration for SMS interaction preferences
3. **Tertiary**: Maintain conversation context across SMS interactions

## Proposed File Structure

### Backend Components (Supabase)

#### Database Migrations
```
supabase/migrations/
├── 20250915000001_create_sms_interaction_tables.sql
└── 20250915000002_add_sms_settings_to_agents.sql
```

#### Edge Functions
```
supabase/functions/
├── clicksend-inbound-webhook/
│   ├── index.ts                    # Main webhook handler (250-300 lines)
│   ├── types.ts                    # TypeScript interfaces (50 lines)
│   ├── validation.ts               # Request validation logic (100 lines)
│   └── message-processor.ts        # SMS message processing (200 lines)
└── sms-conversation-manager/
    ├── index.ts                    # Conversation management API (200 lines)
    └── phone-utils.ts              # Phone number utilities (100 lines)
```

### Frontend Components

#### SMS Settings UI
```
src/components/modals/agent-settings/
├── sms/
│   ├── SmsInteractionSettings.tsx  # SMS interaction toggle & config (250 lines)
│   ├── SmsConversationList.tsx     # List active SMS conversations (200 lines)
│   └── types.ts                    # TypeScript interfaces (50 lines)
└── ChannelsTab.tsx                 # Enhanced with SMS interaction dropdown (existing file)
```

#### Chat Interface Enhancements
```
src/components/chat/
├── SmsChannelIndicator.tsx         # Show SMS channel in chat (100 lines)
└── SmsMessageBadge.tsx             # SMS-specific message styling (75 lines)
```

#### Hooks and Services
```
src/hooks/
├── useSmsConversations.ts          # SMS conversation management (150 lines)
└── useSmsSettings.ts               # SMS settings management (100 lines)

src/services/
└── smsService.ts                   # SMS-related API calls (200 lines)
```

## Database Schema Design

### Core Tables

#### sms_conversations
```sql
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  phone_number TEXT NOT NULL,
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0,
  UNIQUE(agent_id, phone_number)
);
```

#### agent_sms_settings
```sql
CREATE TABLE agent_sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) UNIQUE,
  sms_interaction_enabled BOOLEAN DEFAULT false,
  auto_respond BOOLEAN DEFAULT true,
  welcome_message TEXT DEFAULT 'Hello! I''m an AI agent. How can I help you today?',
  response_timeout_minutes INTEGER DEFAULT 30,
  max_daily_conversations INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Technical Architecture

### Message Flow
1. **Inbound SMS**: ClickSend → Webhook → Message Processor → Chat System
2. **Outbound SMS**: Agent Chat → ClickSend API → User Phone
3. **Conversation Tracking**: Phone Number ↔ Conversation ID mapping

### Security Model
- **Webhook Validation**: Verify ClickSend origin
- **Rate Limiting**: Per-phone-number limits
- **Phone Number Sanitization**: Consistent international format
- **Privacy**: Hash phone numbers for storage

### Integration Points
- **Existing ClickSend API**: Leverage current outbound SMS
- **Chat Message System**: Use `chat_messages_v2` table
- **Agent Permissions**: Extend current permission model
- **UI Components**: Enhance existing ChannelsTab

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Database schema creation
- Webhook endpoint implementation
- Basic message routing
- Phone number utilities

### Phase 2: UI Integration (Week 2)
- SMS interaction toggle in ChannelsTab
- Basic settings configuration
- Chat interface indicators
- SMS conversation management

### Phase 3: Enhanced Features (Week 3)
- Auto-response configuration
- Conversation analytics
- Error handling and monitoring
- Testing and refinement

## File Size Constraints
All files designed to stay between 200-300 lines maximum:
- **Large functions split**: Message processing separated from webhook handling
- **Modular design**: Utilities and types in separate files
- **Component decomposition**: UI split into focused components

## Success Criteria
1. **Functional**: Users can send SMS and receive agent responses
2. **Configurable**: Agents can enable/disable SMS interaction
3. **Persistent**: Conversations maintain context across messages
4. **Secure**: Proper validation and rate limiting
5. **Scalable**: Handles multiple concurrent SMS conversations

## Risk Mitigation
- **Cost Control**: Rate limiting and daily conversation caps
- **Spam Prevention**: Phone number validation and blacklisting
- **Privacy Compliance**: Secure phone number handling
- **Error Recovery**: Comprehensive error handling and logging

## Dependencies
- **ClickSend Account**: Webhook configuration required
- **Supabase Edge Functions**: Webhook hosting
- **Existing ClickSend Integration**: Outbound SMS capability
- **Database Access**: Schema modification permissions

## Testing Strategy
- **Unit Tests**: Individual function testing
- **Integration Tests**: End-to-end SMS flow
- **Load Testing**: Webhook performance
- **User Acceptance**: Real SMS conversation testing

This plan provides a comprehensive roadmap for implementing SMS agent interaction while maintaining code quality, security, and scalability standards.
