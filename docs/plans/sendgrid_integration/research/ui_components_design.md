# SendGrid UI Components Design Research

## Date: August 2, 2025
## Related WBS Items: 3.1, 4.4

## Overview
This document outlines the UI components needed for the SendGrid integration, following Agentopia's design patterns and component library.

## Component Architecture

### 1. SendGridIntegration Component
Main integration setup and configuration interface.

```typescript
// Location: src/components/integrations/SendGridIntegration.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mail, Key, Shield, Settings, AlertCircle, CheckCircle } from 'lucide-react';

interface SendGridIntegrationProps {
  userId: string;
  onConfigurationComplete?: () => void;
}

export const SendGridIntegration: React.FC<SendGridIntegrationProps> = ({
  userId,
  onConfigurationComplete
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [config, setConfig] = useState<SendGridConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Mail className="h-6 w-6 text-primary" />
          <CardTitle>SendGrid Integration</CardTitle>
        </div>
        <CardDescription>
          Connect your SendGrid account to enable email sending and receiving capabilities for your agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="inbound">Inbound Email</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <APIKeySetup 
              onKeyValidated={(key) => handleAPIKeyValidation(key)}
              isValidating={isValidating}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <SendGridSettings 
              config={config}
              onUpdate={(updates) => handleConfigUpdate(updates)}
            />
          </TabsContent>

          <TabsContent value="inbound" className="space-y-4">
            <InboundEmailSetup 
              config={config}
              onDomainConfigured={(domain) => handleDomainConfiguration(domain)}
            />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecuritySettings 
              config={config}
              onSecurityUpdate={(settings) => handleSecurityUpdate(settings)}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
```

### 2. API Key Setup Component
```typescript
const APIKeySetup: React.FC<APIKeySetupProps> = ({ onKeyValidated, isValidating }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const validateAPIKey = async () => {
    setValidationResult(null);
    const result = await validateSendGridAPIKey(apiKey);
    setValidationResult(result);
    
    if (result.valid) {
      onKeyValidated(apiKey);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="api-key">SendGrid API Key</Label>
        <div className="flex space-x-2">
          <Input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          You can find your API key in your SendGrid account under Settings → API Keys
        </p>
      </div>

      {validationResult && (
        <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {validationResult.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <Button
          onClick={validateAPIKey}
          disabled={!apiKey || isValidating}
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : (
            'Validate API Key'
          )}
        </Button>

        <a
          href="https://app.sendgrid.com/settings/api_keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Get SendGrid API Key →
        </a>
      </div>
    </div>
  );
};
```

### 3. Agent Email Settings Component
```typescript
// Location: src/components/agent/AgentEmailSettings.tsx

interface AgentEmailSettingsProps {
  agentId: string;
  sendGridConfig: SendGridConfig;
  onUpdate: (settings: AgentEmailSettings) => void;
}

export const AgentEmailSettings: React.FC<AgentEmailSettingsProps> = ({
  agentId,
  sendGridConfig,
  onUpdate
}) => {
  const [permissions, setPermissions] = useState<AgentPermissions>({
    can_send_email: true,
    can_use_templates: false,
    can_send_bulk: false,
    can_receive_emails: false,
    daily_send_limit: 100,
    recipients_per_email_limit: 10
  });

  const [emailAddress, setEmailAddress] = useState<string>('');
  const [autoReply, setAutoReply] = useState<AutoReplySettings | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Settings</CardTitle>
        <CardDescription>
          Configure email capabilities and addresses for this agent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Address Assignment */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Email Address</h3>
          <div className="flex items-center space-x-2">
            <Input
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="agent-name"
              className="max-w-xs"
            />
            <span className="text-muted-foreground">@{sendGridConfig.inbound_domain}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Emails sent to this address will be routed to this agent
          </p>
        </div>

        {/* Permissions */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Permissions</h3>
          <div className="space-y-3">
            <PermissionToggle
              label="Send Emails"
              description="Allow agent to send emails"
              checked={permissions.can_send_email}
              onCheckedChange={(checked) => 
                setPermissions({ ...permissions, can_send_email: checked })
              }
            />
            <PermissionToggle
              label="Use Templates"
              description="Allow agent to use email templates"
              checked={permissions.can_use_templates}
              onCheckedChange={(checked) => 
                setPermissions({ ...permissions, can_use_templates: checked })
              }
            />
            <PermissionToggle
              label="Bulk Sending"
              description="Allow agent to send bulk emails"
              checked={permissions.can_send_bulk}
              onCheckedChange={(checked) => 
                setPermissions({ ...permissions, can_send_bulk: checked })
              }
            />
            <PermissionToggle
              label="Receive Emails"
              description="Allow agent to receive and process emails"
              checked={permissions.can_receive_emails}
              onCheckedChange={(checked) => 
                setPermissions({ ...permissions, can_receive_emails: checked })
              }
            />
          </div>
        </div>

        {/* Limits */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Usage Limits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Daily Send Limit</Label>
              <Input
                type="number"
                value={permissions.daily_send_limit}
                onChange={(e) => 
                  setPermissions({ 
                    ...permissions, 
                    daily_send_limit: parseInt(e.target.value) 
                  })
                }
                min={1}
                max={10000}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipients per Email</Label>
              <Input
                type="number"
                value={permissions.recipients_per_email_limit}
                onChange={(e) => 
                  setPermissions({ 
                    ...permissions, 
                    recipients_per_email_limit: parseInt(e.target.value) 
                  })
                }
                min={1}
                max={1000}
              />
            </div>
          </div>
        </div>

        {/* Auto Reply Settings */}
        {permissions.can_receive_emails && (
          <AutoReplySettings
            settings={autoReply}
            onUpdate={setAutoReply}
          />
        )}

        <div className="flex justify-end">
          <Button onClick={() => onUpdate({ permissions, emailAddress, autoReply })}>
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 4. Email Routing Rules Component
```typescript
// Location: src/components/email/EmailRoutingRules.tsx

