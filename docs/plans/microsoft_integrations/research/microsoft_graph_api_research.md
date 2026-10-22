# Microsoft Graph API Research

**Date:** September 7, 2025  
**Research Objective:** Understand Microsoft Graph API architecture for Teams, Outlook, and OneDrive integrations

## Microsoft Graph API Overview

Microsoft Graph is the unified API endpoint for accessing Microsoft 365 services including:
- **Microsoft Teams** - Chat, channels, meetings, files
- **Microsoft Outlook** - Email, calendar, contacts
- **Microsoft OneDrive** - File storage and sharing

### Base API Endpoint
- **Base URL:** `https://graph.microsoft.com/v1.0/`
- **Beta URL:** `https://graph.microsoft.com/beta/` (for preview features)

## Authentication & OAuth 2.0

### OAuth 2.0 Flow
Microsoft Graph uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for security:

1. **Authorization Endpoint:** `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
2. **Token Endpoint:** `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
3. **Tenant:** Can be `common`, `organizations`, `consumers`, or specific tenant ID

### Required App Registration
- Register app in Azure AD/Entra ID
- Configure redirect URIs
- Set required permissions/scopes
- Obtain Client ID (Application ID)

## Microsoft Teams API

### Key Endpoints
- **Teams:** `/teams`
- **Channels:** `/teams/{team-id}/channels`
- **Messages:** `/teams/{team-id}/channels/{channel-id}/messages`
- **Chat Messages:** `/chats/{chat-id}/messages`
- **Meetings:** `/me/onlineMeetings`

### Required Scopes
- `Team.ReadBasic.All` - Read basic team info
- `Channel.ReadBasic.All` - Read basic channel info
- `ChannelMessage.Read.All` - Read channel messages
- `ChannelMessage.Send` - Send messages to channels
- `Chat.Read` - Read user's chat messages
- `Chat.ReadWrite` - Read and write chat messages
- `OnlineMeetings.ReadWrite` - Create and manage meetings

### Common Operations
```typescript
// Get user's teams
GET /me/joinedTeams

// Get team channels
GET /teams/{team-id}/channels

// Send message to channel
POST /teams/{team-id}/channels/{channel-id}/messages
{
  "body": {
    "content": "Hello World!"
  }
}

// Get chat messages
GET /me/chats/{chat-id}/messages
```

## Microsoft Outlook API

### Key Endpoints
- **Mail:** `/me/messages`
- **Calendar:** `/me/events`
- **Contacts:** `/me/contacts`
- **Folders:** `/me/mailFolders`

### Required Scopes
- `Mail.Read` - Read user's mail
- `Mail.ReadWrite` - Read and write access to user's mail
- `Mail.Send` - Send mail as user
- `Calendars.Read` - Read user's calendars
- `Calendars.ReadWrite` - Read and write user's calendars
- `Contacts.Read` - Read user's contacts
- `Contacts.ReadWrite` - Read and write user's contacts

### Common Operations
```typescript
// Get user's messages
GET /me/messages

// Send email
POST /me/sendMail
{
  "message": {
    "subject": "Hello",
    "body": {
      "contentType": "Text",
      "content": "Hello World!"
    },
    "toRecipients": [
      {
        "emailAddress": {
          "address": "user@example.com"
        }
      }
    ]
  }
}

// Get calendar events
GET /me/events

// Create calendar event
POST /me/events
{
  "subject": "Meeting",
  "start": {
    "dateTime": "2025-09-07T14:00:00",
    "timeZone": "UTC"
  },
  "end": {
    "dateTime": "2025-09-07T15:00:00",
    "timeZone": "UTC"
  }
}
```

## Microsoft OneDrive API

### Key Endpoints
- **Drive:** `/me/drive`
- **Items:** `/me/drive/items/{item-id}`
- **Root:** `/me/drive/root`
- **Search:** `/me/drive/root/search(q='{query}')`

### Required Scopes
- `Files.Read` - Read user's files
- `Files.ReadWrite` - Read and write user's files
- `Files.Read.All` - Read all files user can access
- `Files.ReadWrite.All` - Read and write all files user can access

### Common Operations
```typescript
// Get drive info
GET /me/drive

// List files in root
GET /me/drive/root/children

// Upload file
PUT /me/drive/root:/{filename}:/content
Content-Type: application/octet-stream
[file content]

// Download file
GET /me/drive/items/{item-id}/content

// Search files
GET /me/drive/root/search(q='presentation')

// Share file
POST /me/drive/items/{item-id}/createLink
{
  "type": "view",
  "scope": "anonymous"
}
```

## Integration Architecture Considerations

### Rate Limits
- **Microsoft Graph:** 10,000 requests per 10 minutes per application per tenant
- **Teams:** Additional limits for messaging operations
- **Outlook:** Throttling based on resource and tenant

### Error Handling
- Standard HTTP status codes
- Detailed error responses in JSON format
- Retry logic for transient errors (429, 503, 504)

### Webhooks/Notifications
- Microsoft Graph supports webhooks for real-time notifications
- Subscription endpoints: `/subscriptions`
- Supported resources: mail, calendar, contacts, Teams messages

### Security Considerations
- Use least privilege principle for scopes
- Implement proper token refresh logic
- Secure storage of refresh tokens (Supabase Vault)
- Validate webhook notifications

## Comparison with Existing Gmail Integration

### Similarities
- OAuth 2.0 + PKCE flow
- Token-based authentication
- RESTful API design
- JSON request/response format

### Differences
- **Multi-tenant architecture** (Microsoft vs single tenant Gmail)
- **Unified API** (Graph API vs separate Gmail API)
- **Broader scope** (Teams, Outlook, OneDrive vs just Gmail)
- **Different permission model** (Graph scopes vs Gmail scopes)

## Next Steps for Implementation

1. **App Registration** - Register application in Azure AD
2. **OAuth Flow** - Implement Microsoft-specific OAuth flow
3. **API Clients** - Create TypeScript clients for each service
4. **Database Schema** - Extend service_providers for Microsoft
5. **UI Components** - Create setup modals for each service
6. **Edge Functions** - Implement Supabase functions for API calls
7. **Testing** - Comprehensive testing with Microsoft developer tenant

## References

- Microsoft Graph API Documentation: https://docs.microsoft.com/en-us/graph/
- Microsoft Graph Explorer: https://developer.microsoft.com/en-us/graph/graph-explorer
- Azure AD App Registration: https://docs.microsoft.com/en-us/azure/active-directory/develop/
- Microsoft Graph SDK: https://docs.microsoft.com/en-us/graph/sdks/
