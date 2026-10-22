# Agent Permissions Interface Design for ClickSend Integration

## Research Date
September 11, 2025

## Purpose
Design the agent permissions interface for ClickSend SMS/MMS integration, ensuring seamless integration with existing agent permission system and providing granular control over SMS/MMS capabilities.

## Agent Permissions Architecture

### 1. Integration with Existing Agent Edit Page

#### **Location in Agent Edit Interface**
The ClickSend permissions interface integrates into the existing agent edit page structure:

```
Agent Edit Page
├── Basic Settings Tab
├── Knowledge & Memory Tab  
├── Tools & Integrations Tab
│   ├── Existing Integrations (Gmail, Outlook, etc.)
│   └── ClickSend SMS/MMS ← New Integration
└── Advanced Settings Tab
```

#### **Integration Point**
`src/pages/agents/[agentId]/edit.tsx` - Tools & Integrations Tab

### 2. Permission Flow Architecture

#### **User Permission Flow**
```
1. User connects ClickSend account (Credentials Page)
2. User navigates to Agent Edit → Tools & Integrations
3. User grants ClickSend permissions to specific agent
4. Agent can now use SMS/MMS tools when chatting with user
```

#### **Permission Inheritance Model**
```
User ClickSend Connection (Full Access)
├── SMS Sending ✓
├── MMS Sending ✓  
├── Balance Checking ✓
├── Message History ✓
└── Delivery Receipts ✓

Agent Permission (Subset of User Access)
├── SMS Sending → User Choice
├── MMS Sending → User Choice
├── Balance Checking → User Choice
├── Message History → User Choice  
└── Delivery Receipts → User Choice
```

### 3. Permission Interface Design

#### **Main Permission Card**
```tsx
<div className="border border-gray-200 rounded-lg p-6 space-y-6">
  {/* Header Section */}
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
        <MessageSquare className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">ClickSend SMS/MMS</h3>
        <p className="text-sm text-gray-600">Allow agent to send SMS and MMS messages</p>
      </div>
    </div>
    
    {/* Status Badge */}
    <div className="flex items-center space-x-2">
      {hasActivePermissions && (
        <Badge variant="success" className="flex items-center space-x-1">
          <CheckCircle className="w-3 h-3" />
          <span>Active</span>
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Hide Details' : 'Show Details'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTestPermissions}>
            Test Permissions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleViewUsage}>
            View Usage
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>

  {/* Connection Status Check */}
  {!userHasClickSendConnection ? (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-yellow-800">ClickSend Account Required</h4>
          <p className="text-sm text-yellow-700 mt-1">
            Connect your ClickSend account first to enable SMS/MMS capabilities for this agent.
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={() => router.push('/credentials')}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Connect ClickSend
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      {/* Quick Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900">Enable SMS/MMS Access</h4>
          <p className="text-sm text-gray-600">
            Grant this agent permission to send messages on your behalf
          </p>
        </div>
        <Switch
          checked={hasAnyPermissions}
          onCheckedChange={handleToggleAllPermissions}
          disabled={isUpdatingPermissions}
        />
      </div>

      {/* Detailed Permissions */}
      {hasAnyPermissions && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0">
              <span className="font-medium text-gray-900">Permission Details</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-3 mt-4">
            {/* SMS Sending Permission */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-gray-900">Send SMS Messages</h5>
                  <p className="text-sm text-gray-600">Allow agent to send text messages to phone numbers</p>
                  <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                    <span>• Standard SMS rates apply</span>
                    <span>• 160 character limit per message</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={permissions.includes('sms')}
                  onCheckedChange={(checked) => handlePermissionChange('sms', checked)}
                  disabled={isUpdatingPermissions}
                />
              </div>
            </div>

            {/* MMS Sending Permission */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Image className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-gray-900">Send MMS Messages</h5>
                  <p className="text-sm text-gray-600">Allow agent to send multimedia messages with images and videos</p>
                  <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                    <span>• Higher rates than SMS</span>
                    <span>• 5MB file size limit</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={permissions.includes('mms')}
                  onCheckedChange={(checked) => handlePermissionChange('mms', checked)}
                  disabled={isUpdatingPermissions}
                />
              </div>
            </div>

            {/* Balance Checking Permission */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-gray-900">Check Account Balance</h5>
                  <p className="text-sm text-gray-600">Allow agent to view ClickSend account balance and usage</p>
                  <div className="mt-1 text-xs text-gray-500">
                    <span>• Read-only access to account information</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={permissions.includes('balance')}
                  onCheckedChange={(checked) => handlePermissionChange('balance', checked)}
                  disabled={isUpdatingPermissions}
                />
              </div>
            </div>

            {/* Message History Permission */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <History className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-gray-900">Access Message History</h5>
                  <p className="text-sm text-gray-600">Allow agent to view sent message history and delivery status</p>
                  <div className="mt-1 text-xs text-gray-500">
                    <span>• View messages sent by this agent only</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={permissions.includes('history')}
                  onCheckedChange={(checked) => handlePermissionChange('history', checked)}
                  disabled={isUpdatingPermissions}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Usage Statistics */}
      {hasAnyPermissions && usageStats && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-900">Recent Usage (Last 30 Days)</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetailedStats(!showDetailedStats)}
              className="text-blue-700 hover:text-blue-900"
            >
              {showDetailedStats ? 'Hide' : 'Show'} Details
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-900">{usageStats.sms_sent}</div>
              <div className="text-sm text-blue-700">SMS Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-900">{usageStats.mms_sent}</div>
              <div className="text-sm text-blue-700">MMS Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-900">{usageStats.balance_checks}</div>
              <div className="text-sm text-blue-700">Balance Checks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-900">{usageStats.history_queries}</div>
              <div className="text-sm text-blue-700">History Queries</div>
            </div>
          </div>

          {showDetailedStats && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Last SMS sent:</span>
                  <span className="text-blue-900">{formatRelativeTime(usageStats.last_sms_sent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Last MMS sent:</span>
                  <span className="text-blue-900">{formatRelativeTime(usageStats.last_mms_sent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Success rate:</span>
                  <span className="text-blue-900">{usageStats.success_rate}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {hasAnyPermissions && (
        <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUsageModal(true)}
          >
            <BarChart className="w-4 h-4 mr-2" />
            View Usage
          </Button>
          
          <Button
            size="sm"
            variant="destructive"
            onClick={handleRevokeAllPermissions}
            disabled={isUpdatingPermissions}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Revoke Access
          </Button>
        </div>
      )}
    </div>
  )}

  {/* Loading Overlay */}
  {isUpdatingPermissions && (
    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
      <div className="text-center">
        <Loader2 className="w-6 h-6 text-blue-600 mx-auto mb-2 animate-spin" />
        <p className="text-sm text-gray-600">Updating permissions...</p>
      </div>
    </div>
  )}
</div>
```

