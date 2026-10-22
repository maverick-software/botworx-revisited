# Database Function Design Research Document

**Research Date:** August 28, 2025  
**WBS Section:** Phase 3 - Design (Items 3.3.1 - 3.3.4)  
**Purpose:** Research database function patterns and stored procedure design for canvas operations

## 3.3.1 - Design Canvas Data Functions

### Current Database Function Patterns Analysis
From `20250130000001_fix_grant_permission_functions.sql` and other migrations:

**Established Function Patterns:**

**Function Structure Pattern:**
```sql
-- Function header with clear purpose and parameters
CREATE OR REPLACE FUNCTION public.function_name(
    p_param1 UUID,
    p_param2 TEXT,
    p_param3 JSONB DEFAULT '{}'
)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_variable_name UUID;
    v_user_id UUID;
BEGIN
    -- Get current user ID for RLS
    v_user_id := auth.uid();
    
    -- Validation and security checks
    IF NOT EXISTS (SELECT 1 FROM table WHERE condition) THEN
        RAISE EXCEPTION 'Error message with context';
    END IF;
    
    -- Main operation with error handling
    -- Return result
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Error logging and re-raise
        RAISE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.function_name(UUID, TEXT, JSONB) TO anon, authenticated;

-- Add documentation
COMMENT ON FUNCTION public.function_name(UUID, TEXT, JSONB) IS 'Clear description of function purpose and behavior';
```

### Canvas Data Functions Design

**1. Save Canvas Layout Function:**
```sql
CREATE OR REPLACE FUNCTION public.save_team_canvas_layout(
    p_workspace_id UUID,
    p_positions JSONB,
    p_connections JSONB,
    p_view_settings JSONB DEFAULT '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_layout_id UUID;
    v_existing_layout_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to save canvas layout';
    END IF;
    
    -- Verify user has access to workspace
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id = v_user_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'User does not have access to this workspace';
    END IF;
    
    -- Validate positions JSON structure
    IF NOT jsonb_typeof(p_positions) = 'array' THEN
        RAISE EXCEPTION 'Positions must be a JSON array';
    END IF;
    
    -- Validate connections JSON structure  
    IF NOT jsonb_typeof(p_connections) = 'array' THEN
        RAISE EXCEPTION 'Connections must be a JSON array';
    END IF;
    
    -- Check for existing layout
    SELECT id INTO v_existing_layout_id
    FROM team_canvas_layouts
    WHERE user_id = v_user_id 
    AND workspace_id = p_workspace_id;
    
    -- Insert or update layout
    IF v_existing_layout_id IS NOT NULL THEN
        -- Update existing layout
        UPDATE team_canvas_layouts
        SET 
            positions = p_positions,
            connections = p_connections,
            view_settings = p_view_settings,
            updated_at = NOW()
        WHERE id = v_existing_layout_id
        RETURNING id INTO v_layout_id;
    ELSE
        -- Create new layout
        INSERT INTO team_canvas_layouts (
            user_id,
            workspace_id,
            positions,
            connections,
            view_settings
        ) VALUES (
            v_user_id,
            p_workspace_id,
            p_positions,
            p_connections,
            p_view_settings
        )
        RETURNING id INTO v_layout_id;
    END IF;
    
    -- Log the save operation for audit
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'canvas_layout_save',
        v_user_id,
        jsonb_build_object(
            'workspace_id', p_workspace_id,
            'layout_id', v_layout_id,
            'position_count', jsonb_array_length(p_positions),
            'connection_count', jsonb_array_length(p_connections)
        )
    );
    
    RETURN v_layout_id;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        INSERT INTO system_alerts (
            type,
            severity, 
            message,
            context
        ) VALUES (
            'database_error',
            'error',
            'Failed to save canvas layout: ' || SQLERRM,
            jsonb_build_object(
                'function', 'save_team_canvas_layout',
                'user_id', v_user_id,
                'workspace_id', p_workspace_id,
                'error_detail', SQLSTATE
            )
        );
        
        RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_team_canvas_layout(UUID, JSONB, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.save_team_canvas_layout(UUID, JSONB, JSONB, JSONB) IS 'Save or update team canvas layout for a user in a specific workspace with validation and audit logging';
```

