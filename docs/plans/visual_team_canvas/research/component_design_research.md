# Component Design Research Document

**Research Date:** August 28, 2025  
**WBS Section:** Phase 3 - Design (Items 3.1.1 - 3.1.4)  
**Purpose:** Research component design patterns for visual team canvas implementation

## 3.1.1 - Design Canvas Component Interface

### Current Component Architecture Analysis
From `EnhancedToolsModalRefactored.tsx` and `EnhancedChannelsModalRefactored.tsx`:

**Established Component Interface Patterns:**

**Modal Component Pattern:**
```tsx
interface ComponentProps {
  // Core functionality
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  
  // Optional data and callbacks
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function ComponentName({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: ComponentProps) {
  // Main orchestrator component (286 lines)
  // Uses extracted sub-components
  // Custom hooks for state management
  // Proper error handling and loading states
}
```

**Canvas Component Interface Design:**

**Primary Canvas Component:**
```tsx
interface VisualTeamCanvasProps {
  // Core functionality
  isOpen: boolean;
  onClose: () => void;
  
  // Team data
  teams: Team[];
  
  // Workspace/user context
  workspaceId?: string;
  userId: string;
  
  // Canvas state
  initialLayout?: CanvasLayout;
  
  // Callbacks
  onTeamCreate?: () => void;
  onTeamUpdate?: (teamId: string, updates: Partial<Team>) => void;
  onTeamDelete?: (teamId: string) => void;
  onLayoutSave?: (layout: CanvasLayout) => Promise<void>;
  onConnectionCreate?: (connection: TeamConnection) => void;
  onConnectionDelete?: (connectionId: string) => void;
  
  // Configuration
  readonly?: boolean;
  showToolbar?: boolean;
  defaultViewMode?: 'grid' | 'canvas';
  
  // Styling
  className?: string;
}

// Supporting interfaces
interface CanvasLayout {
  id?: string;
  userId: string;
  positions: TeamPosition[];
  connections: TeamConnection[];
  viewSettings: {
    zoom: number;
    centerX: number;
    centerY: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface TeamPosition {
  teamId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface TeamConnection {
  id?: string;
  fromTeamId: string;
  toTeamId: string;
  type: 'reports_to' | 'collaborates_with' | 'supports' | 'custom';
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}
```

### Component File Structure

Following established patterns:
```
src/components/teams/canvas/
├── VisualTeamCanvas.tsx              (Main orchestrator ~250-300 lines)
├── TeamCanvasToolbar.tsx             (Toolbar controls ~150-200 lines)
├── TeamNode.tsx                      (Individual team node ~100-150 lines)
├── TeamConnectionEdge.tsx            (Connection line component ~80-120 lines)
├── CanvasMinimap.tsx                 (Overview minimap ~100-150 lines)
├── CanvasBackground.tsx              (Grid/pattern background ~50-80 lines)
├── ConnectionTypeSelector.tsx        (Connection type picker ~80-120 lines)
├── CanvasSettingsModal.tsx          (Settings modal ~200-250 lines)
├── hooks/
│   ├── useCanvasState.ts            (Canvas state management)
│   ├── useTeamNodes.ts              (Team node operations)
│   ├── useCanvasConnections.ts      (Connection management)
│   ├── useCanvasLayout.ts           (Layout persistence)
│   └── useCanvasKeyboard.ts         (Keyboard shortcuts)
├── types/
│   ├── canvas.ts                    (Canvas-specific types)
│   └── nodes.ts                     (Node-specific types)
└── utils/
    ├── canvasUtils.ts               (Canvas utility functions)
    ├── layoutUtils.ts               (Layout calculation helpers)
    └── connectionUtils.ts           (Connection logic)
```

## 3.1.2 - Design Team Node Component

### Current Card Component Analysis
From `TeamCard.tsx` and modal patterns:

**Current Team Card Structure:**
```tsx
// Current simple card (31 lines)
<Link to={`/teams/${team.id}`} className="block bg-card hover:bg-accent/50">
  <div className="flex items-start space-x-3">
    <div className="bg-primary p-2 rounded-lg">
      <Users className="w-5 h-5 text-primary-foreground" />
    </div>
    <div className="flex-1">
      <h3 className="text-lg font-semibold">{team.name}</h3>
      <p className="text-sm text-muted-foreground">{team.description}</p>
    </div>
  </div>
</Link>
```

