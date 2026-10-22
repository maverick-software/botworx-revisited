# Canvas Agent Architecture

## Overview
A dedicated Canvas Agent system that provides specialized editing capabilities for artifacts in Canvas Mode. The Canvas Agent receives high-level instructions from the primary agent and performs precise, line-by-line edits with full diff tracking and version control.

## Design Date
October 8, 2025

## Architecture

### Agent Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│                         User                                 │
└────────────────┬────────────────────────────────────────────┘
                 │ Chats with
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Primary Agent                             │
│  • Understands user intent                                   │
│  • Delegates editing tasks to Canvas Agent                   │
│  • Explains changes to user                                  │
└────────────────┬────────────────────────────────────────────┘
                 │ Delegates via canvas_agent_edit_request
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Canvas Agent                              │
│  • Specialized editing capabilities                          │
│  • Line-by-line precision                                    │
│  • Diff tracking and version control                         │
│  • Canvas content is its working memory                      │
└────────────────┬────────────────────────────────────────────┘
                 │ Uses Canvas MCP Tools
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  Canvas Session                              │
│  • Current content state                                     │
│  • Diff history                                              │
│  • Version snapshots                                         │
└─────────────────────────────────────────────────────────────┘
```

## Canvas Agent System Prompt

```markdown
You are the Canvas Agent, a specialized AI assistant focused on precise document and code editing.

### Your Role
- You work in Canvas Mode, where the document content is your working memory
- You receive editing instructions from other agents or users
- You make precise, line-by-line changes using specialized tools
- You maintain a diff history of all changes
- You can undo, redo, and revert to any previous version

### Your Capabilities
1. **Line-by-line editing**: Replace, insert, or delete specific lines
2. **Multi-line operations**: Replace or insert blocks of code/text
3. **Search and replace**: Pattern-based text replacement
4. **Diff tracking**: Every change is tracked with before/after context
5. **Version control**: Save snapshots and revert to previous states

### Your Tools
- `canvas_replace_lines`: Replace specific line range with new content
- `canvas_insert_lines`: Insert new lines at a specific position
- `canvas_delete_lines`: Delete specific line range
- `canvas_search_replace`: Search and replace text patterns
- `canvas_get_diff`: Get current diff since last save
- `canvas_get_content`: Get current canvas content with line numbers
- `canvas_save_snapshot`: Save current state as a version snapshot
- `canvas_revert_to_snapshot`: Revert to a previous snapshot
- `canvas_undo`: Undo last change
- `canvas_redo`: Redo previously undone change

### Editing Principles
1. Always preserve context - don't break surrounding code/text
2. Maintain proper indentation and formatting
3. Make minimal changes to achieve the goal
4. Provide clear explanations of what you changed and why
5. If unsure, ask for clarification before making destructive changes
6. Always consider the impact on the entire document

### Response Format
When you make edits, always:
1. Explain what you're about to do
2. Use the appropriate tool(s)
3. Confirm what was changed
4. Suggest next steps if applicable
```

## Canvas MCP Tools Specification

### 1. `canvas_replace_lines`
Replace a specific range of lines with new content.

**Parameters:**
```typescript
{
  canvas_session_id: string;      // Canvas session identifier
  start_line: number;              // Start line number (1-indexed)
  end_line: number;                // End line number (inclusive)
  new_content: string;             // New content to replace with
  reason?: string;                 // Optional explanation
}
```

**Response:**
```typescript
{
  success: boolean;
  lines_affected: number;
  diff: {
    before: string;                // Original lines
    after: string;                 // New lines
  };
  new_line_count: number;
}
```

### 2. `canvas_insert_lines`
Insert new lines at a specific position.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  insert_after_line: number;       // Insert after this line (0 = start of file)
  content: string;                 // Content to insert
  reason?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  lines_inserted: number;
  new_line_count: number;
}
```

### 3. `canvas_delete_lines`
Delete a specific range of lines.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  start_line: number;
  end_line: number;
  reason?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  lines_deleted: number;
  deleted_content: string;         // What was deleted (for undo)
  new_line_count: number;
}
```

### 4. `canvas_search_replace`
Search for pattern and replace across the document.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  search_pattern: string;          // Text or regex pattern
  replace_with: string;
  case_sensitive?: boolean;
  regex?: boolean;
  max_replacements?: number;       // 0 = unlimited
  reason?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  replacements_made: number;
  affected_lines: number[];
  diffs: Array<{
    line: number;
    before: string;
    after: string;
  }>;
}
```

