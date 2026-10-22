# ClickSend API Research

## Research Date
September 11, 2025

## Purpose
Research ClickSend API capabilities, endpoints, and authentication to design the SMS/MMS integration for Agentopia.

## ClickSend API Overview

### 1. Service Description
ClickSend is a global SMS, MMS, Voice, and Email communication platform that provides:
- **SMS Messaging**: Text messages to mobile phones worldwide
- **MMS Messaging**: Multimedia messages with images, videos, audio
- **Voice Calls**: Text-to-speech and voice broadcasting
- **Email Services**: Transactional and marketing emails
- **Postal Services**: Physical mail delivery

### 2. Authentication
ClickSend uses **HTTP Basic Authentication** with API credentials:
- **Username**: ClickSend account username
- **API Key**: Generated from ClickSend dashboard
- **Format**: `Authorization: Basic base64(username:api_key)`

### 3. API Endpoints Structure

#### Base URL
```
https://rest.clicksend.com/v3/
```

#### Key Endpoints for Integration

**SMS Endpoints:**
```
POST /sms/send              - Send SMS messages
GET  /sms/history           - Get SMS history
GET  /sms/price             - Get SMS pricing
GET  /sms/receipts          - Get delivery receipts
```

**MMS Endpoints:**
```
POST /mms/send              - Send MMS messages
GET  /mms/history           - Get MMS history
GET  /mms/price             - Get MMS pricing
GET  /mms/receipts          - Get delivery receipts
```

**Account Endpoints:**
```
GET  /account               - Get account information
GET  /account/balance       - Get account balance
```

### 4. Request/Response Format

#### SMS Send Request
```json
{
  "messages": [
    {
      "source": "sdk",
      "from": "YourCompany",
      "to": "+1234567890",
      "body": "Hello, this is a test SMS message!",
      "schedule": null,
      "custom_string": "agent_message_123"
    }
  ]
}
```

#### SMS Send Response
```json
{
  "http_code": 200,
  "response_code": "SUCCESS",
  "response_msg": "Messages queued for delivery.",
  "data": {
    "total_price": 0.1,
    "total_count": 1,
    "queued_count": 1,
    "messages": [
      {
        "direction": "out",
        "date": 1441154440,
        "to": "+1234567890",
        "from": "YourCompany",
        "body": "Hello, this is a test SMS message!",
        "status": "SUCCESS",
        "message_id": "BF7AD270-0DE2-418B-B606-71D527D9C1AE",
        "message_parts": 1,
        "message_price": 0.1,
        "custom_string": "agent_message_123"
      }
    ]
  }
}
```

#### MMS Send Request
```json
{
  "messages": [
    {
      "source": "sdk",
      "from": "YourCompany", 
      "to": "+1234567890",
      "subject": "MMS Subject",
      "body": "Check out this image!",
      "media": [
        "https://example.com/image.jpg"
      ]
    }
  ]
}
```

### 5. Error Handling

#### Common Error Codes
```json
{
  "http_code": 400,
  "response_code": "BAD_REQUEST",
  "response_msg": "Invalid phone number format",
  "data": {}
}
```

#### Error Response Structure
- **http_code**: HTTP status code
- **response_code**: ClickSend-specific error code
- **response_msg**: Human-readable error message
- **data**: Additional error details

### 6. Rate Limits and Quotas
- **Rate Limits**: Varies by account type (typically 1000-10000 requests/hour)
- **Message Limits**: Based on account balance and credit limits
- **Concurrent Requests**: Up to 10 simultaneous API calls

### 7. Webhook Support
ClickSend supports webhooks for:
- **Delivery Receipts**: SMS/MMS delivery status updates
- **Inbound Messages**: Receive SMS/MMS replies
- **Account Events**: Balance alerts, quota notifications

## Integration Requirements

### 1. API Key Storage
- **Security**: Store API key in Supabase Vault (encrypted)
- **Format**: Store both username and API key separately
- **Access**: Service-role only access for decryption