**Enhanced Canvas Node Design:**
```tsx
interface TeamNodeProps {
  // Team data
  team: Team;
  members: TeamMember[];
  
  // React Flow node props
  data: TeamNodeData;
  selected: boolean;
  
  // Canvas state
  isConnecting: boolean;
  connectionMode: ConnectionType | null;
  
  // Callbacks
  onTeamClick: (teamId: string) => void;
  onTeamEdit: (teamId: string) => void;
  onTeamDelete: (teamId: string) => void;
  onConnectionStart: (teamId: string, handle: 'top' | 'right' | 'bottom' | 'left') => void;
  
  // Styling
  className?: string;
  style?: React.CSSProperties;
}

interface TeamNodeData {
  teamId: string;
  name: string;
  description: string;
  memberCount: number;
  agentNames: string[];
  teamType?: string;
  color?: string;
  lastActivity?: string;
}

const TeamNode: React.FC<TeamNodeProps> = ({
  team,
  members,
  data,
  selected,
  isConnecting,
  connectionMode,
  onTeamClick,
  onTeamEdit,
  onTeamDelete,
  onConnectionStart
}) => {
  // Component logic (~100-150 lines)
  // Drag handles for connections
  // Hover states for interactivity
  // Context menu for actions
  // Truncated text with tooltips
  // Loading and error states
};
```

**Node Component Structure:**
```tsx
<div className={cn(
  "team-node relative bg-card border-2 rounded-xl shadow-md transition-all duration-200",
  "min-w-[200px] max-w-[280px] p-4",
  selected && "border-primary shadow-lg scale-105 bg-primary/5",
  isConnecting && "ring-2 ring-primary/30",
  className
)}>
  {/* Connection Handles */}
  <Handle 
    type="source" 
    position={Position.Top} 
    className="react-flow__handle-top"
  />
  <Handle 
    type="source" 
    position={Position.Right} 
    className="react-flow__handle-right"
  />
  <Handle 
    type="source" 
    position={Position.Bottom} 
    className="react-flow__handle-bottom"
  />
  <Handle 
    type="source" 
    position={Position.Left} 
    className="react-flow__handle-left"
  />
  
  {/* Node Header */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center space-x-2">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        `bg-gradient-to-br ${teamColors[team.teamType] || teamColors.default}`
      )}>
        <Users className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate" title={team.name}>
          {team.name}
        </h3>
      </div>
    </div>
    
    {/* Member Count Badge */}
    <Badge variant="secondary" className="text-xs">
      {memberCount}
    </Badge>
  </div>
  
  {/* Node Content */}
  <div className="space-y-2">
    <p className="text-xs text-muted-foreground line-clamp-2" title={team.description}>
      {team.description || 'No description'}
    </p>
    
    {/* Agent List */}
    {agentNames.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {agentNames.slice(0, 3).map(name => (
          <Badge key={name} variant="outline" className="text-xs px-1 py-0">
            {name}
          </Badge>
        ))}
        {agentNames.length > 3 && (
          <Badge variant="outline" className="text-xs px-1 py-0">
            +{agentNames.length - 3}
          </Badge>
        )}
      </div>
    )}
  </div>
  
  {/* Context Menu Trigger */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="h-3 w-3" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onTeamEdit(team.id)}>
        <Edit className="h-4 w-4 mr-2" />
        Edit Team
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onTeamClick(team.id)}>
        <ExternalLink className="h-4 w-4 mr-2" />
        View Details
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem 
        onClick={() => onTeamDelete(team.id)}
        className="text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Team
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

## 3.1.3 - Design Connection Component

### Connection Component Analysis
Based on React Flow edge patterns:

**Connection Edge Component:**
```tsx
interface TeamConnectionEdgeProps {
  // React Flow edge props
  id: string;
  source: string;
  target: string;
  selected: boolean;
  
  // Connection data
  data: ConnectionEdgeData;
  
  // Callbacks
  onEdgeClick: (edgeId: string) => void;
  onEdgeDelete: (edgeId: string) => void;
  onEdgeEdit: (edgeId: string) => void;
  
  // React Flow positioning props
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

interface ConnectionEdgeData {
  type: 'reports_to' | 'collaborates_with' | 'supports' | 'custom';
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  bidirectional?: boolean;
}

const TeamConnectionEdge: React.FC<TeamConnectionEdgeProps> = ({
  id,
  source,
  target,
  selected,
  data,
  onEdgeClick,
  onEdgeDelete,
  onEdgeEdit,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition
}) => {
  // Calculate path and styling based on connection type
  // Render appropriate markers and labels
  // Handle interactive states
};
```

**Connection Types and Styling:**
```tsx
const connectionStyles = {
  reports_to: {
    stroke: 'hsl(var(--foreground))',
    strokeWidth: 2,
    strokeDasharray: 'none',
    markerEnd: 'url(#arrow-filled)',
  },
  collaborates_with: {
    stroke: 'hsl(var(--muted-foreground))',
    strokeWidth: 2,
    strokeDasharray: '10 5',
    markerEnd: 'none',
  },
  supports: {
    stroke: 'hsl(var(--success))',
    strokeWidth: 2,
    strokeDasharray: '2 3',
    markerEnd: 'url(#circle-marker)',
  },
  custom: {
    stroke: 'var(--connection-color, hsl(var(--primary)))',
    strokeWidth: 2,
    strokeDasharray: 'var(--connection-pattern, none)',
    markerEnd: 'var(--connection-marker, none)',
  }
};
```

## 3.1.4 - Design Toolbar Component

### Toolbar Component Analysis
From existing modal patterns:

**Toolbar Component Structure:**
```tsx
interface CanvasToolbarProps {
  // Canvas state
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  
  // View mode
  viewMode: 'grid' | 'canvas';
  
