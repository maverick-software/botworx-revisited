# Hook Design Research Document

**Research Date:** August 28, 2025  
**WBS Section:** Phase 3 - Design (Items 3.2.1 - 3.2.4)  
**Purpose:** Research custom hook patterns for canvas state management and operations

## 3.2.1 - Design Canvas State Hook

### Current Hook Patterns Analysis
From `useModalState.ts` and other existing hooks:

**Established Hook Patterns:**

**State Management Hook Pattern:**
```tsx
// Pattern from useModalState.ts
interface HookOptions {
  preserveOnHidden?: boolean;
  preserveOnBlur?: boolean;  
  onCleanup?: () => void;
}

export function useHookName<T>(
  initialState: T,
  options: HookOptions = {}
) {
  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef(state);
  
  // Stable callbacks with useCallback
  const updateState = useCallback((newState: T | ((prev: T) => T)) => {
    setState(newState);
  }, []);
  
  return {
    state,
    updateState,
    // ... other stable methods
  };
}
```

**Canvas State Hook Design:**
```tsx
interface CanvasState {
  // View state
  zoom: number;
  centerX: number;
  centerY: number;
  viewMode: 'grid' | 'canvas';
  
  // Team positions
  teamPositions: Map<string, { x: number; y: number }>;
  
  // Connections
  connections: TeamConnection[];
  
  // Selection state
  selectedTeams: Set<string>;
  selectedConnections: Set<string>;
  
  // Interaction state
  isConnecting: boolean;
  connectionMode: ConnectionType | null;
  draggedTeam: string | null;
  
  // Layout state
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  
  // UI state
  showMinimap: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
}

interface CanvasStateOptions {
  // Auto-save configuration
  autoSaveInterval?: number;
  enableAutoSave?: boolean;
  
  // Persistence
  persistToLocalStorage?: boolean;
  storageKey?: string;
  
  // Performance
  batchUpdates?: boolean;
  debounceMs?: number;
  
  // Callbacks
  onLayoutChange?: (layout: CanvasLayout) => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  onError?: (error: Error) => void;
}

export function useCanvasState(
  teams: Team[],
  initialLayout?: CanvasLayout,
  options: CanvasStateOptions = {}
) {
  const {
    autoSaveInterval = 30000, // 30 seconds
    enableAutoSave = true,
    persistToLocalStorage = true,
    storageKey = 'team-canvas-state',
    batchUpdates = true,
    debounceMs = 300,
    onLayoutChange,
    onUnsavedChanges,
    onError
  } = options;

  // Core state
  const [canvasState, setCanvasState] = useState<CanvasState>(() => 
    initializeCanvasState(teams, initialLayout, storageKey, persistToLocalStorage)
  );
  
  // Refs for stable access
  const canvasStateRef = useRef(canvasState);
  const hasUnsavedChangesRef = useRef(false);
  
  // Debounced state updates
  const debouncedSetState = useMemo(
    () => batchUpdates ? 
      debounce((updates: Partial<CanvasState>) => {
        setCanvasState(prev => ({ ...prev, ...updates }));
      }, debounceMs) : 
      (updates: Partial<CanvasState>) => setCanvasState(prev => ({ ...prev, ...updates })),
    [batchUpdates, debounceMs]
  );

  // View state management
  const updateViewport = useCallback((viewport: { zoom: number; centerX: number; centerY: number }) => {
    debouncedSetState({
      zoom: viewport.zoom,
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      hasUnsavedChanges: true
    });
  }, [debouncedSetState]);

  // Team position management
  const updateTeamPosition = useCallback((teamId: string, position: { x: number; y: number }) => {
    const newPositions = new Map(canvasState.teamPositions);
    newPositions.set(teamId, position);
    
    debouncedSetState({
      teamPositions: newPositions,
      hasUnsavedChanges: true
    });
  }, [canvasState.teamPositions, debouncedSetState]);

  // Connection management
  const addConnection = useCallback((connection: Omit<TeamConnection, 'id'>) => {
    const newConnection: TeamConnection = {
      ...connection,
      id: generateConnectionId()
    };
    
    debouncedSetState({
      connections: [...canvasState.connections, newConnection],
      hasUnsavedChanges: true,
      isConnecting: false,
      connectionMode: null
    });
  }, [canvasState.connections, debouncedSetState]);

  const removeConnection = useCallback((connectionId: string) => {
    debouncedSetState({
      connections: canvasState.connections.filter(conn => conn.id !== connectionId),
      hasUnsavedChanges: true
    });
  }, [canvasState.connections, debouncedSetState]);

  // Selection management
  const selectTeams = useCallback((teamIds: string[]) => {
    debouncedSetState({
      selectedTeams: new Set(teamIds)
    });
  }, [debouncedSetState]);

  const clearSelection = useCallback(() => {
    debouncedSetState({
      selectedTeams: new Set(),
      selectedConnections: new Set()
    });
  }, [debouncedSetState]);

  // Layout operations
  const resetLayout = useCallback(() => {
    const resetState = generateDefaultLayout(teams);
    setCanvasState(prev => ({
      ...prev,
      ...resetState,
      hasUnsavedChanges: true
    }));
  }, [teams]);

  const fitView = useCallback(() => {
    const bounds = calculateCanvasBounds(canvasState.teamPositions);
    const { zoom, centerX, centerY } = calculateFitViewport(bounds);
    
    debouncedSetState({
      zoom,
      centerX,
      centerY
    });
  }, [canvasState.teamPositions, debouncedSetState]);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave || !hasUnsavedChangesRef.current) return;
    
    const interval = setInterval(() => {
      if (hasUnsavedChangesRef.current && onLayoutChange) {
        const layout = canvasStateToLayout(canvasStateRef.current);
        onLayoutChange(layout);
      }
    }, autoSaveInterval);
    
    return () => clearInterval(interval);
  }, [enableAutoSave, autoSaveInterval, onLayoutChange]);

  // Local storage persistence
  useEffect(() => {
    if (!persistToLocalStorage) return;
    
    const saveToStorage = debounce(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(canvasState));
      } catch (error) {
        if (onError) onError(error as Error);
      }
    }, 1000);
    
    saveToStorage();
  }, [canvasState, persistToLocalStorage, storageKey, onError]);

  // Sync refs
  useEffect(() => {
    canvasStateRef.current = canvasState;
    hasUnsavedChangesRef.current = canvasState.hasUnsavedChanges;
  }, [canvasState]);

  // Notify about unsaved changes
  useEffect(() => {
    if (onUnsavedChanges) {
      onUnsavedChanges(canvasState.hasUnsavedChanges);
    }
  }, [canvasState.hasUnsavedChanges, onUnsavedChanges]);

  return {
    // State
    canvasState,
    
    // View operations
    updateViewport,
    fitView,
    resetLayout,
    
    // Team operations
    updateTeamPosition,
    
    // Connection operations
    addConnection,
    removeConnection,
    
    // Selection operations
    selectTeams,
    clearSelection,
    
    // Utility
    hasUnsavedChanges: canvasState.hasUnsavedChanges,
    markSaved: () => debouncedSetState({ hasUnsavedChanges: false, lastSavedAt: new Date() })
  };
}
```