**2. Load Canvas Layout Function:**
```sql
CREATE OR REPLACE FUNCTION public.get_team_canvas_layout(
    p_workspace_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    layout_id UUID,
    workspace_id UUID,
    positions JSONB,
    connections JSONB,
    view_settings JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requesting_user_id UUID;
    v_target_user_id UUID;
BEGIN
    -- Get current user ID
    v_requesting_user_id := auth.uid();
    
    IF v_requesting_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to access canvas layout';
    END IF;
    
    -- Determine target user (default to requesting user)
    v_target_user_id := COALESCE(p_user_id, v_requesting_user_id);
    
    -- Verify requesting user has access to workspace
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id = v_requesting_user_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'User does not have access to this workspace';
    END IF;
    
    -- If requesting another user's layout, verify permissions
    IF v_target_user_id != v_requesting_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM workspace_members wm1
            JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
            WHERE wm1.workspace_id = p_workspace_id
            AND wm1.user_id = v_requesting_user_id
            AND wm1.role IN ('admin', 'owner')
            AND wm2.user_id = v_target_user_id
        ) THEN
            RAISE EXCEPTION 'Insufficient permissions to access other user layouts';
        END IF;
    END IF;
    
    -- Return the layout data
    RETURN QUERY
    SELECT 
        tcl.id,
        tcl.workspace_id,
        tcl.positions,
        tcl.connections,
        tcl.view_settings,
        tcl.created_at,
        tcl.updated_at
    FROM team_canvas_layouts tcl
    WHERE tcl.workspace_id = p_workspace_id 
    AND tcl.user_id = v_target_user_id;
    
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_canvas_layout(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_team_canvas_layout(UUID, UUID) IS 'Retrieve team canvas layout for a user in a workspace with proper access control';
```

## 3.3.2 - Design Team Position Functions

### Team Position Management Functions

