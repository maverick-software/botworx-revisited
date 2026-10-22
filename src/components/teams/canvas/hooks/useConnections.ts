import { useState, useCallback, useMemo } from 'react';
import type { Team } from '@/types';
import type {
  TeamConnection,
  ConnectionType,
  UseConnectionsOptions,
  ConnectionValidationError
} from '../types/canvas';
import { generateConnectionId } from '../utils/canvasUtils';

// Helper function to build connection graph for cycle detection
function buildConnectionGraph(connections: TeamConnection[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  connections.forEach(connection => {
    if (!graph.has(connection.fromTeamId)) {
      graph.set(connection.fromTeamId, new Set());
    }
    graph.get(connection.fromTeamId)!.add(connection.toTeamId);
  });
  
  return graph;
}

// Helper function to update connection graph
function updateConnectionGraph(
  graph: Map<string, Set<string>>, 
  connection: TeamConnection, 
  operation: 'add' | 'remove'
): Map<string, Set<string>> {
  const newGraph = new Map(graph);
  
  if (operation === 'add') {
    if (!newGraph.has(connection.fromTeamId)) {
      newGraph.set(connection.fromTeamId, new Set());
    }
    newGraph.get(connection.fromTeamId)!.add(connection.toTeamId);
  } else {
    const connections = newGraph.get(connection.fromTeamId);
    if (connections) {
      connections.delete(connection.toTeamId);
      if (connections.size === 0) {
        newGraph.delete(connection.fromTeamId);
      }
    }
  }
  
  return newGraph;
}

// Cycle detection using DFS
function wouldCreateCycle(
  graph: Map<string, Set<string>>,
  fromTeamId: string,
  toTeamId: string
): boolean {
  // Check if adding fromTeamId -> toTeamId would create a cycle
  // This means checking if there's already a path from toTeamId to fromTeamId
  
  const visited = new Set<string>();
  
  function dfs(nodeId: string): boolean {
    if (nodeId === fromTeamId) return true;
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    const neighbors = graph.get(nodeId) || new Set();
    
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }
    
    return false;
  }
  
  return dfs(toTeamId);
}

// Build hierarchy tree from connections
function buildHierarchyTree(
  connections: TeamConnection[],
  rootTeamId?: string
): any {
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  
  connections.forEach(connection => {
    if (!childrenMap.has(connection.toTeamId)) {
      childrenMap.set(connection.toTeamId, []);
    }
    childrenMap.get(connection.toTeamId)!.push(connection.fromTeamId);
    parentMap.set(connection.fromTeamId, connection.toTeamId);
  });
  
  function buildTree(nodeId: string): any {
    const children = childrenMap.get(nodeId) || [];
    return {
      id: nodeId,
      children: children.map(childId => buildTree(childId))
    };
  }
  
  if (rootTeamId) {
    return buildTree(rootTeamId);
  }
  
  // Find all root nodes (no parents) and build forest
  const allNodes = new Set([
    ...connections.map(c => c.fromTeamId),
    ...connections.map(c => c.toTeamId)
  ]);
  
  const roots = Array.from(allNodes).filter(nodeId => !parentMap.has(nodeId));
  
  return roots.map(rootId => buildTree(rootId));
}

