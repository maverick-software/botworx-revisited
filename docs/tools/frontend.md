# Frontend Components and Hooks

## Overview

The frontend architecture for the MCP tool and credential management system is built with React, TypeScript, and Tailwind CSS. It provides a unified interface for managing credentials, assigning permissions, and monitoring tool usage.

## Core Components

### Credentials Page

**Location**: `src/pages/CredentialsPage.tsx`

The main interface for managing user credentials:

```typescript
export default function CredentialsPage() {
  const { connections, loading, error, revoke, refetch } = useConnections();
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});
  
  // Handle token refresh for OAuth connections
  const handleRefreshToken = async (connectionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('oauth-refresh', {
        body: { connectionId }
      });
      
      if (error) {
        // User-friendly error handling
        if (error.message.includes('expired')) {
          setRefreshStatus({
            [connectionId]: {
              status: 'error',
              message: 'Connection expired. Please reconnect.',
              needsReconnection: true
            }
          });
        }
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };
  
  // Handle credential revocation
  const handleRevokeConnection = async (connectionId: string) => {
    await revoke(connectionId);
    // UI updates optimistically via useConnections
  };
  
  return (
    <div className="space-y-4">
      {connections.map(connection => (
        <CredentialCard
          key={connection.id}
          connection={connection}
          onRefresh={handleRefreshToken}
          onRevoke={handleRevokeConnection}
          refreshStatus={refreshStatus[connection.id]}
        />
      ))}
    </div>
  );
}
```

### Integrations Page

**Location**: `src/pages/IntegrationsPage.tsx`

Discovery and setup interface for new integrations:

```typescript
export default function IntegrationsPage() {
  const { connections, refetch } = useConnections();
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  
  // Check if integration is connected
  const isConnected = (providerId: string) => {
    return connections.some(c => 
      c.provider_id === providerId && 
      c.connection_status === 'connected'
    );
  };
  
  // Handle successful setup
  const handleSetupComplete = async () => {
    await refetch(); // Refresh connections
    setSelectedIntegration(null);
  };
  
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            isConnected={isConnected(integration.id)}
            onConnect={() => setSelectedIntegration(integration)}
          />
        ))}
      </div>
      
      {selectedIntegration && (
        <IntegrationSetupModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onComplete={handleSetupComplete}
        />
      )}
    </>
  );
}
```

### Agent Integrations Manager

**Location**: `src/components/agent-edit/AgentIntegrationsManager.tsx`

Manages tool assignments for agents:

```typescript
export function AgentIntegrationsManager({ agentId }: Props) {
  const { connections } = useConnections();
  const [agentPermissions, setAgentPermissions] = useState([]);
  
  // Get available credentials for assignment
  const getAvailableCredentials = () => {
    return connections.filter(c => 
      c.connection_status === 'connected' &&
      !agentPermissions.some(p => p.connection_id === c.id)
    );
  };
  
  // Add credential to agent
  const handleAddCredential = async (credential: Connection) => {
    const { data } = await supabase
      .from('agent_oauth_permissions')
      .insert({
        agent_id: agentId,
        connection_id: credential.id,
        permissions: getDefaultPermissions(credential.provider_type)
      })
      .select()
      .single();
    
    setAgentPermissions([...agentPermissions, data]);
  };
  
  // Update permissions
  const handleUpdatePermissions = async (
    permissionId: string,
    newPermissions: any
  ) => {
    await supabase
      .from('agent_oauth_permissions')
      .update({ permissions: newPermissions })
      .eq('id', permissionId);
    
    setAgentPermissions(
      agentPermissions.map(p =>
        p.id === permissionId
          ? { ...p, permissions: newPermissions }
          : p
      )
    );
  };
  
  return (
    <div className="space-y-4">
      <CredentialSelector
        availableCredentials={getAvailableCredentials()}
        onSelect={handleAddCredential}
      />
      
      <PermissionsList
        permissions={agentPermissions}
        onUpdate={handleUpdatePermissions}
        onRemove={handleRemovePermission}
      />
    </div>
  );
}
```

