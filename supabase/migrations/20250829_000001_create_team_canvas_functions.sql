-- Create Team Canvas Management Functions
-- Date: August 28, 2025
-- Purpose: Stored procedures for canvas operations with validation and security

BEGIN;

-- Function 1: Save Canvas Layout
-- Saves or updates a user's canvas layout with comprehensive validation
CREATE OR REPLACE FUNCTION public.save_team_canvas_layout(
    p_workspace_id UUID DEFAULT NULL,
    p_positions JSONB DEFAULT '[]'::jsonb,
    p_connections JSONB DEFAULT '[]'::jsonb,
    p_view_settings JSONB DEFAULT '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_layout_id UUID;
    v_existing_layout_id UUID;
    v_team_id UUID;
    v_position_item JSONB;
    v_connection_item JSONB;
    v_validation_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to save canvas layout'
        );
    END IF;
    
    -- Validate positions JSON structure
    IF NOT jsonb_typeof(p_positions) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Positions must be a JSON array');
    ELSE
        -- Validate each position
        FOR v_position_item IN SELECT * FROM jsonb_array_elements(p_positions)
        LOOP
            -- Check required fields
            IF NOT (v_position_item ? 'teamId' AND v_position_item ? 'x' AND v_position_item ? 'y') THEN
                v_validation_errors := array_append(v_validation_errors, 'Position items must have teamId, x, and y fields');
                CONTINUE;
            END IF;
            
            -- Validate team ID and ownership
            BEGIN
                v_team_id := (v_position_item->>'teamId')::UUID;
                
                IF NOT EXISTS (
                    SELECT 1 FROM teams 
                    WHERE id = v_team_id 
                    AND owner_user_id = v_user_id
                ) THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        format('Team %s not found or access denied', v_team_id));
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        'Invalid team ID format: ' || (v_position_item->>'teamId'));
            END;
        END LOOP;
    END IF;
    
    -- Validate connections JSON structure
    IF NOT jsonb_typeof(p_connections) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Connections must be a JSON array');
    ELSE
        -- Basic connection validation (detailed validation in separate function)
        FOR v_connection_item IN SELECT * FROM jsonb_array_elements(p_connections)
        LOOP
            IF NOT (v_connection_item ? 'fromTeamId' AND 
                   v_connection_item ? 'toTeamId' AND 
                   v_connection_item ? 'type') THEN
                v_validation_errors := array_append(v_validation_errors, 
                    'Connection items must have fromTeamId, toTeamId, and type fields');
            END IF;
        END LOOP;
    END IF;
    
    -- Return validation errors if any
    IF array_length(v_validation_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Validation failed',
            'validation_errors', to_jsonb(v_validation_errors)
        );
    END IF;
    
    -- Check for existing layout
    SELECT id INTO v_existing_layout_id
    FROM team_canvas_layouts
    WHERE user_id = v_user_id 
    AND workspace_id IS NOT DISTINCT FROM p_workspace_id;
    
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
    
    -- Log the save operation
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'canvas_layout_save',
        v_user_id,
        jsonb_build_object(
            'layout_id', v_layout_id,
            'workspace_id', p_workspace_id,
            'position_count', jsonb_array_length(p_positions),
            'connection_count', jsonb_array_length(p_connections),
            'action', CASE WHEN v_existing_layout_id IS NOT NULL THEN 'update' ELSE 'create' END
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'layout_id', v_layout_id,
        'position_count', jsonb_array_length(p_positions),
        'connection_count', jsonb_array_length(p_connections),
        'saved_at', NOW()
    );
    
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
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal error saving canvas layout',
            'error_code', SQLSTATE
        );
END;
$$;

-- Function 2: Get Canvas Layout
-- Retrieves a user's canvas layout with proper access control
CREATE OR REPLACE FUNCTION public.get_team_canvas_layout(
    p_workspace_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requesting_user_id UUID;
    v_target_user_id UUID;
    v_layout RECORD;
    v_team_data JSONB;
BEGIN
    -- Get current user ID
    v_requesting_user_id := auth.uid();
    
    IF v_requesting_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to access canvas layout'
        );
    END IF;
    
    -- Determine target user (default to requesting user)
    v_target_user_id := COALESCE(p_user_id, v_requesting_user_id);
    
    -- For now, users can only access their own layouts
    -- Future enhancement: Add workspace-based sharing
    IF v_target_user_id != v_requesting_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Access denied to other user layouts'
        );
    END IF;
    
    -- Get the layout
    SELECT 
        id,
        workspace_id,
        positions,
        connections,
        view_settings,
        created_at,
        updated_at
    INTO v_layout
    FROM team_canvas_layouts
    WHERE user_id = v_target_user_id 
    AND workspace_id IS NOT DISTINCT FROM p_workspace_id;
    
    -- If no layout found, return default empty layout
    IF v_layout IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'layout', jsonb_build_object(
                'id', NULL,
                'workspace_id', p_workspace_id,
                'positions', '[]'::jsonb,
                'connections', '[]'::jsonb,
                'view_settings', '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb,
                'created_at', NULL,
                'updated_at', NULL
            )
        );
    END IF;
    
    -- Get team data for positions validation
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'description', t.description,
            'created_at', t.created_at
        )
    ) INTO v_team_data
    FROM teams t
    WHERE t.owner_user_id = v_target_user_id;
    
    -- Return the layout with team data
    RETURN jsonb_build_object(
        'success', true,
        'layout', jsonb_build_object(
            'id', v_layout.id,
            'workspace_id', v_layout.workspace_id,
            'positions', v_layout.positions,
            'connections', v_layout.connections,
            'view_settings', v_layout.view_settings,
            'created_at', v_layout.created_at,
            'updated_at', v_layout.updated_at
        ),
        'teams', COALESCE(v_team_data, '[]'::jsonb)
    );
    