export function useConnections(
  teams: Team[],
  initialConnections: TeamConnection[] = [],
  options: UseConnectionsOptions = {}
) {
  const {
    validateConnections = true,
    preventCycles = true,
    maxConnectionsPerTeam = 10,
    batchUpdates = true,
    debounceMs = 300,
    onConnectionCreated,
    onConnectionDeleted,
    onValidationError
  } = options;

  const [connections, setConnections] = useState<TeamConnection[]>(initialConnections);
  const [connectionGraph, setConnectionGraph] = useState<Map<string, Set<string>>>(() => 
    buildConnectionGraph(initialConnections)
  );

  // Memoized team IDs for validation
  const teamIds = useMemo(() => new Set(teams.map(team => team.id)), [teams]);

  // Connection validation
  const validateConnection = useCallback((
    fromTeamId: string,
    toTeamId: string,
    type: ConnectionType
  ): ConnectionValidationError | null => {
    if (!validateConnections) return null;
    
    // Check if teams exist
    if (!teamIds.has(fromTeamId) || !teamIds.has(toTeamId)) {
      return {
        type: 'self_reference', // Using closest error type
        message: 'One or both teams do not exist',
        connection: { fromTeamId, toTeamId, type }
      };
    }
    
    // Self-reference check
    if (fromTeamId === toTeamId) {
      return {
        type: 'self_reference',
        message: 'Teams cannot connect to themselves',
        connection: { fromTeamId, toTeamId, type }
      };
    }
    
    // Duplicate check
    const isDuplicate = connections.some(conn => 
      conn.fromTeamId === fromTeamId && 
      conn.toTeamId === toTeamId &&
      conn.type === type
    );
    
    if (isDuplicate) {
      return {
        type: 'duplicate',
        message: 'Connection already exists between these teams',
        connection: { fromTeamId, toTeamId, type }
      };
    }
    
    // Max connections check
    const fromConnections = connections.filter(conn => 
      conn.fromTeamId === fromTeamId || conn.toTeamId === fromTeamId
    ).length;
    
    if (fromConnections >= maxConnectionsPerTeam) {
      return {
        type: 'max_connections',
        message: `Team can have maximum ${maxConnectionsPerTeam} connections`,
        connection: { fromTeamId, toTeamId, type }
      };
    }
    
    // Cycle detection for hierarchical connections
    if (preventCycles && type === 'reports_to') {
      if (wouldCreateCycle(connectionGraph, fromTeamId, toTeamId)) {
        return {
          type: 'cycle',
          message: 'This connection would create a circular reporting structure',
          connection: { fromTeamId, toTeamId, type }
        };
      }
    }
    
    return null;
  }, [connections, connectionGraph, validateConnections, preventCycles, maxConnectionsPerTeam, teamIds]);

  // Add connection
  const addConnection = useCallback((
    fromTeamId: string,
    toTeamId: string,
    type: ConnectionType,
    options: { label?: string; color?: string; style?: string } = {}
  ) => {
    const validationError = validateConnection(fromTeamId, toTeamId, type);
    
    if (validationError) {
      if (onValidationError) onValidationError(validationError);
      return null;
    }
    
    const newConnection: TeamConnection = {
      id: generateConnectionId(),
      fromTeamId,
      toTeamId,
      type,
      ...options,
      createdAt: new Date().toISOString()
    };
    
    setConnections(prev => [...prev, newConnection]);
    setConnectionGraph(prev => updateConnectionGraph(prev, newConnection, 'add'));
    
    if (onConnectionCreated) onConnectionCreated(newConnection);
    
    return newConnection;
  }, [validateConnection, onValidationError, onConnectionCreated]);

  // Remove connection
  const removeConnection = useCallback((connectionId: string) => {
    const connection = connections.find(conn => conn.id === connectionId);
    if (!connection) return false;
    
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    setConnectionGraph(prev => updateConnectionGraph(prev, connection, 'remove'));
    
    if (onConnectionDeleted) onConnectionDeleted(connectionId);
    
    return true;
  }, [connections, onConnectionDeleted]);

  // Update connection
  const updateConnection = useCallback((
    connectionId: string, 
    updates: Partial<TeamConnection>
  ) => {
    setConnections(prev => prev.map(conn => 
      conn.id === connectionId 
        ? { ...conn, ...updates, updatedAt: new Date().toISOString() }
        : conn
    ));
    
    return true;
  }, []);

  // Get connections for team
  const getTeamConnections = useCallback((teamId: string) => {
    return connections.filter(conn => 
      conn.fromTeamId === teamId || conn.toTeamId === teamId
    );
  }, [connections]);

  // Get hierarchical structure
  const getHierarchy = useCallback((rootTeamId?: string) => {
    const hierarchicalConnections = connections.filter(conn => 
      conn.type === 'reports_to'
    );
    
    return buildHierarchyTree(hierarchicalConnections, rootTeamId);
  }, [connections]);

  // Bulk operations
  const addMultipleConnections = useCallback((
    connectionRequests: Array<{
      fromTeamId: string;
      toTeamId: string;
      type: ConnectionType;
      options?: any;
    }>
  ) => {
    const validConnections: TeamConnection[] = [];
    const errors: ConnectionValidationError[] = [];
    
    connectionRequests.forEach(request => {
      const error = validateConnection(
        request.fromTeamId,
        request.toTeamId,
        request.type
      );
      
      if (error) {
        errors.push(error);
      } else {
        validConnections.push({
          id: generateConnectionId(),
          ...request,
          ...request.options,
          createdAt: new Date().toISOString()
        });
      }
    });
    
    if (validConnections.length > 0) {
      setConnections(prev => [...prev, ...validConnections]);
      setConnectionGraph(prev => 
        validConnections.reduce((graph, conn) => 
          updateConnectionGraph(graph, conn, 'add'), prev
        )
      );
    }
    
    return { created: validConnections, errors };
  }, [validateConnection]);

  // Connection statistics
  const connectionStats = useMemo(() => {
    const stats = {
      total: connections.length,
      byType: {} as Record<ConnectionType, number>,
      mostConnectedTeam: null as { teamId: string; count: number } | null
    };
    
    // Count by type
    connections.forEach(conn => {
      stats.byType[conn.type] = (stats.byType[conn.type] || 0) + 1;
    });
    
    // Find most connected team
    const teamConnectionCounts = new Map<string, number>();
    connections.forEach(conn => {
      teamConnectionCounts.set(
        conn.fromTeamId, 
        (teamConnectionCounts.get(conn.fromTeamId) || 0) + 1
      );
      teamConnectionCounts.set(
        conn.toTeamId, 
        (teamConnectionCounts.get(conn.toTeamId) || 0) + 1
      );
    });
    
    let maxCount = 0;
    let mostConnectedTeamId = null;
    teamConnectionCounts.forEach((count, teamId) => {
      if (count > maxCount) {
        maxCount = count;
        mostConnectedTeamId = teamId;
      }
    });
    
    if (mostConnectedTeamId) {
      stats.mostConnectedTeam = {
        teamId: mostConnectedTeamId,
        count: maxCount
      };
    }
    
    return stats;
  }, [connections]);

  return {
    // State
    connections,
    connectionGraph,
    
    // Operations
    addConnection,
    removeConnection,
    updateConnection,
    addMultipleConnections,
    
    // Queries
    getTeamConnections,
    getHierarchy,
    
    // Validation
    validateConnection,
    
    // Utilities
    connectionCount: connections.length,
    connectionStats,
    hasConnectionBetween: useCallback((teamA: string, teamB: string) => 
      connections.some(conn => 
        (conn.fromTeamId === teamA && conn.toTeamId === teamB) ||
        (conn.fromTeamId === teamB && conn.toTeamId === teamA)
      ), [connections]
    ),
    
    // Debug helpers
    getConnectionGraph: () => connectionGraph,
    debugConnections: () => ({
      connections,
      graph: Object.fromEntries(connectionGraph),
      stats: connectionStats
    })
  };
}
