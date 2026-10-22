// Canvas Utility Functions
// Handles conversion between data structures and React Flow formats

import type { Node, Edge } from 'reactflow';
import type { Team, TeamMember } from '@/types';
import type {
  TeamPosition,
  TeamConnection,
  TeamNodeData,
  ConnectionEdgeData,
  CanvasLayout,
  ViewSettings,
  Bounds,
  ConnectionType
} from '../types/canvas';

// Generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function generateConnectionId(): string {
  return `connection_${generateId()}`;
}

export function generateLayoutId(): string {
  return `layout_${generateId()}`;
}

// Convert teams to React Flow nodes
export function teamsToNodes(
  teams: Team[],
  teamMembers: Map<string, TeamMember[]>,
  positions: Map<string, TeamPosition>,
  handlers: {

    selectedTeams: Set<string>;
    onTeamClick: (teamId: string) => void;
    onTeamEdit: (teamId: string) => void;
    onTeamDelete: (teamId: string) => void;
    onConnectionStart: (teamId: string, handle: string) => void;
  }
): Node<TeamNodeData>[] {
  return teams.map((team, index) => {
    const position = positions.get(team.id) || {
      teamId: team.id,
      x: (index % 3) * 320 + 50, // Default grid layout
      y: Math.floor(index / 3) * 200 + 50
    };
    
    const members = teamMembers.get(team.id) || [];
    const agentNames = members.map(member => `Agent ${member.agent_id.slice(0, 8)}`);
    
    return {
      id: team.id,
      type: 'teamNode',
      position: { x: position.x, y: position.y },
      connectable: true,
      data: {
        team,
        memberCount: members.length,
        agentNames,
        teamType: inferTeamType(team.name),
        lastActivity: team.updated_at,
        isSelected: handlers.selectedTeams.has(team.id),
        
        // Canvas state

        
        // Callbacks
        onTeamClick: handlers.onTeamClick,
        onTeamEdit: handlers.onTeamEdit,
        onTeamDelete: handlers.onTeamDelete,
        onConnectionStart: handlers.onConnectionStart
      },
      selected: handlers.selectedTeams.has(team.id),
      draggable: true,
      selectable: true,
      deletable: true,
    };
  });
}

// Convert connections to React Flow edges
export function connectionsToEdges(
  connections: TeamConnection[],
  teams: Team[],
  handlers: {
    selectedConnections: Set<string>;
    onEdgeClick: (edgeId: string) => void;
    onEdgeDelete: (edgeId: string) => void;
    onEdgeEdit: (edgeId: string) => void;
  }
): Edge<ConnectionEdgeData>[] {
  const teamsMap = new Map(teams.map(team => [team.id, team]));
  
  // Filter out invalid connections before mapping
  const validConnections = connections.filter(connection => {
    // Source handles should not end with '-target' (except for valid targets like 'left-target')
    const isValidHandle = !connection.sourceHandle?.endsWith('-target') || 
                         connection.sourceHandle === 'left-target' || 
                         connection.sourceHandle === 'right-target';
    
    if (!isValidHandle) {
      console.warn(`⚠️ Skipping invalid connection ${connection.id} with sourceHandle: ${connection.sourceHandle}`);
    }
    
    return isValidHandle;
  });
  
  return validConnections.map(connection => {
    const fromTeam = teamsMap.get(connection.fromTeamId);
    const toTeam = teamsMap.get(connection.toTeamId);
    
    if (!fromTeam || !toTeam) {
      console.warn(`Missing team for connection: ${connection.fromTeamId} -> ${connection.toTeamId}`);
      return null;
    }
    
    const edgeId = connection.id || generateConnectionId();
    
    return {
      id: edgeId,
      source: connection.fromTeamId,
      target: connection.toTeamId,
      sourceHandle: connection.sourceHandle || null,
      targetHandle: connection.targetHandle || null,
      type: 'teamConnection',
      data: {
        connection,
        fromTeam,
        toTeam,
        isSelected: handlers.selectedConnections.has(edgeId),
        
        // Callbacks
        onEdgeClick: handlers.onEdgeClick,
        onEdgeDelete: handlers.onEdgeDelete,
        onEdgeEdit: handlers.onEdgeEdit
      },
      selected: handlers.selectedConnections.has(edgeId),
      deletable: true,
      style: getConnectionStyle(connection),
      markerEnd: getConnectionMarker(connection.type),
      label: connection.label,
    };
  }).filter(Boolean) as Edge<ConnectionEdgeData>[];
}

