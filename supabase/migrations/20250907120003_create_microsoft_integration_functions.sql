-- =====================================================
-- MICROSOFT INTEGRATION FUNCTIONS MIGRATION
-- =====================================================
-- Create RPC functions for Microsoft Teams, Outlook, and OneDrive tools
-- Date: September 7, 2025
-- Purpose: Enable dynamic tool discovery for Microsoft Graph API integrations

BEGIN;

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
    v_connection_id UUID;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aip.allowed_scopes,
        (uic.connection_status = 'active'),
        uic.id
    INTO v_allowed_scopes, v_connection_active, v_connection_id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uic.oauth_provider_id
    WHERE aip.agent_id = p_agent_id
    AND uic.user_id = p_user_id
    AND sp.name = 'microsoft-teams'
    AND aip.is_active = true;
    
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
                    "channel_id": {"type": "string", "description": "Teams channel ID (format: 19:...@thread.tacv2)"},
                    "chat_id": {"type": "string", "description": "Teams chat ID (format: 19:...)"},
                    "message": {"type": "string", "description": "Message content to send"},
                    "message_type": {"type": "string", "enum": ["text", "html"], "default": "text", "description": "Message format type"}
                },
                "required": ["message"],
                "oneOf": [
                    {"required": ["channel_id"]},
                    {"required": ["chat_id"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/ChannelMessage.Send"]
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
                    "subject": {"type": "string", "description": "Meeting subject/title"},
                    "start_time": {"type": "string", "format": "date-time", "description": "Meeting start time (ISO 8601 format)"},
                    "end_time": {"type": "string", "format": "date-time", "description": "Meeting end time (ISO 8601 format)"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "List of attendee email addresses"}
                },
                "required": ["subject", "start_time", "end_time"]
            },
            "required_scopes": ["https://graph.microsoft.com/OnlineMeetings.ReadWrite"]
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
                    "channel_id": {"type": "string", "description": "Teams channel ID to read from"},
                    "chat_id": {"type": "string", "description": "Teams chat ID to read from"},
                    "limit": {"type": "integer", "description": "Maximum number of messages to retrieve", "default": 50, "minimum": 1, "maximum": 100}
                },
                "oneOf": [
                    {"required": ["channel_id"]},
                    {"required": ["chat_id"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/ChannelMessage.Read.All"]
        }]'::jsonb;
    END IF;
    
    -- List teams tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Team.ReadBasic.All' THEN
        v_tools = v_tools || '[{
            "name": "teams_list_teams",
            "description": "List Microsoft Teams that the user is a member of",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Maximum number of teams to retrieve", "default": 50, "minimum": 1, "maximum": 100}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Team.ReadBasic.All"]
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
    v_connection_id UUID;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aip.allowed_scopes,
        (uic.connection_status = 'active'),
        uic.id
    INTO v_allowed_scopes, v_connection_active, v_connection_id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uic.oauth_provider_id
    WHERE aip.agent_id = p_agent_id
    AND uic.user_id = p_user_id
    AND sp.name = 'microsoft-outlook'
    AND aip.is_active = true;
    
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
                    "bcc": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "BCC recipient email addresses"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body content"},
                    "body_type": {"type": "string", "enum": ["text", "html"], "default": "text", "description": "Email body format"},
                    "importance": {"type": "string", "enum": ["low", "normal", "high"], "default": "normal", "description": "Email importance level"}
                },
                "required": ["to", "subject", "body"]
            },
            "required_scopes": ["https://graph.microsoft.com/Mail.Send"]
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
                    "folder": {"type": "string", "description": "Mail folder to read from (inbox, sent, drafts, etc.)", "default": "inbox"},
                    "limit": {"type": "integer", "description": "Maximum number of emails to retrieve", "default": 50, "minimum": 1, "maximum": 100},
                    "search": {"type": "string", "description": "Search query to filter emails"},
                    "unread_only": {"type": "boolean", "description": "Only return unread emails", "default": false}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Mail.Read"]
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
                    "subject": {"type": "string", "description": "Event subject/title"},
                    "start": {"type": "string", "format": "date-time", "description": "Event start time (ISO 8601 format)"},
                    "end": {"type": "string", "format": "date-time", "description": "Event end time (ISO 8601 format)"},
                    "location": {"type": "string", "description": "Event location"},
                    "attendees": {"type": "array", "items": {"type": "string", "format": "email"}, "description": "Attendee email addresses"},
                    "body": {"type": "string", "description": "Event description/body"},
                    "is_online_meeting": {"type": "boolean", "description": "Create as Teams meeting", "default": false}
                },
                "required": ["subject", "start", "end"]
            },
            "required_scopes": ["https://graph.microsoft.com/Calendars.ReadWrite"]
        }]'::jsonb;
    END IF;
    
    -- Read calendar events tool
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Calendars.Read' THEN
        v_tools = v_tools || '[{
            "name": "outlook_read_events",
            "description": "Read calendar events from Microsoft Outlook",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "format": "date", "description": "Start date for event range (YYYY-MM-DD)"},
                    "end_date": {"type": "string", "format": "date", "description": "End date for event range (YYYY-MM-DD)"},
                    "limit": {"type": "integer", "description": "Maximum number of events to retrieve", "default": 50, "minimum": 1, "maximum": 100}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Calendars.Read"]
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
    v_connection_id UUID;
