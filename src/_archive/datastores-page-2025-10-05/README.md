# Archived: DatastoresPage (October 5, 2025)

## What Was Archived
- `DatastoresPage.tsx` - The standalone datastores/memory management page

## Why It Was Archived
The DatastoresPage has been deprecated in favor of integrating datastore creation and management directly into the Agent Settings modal Memory tab. This provides a more streamlined user experience where users can:

1. Create new datastores directly from the agent settings
2. Assign datastores to agents without navigating away
3. See all memory-related configuration in one place

## What Replaced It
The datastore functionality has been moved to:
- **Location**: Agent Settings Modal → Memory Tab
- **Component**: `AgentDatastoreSelector` component (`src/components/agent-edit/AgentDatastoreSelector.tsx`)
- **Features**:
  - View available datastores
  - Create new Pinecone or GetZep datastores
  - Edit existing datastores
  - Assign/unassign datastores to agents
  - Delete datastores

## Migration Path
- The `/memory` route should now be removed from routing
- All datastore CRUD operations are handled through `AgentDatastoreSelector`
- Users access datastore management via: Chat Page → Agent Settings (gear icon) → Memory tab

## Rollback Instructions
If you need to restore the old DatastoresPage:
1. Copy `DatastoresPage.tsx.backup` back to `src/pages/DatastoresPage.tsx`
2. Re-add the `/memory` route to your routing configuration
3. Re-add the Memory link to the AccountMenu Settings submenu
4. Remove or comment out the `AgentDatastoreSelector` from `MemoryTab.tsx`

## Files Modified
- `src/components/modals/agent-settings/MemoryTab.tsx` - Now uses `AgentDatastoreSelector`
- `src/components/shared/AccountMenu.tsx` - Removed Memory link
- `src/components/Sidebar.tsx` - (Memory was not in main sidebar)

## Date Archived
October 5, 2025

