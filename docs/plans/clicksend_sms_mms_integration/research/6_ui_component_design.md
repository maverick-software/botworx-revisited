# UI Component Design for ClickSend Integration

## Research Date
September 11, 2025

## Purpose
Design the user interface components for ClickSend SMS/MMS integration, ensuring consistency with existing Agentopia UI patterns and providing excellent user experience.

## UI Component Architecture

### 1. ClickSend Setup Modal Design

#### **Component Location**
`src/integrations/clicksend/components/ClickSendSetupModal.tsx`

#### **Interface Design**
```typescript
interface ClickSendSetupModalProps {
  integration: Integration;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (connection: UserIntegrationCredential) => void;
  onError: (error: string) => void;
  user: User;
  supabase: SupabaseClient;
}
```

#### **Modal Structure**
```tsx
<Modal isOpen={isOpen} onClose={onClose} size="md">
  <ModalHeader>
    <div className="flex items-center space-x-3">
      <MessageSquare className="w-6 h-6 text-blue-600" />
      <h2>Connect ClickSend SMS/MMS</h2>
    </div>
  </ModalHeader>
  
  <ModalBody>
    {/* Setup Instructions */}
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
      <ol className="text-sm text-blue-800 space-y-1">
        <li>1. Sign up for ClickSend account at https://clicksend.com</li>
        <li>2. Navigate to API Credentials in your dashboard</li>
        <li>3. Copy your Username and API Key</li>
        <li>4. Enter credentials below</li>
      </ol>
    </div>

    {/* Credential Form */}
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ClickSend Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your ClickSend username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your ClickSend API key"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connection Name (Optional)
          </label>
          <input
            type="text"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            placeholder="e.g., Main SMS Account"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Test Connection Button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={!username || !apiKey || isTestingConnection}
          className="w-full mb-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          {isTestingConnection ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing Connection...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <Zap className="w-4 h-4 mr-2" />
              Test Connection
            </span>
          )}
        </button>
      </div>

      {/* Connection Test Results */}
      {testResult && (
        <div className={`mb-4 p-3 rounded-md ${
          testResult.success 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 mr-2" />
            )}
            <span className="font-medium">
              {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
            </span>
          </div>
          {testResult.details && (
            <p className="mt-1 text-sm">{testResult.details}</p>
          )}
        </div>
      )}
    </form>
  </ModalBody>

  <ModalFooter>
    <button
      onClick={onClose}
      className="px-4 py-2 text-gray-600 hover:text-gray-800"
    >
      Cancel
    </button>
    <button
      onClick={handleSubmit}
      disabled={!username || !apiKey || isConnecting}
      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
    >
      {isConnecting ? (
        <span className="flex items-center">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Connecting...
        </span>
      ) : (
        'Connect ClickSend'
      )}
    </button>
  </ModalFooter>