## 3.2.2 - Design Team Operations Hook

### Team Operations Hook Pattern
```tsx
interface UseTeamOperationsOptions {
  // Data fetching
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  
  // Optimistic updates
  enableOptimisticUpdates?: boolean;
  rollbackOnError?: boolean;
  
  // Callbacks
  onTeamCreated?: (team: Team) => void;
  onTeamUpdated?: (team: Team) => void;  
  onTeamDeleted?: (teamId: string) => void;
  onError?: (error: Error, operation: string) => void;
}

export function useTeamOperations(
  workspaceId: string,
  options: UseTeamOperationsOptions = {}
) {
  const {
    refetchOnWindowFocus = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    enableOptimisticUpdates = true,
    rollbackOnError = true,
    onTeamCreated,
    onTeamUpdated,
    onTeamDeleted,
    onError
  } = options;

  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Teams query with React Query pattern
  const {
    data: teams = [],
    isLoading,
    error,
    refetch: refetchTeams
  } = useQuery({
    queryKey: ['teams', workspaceId],
    queryFn: () => fetchTeams(supabase, workspaceId),
    staleTime,
    refetchOnWindowFocus,
    enabled: !!workspaceId && !!user
  });

  // Team members query
  const {
    data: teamMembers = new Map(),
    refetch: refetchMembers
  } = useQuery({
    queryKey: ['team-members', workspaceId],
    queryFn: () => fetchTeamMembers(supabase, workspaceId),
    enabled: teams.length > 0
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: (teamData: CreateTeamRequest) => createTeam(supabase, teamData),
    onSuccess: (newTeam) => {
      // Optimistic update
      queryClient.setQueryData(['teams', workspaceId], (old: Team[] = []) => [
        ...old,
        newTeam
      ]);
      
      if (onTeamCreated) onTeamCreated(newTeam);
    },
    onError: (error) => {
      if (onError) onError(error as Error, 'create');
      if (rollbackOnError) {
        queryClient.invalidateQueries(['teams', workspaceId]);
      }
    }
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: ({ teamId, updates }: { teamId: string; updates: Partial<Team> }) =>
      updateTeam(supabase, teamId, updates),
    onMutate: enableOptimisticUpdates ? async ({ teamId, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries(['teams', workspaceId]);
      
      // Snapshot previous value
      const previousTeams = queryClient.getQueryData<Team[]>(['teams', workspaceId]);
      
      // Optimistically update
      if (previousTeams) {
        queryClient.setQueryData(['teams', workspaceId], 
          previousTeams.map(team => 
            team.id === teamId ? { ...team, ...updates } : team
          )
        );
      }
      
      return { previousTeams };
    } : undefined,
    onSuccess: (updatedTeam) => {
      if (onTeamUpdated) onTeamUpdated(updatedTeam);
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (rollbackOnError && context?.previousTeams) {
        queryClient.setQueryData(['teams', workspaceId], context.previousTeams);
      }
      
      if (onError) onError(error as Error, 'update');
    }
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeam(supabase, teamId),
    onMutate: enableOptimisticUpdates ? async (teamId) => {
      await queryClient.cancelQueries(['teams', workspaceId]);
      
      const previousTeams = queryClient.getQueryData<Team[]>(['teams', workspaceId]);
      
      if (previousTeams) {
        queryClient.setQueryData(['teams', workspaceId],
          previousTeams.filter(team => team.id !== teamId)
        );
      }
      
      return { previousTeams };
    } : undefined,
    onSuccess: (_, teamId) => {
      if (onTeamDeleted) onTeamDeleted(teamId);
    },
    onError: (error, teamId, context) => {
      if (rollbackOnError && context?.previousTeams) {
        queryClient.setQueryData(['teams', workspaceId], context.previousTeams);
      }
      
      if (onError) onError(error as Error, 'delete');
    }
  });

  // Stable operation functions
  const createTeam = useCallback((teamData: CreateTeamRequest) => {
    return createTeamMutation.mutateAsync(teamData);
  }, [createTeamMutation]);

  const updateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    return updateTeamMutation.mutateAsync({ teamId, updates });
  }, [updateTeamMutation]);

  const deleteTeam = useCallback((teamId: string) => {
    return deleteTeamMutation.mutateAsync(teamId);
  }, [deleteTeamMutation]);

  const refreshTeams = useCallback(() => {
    return Promise.all([refetchTeams(), refetchMembers()]);
  }, [refetchTeams, refetchMembers]);

  return {
    // Data
    teams,
    teamMembers,
    isLoading,
    error,
    
    // Operations
    createTeam,
    updateTeam,
    deleteTeam,
    refreshTeams,
    
    // Loading states
    isCreating: createTeamMutation.isPending,
    isUpdating: updateTeamMutation.isPending,
    isDeleting: deleteTeamMutation.isPending,
    
    // Utilities
    getTeamMembers: (teamId: string) => teamMembers.get(teamId) || [],
    findTeamById: (teamId: string) => teams.find(t => t.id === teamId)
  };
}
```

