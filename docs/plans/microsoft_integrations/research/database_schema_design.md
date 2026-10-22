# Database Schema Design for Microsoft Integrations

**Date:** September 7, 2025  
**Research Objective:** Design database schema for Microsoft Teams, Outlook, and OneDrive integrations based on current Agentopia schema

## Current Schema Analysis

### Existing Core Tables

#### 1. `service_providers` Table
```sql
CREATE TABLE IF NOT EXISTS "public"."service_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,                    -- Unique provider identifier
    "display_name" "text" NOT NULL,            -- Human-readable name
    "authorization_endpoint" "text" NOT NULL,  -- OAuth auth URL
    "token_endpoint" "text" NOT NULL,          -- OAuth token URL
    "revoke_endpoint" "text",                  -- Token revocation URL
    "discovery_endpoint" "text",               -- OIDC discovery URL
    "scopes_supported" "jsonb" DEFAULT '[]'::jsonb NOT NULL,
    "pkce_required" boolean DEFAULT true NOT NULL,
    "client_credentials_location" "text" DEFAULT 'header'::text NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "configuration_metadata" "jsonb",          -- Provider-specific config
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_providers_name_key" UNIQUE ("name")
);
```

#### 2. `user_oauth_connections` Table
```sql
CREATE TABLE IF NOT EXISTS "public"."user_oauth_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,                 -- References auth.users
    "oauth_provider_id" "uuid" NOT NULL,       -- References service_providers
    "external_user_id" "text" NOT NULL,        -- Provider's user ID
    "external_username" "text",                -- Provider's username
    "scopes_granted" "jsonb" DEFAULT '[]'::jsonb NOT NULL,
    "connection_name" "text" NOT NULL,         -- User-friendly name
    "vault_access_token_id" "text",            -- Supabase Vault token ID
    "vault_refresh_token_id" "text",           -- Supabase Vault refresh token ID
    "token_expires_at" timestamp with time zone,
    "last_token_refresh" timestamp with time zone,
    "connection_status" "text" DEFAULT 'active'::text NOT NULL,
    "connection_metadata" "jsonb",             -- Provider-specific metadata
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "encrypted_access_token" "text",           -- Deprecated field
    "encrypted_refresh_token" "text",          -- Deprecated field
    "credential_type" "public"."connection_credential_type_enum" DEFAULT 'oauth'::connection_credential_type_enum NOT NULL,
    CONSTRAINT "chk_credential_type_consistency" CHECK (
        (("credential_type" = 'oauth' AND "connection_status" = 'active' AND "vault_access_token_id" IS NOT NULL) OR
         ("credential_type" = 'api_key' AND "connection_status" = 'active' AND "vault_access_token_id" IS NOT NULL) OR
         ("connection_status" <> 'active'))
    ),
    CONSTRAINT "user_oauth_connections_connection_status_check" CHECK (
        "connection_status" = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])
    )
);
```

#### 3. `agent_oauth_permissions` Table
```sql
CREATE TABLE IF NOT EXISTS "public"."agent_oauth_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,               -- References agents table
    "user_oauth_connection_id" "uuid" NOT NULL, -- References user_oauth_connections
    "granted_by_user_id" "uuid" NOT NULL,     -- References auth.users
    "permission_level" "text" DEFAULT 'read_only'::text NOT NULL,
    "allowed_scopes" "jsonb",                 -- Subset of granted scopes
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_oauth_permissions_permission_level_check" CHECK (
        "permission_level" = ANY (ARRAY['read_only'::text, 'full_access'::text, 'custom'::text])
    )
);
```

#### 4. Integration Display Tables
```sql
-- Integration categories for UI display
CREATE TABLE IF NOT EXISTS "public"."integration_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Integration definitions for UI display
CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,            -- References integration_categories
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text",
    "status" "public"."integration_status_enum" DEFAULT 'available',
    "is_popular" boolean DEFAULT false,
    "documentation_url" "text",
    "configuration_schema" "jsonb" DEFAULT '{}',
    "required_oauth_provider_id" "uuid",      -- References service_providers
    "required_tool_catalog_id" "uuid",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "agent_classification" "public"."integration_agent_classification_enum" DEFAULT 'tool'
);
```

