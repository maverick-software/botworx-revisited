# Canvas Library Analysis & Technology Selection

**Research Date:** August 28, 2025  
**Purpose:** Evaluate canvas libraries for implementing visual team hierarchy canvas

## Library Options Comparison

### React Flow (Recommended)
**Website:** https://reactflow.dev/  
**GitHub:** https://github.com/wbkd/react-flow

**Pros:**
- Built specifically for React
- Excellent TypeScript support
- Built-in drag & drop functionality
- Node-based interface perfect for team hierarchies
- Built-in connection/edge system between nodes
- Minimap, zoom, and pan controls included
- Extensible node types
- Strong documentation and community
- Performance optimized for large diagrams

**Cons:**
- Learning curve for advanced customization
- Bundle size consideration

**Perfect for:** Team hierarchy visualization with connections

### Konva.js + React-Konva
**Website:** https://konvajs.org/  
**React Wrapper:** https://github.com/konvajs/react-konva

**Pros:**
- Powerful 2D canvas library
- High performance rendering
- Advanced graphics capabilities
- Fine-grained control over drawing
- Good for custom visual elements

**Cons:**
- More low-level - requires building connection logic from scratch
- No built-in drag-and-drop for complex scenarios
- Steeper learning curve
- Overkill for basic node/connection diagrams

**Best for:** Custom graphics-heavy applications

### React DnD + Custom Canvas
**Website:** https://react-dnd.github.io/react-dnd/

**Pros:**
- Excellent drag-and-drop capabilities
- Highly customizable
- Works with any rendering approach

**Cons:**
- No built-in canvas/node system
- Would need to build connection system from scratch
- More development overhead

**Best for:** Custom drag-and-drop interactions

## Recommended Solution: React Flow

### Why React Flow is Ideal:
1. **Purpose-Built**: Designed exactly for node-based diagrams like org charts
2. **Team Nodes**: Each team becomes a custom node with team information
3. **Connections**: Built-in edge system for showing team relationships
4. **Interaction**: Drag-and-drop, zoom, pan out of the box
5. **Integration**: Easy to integrate with React/TypeScript codebase
6. **Theming**: Supports custom styling to match Agentopia's design system

### Implementation Architecture with React Flow:

```typescript
// Custom Team Node Component
interface TeamNodeData {
  teamId: string;
  name: string;
  description: string;
  memberCount: number;
  agentNames: string[];
}

// Node Types
const nodeTypes = {
  teamNode: CustomTeamNode,
};

// Example Usage
<ReactFlow
  nodes={teamNodes}
  edges={teamConnections}
  nodeTypes={nodeTypes}
  onNodesChange={handleNodesChange}
  onEdgesChange={handleEdgesChange}
  onConnect={handleConnect}
  fitView
>
  <Background />
  <Controls />
  <MiniMap />
</ReactFlow>
```

### Canvas Features to Implement:
1. **Team Nodes**: Custom styled cards showing team info
2. **Drag & Drop**: Move teams around canvas
3. **Connections**: Draw lines between related teams
4. **Zoom/Pan**: Navigate large organizational structures
5. **Minimap**: Overview of entire structure
6. **Persist Layout**: Save positions and connections to database

## Package Requirements:
```json
{
  "dependencies": {
    "reactflow": "^11.x",
    "@types/reactflow": "^11.x"
  }
}
```

## Alignment with Agentopia Design System:
- Custom CSS classes for team nodes using existing Tailwind/CSS variables
- Dark/light mode support through CSS custom properties
- Consistent with existing card design patterns
- Shadcn UI components for controls and modals
