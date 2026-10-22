# UI/UX Design Research Document

**Research Date:** August 28, 2025  
**WBS Section:** Phase 2 - Planning (Items 2.3.1 - 2.3.4)  
**Purpose:** Research visual design patterns and interface approaches for canvas implementation

## 2.3.1 - Create Wireframes for Canvas Interface

### Current Page Layout Analysis
From `TeamsPage.tsx` analysis:

**Existing Layout Structure:**
- Header with title and "Create New Team" button
- Information section explaining team organization
- Grid layout for team cards (responsive: 1/2/3 columns)
- Loading states and empty states

**Canvas Interface Wireframe Requirements:**

**Primary Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Teams                                    [ Canvas Mode ☐ ]  │
├─────────────────────────────────────────────────────────────┤
│ [ Toolbar: Zoom Out | Zoom In | Fit View | Save | Reset ]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  Canvas Area                      │
│  │                     │                                   │
│  │  Team Node Cards    │  ┌───────────┐                   │
│  │  - Drag & Drop      │  │  ┌─────┐  │                   │
│  │  - Connection       │  │  │Team │  │ ← Connection Line  │
│  │    handles          │  │  │ A   │  │                   │
│  │  - Visual styling   │  │  └─────┘  │                   │
│  │                     │  └───────────┘                   │
│  └─────────────────────┘                                  │
│                                                             │
│  ┌─────────────────┐                                       │
│  │   Minimap       │                                       │
│  │   - Overview    │                                       │
│  │   - Navigation  │                                       │  
│  └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Toggle Between Views:**
- Switch control to toggle between grid and canvas modes
- Persistent user preference storage
- Smooth transition between layouts

### Wireframe Components Breakdown:

**1. Canvas Toolbar (Top)**
- Zoom controls (- / + buttons)
- Fit to view button
- Save layout button  
- Reset to default layout button
- Export/share functionality

**2. Main Canvas Area**
- React Flow container with drag/drop
- Team nodes with visual styling
- Connection lines between teams
- Grid background for alignment
- Zoom and pan capabilities

**3. Minimap (Corner)**
- Small overview of entire canvas
- Current view indicator
- Click to navigate functionality
- Toggle visibility option

**4. Side Panel (Optional)**
- Team creation shortcuts
- Connection type selection
- Canvas settings/preferences

## 2.3.2 - Design Team Node Visual Styling

### Current Team Card Analysis
From `TeamCard.tsx`:

**Current Design Elements:**
- Card container: `bg-card border border-border rounded-lg p-4 shadow`
- Icon container: `bg-primary p-2 rounded-lg` with `Users` icon
- Title: `text-lg font-semibold text-card-foreground`
- Description: `text-sm text-muted-foreground line-clamp-2`
- Hover state: `hover:bg-accent/50 transition-colors`

### Enhanced Canvas Node Design

**Node Structure for React Flow:**
```tsx
interface TeamNodeData {
  teamId: string;
  name: string;
  description: string;
  memberCount: number;
  agentNames: string[];
  color?: string;
  isSelected?: boolean;
}
```

**Visual Styling:**
```css
/* Base Node Styling */
.team-node {
  @apply bg-card border-2 border-border rounded-xl shadow-md;
  @apply min-w-[200px] max-w-[280px] p-4;
  @apply transition-all duration-200;
}

/* Selected State */
.team-node.selected {
  @apply border-primary shadow-lg scale-105;
  @apply bg-primary/5;
}

/* Hover State */
.team-node:hover {
  @apply border-primary/50 shadow-lg;
  @apply bg-accent/30;
}

/* Connection Handles */
.react-flow__handle {
  @apply bg-primary border-2 border-primary-foreground;
  @apply w-3 h-3 rounded-full opacity-0;
  @apply transition-opacity duration-200;
}

.team-node:hover .react-flow__handle {
  @apply opacity-100;
}
```

**Node Components:**
1. **Header Section:**
   - Team icon with gradient background
   - Team name (truncated if long)
   - Member count badge

2. **Content Section:**
   - Team description (2 lines max)
   - Agent list (abbreviated with "..." if many)
   - Status indicators

3. **Footer Section:**
   - Last updated timestamp
   - Quick action buttons (edit, delete)

**Color Coding System:**
```typescript
const teamColors = {
  'engineering': 'from-blue-500 to-blue-600',
  'marketing': 'from-purple-500 to-purple-600', 
  'sales': 'from-green-500 to-green-600',
  'hr': 'from-orange-500 to-orange-600',
  'operations': 'from-gray-500 to-gray-600',
  'default': 'from-primary to-primary/80'
};
```

## 2.3.3 - Plan Connection Line Styling and Types

### Connection Types and Visual Styling

Based on organizational relationship research:

**Connection Types:**
1. **Reports To** (Hierarchical)
   - Solid line with arrow
   - Color: `text-foreground`
   - Arrow style: Filled triangle

2. **Collaborates With** (Peer-to-peer)
   - Dashed line
   - Color: `text-muted-foreground`
   - No arrows (bi-directional)

3. **Supports** (Service relationship)
   - Dotted line with circle markers
   - Color: `text-success`
   - Circle at service provider end

4. **Custom** (User-defined)
   - User-selectable style and color
   - Label support
   - Custom line patterns