BEGIN
    -- Get allowed scopes and verify active connection
    SELECT 
        aip.allowed_scopes,
        (uic.connection_status = 'active'),
        uic.id
    INTO v_allowed_scopes, v_connection_active, v_connection_id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
    JOIN service_providers sp ON sp.id = uic.oauth_provider_id
    WHERE aip.agent_id = p_agent_id
    AND uic.user_id = p_user_id
    AND sp.name = 'microsoft-onedrive'
    AND aip.is_active = true;
    
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
                    "file_name": {"type": "string", "description": "Name of the file including extension"},
                    "file_content": {"type": "string", "description": "Base64 encoded file content"},
                    "folder_path": {"type": "string", "description": "Destination folder path (e.g., /Documents/Projects)", "default": "/"},
                    "conflict_behavior": {"type": "string", "enum": ["fail", "replace", "rename"], "default": "rename", "description": "Behavior when file already exists"}
                },
                "required": ["file_name", "file_content"]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
        
        -- Share file tool
        v_tools = v_tools || '[{
            "name": "onedrive_share_file",
            "description": "Create a sharing link for a OneDrive file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "OneDrive file ID"},
                    "file_path": {"type": "string", "description": "File path (alternative to file_id, e.g., /Documents/file.pdf)"},
                    "link_type": {"type": "string", "enum": ["view", "edit", "embed"], "default": "view", "description": "Type of sharing link"},
                    "scope": {"type": "string", "enum": ["anonymous", "organization"], "default": "anonymous", "description": "Sharing scope"}
                },
                "oneOf": [
                    {"required": ["file_id"]},
                    {"required": ["file_path"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
        
        -- List files tool
        v_tools = v_tools || '[{
            "name": "onedrive_list_files",
            "description": "List files in a OneDrive folder",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "Folder path to list (e.g., /Documents)", "default": "/"},
                    "limit": {"type": "integer", "description": "Maximum number of files to return", "default": 100, "minimum": 1, "maximum": 200}
                }
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
        
        -- Download file tool
        v_tools = v_tools || '[{
            "name": "onedrive_download_file",
            "description": "Download a file from OneDrive",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "OneDrive file ID"},
                    "file_path": {"type": "string", "description": "File path (alternative to file_id)"}
                },
                "oneOf": [
                    {"required": ["file_id"]},
                    {"required": ["file_path"]}
                ]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.ReadWrite"]
        }]'::jsonb;
    END IF;
    
    -- Search files tool (requires read access)
    IF v_allowed_scopes ? 'https://graph.microsoft.com/Files.Read' OR v_allowed_scopes ? 'https://graph.microsoft.com/Files.ReadWrite' THEN
        v_tools = v_tools || '[{
            "name": "onedrive_search_files",
            "description": "Search files in OneDrive by name or content",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query (file name, content, or metadata)"},
                    "limit": {"type": "integer", "description": "Maximum number of results to return", "default": 50, "minimum": 1, "maximum": 100}
                },
                "required": ["query"]
            },
            "required_scopes": ["https://graph.microsoft.com/Files.Read"]
        }]'::jsonb;
    END IF;
    
    RETURN v_tools;
