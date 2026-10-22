# Team Hierarchy Feature Implementation

**Date**: January 1, 2026
**Feature**: Team Hierarchy System
**Status**: ✅ Implemented and Ready for Testing

---

## 📋 Overview

The team hierarchy feature enables users to organize their teams in a hierarchical structure, allowing sub-teams to be created under parent teams. This mirrors real-world organizational structures like departments, divisions, and project teams.

---

## 🏗️ Architecture

### Database Changes

#### New Column: `parent_team_id`
- **Type**: `UUID`
- **Nullable**: `YES` (NULL for root-level teams)
- **Foreign Key**: References `teams(id)` with `ON DELETE SET NULL`
- **Constraint**: Self-referencing prevention (`teams_no_self_parent` check)
- **Index**: `idx_teams_parent_team_id` for efficient hierarchy queries

#### Database Functions

1. **`get_team_hierarchy(team_id UUID)`**
   - Returns entire team tree starting from specified team
   - Uses recursive CTE to traverse child teams
   - Returns: id, name, description, parent_team_id, owner_user_id, level, path

2. **`get_root_teams()`**
   - Returns all teams without parents
   - Includes child count for each root team
   - Ordered by name

3. **`get_team_children(team_id UUID)`**
   - Returns direct children of specified team
   - Includes child count for each team
   - Ordered by name

#### Row-Level Security (RLS) Updates

Updated RLS policies to support hierarchy:
- Users can view teams they own OR teams whose parent they own
- Users can insert teams with parents they own
- Users can update teams they own (including changing parent)
- Parent team must be owned by the same user

### TypeScript Type Updates

#### Updated Types (`src/types/database.types.ts`)
```typescript
teams: {
  Row: {
    // ... existing fields
    parent_team_id: string | null
  }
  Insert: {
    // ... existing fields
    parent_team_id?: string | null
  }
  Update: {
    // ... existing fields
    parent_team_id?: string | null
  }
}
```

#### New Type (`src/types/index.ts`)
```typescript
export type TeamWithHierarchy = Team & {
  child_teams?: TeamWithHierarchy[];
  parent_team?: Team;
  child_count?: number;
};
```

---

## 🎨 UI/UX Changes

### CreateTeamModal Component
**File**: `src/components/modals/CreateTeamModal.tsx`

**New Features**:
- Added dropdown selector for parent team
- Shows all available teams as potential parents
- Option to create as root team (no parent)
- Fetches teams when modal opens
- Helper text explaining the hierarchy concept

**User Flow**:
1. User clicks "Create New Team"
2. Enters team name and description (as before)
3. **NEW**: Optionally selects a parent team from dropdown
4. Selects "None (Root Team)" to create a top-level team
5. Submits form

### TeamsPage Component
**File**: `src/pages/TeamsPage.tsx`

**New Features**:
- Hierarchical tree display of teams
- Expandable/collapsible tree nodes for teams with children
- Visual indentation showing parent-child relationships
- Chevron icons indicating expand/collapse state
- Sub-team count display for parent teams

**Visual Structure**:
```
▼ Marketing Team (2 sub-teams)
    └─ Content Team
    └─ Social Media Team
▶ Engineering Team (3 sub-teams)
Sales Team
```

**User Interactions**:
- Click chevron to expand/collapse child teams
- Click team card to view team details (existing functionality)
- Visual depth indicators with left margin indentation

---

## 🔧 Technical Implementation

### Hook Updates
**File**: `src/hooks/useTeams.ts`

**Updated Function**:
```typescript
createTeam: (
  name: string, 
  description?: string, 
  parentTeamId?: string
) => Promise<Team | null>
```

**Changes**:
- Added optional `parentTeamId` parameter
- Passes `parent_team_id` to Supabase insert
- Maintains backward compatibility (parameter is optional)

### Hierarchy Building Algorithm
**Location**: `src/pages/TeamsPage.tsx` - `hierarchicalTeams` useMemo