// Generate default layout for teams
export function generateDefaultLayout(teams: Team[]): {
  teamPositions: Map<string, TeamPosition>;
  connections: TeamConnection[];
} {
  const teamPositions = new Map<string, TeamPosition>();
  
  // Create a simple grid layout
  teams.forEach((team, index) => {
    const cols = Math.ceil(Math.sqrt(teams.length));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    teamPositions.set(team.id, {
      teamId: team.id,
      x: col * 320 + 50,
      y: row * 200 + 50,
      createdAt: new Date().toISOString()
    });
  });
  
  return {
    teamPositions,
    connections: []
  };
}

// Calculate canvas bounds from positions
export function calculateCanvasBounds(positions: Map<string, TeamPosition>): Bounds {
  if (positions.size === 0) {
    return { x: 0, y: 0, width: 800, height: 600 };
  }
  
  const positionsArray = Array.from(positions.values());
  const minX = Math.min(...positionsArray.map(p => p.x)) - 50;
  const minY = Math.min(...positionsArray.map(p => p.y)) - 50;
  const maxX = Math.max(...positionsArray.map(p => p.x + (p.width || 280))) + 50;
  const maxY = Math.max(...positionsArray.map(p => p.y + (p.height || 120))) + 50;
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Calculate fit viewport for given bounds
export function calculateFitViewport(
  bounds: Bounds,
  containerWidth: number = 800,
  containerHeight: number = 600,
  padding: number = 50
): { zoom: number; centerX: number; centerY: number } {
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  
  const scaleX = availableWidth / bounds.width;
  const scaleY = availableHeight / bounds.height;
  const zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
  
  const centerX = (containerWidth - bounds.width * zoom) / 2 - bounds.x * zoom;
  const centerY = (containerHeight - bounds.height * zoom) / 2 - bounds.y * zoom;
  
  return { zoom, centerX, centerY };
}

// Convert canvas state to layout for storage
export function canvasStateToLayout(canvasState: any): CanvasLayout {
  return {
    userId: canvasState.userId || '',
    workspaceId: canvasState.workspaceId,
    positions: Array.from(canvasState.teamPositions.values()),
    connections: canvasState.connections,
    viewSettings: {
      zoom: canvasState.zoom,
      centerX: canvasState.centerX,
      centerY: canvasState.centerY
    },
    updatedAt: new Date().toISOString()
  };
}

// Convert layout back to canvas state maps
export function layoutToCanvasState(layout: CanvasLayout) {
  const teamPositions = new Map<string, TeamPosition>();
  layout.positions.forEach(position => {
    teamPositions.set(position.teamId, position);
  });
  
  return {
    teamPositions,
    connections: layout.connections,
    viewSettings: layout.viewSettings
  };
}

// Get connection styling based on type
function getConnectionStyle(connection: TeamConnection): React.CSSProperties {
  const baseStyles = {
    reports_to: {
      stroke: 'hsl(var(--foreground))',
      strokeWidth: 2,
      strokeDasharray: 'none',
    },
    collaborates_with: {
      stroke: 'hsl(var(--muted-foreground))',
      strokeWidth: 2,
      strokeDasharray: '10 5',
    },
    supports: {
      stroke: 'hsl(var(--success))',
      strokeWidth: 2,
      strokeDasharray: '2 3',
    },
    custom: {
      stroke: 'hsl(var(--primary))',
      strokeWidth: 2,
      strokeDasharray: 'none',
    }
  };
  
  const style = baseStyles[connection.type];
  
  return {
    ...style,
    stroke: connection.color || style.stroke,
    strokeDasharray: connection.style === 'dashed' ? '10 5' : 
                     connection.style === 'dotted' ? '2 3' : 
                     'none'
  };
}

// Get connection marker based on type
function getConnectionMarker(type: ConnectionType): any {
  switch (type) {
    case 'reports_to':
      return { type: 'arrowclosed', color: 'hsl(var(--foreground))' };
    case 'supports':
      return { type: 'arrow', color: 'hsl(var(--success))' };
    case 'custom':
      return { type: 'arrow', color: 'hsl(var(--primary))' };
    default:
      return undefined;
  }
}

// Infer team type from name (for default styling)
function inferTeamType(teamName: string): string {
  const name = teamName.toLowerCase();
  
  if (name.includes('engineering') || name.includes('dev') || name.includes('tech')) {
    return 'engineering';
  }
  if (name.includes('marketing') || name.includes('growth') || name.includes('content')) {
    return 'marketing';
  }
  if (name.includes('sales') || name.includes('revenue') || name.includes('business')) {
    return 'sales';
  }
  if (name.includes('hr') || name.includes('people') || name.includes('talent')) {
    return 'hr';
  }
  if (name.includes('operations') || name.includes('ops') || name.includes('admin')) {
    return 'operations';
  }
  
  return 'default';
}

// Validate node position
export function validatePosition(position: { x: number; y: number }): boolean {
  return (
    typeof position.x === 'number' && 
    typeof position.y === 'number' &&
    isFinite(position.x) && 
    isFinite(position.y) &&
    position.x >= -10000 && position.x <= 10000 &&
    position.y >= -10000 && position.y <= 10000
  );
}

// Snap position to grid
export function snapToGrid(
  position: { x: number; y: number }, 
  gridSize: number = 20
): { x: number; y: number } {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize
  };
}

