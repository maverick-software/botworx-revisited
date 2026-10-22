-- Unify Web Search Integration
-- Date: January 25, 2025
-- Purpose: Consolidate Serper API, SerpAPI, and Brave Search into single "Web Search" integration

-- First, get the Web Search & Research category ID
DO $$
DECLARE
    web_search_category_id UUID;
    unified_integration_id UUID;
BEGIN
    -- Get the category ID for Web Search & Research
    SELECT id INTO web_search_category_id 
    FROM integration_categories 
    WHERE name = 'Web Search & Research';

    -- Create unified Web Search integration
    INSERT INTO integrations (
        category_id,
        name,
        description,
        icon_name,
        status,
        is_popular,
        documentation_url,
        configuration_schema,
        display_order,
        is_active
    ) VALUES (
        web_search_category_id,
        'Web Search',
        'Comprehensive web search capability with multiple provider options. Search the web, get news updates, find images, and access real-time information using Serper API, SerpAPI, or Brave Search.',
        'Search',
        'available',
        true,
        'https://docs.agentopia.ai/integrations/web-search',
        '{
            "type": "object",
            "properties": {
                "provider": {
                    "type": "string",
                    "title": "Search Provider",
                    "description": "Choose your preferred search API provider",
                    "enum": ["serper_api", "serpapi", "brave_search"],
                    "enumNames": ["Serper API (1,000 free/month)", "SerpAPI (100 free/month)", "Brave Search (2,000 free/month)"],
                    "default": "serper_api"
                },
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Your API key for the selected provider"
                },
                "connection_name": {
                    "type": "string",
                    "title": "Connection Name",
                    "description": "Optional name for this connection",
                    "default": "My Web Search"
                },
                "default_location": {
                    "type": "string",
                    "title": "Default Location",
                    "description": "Default location for localized results (e.g., United States, New York)"
                },
                "default_language": {
                    "type": "string",
                    "title": "Default Language",
                    "description": "Default language for search results",
                    "default": "en"
                }
            },
            "required": ["provider", "api_key"]
        }'::jsonb,
        1,
        true
    ) 
    ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        configuration_schema = EXCLUDED.configuration_schema,
        is_popular = EXCLUDED.is_popular,
        display_order = EXCLUDED.display_order
    RETURNING id INTO unified_integration_id;

    -- Add capabilities for the unified Web Search integration
    INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
    VALUES 
        (unified_integration_id, 'web_search', 'Web Search', 1),
        (unified_integration_id, 'news_search', 'News Search', 2),
        (unified_integration_id, 'image_search', 'Image Search', 3),
        (unified_integration_id, 'location_search', 'Location-based Search', 4),
        (unified_integration_id, 'content_summarization', 'Content Summarization', 5)
    ON CONFLICT (integration_id, capability_key) DO NOTHING;

    -- Update existing separate integrations to deprecated status
    UPDATE integrations 
    SET 
        status = 'deprecated',
        is_active = false,
        description = CONCAT(description, ' [DEPRECATED - Use unified Web Search integration instead]')
    WHERE name IN ('Serper API', 'SerpAPI', 'Brave Search API');

    RAISE NOTICE 'Unified Web Search integration created successfully with ID: %', unified_integration_id;
END $$;

-- Add comment explaining the consolidation
COMMENT ON TABLE integrations IS 'Integration catalog. Web search providers have been consolidated into a single "Web Search" integration with provider selection during setup.';