## Core Hooks

### useConnections

**Location**: `src/hooks/useConnections.ts`

Central hook for credential management:

```typescript
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Fetch connections
  const fetchConnections = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getUserConnections(user.id);
      setConnections(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Revoke connection (optimistic update)
  const revoke = async (connectionId: string) => {
    // Optimistic UI update
    setConnections(prev => 
      prev.filter(c => c.id !== connectionId)
    );
    
    try {
      await revokeConnection(connectionId);
    } catch (err) {
      // Rollback on error
      await fetchConnections();
      throw err;
    }
  };
  
  // Remove connection (hard delete)
  const remove = async (connectionId: string) => {
    setConnections(prev => 
      prev.filter(c => c.id !== connectionId)
    );
    
    try {
      await removeConnection(connectionId);
    } catch (err) {
      await fetchConnections();
      throw err;
    }
  };
  
  useEffect(() => {
    fetchConnections();
  }, [user]);
  
  return {
    connections,
    loading,
    error,
    revoke,
    remove,
    refetch: fetchConnections
  };
}
```

### useAgentPermissions

**Location**: `src/hooks/useAgentPermissions.ts`

Manages agent-specific permissions:

```typescript
export function useAgentPermissions(agentId: string) {
  const [permissions, setPermissions] = useState<AgentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch agent permissions
  const fetchPermissions = async () => {
    const { data } = await supabase
      .from('agent_oauth_permissions')
      .select(`
        *,
        connection:user_oauth_connections(
          *,
          provider:oauth_providers(*)
        )
      `)
      .eq('agent_id', agentId);
    
    setPermissions(data || []);
    setLoading(false);
  };
  
  // Add permission
  const addPermission = async (
    connectionId: string,
    permissions: any
  ) => {
    const { data } = await supabase
      .from('agent_oauth_permissions')
      .insert({
        agent_id: agentId,
        connection_id: connectionId,
        permissions
      })
      .select()
      .single();
    
    setPermissions([...permissions, data]);
    return data;
  };
  
  // Update permission
  const updatePermission = async (
    permissionId: string,
    newPermissions: any
  ) => {
    await supabase
      .from('agent_oauth_permissions')
      .update({ permissions: newPermissions })
      .eq('id', permissionId);
    
    setPermissions(
      permissions.map(p =>
        p.id === permissionId
          ? { ...p, permissions: newPermissions }
          : p
      )
    );
  };
  
  // Remove permission
  const removePermission = async (permissionId: string) => {
    await supabase
      .from('agent_oauth_permissions')
      .delete()
      .eq('id', permissionId);
    
    setPermissions(
      permissions.filter(p => p.id !== permissionId)
    );
  };
  
  useEffect(() => {
    if (agentId) fetchPermissions();
  }, [agentId]);
  
  return {
    permissions,
    loading,
    addPermission,
    updatePermission,
    removePermission,
    refetch: fetchPermissions
  };
}
```

### useWebSearch

**Location**: `src/hooks/useWebSearch.ts`

Execute web searches:

```typescript
export function useWebSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  
  const search = async (
    query: string,
    connectionId: string,
    options?: SearchOptions
  ) => {
    setLoading(true);
    
    try {
      const { data } = await supabase.functions.invoke(
        'web-search-api',
        {
          body: {
            query,
            connectionId,
            ...options
          }
        }
      );
      
      setResults(data.results);
      return data.results;
    } finally {
      setLoading(false);
    }
  };
  
  return { search, results, loading };
}
```

## UI Components

### Credential Card

```typescript
interface CredentialCardProps {
  connection: Connection;
  onRefresh?: (id: string) => void;
  onRevoke?: (id: string) => void;
  refreshStatus?: RefreshStatus;
}

export function CredentialCard({
  connection,
  onRefresh,
  onRevoke,
  refreshStatus
}: CredentialCardProps) {
  const isExpired = connection.connection_status === 'expired';
  const needsReconnection = refreshStatus?.needsReconnection;
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ProviderIcon provider={connection.provider.name} />
          <div>
            <h3 className="font-medium">
              {connection.provider.display_name}
            </h3>
            <StatusBadge status={connection.connection_status} />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {connection.credential_type === 'oauth' && !isExpired && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRefresh?.(connection.id)}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          )}
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRevoke?.(connection.id)}
          >
            {needsReconnection ? 'Disconnect' : 'Revoke'}
          </Button>
        </div>
      </div>
      
      {needsReconnection && (
        <Alert className="mt-4" variant="warning">
          <AlertDescription>
            {refreshStatus.message}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
```