### Existing Enums
```sql
-- Connection credential types
CREATE TYPE "public"."connection_credential_type_enum" AS ENUM (
    'oauth',
    'api_key'
);

-- Integration status for UI
CREATE TYPE "public"."integration_status_enum" AS ENUM (
    'available',
    'beta', 
    'coming_soon',
    'deprecated'
);

-- Integration connection status
CREATE TYPE "public"."integration_connection_status_enum" AS ENUM (
    'connected',
    'disconnected',
    'error',
    'pending'
);

-- Agent classification for integrations
CREATE TYPE "public"."integration_agent_classification_enum" AS ENUM (
    'tool',
    'channel'
);
```

## Microsoft Integrations Schema Design

### 1. Service Providers Entries

Based on the current schema, we need to add three new entries to the `service_providers` table:

```sql
-- Microsoft Teams Service Provider
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
        "redirect_uri_teams": "/integrations/microsoft-teams/callback"
    }'
);

-- Microsoft Outlook Service Provider
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
        "redirect_uri_outlook": "/integrations/microsoft-outlook/callback"
    }'
);

-- Microsoft OneDrive Service Provider
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
        "redirect_uri_onedrive": "/integrations/microsoft-onedrive/callback"
    }'
);
```

### 2. Integration Categories and Integrations

We need to add entries to the `integrations` table for UI display:

```sql
-- Get or create Communication category
INSERT INTO integration_categories (name, description, icon_name, display_order)
VALUES ('Communication', 'Communication and collaboration tools', 'MessageSquare', 1)
ON CONFLICT (name) DO NOTHING;

-- Get or create Productivity category  
INSERT INTO integration_categories (name, description, icon_name, display_order)
VALUES ('Productivity', 'Productivity and workflow tools', 'Briefcase', 2)
ON CONFLICT (name) DO NOTHING;

-- Get or create Storage category
INSERT INTO integration_categories (name, description, icon_name, display_order)
VALUES ('Storage', 'File storage and sharing services', 'HardDrive', 3)
ON CONFLICT (name) DO NOTHING;

-- Microsoft Teams Integration
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
    'available',
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
        ]
    }',
    (SELECT id FROM service_providers WHERE name = 'microsoft-teams'),
    10,
    true,
    'tool'
);

-- Microsoft Outlook Integration
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
    'available',
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
        ]
    }',
    (SELECT id FROM service_providers WHERE name = 'microsoft-outlook'),
    11,
    true,
    'tool'
);

-- Microsoft OneDrive Integration
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
    'available',
    true,
    'https://docs.agentopia.com/integrations/microsoft-onedrive',
    '{
        "required_scopes": [
            "https://graph.microsoft.com/Files.ReadWrite"
        ],
        "optional_scopes": [
            "https://graph.microsoft.com/Files.ReadWrite.All",
            "https://graph.microsoft.com/Sites.ReadWrite.All"
        ]
    }',
    (SELECT id FROM service_providers WHERE name = 'microsoft-onedrive'),
    12,
    true,
    'tool'
);
```

### 3. Database Functions

We need to create RPC functions for Microsoft integrations following the existing pattern:

```sql
-- Function to get Microsoft Teams tools for an agent
CREATE OR REPLACE FUNCTION get_microsoft_teams_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
BEGIN
    -- Get allowed scopes for Microsoft Teams
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND sp.name = 'microsoft-teams'
    AND aop.is_active = true
    AND uoc.connection_status = 'active';
    
    IF v_allowed_scopes IS NULL THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    IF v_allowed_scopes ? 'https://graph.microsoft.com/ChannelMessage.Send' THEN
        v_tools = v_tools || '[{
            "name": "teams_send_message",
            "description": "Send a message to a Microsoft Teams channel or chat",
            "parameters": {
                "type": "object",
                "properties": {
                    "channel_id": {"type": "string", "description": "Teams channel ID"},
                    "chat_id": {"type": "string", "description": "Teams chat ID"},
                    "message": {"type": "string", "description": "Message content"}
                },
                "required": ["message"]
            }
        }]'::jsonb;
    END IF;
    
    IF v_allowed_scopes ? 'https://graph.microsoft.com/OnlineMeetings.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "teams_create_meeting",
            "description": "Create a Microsoft Teams meeting",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Meeting subject"},
                    "start_time": {"type": "string", "format": "date-time"},
                    "end_time": {"type": "string", "format": "date-time"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}}
                },
                "required": ["subject", "start_time", "end_time"]
            }
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get Microsoft Outlook tools for an agent
CREATE OR REPLACE FUNCTION get_microsoft_outlook_tools(
    p_agent_id UUID,
    p_user_id UUID  
) RETURNS JSONB AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
BEGIN
    -- Get allowed scopes for Microsoft Outlook
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND sp.name = 'microsoft-outlook'
    AND aop.is_active = true
    AND uoc.connection_status = 'active';
    
    IF v_allowed_scopes IS NULL THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Mail.Send' THEN
        v_tools = v_tools || '[{
            "name": "outlook_send_email",
            "description": "Send an email via Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "array", "items": {"type": "string", "format": "email"}},
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body content"}
                },
                "required": ["to", "subject", "body"]
            }
        }]'::jsonb;
    END IF;
    
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Calendars.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "outlook_create_event",
            "description": "Create a calendar event in Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "Event subject"},
                    "start": {"type": "string", "format": "date-time"},
                    "end": {"type": "string", "format": "date-time"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}}
                },
                "required": ["subject", "start", "end"]
            }
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get Microsoft OneDrive tools for an agent
CREATE OR REPLACE FUNCTION get_microsoft_onedrive_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
BEGIN
    -- Get allowed scopes for Microsoft OneDrive
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND sp.name = 'microsoft-onedrive'
    AND aop.is_active = true
    AND uoc.connection_status = 'active';
    
    IF v_allowed_scopes IS NULL THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on granted scopes
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Files.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "onedrive_upload_file",
            "description": "Upload a file to Microsoft OneDrive",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_name": {"type": "string", "description": "Name of the file"},
                    "file_content": {"type": "string", "description": "Base64 encoded file content"},
                    "folder_path": {"type": "string", "description": "Destination folder path", "default": "/"}
                },
                "required": ["file_name", "file_content"]
            }
        }]'::jsonb;
        
        v_tools = v_tools || '[{
            "name": "onedrive_share_file",
            "description": "Create a sharing link for a OneDrive file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "OneDrive file ID"},
                    "link_type": {"type": "string", "enum": ["view", "edit"], "default": "view"}
                },
                "required": ["file_id"]
            }
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Migration Strategy

### 1. Migration File Structure
```
supabase/migrations/20250907000001_add_microsoft_service_providers.sql
supabase/migrations/20250907000002_add_microsoft_integrations_ui.sql  
supabase/migrations/20250907000003_create_microsoft_integration_functions.sql
```

### 2. Key Considerations

#### **Unified Client ID**
All three Microsoft services can use the same Azure AD app registration and client ID, as they all use Microsoft Graph API. This simplifies configuration and reduces the number of environment variables needed.

#### **Scope Management**
Microsoft Graph API uses different scopes for different services, but all follow the same pattern. The `scopes_supported` field in `service_providers` contains all available scopes for each service.

#### **Metadata Configuration**
The `configuration_metadata` field contains service-specific configuration like API base URL, tenant information, and environment variable names for credentials.

#### **Existing Table Compatibility**
The design leverages existing tables without modifications:
- `service_providers` - No changes needed
- `user_oauth_connections` - No changes needed  
- `agent_oauth_permissions` - No changes needed
- `integrations` - No changes needed

#### **Security Considerations**
- All tokens stored in Supabase Vault via `vault_access_token_id` and `vault_refresh_token_id`
- No plain-text credentials in database
- Scope-based permission validation at multiple levels
- Proper constraint checking for credential types

## Next Steps

1. **Create Migration Scripts** - Implement the SQL statements above in migration files
2. **Test Database Changes** - Verify migrations work correctly in development
3. **Environment Variables** - Set up Microsoft client ID and secret
4. **Azure AD Configuration** - Register application and configure redirect URIs
5. **Frontend Integration** - Update integration registry with new providers

This design maintains full compatibility with the existing Agentopia architecture while adding comprehensive Microsoft 365 integration capabilities.