**Algorithm**:
1. Create a map of all teams by ID
2. Initialize empty array for root teams
3. Iterate through teams:
   - If team has `parent_team_id`:
     - Find parent in map
     - Add team to parent's `child_teams` array
   - Else:
     - Add team to root teams array
4. Return root teams (which contain nested children)

**Time Complexity**: O(n) where n is number of teams
**Space Complexity**: O(n) for the map and hierarchy structure

---

## 📁 Files Modified

### Database
- ✅ `supabase/migrations/20260101000001_add_team_hierarchy.sql` (NEW)
  - Added `parent_team_id` column
  - Created indexes and constraints
  - Updated RLS policies
  - Added helper functions

### TypeScript Types
- ✅ `src/types/database.types.ts` (MODIFIED)
  - Added `parent_team_id` to Row, Insert, Update types
  
- ✅ `src/types/index.ts` (MODIFIED)
  - Added `TeamWithHierarchy` type

### Components
- ✅ `src/components/modals/CreateTeamModal.tsx` (MODIFIED)
  - Added parent team selector
  - Updated form submission logic
  - Added Select component imports

### Hooks
- ✅ `src/hooks/useTeams.ts` (MODIFIED)
  - Updated `createTeam` signature
  - Added `parent_team_id` to insert

### Pages
- ✅ `src/pages/TeamsPage.tsx` (MODIFIED)
  - Added hierarchical display logic
  - Created `HierarchicalTeamDisplay` component
  - Added expand/collapse state management
  - Updated rendering to use tree structure

---

## 🧪 Testing Checklist

### Database Migration Testing
- [ ] Run migration: `npx supabase migration up`
- [ ] Verify `parent_team_id` column exists
- [ ] Verify index `idx_teams_parent_team_id` created
- [ ] Test constraint: attempt to create team as its own parent (should fail)
- [ ] Test RLS: create team, create sub-team, verify permissions
- [ ] Test functions: call `get_team_hierarchy()`, `get_root_teams()`, `get_team_children()`

### UI Testing - Create Team Modal
- [ ] Open create team modal
- [ ] Verify parent team dropdown appears
- [ ] Verify "None (Root Team)" option exists
- [ ] Create root team (no parent selected)
- [ ] Create sub-team (parent selected)
- [ ] Verify sub-team appears under parent in teams list

### UI Testing - Teams Page
- [ ] Create multiple root teams
- [ ] Create sub-teams under different parents
- [ ] Verify hierarchy displays correctly
- [ ] Test expand/collapse functionality
- [ ] Verify chevron icons show for teams with children
- [ ] Verify indentation increases for nested teams
- [ ] Test clicking team cards still navigates correctly
- [ ] Verify sub-team count shows for parent teams

### Edge Cases
- [ ] Create deeply nested hierarchy (3+ levels)
- [ ] Delete parent team - verify children become orphaned (parent_team_id set to NULL)
- [ ] Move team to different parent (via edit modal if implemented)
- [ ] Create team with non-existent parent ID (should fail)
- [ ] Verify circular reference prevention works

### Mobile Testing
- [ ] Test hierarchy display on mobile viewport
- [ ] Verify touch targets are adequate
- [ ] Test expand/collapse on mobile
- [ ] Verify performance with many teams

### Performance Testing
- [ ] Test with 50+ teams
- [ ] Test with deep nesting (5+ levels)
- [ ] Monitor hierarchy calculation performance
- [ ] Check for unnecessary re-renders

---

## 🔐 Security Considerations

### RLS Policy Updates
- ✅ Users can only create sub-teams under their own teams
- ✅ Users cannot assign someone else's team as parent
- ✅ Self-referencing prevented at database level
- ✅ Orphaned teams (parent deleted) automatically have parent_team_id set to NULL

### Potential Security Issues to Monitor
1. **Circular References**: Prevented by constraint, but watch for edge cases
2. **Permission Escalation**: Ensure users can't access teams through hierarchy they shouldn't see
3. **Orphan Teams**: When parent deleted, children become root teams - is this desired behavior?

---

## 📈 Future Enhancements