### 2. Tool Capabilities
```typescript
const CLICKSEND_TOOLS = {
  send_sms: {
    name: 'clicksend_send_sms',
    description: 'Send SMS message via ClickSend',
    parameters: {
      type: 'object',
      properties: {
        to: { 
          type: 'string', 
          description: 'Recipient phone number in international format (+1234567890)' 
        },
        body: { 
          type: 'string', 
          description: 'SMS message content (max 160 characters for single SMS)' 
        },
        from: { 
          type: 'string', 
          description: 'Sender ID (optional, defaults to account default)' 
        }
      },
      required: ['to', 'body']
    }
  },
  
  send_mms: {
    name: 'clicksend_send_mms',
    description: 'Send MMS message with media via ClickSend',
    parameters: {
      type: 'object',
      properties: {
        to: { 
          type: 'string', 
          description: 'Recipient phone number in international format' 
        },
        body: { 
          type: 'string', 
          description: 'MMS message content' 
        },
        subject: { 
          type: 'string', 
          description: 'MMS subject line (optional)' 
        },
        media_url: { 
          type: 'string', 
          description: 'URL of media file to attach (image, video, audio)' 
        }
      },
      required: ['to', 'body', 'media_url']
    }
  },
  
  get_balance: {
    name: 'clicksend_get_balance',
    description: 'Check ClickSend account balance',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  
  get_sms_history: {
    name: 'clicksend_get_sms_history',
    description: 'Get SMS delivery history and status',
    parameters: {
      type: 'object',
      properties: {
        limit: { 
          type: 'integer', 
          description: 'Number of messages to retrieve (default 10, max 1000)' 
        },
        page: { 
          type: 'integer', 
          description: 'Page number for pagination (default 1)' 
        }
      },
      required: []
    }
  }
}
```

### 3. Error Handling Strategy
- **LLM-Friendly Errors**: Convert API errors to interactive questions
- **Retry Logic**: Implement 3-attempt retry for recoverable errors
- **Validation**: Phone number format validation before API calls
- **Quota Monitoring**: Check balance before sending messages

### 4. Webhook Integration (Future)
- **Delivery Status**: Update message status when delivery confirmed
- **Inbound Messages**: Process incoming SMS/MMS replies
- **Account Alerts**: Notify when balance low or quota exceeded

## Security Considerations

### 1. Credential Security
- **Vault Storage**: API credentials encrypted in Supabase Vault
- **Service Role**: Only server-side functions can decrypt credentials
- **No Client Exposure**: API keys never sent to frontend

### 2. Message Privacy
- **User Scoped**: Users only access their own SMS/MMS history
- **Agent Permissions**: Agents only send messages when authorized
- **Audit Logging**: All SMS/MMS operations logged for compliance

### 3. Rate Limiting
- **Per-Agent Limits**: Prevent agents from exceeding reasonable usage
- **Cost Controls**: Monitor and limit messaging costs per user
- **Abuse Prevention**: Detect and prevent spam or misuse

## Implementation Architecture

### 1. Database Schema
```sql
-- Service provider entry
INSERT INTO service_providers (
  name = 'clicksend_sms',
  display_name = 'ClickSend SMS/MMS',
  provider_type = 'api_key',
  configuration_metadata = jsonb
);

-- Integration capabilities
INSERT INTO integration_capabilities (
  capability_key = 'clicksend_send_sms',
  display_label = 'Send SMS'
);
```

### 2. Edge Function Structure
```typescript
// supabase/functions/clicksend-api/index.ts
export const handler = async (req) => {
  const { action, agent_id, parameters } = await req.json();
  
  switch (action) {
    case 'send_sms':
      return await sendSMS(agent_id, parameters);
    case 'send_mms':
      return await sendMMS(agent_id, parameters);
    case 'get_balance':
      return await getBalance(agent_id);
    case 'get_sms_history':
      return await getSMSHistory(agent_id, parameters);
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
};
```

### 3. Frontend Components
- **ClickSendSetupModal**: API key configuration interface
- **AgentSMSPermissions**: Grant SMS/MMS access to agents
- **SMSToolsTab**: Agent chat page SMS tools interface
- **CredentialsPage**: ClickSend connection management

## Next Steps
1. **Database Schema Design**: Plan specific table updates
2. **Edge Function Implementation**: Build ClickSend API integration
3. **UI Component Development**: Create setup and permissions interfaces
4. **Testing Strategy**: Plan comprehensive SMS/MMS testing
5. **Documentation**: Create user guides and troubleshooting docs

## References
- **ClickSend API Documentation**: https://developers.clicksend.com/
- **Agent Tool Use Protocol**: Established patterns for tool integration
- **SerperAPI Integration**: Reference for API key-based integrations
- **Security Architecture**: Supabase Vault integration patterns
