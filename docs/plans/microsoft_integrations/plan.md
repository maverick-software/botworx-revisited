# Microsoft Integrations Implementation Plan

**Date:** September 7, 2025  
**Plan ID:** microsoft_integrations_20250907  
**Priority:** HIGH – Major Platform Integration Expansion  
**Protocol:** Plan & Execute  

## Executive Summary

**Objective:** Implement comprehensive Microsoft integrations for Teams, Outlook, and OneDrive, enabling Agentopia agents to interact with Microsoft 365 services through the unified Microsoft Graph API. This integration will provide agents with communication, email, and file management capabilities across the Microsoft ecosystem.

**Key Outcomes:**
- Microsoft Teams integration for messaging, channels, and meetings
- Microsoft Outlook integration for email and calendar management  
- Microsoft OneDrive integration for file storage and sharing
- Unified OAuth flow using Microsoft Graph API
- Secure credential management via Supabase Vault
- MCP tool integration following existing patterns
- Comprehensive UI components for setup and management

## Project Scope

### Core Features

#### 1. Microsoft Teams Integration
- **Channel Messaging:** Send and read messages in team channels
- **Direct Messaging:** Send and receive direct messages and group chats
- **Meeting Management:** Create, schedule, and manage Teams meetings
- **Team Management:** List teams, channels, and members
- **File Sharing:** Share files within Teams conversations

#### 2. Microsoft Outlook Integration  
- **Email Operations:** Send, read, search, and manage emails
- **Calendar Management:** Create, update, and manage calendar events
- **Contact Management:** Access and manage contact information
- **Folder Management:** Organize emails with folders and rules
- **Attachment Handling:** Send and receive email attachments

#### 3. Microsoft OneDrive Integration
- **File Operations:** Upload, download, and manage files
- **Folder Management:** Create and organize folder structures
- **Sharing:** Generate sharing links and manage permissions
- **Search:** Search files by name, content, and metadata
- **Collaboration:** Real-time collaboration features

### Success Criteria
- ✅ Users can connect Microsoft accounts with one-click OAuth
- ✅ Agents can perform operations across all three services
- ✅ All credentials stored securely in Supabase Vault
- ✅ Complete audit trail for compliance and debugging
- ✅ Responsive UI following existing design patterns
- ✅ MCP tool integration with proper permission management

## Technical Architecture

### 1. Database Schema Extensions

#### Service Providers Configuration
```sql
-- Microsoft Teams
INSERT INTO service_providers (
  name, display_name, 
  authorization_endpoint, token_endpoint,
  scopes_supported, configuration_metadata
) VALUES (
  'microsoft-teams', 'Microsoft Teams',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  '[
    "https://graph.microsoft.com/Team.ReadBasic.All",
    "https://graph.microsoft.com/ChannelMessage.Read.All", 
    "https://graph.microsoft.com/ChannelMessage.Send",
    "https://graph.microsoft.com/Chat.ReadWrite",
    "https://graph.microsoft.com/OnlineMeetings.ReadWrite"
  ]',
  '{
    "api_base_url": "https://graph.microsoft.com/v1.0",
    "tenant": "common",
    "resource": "https://graph.microsoft.com"
  }'
);

-- Microsoft Outlook  
INSERT INTO service_providers (
  name, display_name,
  authorization_endpoint, token_endpoint, 
  scopes_supported, configuration_metadata
) VALUES (
  'microsoft-outlook', 'Microsoft Outlook',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  '[
    "https://graph.microsoft.com/Mail.ReadWrite",
    "https://graph.microsoft.com/Mail.Send", 
    "https://graph.microsoft.com/Calendars.ReadWrite",
    "https://graph.microsoft.com/Contacts.ReadWrite"
  ]',
  '{
    "api_base_url": "https://graph.microsoft.com/v1.0",
    "tenant": "common", 
    "resource": "https://graph.microsoft.com"
  }'
);

-- Microsoft OneDrive
INSERT INTO service_providers (
  name, display_name,
  authorization_endpoint, token_endpoint,
  scopes_supported, configuration_metadata  
) VALUES (
  'microsoft-onedrive', 'Microsoft OneDrive',
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', 
  'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  '[
    "https://graph.microsoft.com/Files.ReadWrite",
    "https://graph.microsoft.com/Files.ReadWrite.All",
    "https://graph.microsoft.com/Sites.ReadWrite.All"
  ]',
  '{
    "api_base_url": "https://graph.microsoft.com/v1.0",
    "tenant": "common",
    "resource": "https://graph.microsoft.com"  
  }'
);
```