// Check if position is within viewport
export function isPositionInViewport(
  position: { x: number; y: number },
  viewport: { x: number; y: number; zoom: number },
  containerSize: { width: number; height: number },
  buffer: number = 100
): boolean {
  const worldPos = {
    x: (position.x * viewport.zoom) + viewport.x,
    y: (position.y * viewport.zoom) + viewport.y
  };
  
  return (
    worldPos.x >= -buffer &&
    worldPos.y >= -buffer &&
    worldPos.x <= containerSize.width + buffer &&
    worldPos.y <= containerSize.height + buffer
  );
}

// Auto-layout algorithms
export interface AutoLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
}

export function generateHierarchicalLayout(
  teams: Team[],
  connections: TeamConnection[],
  options: AutoLayoutOptions
): Map<string, TeamPosition> {
  const positions = new Map<string, TeamPosition>();
  
  // Build hierarchy graph
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  
  connections
    .filter(conn => conn.type === 'reports_to')
    .forEach(conn => {
      if (!childrenMap.has(conn.toTeamId)) {
        childrenMap.set(conn.toTeamId, []);
      }
      childrenMap.get(conn.toTeamId)!.push(conn.fromTeamId);
      parentMap.set(conn.fromTeamId, conn.toTeamId);
    });
  
  // Find root nodes (no parents)
  const roots = teams.filter(team => !parentMap.has(team.id));
  
  if (roots.length === 0 && teams.length > 0) {
    // No clear hierarchy, use first team as root
    roots.push(teams[0]);
  }
  
  // Layout each tree
  let currentX = 0;
  roots.forEach(root => {
    const treeWidth = layoutTree(
      root.id,
      currentX,
      0,
      childrenMap,
      positions,
      options
    );
    currentX += treeWidth + options.horizontalSpacing * 2;
  });
  
  return positions;
}

function layoutTree(
  nodeId: string,
  x: number,
  y: number,
  childrenMap: Map<string, string[]>,
  positions: Map<string, TeamPosition>,
  options: AutoLayoutOptions
): number {
  positions.set(nodeId, {
    teamId: nodeId,
    x,
    y,
    createdAt: new Date().toISOString()
  });
  
  const children = childrenMap.get(nodeId) || [];
  if (children.length === 0) {
    return options.nodeWidth;
  }
  
  // Layout children
  let totalWidth = 0;
  let childX = x;
  
  children.forEach((childId, index) => {
    const childWidth = layoutTree(
      childId,
      childX,
      y + options.nodeHeight + options.verticalSpacing,
      childrenMap,
      positions,
      options
    );
    
    childX += childWidth + options.horizontalSpacing;
    totalWidth += childWidth + (index < children.length - 1 ? options.horizontalSpacing : 0);
  });
  
  // Center parent over children
  if (totalWidth > options.nodeWidth) {
    const currentPos = positions.get(nodeId)!;
    positions.set(nodeId, {
      ...currentPos,
      x: x + (totalWidth - options.nodeWidth) / 2
    });
  }
  
  return Math.max(options.nodeWidth, totalWidth);
}

// Export all utility functions
export const canvasUtils = {
  generateId,
  generateConnectionId,
  generateLayoutId,
  teamsToNodes,
  connectionsToEdges,
  generateDefaultLayout,
  calculateCanvasBounds,
  calculateFitViewport,
  canvasStateToLayout,
  layoutToCanvasState,
  validatePosition,
  snapToGrid,
  isPositionInViewport,
  generateHierarchicalLayout
};
