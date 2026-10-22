# Database Design Finalization Research Document

**Research Date:** August 28, 2025  
**WBS Section:** Phase 2 - Planning (Items 2.2.1 - 2.2.4)  
**Purpose:** Research database design patterns and migration strategies for canvas functionality

## 2.2.1 - Create Detailed Migration Scripts

### Current Migration Patterns Analysis
From existing migrations analysis:

**Migration File Naming Convention:**
- Format: `YYYYMMDD_HHMMSS_description.sql`
- Example: `20250130000003_create_system_monitoring_tables.sql`

**Standard Migration Structure:**
```sql
-- Migration header with purpose and date
-- Create tables with proper constraints
-- Add indexes for performance  
-- Enable RLS (Row Level Security)
-- Create RLS policies
-- Add table/column comments
-- Grant appropriate permissions
```

**Recommended Canvas Migration Files:**
```sql
-- File 1: 20250828_120000_create_team_canvas_tables.sql
-- Creates: team_canvas_positions, team_connections, team_canvas_viewport

-- File 2: 20250828_120100_create_team_canvas_functions.sql  
-- Creates: save_team_position, create_team_connection, get_user_canvas_data

-- File 3: 20250828_120200_create_team_canvas_policies.sql
-- Creates: RLS policies for all canvas tables
```

**Migration Script Template:**
```sql
-- Create Team Canvas Tables
-- Date: August 28, 2025
-- Purpose: Add visual canvas support for team hierarchy visualization

BEGIN;

-- Team positioning data (per user)
CREATE TABLE IF NOT EXISTS public.team_canvas_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  x_position numeric(10,2) NOT NULL DEFAULT 0,
  y_position numeric(10,2) NOT NULL DEFAULT 0,
  width numeric(10,2) DEFAULT 200,
  height numeric(10,2) DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_team_position_per_user UNIQUE(team_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_canvas_positions_user_id 
  ON public.team_canvas_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_team_canvas_positions_team_id 
  ON public.team_canvas_positions(team_id);

-- Enable RLS
ALTER TABLE public.team_canvas_positions ENABLE ROW LEVEL SECURITY;

-- Comments for documentation
COMMENT ON TABLE public.team_canvas_positions IS 'Stores team positions on visual canvas per user';

COMMIT;
```

## 2.2.2 - Design Database Functions for Common Operations

### Current Function Patterns Analysis
From `20250130000001_fix_grant_permission_functions.sql`:

**Function Structure Pattern:**
- Header with purpose and parameters
- `SECURITY DEFINER` for elevated privileges
- `SET search_path = public` for security
- Proper error handling with meaningful messages
- Transaction safety with proper ROLLBACK on errors
- Return types that match frontend expectations

**Required Canvas Functions:**

**1. save_team_position Function:**
```sql
CREATE OR REPLACE FUNCTION public.save_team_position(
    p_team_id UUID,
    p_x_position NUMERIC,
    p_y_position NUMERIC,
    p_width NUMERIC DEFAULT 200,
    p_height NUMERIC DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify team belongs to user (RLS check)
    IF NOT EXISTS (
        SELECT 1 FROM teams WHERE id = p_team_id
    ) THEN
        RAISE EXCEPTION 'Team not found or access denied';
    END IF;
    
    -- Insert or update position
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
$$;
```

**2. create_team_connection Function:**
```sql
CREATE OR REPLACE FUNCTION public.create_team_connection(
    p_source_team_id UUID,
    p_target_team_id UUID,
    p_connection_type TEXT DEFAULT 'reports_to',
    p_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    connection_id UUID;
BEGIN
    -- Validation
    IF p_source_team_id = p_target_team_id THEN
        RAISE EXCEPTION 'Cannot create connection from team to itself';
    END IF;
    
    -- Verify both teams exist and user has access
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_source_team_id) OR
       NOT EXISTS (SELECT 1 FROM teams WHERE id = p_target_team_id) THEN
        RAISE EXCEPTION 'One or both teams not found or access denied';
    END IF;
    
    -- Insert connection
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
$$;
```

## 2.2.3 - Plan Data Migration Strategy for Existing Teams

### Migration Strategy Analysis

**Current Team Count Assessment Needed:**
- Query existing teams count per user
- Analyze typical organizational structures
- Plan default positioning algorithms