### 2. Frontend Component Structure

#### Directory Layout
```
src/integrations/
├── microsoft-teams/
│   ├── components/
│   │   ├── MicrosoftTeamsSetupModal.tsx
│   │   └── TeamsConnectionStatus.tsx
│   ├── hooks/
│   │   └── useMicrosoftTeamsIntegration.ts
│   └── services/
│       └── microsoft-teams-tools.ts
├── microsoft-outlook/
│   ├── components/
│   │   ├── MicrosoftOutlookSetupModal.tsx
│   │   └── OutlookConnectionStatus.tsx
│   ├── hooks/
│   │   └── useMicrosoftOutlookIntegration.ts
│   └── services/
│       └── microsoft-outlook-tools.ts
└── microsoft-onedrive/
    ├── components/
    │   ├── MicrosoftOneDriveSetupModal.tsx
    │   └── OneDriveConnectionStatus.tsx
    ├── hooks/
    │   └── useMicrosoftOneDriveIntegration.ts
    └── services/
        └── microsoft-onedrive-tools.ts
```

#### Component Specifications

Each setup modal will follow the established pattern:
- **Connection Status Display:** Show current connection state
- **OAuth Flow Initiation:** One-click connection process
- **Scope Selection:** Allow users to choose specific permissions
- **Error Handling:** Clear error messages and recovery options
- **Security Information:** Display security and privacy details

### 3. Backend Infrastructure

#### Supabase Edge Functions
```
supabase/functions/
├── microsoft-oauth/
│   └── index.ts              # Unified OAuth flow for all Microsoft services
├── microsoft-teams-api/
│   └── index.ts              # Teams-specific API operations
├── microsoft-outlook-api/
│   └── index.ts              # Outlook-specific API operations
├── microsoft-onedrive-api/
│   └── index.ts              # OneDrive-specific API operations
└── chat/
    └── function_calling/
        ├── microsoft-teams-provider.ts
        ├── microsoft-outlook-provider.ts
        └── microsoft-onedrive-provider.ts
```

#### Unified OAuth Implementation
```typescript
// supabase/functions/microsoft-oauth/index.ts
export async function handleMicrosoftOAuth(req: Request) {
  const { action, service, ...params } = await req.json();
  
  switch (action) {
    case 'initiate':
      return await initiateMicrosoftOAuth(service, params);
    case 'callback': 
      return await handleMicrosoftCallback(service, params);
    case 'refresh':
      return await refreshMicrosoftToken(service, params);
    default:
      return new Response('Invalid action', { status: 400 });
  }
}

async function initiateMicrosoftOAuth(service: string, { userId, scopes }) {
  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.append('client_id', Deno.env.get('MICROSOFT_CLIENT_ID')!);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', getMicrosoftRedirectUri(service));
  authUrl.searchParams.append('scope', scopes.join(' '));
  authUrl.searchParams.append('state', generateSecureState(userId, service));
  authUrl.searchParams.append('response_mode', 'query');
  
  return new Response(JSON.stringify({ authUrl: authUrl.toString() }));
}
```

### 4. MCP Tool Definitions

