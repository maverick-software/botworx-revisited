-- State Management Schema
-- Creates tables and functions for comprehensive state management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- State types enum
DO $$ BEGIN
    CREATE TYPE state_type_enum AS ENUM (
        'local',
        'shared', 
        'session',
        'persistent'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Checkpoint types enum
DO $$ BEGIN
    CREATE TYPE checkpoint_type_enum AS ENUM (
        'manual',
        'automatic',
        'milestone',
        'backup',
        'error_recovery'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Lock types enum
DO $$ BEGIN
    CREATE TYPE lock_type_enum AS ENUM (
        'read',
        'write',
        'exclusive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agent States Table (enhanced from existing design)
CREATE TABLE IF NOT EXISTS agent_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version TEXT NOT NULL DEFAULT '1.0.0',
    
    -- State partitions
    local_state JSONB NOT NULL DEFAULT '{}',
    shared_state JSONB NOT NULL DEFAULT '{}',
    session_state JSONB NOT NULL DEFAULT '{}',
    persistent_state JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    state_hash TEXT NOT NULL,
    modification_count INTEGER NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,
    is_current BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_modified TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CHECK (modification_count >= 0),
    CHECK (valid_from <= COALESCE(valid_until, now() + interval '100 years'))
);

-- State Checkpoints Table
CREATE TABLE IF NOT EXISTS state_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    state_id UUID NOT NULL REFERENCES agent_states(id) ON DELETE CASCADE,
    checkpoint_type checkpoint_type_enum NOT NULL,
    
    -- Checkpoint data
    description TEXT,
    compressed_data TEXT NOT NULL, -- Base64 encoded compressed state
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Retention
    retention_policy TEXT NOT NULL DEFAULT 'permanent',
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- State Transitions Table (audit trail)
CREATE TABLE IF NOT EXISTS state_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    from_state_id UUID REFERENCES agent_states(id),
    to_state_id UUID NOT NULL REFERENCES agent_states(id),
    
    -- Transition details
    transition_type TEXT NOT NULL DEFAULT 'update',
    trigger TEXT,
    changes JSONB NOT NULL DEFAULT '[]',
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- State Locks Table (concurrency control)
CREATE TABLE IF NOT EXISTS state_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    state_key TEXT NOT NULL,
    lock_type lock_type_enum NOT NULL,
    
    -- Lock details
    locked_by UUID NOT NULL REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    UNIQUE(agent_id, state_key),
    CHECK (expires_at > locked_at)
);

-- State Synchronization Events Table
CREATE TABLE IF NOT EXISTS state_sync_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Sync details
    sync_type TEXT NOT NULL DEFAULT 'manual',
    state_keys TEXT[] NOT NULL DEFAULT '{}',
    conflicts_detected INTEGER NOT NULL DEFAULT 0,
    conflicts_resolved INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Conversation Sessions Table (enhanced for session state)
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    workspace_id UUID,
    
    -- Session state
    session_state JSONB NOT NULL DEFAULT '{}',
    session_metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    
    -- Constraints
    CHECK (status IN ('active', 'ended', 'expired'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_states_agent_current 
ON agent_states(agent_id) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_agent_states_modified 
ON agent_states(agent_id, last_modified DESC);

CREATE INDEX IF NOT EXISTS idx_agent_states_hash 
ON agent_states(state_hash);

CREATE INDEX IF NOT EXISTS idx_state_checkpoints_agent 
ON state_checkpoints(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_state_checkpoints_expires 
ON state_checkpoints(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_state_transitions_agent 
ON state_transitions(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_state_locks_expires 
ON state_locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_state_sync_events_agents 
ON state_sync_events(source_agent_id, target_agent_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_agent 
ON conversation_sessions(agent_id, status, started_at DESC);

-- Note: conversation_sessions doesn't have expires_at column in current schema

-- Row Level Security (RLS)
ALTER TABLE agent_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_states
CREATE POLICY "Users can view states for their agents" ON agent_states
FOR SELECT USING (
    agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can modify states for their agents" ON agent_states
FOR ALL USING (
    agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

-- RLS Policies for state_checkpoints
CREATE POLICY "Users can view checkpoints for their agents" ON state_checkpoints
FOR SELECT USING (
    agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

CREATE POLICY "Users can create checkpoints for their agents" ON state_checkpoints
FOR INSERT WITH CHECK (
    agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

-- RLS Policies for state_transitions (read-only audit log)
CREATE POLICY "Users can view transitions for their agents" ON state_transitions
FOR SELECT USING (
    agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

-- RLS Policies for state_locks
CREATE POLICY "Users can manage locks for their agents" ON state_locks
FOR ALL USING (
    agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

-- RLS Policies for state_sync_events
CREATE POLICY "Users can view sync events for their agents" ON state_sync_events
FOR SELECT USING (
    source_agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
    OR target_agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

-- RLS Policies for conversation_sessions
CREATE POLICY "Users can manage their sessions" ON conversation_sessions
FOR ALL USING (
    user_id = auth.uid()
    OR agent_id IN (
        SELECT id FROM agents WHERE user_id = auth.uid()

    )
);

-- Functions for state management
CREATE OR REPLACE FUNCTION get_current_state(agent_uuid UUID)
RETURNS TABLE(
    id UUID,
    agent_id UUID,
    version TEXT,
    local_state JSONB,
    shared_state JSONB,
    session_state JSONB,
    persistent_state JSONB,
    state_hash TEXT,
    modification_count INTEGER,
    created_at TIMESTAMPTZ,
    last_modified TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.agent_id,
        s.version,
        s.local_state,
        s.shared_state,
        s.session_state,
        s.persistent_state,
        s.state_hash,
        s.modification_count,
        s.created_at,
        s.last_modified
    FROM agent_states s
    WHERE s.agent_id = agent_uuid AND s.is_current = true;
END;
$$;

CREATE OR REPLACE FUNCTION create_state_checkpoint(
    agent_uuid UUID,
    checkpoint_name TEXT DEFAULT NULL,
    checkpoint_type_param checkpoint_type_enum DEFAULT 'manual',
    description_param TEXT DEFAULT NULL,
    retention_policy_param TEXT DEFAULT 'permanent',
    expires_in_hours INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_state_record RECORD;
    checkpoint_id UUID;
    compressed_data TEXT;
    expires_at_param TIMESTAMPTZ;
BEGIN
    -- Get current state
    SELECT * INTO current_state_record
    FROM agent_states
    WHERE agent_id = agent_uuid AND is_current = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No current state found for agent %', agent_uuid;
    END IF;
    
    -- Compress state data (simplified - in production use actual compression)
    compressed_data := encode(
        convert_to(
            jsonb_build_object(
                'id', current_state_record.id,
                'agent_id', current_state_record.agent_id,
                'version', current_state_record.version,
                'local_state', current_state_record.local_state,
                'shared_state', current_state_record.shared_state,
                'session_state', current_state_record.session_state,
                'persistent_state', current_state_record.persistent_state,
                'modification_count', current_state_record.modification_count,
                'created_at', current_state_record.created_at,
                'last_modified', current_state_record.last_modified
            )::text,
            'utf8'
        ),
        'base64'
    );
    
    -- Calculate expiration
    IF expires_in_hours IS NOT NULL THEN
        expires_at_param := now() + (expires_in_hours || ' hours')::interval;
    END IF;
    
    -- Create checkpoint
    INSERT INTO state_checkpoints (
        agent_id,
        state_id,
        checkpoint_type,
        description,
        compressed_data,
        metadata,
        retention_policy,
        expires_at
    ) VALUES (
        agent_uuid,
        current_state_record.id,
        checkpoint_type_param,
        COALESCE(description_param, checkpoint_name),
        compressed_data,
        jsonb_build_object(
            'original_size_bytes', length(compressed_data),
            'compression_type', 'base64',
            'state_hash', current_state_record.state_hash
        ),
        retention_policy_param,
        expires_at_param
    ) RETURNING id INTO checkpoint_id;
    
    RETURN checkpoint_id;
END;
$$;

CREATE OR REPLACE FUNCTION restore_state_checkpoint(
    checkpoint_uuid UUID,
    merge_with_current BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    checkpoint_record RECORD;
    restored_state JSONB;
    current_state_record RECORD;
    new_state_id UUID;
BEGIN
    -- Get checkpoint
    SELECT * INTO checkpoint_record
    FROM state_checkpoints
    WHERE id = checkpoint_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Checkpoint % not found', checkpoint_uuid;
    END IF;
    
    -- Decompress state data
    restored_state := convert_from(decode(checkpoint_record.compressed_data, 'base64'), 'utf8')::jsonb;
    
    -- Get current state if merging
    IF merge_with_current THEN
        SELECT * INTO current_state_record
        FROM agent_states
        WHERE agent_id = checkpoint_record.agent_id AND is_current = true;
    END IF;
    
    -- Mark current state as non-current
    UPDATE agent_states
    SET is_current = false, valid_until = now()
    WHERE agent_id = checkpoint_record.agent_id AND is_current = true;
    
    -- Create new state from checkpoint
    new_state_id := uuid_generate_v4();
    
    INSERT INTO agent_states (
        id,
        agent_id,
        version,
        local_state,
        shared_state,
        session_state,
        persistent_state,
        state_hash,
        modification_count,
        valid_from,
        is_current,
        created_at,
        last_modified
    ) VALUES (
        new_state_id,
        checkpoint_record.agent_id,
        (restored_state->>'version')::text,
        CASE 
            WHEN merge_with_current AND current_state_record.id IS NOT NULL THEN
                current_state_record.local_state || (restored_state->>'local_state')::jsonb
            ELSE
                (restored_state->>'local_state')::jsonb
        END,
        CASE 
            WHEN merge_with_current AND current_state_record.id IS NOT NULL THEN
                current_state_record.shared_state || (restored_state->>'shared_state')::jsonb
            ELSE
                (restored_state->>'shared_state')::jsonb
        END,
        CASE 
            WHEN merge_with_current AND current_state_record.id IS NOT NULL THEN
                current_state_record.session_state || (restored_state->>'session_state')::jsonb
            ELSE
                (restored_state->>'session_state')::jsonb
        END,
        CASE 
            WHEN merge_with_current AND current_state_record.id IS NOT NULL THEN
                current_state_record.persistent_state || (restored_state->>'persistent_state')::jsonb
            ELSE
                (restored_state->>'persistent_state')::jsonb
        END,
        '', -- Will be recalculated
        COALESCE(current_state_record.modification_count, 0) + 1,
        now(),
        true,
        now(),
        now()
    );
    
    -- Record transition
    INSERT INTO state_transitions (
        agent_id,
        from_state_id,
        to_state_id,
        transition_type,
        trigger,
        changes,
        created_at
    ) VALUES (
        checkpoint_record.agent_id,
        current_state_record.id,
        new_state_id,
        'restore',
        'checkpoint_restore',
        jsonb_build_array(
            jsonb_build_object(
                'type', 'restore',
                'checkpoint_id', checkpoint_uuid,
                'merge_applied', merge_with_current
            )
        ),
        now()
    );
    
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_states()
RETURNS TABLE(
    cleanup_type TEXT,
    items_cleaned INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_checkpoints INTEGER;
    expired_sessions INTEGER;
    expired_locks INTEGER;
BEGIN
    -- Clean expired checkpoints
    DELETE FROM state_checkpoints
    WHERE expires_at IS NOT NULL AND expires_at < now();
    
    GET DIAGNOSTICS expired_checkpoints = ROW_COUNT;
    
    -- Clean expired sessions
    UPDATE conversation_sessions
    SET status = 'expired', ended_at = now()
    WHERE expires_at IS NOT NULL AND expires_at < now() AND status = 'active';
    
    GET DIAGNOSTICS expired_sessions = ROW_COUNT;
    
    -- Clean expired locks
    DELETE FROM state_locks
    WHERE expires_at < now();
    
    GET DIAGNOSTICS expired_locks = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('checkpoints', expired_checkpoints),
        ('sessions', expired_sessions),
        ('locks', expired_locks);
END;
$$;

CREATE OR REPLACE FUNCTION get_state_statistics(agent_uuid UUID DEFAULT NULL)
RETURNS TABLE(
    agent_id UUID,
    current_states INTEGER,
    total_checkpoints INTEGER,
    recent_transitions INTEGER,
    active_locks INTEGER,
    state_size_bytes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF agent_uuid IS NOT NULL THEN
        -- Statistics for specific agent
        RETURN QUERY
        WITH agent_stats AS (
            SELECT 
                s.agent_id,
                COUNT(s.*) FILTER (WHERE s.is_current) as current_count,
                COUNT(c.*) as checkpoint_count,
                COUNT(t.*) FILTER (WHERE t.created_at > now() - interval '24 hours') as recent_transition_count,
                COUNT(l.*) as lock_count,
                COALESCE(SUM(length(s.local_state::text) + length(s.shared_state::text) + 
                           length(s.session_state::text) + length(s.persistent_state::text)), 0) as size_bytes
            FROM agent_states s
            LEFT JOIN state_checkpoints c ON s.agent_id = c.agent_id
            LEFT JOIN state_transitions t ON s.agent_id = t.agent_id
            LEFT JOIN state_locks l ON s.agent_id = l.agent_id
            WHERE s.agent_id = agent_uuid
            GROUP BY s.agent_id
        )
        SELECT 
            agent_uuid,
            current_count::INTEGER,
            checkpoint_count::INTEGER,
            recent_transition_count::INTEGER,
            lock_count::INTEGER,
            size_bytes::BIGINT
        FROM agent_stats;
    ELSE
        -- Statistics for all agents
        RETURN QUERY
        SELECT 
            s.agent_id,
            COUNT(s.*) FILTER (WHERE s.is_current)::INTEGER as current_count,
            COUNT(c.*)::INTEGER as checkpoint_count,
            COUNT(t.*) FILTER (WHERE t.created_at > now() - interval '24 hours')::INTEGER as recent_transition_count,
            COUNT(l.*)::INTEGER as lock_count,
            COALESCE(SUM(length(s.local_state::text) + length(s.shared_state::text) + 
                       length(s.session_state::text) + length(s.persistent_state::text)), 0)::BIGINT as size_bytes
        FROM agent_states s
        LEFT JOIN state_checkpoints c ON s.agent_id = c.agent_id
        LEFT JOIN state_transitions t ON s.agent_id = t.agent_id
        LEFT JOIN state_locks l ON s.agent_id = l.agent_id
        GROUP BY s.agent_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_current_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_state_checkpoint(UUID, TEXT, checkpoint_type_enum, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_state_checkpoint(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_state_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_states() TO service_role;

-- Create indexes for JSONB state queries
CREATE INDEX IF NOT EXISTS idx_agent_states_local_state_gin 
ON agent_states USING gin (local_state);

CREATE INDEX IF NOT EXISTS idx_agent_states_shared_state_gin 
ON agent_states USING gin (shared_state);

CREATE INDEX IF NOT EXISTS idx_agent_states_session_state_gin 
ON agent_states USING gin (session_state);

CREATE INDEX IF NOT EXISTS idx_agent_states_persistent_state_gin 
ON agent_states USING gin (persistent_state);