-- =====================================================
-- Canvas Agent System
-- Extends canvas_sessions for line-by-line editing
-- Adds diff tracking, undo/redo, and version snapshots
-- =====================================================

-- Extend canvas_sessions table with diff tracking
ALTER TABLE canvas_sessions 
ADD COLUMN IF NOT EXISTS diff_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS undo_stack JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS redo_stack JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_snapshot_id UUID;

CREATE INDEX IF NOT EXISTS idx_canvas_sessions_snapshot ON canvas_sessions(current_snapshot_id);

-- Canvas Snapshots Table
CREATE TABLE IF NOT EXISTS canvas_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_session_id UUID NOT NULL REFERENCES canvas_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    label TEXT,
    description TEXT,
    line_count INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes for canvas_snapshots
CREATE INDEX IF NOT EXISTS idx_canvas_snapshots_session ON canvas_snapshots(canvas_session_id);
CREATE INDEX IF NOT EXISTS idx_canvas_snapshots_created ON canvas_snapshots(created_at DESC);

-- Canvas Diffs Table (tracks all editing operations)
CREATE TABLE IF NOT EXISTS canvas_diffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_session_id UUID NOT NULL REFERENCES canvas_sessions(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL CHECK (
        operation_type IN ('replace', 'insert', 'delete', 'search_replace')
    ),
    start_line INTEGER NOT NULL,
    end_line INTEGER,
    before_content TEXT,
    after_content TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes for canvas_diffs
CREATE INDEX IF NOT EXISTS idx_canvas_diffs_session ON canvas_diffs(canvas_session_id);
CREATE INDEX IF NOT EXISTS idx_canvas_diffs_created ON canvas_diffs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvas_diffs_operation ON canvas_diffs(operation_type);

-- RLS Policies for canvas_snapshots
ALTER TABLE canvas_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own canvas snapshots"
    ON canvas_snapshots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM canvas_sessions cs
            WHERE cs.id = canvas_snapshots.canvas_session_id
            AND cs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own canvas snapshots"
    ON canvas_snapshots FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM canvas_sessions cs
            WHERE cs.id = canvas_snapshots.canvas_session_id
            AND cs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own canvas snapshots"
    ON canvas_snapshots FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM canvas_sessions cs
            WHERE cs.id = canvas_snapshots.canvas_session_id
            AND cs.user_id = auth.uid()
        )
    );

-- RLS Policies for canvas_diffs
ALTER TABLE canvas_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own canvas diffs"
    ON canvas_diffs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM canvas_sessions cs
            WHERE cs.id = canvas_diffs.canvas_session_id
            AND cs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own canvas diffs"
    ON canvas_diffs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM canvas_sessions cs
            WHERE cs.id = canvas_diffs.canvas_session_id
            AND cs.user_id = auth.uid()
        )
    );

-- Helper function: Get line count from content
CREATE OR REPLACE FUNCTION get_line_count(content TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN array_length(string_to_array(content, E'\n'), 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Get lines from content
CREATE OR REPLACE FUNCTION get_lines(
    content TEXT,
    start_line INTEGER DEFAULT 1,
    end_line INTEGER DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    lines TEXT[];
    result TEXT;
BEGIN
    lines := string_to_array(content, E'\n');
    
    IF end_line IS NULL THEN
        end_line := array_length(lines, 1);
    END IF;
    
    -- Validate bounds
    IF start_line < 1 OR start_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'start_line out of bounds: %', start_line;
    END IF;
    
    IF end_line < start_line OR end_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'end_line out of bounds: %', end_line;
    END IF;
    
    result := array_to_string(lines[start_line:end_line], E'\n');
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Replace lines in content
CREATE OR REPLACE FUNCTION replace_lines(
    content TEXT,
    start_line INTEGER,
    end_line INTEGER,
    new_content TEXT
)
RETURNS TEXT AS $$
DECLARE
    lines TEXT[];
    new_lines TEXT[];
    result TEXT[];
BEGIN
    lines := string_to_array(content, E'\n');
    new_lines := string_to_array(new_content, E'\n');
    
    -- Validate bounds
    IF start_line < 1 OR start_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'start_line out of bounds: %', start_line;
    END IF;
    
    IF end_line < start_line OR end_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'end_line out of bounds: %', end_line;
    END IF;
    
    -- Build result: before + new + after
    result := lines[1:start_line-1] || new_lines || lines[end_line+1:array_length(lines, 1)];
    
    RETURN array_to_string(result, E'\n');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Insert lines in content
CREATE OR REPLACE FUNCTION insert_lines(
    content TEXT,
    after_line INTEGER,
    new_content TEXT
)
RETURNS TEXT AS $$
DECLARE
    lines TEXT[];
    new_lines TEXT[];
    result TEXT[];
BEGIN
    lines := string_to_array(content, E'\n');
    new_lines := string_to_array(new_content, E'\n');
    
    -- Validate bounds (allow 0 for inserting at start)
    IF after_line < 0 OR after_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'after_line out of bounds: %', after_line;
    END IF;
    
    -- Build result: before + new + after
    IF after_line = 0 THEN
        result := new_lines || lines;
    ELSE
        result := lines[1:after_line] || new_lines || lines[after_line+1:array_length(lines, 1)];
    END IF;
    
    RETURN array_to_string(result, E'\n');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: Delete lines from content
CREATE OR REPLACE FUNCTION delete_lines(
    content TEXT,
    start_line INTEGER,
    end_line INTEGER
)
RETURNS TEXT AS $$
DECLARE
    lines TEXT[];
    result TEXT[];
BEGIN
    lines := string_to_array(content, E'\n');
    
    -- Validate bounds
    IF start_line < 1 OR start_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'start_line out of bounds: %', start_line;
    END IF;
    
    IF end_line < start_line OR end_line > array_length(lines, 1) THEN
        RAISE EXCEPTION 'end_line out of bounds: %', end_line;
    END IF;
    
    -- Build result: before + after (skip deleted lines)
    result := lines[1:start_line-1] || lines[end_line+1:array_length(lines, 1)];
    
    RETURN array_to_string(result, E'\n');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comment
COMMENT ON TABLE canvas_snapshots IS 'Version snapshots of canvas sessions for rollback capability';
COMMENT ON TABLE canvas_diffs IS 'Detailed tracking of all canvas editing operations for undo/redo';
COMMENT ON FUNCTION get_line_count IS 'Counts the number of lines in text content';
COMMENT ON FUNCTION get_lines IS 'Extracts a range of lines from content';
COMMENT ON FUNCTION replace_lines IS 'Replaces a range of lines with new content';
COMMENT ON FUNCTION insert_lines IS 'Inserts new lines after a specific line';
COMMENT ON FUNCTION delete_lines IS 'Deletes a range of lines from content';

