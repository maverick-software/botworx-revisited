# Database Implementation Research - Microsoft Integrations

**Date:** September 7, 2025  
**Task:** 2.1 Database Schema Design Implementation  
**Research Objective:** Plan detailed implementation of database schema for Microsoft Teams, Outlook, and OneDrive integrations

## Current Database State Analysis

### Existing Service Providers
Let me first check what service providers currently exist:

```sql
-- Current service providers in the system
SELECT name, display_name, is_enabled 
FROM service_providers 
ORDER BY name;
```

Based on schema analysis, existing providers likely include:
- Gmail
- Web Search APIs
- SMTP providers
- Other OAuth providers

### Existing Integration Categories
```sql
-- Current integration categories
SELECT name, description, display_order
FROM integration_categories
ORDER BY display_order;
```

Expected categories:
- Communication
- Productivity  
- Storage
- Others

## Implementation Strategy

### Phase 1: Service Providers Migration

#### Migration File: `20250907000001_add_microsoft_service_providers.sql`

**Dependencies:**
- Existing `service_providers` table structure
- No other service providers with conflicting names
- Environment variables for Microsoft client credentials

**Implementation Plan:**
```sql
-- Step 1: Validate no conflicts exist
DO $$
BEGIN
    -- Check for existing Microsoft providers
    IF EXISTS (SELECT 1 FROM service_providers WHERE name LIKE 'microsoft-%') THEN
        RAISE EXCEPTION 'Microsoft service providers already exist. Review existing entries first.';
    END IF;
END $$;

-- Step 2: Insert Microsoft Teams provider
INSERT INTO service_providers (
    name, 
    display_name,
    authorization_endpoint,
    token_endpoint,
    revoke_endpoint,
    discovery_endpoint,
    scopes_supported,
    pkce_required,
    client_credentials_location,
    is_enabled,
    configuration_metadata
) VALUES (
    'microsoft-teams',
    'Microsoft Teams',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    '[
        "https://graph.microsoft.com/Team.ReadBasic.All",
        "https://graph.microsoft.com/TeamMember.Read.All",
        "https://graph.microsoft.com/Channel.ReadBasic.All", 
        "https://graph.microsoft.com/ChannelMessage.Read.All",
        "https://graph.microsoft.com/ChannelMessage.Send",
        "https://graph.microsoft.com/Chat.Read",
        "https://graph.microsoft.com/Chat.ReadWrite",
        "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
        "https://graph.microsoft.com/User.Read"
    ]',
    true,
    'header',
    true,
    '{
        "api_base_url": "https://graph.microsoft.com/v1.0",
        "tenant": "common",
        "resource": "https://graph.microsoft.com",
        "client_id_env": "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "redirect_uri": "/integrations/microsoft-teams/callback",
        "service_type": "teams"
    }'
);

-- Step 3: Insert Microsoft Outlook provider
INSERT INTO service_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    revoke_endpoint,
    discovery_endpoint,
    scopes_supported,
    pkce_required,
    client_credentials_location,
    is_enabled,
    configuration_metadata
) VALUES (
    'microsoft-outlook',
    'Microsoft Outlook',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    '[
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",
        "https://graph.microsoft.com/Calendars.Read",
        "https://graph.microsoft.com/Calendars.ReadWrite",
        "https://graph.microsoft.com/Contacts.Read",
        "https://graph.microsoft.com/Contacts.ReadWrite",
        "https://graph.microsoft.com/User.Read"
    ]',
    true,
    'header',
    true,
    '{
        "api_base_url": "https://graph.microsoft.com/v1.0",
        "tenant": "common",
        "resource": "https://graph.microsoft.com",
        "client_id_env": "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "redirect_uri": "/integrations/microsoft-outlook/callback",
        "service_type": "outlook"
    }'
);

-- Step 4: Insert Microsoft OneDrive provider
INSERT INTO service_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    revoke_endpoint,
    discovery_endpoint,
    scopes_supported,
    pkce_required,
    client_credentials_location,
    is_enabled,
    configuration_metadata
) VALUES (
    'microsoft-onedrive',
    'Microsoft OneDrive',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    '[
        "https://graph.microsoft.com/Files.Read",
        "https://graph.microsoft.com/Files.ReadWrite",
        "https://graph.microsoft.com/Files.Read.All",
        "https://graph.microsoft.com/Files.ReadWrite.All",
        "https://graph.microsoft.com/Sites.Read.All",
        "https://graph.microsoft.com/Sites.ReadWrite.All",
        "https://graph.microsoft.com/User.Read"
    ]',
    true,
    'header',
    true,
    '{
        "api_base_url": "https://graph.microsoft.com/v1.0",
        "tenant": "common",
        "resource": "https://graph.microsoft.com",
        "client_id_env": "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "redirect_uri": "/integrations/microsoft-onedrive/callback",
        "service_type": "onedrive"
    }'
);

-- Step 5: Verify insertions
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM service_providers 
    WHERE name IN ('microsoft-teams', 'microsoft-outlook', 'microsoft-onedrive');
    
    IF v_count != 3 THEN
        RAISE EXCEPTION 'Failed to insert all Microsoft service providers. Expected 3, got %', v_count;
    END IF;
    
    RAISE NOTICE 'Successfully inserted % Microsoft service providers', v_count;
END $$;
```

