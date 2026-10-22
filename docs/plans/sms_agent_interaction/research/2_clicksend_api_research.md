# ClickSend API Research - Inbound SMS Implementation

## Overview
This document researches ClickSend's inbound SMS capabilities and webhook configuration for implementing two-way SMS communication.

## ClickSend Inbound SMS Documentation Analysis

### API Endpoints (from https://developers.clicksend.com/docs/messaging/sms/other/view-inbound-sms)

**View Inbound SMS (Polling Method):**
```
GET /v3/sms/inbound
```

**Webhook Configuration:**
- Dashboard: ClickSend Dashboard > Profile > Messaging Settings > SMS & MMS > Inbound Rules
- Action Types: "Poll" or "URL" (webhook)
- URL Requirements: HTTPS endpoint required

### Webhook Data Format

**Content-Type**: `application/x-www-form-urlencoded`

**Expected Fields** (based on ClickSend documentation):
```
message_id: Unique message identifier
from: Sender's phone number
to: Recipient's phone number (your ClickSend number)
body: Message content
timestamp: When message was received
keyword: Any keyword matching rules
```

## Implementation Strategy

### Webhook Endpoint Design
**Location**: `supabase/functions/clicksend-inbound-webhook/index.ts`

**Security Requirements:**
1. HTTPS endpoint (Supabase Edge Functions provide this)
2. Request validation (verify from ClickSend)
3. Rate limiting and abuse prevention
4. Phone number sanitization

### Message Processing Flow
1. **Receive Webhook**: Parse inbound SMS data
2. **Phone Number Lookup**: Find existing conversation or create new one
3. **Message Creation**: Insert into `chat_messages_v2` table
4. **Agent Notification**: Trigger agent response if configured
5. **Response Generation**: Allow agent to respond via existing chat interface

## Database Schema Requirements

### SMS Conversation Mapping
```sql
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  phone_number TEXT NOT NULL, -- International format: +1234567890
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Constraints
  UNIQUE(agent_id, phone_number),
  
  -- Indexes
  INDEX idx_sms_conversations_agent_phone (agent_id, phone_number),
  INDEX idx_sms_conversations_conversation (conversation_id)
);
```

### SMS Interaction Settings
```sql
CREATE TABLE agent_sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) UNIQUE,
  sms_interaction_enabled BOOLEAN DEFAULT false,
  auto_respond BOOLEAN DEFAULT true,
  response_timeout_minutes INTEGER DEFAULT 30,
  welcome_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Webhook Implementation Details

### Edge Function Structure
```typescript
// supabase/functions/clicksend-inbound-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

serve(async (req) => {
  // 1. Validate request method and headers
  // 2. Parse form data
  // 3. Validate phone number format
  // 4. Find or create SMS conversation
  // 5. Insert message into chat system
  // 6. Trigger agent notification
  // 7. Return success response
})
```

### Message Format Integration
**Convert SMS to Chat Message:**
```typescript
const chatMessage = {
  conversation_id: smsConversation.conversation_id,
  session_id: smsConversation.session_id,
  sender_user_id: null, // SMS users are external
  sender_agent_id: null,
  role: 'user',
  content: {
    type: 'text',
    text: smsBody,
    channel: 'sms',
    phone_number: fromPhone
  },
  metadata: {
    channel: 'sms',
    clicksend_message_id: messageId,
    phone_number: fromPhone,
    inbound: true
  }
}
```

## Security Considerations

### Webhook Validation
1. **IP Whitelist**: Verify requests come from ClickSend IPs
2. **Signature Validation**: If ClickSend provides webhook signatures
3. **Rate Limiting**: Prevent spam and abuse
4. **Phone Number Validation**: Ensure valid international format

### Privacy and Compliance
1. **Phone Number Storage**: Hash or encrypt phone numbers
2. **Message Retention**: Implement retention policies
3. **Consent Tracking**: Track user consent for SMS communication
4. **GDPR/Privacy**: Handle data deletion requests

## Cost Management

### ClickSend Pricing Considerations
- **Inbound SMS**: Usually free or low cost
- **Outbound SMS**: Per-message charges
- **Webhook Calls**: Ensure efficient processing to minimize compute costs

### Rate Limiting Strategy
```typescript
// Implement per-phone-number rate limiting
const rateLimits = {
  messagesPerHour: 10,
  messagesPerDay: 50,
  conversationsPerDay: 5
}
```

## Configuration Requirements

### ClickSend Dashboard Setup
1. **Login**: https://dashboard.clicksend.com/
2. **Navigate**: Profile > Messaging Settings > SMS & MMS > Inbound Rules
3. **Add Rule**: 
   - Action: "URL"
   - URL: `https://[project].supabase.co/functions/v1/clicksend-inbound-webhook`
   - Method: POST
4. **Save Configuration**

### Environment Variables
```env
CLICKSEND_WEBHOOK_SECRET=your_webhook_secret
CLICKSEND_API_USERNAME=your_api_username
CLICKSEND_API_KEY=your_api_key
```

## Testing Strategy

### Webhook Testing
1. **ngrok/Local Testing**: Use ngrok for local development
2. **Mock Webhooks**: Create test webhook payloads
3. **Integration Tests**: End-to-end SMS flow testing
4. **Load Testing**: Webhook performance under load

### User Flow Testing
1. **New Conversation**: SMS from unknown number
2. **Existing Conversation**: SMS from known number
3. **Agent Response**: Agent replies via chat interface
4. **Multi-turn Conversation**: Extended SMS conversation

## Error Handling

### Webhook Failures
- **Retry Logic**: ClickSend retry behavior
- **Dead Letter Queue**: Failed message handling
- **Error Logging**: Comprehensive error tracking
- **Fallback**: Polling as backup method

### Edge Cases
- **Invalid Phone Numbers**: Reject and log
- **Duplicate Messages**: Deduplication logic
- **Agent Unavailable**: Auto-response or queuing
- **Conversation Limits**: Handle conversation caps

## Implementation Priority

### Phase 1: Core Functionality
1. Webhook endpoint creation
2. Basic message routing
3. Database schema implementation
4. Simple UI toggle

### Phase 2: Enhanced Features
1. Auto-response configuration
2. Conversation management UI
3. Analytics and reporting
4. Advanced security features

### Phase 3: Advanced Features
1. Multi-agent routing
2. Conversation handoff
3. Rich media support (MMS)
4. Integration with other channels

## Success Metrics

### Technical Metrics
- Webhook response time < 200ms
- Message delivery rate > 99%
- Zero data loss
- Conversation continuity accuracy

### Business Metrics
- User engagement via SMS
- Agent productivity improvement
- Customer satisfaction scores
- Cost per conversation

## Conclusion

ClickSend's inbound SMS capabilities are well-documented and suitable for implementing two-way SMS communication. The webhook approach provides real-time message delivery, and the existing Agentopia architecture can accommodate this feature with minimal structural changes.

**Key Implementation Success Factors:**
1. Robust webhook security and validation
2. Proper phone number to conversation mapping
3. Seamless integration with existing chat system
4. Clear user interface for configuration
5. Comprehensive error handling and monitoring
