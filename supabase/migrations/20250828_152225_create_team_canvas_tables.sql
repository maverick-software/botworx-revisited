-- Create Team Canvas Visual Hierarchy System
-- Date: August 28, 2025
-- Purpose: Enable visual team organization with drag-and-drop canvas interface

BEGIN;

-- Create enum for team connection types
CREATE TYPE team_connection_type AS ENUM (
    'reports_to',
    'collaborates_with', 
    'supports',
    'custom'
);

-- Team Canvas Layouts Table
-- Stores user-specific canvas layouts with positions, connections, and view settings
CREATE TABLE team_canvas_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID, -- Optional workspace association for future multi-workspace support
    
    -- Canvas data stored as JSONB for flexibility and performance
    positions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {teamId, x, y, width?, height?}
    connections JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {fromTeamId, toTeamId, type, label?, color?, style?}
    view_settings JSONB NOT NULL DEFAULT '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT team_canvas_layouts_user_workspace_unique UNIQUE (user_id, workspace_id)
);

-- Team Connections Table  
-- Stores individual team connections with full metadata and relationship types
CREATE TABLE team_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    to_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Connection properties
    connection_type team_connection_type NOT NULL DEFAULT 'collaborates_with',
    label TEXT, -- Optional connection label
    color TEXT, -- Optional custom color (hex code)
    style TEXT DEFAULT 'solid' CHECK (style IN ('solid', 'dashed', 'dotted')),
    
    -- Metadata
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_connections CHECK (from_team_id != to_team_id),
    CONSTRAINT unique_team_connection UNIQUE (from_team_id, to_team_id, connection_type)
);

-- Performance indexes
CREATE INDEX idx_team_canvas_layouts_user_id ON team_canvas_layouts(user_id);
CREATE INDEX idx_team_canvas_layouts_workspace_id ON team_canvas_layouts(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_team_canvas_layouts_updated_at ON team_canvas_layouts(updated_at DESC);

CREATE INDEX idx_team_connections_from_team ON team_connections(from_team_id);
CREATE INDEX idx_team_connections_to_team ON team_connections(to_team_id);  
CREATE INDEX idx_team_connections_type ON team_connections(connection_type);
CREATE INDEX idx_team_connections_created_by ON team_connections(created_by_user_id);

-- GIN indexes for JSONB queries
CREATE INDEX idx_team_canvas_positions_gin ON team_canvas_layouts USING GIN (positions);
CREATE INDEX idx_team_canvas_connections_gin ON team_canvas_layouts USING GIN (connections);

-- Enable Row Level Security
ALTER TABLE team_canvas_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_canvas_layouts
-- Users can only access their own canvas layouts
CREATE POLICY team_canvas_layouts_user_access ON team_canvas_layouts
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role has full access for admin functions  
CREATE POLICY team_canvas_layouts_service_access ON team_canvas_layouts
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for team_connections
-- Users can view connections for teams they own or have workspace access to
CREATE POLICY team_connections_read_access ON team_connections
    FOR SELECT TO authenticated
    USING (
        -- User owns one of the connected teams
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE (t.id = from_team_id OR t.id = to_team_id)
            AND t.owner_user_id = auth.uid()
        )
        OR
        -- User has workspace access (for future multi-workspace support)
        created_by_user_id = auth.uid()
    );

-- Users can create connections for teams they own
CREATE POLICY team_connections_create_access ON team_connections
    FOR INSERT TO authenticated
    WITH CHECK (
        -- User owns both teams in the connection
        EXISTS (
            SELECT 1 FROM teams t1, teams t2
            WHERE t1.id = from_team_id 
            AND t2.id = to_team_id
            AND t1.owner_user_id = auth.uid()
            AND t2.owner_user_id = auth.uid()
        )
        AND created_by_user_id = auth.uid()
    );

-- Users can update/delete connections they created for teams they own
CREATE POLICY team_connections_modify_access ON team_connections
    FOR UPDATE TO authenticated
    USING (
        created_by_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM teams t1, teams t2
            WHERE t1.id = from_team_id 
            AND t2.id = to_team_id
            AND t1.owner_user_id = auth.uid()
            AND t2.owner_user_id = auth.uid()
        )
    )
    WITH CHECK (
        created_by_user_id = auth.uid()
    );

CREATE POLICY team_connections_delete_access ON team_connections
    FOR DELETE TO authenticated
    USING (
        created_by_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM teams t1, teams t2
            WHERE t1.id = from_team_id 
            AND t2.id = to_team_id
            AND t1.owner_user_id = auth.uid()
            AND t2.owner_user_id = auth.uid()
        )
    );

-- Service role has full access
CREATE POLICY team_connections_service_access ON team_connections
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Update trigger for team_canvas_layouts
CREATE OR REPLACE FUNCTION update_team_canvas_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_canvas_layouts_updated_at_trigger
    BEFORE UPDATE ON team_canvas_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_team_canvas_layouts_updated_at();

-- Update trigger for team_connections
CREATE OR REPLACE FUNCTION update_team_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_connections_updated_at_trigger
    BEFORE UPDATE ON team_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_team_connections_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON team_canvas_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_connections TO authenticated;
GRANT USAGE ON TYPE team_connection_type TO authenticated;

-- Add table comments for documentation
COMMENT ON TABLE team_canvas_layouts IS 'User-specific visual canvas layouts storing team positions, connections, and view settings as JSONB';
COMMENT ON TABLE team_connections IS 'Individual team connections with relationship types and styling metadata';

COMMENT ON COLUMN team_canvas_layouts.positions IS 'JSONB array of team positions: [{teamId: UUID, x: number, y: number, width?: number, height?: number}]';
COMMENT ON COLUMN team_canvas_layouts.connections IS 'JSONB array of connections: [{fromTeamId: UUID, toTeamId: UUID, type: string, label?: string, color?: string, style?: string}]';
COMMENT ON COLUMN team_canvas_layouts.view_settings IS 'JSONB object with canvas view state: {zoom: number, centerX: number, centerY: number}';

COMMENT ON TYPE team_connection_type IS 'Enum defining types of relationships between teams: reports_to, collaborates_with, supports, custom';

-- Log the migration for audit purposes
INSERT INTO usage_events (
    feature,
    metadata
) VALUES (
    'database_migration',
    jsonb_build_object(
        'migration_name', 'create_team_canvas_tables',
        'tables_created', ARRAY['team_canvas_layouts', 'team_connections'],
        'migration_date', NOW()
    )
);

COMMIT;