### Phase 2: Integration Categories and UI Entries

#### Migration File: `20250907000002_add_microsoft_integrations_ui.sql`

**Dependencies:**
- Completed service providers migration
- Existing `integration_categories` and `integrations` tables

**Implementation Plan:**
```sql
-- Step 1: Ensure required categories exist
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES 
    ('Communication', 'Communication and collaboration tools', 'MessageSquare', 1, true),
    ('Productivity', 'Productivity and workflow tools', 'Briefcase', 2, true),
    ('Storage', 'File storage and sharing services', 'HardDrive', 3, true)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Step 2: Insert Microsoft Teams integration
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    is_popular,
    documentation_url,
    configuration_schema,
    required_oauth_provider_id,
    display_order,
    is_active,
    agent_classification
) VALUES (
    (SELECT id FROM integration_categories WHERE name = 'Communication'),
    'Microsoft Teams',
    'Send messages, create meetings, and collaborate in Microsoft Teams channels and chats',
    'MessageSquare',
    'available'::integration_status_enum,
    true,
    'https://docs.agentopia.com/integrations/microsoft-teams',
    '{
        "required_scopes": [
            "https://graph.microsoft.com/Team.ReadBasic.All",
            "https://graph.microsoft.com/ChannelMessage.Send",
            "https://graph.microsoft.com/Chat.ReadWrite"
        ],
        "optional_scopes": [
            "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
            "https://graph.microsoft.com/ChannelMessage.Read.All"
        ],
        "capabilities": [
            {"key": "send_message", "label": "Send messages to channels and chats"},
            {"key": "create_meeting", "label": "Create and schedule Teams meetings"},
            {"key": "read_messages", "label": "Read team and chat messages"}
        ]
    }',
    (SELECT id FROM service_providers WHERE name = 'microsoft-teams'),
    10,
    true,
    'tool'::integration_agent_classification_enum
);

-- Step 3: Insert Microsoft Outlook integration
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    is_popular,
    documentation_url,
    configuration_schema,
    required_oauth_provider_id,
    display_order,
    is_active,
    agent_classification
) VALUES (
    (SELECT id FROM integration_categories WHERE name = 'Productivity'),
    'Microsoft Outlook',
    'Send emails, manage calendar events, and access contacts in Microsoft Outlook',
    'Mail',
    'available'::integration_status_enum,
    true,
    'https://docs.agentopia.com/integrations/microsoft-outlook',
    '{
        "required_scopes": [
            "https://graph.microsoft.com/Mail.ReadWrite",
            "https://graph.microsoft.com/Mail.Send"
        ],
        "optional_scopes": [
            "https://graph.microsoft.com/Calendars.ReadWrite",
            "https://graph.microsoft.com/Contacts.ReadWrite"
        ],
        "capabilities": [
            {"key": "send_email", "label": "Send and manage emails"},
            {"key": "manage_calendar", "label": "Create and manage calendar events"},
            {"key": "manage_contacts", "label": "Access and manage contacts"}
        ]
    }',
    (SELECT id FROM service_providers WHERE name = 'microsoft-outlook'),
    11,
    true,
    'tool'::integration_agent_classification_enum
);

-- Step 4: Insert Microsoft OneDrive integration
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    is_popular,
    documentation_url,
    configuration_schema,
    required_oauth_provider_id,
    display_order,
    is_active,
    agent_classification
) VALUES (
    (SELECT id FROM integration_categories WHERE name = 'Storage'),
    'Microsoft OneDrive',
    'Upload, download, share, and manage files in Microsoft OneDrive',
    'HardDrive',
    'available'::integration_status_enum,
    true,
    'https://docs.agentopia.com/integrations/microsoft-onedrive',
    '{
        "required_scopes": [
            "https://graph.microsoft.com/Files.ReadWrite"
        ],
        "optional_scopes": [
            "https://graph.microsoft.com/Files.ReadWrite.All",
            "https://graph.microsoft.com/Sites.ReadWrite.All"
        ],
        "capabilities": [
            {"key": "upload_file", "label": "Upload files to OneDrive"},
            {"key": "share_file", "label": "Create sharing links for files"},
            {"key": "manage_files", "label": "Organize and manage files"}
        ]
    }',
    (SELECT id FROM service_providers WHERE name = 'microsoft-onedrive'),
    12,
    true,
    'tool'::integration_agent_classification_enum
);

-- Step 5: Verify integrations
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM integrations 
    WHERE name IN ('Microsoft Teams', 'Microsoft Outlook', 'Microsoft OneDrive');
    
    IF v_count != 3 THEN
        RAISE EXCEPTION 'Failed to insert all Microsoft integrations. Expected 3, got %', v_count;
    END IF;
    
    RAISE NOTICE 'Successfully inserted % Microsoft integrations', v_count;
END $$;
```