### Permission Editor

```typescript
interface PermissionEditorProps {
  provider: string;
  permissions: any;
  onChange: (permissions: any) => void;
}

export function PermissionEditor({
  provider,
  permissions,
  onChange
}: PermissionEditorProps) {
  const updatePermission = (key: string, value: any) => {
    onChange({ ...permissions, [key]: value });
  };
  
  // Render provider-specific permission controls
  switch (provider) {
    case 'gmail':
      return (
        <GmailPermissions
          permissions={permissions}
          onChange={updatePermission}
        />
      );
    
    case 'serper_api':
    case 'serpapi':
    case 'brave_search':
      return (
        <WebSearchPermissions
          permissions={permissions}
          onChange={updatePermission}
        />
      );
    
    default:
      return (
        <GenericPermissions
          permissions={permissions}
          onChange={updatePermission}
        />
      );
  }
}
```

### Status Badge

```typescript
interface StatusBadgeProps {
  status: 'connected' | 'expired' | 'revoked';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    connected: 'bg-green-100 text-green-800',
    expired: 'bg-amber-100 text-amber-800',
    revoked: 'bg-red-100 text-red-800'
  };
  
  const labels = {
    connected: 'Connected',
    expired: 'Expired - Reconnect Needed',
    revoked: 'Revoked'
  };
  
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full
      text-xs font-medium ${variants[status]}
    `}>
      {labels[status]}
    </span>
  );
}
```

## State Management

### Connection State

```typescript
interface ConnectionState {
  connections: Connection[];
  loading: boolean;
  error: string | null;
  selectedConnection: Connection | null;
}

// Using React Context
const ConnectionContext = createContext<ConnectionState>(null);

export function ConnectionProvider({ children }) {
  const connectionState = useConnections();
  
  return (
    <ConnectionContext.Provider value={connectionState}>
      {children}
    </ConnectionContext.Provider>
  );
}
```

### Permission State

```typescript
interface PermissionState {
  permissions: Map<string, AgentPermission[]>;
  loading: Map<string, boolean>;
}

// Using Zustand
const usePermissionStore = create<PermissionState>((set) => ({
  permissions: new Map(),
  loading: new Map(),
  
  setPermissions: (agentId: string, permissions: AgentPermission[]) =>
    set((state) => ({
      permissions: new Map(state.permissions).set(agentId, permissions)
    })),
  
  updatePermission: (agentId: string, permissionId: string, update: any) =>
    set((state) => {
      const agentPerms = state.permissions.get(agentId) || [];
      const updated = agentPerms.map(p =>
        p.id === permissionId ? { ...p, ...update } : p
      );
      return {
        permissions: new Map(state.permissions).set(agentId, updated)
      };
    })
}));
```

## Forms and Validation

### API Key Setup Form

```typescript
interface ApiKeyFormProps {
  provider: string;
  onSubmit: (apiKey: string) => Promise<void>;
}