### Recommended Next Steps
1. **Edit Team Modal**: Add ability to change parent team
2. **Team Permissions**: Inherit permissions from parent teams
3. **Team Search**: Filter/search within hierarchy
4. **Breadcrumb Navigation**: Show team path (e.g., "Engineering > Backend > API Team")
5. **Drag-and-Drop**: Reorder teams or move between parents
6. **Bulk Operations**: Move multiple teams at once
7. **Team Templates**: Create team structures from templates
8. **Analytics**: Show hierarchy depth, team distribution metrics
9. **Export**: Export team hierarchy as org chart

### Potential Improvements
- Add visual connectors (tree lines) between parent and child teams
- Add "Expand All" / "Collapse All" buttons
- Remember expansion state in localStorage
- Add team icons or colors for better visual hierarchy
- Show agent count at each level with rollup from children

---

## 🐛 Known Issues / Limitations

1. **Recursive Expansion**: Expanding a parent doesn't recursively expand all children
2. **No Depth Limit**: Database allows unlimited nesting depth
3. **No Edit Parent**: Currently no UI to change parent after team creation
4. **Mobile Tree View**: Indentation on mobile may be cramped for deep hierarchies
5. **No Validation**: No max depth validation in UI or database

---

## 📝 Migration Instructions

### To Deploy This Feature:

1. **Run Database Migration**:
```bash
npx supabase db push
```

2. **Verify Migration**:
```sql
-- Check column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'teams' AND column_name = 'parent_team_id';

-- Check constraint exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'teams' AND constraint_name = 'teams_no_self_parent';
```

3. **Test in Development**:
- Create test teams with hierarchy
- Verify UI updates correctly
- Test all CRUD operations

4. **Deploy Frontend**:
- Commit and push code changes
- Deploy to staging/production
- Clear browser cache if needed

### Rollback Plan:

If issues occur, rollback steps:

```sql
-- Remove hierarchy-related changes
BEGIN;

-- Drop functions
DROP FUNCTION IF EXISTS get_team_hierarchy(UUID);
DROP FUNCTION IF EXISTS get_root_teams();
DROP FUNCTION IF EXISTS get_team_children(UUID);

-- Drop constraint
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_no_self_parent;

-- Drop index
DROP INDEX IF EXISTS idx_teams_parent_team_id;

-- Drop column (WARNING: Deletes all hierarchy data!)
ALTER TABLE teams DROP COLUMN IF EXISTS parent_team_id;

-- Restore original RLS policies
DROP POLICY IF EXISTS teams_select_own ON teams;
CREATE POLICY teams_select_own ON teams
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS teams_insert_own ON teams;
CREATE POLICY teams_insert_own ON teams
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS teams_update_own ON teams;
CREATE POLICY teams_update_own ON teams
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

COMMIT;
```

Then revert frontend code to previous version.

---

## 💡 Usage Examples

### Example 1: Department Structure
```
▼ Engineering (4 sub-teams)
    ├─ Frontend Team
    ├─ Backend Team
    ├─ DevOps Team
    └─ QA Team
▼ Marketing (2 sub-teams)
    ├─ Content Marketing
    └─ Growth Marketing
Sales Team
```

### Example 2: Project-Based Structure
```
▼ Product Development (3 sub-teams)
    ├─ Mobile App Project
    ├─ Web Platform Project
    └─ API Development
▼ Customer Success (2 sub-teams)
    ├─ Support Team
    └─ Implementation Team
```

### Example 3: Geographic Structure
```
▼ North America (2 sub-teams)
    ├─ US Operations
    └─ Canada Operations
▼ Europe (3 sub-teams)
    ├─ UK Office
    ├─ German Office
    └─ French Office
```

---

## 📞 Support & Questions

If you encounter issues:
1. Check browser console for errors
2. Verify database migration ran successfully
3. Check Supabase logs for RLS policy violations
4. Test with simple 2-level hierarchy first
5. Refer to this documentation for implementation details

---

**Last Updated**: January 1, 2026
**Version**: 1.0
**Status**: Ready for User Acceptance Testing

