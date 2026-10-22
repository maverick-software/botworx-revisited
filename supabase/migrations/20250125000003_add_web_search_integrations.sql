-- Add Web Search Integrations to the Integrations System
-- Date: January 25, 2025
-- Purpose: Add web search providers to the integrations page

-- First, ensure we have the Web Search & Research category
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES ('Web Search & Research', 'Web search engines and research tools for real-time information', 'Search', 1, true)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Get the category ID for Web Search & Research
DO $$
DECLARE
    web_search_category_id UUID;
BEGIN
    SELECT id INTO web_search_category_id 
    FROM integration_categories 
    WHERE name = 'Web Search & Research';

    -- Add Serper API integration
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
        'Serper API',
        'Google Search API with fast, reliable results. Perfect for web search, news, images, and location-based queries. Offers 1000 free searches per month.',
        'Search',
        'available',
        true,
        'https://serper.dev/api-key',
        '{
            "type": "object",
            "properties": {
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Your Serper API key from serper.dev"
                },
                "default_location": {
                    "type": "string",
                    "title": "Default Location",
                    "description": "Default location for localized results (e.g., \"New York, NY\")"
                },
                "default_language": {
                    "type": "string",
                    "title": "Default Language",
                    "description": "Default language code (e.g., \"en\", \"es\", \"fr\")",
                    "default": "en"
                }
            },
            "required": ["api_key"]
        }'::jsonb,
        1,
        true
    ) ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        documentation_url = EXCLUDED.documentation_url,
        configuration_schema = EXCLUDED.configuration_schema,
        is_popular = EXCLUDED.is_popular;

    -- Add SerpAPI integration
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
        'SerpAPI',
        'Comprehensive search API supporting Google, Bing, Yahoo, and Baidu. Advanced features include device simulation and multiple search engines.',
        'Globe',
        'available',
        false,
        'https://serpapi.com/manage-api-key',
        '{
            "type": "object",
            "properties": {
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Your SerpAPI key from serpapi.com"
                },
                "default_engine": {
                    "type": "string",
                    "title": "Default Search Engine",
                    "description": "Default search engine to use",
                    "enum": ["google", "bing", "yahoo", "baidu"],
                    "default": "google"
                },
                "default_location": {
                    "type": "string",
                    "title": "Default Location",
                    "description": "Default location for localized results"
                }
            },
            "required": ["api_key"]
        }'::jsonb,
        2,
        true
    ) ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        documentation_url = EXCLUDED.documentation_url,
        configuration_schema = EXCLUDED.configuration_schema;

    -- Add Brave Search API integration
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
        'Brave Search API',
        'Privacy-focused search API from Brave. No tracking, independent index, and high monthly quota. Perfect for privacy-conscious applications.',
        'Shield',
        'available',
        false,
        'https://brave.com/search/api/',
        '{
            "type": "object",
            "properties": {
                "api_key": {
                    "type": "string",
                    "title": "Subscription Token",
                    "description": "Your Brave Search API subscription token"
                },
                "safesearch": {
                    "type": "string",
                    "title": "Safe Search",
                    "description": "Safe search setting",
                    "enum": ["strict", "moderate", "off"],
                    "default": "moderate"
                },
                "default_location": {
                    "type": "string",
                    "title": "Default Location",
                    "description": "Default location for localized results"
                }
            },
            "required": ["api_key"]
        }'::jsonb,
        3,
        true
    ) ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        documentation_url = EXCLUDED.documentation_url,
        configuration_schema = EXCLUDED.configuration_schema;
        
END $$; 