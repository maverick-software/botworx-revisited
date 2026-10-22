# Tools Tab Integration Design for ClickSend SMS/MMS

## Research Date
September 11, 2025

## Purpose
Design the integration of ClickSend SMS/MMS tools into the existing agent chat page tools tab, ensuring seamless user experience and consistent visual design.

## Tools Tab Integration Architecture

### 1. Current Tools Tab Structure Analysis

#### **Existing Tools Tab Layout**
```
Agent Chat Page → Tools Tab
├── Available Tools Section
│   ├── Gmail Tools (if enabled)
│   ├── Web Search Tools (if enabled)  
│   ├── File Tools (if enabled)
│   └── Other Integration Tools
├── Tool Execution History
└── Tool Settings/Preferences
```

#### **Integration Point**
`src/pages/agents/[agentId]/chat.tsx` - Tools Tab Component

### 2. ClickSend Tools Section Design

#### **SMS/MMS Tools Card**
```tsx
<div className="border border-gray-200 rounded-lg p-4 space-y-4">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <MessageSquare className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">SMS/MMS Tools</h3>
        <p className="text-sm text-gray-600">Send text and multimedia messages</p>
      </div>
    </div>
    
    {/* Status Indicator */}
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${
        toolsEnabled ? 'bg-green-500' : 'bg-gray-400'
      }`} />
      <Badge variant={toolsEnabled ? "success" : "secondary"} size="sm">
        {toolsEnabled ? `${enabledToolsCount} Available` : 'Disabled'}
      </Badge>
    </div>
  </div>

  {/* Tools Status */}
  {!toolsEnabled ? (
    <div className="text-center py-6">
      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <h4 className="font-medium text-gray-900 mb-2">SMS/MMS Tools Not Available</h4>
      <p className="text-sm text-gray-600 mb-4">
        Connect ClickSend and grant permissions to enable SMS/MMS capabilities
      </p>
      <div className="space-y-2">
        {!hasConnection && (
          <Button
            size="sm"
            onClick={() => router.push('/credentials')}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect ClickSend
          </Button>
        )}
        {hasConnection && !hasPermissions && (
          <Button
            size="sm"
            onClick={() => router.push(`/agents/${agentId}/edit?tab=tools`)}
            className="w-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            Grant Permissions
          </Button>
        )}
      </div>
    </div>
  ) : (
    <div className="space-y-3">
      {/* Available Tools List */}
      <div className="space-y-2">
        {availableTools.map((tool) => (
          <div 
            key={tool.capability_key}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {getToolIcon(tool.capability_key)}
              </div>
              <div>
                <span className="font-medium text-gray-900">{tool.display_label}</span>
                <p className="text-xs text-gray-600">{getToolDescription(tool.capability_key)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="success" size="sm">Ready</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedTool(tool)}
              >
                <Info className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Quick Actions</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickTest('sms')}
            disabled={isTestingTools || !canUseTool('sms')}
            className="flex items-center justify-center"
          >
            {isTestingTools ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <MessageSquare className="w-3 h-3 mr-1" />
            )}
            Test SMS
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickTest('balance')}
            disabled={isTestingTools || !canUseTool('balance')}
            className="flex items-center justify-center"
          >
            {isTestingTools ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <DollarSign className="w-3 h-3 mr-1" />
            )}
            Check Balance
          </Button>
        </div>
      </div>

      {/* Recent Usage Summary */}
      {recentUsage && recentUsage.length > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Recent Usage</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowUsageDetails(!showUsageDetails)}
            >
              <BarChart className="w-3 h-3 mr-1" />
              {showUsageDetails ? 'Hide' : 'Show'}
            </Button>
          </div>
          
          {showUsageDetails && (
            <div className="space-y-2">
              {recentUsage.slice(0, 3).map((usage, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    {getToolIcon(usage.tool_name)}
                    <span className="text-gray-600">{formatToolName(usage.tool_name)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={usage.success ? "success" : "destructive"} 
                      size="xs"
                    >
                      {usage.success ? 'Success' : 'Failed'}
                    </Badge>
                    <span className="text-gray-500">{formatRelativeTime(usage.created_at)}</span>
                  </div>
                </div>
              ))}
              
              {recentUsage.length > 3 && (
                <div className="text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllUsage(true)}
                    className="text-xs"
                  >
                    View All ({recentUsage.length - 3} more)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
```

### 3. Tool Icon and Description Mapping

#### **Tool Visual Identity**
```typescript
const getToolIcon = (toolKey: string) => {
  const iconMap = {
    'clicksend_send_sms': <MessageSquare className="w-4 h-4 text-blue-600" />,
    'clicksend_send_mms': <Image className="w-4 h-4 text-purple-600" />,
    'clicksend_get_balance': <DollarSign className="w-4 h-4 text-green-600" />,
    'clicksend_get_sms_history': <History className="w-4 h-4 text-orange-600" />,
    'clicksend_get_mms_history': <FileImage className="w-4 h-4 text-purple-600" />,
    'clicksend_get_delivery_receipts': <CheckCircle className="w-4 h-4 text-teal-600" />
  };
  
  return iconMap[toolKey] || <Tool className="w-4 h-4 text-gray-600" />;
};

const getToolDescription = (toolKey: string) => {
  const descriptionMap = {
    'clicksend_send_sms': 'Send text messages to phone numbers',
    'clicksend_send_mms': 'Send multimedia messages with images',
    'clicksend_get_balance': 'Check account balance and credits',
    'clicksend_get_sms_history': 'View sent SMS message history',
    'clicksend_get_mms_history': 'View sent MMS message history',
    'clicksend_get_delivery_receipts': 'Check message delivery status'
  };
  
  return descriptionMap[toolKey] || 'ClickSend tool';
};
```

### 4. Tool Detail Modal Design

#### **Tool Information Modal**
```tsx
<Modal isOpen={selectedTool !== null} onClose={() => setSelectedTool(null)} size="md">
  <ModalHeader>
    <div className="flex items-center space-x-3">
      {getToolIcon(selectedTool?.capability_key)}
      <h2>{selectedTool?.display_label}</h2>
    </div>
  </ModalHeader>
  
  <ModalBody>
    <div className="space-y-4">
      {/* Tool Description */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">Description</h3>
        <p className="text-sm text-gray-600">
          {getDetailedDescription(selectedTool?.capability_key)}
        </p>
      </div>

      {/* Parameters */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">Parameters</h3>
        <div className="space-y-2">
          {getToolParameters(selectedTool?.capability_key).map((param) => (
            <div key={param.name} className="flex justify-between items-start p-2 bg-gray-50 rounded">
              <div>
                <span className="font-medium text-sm">{param.name}</span>
                {param.required && <Badge variant="outline" size="xs" className="ml-2">Required</Badge>}
                <p className="text-xs text-gray-600 mt-1">{param.description}</p>
              </div>
              <Badge variant="secondary" size="xs">{param.type}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Examples */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">Usage Examples</h3>
        <div className="space-y-2">
          {getUsageExamples(selectedTool?.capability_key).map((example, index) => (
            <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-900 font-medium mb-1">{example.title}</p>
              <p className="text-xs text-blue-700">{example.description}</p>
              <code className="block mt-2 text-xs bg-blue-100 p-2 rounded">
                {example.example}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Usage */}
      {getToolUsageHistory(selectedTool?.capability_key).length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Recent Usage</h3>
          <div className="space-y-2">
            {getToolUsageHistory(selectedTool?.capability_key).slice(0, 3).map((usage, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <span className="text-sm text-gray-900">
                    {formatUsageDescription(usage)}
                  </span>
                  <p className="text-xs text-gray-600">
                    {formatRelativeTime(usage.created_at)}
                  </p>
                </div>
                <Badge 
                  variant={usage.success ? "success" : "destructive"} 
                  size="sm"
                >
                  {usage.success ? 'Success' : 'Failed'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </ModalBody>
  
  <ModalFooter>
    <Button variant="outline" onClick={() => setSelectedTool(null)}>
      Close
    </Button>
    <Button onClick={() => handleTestTool(selectedTool)}>
      <Play className="w-4 h-4 mr-2" />
      Test Tool
    </Button>
  </ModalFooter>
</Modal>
```

### 5. Quick Test Functionality

#### **Quick Test Implementation**
```typescript
const handleQuickTest = async (toolType: 'sms' | 'balance' | 'mms') => {
  setIsTestingTools(true);
  
  try {
    let result;
    
    switch (toolType) {
      case 'sms':
        result = await testSMSTool();
        break;
      case 'balance':
        result = await testBalanceTool();
        break;
      case 'mms':
        result = await testMMSTool();
        break;
    }
    
    // Show success toast
    toast.success(`${toolType.toUpperCase()} test successful!`);
    
    // Update UI with test results
    setTestResults(prev => ({
      ...prev,
      [toolType]: result
    }));
    
  } catch (error) {
    // Show error toast
    toast.error(`${toolType.toUpperCase()} test failed: ${error.message}`);
  } finally {
    setIsTestingTools(false);
  }
};

const testSMSTool = async () => {
  // Test SMS capability without actually sending
  return await executeAgentTool(agentId, 'clicksend_send_sms', {
    to: '+1234567890', // Test number
    body: 'Test message - not actually sent',
    test_mode: true
  });
};

const testBalanceTool = async () => {
  return await executeAgentTool(agentId, 'clicksend_get_balance', {});
};
```

### 6. Integration with Chat Interface

#### **Tool Execution Feedback in Chat**
```tsx
{/* Tool execution indicator in chat */}
{isExecutingTool && currentTool?.includes('clicksend') && (
  <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
    <div>
      <span className="font-medium text-blue-900">Sending Message...</span>
      <p className="text-sm text-blue-700">Using ClickSend SMS/MMS</p>
    </div>
  </div>
)}

{/* Tool execution result in chat */}
{toolExecutionResult && toolExecutionResult.tool_provider === 'clicksend' && (
  <div className={`p-3 rounded-lg mb-4 ${
    toolExecutionResult.success 
      ? 'bg-green-50 border border-green-200' 
      : 'bg-red-50 border border-red-200'
  }`}>
    <div className="flex items-center space-x-2">
      {toolExecutionResult.success ? (
        <CheckCircle className="w-4 h-4 text-green-600" />
      ) : (
        <XCircle className="w-4 h-4 text-red-600" />
      )}
      <span className={`font-medium ${
        toolExecutionResult.success ? 'text-green-900' : 'text-red-900'
      }`}>
        {toolExecutionResult.success ? 'Message Sent' : 'Message Failed'}
      </span>
    </div>
    
    {toolExecutionResult.data && (
      <div className="mt-2 text-sm text-gray-700">
        <p>To: {toolExecutionResult.data.to}</p>
        <p>Message ID: {toolExecutionResult.data.message_id}</p>
        <p>Cost: ${toolExecutionResult.data.cost}</p>
      </div>
    )}
  </div>
)}
```

### 7. Responsive Design Considerations

#### **Mobile Layout Adjustments**
```css
/* Mobile responsive design */
@media (max-width: 768px) {
  .sms-tools-card {
    padding: 0.75rem;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-actions-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .tool-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .tool-actions {
    margin-top: 0.5rem;
    align-self: flex-end;
  }
}

/* Tablet adjustments */
@media (min-width: 769px) and (max-width: 1024px) {
  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 8. Error State Handling

#### **Tool Error States**
```tsx
{/* No connection error */}
{error?.type === 'no_connection' && (
  <div className="text-center py-4">
    <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
    <h4 className="font-medium text-gray-900 mb-1">Connection Required</h4>
    <p className="text-sm text-gray-600 mb-3">
      Connect your ClickSend account to use SMS/MMS tools
    </p>
    <Button size="sm" onClick={() => router.push('/credentials')}>
      Connect ClickSend
    </Button>
  </div>
)}

{/* Permission error */}
{error?.type === 'no_permissions' && (
  <div className="text-center py-4">
    <Lock className="w-8 h-8 text-red-500 mx-auto mb-2" />
    <h4 className="font-medium text-gray-900 mb-1">Permissions Required</h4>
    <p className="text-sm text-gray-600 mb-3">
      Grant SMS/MMS permissions to this agent
    </p>
    <Button size="sm" onClick={() => router.push(`/agents/${agentId}/edit?tab=tools`)}>
      Grant Permissions
    </Button>
  </div>
)}

{/* API error */}
{error?.type === 'api_error' && (
  <div className="text-center py-4">
    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
    <h4 className="font-medium text-gray-900 mb-1">Service Unavailable</h4>
    <p className="text-sm text-gray-600 mb-3">
      ClickSend service is currently unavailable
    </p>
    <Button size="sm" onClick={() => handleRetry()}>
      <RefreshCw className="w-4 h-4 mr-2" />
      Retry
    </Button>
  </div>
)}
```

### 9. Performance Considerations

#### **Lazy Loading and Caching**
```typescript
// Lazy load tool usage data
const { data: toolUsage, isLoading: isLoadingUsage } = useSWR(
  toolsEnabled ? `/api/agents/${agentId}/tool-usage/clicksend` : null,
  fetcher,
  {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: false
  }
);

// Cache tool availability
const { data: availableTools, isLoading: isLoadingTools } = useSWR(
  `/api/agents/${agentId}/available-tools`,
  fetcher,
  {
    refreshInterval: 60000, // Refresh every minute
    dedupingInterval: 30000 // Dedupe requests within 30 seconds
  }
);

// Optimize re-renders
const memoizedToolsList = useMemo(() => {
  if (!availableTools) return [];
  return availableTools.filter(tool => tool.provider === 'clicksend');
}, [availableTools]);
```

## Integration Testing Checklist

### 1. Visual Integration
- [ ] Tools card matches existing design patterns
- [ ] Icons and colors consistent with brand
- [ ] Responsive design works across devices
- [ ] Loading states display properly

### 2. Functional Integration  
- [ ] Tool availability updates based on permissions
- [ ] Quick tests execute successfully
- [ ] Tool details modal displays correctly
- [ ] Error states handle gracefully

### 3. Performance Integration
- [ ] Data loads efficiently
- [ ] No unnecessary re-renders
- [ ] Caching works properly
- [ ] Mobile performance acceptable

### 4. User Experience Integration
- [ ] Clear call-to-actions for setup
- [ ] Intuitive navigation flows
- [ ] Helpful error messages
- [ ] Consistent interaction patterns

## Next Steps

1. **Component Implementation**: Build the SMS tools tab component
2. **Integration Development**: Integrate with existing tools tab
3. **Testing**: Comprehensive testing across devices and states
4. **Performance Optimization**: Optimize loading and caching
5. **User Testing**: Validate user experience flows

This comprehensive tools tab integration design ensures ClickSend SMS/MMS tools are seamlessly integrated into the existing agent chat interface while providing clear visibility into tool availability, usage, and status.
