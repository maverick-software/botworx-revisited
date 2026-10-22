-- Create OAuth providers table
-- This table stores configuration for OAuth providers like Gmail, GitHub, etc.

CREATE TABLE IF NOT EXISTS service_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    authorization_url TEXT NOT NULL,
    token_url TEXT NOT NULL,
    user_info_url TEXT,
    scopes JSONB DEFAULT '[]'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user OAuth connections table
-- This table stores user-specific OAuth connections (tokens, etc.)
CREATE TABLE IF NOT EXISTS user_oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References auth.users
    oauth_provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
    external_user_id TEXT,
    external_username TEXT,
    scopes_granted JSONB DEFAULT '[]'::jsonb,
    vault_access_token_id TEXT, -- Will store tokens directly for now
    vault_refresh_token_id TEXT, -- Will store tokens directly for now
    token_expires_at TIMESTAMPTZ,
    connection_status TEXT DEFAULT 'active' CHECK (connection_status IN ('active', 'expired', 'error', 'disconnected')),
    connection_metadata JSONB DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, oauth_provider_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_providers_name ON service_providers(name);
CREATE INDEX IF NOT EXISTS idx_user_oauth_connections_user_id ON user_oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_connections_provider ON user_oauth_connections(oauth_provider_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_connections_status ON user_oauth_connections(connection_status);

-- Enable RLS
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_oauth_connections ENABLE ROW LEVEL SECURITY;

-- OAuth providers policies
CREATE POLICY "OAuth providers are readable by authenticated users"
    ON service_providers FOR SELECT
    TO authenticated
    USING (is_enabled = true);

CREATE POLICY "Only service role can modify OAuth providers"
    ON service_providers FOR ALL
    TO service_role
    USING (true);

-- User OAuth connections policies
CREATE POLICY "Users can view their own OAuth connections"
    ON user_oauth_connections FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own OAuth connections"
    ON user_oauth_connections FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own OAuth connections"
    ON user_oauth_connections FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own OAuth connections"
    ON user_oauth_connections FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_service_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger conditionally
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_service_providers_updated_at'
        AND event_object_table = 'service_providers'
    ) THEN
        CREATE TRIGGER update_service_providers_updated_at
            BEFORE UPDATE ON service_providers
            FOR EACH ROW
            EXECUTE FUNCTION update_service_providers_updated_at();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_user_oauth_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger conditionally
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_user_oauth_connections_updated_at'
        AND event_object_table = 'user_oauth_connections'
    ) THEN
        CREATE TRIGGER update_user_oauth_connections_updated_at
            BEFORE UPDATE ON user_oauth_connections
            FOR EACH ROW
            EXECUTE FUNCTION update_user_oauth_connections_updated_at();
    END IF;
END $$;

-- Grant permissions
GRANT SELECT ON service_providers TO anon, authenticated;
GRANT ALL ON user_oauth_connections TO authenticated; 