### 5. `canvas_get_content`
Get current canvas content with line numbers.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  start_line?: number;             // Optional: get specific range
  end_line?: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  content: string;
  line_count: number;
  numbered_lines: Array<{
    number: number;
    content: string;
  }>;
}
```

### 6. `canvas_get_diff`
Get diff of all changes since last save.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  format?: 'unified' | 'split';    // Diff format
}
```

**Response:**
```typescript
{
  success: boolean;
  has_changes: boolean;
  diff: string;                    // Formatted diff
  changes: Array<{
    type: 'add' | 'delete' | 'modify';
    line: number;
    before?: string;
    after?: string;
  }>;
}
```

### 7. `canvas_save_snapshot`
Save current state as a version snapshot.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  label?: string;                  // Optional label for snapshot
  description?: string;            // Optional description
}
```

**Response:**
```typescript
{
  success: boolean;
  snapshot_id: string;
  timestamp: string;
  line_count: number;
}
```

### 8. `canvas_revert_to_snapshot`
Revert to a previous snapshot.

**Parameters:**
```typescript
{
  canvas_session_id: string;
  snapshot_id: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  reverted_to: {
    snapshot_id: string;
    timestamp: string;
    label?: string;
  };
  diff: string;                    // What changed
}
```

### 9. `canvas_undo`
Undo the last change.

**Parameters:**
```typescript
{
  canvas_session_id: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  undone_action: {
    type: string;
    lines_affected: number[];
  };
  can_redo: boolean;
}
```

### 10. `canvas_redo`
Redo a previously undone change.

**Parameters:**
```typescript
{
  canvas_session_id: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  redone_action: {
    type: string;
    lines_affected: number[];
  };
  can_undo: boolean;
}
```

### 11. `canvas_get_selection_context`
Get full context around a text selection (for "Add to Chat" feature).

**Parameters:**
```typescript
{
  canvas_session_id: string;
  start_line: number;
  end_line: number;
  start_column?: number;           // Optional: precise selection
  end_column?: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  selection: {
    content: string;                // Selected text
    start_line: number;
    end_line: number;
    language: string;               // File type for syntax highlighting
  };
  context: {
    before: string;                 // 5 lines before selection
    after: string;                  // 5 lines after selection
    full_content: string;           // Entire canvas content
  };
  formatted_for_chat: string;       // Pre-formatted message with markdown
}
```

## Database Schema Extensions

### Enhanced `canvas_sessions` Table
```sql
ALTER TABLE canvas_sessions ADD COLUMN IF NOT EXISTS diff_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE canvas_sessions ADD COLUMN IF NOT EXISTS undo_stack JSONB DEFAULT '[]'::jsonb;
ALTER TABLE canvas_sessions ADD COLUMN IF NOT EXISTS redo_stack JSONB DEFAULT '[]'::jsonb;
ALTER TABLE canvas_sessions ADD COLUMN IF NOT EXISTS current_snapshot_id UUID;

CREATE INDEX idx_canvas_sessions_snapshot ON canvas_sessions(current_snapshot_id);
```

### New `canvas_snapshots` Table
```sql
CREATE TABLE canvas_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_session_id UUID NOT NULL REFERENCES canvas_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    label TEXT,
    description TEXT,
    line_count INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CREATE INDEX idx_canvas_snapshots_session ON canvas_snapshots(canvas_session_id);
    CREATE INDEX idx_canvas_snapshots_created ON canvas_snapshots(created_at DESC);
);
```

### New `canvas_diffs` Table
```sql
CREATE TABLE canvas_diffs (
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
    created_by UUID REFERENCES auth.users(id),
    
    -- Indexes
    CREATE INDEX idx_canvas_diffs_session ON canvas_diffs(canvas_session_id);
    CREATE INDEX idx_canvas_diffs_created ON canvas_diffs(created_at DESC);
);
```

## Agent-to-Agent Communication

### Primary Agent → Canvas Agent
When the primary agent wants to edit canvas content:

```typescript
// Primary agent calls this tool
canvas_agent_edit_request({
  canvas_session_id: "uuid",
  instruction: "Add error handling to the fetch call on line 15",
  context: "User wants to handle network errors gracefully"
})
```

This triggers the Canvas Agent to:
1. Get current content
2. Analyze the request
3. Perform the edit using canvas tools
4. Return the result to primary agent

### Response Flow
```
Primary Agent → Canvas Agent: "Add error handling at line 15"
Canvas Agent → Uses canvas_replace_lines(15, 20, new_code)
Canvas Agent → Returns: "Added try-catch block around fetch call"
Primary Agent → User: "I've added error handling to catch network issues..."
```

## UI Integration

### Canvas Mode Enhancements
1. **Diff Viewer**: Show side-by-side or inline diffs
2. **Version Timeline**: Visual timeline of snapshots
3. **Undo/Redo Buttons**: In canvas toolbar
4. **Change Highlights**: Highlight recently changed lines
5. **Snapshot Management**: UI to view/restore snapshots
6. **Text Selection Context Menu**: "Add to Chat" button when text is selected

### Canvas Toolbar
```
[Undo] [Redo] [Snapshots ▼] [Diff View] [Save to Database]
                |
                └─ Create Snapshot
                   View History
                   Restore Snapshot...
