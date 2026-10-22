# Frontend Component Design Research

## Integration Setup Modal Pattern

Based on analysis of existing setup modals (ClickSend, SendGrid, etc.), here's the standard pattern:

### Component Structure
```typescript
// QuickChartSetupModal.tsx
interface QuickChartSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (connection: any) => void;
  onError: (error: string) => void;
  user: any;
}

interface TestResult {
  success: boolean;
  details?: string;
  features?: string[];
  plan_type?: 'free' | 'paid';
}
```

### State Management Pattern
```typescript
export function QuickChartSetupModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  user
}: QuickChartSetupModalProps) {
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Process state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // Cleanup function
  const handleClose = () => {
    setApiKey('');
    setConnectionName('');
    setShowApiKey(false);
    setTestResult(null);
    onClose();
  };
```

### API Key Input Pattern
```typescript
// Standard API key input with show/hide toggle
<div>
  <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
    QuickChart API Key (Optional)
  </Label>
  <div className="relative mt-1">
    <Input
      id="apiKey"
      type={showApiKey ? "text" : "password"}
      value={apiKey}
      onChange={(e) => setApiKey(e.target.value)}
      placeholder="Enter your QuickChart API key for premium features"
      className="pr-10"
      disabled={isConnecting}
    />
    <button
      type="button"
      onClick={() => setShowApiKey(!showApiKey)}
      className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
      disabled={isConnecting}
    >
      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-1">
    Optional: Get your API key from <a href="https://quickchart.io/pricing" target="_blank" className="text-blue-600">QuickChart.io</a> for premium features
  </p>
</div>
```

### Connection Testing Pattern
```typescript
const handleTestConnection = async () => {
  // API key is optional for QuickChart
  setIsTestingConnection(true);
  
  try {
    // Test with a simple chart generation
    const testChartConfig = {
      type: 'bar',
      data: {
        labels: ['Test'],
        datasets: [{
          data: [1],
          backgroundColor: 'rgba(75, 192, 192, 0.2)'
        }]
      }
    };
    
    const testUrl = apiKey ? 
      `https://quickchart.io/chart?key=${apiKey}&c=${encodeURIComponent(JSON.stringify(testChartConfig))}` :
      `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(testChartConfig))}`;
      
    const response = await fetch(testUrl);
    
    if (response.ok) {
      setTestResult({
        success: true,
        details: apiKey ? 'API key is valid - premium features available' : 'Free tier access confirmed',
        plan_type: apiKey ? 'paid' : 'free',
        features: apiKey ? 
          ['High resolution charts', 'Custom domains', 'Higher rate limits', 'Priority support'] :
          ['Basic chart generation', '100 charts/month', 'Standard resolution']
      });
    } else {
      throw new Error(`Test failed with status ${response.status}`);
    }
    
  } catch (error: any) {
    console.error('Connection test error:', error);
    setTestResult({
      success: false,
      details: apiKey ? 
        'API key test failed. Please check your API key.' :
        'Free tier test failed. QuickChart service may be unavailable.'
    });
  } finally {
    setIsTestingConnection(false);
  }
};
```

### Connection Save Pattern
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // For QuickChart, API key is optional
  setIsConnecting(true);
  
  try {
    // Get QuickChart service provider ID
    const { data: provider, error: providerError } = await supabase
      .from('service_providers')
      .select('id')
      .eq('name', 'quickchart')
      .single();
      
    if (providerError || !provider) {
      throw new Error('QuickChart service provider not found. Please contact support.');
    }
    
    let vaultApiKeyId = null;
    
    // Only encrypt API key if provided
    if (apiKey.trim()) {
      const { data: encryptedApiKey, error: apiKeyError } = await supabase.rpc(
        'vault.create_secret',
        {
          secret: apiKey.trim(),
          name: `quickchart_apikey_${user.id}`,
          description: 'QuickChart API key for premium features'
        }
      );
      
      if (apiKeyError || !encryptedApiKey) {
        throw new Error('Failed to encrypt API key. Please try again.');
      }
      
      vaultApiKeyId = encryptedApiKey.id;
    }
    
    // Create user integration credentials record
    const { data: connection, error: connectionError } = await supabase
      .from('user_integration_credentials')
      .insert({
        user_id: user.id,
        service_provider_id: provider.id,
        vault_access_token_id: vaultApiKeyId,
        scopes_granted: [
          'bar_chart', 'line_chart', 'pie_chart', 'scatter_plot', 
          'area_chart', 'radar_chart', 'bubble_chart', 'mixed_chart', 'custom_chart'
        ],
        connection_status: 'active',
        connection_name: connectionName.trim() || 'QuickChart.io',
        credential_type: 'api_key',
        connection_metadata: {
          plan_type: testResult?.plan_type || 'free',
          features_enabled: testResult?.features || ['Basic chart generation'],
          setup_date: new Date().toISOString(),
          api_key_provided: !!apiKey.trim()
        }
      })
      .select()
      .single();
      
    if (connectionError) {
      throw new Error(`Failed to create connection: ${connectionError.message}`);
    }
    
    toast.success('QuickChart.io connected successfully!');
    onSuccess(connection);
    handleClose();
    
  } catch (error: any) {
    console.error('Connection setup error:', error);
    const errorMessage = error.message || 'Failed to connect QuickChart account';
    toast.error(errorMessage);
    onError(errorMessage);
  } finally {
    setIsConnecting(false);
  }
};
```

