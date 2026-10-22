# Temporary Chat Links

Gofr Agents' Temporary Chat Links feature enables agents to create secure, time-limited public chat interfaces that can be shared via email, SMS, or other channels without requiring user authentication.

## Overview

Temporary Chat Links provide a powerful way to extend your AI agents' reach beyond authenticated users. Perfect for employee check-ins, customer support, feedback collection, and onboarding assistance, these links create isolated chat sessions that expire automatically.

## Key Features

### 🔗 **Secure Link Generation**
- Cryptographically secure tokens with built-in expiration
- Customizable session limits and message quotas
- Domain and IP restrictions for enhanced security

### 🎯 **Use Case Flexibility**
- **Employee Check-ins**: Daily planning and accountability sessions
- **Customer Support**: Temporary support chats without account creation
- **Feedback Collection**: Anonymous feedback gathering with analytics
- **Onboarding**: Guided assistance for new users or employees

### 🛡️ **Enterprise Security**
- Multi-layer rate limiting and abuse prevention
- Session isolation with no data cross-contamination
- Automatic cleanup of expired sessions and data
- Comprehensive audit logging for compliance

### 📱 **Mobile-Optimized Experience**
- Responsive design for all device types
- Real-time messaging via Server-Sent Events
- Offline-friendly with connection recovery
- Touch-optimized interface for mobile users

## Architecture

### Database Schema
The system extends Gofr Agents' existing chat infrastructure with two new tables:

- **`temporary_chat_links`**: Stores link configuration, expiration, and usage tracking
- **`temporary_chat_sessions`**: Manages individual chat sessions with security metadata

### API Endpoints
Four specialized Edge Functions handle temporary chat functionality:

1. **`temporary-chat-mcp`**: MCP tool interface for authenticated users
2. **`temporary-chat-api`**: Public API for session validation and creation
3. **`temporary-chat-events`**: Server-Sent Events for real-time messaging
4. **`temporary-chat-handler`**: Message processing and agent integration

### Security Features

#### Token Security
- **Cryptographic Generation**: Uses `crypto.randomUUID()` with additional entropy
- **URL-Safe Encoding**: Base64URL encoding for clean, shareable links
- **Expiration Validation**: Database-level timestamp checking
- **Format Validation**: Strict pattern matching to prevent enumeration

#### Rate Limiting
- **Per-Session Limits**: Configurable message rate limits per session
- **IP-Based Protection**: Rate limiting based on client IP address
- **Global Throttling**: System-wide protection against abuse
- **Adaptive Limits**: Dynamic adjustment based on usage patterns

#### Content Security
- **Input Sanitization**: Comprehensive message content validation
- **XSS Prevention**: HTML content filtering and sanitization
- **File Upload Restrictions**: Configurable file type and size limits
- **Content Pattern Detection**: Automated detection of suspicious content

## Management Interface

### Link Creation
Authenticated users can create temporary chat links through an intuitive interface:

```typescript
// Example link configuration
{
  title: "Daily Check-in Chat",
  description: "Share your plans for today",
  expires_in_hours: 4,
  max_sessions: 1,
  max_messages_per_session: 20,
  session_timeout_minutes: 30,
  rate_limit_per_minute: 5,
  welcome_message: "Hi! Tell me about your plans for today."
}
```

### Analytics Dashboard
Comprehensive analytics provide insights into link usage:

- **Usage Metrics**: Session counts, message volumes, and engagement rates
- **Geographic Data**: Anonymous location analytics for usage patterns
- **Performance Tracking**: Response times and connection quality metrics
- **Security Events**: Rate limiting triggers and abuse detection alerts

### Link Management
- **Bulk Operations**: Create, update, or deactivate multiple links
- **Template System**: Predefined configurations for common use cases
- **Sharing Tools**: Direct integration with email and SMS systems
- **Access Controls**: Fine-grained permissions for team collaboration

## Public Chat Interface

### User Experience
The public chat interface provides a clean, focused experience:

- **No Authentication Required**: Instant access via shared link
- **Agent Branding**: Customizable appearance with agent information
- **Real-time Messaging**: Immediate responses with typing indicators
- **Session Status**: Clear indication of remaining messages and time
- **Mobile Optimized**: Touch-friendly interface for all devices

### Connection Management
- **Automatic Reconnection**: Handles network interruptions gracefully
- **Connection Status**: Visual indicators for connection health
- **Fallback Mechanisms**: Polling fallback if Server-Sent Events fail
- **Timeout Handling**: Graceful session expiration with user notification

## Integration with Existing Systems

### MCP Tool Integration
Temporary chat tools integrate seamlessly with Gofr Agents' Universal Tool Executor:

```typescript
// Available MCP tools
const TEMPORARY_CHAT_TOOLS = [
  'create_temporary_chat_link',
  'list_temporary_chat_links',
  'update_temporary_chat_link',
  'delete_temporary_chat_link',
  'get_temporary_chat_analytics',
  'manage_temporary_chat_session'
];
```

### Email/SMS Distribution
Links can be distributed through existing integrations:

- **Gmail Integration**: Send links via Gmail with templates
- **SMTP Services**: Bulk distribution via SendGrid, Mailgun
- **SMS Providers**: Text message distribution (when integrated)
- **Slack Integration**: Share links in Slack channels
- **Microsoft Teams**: Integration with Teams workflows

### Agent Scheduling
Combine with Gofr Agents' task scheduling for automated workflows:

```javascript
// Example: Daily check-in automation
{
  schedule: "0 9 * * 1-5", // 9 AM weekdays
  action: "create_and_send_temp_chat_link",
  parameters: {
    template: "daily_checkin",
    recipients: ["team@company.com"],
    expires_in_hours: 4
  }
}
```

## Use Case Examples

### 1. Employee Daily Check-ins
**Scenario**: HR wants employees to share daily plans with an AI assistant

**Configuration**:
- Expires: 4 hours after creation
- Max sessions: 1 per link
- Max messages: 20
- Automated email distribution at 9 AM

**Workflow**:
1. Agent creates personalized links for each employee
2. Links sent via email with personal greeting
3. Employees chat about their daily plans
4. AI provides encouragement and suggestions
5. Analytics track engagement and completion rates

### 2. Customer Support Escalation
**Scenario**: Provide temporary support chat for urgent customer issues

**Configuration**:
- Expires: 2 hours after creation
- Max sessions: 5 concurrent
- Max messages: 50 per session
- Rate limit: 15 messages per minute

**Workflow**:
1. Support agent creates link for customer
2. Link shared via email or support ticket
3. Customer chats directly with specialized AI agent
4. Session data captured for follow-up
5. Automatic escalation to human if needed

### 3. Anonymous Feedback Collection
**Scenario**: Collect employee feedback on company initiatives

**Configuration**:
- Expires: 7 days after creation
- Max sessions: 100
- Max messages: 25 per session
- Anonymous usage tracking

**Workflow**:
1. HR creates feedback collection link
2. Link shared via company newsletter
3. Employees provide anonymous feedback
4. AI asks follow-up questions for clarity
5. Analytics dashboard shows sentiment trends

## Security Considerations

### Data Privacy
- **Anonymous Sessions**: No personal identification required
- **Data Minimization**: Collect only necessary information
- **Automatic Cleanup**: Expired data removed automatically
- **Audit Trails**: Comprehensive logging for compliance

### Abuse Prevention
- **IP Monitoring**: Track and limit suspicious IP addresses
- **Content Filtering**: Detect and block malicious content
- **Session Limits**: Prevent resource exhaustion attacks
- **Geographic Blocking**: Optional country-level restrictions

### Compliance Features
- **GDPR Compliance**: Right to erasure and data portability
- **CCPA Support**: California privacy law compliance
- **HIPAA Ready**: Healthcare data protection capabilities
- **SOC 2 Aligned**: Security and availability controls

## Performance Characteristics

### Scalability
- **Horizontal Scaling**: Edge Functions scale automatically
- **Database Optimization**: Efficient indexing and query patterns
- **Connection Pooling**: Optimal resource utilization
- **CDN Integration**: Global content delivery for assets

### Monitoring
- **Real-time Metrics**: Connection counts and response times
- **Error Tracking**: Comprehensive error logging and alerting
- **Performance Analytics**: Detailed performance insights
- **Capacity Planning**: Usage trend analysis and forecasting

## Getting Started

### Prerequisites
- Gofr Agents installation with MCP tool support
- Supabase Edge Functions enabled
- Email integration configured (optional)

### Setup Steps (For System Administrators)
1. **Database Migration**: Run temporary chat schema migrations
   ```bash
   supabase db push --include-all
   ```

2. **Edge Function Deployment**: Deploy the four Edge Functions
   ```bash
   supabase functions deploy temporary-chat-mcp
   supabase functions deploy temporary-chat-api
   supabase functions deploy temporary-chat-events
   supabase functions deploy temporary-chat-handler
   ```

3. **MCP Tool Registration**: Tools are automatically registered in the Universal Tool Executor
4. **Frontend Integration**: The feature is integrated into the agent settings modal
5. **Security Configuration**: Default rate limits and security settings are production-ready

### User Setup (For Agent Owners)
1. **Enable the Feature**: 
   - Open your agent in the chat interface
   - Click the settings icon (gear) in the top-right corner
   - Navigate to the "Tools" tab
   - Enable "Temporary Chat Links" toggle
   - The system will automatically configure the necessary tools

2. **Create Your First Link**: 
   - In your agent chat, ask: "Create a temporary chat link for customer support"
   - The agent will generate a secure URL you can share
   - Example response: `Your temporary chat link: https://agentopia.netlify.app/temp-chat/abc123...`

3. **Share and Monitor**: 
   - Share the URL via email, website, or any communication channel
   - Monitor conversations in your regular agent chat history
   - All anonymous messages are clearly marked and tracked

### Testing
```bash
# Run comprehensive test suite
npm run test:temp-chat

# Test specific components
npm run test:temp-chat:security
npm run test:temp-chat:performance
npm run test:temp-chat:integration
```

## Future Enhancements

### Planned Features
- **Video Chat Integration**: WebRTC support for video calls
- **File Sharing**: Secure file upload and sharing capabilities
- **Multi-language Support**: Internationalization for global usage
- **Advanced Analytics**: Machine learning insights on usage patterns

### Integration Roadmap
- **Salesforce Integration**: CRM integration for customer support
- **Zendesk Plugin**: Help desk system integration
- **Microsoft Teams Bot**: Native Teams chat integration
- **WhatsApp Business**: WhatsApp chat link support

---

Temporary Chat Links represent a significant expansion of Gofr Agents' capabilities, enabling AI agents to serve users beyond the traditional authenticated experience while maintaining enterprise-grade security and compliance standards.