**1. Update Team Positions Function:**
```sql
CREATE OR REPLACE FUNCTION public.update_team_positions(
    p_workspace_id UUID,
    p_position_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_layout_id UUID;
    v_current_positions JSONB;
    v_updated_positions JSONB;
    v_position_item JSONB;
    v_team_id UUID;
    v_x_position NUMERIC;
    v_y_position NUMERIC;
    v_update_count INTEGER := 0;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Verify workspace access
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id = v_user_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'User does not have access to this workspace';
    END IF;
    
    -- Validate input structure
    IF NOT jsonb_typeof(p_position_updates) = 'array' THEN
        RAISE EXCEPTION 'Position updates must be a JSON array';
    END IF;
    
    -- Get or create layout
    SELECT id, positions INTO v_layout_id, v_current_positions
    FROM team_canvas_layouts
    WHERE workspace_id = p_workspace_id AND user_id = v_user_id;
    
    IF v_layout_id IS NULL THEN
        -- Create new layout with empty positions
        INSERT INTO team_canvas_layouts (
            user_id,
            workspace_id,
            positions,
            connections,
            view_settings
        ) VALUES (
            v_user_id,
            p_workspace_id,
            '[]'::jsonb,
            '[]'::jsonb,
            '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb
        )
        RETURNING id, positions INTO v_layout_id, v_current_positions;
    END IF;
    
    -- Start with current positions
    v_updated_positions := v_current_positions;
    
    -- Process each position update
    FOR v_position_item IN SELECT * FROM jsonb_array_elements(p_position_updates)
    LOOP
        -- Extract and validate position data
        v_team_id := (v_position_item->>'teamId')::UUID;
        v_x_position := (v_position_item->>'x')::NUMERIC;
        v_y_position := (v_position_item->>'y')::NUMERIC;
        
        IF v_team_id IS NULL OR v_x_position IS NULL OR v_y_position IS NULL THEN
            RAISE EXCEPTION 'Invalid position update: teamId, x, and y are required';
        END IF;
        
        -- Verify team belongs to workspace
        IF NOT EXISTS (
            SELECT 1 FROM teams 
            WHERE id = v_team_id 
            AND (owner_user_id = v_user_id OR EXISTS (
                SELECT 1 FROM workspace_members 
                WHERE workspace_id = p_workspace_id 
                AND user_id = v_user_id
            ))
        ) THEN
            RAISE EXCEPTION 'Team % not found or access denied', v_team_id;
        END IF;
        
        -- Update positions JSON
        v_updated_positions := update_position_in_json(
            v_updated_positions, 
            v_team_id::text, 
            v_x_position, 
            v_y_position
        );
        
        v_update_count := v_update_count + 1;
    END LOOP;
    
    -- Save updated positions
    UPDATE team_canvas_layouts
    SET 
        positions = v_updated_positions,
        updated_at = NOW()
    WHERE id = v_layout_id;
    
    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'layout_id', v_layout_id,
        'updates_applied', v_update_count,
        'updated_at', NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO system_alerts (
            type,
            severity,
            message,
            context
        ) VALUES (
            'database_error',
            'error', 
            'Failed to update team positions: ' || SQLERRM,
            jsonb_build_object(
                'function', 'update_team_positions',
                'user_id', v_user_id,
                'workspace_id', p_workspace_id,
                'update_count', v_update_count
            )
        );
        
        RAISE;
END;
$$;

-- Helper function to update position in JSON array
CREATE OR REPLACE FUNCTION update_position_in_json(
    positions_array JSONB,
    team_id TEXT,
    x_pos NUMERIC,
    y_pos NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_result JSONB;
    v_found BOOLEAN := false;
    v_item JSONB;
    v_index INTEGER := 0;
BEGIN
    -- Initialize result
    v_result := '[]'::jsonb;
    
    -- Iterate through existing positions
    FOR v_item IN SELECT * FROM jsonb_array_elements(positions_array)
    LOOP
        IF (v_item->>'teamId') = team_id THEN
            -- Update existing position
            v_result := v_result || jsonb_build_array(
                jsonb_build_object(
                    'teamId', team_id,
                    'x', x_pos,
                    'y', y_pos,
                    'updatedAt', extract(epoch from now())
                )
            );
            v_found := true;
        ELSE
            -- Keep existing position
            v_result := v_result || jsonb_build_array(v_item);
        END IF;
    END LOOP;
    
    -- Add new position if not found
    IF NOT v_found THEN
        v_result := v_result || jsonb_build_array(
            jsonb_build_object(
                'teamId', team_id,
                'x', x_pos,
                'y', y_pos,
                'createdAt', extract(epoch from now())
            )
        );
    END IF;
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_team_positions(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_position_in_json(JSONB, TEXT, NUMERIC, NUMERIC) TO authenticated;
```

## 3.3.3 - Design Connection Management Functions

### Connection Management Functions