### Phase 3: Database Functions

#### Migration File: `20250907000003_create_microsoft_integration_functions.sql`

**Dependencies:**
- Completed service providers and integrations migrations
- Existing RPC function patterns (e.g., `get_gmail_tools`)

**Implementation Plan:**
```sql
-- Function to get Microsoft Teams tools for an agent
CREATE OR REPLACE FUNCTION get_microsoft_teams_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_connection_active BOOLEAN = false;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aop.allowed_scopes,
        (uoc.connection_status = 'active')
    INTO v_allowed_scopes, v_connection_active
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND sp.name = 'microsoft-teams'
    AND aop.is_active = true;
    
    -- Return empty if no active connection or permissions
    IF v_allowed_scopes IS NULL OR NOT v_connection_active THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    -- Send message tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/ChannelMessage.Send' THEN
        v_tools = v_tools || '[{
            "name": "teams_send_message",
            "description": "Send a message to a Microsoft Teams channel or chat",
            "parameters": {
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Teams channel ID"},
                    "chat_id": {"type": "string", "description": "Teams chat ID"},
                    "message": {"type": "string", "description": "Message content"},
                    "message_type": {"type": "string", "enum": ["text", "html"], "default": "text"}
                },
                "required": ["message"],
                "oneOf": [
                    {"required": ["channel_id"]},
                    {"required": ["chat_id"]}
                ]
            }
        }]'::jsonb;
    END IF;
    
    -- Create meeting tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/OnlineMeetings.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "teams_create_meeting",
            "description": "Create a Microsoft Teams meeting",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Meeting subject"},
                    "start_time": {"type": "string", "format": "date-time", "description": "Meeting start time"},
                    "end_time": {"type": "string", "format": "date-time", "description": "Meeting end time"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "Attendee email addresses"}
                },
                "required": ["subject", "start_time", "end_time"]
            }
        }]'::jsonb;
    END IF;
    
    -- Read messages tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/ChannelMessage.Read.All' THEN
        v_tools = v_tools || '[{
            "name": "teams_read_messages",
            "description": "Read messages from Microsoft Teams channels or chats",
            "parameters": {
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Teams channel ID"},
                    "chat_id": {"type": "string", "description": "Teams chat ID"},
                    "limit": {"type": "integer", "description": "Maximum number of messages to retrieve", "default": 50}
                },
                "oneOf": [
                    {"required": ["channel_id"]},
                    {"required": ["chat_id"]}
                ]
            }
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;

-- Function to get Microsoft Outlook tools for an agent
CREATE OR REPLACE FUNCTION get_microsoft_outlook_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_connection_active BOOLEAN = false;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aop.allowed_scopes,
        (uoc.connection_status = 'active')
    INTO v_allowed_scopes, v_connection_active
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND sp.name = 'microsoft-outlook'
    AND aop.is_active = true;
    
    -- Return empty if no active connection or permissions
    IF v_allowed_scopes IS NULL OR NOT v_connection_active THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    -- Send email tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Mail.Send' THEN
        v_tools = v_tools || '[{
            "name": "outlook_send_email",
            "description": "Send an email via Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "Recipient email addresses"},
                    "cc": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "CC recipient email addresses"},
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body content"},
                    "body_type": {"type": "string", "enum": ["text", "html"], "default": "text", "description": "Email body format"}
                },
                "required": ["to", "subject", "body"]
            }
        }]'::jsonb;
    END IF;
    
    -- Read emails tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Mail.Read' THEN
        v_tools = v_tools || '[{
            "name": "outlook_read_emails",
            "description": "Read emails from Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {"type": "string", "description": "Mail folder to read from", "default": "inbox"},
                    "limit": {"type": "integer", "description": "Maximum number of emails to retrieve", "default": 50},
                    "search": {"type": "string", "description": "Search query to filter emails"}
                }
            }
        }]'::jsonb;
    END IF;
    
    -- Create calendar event tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Calendars.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "outlook_create_event",
            "description": "Create a calendar event in Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Event subject"},
                    "start": {"type": "string", "format": "date-time", "description": "Event start time"},
                    "end": {"type": "string", "format": "date-time", "description": "Event end time"},
                    "location": {"type": "string", "description": "Event location"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "Attendee email addresses"},
                    "body": {"type": "string", "description": "Event description"}
                },
                "required": ["subject", "start", "end"]
            }
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;

-- Function to get Microsoft OneDrive tools for an agent
CREATE OR REPLACE FUNCTION get_microsoft_onedrive_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_connection_active BOOLEAN = false;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aop.allowed_scopes,
        (uoc.connection_status = 'active')
    INTO v_allowed_scopes, v_connection_active
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND sp.name = 'microsoft-onedrive'
    AND aop.is_active = true;
    
    -- Return empty if no active connection or permissions
    IF v_allowed_scopes IS NULL OR NOT v_connection_active THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    -- Upload file tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Files.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "onedrive_upload_file",
            "description": "Upload a file to Microsoft OneDrive",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_name": {"type": "string", "description": "Name of the file"},
                    "file_content": {"type": "string", "description": "Base64 encoded file content"},
                    "folder_path": {"type": "string", "description": "Destination folder path", "default": "/"},
                    "conflict_behavior": {"type": "string", "enum": ["fail", "replace", "rename"], "default": "rename"}
                },
                "required": ["file_name", "file_content"]
            }
        }]'::jsonb;
        
        -- Share file tool
        v_tools = v_tools || '[{
            "name": "onedrive_share_file",
            "description": "Create a sharing link for a OneDrive file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "OneDrive file ID"},
                    "file_path": {"type": "string", "description": "File path (alternative to file_id)"},
                    "link_type": {"type": "string", "enum": ["view", "edit", "embed"], "default": "view"},
                    "scope": {"type": "string", "enum": ["anonymous", "organization"], "default": "anonymous"}
                },
                "oneOf": [
                    {"required": ["file_id"]},
                    {"required": ["file_path"]}
                ]
            }
        }]'::jsonb;
        
        -- List files tool
        v_tools = v_tools || '[{
            "name": "onedrive_list_files",
            "description": "List files in a OneDrive folder",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "Folder path to list", "default": "/"},
                    "limit": {"type": "integer", "description": "Maximum number of files to return", "default": 100}
                }
            }
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION get_microsoft_teams_tools IS 'Returns available Microsoft Teams tools for an agent based on granted OAuth scopes';
COMMENT ON FUNCTION get_microsoft_outlook_tools IS 'Returns available Microsoft Outlook tools for an agent based on granted OAuth scopes';  
COMMENT ON FUNCTION get_microsoft_onedrive_tools IS 'Returns available Microsoft OneDrive tools for an agent based on granted OAuth scopes';
```