#### Microsoft Teams Tools
```typescript
export const microsoftTeamsMCPTools = {
  teams_send_message: {
    name: 'teams_send_message',
    description: 'Send a message to a Microsoft Teams channel or chat',
    parameters: {
      type: 'object',
      properties: {
        channel_id: { type: 'string', description: 'Teams channel ID' },
        chat_id: { type: 'string', description: 'Teams chat ID' },
        message: { type: 'string', description: 'Message content' },
        message_type: { 
          type: 'string', 
          enum: ['text', 'html'],
          default: 'text',
          description: 'Message format type'
        }
      },
      required: ['message'],
      oneOf: [
        { required: ['channel_id'] },
        { required: ['chat_id'] }
      ]
    },
    required_scopes: ['https://graph.microsoft.com/ChannelMessage.Send']
  },
  
  teams_create_meeting: {
    name: 'teams_create_meeting', 
    description: 'Create a Microsoft Teams meeting',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Meeting subject' },
        start_time: { type: 'string', format: 'date-time', description: 'Meeting start time' },
        end_time: { type: 'string', format: 'date-time', description: 'Meeting end time' },
        attendees: {
          type: 'array',
          items: { type: 'string', format: 'email' },
          description: 'List of attendee email addresses'
        }
      },
      required: ['subject', 'start_time', 'end_time']
    },
    required_scopes: ['https://graph.microsoft.com/OnlineMeetings.ReadWrite']
  }
};
```

#### Microsoft Outlook Tools
```typescript
export const microsoftOutlookMCPTools = {
  outlook_send_email: {
    name: 'outlook_send_email',
    description: 'Send an email via Microsoft Outlook',
    parameters: {
      type: 'object', 
      properties: {
        to: { 
          type: 'array',
          items: { type: 'string', format: 'email' },
          description: 'Recipient email addresses'
        },
        cc: {
          type: 'array', 
          items: { type: 'string', format: 'email' },
          description: 'CC recipient email addresses'
        },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
        body_type: {
          type: 'string',
          enum: ['text', 'html'],
          default: 'text',
          description: 'Email body format'
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded content' },
              content_type: { type: 'string' }
            }
          }
        }
      },
      required: ['to', 'subject', 'body']
    },
    required_scopes: ['https://graph.microsoft.com/Mail.Send']
  },
  
  outlook_create_event: {
    name: 'outlook_create_event',
    description: 'Create a calendar event in Microsoft Outlook',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Event subject' },
        start: { type: 'string', format: 'date-time', description: 'Event start time' },
        end: { type: 'string', format: 'date-time', description: 'Event end time' },
        location: { type: 'string', description: 'Event location' },
        attendees: {
          type: 'array',
          items: { type: 'string', format: 'email' },
          description: 'Attendee email addresses'
        },
        body: { type: 'string', description: 'Event description' }
      },
      required: ['subject', 'start', 'end']
    },
    required_scopes: ['https://graph.microsoft.com/Calendars.ReadWrite']
  }
};
```

#### Microsoft OneDrive Tools
```typescript
export const microsoftOneDriveMCPTools = {
  onedrive_upload_file: {
    name: 'onedrive_upload_file',
    description: 'Upload a file to Microsoft OneDrive',
    parameters: {
      type: 'object',
      properties: {
        file_name: { type: 'string', description: 'Name of the file' },
        file_content: { type: 'string', description: 'Base64 encoded file content' },
        folder_path: { type: 'string', description: 'Destination folder path', default: '/' },
        conflict_behavior: {
          type: 'string',
          enum: ['fail', 'replace', 'rename'],
          default: 'rename',
          description: 'Behavior when file already exists'
        }
      },
      required: ['file_name', 'file_content']
    },
    required_scopes: ['https://graph.microsoft.com/Files.ReadWrite']
  },
  
  onedrive_share_file: {
    name: 'onedrive_share_file',
    description: 'Create a sharing link for a OneDrive file',
    parameters: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'OneDrive file ID' },
        file_path: { type: 'string', description: 'File path (alternative to file_id)' },
        link_type: {
          type: 'string',
          enum: ['view', 'edit', 'embed'],
          default: 'view',
          description: 'Type of sharing link'
        },
        scope: {
          type: 'string', 
          enum: ['anonymous', 'organization'],
          default: 'anonymous',
          description: 'Sharing scope'
        }
      },
      oneOf: [
        { required: ['file_id'] },
        { required: ['file_path'] }
      ]
    },
    required_scopes: ['https://graph.microsoft.com/Files.ReadWrite']
  }
};
```

