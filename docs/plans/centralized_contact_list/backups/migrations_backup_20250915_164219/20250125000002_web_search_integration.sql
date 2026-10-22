-- Web Search Integration Database Schema Migration
-- Date: January 25, 2025
-- Purpose: Add web search providers and API key management for agents

-- Create web search providers table (separate from OAuth providers since these use API keys)
CREATE TABLE IF NOT EXISTS web_search_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'api_key' CHECK (auth_type IN ('api_key', 'bearer_token')),
    api_key_header TEXT NOT NULL DEFAULT 'X-API-KEY',
    api_key_prefix TEXT DEFAULT '',
    supported_features JSONB DEFAULT '[]'::jsonb,
    rate_limits JSONB DEFAULT '{}'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user web search API keys table (using Vault for secure storage)
CREATE TABLE IF NOT EXISTS user_web_search_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider_id UUID NOT NULL REFERENCES web_search_providers(id) ON DELETE CASCADE,
    vault_api_key_id UUID NOT NULL, -- Store in Supabase Vault
    key_name TEXT, -- User-friendly name for the key
    quota_limit INTEGER,
    quota_used INTEGER DEFAULT 0,
    quota_reset_at TIMESTAMPTZ,
    key_status TEXT DEFAULT 'active' CHECK (key_status IN ('active', 'inactive', 'expired', 'error')),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, provider_id, key_name)
);

-- Create agent web search permissions table
CREATE TABLE IF NOT EXISTS agent_web_search_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    provider_id UUID NOT NULL REFERENCES web_search_providers(id) ON DELETE CASCADE,
    user_key_id UUID NOT NULL REFERENCES user_web_search_keys(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '[]'::jsonb, -- ['web_search', 'news_search', 'image_search']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, provider_id)
);

-- Create web search operation logs table
CREATE TABLE IF NOT EXISTS web_search_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    provider_id UUID NOT NULL REFERENCES web_search_providers(id),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('web_search', 'news_search', 'image_search', 'scrape_and_summarize')),
    query_text TEXT,
    results_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    quota_consumed INTEGER DEFAULT 1,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default web search providers
DO $$
BEGIN
    -- Add Serper API provider
    IF NOT EXISTS (SELECT 1 FROM web_search_providers WHERE name = 'serper') THEN
        INSERT INTO web_search_providers (
            name,
            display_name,
            base_url,
            auth_type,
            api_key_header,
            supported_features,
            rate_limits,
            configuration,
            is_enabled
        ) VALUES (
            'serper',
            'Serper API',
            'https://google.serper.dev',
            'api_key',
            'X-API-KEY',
            '["web_search", "news_search", "image_search", "location_search"]'::jsonb,
            '{"requests_per_month": 1000, "requests_per_second": 1}'::jsonb,
            '{
                "supports_location": true,
                "supports_language": true,
                "supports_safe_search": true,
                "max_results": 100
            }'::jsonb,
            true
        );
    END IF;

    -- Add SerpAPI provider
    IF NOT EXISTS (SELECT 1 FROM web_search_providers WHERE name = 'serpapi') THEN
        INSERT INTO web_search_providers (
            name,
            display_name,
            base_url,
            auth_type,
            api_key_header,
            api_key_prefix,
            supported_features,
            rate_limits,
            configuration,
            is_enabled
        ) VALUES (
            'serpapi',
            'SerpAPI',
            'https://serpapi.com/search',
            'api_key',
            'Authorization',
            'Bearer ',
            '["google_search", "bing_search", "yahoo_search", "baidu_search", "news_search"]'::jsonb,
            '{"requests_per_month": 100, "requests_per_second": 1}'::jsonb,
            '{
                "supports_location": true,
                "supports_device": true,
                "supports_multiple_engines": true,
                "max_results": 100
            }'::jsonb,
            true
        );
    END IF;

    -- Add Brave Search API provider
    IF NOT EXISTS (SELECT 1 FROM web_search_providers WHERE name = 'brave_search') THEN
        INSERT INTO web_search_providers (
            name,
            display_name,
            base_url,
            auth_type,
            api_key_header,
            supported_features,
            rate_limits,
            configuration,
            is_enabled
        ) VALUES (
            'brave_search',
            'Brave Search API',
            'https://api.search.brave.com/res/v1',
            'api_key',
            'X-Subscription-Token',
            '["web_search", "news_search", "image_search"]'::jsonb,
            '{"requests_per_month": 2000, "requests_per_second": 1}'::jsonb,
            '{
                "supports_location": true,
                "privacy_focused": true,
                "no_tracking": true,
                "max_results": 20
            }'::jsonb,
            true
        );
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_web_search_providers_name ON web_search_providers(name);
CREATE INDEX IF NOT EXISTS idx_user_web_search_keys_user_id ON user_web_search_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_web_search_keys_provider ON user_web_search_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_agent_web_search_permissions_agent ON agent_web_search_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_web_search_permissions_user ON agent_web_search_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_web_search_logs_agent_id ON web_search_operation_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_web_search_logs_created_at ON web_search_operation_logs(created_at);