**React Flow Edge Styling:**
```css
/* Reports To Connection */
.connection-reports-to .react-flow__edge-path {
  @apply stroke-foreground stroke-2;
  stroke-dasharray: none;
}

/* Collaborates With Connection */
.connection-collaborates .react-flow__edge-path {
  @apply stroke-muted-foreground stroke-2;
  stroke-dasharray: 10 5;
}

/* Supports Connection */
.connection-supports .react-flow__edge-path {
  @apply stroke-success stroke-2;
  stroke-dasharray: 2 3;
}

/* Custom Connection */
.connection-custom .react-flow__edge-path {
  stroke: var(--connection-color, theme('colors.primary'));
  stroke-width: 2;
  stroke-dasharray: var(--connection-pattern, 'none');
}
```

**Edge Components:**
1. **Connection Labels:**
   - Relationship type indicator
   - Optional custom text
   - Background for readability

2. **Interactive Elements:**
   - Click to edit connection
   - Delete button on hover
   - Type change dropdown

3. **Visual Indicators:**
   - Arrow direction for hierarchy
   - Line style for relationship type
   - Color coding for categories

## 2.3.4 - Design Toolbar and Control Interfaces

### Toolbar Component Analysis
From existing modal patterns:

**Current Toolbar Patterns:**
- Tab navigation: `TabsList` with `TabsTrigger` components
- Button groups with consistent spacing
- Icon + text combinations
- Hover states and transitions

### Canvas Toolbar Design

**Toolbar Layout:**
```tsx
<div className="flex items-center justify-between p-4 bg-card border-b border-border">
  {/* Left: Main Controls */}
  <div className="flex items-center space-x-2">
    <Button
      size="sm"
      variant="outline"
      onClick={handleZoomOut}
      disabled={zoomLevel <= 0.1}
    >
      <ZoomOut className="h-4 w-4" />
    </Button>
    
    <span className="text-sm text-muted-foreground px-2">
      {Math.round(zoomLevel * 100)}%
    </span>
    
    <Button
      size="sm"
      variant="outline" 
      onClick={handleZoomIn}
      disabled={zoomLevel >= 2}
    >
      <ZoomIn className="h-4 w-4" />
    </Button>
    
    <Separator orientation="vertical" className="h-6" />
    
    <Button size="sm" variant="outline" onClick={handleFitView}>
      <Maximize className="h-4 w-4 mr-1" />
      Fit View
    </Button>
  </div>
  
  {/* Center: Connection Tools */}
  <div className="flex items-center space-x-2">
    <Select value={connectionType} onValueChange={setConnectionType}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Connection Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="reports_to">Reports To</SelectItem>
        <SelectItem value="collaborates_with">Collaborates</SelectItem>
        <SelectItem value="supports">Supports</SelectItem>
      </SelectContent>
    </Select>
  </div>
  
  {/* Right: Save/Export */}
  <div className="flex items-center space-x-2">
    <Button 
      size="sm" 
      variant="outline"
      onClick={handleReset}
    >
      <RotateCcw className="h-4 w-4 mr-1" />
      Reset
    </Button>
    
    <Button 
      size="sm" 
      onClick={handleSave}
      disabled={saving}
    >
      {saving ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Save className="h-4 w-4 mr-1" />
      )}
      Save Layout
    </Button>
  </div>
</div>
```

### Control Components

**1. Zoom Controls:**
- Zoom out/in buttons with disabled states
- Zoom percentage display
- Fit view for auto-scaling

**2. Connection Tools:**
- Connection type selector dropdown
- Connection creation mode toggle
- Connection editing tools

**3. Layout Controls:**
- Auto-layout algorithms (grid, hierarchy, circular)
- Reset to default positions
- Save current layout

**4. View Options:**
- Grid/canvas mode toggle
- Minimap toggle
- Background pattern selection

### Settings Modal Design

Following existing modal patterns from `EnhancedToolsModal.tsx`:

**Settings Structure:**
```tsx
<Dialog open={showSettings} onOpenChange={setShowSettings}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Canvas Settings</DialogTitle>
      <DialogDescription>
        Customize your team canvas appearance and behavior
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-3">Default Node Style</h4>
        <div className="grid grid-cols-2 gap-2">
          {nodeStyleOptions.map((style) => (
            <Button 
              key={style.id}
              variant={selectedStyle === style.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStyle(style.id)}
            >
              {style.name}
            </Button>
          ))}
        </div>
      </div>
      
      <div>
        <h4 className="font-medium mb-3">Connection Preferences</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={showConnectionLabels}
              onChange={(e) => setShowConnectionLabels(e.target.checked)}
            />
            <span className="text-sm">Show connection labels</span>
          </label>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

## Design System Integration

### Color Palette Usage
From `src/index.css` analysis:

**Primary Colors:**
- Primary: `hsl(221.2 83.2% 53.3%)` - Blue for selection states
- Success: `hsl(142.1 76.2% 36.3%)` - Green for positive connections
- Warning: `hsl(47.9 95.8% 53.1%)` - Amber for caution states
- Destructive: `hsl(0 84.2% 60.2%)` - Red for deletion/negative

**Background System:**
- Card: `hsl(0 0% 100%)` - White node backgrounds
- Accent: `hsl(210 40% 96%)` - Light hover states
- Border: `hsl(214.3 31.8% 91.4%)` - Subtle borders

### Typography Hierarchy
- Node titles: `text-lg font-semibold`
- Node descriptions: `text-sm text-muted-foreground`
- Connection labels: `text-xs`
- Toolbar text: `text-sm`

### Interactive States
- Hover: Subtle color shifts and shadow increases
- Selected: Border color change and slight scale
- Focus: Ring outline for accessibility
- Disabled: Opacity reduction and pointer events disabled