</Modal>
```

#### **Key Features**
- **Clear Setup Instructions**: Step-by-step guide for obtaining credentials
- **Secure Input Handling**: Password field with show/hide toggle
- **Connection Testing**: Test credentials before saving
- **Real-time Validation**: Form validation with helpful error messages
- **Loading States**: Visual feedback during connection process
- **Success/Error Feedback**: Clear indication of connection status

### 2. Agent SMS Permissions Component Design

#### **Component Location**
`src/integrations/clicksend/components/AgentClickSendPermissions.tsx`

#### **Interface Design**
```typescript
interface AgentClickSendPermissionsProps {
  agent: Agent;
  user: User;
  onPermissionsChange: (permissions: AgentIntegrationPermission[]) => void;
}
```

#### **Component Structure**
```tsx
<div className="space-y-6">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <MessageSquare className="w-5 h-5 text-blue-600" />
      <h3 className="text-lg font-semibold">ClickSend SMS/MMS Permissions</h3>
    </div>
    <Badge variant={hasPermissions ? "success" : "secondary"}>
      {hasPermissions ? "Configured" : "Not Configured"}
    </Badge>
  </div>

  {/* Connection Status */}
  {!hasConnection ? (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
        <span className="font-medium text-yellow-800">No ClickSend Connection</span>
      </div>
      <p className="mt-1 text-sm text-yellow-700">
        Connect your ClickSend account first to enable SMS/MMS capabilities for this agent.
      </p>
      <button
        onClick={() => setShowSetupModal(true)}
        className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
      >
        Connect ClickSend
      </button>
    </div>
  ) : (
    <div className="space-y-4">
      {/* Current Connection Info */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="font-medium text-green-800">Connected to ClickSend</span>
          </div>
          <span className="text-sm text-green-700">
            {connection.connection_name || connection.external_username}
          </span>
        </div>
      </div>

      {/* Permission Toggle */}
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900">Enable SMS/MMS Access</h4>
          <p className="text-sm text-gray-600">
            Allow this agent to send SMS and MMS messages on your behalf
          </p>
        </div>
        <Switch
          checked={hasPermissions}
          onCheckedChange={handleTogglePermissions}
          disabled={isUpdating}
        />
      </div>

      {/* Detailed Permissions */}
      {hasPermissions && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Granted Capabilities</h4>
          
          {/* SMS Permissions */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 text-blue-600 mr-2" />
              <div>
                <span className="font-medium text-gray-900">Send SMS</span>
                <p className="text-xs text-gray-600">Send text messages to phone numbers</p>
              </div>
            </div>
            <Checkbox
              checked={permissions.includes('sms')}
              onCheckedChange={(checked) => handleScopeChange('sms', checked)}
              disabled={isUpdating}
            />
          </div>

          {/* MMS Permissions */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <Image className="w-4 h-4 text-purple-600 mr-2" />
              <div>
                <span className="font-medium text-gray-900">Send MMS</span>
                <p className="text-xs text-gray-600">Send multimedia messages with images/videos</p>
              </div>
            </div>
            <Checkbox
              checked={permissions.includes('mms')}
              onCheckedChange={(checked) => handleScopeChange('mms', checked)}
              disabled={isUpdating}
            />
          </div>

          {/* Balance Check Permissions */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 text-green-600 mr-2" />
              <div>
                <span className="font-medium text-gray-900">Check Balance</span>
                <p className="text-xs text-gray-600">View account balance and usage</p>
              </div>
            </div>
            <Checkbox
              checked={permissions.includes('balance')}
              onCheckedChange={(checked) => handleScopeChange('balance', checked)}
              disabled={isUpdating}
            />
          </div>

          {/* History Permissions */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <History className="w-4 h-4 text-orange-600 mr-2" />
              <div>
                <span className="font-medium text-gray-900">Message History</span>
                <p className="text-xs text-gray-600">View sent message history and delivery status</p>
              </div>
            </div>
            <Checkbox
              checked={permissions.includes('history')}
              onCheckedChange={(checked) => handleScopeChange('history', checked)}
              disabled={isUpdating}
            />
          </div>
        </div>
      )}

      {/* Usage Statistics */}
      {hasPermissions && usageStats && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Recent Usage</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">SMS Sent:</span>
              <span className="ml-2 font-medium text-blue-900">{usageStats.sms_sent}</span>
            </div>
            <div>
              <span className="text-blue-700">MMS Sent:</span>
              <span className="ml-2 font-medium text-blue-900">{usageStats.mms_sent}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
</div>
```

### 3. SMS Tools Tab Integration Design

#### **Component Location**
`src/integrations/clicksend/components/SMSToolsTab.tsx`

#### **Integration Point**
Integrated into existing `AgentChatPage` tools tab

#### **Component Structure**
```tsx
<div className="space-y-4">
  {/* SMS Tools Header */}
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      <MessageSquare className="w-5 h-5 text-blue-600" />
      <h3 className="font-semibold text-gray-900">SMS/MMS Tools</h3>
    </div>
    <Badge variant={isEnabled ? "success" : "secondary"}>
      {isEnabled ? "Enabled" : "Disabled"}
    </Badge>
  </div>

  {/* Tool Status */}
  {!isEnabled ? (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
      <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
      <p className="text-sm text-gray-600">SMS/MMS tools not available</p>
      <p className="text-xs text-gray-500 mt-1">
        Connect ClickSend and grant permissions to enable
      </p>
    </div>
  ) : (
    <div className="space-y-2">
      {/* Available Tools */}
      {availableTools.map((tool) => (
        <div key={tool.capability_key} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${tool.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            <div>
              <span className="font-medium text-gray-900">{tool.display_label}</span>
              <p className="text-xs text-gray-600">{tool.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {tool.enabled && (
              <Badge variant="success" size="sm">Available</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => showToolDetails(tool)}
            >
              <Info className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}

      {/* Quick Actions */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Quick Actions</h4>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => testSMSConnection()}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-1" />
            )}
            Test SMS
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => checkBalance()}
            disabled={isCheckingBalance}
          >
            {isCheckingBalance ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4 mr-1" />
            )}
            Check Balance
          </Button>
        </div>
      </div>
    </div>
  )}
</div>
```

### 4. Credentials Page Integration Design

#### **Integration Point**
`src/pages/CredentialsPage.tsx` - Add ClickSend to existing credentials list

#### **ClickSend Connection Card**
```tsx
<div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
        <MessageSquare className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">ClickSend SMS/MMS</h3>
        <p className="text-sm text-gray-600">Send SMS and MMS messages</p>
      </div>
    </div>
    <Badge variant={connection?.connection_status === 'active' ? "success" : "secondary"}>
      {connection?.connection_status === 'active' ? 'Connected' : 'Not Connected'}
    </Badge>
  </div>

  {/* Connection Details */}
  {connection ? (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Account:</span>
        <span className="font-medium text-gray-900">{connection.external_username}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Connected:</span>
        <span className="text-gray-900">{formatDate(connection.created_at)}</span>
      </div>
      
      {/* Action Buttons */}
      <div className="flex space-x-2 pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => testConnection()}
          disabled={isTestingConnection}
        >
          {isTestingConnection ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-1" />
          )}
          Test
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowEditModal(true)}
        >
          <Edit className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleDisconnect()}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Disconnect
        </Button>
      </div>
    </div>
  ) : (
    <div className="text-center py-4">
      <p className="text-sm text-gray-600 mb-3">
        Connect your ClickSend account to enable SMS/MMS capabilities
      </p>
      <Button
        onClick={() => setShowSetupModal(true)}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Connect ClickSend
      </Button>
    </div>
  )}
</div>
```

## Visual Design Specifications

### 1. Color Scheme
- **Primary**: Blue (#2563EB) - Matches SMS/messaging theme
- **Success**: Green (#10B981) - Connection success, enabled states
- **Warning**: Yellow (#F59E0B) - Missing connections, cautions
- **Error**: Red (#EF4444) - Connection failures, errors
- **Gray**: (#6B7280) - Secondary text, borders

### 2. Icons
- **SMS**: `MessageSquare` - Primary SMS icon
- **MMS**: `Image` - Multimedia messages
- **Balance**: `DollarSign` - Account balance
- **History**: `History` - Message history
- **Test**: `Zap` - Connection testing
- **Settings**: `Settings` - Configuration
- **Status**: `CheckCircle`, `XCircle`, `AlertTriangle`

### 3. Layout Patterns
- **Modals**: Consistent with existing integration setup modals
- **Cards**: Rounded corners, subtle shadows, hover effects
- **Forms**: Proper spacing, clear labels, validation states
- **Buttons**: Consistent sizing, loading states, disabled states

### 4. Responsive Design
- **Mobile**: Stack elements vertically, adjust spacing
- **Tablet**: Maintain card layout with adjusted sizing
- **Desktop**: Full feature layout with optimal spacing

## Accessibility Considerations

### 1. Keyboard Navigation
- All interactive elements accessible via keyboard
- Proper tab order throughout components
- Focus indicators visible and clear

### 2. Screen Reader Support
- Proper ARIA labels for all form elements
- Status announcements for connection states
- Descriptive text for icon-only buttons

### 3. Color Accessibility
- Sufficient contrast ratios for all text
- Status indicators not solely dependent on color
- High contrast mode support

### 4. Form Accessibility
- Required field indicators
- Error messages clearly associated with fields
- Helpful placeholder text and instructions

## Error State Designs

### 1. Connection Errors
```tsx
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <div className="flex items-center">
    <XCircle className="w-5 h-5 text-red-600 mr-2" />
    <span className="font-medium text-red-800">Connection Failed</span>
  </div>
  <p className="mt-1 text-sm text-red-700">
    Unable to connect to ClickSend. Please check your credentials and try again.
  </p>
  <div className="mt-3 flex space-x-2">
    <Button size="sm" variant="outline" onClick={retryConnection}>
      Try Again
    </Button>
    <Button size="sm" variant="ghost" onClick={showTroubleshooting}>
      Troubleshooting
    </Button>
  </div>
</div>
```

### 2. Permission Errors
```tsx
<div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
  <div className="flex items-center">
    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
    <span className="font-medium text-yellow-800">Insufficient Permissions</span>
  </div>
  <p className="mt-1 text-sm text-yellow-700">
    This agent doesn't have SMS permissions. Grant access in agent settings.
  </p>
</div>
```

## Loading State Designs

### 1. Connection Testing
```tsx
<div className="flex items-center justify-center p-8">
  <div className="text-center">
    <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
    <p className="text-sm text-gray-600">Testing ClickSend connection...</p>
  </div>
</div>
```

### 2. Permission Updates
```tsx
<div className="relative">
  {isUpdating && (
    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
    </div>
  )}
  {/* Permission content */}
</div>
```

## Next Steps

1. **Component Implementation**: Build each UI component following these designs
2. **Integration Testing**: Test components with existing Agentopia UI
3. **Accessibility Audit**: Verify all accessibility requirements are met
4. **Responsive Testing**: Ensure proper display across all screen sizes
5. **User Experience Testing**: Validate intuitive user flows

This comprehensive UI design ensures that ClickSend integration provides a seamless, accessible, and visually consistent experience within the Agentopia platform.