-- Enable RLS on all tables
ALTER TABLE web_search_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_web_search_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_web_search_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_search_operation_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Web search providers policies (read-only for authenticated users)
CREATE POLICY "Web search providers are readable by authenticated users"
    ON web_search_providers FOR SELECT
    TO authenticated
    USING (is_enabled = true);

CREATE POLICY "Only service role can modify web search providers"
    ON web_search_providers FOR ALL
    TO service_role
    USING (true);

-- User web search keys policies
CREATE POLICY "Users can view their own web search keys"
    ON user_web_search_keys FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own web search keys"
    ON user_web_search_keys FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own web search keys"
    ON user_web_search_keys FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own web search keys"
    ON user_web_search_keys FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Agent web search permissions policies
CREATE POLICY "Users can view web search permissions for their agents"
    ON agent_web_search_permissions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage web search permissions for their agents"
    ON agent_web_search_permissions FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Web search operation logs policies
CREATE POLICY "Users can view logs for their agents"
    ON web_search_operation_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can insert operation logs"
    ON web_search_operation_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_web_search_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_web_search_providers_updated_at
    BEFORE UPDATE ON web_search_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_web_search_providers_updated_at();

CREATE OR REPLACE FUNCTION update_user_web_search_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_web_search_keys_updated_at
    BEFORE UPDATE ON user_web_search_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_user_web_search_keys_updated_at();

CREATE OR REPLACE FUNCTION update_agent_web_search_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_web_search_permissions_updated_at
    BEFORE UPDATE ON agent_web_search_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_web_search_permissions_updated_at();

-- Create RPC functions for web search integration

-- Function to get available web search tools for an agent
CREATE OR REPLACE FUNCTION get_web_search_tools(
    p_agent_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    tool_name TEXT,
    provider_name TEXT,
    provider_display_name TEXT,
    supported_features JSONB,
    permissions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN 'web_search' = ANY(array(SELECT jsonb_array_elements_text(awsp.permissions)))
                THEN 'web_search_' || wsp.name
            ELSE NULL
        END as tool_name,
        wsp.name as provider_name,
        wsp.display_name as provider_display_name,
        wsp.supported_features,
        awsp.permissions
    FROM web_search_providers wsp
    JOIN agent_web_search_permissions awsp ON wsp.id = awsp.provider_id
    JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
    WHERE awsp.agent_id = p_agent_id 
        AND awsp.user_id = p_user_id
        AND awsp.is_active = true
        AND uwsk.key_status = 'active'
        AND wsp.is_enabled = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate web search permissions
CREATE OR REPLACE FUNCTION validate_web_search_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_provider_name TEXT,
    p_required_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    permission_exists BOOLEAN := false;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM web_search_providers wsp
        JOIN agent_web_search_permissions awsp ON wsp.id = awsp.provider_id
        JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
        WHERE wsp.name = p_provider_name
            AND awsp.agent_id = p_agent_id
            AND awsp.user_id = p_user_id
            AND awsp.is_active = true
            AND uwsk.key_status = 'active'
            AND wsp.is_enabled = true
            AND p_required_permission = ANY(array(SELECT jsonb_array_elements_text(awsp.permissions)))
    ) INTO permission_exists;
    
    RETURN permission_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get web search API key from vault
CREATE OR REPLACE FUNCTION get_web_search_api_key(
    p_agent_id UUID,
    p_user_id UUID,
    p_provider_name TEXT
)
RETURNS TEXT AS $$
DECLARE
    vault_key_id UUID;
    api_key TEXT;
BEGIN
    -- Get the vault key ID for the provider
    SELECT uwsk.vault_api_key_id INTO vault_key_id
    FROM web_search_providers wsp
    JOIN agent_web_search_permissions awsp ON wsp.id = awsp.provider_id
    JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
    WHERE wsp.name = p_provider_name
        AND awsp.agent_id = p_agent_id
        AND awsp.user_id = p_user_id
        AND awsp.is_active = true
        AND uwsk.key_status = 'active';

    IF vault_key_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Retrieve the API key from vault
    SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE id = vault_key_id;

    RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_web_search_tools(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_web_search_permissions(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_web_search_api_key(UUID, UUID, TEXT) TO service_role;

-- Grant table permissions
GRANT SELECT ON web_search_providers TO anon, authenticated;
GRANT ALL ON user_web_search_keys TO authenticated;
GRANT ALL ON agent_web_search_permissions TO authenticated;
GRANT INSERT ON web_search_operation_logs TO service_role;
GRANT SELECT ON web_search_operation_logs TO authenticated; 