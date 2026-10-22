# Microsoft Teams Integration Setup

## Overview

The Microsoft Teams integration allows agents to send messages, create meetings, and access team information through the Microsoft Graph API.

## Required Configuration

### 1. Supabase Secrets (Backend)

Add the Microsoft Client Secret to Supabase Secrets:

```bash
# Set the client secret in Supabase Secrets
supabase secrets set MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
supabase secrets set MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here
```

### 2. Database Configuration (Frontend)

Update the service provider configuration in your database:

```sql
-- Update Microsoft Teams service provider with your client ID
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'::jsonb),
  '{client_id}',
  '"your_actual_microsoft_client_id_here"'::jsonb
)
WHERE name = 'microsoft-teams';
```

## Azure App Registration Setup

### 1. Create App Registration

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: Azure Active Directory > App registrations > New registration
3. **Configure**:
   - Name: `Agentopia Teams Integration`
   - Supported account types: `Accounts in any organizational directory and personal Microsoft accounts`
   - Redirect URI: `Web` - `http://localhost:5173/integrations/microsoft-teams/callback`

### 2. Get Credentials

After creation:
- Copy the **Application (client) ID** → `VITE_MICROSOFT_CLIENT_ID`
- Go to **Certificates & secrets** > **New client secret** → Copy value → `VITE_MICROSOFT_CLIENT_SECRET`

### 3. Configure API Permissions

Add these Microsoft Graph **Delegated** permissions:
- `Chat.ReadWrite` - Send and read chat messages
- `Team.ReadBasic.All` - Read basic team information
- `Channel.ReadBasic.All` - Read basic channel information
- `OnlineMeetings.ReadWrite` - Create and manage online meetings
- `User.Read` - Read user profile information

**Important**: Click "Grant admin consent" for all permissions.

### 4. Production Setup

For production deployment, update the redirect URI to:
```
https://yourdomain.com/integrations/microsoft-teams/callback
```

## Testing the Integration

1. **Restart Development Server** after adding environment variables
2. **Navigate to** `/integrations`
3. **Click** Microsoft Teams integration card
4. **Click** "Connect Microsoft Teams" button
5. **Complete OAuth flow** in Microsoft login
6. **Verify** connection shows as "Connected" with green status

## Features Available

- **Send Messages**: Send messages to Teams chats and channels
- **Read Messages**: Access chat and channel message history
- **Create Meetings**: Schedule online Teams meetings
- **Team Access**: View team and channel information
- **User Profile**: Access authenticated user's profile

## Security Features

- **OAuth 2.0 + PKCE**: Secure authorization code flow with PKCE
- **Supabase Vault**: Encrypted storage of access and refresh tokens
- **Token Refresh**: Automatic token renewal when expired
- **Scope Validation**: Granular permission checking per operation

## Troubleshooting

### Common Issues

1. **"Microsoft Client ID not configured in service provider"**
   - Ensure the client ID is set in the service provider configuration (see Database Configuration above)
   - Run the SQL update command to add your client ID to the database

2. **"Invalid redirect URI"**
   - Verify redirect URI in Azure matches exactly: `http://localhost:5173/integrations/microsoft-teams/callback`
   - Check for trailing slashes or protocol mismatches

3. **"Insufficient privileges"**
   - Ensure all required permissions are added in Azure
   - Click "Grant admin consent" for the permissions
   - Wait a few minutes for permissions to propagate

4. **Token refresh failures**
   - Check that client secret is valid and not expired
   - Verify refresh token scope includes `offline_access`

### Debug Logs

Check browser console and Supabase edge function logs for detailed error information:
```bash
supabase functions logs microsoft-teams-api --follow
```
