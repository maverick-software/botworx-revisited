# Architecture Planning Research Document

**Research Date:** August 28, 2025  
**WBS Section:** Phase 2 - Planning (Items 2.1.1 - 2.1.4)  
**Purpose:** Research architecture decisions for visual team canvas implementation

## 2.1.1 - Component Architecture and File Structure

### Current Agentopia Component Patterns
Based on codebase analysis:

**Modal Architecture Pattern:**
- Main orchestrator component (~250-300 lines)
- Extracted sub-components (50-200 lines each)
- Custom hooks for state management
- Separate utility files

**Example from EnhancedToolsModalRefactored:**
```
src/components/modals/tools/
├── EnhancedToolsModalRefactored.tsx    (286 lines) - Main orchestrator
├── ConnectedToolsList.tsx              (extracted component)
├── AvailableToolsList.tsx              (extracted component)
├── CredentialSelector.tsx              (extracted component)
├── ToolSetupForms.tsx                  (extracted component)
├── useToolsModalState.ts               (custom hook)
├── useToolPermissions.ts               (custom hook)
└── useToolSetupHandlers.ts             (custom hook)
```

**Recommended Canvas Architecture:**
```
src/components/teams/canvas/
├── TeamCanvas.tsx                      (~250 lines) - Main React Flow wrapper
├── TeamNode.tsx                        (~200 lines) - Custom node component
├── ConnectionControls.tsx              (~150 lines) - Connection management
├── CanvasToolbar.tsx                   (~180 lines) - Zoom/pan/save controls
├── TeamNodeEditor.tsx                  (~220 lines) - Edit properties modal
└── CanvasSettingsModal.tsx             (~190 lines) - Canvas preferences

src/hooks/teams/canvas/
├── useTeamCanvas.ts                    (~280 lines) - Main state management
├── useTeamPositions.ts                 (~200 lines) - Position persistence
├── useTeamConnections.ts               (~240 lines) - Connection management
└── useCanvasViewport.ts                (~150 lines) - Viewport state

src/lib/teams/canvas/
├── canvasUtils.ts                      (~200 lines) - Layout algorithms
├── canvasTypes.ts                      (~100 lines) - TypeScript interfaces
└── canvasConstants.ts                  (~80 lines)  - Configuration constants
```

## 2.1.2 - React Flow Integration Approach

### React Flow Integration Strategy
Based on library research:

**Installation Requirements:**
```json
{
  "dependencies": {
    "reactflow": "^11.x",
    "@types/reactflow": "^11.x"
  }
}
```

**Core Integration Pattern:**
```typescript
// TeamCanvas.tsx - Main component structure
import ReactFlow, { 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState,
  Background,
  Controls,
  MiniMap
} from 'reactflow';

const nodeTypes = {
  teamNode: TeamNode, // Custom team node component
};

export function TeamCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**Node Data Structure:**
```typescript
interface TeamNodeData {
  teamId: string;
  name: string;
  description: string;
  memberCount: number;
  agentNames: string[];
  color?: string;
}
```

## 2.1.3 - State Management Strategy

### Current Hook Patterns Analysis
From `useTeams.ts` analysis:

**Established Pattern:**
- Single responsibility hooks
- `useState` for local state
- `useCallback` for stable function references
- Supabase integration with error handling
- Loading states for async operations

**Recommended Canvas Hooks:**

**useTeamCanvas.ts** - Main orchestrator hook:
```typescript
export function useTeamCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  
  // Integration with existing useTeams
  const { teams, fetchTeams } = useTeams();
  
  // Custom canvas operations
  const convertTeamsToNodes = useCallback(() => { ... });
  const saveCanvasLayout = useCallback(() => { ... });
  
  return {
    nodes, edges, onNodesChange, onEdgesChange,
    isCanvasMode, setIsCanvasMode,
    saveCanvasLayout,
    // ... other canvas operations
  };
}
```

**useTeamPositions.ts** - Position persistence:
```typescript
export function useTeamPositions(userId: string) {
  const [positions, setPositions] = useState<TeamPosition[]>([]);
  
  const savePosition = useCallback(async (teamId: string, x: number, y: number) => {
    // Call save_team_position database function
  }, []);
  
  const loadPositions = useCallback(async () => {
    // Load positions from team_canvas_positions table
  }, []);
  
  return { positions, savePosition, loadPositions };
}
```

## 2.1.4 - API Endpoints for Canvas Operations

### Database Function Strategy
Following established Supabase patterns in the codebase:

**Required Database Functions:**
1. `save_team_position(team_id, x_pos, y_pos, width, height)`
2. `create_team_connection(source_team_id, target_team_id, connection_type)`  
3. `get_user_canvas_data(user_id)` - Returns teams with positions and connections
4. `save_canvas_viewport(user_id, zoom, pan_x, pan_y)`

**RPC Call Pattern (following existing patterns):**
```typescript
// In useTeamPositions hook
const savePosition = useCallback(async (teamId: string, x: number, y: number) => {
  try {
    const { data, error } = await supabase.rpc('save_team_position', {
      p_team_id: teamId,
      p_x_position: x,
      p_y_position: y,
      p_width: 200,
      p_height: 100
    });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error saving team position:', err);
    throw err;
  }
}, []);
```

**Real-time Updates Strategy:**
```typescript
// Subscribe to team changes for real-time updates
useEffect(() => {
  const subscription = supabase
    .channel('team-canvas-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'teams' },
      (payload) => {
        // Update canvas nodes when teams change
        handleTeamChange(payload);
      }
    )
    .subscribe();
    
  return () => subscription.unsubscribe();
}, []);
```

## Key Architecture Decisions

### 1. Progressive Enhancement
- Canvas mode as additional view (not replacement)
- Fallback to grid view for compatibility
- Toggle between modes preserved in user preferences

### 2. Data Persistence Strategy
- Per-user canvas layouts (multi-tenant support)
- Debounced saving to avoid excessive database calls
- Optimistic updates for smooth UX

### 3. Integration with Existing Systems
- Reuse existing `useTeams` hook for team data
- Leverage existing modal patterns for editing
- Maintain existing team management workflows

### 4. Performance Considerations
- React Flow virtualization for large team counts
- Memoized components to prevent unnecessary re-renders
- Efficient database queries with proper indexing
