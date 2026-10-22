import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMailgunIntegration } from '@/hooks/useMailgunIntegration';
import { useAgents } from '@/hooks/useAgents';
import { Mail, Key, Settings, Route, TestTube, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const MailgunIntegration: React.FC = () => {
  const {
    configuration,
    routes,
    isLoading,
    error,
    saveConfiguration,
    createRoute,
    deleteRoute,
    testConnection
  } = useMailgunIntegration();

  const { agents } = useAgents();

  const [configForm, setConfigForm] = useState({
    domain: '',
    apiKey: '',
    region: 'us',
    webhookUrl: ''
  });

  const [routeForm, setRouteForm] = useState({
    priority: 0,
    expression: '',
    action: '',
    description: '',
    agent_id: ''
  });

  const [showRouteForm, setShowRouteForm] = useState(false);

  // Load existing configuration into form
  useEffect(() => {
    if (configuration) {
      setConfigForm(prev => ({
        ...prev,
        domain: configuration.domain,
        region: configuration.region,
        webhookUrl: configuration.webhook_url || ''
      }));
    }
  }, [configuration]);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveConfiguration(configForm);
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRoute({
      priority: routeForm.priority,
      expression: routeForm.expression,
      action: routeForm.action,
      description: routeForm.description,
      agent_id: routeForm.agent_id || undefined,
      is_active: true
    });
    
    // Reset form and hide it
    setRouteForm({
      priority: 0,
      expression: '',
      action: '',
      description: '',
      agent_id: ''
    });
    setShowRouteForm(false);
  };

  const handleTestConnection = async () => {
    await testConnection();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
            <Mail className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Mailgun Integration</h2>
            <p className="text-muted-foreground">
              Configure Mailgun for high-deliverability email sending and inbound routing
            </p>
          </div>
        </div>
        
        {configuration && (
          <div className="flex items-center space-x-2">
            <Badge variant={configuration.is_active ? "default" : "secondary"}>
              {configuration.is_active ? "Active" : "Inactive"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isLoading}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="routing">
            <Route className="h-4 w-4 mr-2" />
            Email Routing
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>API Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure your Mailgun domain and API credentials for email sending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfigSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Mailgun Domain</Label>
                    <Input
                      id="domain"
                      value={configForm.domain}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, domain: e.target.value }))}
                      placeholder="mail.yourdomain.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Your verified Mailgun sending domain
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select 
                      value={configForm.region}
                      onValueChange={(value) => setConfigForm(prev => ({ ...prev, region: value }))}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">United States</SelectItem>
                        <SelectItem value="eu">Europe</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Select the Mailgun region for your domain
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={configForm.apiKey}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="key-your-mailgun-api-key"
                    required={!configuration}
                  />
                  {configuration ? (
                    <p className="text-xs text-muted-foreground">
                      Leave empty to keep existing API key
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Your Mailgun API key (starts with "key-")
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
                  <Input
                    id="webhookUrl"
                    value={configForm.webhookUrl}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://your-app.com/webhook/mailgun"
                  />
                  <p className="text-xs text-muted-foreground">
                    Custom webhook URL for inbound email processing (optional)
                  </p>
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : configuration ? 'Update Configuration' : 'Save Configuration'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Routing Tab */}
        <TabsContent value="routing">
          <div className="space-y-6">
            {/* Routes Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Email Routes</h3>
                <p className="text-sm text-muted-foreground">
                  Define rules for routing inbound emails to specific agents
                </p>
              </div>
              <Button
                onClick={() => setShowRouteForm(!showRouteForm)}
                disabled={!configuration}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Route
              </Button>
            </div>

            {/* Create Route Form */}
            {showRouteForm && configuration && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Email Route</CardTitle>
                  <CardDescription>
                    Define a rule for routing inbound emails
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRouteSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Input
                          id="priority"
                          type="number"
                          value={routeForm.priority}
                          onChange={(e) => setRouteForm(prev => ({ 
                            ...prev, 
                            priority: parseInt(e.target.value) || 0 
                          }))}
                          placeholder="0"
                          min="0"
                          max="32767"
                        />
                        <p className="text-xs text-muted-foreground">
                          Lower numbers = higher priority
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agentId">Assign to Agent (Optional)</Label>
                        <Select
                          value={routeForm.agent_id}
                          onValueChange={(value) => setRouteForm(prev => ({ ...prev, agent_id: value }))}
                        >
                          <SelectTrigger id="agentId">
                            <SelectValue placeholder="Select agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No Agent</SelectItem>
                            {agents.map(agent => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Agent to process matching emails
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expression">Route Expression</Label>
                      <Input
                        id="expression"
                        value={routeForm.expression}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, expression: e.target.value }))}
                        placeholder='match_recipient("support@yourdomain.com")'
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Mailgun expression to match emails (e.g., match_recipient, match_header)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="action">Action</Label>
                      <Input
                        id="action"
                        value={routeForm.action}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, action: e.target.value }))}
                        placeholder='forward("https://your-app.com/webhook")'
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Action to take (e.g., forward, store, stop)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={routeForm.description}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Route support emails to support agent"
                      />
                      <p className="text-xs text-muted-foreground">
                        Human-readable description of this route
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" disabled={isLoading}>
                        Create Route
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setShowRouteForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Existing Routes */}
            <Card>
              <CardHeader>
                <CardTitle>Configured Routes</CardTitle>
                <CardDescription>
                  Your email routing rules (processed in priority order)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!configuration ? (
                  <div className="text-center py-8">
                    <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Configure Mailgun first to set up email routes
                    </p>
                  </div>
                ) : routes.length === 0 ? (
                  <div className="text-center py-8">
                    <Route className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No email routes configured yet
                    </p>
                    <Button
                      onClick={() => setShowRouteForm(true)}
                      className="mt-4"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Route
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routes.map((route) => (
                      <div
                        key={route.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              Priority: {route.priority}
                            </Badge>
                            <Badge variant={route.is_active ? "default" : "secondary"}>
                              {route.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {route.agent_id && (
                              <Badge variant="secondary">
                                Agent: {(route as any).agents?.name || 'Unknown'}
                              </Badge>
                            )}
                          </div>
                          {route.description && (
                            <p className="font-medium">{route.description}</p>
                          )}
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Expression:</span> {route.expression}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Action:</span> {route.action}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => route.id && deleteRoute(route.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