## 3.2.3 - Design Connection Management Hook

### Connection Management Pattern
```tsx
interface UseConnectionsOptions {
  // Auto-validation
  validateConnections?: boolean;
  preventCycles?: boolean;
  maxConnectionsPerTeam?: number;
  
  // Performance
  batchUpdates?: boolean;
  debounceMs?: number;
  
  // Callbacks
  onConnectionCreated?: (connection: TeamConnection) => void;
  onConnectionDeleted?: (connectionId: string) => void;
  onValidationError?: (error: ConnectionValidationError) => void;
}

interface ConnectionValidationError {
  type: 'cycle' | 'duplicate' | 'max_connections' | 'self_reference';
  message: string;
  connection: Partial<TeamConnection>;
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

  // Connection validation
  const validateConnection = useCallback((
    fromTeamId: string,
    toTeamId: string,
    type: ConnectionType
  ): ConnectionValidationError | null => {
    if (!validateConnections) return null;
    
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
      conn.toTeamId === toTeamId
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
  }, [connections, connectionGraph, validateConnections, preventCycles, maxConnectionsPerTeam]);

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

  // Auto-layout suggestions
  const suggestAutoLayout = useCallback((layoutType: 'hierarchy' | 'circular' | 'force') => {
    return generateAutoLayout(teams, connections, layoutType);
  }, [teams, connections]);

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
    suggestAutoLayout,
    connectionCount: connections.length,
    hasConnectionBetween: (teamA: string, teamB: string) => 
      connections.some(conn => 
        (conn.fromTeamId === teamA && conn.toTeamId === teamB) ||
        (conn.fromTeamId === teamB && conn.toTeamId === teamA)
      )
  };
}
```

