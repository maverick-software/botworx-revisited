-- Add Agent Positions to Team Canvas
-- Date: October 27, 2025
-- Purpose: Extend team canvas to support agent nodes alongside team nodes

BEGIN;

-- Add agent_positions column to team_canvas_layouts table
ALTER TABLE IF EXISTS public.team_canvas_layouts
ADD COLUMN IF NOT EXISTS agent_positions JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN public.team_canvas_layouts.agent_positions IS 
'JSONB array of agent position data: [{"agentId": "uuid", "x": number, "y": number, "width": number, "height": number, "createdAt": "iso8601", "updatedAt": "iso8601"}]';

-- Update the save_team_canvas_layout function to support agent positions
CREATE OR REPLACE FUNCTION public.save_team_canvas_layout(
    p_workspace_id UUID DEFAULT NULL,
    p_positions JSONB DEFAULT '[]'::jsonb,
    p_agent_positions JSONB DEFAULT '[]'::jsonb,  -- NEW PARAMETER
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
    v_agent_id UUID;
    v_position_item JSONB;
    v_agent_position_item JSONB;
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
    
    -- Validate positions JSON structure (teams)
    IF NOT jsonb_typeof(p_positions) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Positions must be a JSON array');
    ELSE
        -- Validate each team position
        FOR v_position_item IN SELECT * FROM jsonb_array_elements(p_positions)
        LOOP
            IF NOT (v_position_item ? 'teamId' AND v_position_item ? 'x' AND v_position_item ? 'y') THEN
                v_validation_errors := array_append(v_validation_errors, 'Position items must have teamId, x, and y fields');
                CONTINUE;
            END IF;
            
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
    
    -- Validate agent positions JSON structure (NEW)
    IF NOT jsonb_typeof(p_agent_positions) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Agent positions must be a JSON array');
    ELSE
        -- Validate each agent position
        FOR v_agent_position_item IN SELECT * FROM jsonb_array_elements(p_agent_positions)
        LOOP
            IF NOT (v_agent_position_item ? 'agentId' AND v_agent_position_item ? 'x' AND v_agent_position_item ? 'y') THEN
                v_validation_errors := array_append(v_validation_errors, 'Agent position items must have agentId, x, and y fields');
                CONTINUE;
            END IF;
            
            BEGIN
                v_agent_id := (v_agent_position_item->>'agentId')::UUID;
                
                IF NOT EXISTS (
                    SELECT 1 FROM agents 
                    WHERE id = v_agent_id 
                    AND owner_user_id = v_user_id
                ) THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        format('Agent %s not found or access denied', v_agent_id));
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    v_validation_errors := array_append(v_validation_errors, 
                        'Invalid agent ID format: ' || (v_agent_position_item->>'agentId'));
            END;
        END LOOP;
    END IF;
    
    -- Validate connections JSON structure (supports team-to-team, team-to-agent, agent-to-agent)
    IF NOT jsonb_typeof(p_connections) = 'array' THEN
        v_validation_errors := array_append(v_validation_errors, 'Connections must be a JSON array');
    ELSE
        FOR v_connection_item IN SELECT * FROM jsonb_array_elements(p_connections)
        LOOP
            -- Connection must have type and at least one pair of from/to IDs
            IF NOT (v_connection_item ? 'type') THEN
                v_validation_errors := array_append(v_validation_errors, 'Connection items must have type field');
            END IF;
            
            -- Must have either teamId pairs or agentId pairs or mixed
            IF NOT (
                (v_connection_item ? 'fromTeamId' OR v_connection_item ? 'fromAgentId') AND
                (v_connection_item ? 'toTeamId' OR v_connection_item ? 'toAgentId')
            ) THEN
                v_validation_errors := array_append(v_validation_errors, 
                    'Connection items must have source and target IDs (team or agent)');
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
        AND ((workspace_id IS NULL AND p_workspace_id IS NULL) OR workspace_id = p_workspace_id);
    
    -- Insert or update layout
    IF v_existing_layout_id IS NULL THEN
        -- Create new layout
        INSERT INTO team_canvas_layouts (
            user_id,
            workspace_id,
            positions,
            agent_positions,  -- NEW COLUMN
            connections,
            view_settings
        ) VALUES (
            v_user_id,
            p_workspace_id,
            p_positions,
            p_agent_positions,  -- NEW VALUE
            p_connections,
            p_view_settings
        )
        RETURNING id INTO v_layout_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'layout_id', v_layout_id,
            'position_count', jsonb_array_length(p_positions),
            'agent_position_count', jsonb_array_length(p_agent_positions),  -- NEW
            'connection_count', jsonb_array_length(p_connections),
            'saved_at', now()
        );
    ELSE
        -- Update existing layout
        UPDATE team_canvas_layouts
        SET 
            positions = p_positions,
            agent_positions = p_agent_positions,  -- NEW COLUMN
            connections = p_connections,
            view_settings = p_view_settings,
            updated_at = now()
        WHERE id = v_existing_layout_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'layout_id', v_existing_layout_id,
            'position_count', jsonb_array_length(p_positions),
            'agent_position_count', jsonb_array_length(p_agent_positions),  -- NEW
            'connection_count', jsonb_array_length(p_connections),
            'saved_at', now()
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to save canvas layout: ' || SQLERRM
        );
END;
$$;

-- Update the get_team_canvas_layout function to return agent positions
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
    v_user_id UUID;
    v_layout RECORD;
    v_teams JSONB;
    v_agents JSONB;  -- NEW
BEGIN
    -- Use provided user ID or get current user
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to retrieve canvas layout'
        );
    END IF;
    
    -- Get layout
    SELECT * INTO v_layout
    FROM team_canvas_layouts
    WHERE user_id = v_user_id
        AND ((workspace_id IS NULL AND p_workspace_id IS NULL) OR workspace_id = p_workspace_id)
    ORDER BY updated_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'layout', NULL
        );
    END IF;
    
    -- Get teams for this user
    SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'description', t.description,
        'created_at', t.created_at,
        'updated_at', t.updated_at
    )) INTO v_teams
    FROM teams t
    WHERE t.owner_user_id = v_user_id;
    
    -- Get agents for this user (NEW)
    SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'model', a.model,
        'created_at', a.created_at,
        'updated_at', a.updated_at
    )) INTO v_agents
    FROM agents a
    WHERE a.owner_user_id = v_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'layout', jsonb_build_object(
            'id', v_layout.id,
            'positions', COALESCE(v_layout.positions, '[]'::jsonb),
            'agentPositions', COALESCE(v_layout.agent_positions, '[]'::jsonb),  -- NEW
            'connections', COALESCE(v_layout.connections, '[]'::jsonb),
            'viewSettings', COALESCE(v_layout.view_settings, '{"zoom": 1, "centerX": 0, "centerY": 0}'::jsonb),
            'created_at', v_layout.created_at,
            'updated_at', v_layout.updated_at
        ),
        'teams', COALESCE(v_teams, '[]'::jsonb),
        'agents', COALESCE(v_agents, '[]'::jsonb)  -- NEW
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to retrieve canvas layout: ' || SQLERRM
        );
END;
$$;

COMMIT;







