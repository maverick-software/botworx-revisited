-- Add Team Hierarchy Support
-- Date: January 1, 2026
-- Purpose: Add parent_team_id column to enable organizational hierarchy

BEGIN;

-- Add parent_team_id column to teams table
ALTER TABLE teams 
ADD COLUMN parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Add constraint to prevent circular references (team cannot be its own parent)
ALTER TABLE teams
ADD CONSTRAINT teams_no_self_parent CHECK (id != parent_team_id);

-- Create index for efficient hierarchy queries
CREATE INDEX idx_teams_parent_team_id ON teams(parent_team_id);

-- Add column comment
COMMENT ON COLUMN teams.parent_team_id IS 'Optional parent team ID for hierarchical organization structure. NULL for top-level teams.';

-- Update RLS policies to include parent teams
-- Users can view teams where they own the team OR own the parent team
DROP POLICY IF EXISTS teams_select_own ON teams;
CREATE POLICY teams_select_own ON teams
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid() OR
    parent_team_id IN (
      SELECT id FROM teams WHERE owner_user_id = auth.uid()
    )
  );

-- Users can insert teams as sub-teams of their own teams
DROP POLICY IF EXISTS teams_insert_own ON teams;
CREATE POLICY teams_insert_own ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid() AND
    (
      parent_team_id IS NULL OR
      parent_team_id IN (
        SELECT id FROM teams WHERE owner_user_id = auth.uid()
      )
    )
  );

-- Users can update teams they own (including changing parent)
DROP POLICY IF EXISTS teams_update_own ON teams;
CREATE POLICY teams_update_own ON teams
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid() AND
    (
      parent_team_id IS NULL OR
      parent_team_id IN (
        SELECT id FROM teams WHERE owner_user_id = auth.uid()
      )
    )
  );

-- Create recursive CTE function to get team hierarchy
CREATE OR REPLACE FUNCTION get_team_hierarchy(team_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  parent_team_id UUID,
  owner_user_id UUID,
  level INTEGER,
  path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Base case: start with the specified team
    SELECT 
      t.id,
      t.name,
      t.description,
      t.parent_team_id,
      t.owner_user_id,
      0 AS level,
      t.name::TEXT AS path
    FROM teams t
    WHERE t.id = team_id
    
    UNION ALL
    
    -- Recursive case: get child teams
    SELECT 
      t.id,
      t.name,
      t.description,
      t.parent_team_id,
      t.owner_user_id,
      tt.level + 1,
      tt.path || ' > ' || t.name
    FROM teams t
    INNER JOIN team_tree tt ON t.parent_team_id = tt.id
  )
  SELECT * FROM team_tree ORDER BY level, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all root teams (teams without parents)
CREATE OR REPLACE FUNCTION get_root_teams()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  owner_user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  child_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.owner_user_id,
    t.created_at,
    t.updated_at,
    COUNT(child.id) AS child_count
  FROM teams t
  LEFT JOIN teams child ON child.parent_team_id = t.id
  WHERE t.parent_team_id IS NULL
  GROUP BY t.id, t.name, t.description, t.owner_user_id, t.created_at, t.updated_at
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get direct children of a team
CREATE OR REPLACE FUNCTION get_team_children(team_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  parent_team_id UUID,
  owner_user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  child_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.parent_team_id,
    t.owner_user_id,
    t.created_at,
    t.updated_at,
    COUNT(child.id) AS child_count
  FROM teams t
  LEFT JOIN teams child ON child.parent_team_id = t.id
  WHERE t.parent_team_id = team_id
  GROUP BY t.id, t.name, t.description, t.parent_team_id, t.owner_user_id, t.created_at, t.updated_at
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_team_hierarchy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_root_teams() TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_children(UUID) TO authenticated;

COMMIT;

