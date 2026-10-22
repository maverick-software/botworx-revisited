# Canvas Auto-Save Implementation

## Overview
Implemented an auto-save system for Canvas Mode that stores work-in-progress content separately from artifact versions. This allows users to return to their editing sessions without losing work, similar to ChatGPT and Claude's canvas behavior.

## Implementation Date
October 8, 2025

## Architecture

### Database Layer
- **Table**: `canvas_sessions`
- **Purpose**: Store temporary work-in-progress content while editing in Canvas Mode
- **Location**: `supabase/migrations/20251008000000_create_canvas_sessions.sql`

#### Schema
```sql
CREATE TABLE canvas_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    artifact_id UUID NOT NULL REFERENCES artifacts(id),
    conversation_session_id UUID REFERENCES conversation_sessions(id),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, artifact_id, conversation_session_id)
);
```

#### Key Features
- **Automatic Updates**: Triggers update `updated_at` and `last_accessed_at` on every change
- **RLS Policies**: Users can only access their own canvas sessions
- **Cleanup Function**: `cleanup_old_canvas_sessions(days_old)` for removing stale sessions
- **Indexes**: Optimized for queries by user, artifact, conversation, and last access time

### Frontend Hook
- **File**: `src/hooks/useCanvasSession.ts`
- **Purpose**: Manage canvas session CRUD operations and auto-saving

#### Key Functions
1. **`loadSession(initialContent)`**
   - Loads existing canvas session or creates new one
   - Returns saved content if available
   - Shows toast notification when restoring previous work

2. **`autoSave(content)`**
   - Debounced auto-save (default 3 seconds)
   - Only saves if content has changed
   - Silent operation (no toast notifications)
   - Updates metadata with char count and line count

3. **`manualSave(content)`**
   - Immediate save without debounce
   - Used for explicit save actions

4. **`clearSession()`**
   - Removes canvas session after successful artifact save
   - Called when user commits changes to artifact database

### UI Integration
- **Component**: `src/components/chat/CanvasMode.tsx`
- **Status Indicators**:
  - "Auto-saving draft..." (blue) - Active save in progress
  - "Draft saved • Unsaved to database" (yellow) - Changes saved locally but not committed

#### User Flow
1. User opens artifact in Canvas Mode
2. System checks for existing canvas session
3. If found, restores previous work-in-progress
4. As user edits, content auto-saves every 3 seconds to `canvas_sessions`
5. User manually clicks "Save to Database" when ready
6. Artifact version is created and canvas session is cleared

## Key Benefits

### 1. **Data Safety**
- No work lost if user closes canvas accidentally
- Auto-saves protect against browser crashes
- Separate from artifact versioning system

### 2. **Performance**
- Debounced saves reduce database writes
- No unnecessary artifact versions created
- Metadata tracking for debugging

### 3. **User Experience**
- Seamless restoration of previous work
- Clear status indicators for save state
- Matches ChatGPT/Claude canvas behavior

### 4. **Scalability**
- Cleanup function prevents database bloat
- Indexed for fast queries
- Efficient unique constraint on user/artifact/conversation

## Technical Details

### Auto-Save Logic
```typescript
// Debounced auto-save (3 seconds)
useEffect(() => {
  if (content && user?.id && agent?.id) {
    canvasSession.autoSave(content);
  }
}, [content]);
```

### Session Restoration
```typescript
// Load on mount
useEffect(() => {
  const initSession = async () => {
    if (user?.id && agent?.id) {
      const savedContent = await canvasSession.loadSession(artifact.content);
      if (savedContent !== artifact.content) {
        setContent(savedContent);
        toast.info('Restored your previous work-in-progress');
      }
    }
  };
  initSession();
}, []);
```

### Session Cleanup
```typescript
// Clear after successful save
const handleSave = async () => {
  await onSave(content); // Save to artifacts
  await canvasSession.clearSession(); // Remove draft
  toast.success('Saved to database and cleared draft!');
};
```

## Database Maintenance

### Manual Cleanup
```sql
-- Remove canvas sessions older than 30 days
SELECT cleanup_old_canvas_sessions(30);
```

### Recommended Cron Job
```sql
-- Run daily at 2 AM
SELECT cron.schedule(
  'cleanup-old-canvas-sessions',
  '0 2 * * *',
  $$SELECT cleanup_old_canvas_sessions(30)$$
);
```

## Future Enhancements

### Potential Features
1. **Conflict Resolution**: Handle multiple devices editing same artifact
2. **Offline Support**: Queue auto-saves when offline, sync when online
3. **Session History**: Keep last N auto-saves for rollback
4. **Collaborative Editing**: Real-time cursor positions (if needed)
5. **Compression**: Store large content as compressed blobs

### Performance Optimizations
1. **Batch Updates**: Combine multiple saves into single transaction
2. **Differential Storage**: Store only diffs instead of full content
3. **Client-Side Caching**: Reduce database reads on session load

## Testing Checklist

- [x] Canvas session creation on first edit
- [x] Auto-save triggers after 3 seconds
- [x] Session restoration on canvas reopen
- [x] Session cleanup after manual save
- [x] RLS policies enforce user isolation
- [x] Unique constraint prevents duplicates
- [ ] Cleanup function removes old sessions (manual test)
- [ ] Performance under concurrent editing

## Migration Status
- ✅ Database migration pushed: `20251008000000_create_canvas_sessions.sql`
- ✅ Frontend hook implemented: `src/hooks/useCanvasSession.ts`
- ✅ UI integration complete: `src/components/chat/CanvasMode.tsx`
- ✅ No edge functions required

## Related Documentation
- [Revised Plan](./REVISED_PLAN.md) - Overall artifact system architecture
- [Phase 2 Completion](./PHASE_2_COMPLETION.md) - Canvas Mode UI implementation
- [README](./README.md) - Project navigation guide