## Proposed File Structure

### Frontend Files (200-300 lines each)

#### 1. Setup Modal Components
- `src/integrations/microsoft-teams/components/MicrosoftTeamsSetupModal.tsx` (280 lines)
- `src/integrations/microsoft-outlook/components/MicrosoftOutlookSetupModal.tsx` (275 lines)  
- `src/integrations/microsoft-onedrive/components/MicrosoftOneDriveSetupModal.tsx` (270 lines)

#### 2. Integration Hooks
- `src/integrations/microsoft-teams/hooks/useMicrosoftTeamsIntegration.ts` (250 lines)
- `src/integrations/microsoft-outlook/hooks/useMicrosoftOutlookIntegration.ts` (245 lines)
- `src/integrations/microsoft-onedrive/hooks/useMicrosoftOneDriveIntegration.ts` (240 lines)

#### 3. Tool Definitions
- `src/integrations/microsoft-teams/services/microsoft-teams-tools.ts` (300 lines)
- `src/integrations/microsoft-outlook/services/microsoft-outlook-tools.ts` (290 lines)
- `src/integrations/microsoft-onedrive/services/microsoft-onedrive-tools.ts` (285 lines)

### Backend Files (200-300 lines each)

#### 4. OAuth Handler
- `supabase/functions/microsoft-oauth/index.ts` (280 lines)

#### 5. API Handlers  
- `supabase/functions/microsoft-teams-api/index.ts` (275 lines)
- `supabase/functions/microsoft-outlook-api/index.ts` (270 lines)
- `supabase/functions/microsoft-onedrive-api/index.ts` (265 lines)

#### 6. Function Calling Providers
- `supabase/functions/chat/function_calling/microsoft-teams-provider.ts` (250 lines)
- `supabase/functions/chat/function_calling/microsoft-outlook-provider.ts` (245 lines)
- `supabase/functions/chat/function_calling/microsoft-onedrive-provider.ts` (240 lines)

### Database Files

#### 7. Migration Scripts
- `supabase/migrations/20250907000001_add_microsoft_service_providers.sql` (200 lines)
- `supabase/migrations/20250907000002_create_microsoft_integration_functions.sql` (250 lines)

### Configuration Files

#### 8. Registry Updates
- Update `src/integrations/_shared/registry/IntegrationSetupRegistry.ts` (+50 lines)
- Update `src/lib/mcp/tool-registry.ts` (+30 lines)

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- Database schema setup
- Microsoft OAuth flow implementation
- Basic UI components structure

### Phase 2: Core Integration (Week 2-3)
- Teams integration implementation
- Outlook integration implementation  
- OneDrive integration implementation

### Phase 3: Testing & Polish (Week 4)
- Comprehensive testing
- UI/UX refinements
- Documentation and deployment

## Risk Mitigation

### Technical Risks
1. **Microsoft Graph API Rate Limits:** Implement proper throttling and retry logic
2. **Token Refresh Complexity:** Robust token management with automatic refresh
3. **Scope Permission Issues:** Clear documentation and error handling

### Security Considerations
1. **Credential Security:** All tokens encrypted in Supabase Vault
2. **Permission Validation:** Strict scope checking before tool execution
3. **Audit Logging:** Complete audit trail for all operations

## Success Metrics

1. **Functional Metrics:**
   - All three services successfully integrated
   - OAuth flow completion rate > 95%
   - Tool execution success rate > 90%

2. **Security Metrics:**
   - Zero plain-text credential storage
   - Complete audit trail coverage
   - Proper permission validation

3. **User Experience Metrics:**
   - Setup completion time < 2 minutes
   - Clear error messages and recovery
   - Responsive UI across all devices

## Conclusion

This implementation plan provides a comprehensive roadmap for integrating Microsoft Teams, Outlook, and OneDrive into Agentopia. By following established patterns and maintaining security best practices, we can deliver powerful Microsoft 365 integration capabilities that enhance agent functionality while ensuring user trust and system reliability.