### 4. Permission State Management

#### **Permission States**
```typescript
interface ClickSendPermissionState {
  // Connection state
  hasConnection: boolean;
  connectionStatus: 'active' | 'inactive' | 'error';
  
  // Permission state
  hasPermissions: boolean;
  permissions: string[]; // ['sms', 'mms', 'balance', 'history']
  
  // UI state
  isLoading: boolean;
  isUpdating: boolean;
  showDetails: boolean;
  
  // Usage data
  usageStats?: {
    sms_sent: number;
    mms_sent: number;
    balance_checks: number;
    history_queries: number;
    last_sms_sent?: Date;
    last_mms_sent?: Date;
    success_rate: number;
  };
}
```

#### **Permission Actions**
```typescript
const permissionActions = {
  // Toggle all permissions on/off
  toggleAllPermissions: async (agentId: string, enabled: boolean) => {
    const scopes = enabled ? ['sms', 'mms', 'balance', 'history'] : [];
    return await updateAgentPermissions(agentId, 'clicksend_sms', scopes);
  },
  
  // Toggle individual permission
  togglePermission: async (agentId: string, scope: string, enabled: boolean) => {
    const currentPermissions = await getAgentPermissions(agentId, 'clicksend_sms');
    const newPermissions = enabled 
      ? [...currentPermissions, scope]
      : currentPermissions.filter(p => p !== scope);
    return await updateAgentPermissions(agentId, 'clicksend_sms', newPermissions);
  },
  
  // Test connection
  testConnection: async (agentId: string) => {
    return await testAgentToolAccess(agentId, 'clicksend_get_balance', {});
  },
  
  // Revoke all permissions
  revokeAllPermissions: async (agentId: string) => {
    return await deleteAgentPermissions(agentId, 'clicksend_sms');
  }
};
```

### 5. Permission Validation UI