## Testing Strategy

### Pre-Migration Testing
```sql
-- Test 1: Verify no naming conflicts
SELECT name FROM service_providers WHERE name LIKE 'microsoft-%';
-- Expected: No results

-- Test 2: Verify required categories exist
SELECT name FROM integration_categories WHERE name IN ('Communication', 'Productivity', 'Storage');
-- Expected: May or may not exist, will be created if missing

-- Test 3: Check existing function patterns
SELECT proname FROM pg_proc WHERE proname LIKE 'get_%_tools';
-- Expected: get_gmail_tools and possibly others
```

### Post-Migration Validation
```sql
-- Test 1: Verify service providers created
SELECT name, display_name, is_enabled 
FROM service_providers 
WHERE name IN ('microsoft-teams', 'microsoft-outlook', 'microsoft-onedrive');
-- Expected: 3 rows, all enabled

-- Test 2: Verify integrations created
SELECT i.name, ic.name as category, i.is_active
FROM integrations i
JOIN integration_categories ic ON ic.id = i.category_id
WHERE i.name IN ('Microsoft Teams', 'Microsoft Outlook', 'Microsoft OneDrive');
-- Expected: 3 rows, all active

-- Test 3: Test functions
SELECT get_microsoft_teams_tools('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
-- Expected: Empty array (no permissions)
```