**1. Create Team Connection Function:**
```sql
CREATE OR REPLACE FUNCTION public.create_team_connection(
    p_from_team_id UUID,
    p_to_team_id UUID,
    p_connection_type team_connection_type,
    p_label TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL,
    p_style TEXT DEFAULT 'solid'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_connection_id UUID;
    v_workspace_id UUID;
    v_from_team_owner UUID;
    v_to_team_owner UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Validate connection type
    IF p_connection_type NOT IN ('reports_to', 'collaborates_with', 'supports', 'custom') THEN
        RAISE EXCEPTION 'Invalid connection type: %', p_connection_type;
    END IF;
    
    -- Prevent self-connections
    IF p_from_team_id = p_to_team_id THEN
        RAISE EXCEPTION 'Teams cannot connect to themselves';
    END IF;
    
    -- Verify both teams exist and user has access
    SELECT owner_user_id INTO v_from_team_owner
    FROM teams WHERE id = p_from_team_id;
    
    SELECT owner_user_id INTO v_to_team_owner  
    FROM teams WHERE id = p_to_team_id;
    
    IF v_from_team_owner IS NULL THEN
        RAISE EXCEPTION 'Source team not found';
    END IF;
    
    IF v_to_team_owner IS NULL THEN
        RAISE EXCEPTION 'Target team not found';
    END IF;
    
    -- Verify user has permission to create connections
    -- (either owns one of the teams or is workspace admin)
    SELECT DISTINCT t.owner_user_id INTO v_workspace_id
    FROM teams t 
    WHERE t.id IN (p_from_team_id, p_to_team_id)
    AND (t.owner_user_id = v_user_id OR EXISTS (
        SELECT 1 FROM workspace_members wm
        JOIN teams t2 ON wm.workspace_id::text = 'workspace_placeholder' -- This would need proper workspace tracking
        WHERE wm.user_id = v_user_id 
        AND wm.role IN ('admin', 'owner')
        AND wm.status = 'active'
    ));
    
    IF v_workspace_id IS NULL AND v_from_team_owner != v_user_id AND v_to_team_owner != v_user_id THEN
        RAISE EXCEPTION 'Insufficient permissions to create team connection';
    END IF;
    
    -- Check for duplicate connections
    IF EXISTS (
        SELECT 1 FROM team_connections
        WHERE from_team_id = p_from_team_id 
        AND to_team_id = p_to_team_id
        AND connection_type = p_connection_type
    ) THEN
        RAISE EXCEPTION 'Connection already exists between these teams';
    END IF;
    
    -- For hierarchical connections, prevent cycles
    IF p_connection_type = 'reports_to' THEN
        IF EXISTS (
            WITH RECURSIVE hierarchy_check AS (
                -- Start from the target team
                SELECT to_team_id as team_id, 1 as level
                FROM team_connections 
                WHERE from_team_id = p_to_team_id 
                AND connection_type = 'reports_to'
                
                UNION ALL
                
                -- Follow the reporting chain
                SELECT tc.to_team_id, hc.level + 1
                FROM team_connections tc
                JOIN hierarchy_check hc ON tc.from_team_id = hc.team_id
                WHERE tc.connection_type = 'reports_to'
                AND hc.level < 10 -- Prevent infinite loops
            )
            SELECT 1 FROM hierarchy_check WHERE team_id = p_from_team_id
        ) THEN
            RAISE EXCEPTION 'This connection would create a circular reporting structure';
        END IF;
    END IF;
    
    -- Create the connection
    INSERT INTO team_connections (
        from_team_id,
        to_team_id,
        connection_type,
        label,
        color,
        style,
        created_by_user_id
    ) VALUES (
        p_from_team_id,
        p_to_team_id,
        p_connection_type,
        p_label,
        p_color,
        p_style,
        v_user_id
    )
    RETURNING id INTO v_connection_id;
    
    -- Log the connection creation
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'team_connection_created',
        v_user_id,
        jsonb_build_object(
            'connection_id', v_connection_id,
            'from_team_id', p_from_team_id,
            'to_team_id', p_to_team_id,
            'connection_type', p_connection_type
        )
    );
    
    RETURN v_connection_id;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO system_alerts (
            type,
            severity,
            message,
            context
        ) VALUES (
            'database_error',
            'error',
            'Failed to create team connection: ' || SQLERRM,
            jsonb_build_object(
                'function', 'create_team_connection',
                'user_id', v_user_id,
                'from_team_id', p_from_team_id,
                'to_team_id', p_to_team_id,
                'connection_type', p_connection_type
            )
        );
        
        RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_connection(UUID, UUID, team_connection_type, TEXT, TEXT, TEXT) TO authenticated;
```

## 3.3.4 - Design Layout Validation Functions

### Layout Validation and Utility Functions

