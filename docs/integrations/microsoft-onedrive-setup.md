# Microsoft OneDrive Integration Setup

## Overview

The Microsoft OneDrive integration allows agents to upload, download, share, and manage files in Microsoft OneDrive through the Microsoft Graph API.

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
-- Update Microsoft OneDrive service provider with your client ID
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
  COALESCE(configuration_metadata, '{}'::jsonb),
  '{client_id}',
  '"your_actual_microsoft_client_id_here"'::jsonb
)
WHERE name = 'microsoft-onedrive';
```

## Azure App Registration Setup

### 1. Create App Registration

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: Azure Active Directory > App registrations > New registration
3. **Configure**:
   - Name: `Agentopia OneDrive Integration`
   - Supported account types: `Accounts in any organizational directory and personal Microsoft accounts`
   - Redirect URI: `Web` - `http://localhost:5173/integrations/microsoft-onedrive/callback`

### 2. Get Credentials

After creation:
- Copy the **Application (client) ID** → Use in database configuration above
- Go to **Certificates & secrets** > **New client secret** → Copy value → Use in Supabase Secrets

### 3. Configure API Permissions

Add these Microsoft Graph **Delegated** permissions:
- `Files.Read` - Read user files
- `Files.ReadWrite` - Read and write user files
- `Files.Read.All` - Read all files user has access to
- `Files.ReadWrite.All` - Read and write all files user has access to
- `Sites.Read.All` - Read SharePoint sites
- `Sites.ReadWrite.All` - Read and write SharePoint sites
- `User.Read` - Read user profile information

**Important**: Click "Grant admin consent" for all permissions.

### 4. Production Setup

For production deployment, update the redirect URI to:
```
https://yourdomain.com/integrations/microsoft-onedrive/callback
```

## Testing the Integration

1. **Set up credentials** using the steps above
2. **Navigate to** `/integrations`
3. **Click** Microsoft OneDrive integration card
4. **Click** "Connect Microsoft OneDrive" button
5. **Complete OAuth flow** in Microsoft login
6. **Verify** connection shows as "Connected" with green status

## Features Available

- **Upload Files**: Upload files to OneDrive storage
- **Download Files**: Access and download files from OneDrive
- **Share Files**: Create sharing links for files and folders
- **File Management**: Organize files and folders
- **Search Files**: Search through files and content
- **SharePoint Integration**: Access SharePoint document libraries

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
   - Verify redirect URI in Azure matches exactly: `http://localhost:5173/integrations/microsoft-onedrive/callback`
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
supabase functions logs microsoft-onedrive-api --follow
```

## File Operations

### Upload Files
- Supports various file formats
- Automatic conflict resolution (rename, replace, or fail)
- Progress tracking for large files

### Download Files
- Direct file access via Microsoft Graph API
- Supports both individual files and batch operations
- Maintains file metadata and permissions

### Share Files
- Create view-only or edit sharing links
- Set sharing scope (anonymous, organization, specific users)
- Manage sharing permissions and expiration

### File Search
- Full-text search through file content
- Filter by file type, date, and location
- Search within SharePoint document libraries

## Integration Capabilities

The OneDrive integration provides these capabilities for your agents:

- **File Storage**: Persistent file storage with Microsoft's enterprise-grade infrastructure
- **Collaboration**: Share files with team members and external users
- **Version Control**: Automatic file versioning and history
- **Cross-Platform**: Access files from any device or application
- **Enterprise Security**: Leverage Microsoft's security and compliance features
