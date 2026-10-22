# Database Schema Requirements for Visual Team Canvas

**Research Date:** August 28, 2025  
**Purpose:** Design database schema to support visual team hierarchy canvas

## Current Schema Analysis

### Existing Teams Table
```sql
teams: {
  id: uuid PRIMARY KEY,
  name: text NOT NULL,
  description: text,
  owner_user_id: uuid,
  created_at: timestamptz DEFAULT now(),
  updated_at: timestamptz DEFAULT now()
}
```

## Required Schema Extensions

### 1. Team Canvas Positions Table
Store visual positioning data for teams on canvas:

```sql
CREATE TABLE team_canvas_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  x_position numeric(10,2) NOT NULL DEFAULT 0,
  y_position numeric(10,2) NOT NULL DEFAULT 0,
  width numeric(10,2) DEFAULT 200,
  height numeric(10,2) DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_team_position_per_user 
    UNIQUE(team_id, user_id)
);
```

**Rationale:**
- Per-user positioning allows different organizational views
- Numeric precision for exact positioning
- Default dimensions for consistency
- Cascade delete maintains data integrity

### 2. Team Connections Table
Store visual connections/relationships between teams:

```sql
CREATE TABLE team_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  target_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  connection_type text DEFAULT 'reports_to',
  label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT no_self_connection 
    CHECK (source_team_id != target_team_id),
  CONSTRAINT unique_team_connection 
    UNIQUE(user_id, source_team_id, target_team_id)
);
```

**Connection Types:**
- `'reports_to'` - Hierarchical reporting relationship
- `'collaborates_with'` - Peer collaboration 
- `'supports'` - Support relationship
- `'custom'` - User-defined relationship

### 3. Canvas Viewport State Table
Store canvas view state (zoom, pan position):

```sql
CREATE TABLE team_canvas_viewport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zoom_level numeric(5,3) DEFAULT 1.0,
  pan_x numeric(10,2) DEFAULT 0,
  pan_y numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_viewport_per_user UNIQUE(user_id)
);
```

## Indexes for Performance

```sql
-- Query team positions efficiently
CREATE INDEX idx_team_canvas_positions_user_id 
  ON team_canvas_positions(user_id);

CREATE INDEX idx_team_canvas_positions_team_id 
  ON team_canvas_positions(team_id);

-- Query connections efficiently  
CREATE INDEX idx_team_connections_user_id 
  ON team_connections(user_id);

CREATE INDEX idx_team_connections_source 
  ON team_connections(source_team_id);

CREATE INDEX idx_team_connections_target 
  ON team_connections(target_team_id);
```

## Row Level Security (RLS) Policies

### Team Canvas Positions
```sql
-- Users can only see/edit their own canvas layouts
ALTER TABLE team_canvas_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_canvas_positions_user_access 
  ON team_canvas_positions 
  FOR ALL TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());
```

### Team Connections  
```sql
-- Users can only see/edit their own team connections
ALTER TABLE team_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_connections_user_access 
  ON team_connections 
  FOR ALL TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());
```

### Canvas Viewport
```sql
-- Users can only access their own viewport state
ALTER TABLE team_canvas_viewport ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_canvas_viewport_user_access 
  ON team_canvas_viewport 
  FOR ALL TO authenticated 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());
```

## Database Functions

### Save Team Position
```sql
CREATE OR REPLACE FUNCTION save_team_position(
  p_team_id uuid,
  p_x_position numeric,
  p_y_position numeric,
  p_width numeric DEFAULT 200,
  p_height numeric DEFAULT 100
) RETURNS void AS $$
BEGIN
  INSERT INTO team_canvas_positions (team_id, user_id, x_position, y_position, width, height)
  VALUES (p_team_id, auth.uid(), p_x_position, p_y_position, p_width, p_height)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    x_position = EXCLUDED.x_position,
    y_position = EXCLUDED.y_position,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Create Team Connection
```sql
CREATE OR REPLACE FUNCTION create_team_connection(
  p_source_team_id uuid,
  p_target_team_id uuid,
  p_connection_type text DEFAULT 'reports_to',
  p_label text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  connection_id uuid;
BEGIN
  INSERT INTO team_connections (user_id, source_team_id, target_team_id, connection_type, label)
  VALUES (auth.uid(), p_source_team_id, p_target_team_id, p_connection_type, p_label)
  ON CONFLICT (user_id, source_team_id, target_team_id) 
  DO UPDATE SET 
    connection_type = EXCLUDED.connection_type,
    label = EXCLUDED.label,
    updated_at = now()
  RETURNING id INTO connection_id;
  
  RETURN connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Migration Strategy

1. **Phase 1**: Add new tables with indexes and RLS
2. **Phase 2**: Create database functions for common operations
3. **Phase 3**: Populate default positions for existing teams
4. **Phase 4**: Add foreign key constraints after data migration

## Data Integrity Considerations

- **Cascade Deletes**: Team/user deletion removes associated canvas data
- **Constraint Validation**: Prevent self-connections and duplicate relationships  
- **Default Values**: Ensure new teams get reasonable default positions
- **Atomic Updates**: Canvas state changes as single transactions
