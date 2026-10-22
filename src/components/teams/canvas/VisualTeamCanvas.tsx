import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Connection,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { 
  Network, 
  Grid, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Save, 
  RotateCcw, 
  Settings,
  Loader2 
} from 'lucide-react';

// Import our custom components (to be created)
import { TeamNode } from './TeamNode';
import { TeamConnectionEdge } from './TeamConnectionEdge';
import { CanvasToolbar } from './CanvasToolbar';

// Import types
import type {
  VisualTeamCanvasProps,
  TeamNodeData,
  ConnectionEdgeData,
  ViewMode,
  ConnectionType,
  TeamPosition,
  TeamConnection,
  CanvasLayout
} from './types/canvas';

// Import hooks (to be created)
import { useCanvasState } from './hooks/useCanvasState';
import { useTeamOperations } from './hooks/useTeamOperations';
import { useConnections } from './hooks/useConnections';
import { useLayoutPersistence } from './hooks/useLayoutPersistence';

// Import utilities (to be created)
import { 
  teamsToNodes, 
  connectionsToEdges, 
  generateDefaultLayout,
  calculateCanvasBounds 
} from './utils/canvasUtils';

// Custom node and edge types
const nodeTypes: NodeTypes = {
  teamNode: TeamNode as any,
};

const edgeTypes: EdgeTypes = {
  teamConnection: TeamConnectionEdge as any,
};