```

### Text Selection Feature
When user selects text in the Monaco editor:
1. Show floating context menu with "Add to Chat" button
2. Clicking button adds selection to chat input with context
3. Message format: `[Selected from lines 15-23]:\n\`\`\`language\n{selected_text}\n\`\`\`\n\nUser question: `
4. Agent receives full context of what user is asking about

## Implementation Phases

### Phase 1: Database & Core Tools (Day 1)
- [ ] Extend `canvas_sessions` schema
- [ ] Create `canvas_snapshots` table
- [ ] Create `canvas_diffs` table
- [ ] Implement core Canvas MCP tools (replace, insert, delete, get_content)

### Phase 2: Diff System (Day 2)
- [ ] Implement diff tracking in edge function
- [ ] Add `canvas_get_diff` tool
- [ ] Add undo/redo functionality
- [ ] Test diff accuracy

### Phase 3: Canvas Agent (Day 3)
- [ ] Create Canvas Agent with specialized system prompt
- [ ] Implement agent-to-agent communication
- [ ] Add `canvas_agent_edit_request` delegation tool
- [ ] Test agent collaboration

### Phase 4: Snapshot System (Day 4)
- [ ] Implement `canvas_save_snapshot`
- [ ] Implement `canvas_revert_to_snapshot`
- [ ] Add snapshot metadata and labels
- [ ] Test version control

### Phase 5: UI Integration (Day 5-6)
- [ ] Add diff viewer component
- [ ] Add version timeline
- [ ] Add undo/redo buttons
- [ ] Add snapshot management UI
- [ ] Add change highlighting
- [x] Add text selection "Add to Chat" button (✅ Oct 8, 2025)

### Phase 6: Testing & Polish (Day 7)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Edge case handling
- [ ] Documentation

## Benefits

### For Users
- **Precision**: Line-by-line control over edits
- **Safety**: Full undo/redo and version control
- **Transparency**: See exactly what changed
- **Confidence**: Can always revert mistakes

### For Agents
- **Specialization**: Canvas Agent is expert at editing
- **Delegation**: Primary agent delegates editing tasks
- **Context**: Canvas Agent maintains document context
- **Efficiency**: Optimized tools for common editing operations

## Technical Considerations

### Diff Algorithm
Use a proper diff algorithm (e.g., Myers diff) for:
- Accurate change detection
- Minimal diff output
- Efficient computation

### Concurrency
- Lock canvas session during agent edits
- Queue multiple edit requests
- Prevent race conditions

### Performance
- Store diffs efficiently (only changed lines)
- Limit undo/redo stack size
- Compress old snapshots

### Error Handling
- Validate line numbers before edits
- Handle out-of-range errors gracefully
- Preserve content on failed edits

## Success Metrics

### Phase 1-4 Complete When:
- ✅ Canvas Agent can perform all editing operations
- ✅ Diffs are tracked accurately
- ✅ Undo/redo works reliably
- ✅ Snapshots can be saved and restored

### Phase 5-6 Complete When:
- ✅ UI shows diffs clearly
- ✅ Version timeline is intuitive
- ✅ Performance is acceptable (<100ms for edits)
- ✅ Edge cases are handled

## Next Steps

1. **Review this architecture** - Confirm design decisions
2. **Create database migrations** - Extend schema
3. **Implement core Canvas MCP tools** - Start with Phase 1
4. **Create Canvas Agent** - Define system prompt and behavior
5. **Build UI components** - Integrate with Canvas Mode

---

**Status**: 📋 Architecture Complete - Ready for Implementation  
**Estimated Timeline**: 7 days  
**Dependencies**: Canvas Auto-Save System (✅ Complete)