END;
$$;

-- Add function comments for documentation
COMMENT ON FUNCTION get_microsoft_teams_tools(UUID, UUID) IS 'Returns available Microsoft Teams tools for an agent based on granted OAuth scopes and active connection status';
COMMENT ON FUNCTION get_microsoft_outlook_tools(UUID, UUID) IS 'Returns available Microsoft Outlook tools for an agent based on granted OAuth scopes and active connection status';  
COMMENT ON FUNCTION get_microsoft_onedrive_tools(UUID, UUID) IS 'Returns available Microsoft OneDrive tools for an agent based on granted OAuth scopes and active connection status';

-- Grant execute permissions to authenticated users (following existing pattern)
GRANT EXECUTE ON FUNCTION get_microsoft_teams_tools(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_microsoft_outlook_tools(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_microsoft_onedrive_tools(UUID, UUID) TO authenticated;

COMMIT;

-- Post-migration validation and testing
DO $$
DECLARE
    v_function_count INTEGER;
    v_test_result JSONB;
BEGIN
    -- Count Microsoft integration functions
    SELECT COUNT(*) INTO v_function_count 
    FROM pg_proc 
    WHERE proname IN ('get_microsoft_teams_tools', 'get_microsoft_outlook_tools', 'get_microsoft_onedrive_tools');
    
    IF v_function_count != 3 THEN
        RAISE EXCEPTION 'Failed to create all Microsoft integration functions. Expected 3, got %', v_function_count;
    END IF;
    
    RAISE NOTICE 'Successfully created % Microsoft integration functions:', v_function_count;
    RAISE NOTICE '  ✓ get_microsoft_teams_tools';
    RAISE NOTICE '  ✓ get_microsoft_outlook_tools';
    RAISE NOTICE '  ✓ get_microsoft_onedrive_tools';
    
    -- Test functions with dummy UUIDs (should return empty arrays)
    SELECT get_microsoft_teams_tools('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid) INTO v_test_result;
    IF v_test_result != '[]'::jsonb THEN
        RAISE EXCEPTION 'Teams function test failed. Expected empty array, got %', v_test_result;
    END IF;
    
    SELECT get_microsoft_outlook_tools('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid) INTO v_test_result;
    IF v_test_result != '[]'::jsonb THEN
        RAISE EXCEPTION 'Outlook function test failed. Expected empty array, got %', v_test_result;
    END IF;
    
    SELECT get_microsoft_onedrive_tools('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid) INTO v_test_result;
    IF v_test_result != '[]'::jsonb THEN
        RAISE EXCEPTION 'OneDrive function test failed. Expected empty array, got %', v_test_result;
    END IF;
    
    RAISE NOTICE 'All function tests passed (returned empty arrays for non-existent agents)';
    RAISE NOTICE 'Microsoft integration functions migration completed successfully!';
    
    -- Summary
    RAISE NOTICE '';
    RAISE NOTICE 'Microsoft Graph API integrations are now ready:';
    RAISE NOTICE '  - Service providers configured in database';
    RAISE NOTICE '  - UI integrations available on integrations page';
    RAISE NOTICE '  - Tool discovery functions operational';
    RAISE NOTICE '  - Ready for frontend and backend implementation';
END $$;