**1. Validate Canvas Layout Function:**
```sql
CREATE OR REPLACE FUNCTION public.validate_canvas_layout(
    p_positions JSONB,
    p_connections JSONB,
    p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_validation_result JSONB;
    v_errors JSONB[];
    v_warnings JSONB[];
    v_position_item JSONB;
    v_connection_item JSONB;
    v_team_id UUID;
    v_from_team_id UUID;
    v_to_team_id UUID;
    v_team_exists BOOLEAN;
    v_connection_count INTEGER;
    v_circular_refs INTEGER;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Initialize result arrays
    v_errors := ARRAY[]::JSONB[];
    v_warnings := ARRAY[]::JSONB[];
    
    -- Validate positions structure and data
    IF jsonb_typeof(p_positions) != 'array' THEN
        v_errors := array_append(v_errors, jsonb_build_object(
            'type', 'structure_error',
            'field', 'positions',
            'message', 'Positions must be a JSON array'
        ));
    ELSE
        -- Validate each position
        FOR v_position_item IN SELECT * FROM jsonb_array_elements(p_positions)
        LOOP
            -- Check required fields
            IF NOT (v_position_item ? 'teamId' AND v_position_item ? 'x' AND v_position_item ? 'y') THEN
                v_errors := array_append(v_errors, jsonb_build_object(
                    'type', 'validation_error',
                    'field', 'positions',
                    'message', 'Position items must have teamId, x, and y fields',
                    'item', v_position_item
                ));
                CONTINUE;
            END IF;
            
            -- Validate team ID
            BEGIN
                v_team_id := (v_position_item->>'teamId')::UUID;
            EXCEPTION
                WHEN OTHERS THEN
                    v_errors := array_append(v_errors, jsonb_build_object(
                        'type', 'validation_error',
                        'field', 'positions',
                        'message', 'Invalid team ID format',
                        'teamId', v_position_item->>'teamId'
                    ));
                    CONTINUE;
            END;
            
            -- Check if team exists and user has access
            SELECT EXISTS (
                SELECT 1 FROM teams t
                WHERE t.id = v_team_id
                AND (t.owner_user_id = v_user_id OR EXISTS (
                    SELECT 1 FROM workspace_members wm
                    WHERE wm.workspace_id = p_workspace_id
                    AND wm.user_id = v_user_id
                    AND wm.status = 'active'
                ))
            ) INTO v_team_exists;
            
            IF NOT v_team_exists THEN
                v_errors := array_append(v_errors, jsonb_build_object(
                    'type', 'access_error',
                    'field', 'positions',
                    'message', 'Team not found or access denied',
                    'teamId', v_team_id::text
                ));
            END IF;
            
            -- Validate coordinate ranges (reasonable canvas bounds)
            IF (v_position_item->>'x')::NUMERIC < -10000 OR 
               (v_position_item->>'x')::NUMERIC > 10000 OR
               (v_position_item->>'y')::NUMERIC < -10000 OR 
               (v_position_item->>'y')::NUMERIC > 10000 THEN
                v_warnings := array_append(v_warnings, jsonb_build_object(
                    'type', 'bounds_warning',
                    'field', 'positions',
                    'message', 'Team position is outside recommended canvas bounds',
                    'teamId', v_team_id::text,
                    'position', jsonb_build_object('x', v_position_item->>'x', 'y', v_position_item->>'y')
                ));
            END IF;
        END LOOP;
    END IF;
    
    -- Validate connections structure and data
    IF jsonb_typeof(p_connections) != 'array' THEN
        v_errors := array_append(v_errors, jsonb_build_object(
            'type', 'structure_error',
            'field', 'connections',
            'message', 'Connections must be a JSON array'
        ));
    ELSE
        -- Validate each connection
        FOR v_connection_item IN SELECT * FROM jsonb_array_elements(p_connections)
        LOOP
            -- Check required fields
            IF NOT (v_connection_item ? 'fromTeamId' AND 
                   v_connection_item ? 'toTeamId' AND 
                   v_connection_item ? 'type') THEN
                v_errors := array_append(v_errors, jsonb_build_object(
                    'type', 'validation_error',
                    'field', 'connections',
                    'message', 'Connection items must have fromTeamId, toTeamId, and type fields',
                    'item', v_connection_item
                ));
                CONTINUE;
            END IF;
            
            -- Validate team IDs
            BEGIN
                v_from_team_id := (v_connection_item->>'fromTeamId')::UUID;
                v_to_team_id := (v_connection_item->>'toTeamId')::UUID;
            EXCEPTION
                WHEN OTHERS THEN
                    v_errors := array_append(v_errors, jsonb_build_object(
                        'type', 'validation_error',
                        'field', 'connections',
                        'message', 'Invalid team ID format in connection',
                        'item', v_connection_item
                    ));
                    CONTINUE;
            END;
            
            -- Check for self-references
            IF v_from_team_id = v_to_team_id THEN
                v_errors := array_append(v_errors, jsonb_build_object(
                    'type', 'validation_error',
                    'field', 'connections',
                    'message', 'Teams cannot connect to themselves',
                    'teamId', v_from_team_id::text
                ));
            END IF;
            
            -- Validate connection type
            IF NOT (v_connection_item->>'type') IN ('reports_to', 'collaborates_with', 'supports', 'custom') THEN
                v_errors := array_append(v_errors, jsonb_build_object(
                    'type', 'validation_error',
                    'field', 'connections',
                    'message', 'Invalid connection type',
                    'type', v_connection_item->>'type',
                    'validTypes', ARRAY['reports_to', 'collaborates_with', 'supports', 'custom']
                ));
            END IF;
        END LOOP;
        
        -- Check for circular references in reporting structure
        SELECT count_circular_references(p_connections) INTO v_circular_refs;
        
        IF v_circular_refs > 0 THEN
            v_errors := array_append(v_errors, jsonb_build_object(
                'type', 'structure_error',
                'field', 'connections',
                'message', 'Circular reporting structures detected',
                'circularReferenceCount', v_circular_refs
            ));
        END IF;
        
        -- Check connection density (performance warning)
        SELECT jsonb_array_length(p_connections) INTO v_connection_count;
        
        IF v_connection_count > 100 THEN
            v_warnings := array_append(v_warnings, jsonb_build_object(
                'type', 'performance_warning',
                'field', 'connections',
                'message', 'Large number of connections may impact canvas performance',
                'connectionCount', v_connection_count,
                'recommendation', 'Consider grouping teams or using different visualization'
            ));
        END IF;
    END IF;
    
    -- Build final validation result
    v_validation_result := jsonb_build_object(
        'valid', array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0,
        'errors', to_jsonb(v_errors),
        'warnings', to_jsonb(v_warnings),
        'summary', jsonb_build_object(
            'errorCount', COALESCE(array_length(v_errors, 1), 0),
            'warningCount', COALESCE(array_length(v_warnings, 1), 0),
            'positionCount', jsonb_array_length(p_positions),
            'connectionCount', jsonb_array_length(p_connections)
        ),
        'validatedAt', extract(epoch from now())
    );
    
    RETURN v_validation_result;
    
END;
$$;

-- Helper function to detect circular references
CREATE OR REPLACE FUNCTION count_circular_references(connections JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_connection JSONB;
    v_from_team UUID;
    v_to_team UUID;
    v_circular_count INTEGER := 0;
BEGIN
    -- This is a simplified check - in practice would need more sophisticated cycle detection
    FOR v_connection IN SELECT * FROM jsonb_array_elements(connections)
    LOOP
        IF v_connection->>'type' = 'reports_to' THEN
            v_from_team := (v_connection->>'fromTeamId')::UUID;
            v_to_team := (v_connection->>'toTeamId')::UUID;
            
            -- Check if reverse connection exists
            IF EXISTS (
                SELECT 1 FROM jsonb_array_elements(connections) as reverse_conn
                WHERE reverse_conn->>'type' = 'reports_to'
                AND (reverse_conn->>'fromTeamId')::UUID = v_to_team
                AND (reverse_conn->>'toTeamId')::UUID = v_from_team
            ) THEN
                v_circular_count := v_circular_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_circular_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_canvas_layout(JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION count_circular_references(JSONB) TO authenticated;

COMMENT ON FUNCTION public.validate_canvas_layout(JSONB, JSONB, UUID) IS 'Comprehensive validation of canvas layout data including structure, permissions, and business rules';
```