  // Connection state
  connectionMode: ConnectionType | null;
  isConnecting: boolean;
  
  // Layout state
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  
  // Callbacks
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetLayout: () => void;
  onSaveLayout: () => void;
  onExportLayout: () => void;
  
  onViewModeChange: (mode: 'grid' | 'canvas') => void;
  onConnectionModeChange: (mode: ConnectionType | null) => void;
  
  onShowSettings: () => void;
  
  // Options
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  
  className?: string;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom,
  canZoomIn,
  canZoomOut,
  viewMode,
  connectionMode,
  isConnecting,
  hasUnsavedChanges,
  isSaving,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetLayout,
  onSaveLayout,
  onViewModeChange,
  onConnectionModeChange,
  onShowSettings
}) => {
  // Toolbar implementation (~150-200 lines)
  // Grouped button sections
  // Responsive design for mobile
  // Keyboard shortcuts tooltips
};
```

**Toolbar Layout Structure:**
```tsx
<div className="flex items-center justify-between p-4 bg-card border-b border-border">
  {/* Left Section: View Controls */}
  <div className="flex items-center space-x-2">
    {/* View Mode Toggle */}
    <div className="flex items-center border rounded-md">
      <Button
        size="sm"
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        onClick={() => onViewModeChange('grid')}
        className="rounded-r-none"
      >
        <Grid className="h-4 w-4 mr-1" />
        Grid
      </Button>
      <Button
        size="sm"
        variant={viewMode === 'canvas' ? 'default' : 'ghost'}
        onClick={() => onViewModeChange('canvas')}
        className="rounded-l-none border-l"
      >
        <Network className="h-4 w-4 mr-1" />
        Canvas
      </Button>
    </div>
    
    {/* Zoom Controls */}
    {viewMode === 'canvas' && (
      <>
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex items-center space-x-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onZoomOut}
            disabled={!canZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground px-2 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onZoomIn}
            disabled={!canZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button size="sm" variant="outline" onClick={onFitView}>
            <Maximize className="h-4 w-4 mr-1" />
            Fit View
          </Button>
        </div>
      </>
    )}
  </div>
  
  {/* Center Section: Connection Tools */}
  {viewMode === 'canvas' && (
    <div className="flex items-center space-x-2">
      <Label className="text-sm font-medium">Connection:</Label>
      <Select 
        value={connectionMode || 'none'} 
        onValueChange={(value) => onConnectionModeChange(value === 'none' ? null : value as ConnectionType)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="reports_to">Reports To</SelectItem>
          <SelectItem value="collaborates_with">Collaborates</SelectItem>
          <SelectItem value="supports">Supports</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
      
      {isConnecting && (
        <Badge variant="secondary" className="animate-pulse">
          Connecting...
        </Badge>
      )}
    </div>
  )}
  
  {/* Right Section: Actions */}
  <div className="flex items-center space-x-2">
    {viewMode === 'canvas' && (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={onResetLayout}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
        
        <Button
          size="sm"
          onClick={onSaveLayout}
          disabled={isSaving || !hasUnsavedChanges}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Save Layout
            </>
          )}
        </Button>
      </>
    )}
    
    <Button
      size="sm"
      variant="outline"
      onClick={onShowSettings}
    >
      <Settings className="h-4 w-4" />
    </Button>
  </div>
</div>
```

## Component Integration Patterns

### Error Boundaries and Loading States
```tsx
// Error boundary wrapper for canvas components
<ErrorBoundary fallback={<CanvasErrorFallback />}>
  <Suspense fallback={<CanvasLoadingSkeleton />}>
    <VisualTeamCanvas {...props} />
  </Suspense>
</ErrorBoundary>

// Loading states following existing patterns
const CanvasLoadingSkeleton = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-10 w-full" /> {/* Toolbar */}
    <div className="grid grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  </div>
);
```

### Accessibility Considerations
```tsx
// ARIA labels and keyboard navigation
<div
  role="application"
  aria-label="Team Organization Canvas"
  tabIndex={0}
  onKeyDown={handleKeyboard}
>
  {/* Canvas content */}
</div>

// Screen reader announcements
const announceAction = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
```

### Performance Optimization
```tsx
// Memoized components for large team lists
const MemoizedTeamNode = React.memo(TeamNode, (prevProps, nextProps) => {
  return (
    prevProps.team.id === nextProps.team.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.isConnecting === nextProps.isConnecting &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  );
});

// Virtual rendering for large canvases (100+ teams)
const useVirtualizedNodes = (nodes: Node[], viewport: Viewport) => {
  return useMemo(() => {
    if (nodes.length < 50) return nodes;
    
    // Only render nodes within viewport + buffer
    return nodes.filter(node => 
      isNodeInViewport(node, viewport, VIEWPORT_BUFFER)
    );
  }, [nodes, viewport]);
};
```