// Canvas content component (requires ReactFlow context)
const CanvasContent: React.FC<VisualTeamCanvasProps> = ({
  isOpen,
  onClose,
  teams,
  teamMembers,
  workspaceId,
  userId,
  initialLayout,
  onTeamCreate,
  onTeamUpdate,
  onTeamDelete,
  onLayoutSave,
  onConnectionCreate,
  onConnectionDelete,
  readonly = false,
  showToolbar = true,
  defaultViewMode = 'canvas',
  className
}) => {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [isSaving, setIsSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [zoom, setZoom] = useState(0.6);
  
  // Canvas state hook - Don't pass initialLayout to prevent default positioning
  const canvasState = useCanvasState(teams, undefined, {
    enableAutoSave: false, // We'll handle saving manually
    autoSaveInterval: 5000,
    debounceMs: 1000,
    onError: (error) => {
      console.error('Canvas state error:', error);
      toast.error('Canvas error: ' + error.message);
    }
  });
  
  // Team operations
  const teamOps = useTeamOperations(workspaceId || '', {
    onTeamCreated: onTeamCreate,
    onTeamUpdated: onTeamUpdate,
    onTeamDeleted: onTeamDelete,
    onError: (error, operation) => {
      console.error(`Team ${operation} error:`, error);
      toast.error(`Failed to ${operation} team: ${error.message}`);
    }
  });
  
  // Connection management - sync with canvas state
  const connections = useConnections(teams, canvasState.canvasState.connections, {
    validateConnections: true,
    preventCycles: true,
    onConnectionCreated: onConnectionCreate,
    onConnectionDeleted: onConnectionDelete,
    onValidationError: (error) => {
      toast.error(error.message);
    }
  });

  // Sync connections with canvas state when they change
  useEffect(() => {
    // Update connections hook when canvas state connections change
    if (canvasState.canvasState.connections.length !== connections.connections.length) {
      // Log for debugging if needed
    }
  }, [canvasState.canvasState.connections, connections.connections]);
  
  // Layout persistence
  const persistence = useLayoutPersistence(userId, workspaceId || '', {
    storageType: 'both',
    enableAutoSave: !readonly,
    onSaveSuccess: () => toast.success('Layout saved successfully'),
    onSaveError: (error) => toast.error('Failed to save layout: ' + error.message),
    onLoadSuccess: (layout) => {
      console.log('Loaded canvas layout:', layout);
      // This callback will be called after loadLayout() completes
      // The actual state loading is handled in the useEffect below
    }
  });

  // State to track if we've loaded the initial data
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  // Reset the loaded flag when modal closes so it can reload on next open
  useEffect(() => {
    if (!isOpen) {
      setHasLoadedInitialData(false);
    }
  }, [isOpen]);

  // CRITICAL: Load database state on mount - ONCE and properly
  useEffect(() => {
    if (readonly || !userId || hasLoadedInitialData) return;
    
    const loadData = async () => {
      try {
        console.log('🔄 Loading canvas layout from database...');
        const savedLayout = await persistence.loadLayout();
        
        if (savedLayout) {
          console.log('✅ Found saved layout:', {
            positions: savedLayout.positions?.length || 0,
            connections: savedLayout.connections?.length || 0,
            viewSettings: savedLayout.viewSettings
          });
          
          // CRITICAL: Load positions first - even if empty array, this means we have a saved layout
          if (savedLayout.positions && savedLayout.positions.length > 0) {
            console.log('✅ Loading saved positions:', savedLayout.positions.length);
            savedLayout.positions.forEach(pos => {
              canvasState.updateTeamPosition(pos.teamId, { x: pos.x, y: pos.y });
            });
          }
          
          // Load connections
          if (savedLayout.connections?.length > 0) {
            console.log('✅ Loading connections:', savedLayout.connections.length);
            // Clear existing connections first
            const currentConnections = [...canvasState.canvasState.connections];
            currentConnections.forEach(conn => canvasState.removeConnection(conn.id));
            
            // Filter and add loaded connections (filter out invalid ones)
            const validConnections = savedLayout.connections.filter(conn => {
              // Validate handles - source handles should not end with '-target'
              const isValid = !conn.sourceHandle?.endsWith('-target');
              if (!isValid) {
                console.warn(`Skipping invalid connection from ${conn.fromTeamId} to ${conn.toTeamId} with sourceHandle: ${conn.sourceHandle}`);
              }
              return isValid;
            });
            
            validConnections.forEach((conn) => {
              canvasState.addConnection({
                fromTeamId: conn.fromTeamId,
                toTeamId: conn.toTeamId,
                type: conn.type,
                createdAt: conn.createdAt,
                sourceHandle: conn.sourceHandle || 'right',
                targetHandle: conn.targetHandle || 'left-target'
              });
            });
          }
          
          // Load view settings
          if (savedLayout.viewSettings) {
            setZoom(savedLayout.viewSettings.zoom || 0.6);
          }
          
          // Mark as not having unsaved changes since we just loaded
          canvasState.markSaved();
          
          // Don't add missing positions if we loaded a saved layout
          console.log('✅ Layout loaded from database - skipping default positions');
          
        } else {
          console.log('🎯 No saved layout found, generating default positions');
          // Only add default positions if no saved layout exists
          canvasState.addMissingTeamPositions(teams);
        }
        
        setHasLoadedInitialData(true);
        
      } catch (error) {
        console.error('Failed to load canvas data:', error);
        toast.error('Failed to load canvas layout');
        setHasLoadedInitialData(true);
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readonly, userId, hasLoadedInitialData, persistence]);
  
  // Handle connection start (must be defined before nodes useMemo)
  const handleConnectionStart = useCallback((teamId: string, handle: string) => {
    if (readonly) return;
    // Connection start is handled automatically by React Flow
  }, [readonly]);
  
  // Handle connection deletion (must be defined before edges useMemo)
  // Removed - now inline to prevent infinite renders

  // Handle view mode change with guard to prevent unnecessary updates
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (mode !== viewMode) {
      setViewMode(mode);
    }
  }, [viewMode]);
  
  // Stabilize callbacks to prevent infinite re-renders
  const stableCallbacks = useMemo(() => ({
    onTeamClick: (teamId: string) => {
      const newSelection = new Set([teamId]);
      canvasState.selectTeams(Array.from(newSelection));
    },
    onTeamEdit: onTeamUpdate || (() => {}),
    onTeamDelete: onTeamDelete || (() => {}),
    onConnectionStart: handleConnectionStart
  }), [canvasState.selectTeams, onTeamUpdate, onTeamDelete, handleConnectionStart]);

  // Convert teams to React Flow nodes - stabilize to prevent flickering
  const nodes = useMemo<Node<TeamNodeData>[]>(() => {
    return teamsToNodes(
      teams, 
      teamMembers,
      canvasState.canvasState.teamPositions,
      {
        selectedTeams: canvasState.canvasState.selectedTeams,
        ...stableCallbacks
      }
    );
  }, [
    teams, 
    teamMembers,
    canvasState.canvasState.teamPositions,
    canvasState.canvasState.selectedTeams,
    stableCallbacks
  ]);
  
  // Handle edge clicks for connection type editing
  const handleEdgeClick = useCallback((event: any, edge: Edge) => {
    if (readonly) return;
    // Edge editing is now handled inline by the edge component
  }, [readonly]);

  // Convert connections to React Flow edges - stabilize to prevent flickering
  const edges = useMemo<Edge<ConnectionEdgeData>[]>(() => {
    const generatedEdges = connectionsToEdges(
      canvasState.canvasState.connections,
      teams,
      {
        selectedConnections: canvasState.canvasState.selectedConnections,
        onEdgeClick: () => {
          // Edge clicks are handled by the edge component now
        },
        onEdgeDelete: (connectionId: string) => {
          if (readonly) return;
          const removed = connections.removeConnection(connectionId);
          if (removed) {
            canvasState.removeConnection(connectionId);
            toast.success('Connection removed');
          }
        },
        onEdgeEdit: (connectionId: string, newType: ConnectionType) => {
          if (readonly) return;
          canvasState.updateConnection(connectionId, { type: newType });
          toast.success(`Connection updated to: ${newType.replace('_', ' ')}`);
        }
      }
    );
    return generatedEdges;
  }, [
    canvasState.canvasState.connections,
    canvasState.canvasState.selectedConnections,
    teams,
    readonly
  ]);
  
  // React Flow state management
  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);
  
  // Sync our nodes/edges with React Flow state
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);
  
  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  // Handle node changes (including dragging) - combine React Flow updates with our state management
  const handleNodesChange = useCallback(async (changes: any[]) => {
    // First, let React Flow handle the changes
    onNodesChange(changes);
    
    // Then, handle our custom logic for position updates
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.dragging === false
    );
    
    if (positionChanges.length > 0) {
      console.log('📍 Position changes detected:', positionChanges);
      
      // Update positions from the current React Flow nodes state, not from change.position
      positionChanges.forEach(change => {
        // Get the current node from React Flow to ensure we have the latest position
        const node = flowNodes.find(n => n.id === change.id);
        if (node && node.position) {
          console.log(`📍 Updating position for ${change.id}:`, node.position);
          canvasState.updateTeamPosition(change.id, node.position);
        }
      });
      
      // Trigger immediate autosave after position changes
      if (!readonly && reactFlowInstance) {
        setTimeout(async () => {
          try {
            setIsSaving(true);
            const viewport = reactFlowInstance.getViewport();
            const positions = Array.from(canvasState.canvasState.teamPositions.values());
            console.log('💾 Saving positions:', positions.length, 'positions');
            const layout = {
              userId,
              workspaceId,
              positions,
              connections: canvasState.canvasState.connections,
              viewSettings: {
                zoom: viewport.zoom,
                centerX: viewport.x,
                centerY: viewport.y
              }
            };
            await persistence.saveLayout(layout);
            canvasState.markSaved();
            console.log('✅ Position changes auto-saved');
          } catch (error) {
            console.error('Failed to auto-save position changes:', error);
          } finally {
            setIsSaving(false);
          }
        }, 1500); // Wait 1.5 seconds after drag ends
      }
    }
  }, [onNodesChange, canvasState, readonly, reactFlowInstance, userId, workspaceId, persistence, flowNodes]);

  // Handle edge changes 
  const handleEdgesChange = useCallback((changes: any[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);
  
  // Handle connection creation - always allow connections with default type
  const onConnect = useCallback(async (connection: Connection) => {
    if (readonly) return;
    
    console.log('🔗 Connection attempted:', connection);
    console.log('🔗 Current connections BEFORE adding:', canvasState.canvasState.connections.length);
    
    // Fix sourceHandle if it's invalid (ReactFlow sometimes gives us target handles as source)
    let cleanSourceHandle = connection.sourceHandle || 'right';
    if (cleanSourceHandle.endsWith('-target') && cleanSourceHandle !== 'left-target' && cleanSourceHandle !== 'right-target') {
      // Remove the '-target' suffix to get the correct source handle
      cleanSourceHandle = cleanSourceHandle.replace('-target', '');
      console.warn(`⚠️ Fixed invalid sourceHandle from ReactFlow: ${connection.sourceHandle} -> ${cleanSourceHandle}`);
    }
    
    // Create a simple connection directly (id and createdAt will be generated by addConnection)
    const newConnectionData = {
      fromTeamId: connection.source!,
      toTeamId: connection.target!,
      type: 'collaborates_with' as ConnectionType,
      sourceHandle: cleanSourceHandle,
      targetHandle: connection.targetHandle
    };
    
    console.log('🔗 Adding connection data:', newConnectionData);
    
    // Add to canvas state for persistence
    canvasState.addConnection(newConnectionData);
    
    // Trigger immediate autosave after connection creation
    setTimeout(async () => {
      if (!readonly && reactFlowInstance) {
        try {
          setIsSaving(true);
          const viewport = reactFlowInstance.getViewport();
          const layout = {
            userId,
            workspaceId,
            positions: Array.from(canvasState.canvasState.teamPositions.values()),
            connections: canvasState.canvasState.connections,
            viewSettings: {
              zoom: viewport.zoom,
              centerX: viewport.x,
              centerY: viewport.y
            }
          };
          await persistence.saveLayout(layout);
          canvasState.markSaved();
          console.log('✅ Connection changes auto-saved');
        } catch (error) {
          console.error('Failed to auto-save connection changes:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 1000);
    
    toast.success('Teams connected! Click the connection to change relationship type.');
    
  }, [canvasState, readonly, reactFlowInstance, userId, workspaceId, persistence]);
  
  // Zoom callbacks
  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
      const currentZoom = reactFlowInstance.getZoom();
      setZoom(currentZoom);
    }
  }, [reactFlowInstance]);
  
  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
      const currentZoom = reactFlowInstance.getZoom();
      setZoom(currentZoom);
    }
  }, [reactFlowInstance]);
  
  // Update zoom state when React Flow zoom changes
  const handleMove = useCallback((_event: any, viewport: any) => {
    setZoom(viewport.zoom);
  }, []);
  
  const handleSaveLayout = useCallback(async () => {
    console.log('💾 Save layout triggered');
    if (readonly) return;
    
    setIsSaving(true);
    try {
      const viewport = reactFlowInstance.getViewport();
      const layout: CanvasLayout = {
        userId,
        workspaceId,
        positions: Array.from(canvasState.canvasState.teamPositions.values()),
        connections: canvasState.canvasState.connections,
        viewSettings: {
          zoom: viewport.zoom,
          centerX: viewport.x,
          centerY: viewport.y
        }
      };
      
      console.log('💾 Saving layout data:', {
        userId,
        workspaceId,
        positionsCount: layout.positions.length,
        connectionsCount: layout.connections.length,
        connectionsData: layout.connections,
        positionsData: layout.positions,
        viewSettings: layout.viewSettings
      });
      
      console.log('💾 Calling persistence.saveLayout()...');
      const saveResult = await persistence.saveLayout(layout);
      console.log('💾 Save result:', saveResult);
      
      canvasState.markSaved();
      console.log('✅ Layout saved successfully');
    } catch (error) {
      console.error('💥 Save failed:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    readonly,
    reactFlowInstance,
    canvasState,
    userId,
    workspaceId,
    persistence
  ]);
  
  // Grid view component
  const GridView = () => (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(team => (
          <Card key={team.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Network className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{team.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {team.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {teamMembers.get(team.id)?.length || 0} members
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
  
  // Stabilize React Flow to prevent flickering
  const reactFlowProps = useMemo(() => ({
    nodes: flowNodes,
    edges: flowEdges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect: onConnect,
    onEdgeClick: handleEdgeClick,
    onMove: handleMove,
    nodeTypes: nodeTypes,
    edgeTypes: edgeTypes,
    connectionMode: ConnectionMode.Loose,
    defaultMarkerColor: "#374151",
    fitView: false,
    minZoom: 0.1,
    maxZoom: 4,
    zoomOnScroll: true,
    zoomOnPinch: true,
    zoomOnDoubleClick: true,
    panOnScroll: true,
    preventScrolling: false,
    defaultViewport: { x: 0, y: 0, zoom: 0.6 }, // Smaller initial zoom to make teams appear smaller
    proOptions: { hideAttribution: true },
    attributionPosition: 'bottom-left' as const,
    // Ensure connections are enabled
    connectOnClick: false,
    deleteKeyCode: 'Delete',
    multiSelectionKeyCode: 'Meta',
    snapToGrid: false,
    snapGrid: [15, 15],
  }), [flowNodes, flowEdges, handleNodesChange, handleEdgesChange, onConnect, handleEdgeClick, handleMove, nodeTypes, edgeTypes]);
  
  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      {showToolbar && (
        <CanvasToolbar
          zoom={zoom}
          canZoomIn={zoom < 4}
          canZoomOut={zoom > 0.1}
          viewMode={viewMode}
          connectionMode={null}
          isConnecting={false}
          hasUnsavedChanges={canvasState.hasUnsavedChanges}
          isSaving={isSaving || persistence.isSaving}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={() => {}} // Removed functionality
          onResetLayout={() => {}} // Removed functionality
          onSaveLayout={handleSaveLayout}
          onExportLayout={() => {
            // TODO: Implement export functionality
            toast.info('Export functionality coming soon');
          }}
          onViewModeChange={handleViewModeChange}
          onConnectionModeChange={() => {}} // No longer used
          onShowSettings={() => {
            // TODO: Implement settings modal
            toast.info('Settings modal coming soon');
          }}
          onCreateTeam={onTeamCreate}
          showMinimap={canvasState.canvasState.showMinimap}
          onToggleMinimap={() => {
            // TODO: Add minimap toggle to canvas state
          }}
        />
      )}
      
      <div className="flex-1 h-full relative">
        {/* Keep both views but show/hide to prevent React Flow re-initialization */}
        <div style={{ display: viewMode === 'grid' ? 'block' : 'none', height: '100%' }}>
          <GridView />
        </div>
        {viewMode === 'canvas' && (
          <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}>
            <ReactFlow
              {...reactFlowProps}
              style={{ width: '100%', height: '100%' }}
              onInit={(instance) => {
                setReactFlowInstance(instance);
              }}
            >
              <Background 
                color="#e5e7eb" 
                gap={20} 
                size={1}
                variant="dots"
              />
              {canvasState.canvasState.showMinimap && (
                <MiniMap
                  nodeColor="#3b82f6"
                  nodeStrokeWidth={2}
                  pannable
                  zoomable={false}
                  position="bottom-right"
                />
              )}
            </ReactFlow>
          </div>
        )}


      </div>
    </div>
  );
};

// Main component with ReactFlow provider
export const VisualTeamCanvas: React.FC<VisualTeamCanvasProps> = ({
  isOpen,
  onClose,
  ...props
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
        <VisuallyHidden>
          <DialogTitle>Team Organization Canvas</DialogTitle>
        </VisuallyHidden>
        <div className="h-full overflow-hidden">
          <ReactFlowProvider>
            <CanvasContent {...props} onClose={onClose} isOpen={isOpen} />
          </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};