export function ApiKeyForm({ provider, onSubmit }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const validateApiKey = (key: string): boolean => {
    if (!key) {
      setError('API key is required');
      return false;
    }
    
    // Provider-specific validation
    switch (provider) {
      case 'serper_api':
        if (!key.match(/^[a-f0-9]{40}$/)) {
          setError('Invalid Serper API key format');
          return false;
        }
        break;
      
      case 'serpapi':
        if (key.length !== 64) {
          setError('Invalid SerpAPI key length');
          return false;
        }
        break;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateApiKey(apiKey)) return;
    
    setLoading(true);
    try {
      await onSubmit(apiKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="api-key">API Key</Label>
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
        />
        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>
      
      <Button type="submit" disabled={loading}>
        {loading ? 'Connecting...' : 'Connect'}
      </Button>
    </form>
  );
}
```

## Error Handling

### Error Boundary

```typescript
export class CredentialErrorBoundary extends Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Credential error:', error, errorInfo);
    
    // Log to error tracking service
    if (window.Sentry) {
      window.Sentry.captureException(error);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {this.state.error?.message || 
             'Failed to load credentials. Please refresh the page.'}
          </AlertDescription>
        </Alert>
      );
    }
    
    return this.props.children;
  }
}
```

### User-Friendly Error Messages

```typescript
function formatErrorMessage(error: any): string {
  // Map technical errors to user-friendly messages
  const errorMap = {
    'invalid_grant': 'Your connection has expired. Please reconnect.',
    'insufficient_scope': 'Additional permissions are required.',
    'rate_limit_exceeded': 'Too many requests. Please try again later.',
    'network_error': 'Connection failed. Check your internet.',
    'vault_error': 'Security error. Please contact support.'
  };
  
  // Check for known error patterns
  for (const [key, message] of Object.entries(errorMap)) {
    if (error.message?.includes(key)) {
      return message;
    }
  }
  
  // Default message
  return 'An unexpected error occurred. Please try again.';
}
```

## Performance Optimization

### Memoization

```typescript
// Memoize expensive computations
const availableCredentials = useMemo(() => {
  return connections.filter(c => 
    c.connection_status === 'connected' &&
    !agentPermissions.some(p => p.connection_id === c.id)
  );
}, [connections, agentPermissions]);
```

### Lazy Loading

```typescript
// Lazy load heavy components
const IntegrationSetupModal = lazy(() => 
  import('./IntegrationSetupModal')
);

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <IntegrationSetupModal {...props} />
</Suspense>
```

### Optimistic Updates

```typescript
// Update UI immediately, rollback on error
const handleRevoke = async (connectionId: string) => {
  // Optimistic update
  setConnections(prev => 
    prev.filter(c => c.id !== connectionId)
  );
  
  try {
    await revokeConnection(connectionId);
  } catch (error) {
    // Rollback
    await refetchConnections();
    showError('Failed to revoke connection');
  }
};
```

## Testing

### Component Tests

```typescript
describe('CredentialCard', () => {
  it('displays connection status correctly', () => {
    const connection = mockConnection({ 
      connection_status: 'expired' 
    });
    
    render(<CredentialCard connection={connection} />);
    
    expect(screen.getByText('Expired - Reconnect Needed'))
      .toBeInTheDocument();
  });
  
  it('calls onRevoke when revoke button clicked', async () => {
    const onRevoke = jest.fn();
    const connection = mockConnection();
    
    render(
      <CredentialCard 
        connection={connection} 
        onRevoke={onRevoke}
      />
    );
    
    await userEvent.click(screen.getByText('Revoke'));
    
    expect(onRevoke).toHaveBeenCalledWith(connection.id);
  });
});
```

### Hook Tests

```typescript
describe('useConnections', () => {
  it('fetches connections on mount', async () => {
    const { result } = renderHook(() => useConnections());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.connections).toHaveLength(2);
  });
  
  it('optimistically updates on revoke', async () => {
    const { result } = renderHook(() => useConnections());
    
    await waitFor(() => !result.current.loading);
    
    const initialCount = result.current.connections.length;
    
    act(() => {
      result.current.revoke('connection-1');
    });
    
    expect(result.current.connections).toHaveLength(
      initialCount - 1
    );
  });
});
```

## Best Practices

1. **Always use `useConnections`** for credential data
2. **Implement optimistic updates** for better UX
3. **Show loading states** during async operations
4. **Provide clear error messages** with actionable steps
5. **Validate inputs** before submission
6. **Use TypeScript** for type safety
7. **Memoize expensive operations**
8. **Test user interactions** thoroughly
9. **Handle edge cases** gracefully
10. **Document component props** with JSDoc