### Performance and Monitoring Functions

**Canvas Performance Metrics Function:**
```sql
CREATE OR REPLACE FUNCTION public.get_canvas_performance_metrics(
    p_workspace_id UUID,
    p_days_back INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_metrics JSONB;
    v_layout_count INTEGER;
    v_save_frequency NUMERIC;
    v_avg_positions INTEGER;
    v_avg_connections INTEGER;
    v_performance_score INTEGER;
BEGIN
    -- Get current user ID  
    v_user_id := auth.uid();
    
    -- Verify workspace access
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id = v_user_id 
        AND status = 'active'
        AND role IN ('admin', 'owner')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to view performance metrics';
    END IF;
    
    -- Calculate metrics
    SELECT COUNT(*) INTO v_layout_count
    FROM team_canvas_layouts
    WHERE workspace_id = p_workspace_id
    AND updated_at >= NOW() - INTERVAL '%s days' % p_days_back;
    
    SELECT COUNT(*)::NUMERIC / GREATEST(p_days_back, 1) INTO v_save_frequency
    FROM usage_events
    WHERE feature = 'canvas_layout_save'
    AND metadata->>'workspace_id' = p_workspace_id::text
    AND timestamp >= NOW() - INTERVAL '%s days' % p_days_back;
    
    SELECT 
        AVG(jsonb_array_length(positions))::INTEGER,
        AVG(jsonb_array_length(connections))::INTEGER
    INTO v_avg_positions, v_avg_connections
    FROM team_canvas_layouts
    WHERE workspace_id = p_workspace_id;
    
    -- Calculate performance score (0-100)
    v_performance_score := LEAST(100, GREATEST(0,
        100 - (v_avg_connections * 2) - (v_avg_positions / 2)
    ));
    
    -- Build metrics response
    v_metrics := jsonb_build_object(
        'workspace_id', p_workspace_id,
        'period_days', p_days_back,
        'layout_count', v_layout_count,
        'save_frequency_per_day', ROUND(v_save_frequency, 2),
        'average_positions', v_avg_positions,
        'average_connections', v_avg_connections,
        'performance_score', v_performance_score,
        'recommendations', CASE
            WHEN v_avg_connections > 50 THEN '["Consider reducing connection complexity", "Group related teams"]'::jsonb
            WHEN v_avg_positions > 100 THEN '["Large canvas detected", "Consider workspace organization"]'::jsonb
            ELSE '["Canvas performance is optimal"]'::jsonb
        END,
        'generated_at', extract(epoch from now())
    );
    
    RETURN v_metrics;
    
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_canvas_performance_metrics(UUID, INTEGER) TO authenticated;
```