## Integration Card Pattern

### Card Component Structure
```typescript
// QuickChartIntegrationCard.tsx
interface QuickChartIntegrationCardProps {
  integration: any;
  onSetup: () => void;
  isConnected: boolean;
  connectionInfo?: any;
}

export function QuickChartIntegrationCard({
  integration,
  onSetup,
  isConnected,
  connectionInfo
}: QuickChartIntegrationCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header with icon and title */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {integration.display_name}
            </h3>
            <p className="text-sm text-gray-500">Data Visualization</p>
          </div>
        </div>
        
        {/* Connection status badge */}
        {isConnected ? (
          <Badge variant="success" className="bg-green-100 text-green-800">
            Connected
          </Badge>
        ) : (
          <Badge variant="secondary">Not Connected</Badge>
        )}
      </div>
      
      {/* Description */}
      <p className="text-gray-600 text-sm mb-4">
        Generate charts and graphs from data using Chart.js configurations. 
        Create bar charts, line charts, pie charts, and more with just a few parameters.
      </p>
      
      {/* Features list */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Bar & Line Charts</span>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Pie & Scatter Plots</span>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Custom Chart.js</span>
          </div>
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Multiple Formats</span>
          </div>
        </div>
      </div>
      
      {/* Connection info or setup button */}
      {isConnected && connectionInfo ? (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-600">
            <div>Plan: {connectionInfo.connection_metadata?.plan_type || 'Free'}</div>
            <div>Connected: {new Date(connectionInfo.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      ) : null}
      
      {/* Action button */}
      <Button 
        onClick={onSetup}
        className="w-full"
        variant={isConnected ? "outline" : "default"}
      >
        {isConnected ? 'Manage Connection' : 'Connect QuickChart.io'}
      </Button>
    </div>
  );
}
```

## Integration Registry Pattern

### Registry Entry
```typescript
// In IntegrationSetupRegistry.ts
'QuickChart.io': {
  component: QuickChartSetupModal,
  credentialType: 'api_key',
  defaultScopes: [
    'bar_chart', 'line_chart', 'pie_chart', 'scatter_plot',
    'area_chart', 'radar_chart', 'bubble_chart', 'mixed_chart', 'custom_chart'
  ],
  capabilities: [
    { 
      key: 'bar_chart', 
      label: 'Bar Charts', 
      description: 'Create vertical and horizontal bar charts from data' 
    },
    { 
      key: 'line_chart', 
      label: 'Line Charts', 
      description: 'Generate line charts with multiple data series' 
    },
    { 
      key: 'pie_chart', 
      label: 'Pie Charts', 
      description: 'Create pie and doughnut charts for proportional data' 
    },
    { 
      key: 'scatter_plot', 
      label: 'Scatter Plots', 
      description: 'Plot data points to show correlations and patterns' 
    },
    { 
      key: 'area_chart', 
      label: 'Area Charts', 
      description: 'Create filled area charts for trend visualization' 
    },
    { 
      key: 'radar_chart', 
      label: 'Radar Charts', 
      description: 'Generate radar charts for multi-dimensional data' 
    },
    { 
      key: 'bubble_chart', 
      label: 'Bubble Charts', 
      description: 'Create bubble charts with three-dimensional data' 
    },
    { 
      key: 'mixed_chart', 
      label: 'Mixed Charts', 
      description: 'Combine multiple chart types in one visualization' 
    },
    { 
      key: 'custom_chart', 
      label: 'Custom Charts', 
      description: 'Full Chart.js configuration support for advanced charts' 
    }
  ]
}
```

## React Hooks Pattern