#### **Real-time Permission Testing**
```tsx
<div className="space-y-4">
  <h4 className="font-medium text-gray-900">Test Agent Permissions</h4>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* SMS Test */}
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="font-medium">SMS Test</span>
        </div>
        <Badge variant={smsTestResult?.success ? "success" : smsTestResult?.success === false ? "destructive" : "secondary"}>
          {smsTestResult?.success ? "Pass" : smsTestResult?.success === false ? "Fail" : "Not Tested"}
        </Badge>
      </div>
      
      <Button
        size="sm"
        variant="outline"
        onClick={() => testSMSPermission()}
        disabled={isTestingSMS || !permissions.includes('sms')}
        className="w-full"
      >
        {isTestingSMS ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        Test SMS Access
      </Button>
      
      {smsTestResult && (
        <div className="mt-2 text-xs text-gray-600">
          {smsTestResult.message}
        </div>
      )}
    </div>

    {/* MMS Test */}
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Image className="w-4 h-4 text-purple-600" />
          <span className="font-medium">MMS Test</span>
        </div>
        <Badge variant={mmsTestResult?.success ? "success" : mmsTestResult?.success === false ? "destructive" : "secondary"}>
          {mmsTestResult?.success ? "Pass" : mmsTestResult?.success === false ? "Fail" : "Not Tested"}
        </Badge>
      </div>
      
      <Button
        size="sm"
        variant="outline"
        onClick={() => testMMSPermission()}
        disabled={isTestingMMS || !permissions.includes('mms')}
        className="w-full"
      >
        {isTestingMMS ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        Test MMS Access
      </Button>
      
      {mmsTestResult && (
        <div className="mt-2 text-xs text-gray-600">
          {mmsTestResult.message}
        </div>
      )}
    </div>
  </div>
</div>
```

### 6. Permission Security Considerations

#### **Security Validation**
```typescript
const securityValidation = {
  // Validate user owns the ClickSend connection
  validateUserConnection: async (userId: string, connectionId: string) => {
    const connection = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();
    
    return connection.data !== null;
  },
  
  // Validate agent belongs to user
  validateAgentOwnership: async (userId: string, agentId: string) => {
    const agent = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();
    
    return agent.data !== null;
  },
  
  // Validate permission scopes
  validatePermissionScopes: (requestedScopes: string[], availableScopes: string[]) => {
    return requestedScopes.every(scope => availableScopes.includes(scope));
  }
};
```

#### **Permission Audit Trail**
```typescript
interface PermissionAuditLog {
  id: string;
  agent_id: string;
  user_id: string;
  action: 'granted' | 'revoked' | 'modified';
  previous_scopes: string[];
  new_scopes: string[];
  granted_by: string;
  timestamp: Date;
  ip_address?: string;
  user_agent?: string;
}

const auditPermissionChange = async (
  agentId: string,
  userId: string,
  action: string,
  previousScopes: string[],
  newScopes: string[]
) => {
  await supabase.from('agent_permission_audit_logs').insert({
    agent_id: agentId,
    user_id: userId,
    action,
    previous_scopes: previousScopes,
    new_scopes: newScopes,
    granted_by: userId,
    timestamp: new Date(),
  });
};
```

### 7. Error Handling and User Guidance

#### **Common Error States**
```tsx
// No ClickSend connection
<div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
  <div className="flex items-center">
    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
    <span className="font-medium text-yellow-800">ClickSend Account Required</span>
  </div>
  <p className="mt-1 text-sm text-yellow-700">
    Connect your ClickSend account to enable SMS/MMS capabilities.
  </p>
</div>

// Connection error
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <div className="flex items-center">
    <XCircle className="w-5 h-5 text-red-600 mr-2" />
    <span className="font-medium text-red-800">Connection Error</span>
  </div>
  <p className="mt-1 text-sm text-red-700">
    Unable to verify ClickSend connection. Please check your credentials.
  </p>
</div>

// Permission update error
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <div className="flex items-center">
    <XCircle className="w-5 h-5 text-red-600 mr-2" />
    <span className="font-medium text-red-800">Permission Update Failed</span>
  </div>
  <p className="mt-1 text-sm text-red-700">
    Failed to update agent permissions. Please try again.
  </p>
</div>
```

### 8. Mobile Responsive Design

#### **Mobile Layout Adjustments**
```css
/* Mobile-first responsive design */
@media (max-width: 768px) {
  .permission-card {
    padding: 1rem;
  }
  
  .permission-grid {
    grid-template-columns: 1fr;
  }
  
  .permission-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .permission-toggle {
    margin-top: 0.75rem;
    align-self: flex-end;
  }
  
  .usage-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

## Integration Points

### 1. Agent Edit Page Integration
- Seamlessly integrates with existing Tools & Integrations tab
- Follows same design patterns as Gmail/Outlook permissions
- Maintains consistent spacing and visual hierarchy

### 2. Credentials Page Integration  
- Links to credentials page when no connection exists
- Provides clear call-to-action for connection setup
- Maintains user flow continuity

### 3. Agent Chat Integration
- Permissions control tool availability in chat
- Real-time permission validation during tool execution
- Clear error messages when permissions insufficient

## Next Steps

1. **Component Implementation**: Build the agent permissions component
2. **Integration Testing**: Test with existing agent edit interface
3. **Permission Flow Testing**: Validate complete permission workflow
4. **Security Audit**: Verify all security measures are implemented
5. **User Experience Testing**: Ensure intuitive permission management

This comprehensive agent permissions interface design ensures users have granular control over ClickSend SMS/MMS capabilities while maintaining security and providing clear visual feedback throughout the permission management process.