## Function Integration Best Practices

### Error Handling and Logging Pattern
```sql
-- Standardized error handling template
EXCEPTION
    WHEN OTHERS THEN
        -- Detailed error logging
        INSERT INTO system_alerts (
            type,
            severity,
            message,
            context,
            triggered_at
        ) VALUES (
            'database_function_error',
            CASE 
                WHEN SQLSTATE LIKE '23%' THEN 'warning'  -- Constraint violations
                WHEN SQLSTATE LIKE '42%' THEN 'error'    -- Syntax/access errors  
                ELSE 'critical'                          -- Other errors
            END,
            format('Function %s failed: %s', 'function_name', SQLERRM),
            jsonb_build_object(
                'function_name', 'function_name',
                'sql_state', SQLSTATE,
                'user_id', v_user_id,
                'parameters', jsonb_build_object(
                    'param1', p_param1,
                    'param2', p_param2
                )
            ),
            NOW()
        );
        
        -- Re-raise with context
        RAISE EXCEPTION 'Function failed: % (State: %)', SQLERRM, SQLSTATE;
```

### Performance Monitoring Integration
```sql
-- Function performance tracking
DO $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_duration INTERVAL;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Function execution here
    
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    -- Log performance if slow
    IF v_duration > INTERVAL '1 second' THEN
        INSERT INTO system_metrics (
            name,
            value,
            type,
            labels,
            timestamp
        ) VALUES (
            'slow_function_execution',
            EXTRACT(EPOCH FROM v_duration),
            'duration_seconds',
            jsonb_build_object(
                'function_name', 'function_name',
                'user_id', v_user_id::text
            ),
            v_end_time
        );
    END IF;
END $$;
```