interface EmailRoutingRulesProps {
  configId: string;
  onRuleUpdate: (rules: RoutingRule[]) => void;
}

export const EmailRoutingRules: React.FC<EmailRoutingRulesProps> = ({
  configId,
  onRuleUpdate
}) => {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [isAddingRule, setIsAddingRule] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email Routing Rules</CardTitle>
            <CardDescription>
              Define rules to automatically process incoming emails
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsAddingRule(true)}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 && !isAddingRule ? (
          <EmptyState
            icon={<Filter className="h-12 w-12 text-muted-foreground" />}
            title="No routing rules"
            description="Create rules to automatically route and process incoming emails"
            action={
              <Button onClick={() => setIsAddingRule(true)}>
                Create First Rule
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {rules.map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                priority={index + 1}
                onEdit={(updated) => handleRuleEdit(rule.id, updated)}
                onDelete={() => handleRuleDelete(rule.id)}
                onReorder={(direction) => handleReorder(index, direction)}
              />
            ))}
            
            {isAddingRule && (
              <RuleEditor
                onSave={(rule) => {
                  setRules([...rules, rule]);
                  setIsAddingRule(false);
                }}
                onCancel={() => setIsAddingRule(false)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### 5. Inbox Viewer Component
```typescript
// Location: src/components/email/InboxViewer.tsx

interface InboxViewerProps {
  agentId?: string;
  configId: string;
}

export const InboxViewer: React.FC<InboxViewerProps> = ({ agentId, configId }) => {
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [filters, setFilters] = useState<EmailFilters>({
    search: '',
    from: '',
    dateFrom: null,
    dateTo: null,
    hasAttachments: null
  });

  return (
    <div className="flex h-[600px] divide-x">
      {/* Email List */}
      <div className="w-1/3 flex flex-col">
        <div className="p-4 border-b">
          <Input
            placeholder="Search emails..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full"
          />
          <div className="mt-2 flex items-center space-x-2">
            <Badge variant="secondary">
              {emails.length} emails
            </Badge>
            <FilterMenu
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {emails.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              isSelected={selectedEmail?.id === email.id}
              onClick={() => setSelectedEmail(email)}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Email Detail */}
      <div className="flex-1 flex flex-col">
        {selectedEmail ? (
          <>
            <EmailHeader email={selectedEmail} />
            <Separator />
            <EmailContent email={selectedEmail} />
            {selectedEmail.attachments.length > 0 && (
              <>
                <Separator />
                <AttachmentList attachments={selectedEmail.attachments} />
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4" />
              <p>Select an email to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 6. SendGrid Analytics Dashboard
```typescript
interface SendGridAnalyticsDashboard {
  configId: string;
  dateRange: DateRange;
}

export const SendGridAnalytics: React.FC<SendGridAnalyticsDashboard> = ({
  configId,
  dateRange
}) => {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Emails Sent"
          value={metrics?.sent || 0}
          change={metrics?.sentChange || 0}
          icon={<Send className="h-4 w-4" />}
        />
        <MetricCard
          title="Delivered"
          value={metrics?.delivered || 0}
          change={metrics?.deliveredChange || 0}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <MetricCard
          title="Open Rate"
          value={`${metrics?.openRate || 0}%`}
          change={metrics?.openRateChange || 0}
          icon={<Eye className="h-4 w-4" />}
        />
        <MetricCard
          title="Click Rate"
          value={`${metrics?.clickRate || 0}%`}
          change={metrics?.clickRateChange || 0}
          icon={<MousePointer className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailActivityChart data={metrics?.activityData || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engagement Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementChart data={metrics?.engagementData || []} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Email Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivityList 
            activities={metrics?.recentActivities || []} 
          />
        </CardContent>
      </Card>
    </div>
  );
};
```

## Design System Integration

### Color Scheme
Following Agentopia's theme system:
- Primary: Blue for SendGrid branding
- Success: Green for successful operations
- Warning: Yellow for limits/warnings
- Destructive: Red for errors/failures

### Component Patterns
1. **Cards**: Primary container for sections
2. **Tabs**: Organize complex interfaces
3. **Forms**: Consistent input styling
4. **Badges**: Status indicators
5. **Alerts**: Feedback messages
6. **Modals**: Confirmation dialogs

### Responsive Design
- Mobile-first approach
- Collapsible sidebars on mobile
- Touch-friendly controls
- Adaptive layouts

## State Management

### Component State Structure
```typescript
interface SendGridUIState {
  // Configuration
  config: SendGridConfig | null;
  isConfigured: boolean;
  
  // Agent Settings
  agentPermissions: Record<string, AgentPermissions>;
  agentEmailAddresses: Record<string, string>;
  
  // Email Management
  inboundEmails: InboundEmail[];
  emailFilters: EmailFilters;
  selectedEmail: InboundEmail | null;
  
  // Routing Rules
  routingRules: RoutingRule[];
  activeRuleId: string | null;
  
  // Analytics
  metrics: EmailMetrics | null;
  dateRange: DateRange;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  activeTab: string;
}
```

### Data Fetching Hooks
```typescript
// Custom hooks for data management
export const useSendGridConfig = (userId: string) => {
  const [config, setConfig] = useState<SendGridConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchSendGridConfig(userId).then(setConfig).finally(() => setIsLoading(false));
  }, [userId]);
  
  return { config, isLoading, refetch: () => fetchSendGridConfig(userId) };
};

export const useInboundEmails = (filters: EmailFilters) => {
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setIsLoading(true);
    fetchInboundEmails(filters).then(setEmails).finally(() => setIsLoading(false));
  }, [filters]);
  
  return { emails, isLoading };
};
```

## Accessibility Considerations

1. **Keyboard Navigation**: Full keyboard support
2. **Screen Readers**: Proper ARIA labels
3. **Focus Management**: Logical tab order
4. **Color Contrast**: WCAG AA compliance
5. **Error Messages**: Clear and descriptive

## Performance Optimizations

1. **Lazy Loading**: Load components on demand
2. **Virtualization**: For large email lists
3. **Debouncing**: Search and filter inputs
4. **Caching**: Store frequently accessed data
5. **Optimistic Updates**: Immediate UI feedback

## Error Handling UI

```typescript
const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundaryComponent
      fallback={(error) => (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {error.message || 'An unexpected error occurred'}
          </AlertDescription>
        </Alert>
      )}
    >
      {children}
    </ErrorBoundaryComponent>
  );
};
```

## Integration Points

1. **With Agent Management**: Email settings in agent editor
2. **With Integrations Page**: SendGrid card and setup
3. **With Dashboard**: Email metrics widgets
4. **With Settings**: Global SendGrid configuration
5. **With Workspace**: Email-based collaboration

## Next Steps

1. Create detailed Figma mockups
2. Build component library
3. Implement state management
4. Add real-time updates
5. Create comprehensive tests