END;
$$;

-- Function 3: Create Team Connection  
-- Creates a connection between teams with validation
CREATE OR REPLACE FUNCTION public.create_team_connection(
    p_from_team_id UUID,
    p_to_team_id UUID,
    p_connection_type team_connection_type,
    p_label TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL,
    p_style TEXT DEFAULT 'solid'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_connection_id UUID;
    v_from_team_owner UUID;
    v_to_team_owner UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Validate connection type
    IF p_connection_type NOT IN ('reports_to', 'collaborates_with', 'supports', 'custom') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid connection type: ' || p_connection_type::text
        );
    END IF;
    
    -- Prevent self-connections
    IF p_from_team_id = p_to_team_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Teams cannot connect to themselves'
        );
    END IF;
    
    -- Verify both teams exist and user has access
    SELECT owner_user_id INTO v_from_team_owner
    FROM teams WHERE id = p_from_team_id;
    
    SELECT owner_user_id INTO v_to_team_owner  
    FROM teams WHERE id = p_to_team_id;
    
    IF v_from_team_owner IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Source team not found'
        );
    END IF;
    
    IF v_to_team_owner IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Target team not found'
        );
    END IF;
    
    -- Verify user owns both teams
    IF v_from_team_owner != v_user_id OR v_to_team_owner != v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient permissions to create team connection'
        );
    END IF;
    
    -- Check for duplicate connections
    IF EXISTS (
        SELECT 1 FROM team_connections
        WHERE from_team_id = p_from_team_id 
        AND to_team_id = p_to_team_id
        AND connection_type = p_connection_type
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Connection already exists between these teams'
        );
    END IF;
    
    -- For hierarchical connections, basic cycle detection
    IF p_connection_type = 'reports_to' THEN
        IF EXISTS (
            SELECT 1 FROM team_connections
            WHERE from_team_id = p_to_team_id 
            AND to_team_id = p_from_team_id
            AND connection_type = 'reports_to'
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This connection would create a circular reporting structure'
            );
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
    
    RETURN jsonb_build_object(
        'success', true,
        'connection_id', v_connection_id,
        'from_team_id', p_from_team_id,
        'to_team_id', p_to_team_id,
        'connection_type', p_connection_type,
        'created_at', NOW()
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
            'Failed to create team connection: ' || SQLERRM,
            jsonb_build_object(
                'function', 'create_team_connection',
                'user_id', v_user_id,
                'from_team_id', p_from_team_id,
                'to_team_id', p_to_team_id,
                'connection_type', p_connection_type
            )
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal error creating team connection',
            'error_code', SQLSTATE
        );
END;
$$;

-- Function 4: Delete Team Connection
-- Removes a team connection with proper validation
CREATE OR REPLACE FUNCTION public.delete_team_connection(
    p_connection_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_connection RECORD;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Get connection details and verify ownership
    SELECT 
        tc.id,
        tc.from_team_id,
        tc.to_team_id,
        tc.connection_type,
        tc.created_by_user_id,
        t1.owner_user_id as from_team_owner,
        t2.owner_user_id as to_team_owner
    INTO v_connection
    FROM team_connections tc
    JOIN teams t1 ON tc.from_team_id = t1.id
    JOIN teams t2 ON tc.to_team_id = t2.id
    WHERE tc.id = p_connection_id;
    
    IF v_connection IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Connection not found'
        );
    END IF;
    
    -- Verify user can delete this connection
    IF v_connection.created_by_user_id != v_user_id OR
       v_connection.from_team_owner != v_user_id OR 
       v_connection.to_team_owner != v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient permissions to delete this connection'
        );
    END IF;
    
    -- Delete the connection
    DELETE FROM team_connections
    WHERE id = p_connection_id;
    
    -- Log the deletion
    INSERT INTO usage_events (
        feature,
        user_id,
        metadata
    ) VALUES (
        'team_connection_deleted',
        v_user_id,
        jsonb_build_object(
            'connection_id', p_connection_id,
            'from_team_id', v_connection.from_team_id,
            'to_team_id', v_connection.to_team_id,
            'connection_type', v_connection.connection_type
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted_connection_id', p_connection_id,
        'deleted_at', NOW()
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
            'Failed to delete team connection: ' || SQLERRM,
            jsonb_build_object(
                'function', 'delete_team_connection',
                'user_id', v_user_id,
                'connection_id', p_connection_id
            )
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Internal error deleting team connection',
            'error_code', SQLSTATE
        );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.save_team_canvas_layout(UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_canvas_layout(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_connection(UUID, UUID, team_connection_type, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_team_connection(UUID) TO authenticated;

-- Add function documentation
COMMENT ON FUNCTION public.save_team_canvas_layout(UUID, JSONB, JSONB, JSONB) IS 'Save or update team canvas layout with comprehensive validation and audit logging';
COMMENT ON FUNCTION public.get_team_canvas_layout(UUID, UUID) IS 'Retrieve team canvas layout with proper access control and team data';
COMMENT ON FUNCTION public.create_team_connection(UUID, UUID, team_connection_type, TEXT, TEXT, TEXT) IS 'Create team connection with validation and cycle detection';
COMMENT ON FUNCTION public.delete_team_connection(UUID) IS 'Delete team connection with proper ownership verification';

COMMIT;