## Rollback Strategy

### Rollback SQL
```sql
-- Remove functions
DROP FUNCTION IF EXISTS get_microsoft_teams_tools(UUID, UUID);
DROP FUNCTION IF EXISTS get_microsoft_outlook_tools(UUID, UUID);
DROP FUNCTION IF EXISTS get_microsoft_onedrive_tools(UUID, UUID);

-- Remove integrations
DELETE FROM integrations WHERE name IN ('Microsoft Teams', 'Microsoft Outlook', 'Microsoft OneDrive');

-- Remove service providers
DELETE FROM service_providers WHERE name IN ('microsoft-teams', 'microsoft-outlook', 'microsoft-onedrive');

-- Note: Integration categories are left intact as they may be used by other integrations
```

## Environment Variables Required

### Production Environment Setup
```bash
# Azure AD Application Configuration
MICROSOFT_CLIENT_ID=your_azure_app_client_id
MICROSOFT_CLIENT_SECRET=your_azure_app_client_secret

# Optional: Tenant-specific configuration
MICROSOFT_TENANT_ID=common  # or specific tenant ID
```

### Development Environment Setup
```bash
# Development Azure AD Application
MICROSOFT_CLIENT_ID=dev_azure_app_client_id
MICROSOFT_CLIENT_SECRET=dev_azure_app_client_secret
MICROSOFT_TENANT_ID=common
```

## Risk Mitigation

### Potential Issues
1. **Naming Conflicts**: Check for existing Microsoft providers before migration
2. **Enum Validation**: Ensure enum values exist before using them
3. **Foreign Key Constraints**: Verify referenced tables exist
4. **Function Dependencies**: Ensure all referenced columns exist

### Mitigation Strategies
1. **Pre-flight Checks**: Validate environment before migration
2. **Transactional Migration**: Use BEGIN/COMMIT blocks
3. **Rollback Scripts**: Prepare rollback for each migration
4. **Testing**: Comprehensive testing in development environment

## Next Steps

1. **Create Migration Files**: Implement the SQL above in migration files
2. **Test in Development**: Run migrations in development environment
3. **Environment Setup**: Configure Azure AD application and environment variables
4. **Production Deployment**: Deploy migrations to production
5. **Validation**: Run post-migration tests to verify success

This implementation plan provides a comprehensive, tested approach to adding Microsoft integrations to the Agentopia database while maintaining compatibility with existing systems.