### Integration Hook
```typescript
// useQuickChartIntegration.ts
export function useQuickChartIntegration() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_integration_credentials')
        .select(`
          *,
          service_providers!inner(name, display_name)
        `)
        .eq('service_providers.name', 'quickchart')
        .eq('connection_status', 'active');
        
      if (error) throw error;
      setConnections(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  const createConnection = useCallback(async (apiKey?: string, connectionName?: string) => {
    // Implementation similar to handleSubmit in modal
    // Returns connection data or throws error
  }, []);
  
  const testConnection = useCallback(async (apiKey?: string) => {
    // Implementation similar to handleTestConnection in modal
    // Returns test result
  }, []);
  
  const deleteConnection = useCallback(async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_integration_credentials')
        .update({ connection_status: 'inactive' })
        .eq('id', connectionId);
        
      if (error) throw error;
      await fetchConnections(); // Refresh list
    } catch (err: any) {
      throw new Error(`Failed to delete connection: ${err.message}`);
    }
  }, [fetchConnections]);
  
  return {
    connections,
    loading,
    error,
    createConnection,
    testConnection,
    deleteConnection,
    refresh: fetchConnections
  };
}
```

## Tool Service Definitions

### Tool Schema Export
```typescript
// quickchart-tools.ts
import { BarChart3 } from 'lucide-react';

export const QUICKCHART_TOOLS = [
  {
    name: 'quickchart_create_bar_chart',
    displayName: 'Create Bar Chart',
    description: 'Generate vertical or horizontal bar charts from data',
    category: 'data_visualization',
    icon: BarChart3,
    schema: {
      type: "function",
      function: {
        name: "quickchart_create_bar_chart",
        description: "Create a vertical or horizontal bar chart from data",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Chart title" },
            labels: { type: "array", items: { type: "string" }, description: "Category labels" },
            data: { type: "array", items: { type: "number" }, description: "Data values" },
            orientation: { type: "string", enum: ["vertical", "horizontal"], default: "vertical" },
            width: { type: "integer", default: 500, minimum: 100, maximum: 2000 },
            height: { type: "integer", default: 300, minimum: 100, maximum: 2000 }
          },
          required: ["labels", "data"]
        }
      }
    }
  },
  // ... other tools
];

export const QUICKCHART_INTEGRATION = {
  id: 'quickchart',
  name: 'QuickChart.io',
  description: 'Generate charts and graphs from data',
  category: 'data_visualization',
  provider_type: 'api_key',
  icon: BarChart3,
  setupComponent: 'QuickChartSetupModal', // String reference to avoid circular imports
  tools: QUICKCHART_TOOLS.map(tool => tool.name),
  optional_api_key: true,
  free_tier_available: true
};
```

## File Organization

### Directory Structure
```
src/integrations/quickchart/
├── components/
│   ├── QuickChartSetupModal.tsx      # Main setup modal
│   └── QuickChartIntegrationCard.tsx # Integration display card
├── hooks/
│   └── useQuickChartIntegration.ts   # React hooks for integration
├── services/
│   └── quickchart-tools.ts          # Tool definitions and schemas
├── types/
│   └── quickchart.ts                # TypeScript interfaces
└── index.ts                         # Export barrel
```

### Export Barrel (index.ts)
```typescript
// index.ts
export { QuickChartSetupModal } from './components/QuickChartSetupModal';
export { QuickChartIntegrationCard } from './components/QuickChartIntegrationCard';
export { useQuickChartIntegration } from './hooks/useQuickChartIntegration';
export { QUICKCHART_TOOLS, QUICKCHART_INTEGRATION } from './services/quickchart-tools';
export type * from './types/quickchart';
```

## UI Component Library Usage

### Standard Components Used
- **Dialog**: `@/components/ui/dialog` for modal structure
- **Button**: `@/components/ui/button` for actions
- **Input**: `@/components/ui/input` for form fields
- **Label**: `@/components/ui/label` for form labels
- **Badge**: `@/components/ui/badge` for status indicators
- **Icons**: `lucide-react` for consistent iconography

### Styling Patterns
- **Tailwind CSS**: Utility-first styling
- **Consistent spacing**: `space-x-*`, `space-y-*`, `p-*`, `m-*`
- **Color scheme**: Gray scale with accent colors
- **Hover states**: `hover:*` for interactive elements
- **Transitions**: `transition-*` for smooth animations

## Testing Considerations

### Component Testing
```typescript
// QuickChartSetupModal.test.tsx
describe('QuickChartSetupModal', () => {
  test('renders with optional API key field', () => {
    render(<QuickChartSetupModal {...defaultProps} />);
    expect(screen.getByText('QuickChart API Key (Optional)')).toBeInTheDocument();
  });
  
  test('allows connection without API key', async () => {
    render(<QuickChartSetupModal {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText('Connection Name'), {
      target: { value: 'Test Connection' }
    });
    
    fireEvent.click(screen.getByText('Test Connection'));
    
    await waitFor(() => {
      expect(screen.getByText('Free tier access confirmed')).toBeInTheDocument();
    });
  });
});
```

### Integration Testing
- Test modal open/close behavior
- Test form validation and submission
- Test API key validation (optional)
- Test connection creation and storage
- Test error handling scenarios