**Default Positioning Strategy:**
```sql
-- Create default positions for existing teams
DO $$
DECLARE
    team_record RECORD;
    user_record RECORD;
    position_x NUMERIC;
    position_y NUMERIC;
    row_count INTEGER := 0;
    teams_per_row INTEGER := 4;
    node_width NUMERIC := 200;
    node_height NUMERIC := 100;
    spacing_x NUMERIC := 250;
    spacing_y NUMERIC := 150;
BEGIN
    -- For each user, create default positions for their teams
    FOR user_record IN SELECT DISTINCT owner_user_id FROM teams WHERE owner_user_id IS NOT NULL
    LOOP
        row_count := 0;
        
        FOR team_record IN 
            SELECT id FROM teams 
            WHERE owner_user_id = user_record.owner_user_id 
            ORDER BY created_at
        LOOP
            -- Calculate grid position
            position_x := (row_count % teams_per_row) * spacing_x;
            position_y := (row_count / teams_per_row)::INTEGER * spacing_y;
            
            -- Insert default position
            INSERT INTO team_canvas_positions 
            (team_id, user_id, x_position, y_position, width, height)
            VALUES 
            (team_record.id, user_record.owner_user_id, position_x, position_y, node_width, node_height);
            
            row_count := row_count + 1;
        END LOOP;
    END LOOP;
END $$;
```

**Migration Phases:**
1. **Phase 1**: Create empty tables with constraints
2. **Phase 2**: Populate default positions for existing teams
3. **Phase 3**: Create database functions
4. **Phase 4**: Apply RLS policies
5. **Phase 5**: Validate data integrity

## 2.2.4 - Test Schema Design with Sample Data

### Testing Strategy

**Test Data Creation Script:**
```sql
-- Test data for canvas functionality
BEGIN;

-- Create test user if not exists (for testing only)
INSERT INTO auth.users (id, email) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test@example.com')
ON CONFLICT DO NOTHING;

-- Create test teams
INSERT INTO teams (id, name, description, owner_user_id) VALUES
('team-1', 'Engineering', 'Software development team', '550e8400-e29b-41d4-a716-446655440000'),
('team-2', 'Marketing', 'Marketing and promotion team', '550e8400-e29b-41d4-a716-446655440000'),
('team-3', 'Sales', 'Sales and customer relations', '550e8400-e29b-41d4-a716-446655440000');

-- Create test positions
INSERT INTO team_canvas_positions (team_id, user_id, x_position, y_position) VALUES
('team-1', '550e8400-e29b-41d4-a716-446655440000', 0, 0),
('team-2', '550e8400-e29b-41d4-a716-446655440000', 300, 0),
('team-3', '550e8400-e29b-41d4-a716-446655440000', 150, 200);

-- Create test connections
INSERT INTO team_connections (user_id, source_team_id, target_team_id, connection_type) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'team-2', 'team-1', 'collaborates_with'),
('550e8400-e29b-41d4-a716-446655440000', 'team-3', 'team-2', 'reports_to');

COMMIT;
```

**Validation Queries:**
```sql
-- Test queries to validate schema design
-- 1. Verify position constraints
SELECT COUNT(*) FROM team_canvas_positions WHERE x_position < 0 OR y_position < 0;

-- 2. Verify connection constraints  
SELECT COUNT(*) FROM team_connections WHERE source_team_id = target_team_id;

-- 3. Test RLS policies
SET ROLE authenticated;
SELECT COUNT(*) FROM team_canvas_positions; -- Should only see user's own positions

-- 4. Test function performance
EXPLAIN ANALYZE SELECT * FROM get_user_canvas_data('550e8400-e29b-41d4-a716-446655440000');
```

**Performance Benchmarking:**
- Test with 100+ teams per user
- Measure query response times for canvas data
- Validate index effectiveness
- Test concurrent user scenarios

## Key Database Design Decisions

### 1. Per-User Canvas Layouts
- Each user has their own view of team organization
- Enables different organizational perspectives
- Requires user_id in all canvas-related tables

### 2. Cascade Delete Strategy  
- Team deletion removes positions and connections
- User deletion removes their canvas configurations
- Maintains referential integrity

### 3. Numeric Precision for Positions
- `NUMERIC(10,2)` for precise positioning
- Supports zoom levels and fractional positions
- Compatible with JavaScript Number precision

### 4. Connection Type Extensibility
- TEXT field allows custom relationship types
- Standard types: 'reports_to', 'collaborates_with', 'supports'
- Future expansion without schema changes

### 5. Performance Optimization
- Strategic indexing on user_id and team_id
- Composite unique constraints prevent duplicates  
- RLS policies leverage existing indexes
