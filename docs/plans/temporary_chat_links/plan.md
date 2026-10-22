# Temporary Chat Links MCP Tool - Implementation Plan

## Executive Summary

This plan outlines the design and implementation of an internal MCP tool that allows agents to generate temporary, time-limited chat links accessible without authentication. These links will provide a chatbot-style interface for external users to interact with specific agents for predefined purposes and durations.

## Use Cases

1. **Employee Daily Planning**: Email/SMS links asking employees to tell AI their daily plans
2. **Daily Accountability**: Scheduled tasks to have employees report on accomplishments
3. **Customer Support**: Temporary support chat links for specific issues
4. **Survey/Feedback Collection**: Time-limited feedback sessions with AI agents
5. **Onboarding Assistance**: Temporary chat access for new employees/customers

## Proposed File Structure

### Database Schema (Migration Files)
- `supabase/migrations/YYYYMMDD_create_temporary_chat_links.sql` (200 lines)
- `supabase/migrations/YYYYMMDD_create_temporary_chat_sessions.sql` (150 lines)

### Backend Services
- `supabase/functions/temporary-chat-mcp/index.ts` (300 lines)
- `supabase/functions/temporary-chat-handler/index.ts` (280 lines)
- `supabase/functions/temporary-chat-api/index.ts` (250 lines)

### Frontend Components
- `src/components/temporary-chat/TempChatInterface.tsx` (280 lines)
- `src/components/temporary-chat/TempChatWindow.tsx` (250 lines)
- `src/pages/TempChatPage.tsx` (200 lines)

### MCP Tool Implementation
- `src/lib/mcp/temporary-chat-tools.ts` (200 lines)
- `src/integrations/temporary-chat/index.ts` (150 lines)

### Utilities and Types
- `src/types/temporary-chat.ts` (100 lines)
- `src/utils/tempChatUtils.ts` (150 lines)

**Total Estimated Lines: ~2,310 lines across 11 files**

## Architecture Overview

### Core Components

1. **MCP Tool Interface**: Agents can generate temporary chat links through tool calls
2. **Public Chat Interface**: Unauthenticated users access chat through temporary links
3. **Session Management**: Time-limited sessions with automatic expiration
4. **Security Layer**: Rate limiting, content filtering, and access controls

### Database Design

#### `temporary_chat_links` table
```sql
CREATE TABLE temporary_chat_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  link_token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  max_sessions INTEGER DEFAULT 1,
  session_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `temporary_chat_sessions` table
```sql
CREATE TABLE temporary_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES temporary_chat_links(id),
  session_token TEXT NOT NULL UNIQUE,
  participant_identifier TEXT, -- email, phone, or anonymous ID
  conversation_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  session_metadata JSONB DEFAULT '{}'
);
```

### Security Considerations

1. **Rate Limiting**: Prevent abuse with session and message limits
2. **Content Filtering**: Basic content validation and spam detection
3. **Expiration Management**: Automatic cleanup of expired links and sessions
4. **Access Logging**: Comprehensive audit trail for security monitoring

### MCP Tool Functions

#### `create_temporary_chat_link`
- **Purpose**: Generate a new temporary chat link
- **Parameters**: 
  - `title`: Display title for the chat
  - `description`: Purpose description
  - `expires_in_hours`: Link expiration time
  - `max_sessions`: Maximum concurrent sessions
- **Returns**: Public URL for the temporary chat

#### `list_temporary_chat_links`
- **Purpose**: List active temporary chat links for the agent
- **Returns**: Array of active links with usage statistics

#### `revoke_temporary_chat_link`
- **Purpose**: Immediately deactivate a temporary chat link
- **Parameters**: `link_id`
- **Returns**: Confirmation of revocation

### Implementation Flow

1. **Link Generation**: Agent calls MCP tool to create temporary link
2. **Link Distribution**: System provides public URL for sharing via email/SMS
3. **Session Initiation**: External user accesses link and starts chat session
4. **Chat Interaction**: Real-time chat with agent through temporary interface
5. **Session Management**: Automatic expiration and cleanup

### Frontend Architecture

#### Public Chat Interface (`/temp-chat/:token`)
- No authentication required
- Lightweight chat interface
- Real-time messaging via Supabase subscriptions
- Mobile-responsive design
- Automatic session expiration handling

#### Agent Management Interface
- Integration with existing agent settings modal
- Link creation and management tools
- Usage analytics and session monitoring
- Bulk link operations

### Integration Points

1. **Existing Chat System**: Leverage current `chat_messages_v2` and `conversation_sessions`
2. **Agent Tools**: Integrate with universal tool executor
3. **Email/SMS Integration**: Use existing communication providers for link distribution
4. **Task Scheduler**: Integration with automated task system for scheduled link generation

## Technical Requirements

### Dependencies
- Supabase Edge Functions for serverless backend
- Real-time subscriptions for live chat
- Existing MCP tool infrastructure
- Current authentication and RLS system

### Performance Considerations
- Efficient session cleanup via cron jobs
- Optimized queries for active session management
- Rate limiting to prevent system abuse
- Message history pagination for long sessions

### Monitoring and Analytics
- Session usage metrics
- Link performance tracking
- Security event logging
- User engagement analytics

## Success Criteria

1. **Functionality**: Agents can create and manage temporary chat links
2. **Security**: Proper access controls and rate limiting
3. **Performance**: Sub-second response times for chat interactions
4. **Reliability**: 99.9% uptime for temporary chat sessions
5. **User Experience**: Intuitive interface for both agents and external users

## Risk Mitigation

1. **Abuse Prevention**: Comprehensive rate limiting and content filtering
2. **Data Privacy**: Automatic cleanup of expired sessions and messages
3. **System Load**: Efficient resource management and cleanup processes
4. **Security**: Regular security audits and monitoring

This implementation will provide a powerful tool for agents to create temporary, secure chat interfaces for external communication while maintaining the security and integrity of the main Agentopia platform.