## 3.2.4 - Design Layout Persistence Hook

### Layout Persistence Pattern
```tsx
interface UseLayoutPersistenceOptions {
  // Storage configuration
  storageType: 'local' | 'database' | 'both';
  storageKey?: string;
  
  // Auto-save configuration  
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  debounceMs?: number;
  
  // Conflict resolution
  enableConflictResolution?: boolean;
  conflictStrategy?: 'local_wins' | 'remote_wins' | 'merge' | 'ask_user';
  
  // Callbacks
  onSaveSuccess?: (layout: CanvasLayout) => void;
  onSaveError?: (error: Error) => void;
  onLoadSuccess?: (layout: CanvasLayout) => void;
  onLoadError?: (error: Error) => void;
  onConflictDetected?: (localLayout: CanvasLayout, remoteLayout: CanvasLayout) => Promise<CanvasLayout>;
}

export function useLayoutPersistence(
  userId: string,
  workspaceId: string,
  options: UseLayoutPersistenceOptions
) {
  const {
    storageType = 'both',
    storageKey = `team-canvas-${workspaceId}`,
    enableAutoSave = true,
    autoSaveInterval = 30000,
    debounceMs = 1000,
    enableConflictResolution = true,
    conflictStrategy = 'merge',
    onSaveSuccess,
    onSaveError,
    onLoadSuccess,
    onLoadError,
    onConflictDetected
  } = options;

  const supabase = useSupabaseClient();
  const [lastSavedLayout, setLastSavedLayout] = useState<CanvasLayout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveTimeRef = useRef<Date>();

  // Load layout from storage
  const loadLayout = useCallback(async (): Promise<CanvasLayout | null> => {
    setIsLoading(true);
    
    try {
      let localLayout: CanvasLayout | null = null;
      let remoteLayout: CanvasLayout | null = null;
      
      // Load from localStorage
      if (storageType === 'local' || storageType === 'both') {
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          localLayout = JSON.parse(localData);
        }
      }
      
      // Load from database
      if (storageType === 'database' || storageType === 'both') {
        const { data, error } = await supabase
          .from('team_canvas_layouts')
          .select('*')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .single();
          
        if (error && error.code !== 'PGRST116') { // Not found is OK
          throw error;
        }
        
        if (data) {
          remoteLayout = {
            id: data.id,
            userId: data.user_id,
            workspaceId: data.workspace_id,
            positions: data.positions,
            connections: data.connections,
            viewSettings: data.view_settings,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      }
      
      // Resolve conflicts
      let finalLayout: CanvasLayout | null = null;
      
      if (localLayout && remoteLayout) {
        if (enableConflictResolution) {
          finalLayout = await resolveLayoutConflict(
            localLayout,
            remoteLayout,
            conflictStrategy,
            onConflictDetected
          );
        } else {
          finalLayout = conflictStrategy === 'local_wins' ? localLayout : remoteLayout;
        }
      } else {
        finalLayout = localLayout || remoteLayout;
      }
      
      if (finalLayout) {
        setLastSavedLayout(finalLayout);
        if (onLoadSuccess) onLoadSuccess(finalLayout);
      }
      
      return finalLayout;
      
    } catch (error) {
      if (onLoadError) onLoadError(error as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    storageType,
    storageKey,
    userId,
    workspaceId,
    enableConflictResolution,
    conflictStrategy,
    onLoadSuccess,
    onLoadError,
    onConflictDetected,
    supabase
  ]);

  // Save layout to storage
  const saveLayout = useCallback(async (layout: CanvasLayout): Promise<boolean> => {
    setIsSaving(true);
    
    try {
      const layoutToSave = {
        ...layout,
        userId,
        workspaceId,
        updatedAt: new Date().toISOString()
      };
      
      // Save to localStorage
      if (storageType === 'local' || storageType === 'both') {
        localStorage.setItem(storageKey, JSON.stringify(layoutToSave));
      }
      
      // Save to database
      if (storageType === 'database' || storageType === 'both') {
        const { error } = await supabase
          .from('team_canvas_layouts')
          .upsert({
            id: layout.id || generateLayoutId(),
            user_id: userId,
            workspace_id: workspaceId,
            positions: layout.positions,
            connections: layout.connections,
            view_settings: layout.viewSettings,
            updated_at: new Date().toISOString()
          });
          
        if (error) throw error;
      }
      
      setLastSavedLayout(layoutToSave);
      lastSaveTimeRef.current = new Date();
      
      if (onSaveSuccess) onSaveSuccess(layoutToSave);
      
      return true;
      
    } catch (error) {
      if (onSaveError) onSaveError(error as Error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    storageType,
    storageKey,
    userId,
    workspaceId,
    onSaveSuccess,
    onSaveError,
    supabase
  ]);

  // Debounced save
  const debouncedSave = useCallback((layout: CanvasLayout) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveLayout(layout);
    }, debounceMs);
  }, [saveLayout, debounceMs]);

  // Auto-save effect
  useEffect(() => {
    if (!enableAutoSave) return;
    
    const interval = setInterval(() => {
      // Auto-save logic would be triggered by parent component
      // This hook provides the mechanism, parent triggers the save
    }, autoSaveInterval);
    
    return () => clearInterval(interval);
  }, [enableAutoSave, autoSaveInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    lastSavedLayout,
    isSaving,
    isLoading,
    lastSaveTime: lastSaveTimeRef.current,
    
    // Operations
    loadLayout,
    saveLayout,
    debouncedSave,
    
    // Utilities
    hasUnsavedChanges: (currentLayout: CanvasLayout) => 
      !lastSavedLayout || 
      JSON.stringify(currentLayout) !== JSON.stringify(lastSavedLayout),
    clearStorage: () => localStorage.removeItem(storageKey)
  };
}

// Conflict resolution helper
async function resolveLayoutConflict(
  localLayout: CanvasLayout,
  remoteLayout: CanvasLayout,
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'ask_user',
  onConflictDetected?: (local: CanvasLayout, remote: CanvasLayout) => Promise<CanvasLayout>
): Promise<CanvasLayout> {
  switch (strategy) {
    case 'local_wins':
      return localLayout;
    case 'remote_wins':
      return remoteLayout;
    case 'merge':
      return mergeLayouts(localLayout, remoteLayout);
    case 'ask_user':
      if (onConflictDetected) {
        return await onConflictDetected(localLayout, remoteLayout);
      }
      return remoteLayout; // Fallback
    default:
      return remoteLayout;
  }
}

function mergeLayouts(local: CanvasLayout, remote: CanvasLayout): CanvasLayout {
  // Merge strategy: 
  // - Use most recent view settings
  // - Merge positions (remote wins for conflicts)
  // - Merge connections (combine unique)
  
  const localTime = new Date(local.updatedAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || 0).getTime();
  
  return {
    ...remote,
    positions: mergePositions(local.positions, remote.positions),
    connections: mergeConnections(local.connections, remote.connections),
    viewSettings: remoteTime > localTime ? remote.viewSettings : local.viewSettings,
    updatedAt: new Date().toISOString()
  };
}
```
