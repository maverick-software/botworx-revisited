import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mcpService } from '../../lib/services/mcpService';
import { MCPServerTemplate, MCPDeploymentConfig } from '../../lib/mcp/ui-types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Rocket, Server, CheckCircle, Package } from 'lucide-react';

interface LocationState {
  template?: MCPServerTemplate;
  config?: MCPDeploymentConfig;
}

// Simplified deployment config that matches what the service expects
interface SimpleDeploymentConfig {
  templateId?: string;
  name: string;
  description?: string;
  configuration?: {
    serverType?: string;
    endpoint?: string;
    transport?: string;
    capabilities?: string[];
    [key: string]: any;
  };
}

export const MCPDeployPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [name, setName] = useState(state?.config?.name || state?.template?.name || '');
  const [serverType, setServerType] = useState(state?.template?.id || 'custom');
  const [description, setDescription] = useState(state?.template?.description || '');
  const [endpoint, setEndpoint] = useState('/mcp');
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'websocket'>(
    state?.template?.supportedTransports?.[0] || 'stdio'
  );

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }

    try {
      setIsDeploying(true);
      setError(null);

      const deploymentConfig: SimpleDeploymentConfig = {
        templateId: state?.template?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        configuration: {
          serverType,
          endpoint,
          transport,
          capabilities: state?.template?.requiredCapabilities || ['tools'],
          ...(state?.template?.environment || {})
        }
      };

      const deployment = await mcpService.deployServer(deploymentConfig as any);
      
      console.log('Deployment initiated:', deployment);
      setDeploymentSuccess(true);
      
      // Redirect to servers page after short delay
      setTimeout(() => {
        navigate('/mcp/servers');
      }, 2000);

    } catch (err) {
      console.error('Deployment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to deploy MCP server');
    } finally {
      setIsDeploying(false);
    }
  };

  if (deploymentSuccess) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-900">Deployment Successful!</h1>
            <p className="text-muted-foreground mt-2">
              Your MCP server "{name}" has been deployed successfully.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/mcp/servers')}>
              View My Servers
            </Button>
            <Button variant="outline" onClick={() => navigate('/mcp/marketplace')}>
              Deploy Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-8">
        {/* Navigation */}
        <nav className="text-sm text-muted-foreground">
                          <a href="/agents" className="hover:text-foreground transition-colors">Agents</a>
          <span className="mx-2">/</span>
          <a href="/mcp/servers" className="hover:text-foreground transition-colors">MCP Servers</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Deploy Server</span>
        </nav>

        {/* Header */}
        <div className="space-y-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/mcp/marketplace')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Rocket className="h-10 w-10 text-primary" />
              Deploy MCP Server
            </h1>
            <p className="text-lg text-muted-foreground">
              Configure and deploy your MCP server instance
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Deployment Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Server Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDeploy} className="space-y-6">
                  {/* Selected Template Display (if from marketplace) */}
                  {state?.template && (
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <div className="flex items-start gap-3">
                        <Package className="h-5 w-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{state.template.name}</h3>
                            <Badge variant="secondary">{state.template.version}</Badge>
                            {state.template.verified && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Verified
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            by {state.template.author}
                          </p>
                          <p className="text-sm">{state.template.description}</p>
                          <div className="flex gap-1 mt-2">
                            {state.template.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Server Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My MCP Server"
                        required
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        A unique name for your MCP server instance
                      </p>
                    </div>

                    {/* Only show Server Type dropdown if no template provided */}
                    {!state?.template && (
                      <div>
                        <Label htmlFor="serverType">Server Type</Label>
                        <Select value={serverType} onValueChange={setServerType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select server type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aws-tools">AWS Tools</SelectItem>
                            <SelectItem value="github-tools">GitHub Tools</SelectItem>
                            <SelectItem value="slack-tools">Slack Tools</SelectItem>
                            <SelectItem value="database-tools">Database Tools</SelectItem>
                            <SelectItem value="custom">Custom Server</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of this server's purpose"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Technical Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Technical Settings</h3>
                    
                    <div>
                      <Label htmlFor="endpoint">Endpoint Path</Label>
                      <Input
                        id="endpoint"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        placeholder="/mcp"
                      />
                    </div>

                    <div>
                      <Label htmlFor="transport">Transport Protocol</Label>
                      <Select value={transport} onValueChange={(value: any) => setTransport(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stdio">Standard I/O</SelectItem>
                          <SelectItem value="sse">Server-Sent Events</SelectItem>
                          <SelectItem value="websocket">WebSocket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      disabled={isDeploying || !name.trim()}
                      className="flex-1"
                    >
                      {isDeploying ? 'Deploying...' : 'Deploy Server'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => navigate('/mcp/marketplace')}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Configuration Summary */}
          <div className="space-y-6">
            {state?.template && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Template Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Docker Image:</span>
                    <p className="text-muted-foreground break-all">{state.template.dockerImage}</p>
                  </div>
                  <div>
                    <span className="font-medium">Capabilities:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {state.template.requiredCapabilities.map((cap) => (
                        <Badge key={cap} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Resource Requirements:</span>
                    <p className="text-muted-foreground">
                      Memory: {state.template.resourceRequirements.memory}<br />
                      CPU: {state.template.resourceRequirements.cpu}
                    </p>
                  </div>
                  {state.template.documentation && (
                    <div>
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <a href={state.template.documentation} target="_blank" rel="noopener noreferrer">
                          View Documentation
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Deployment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-medium">{name || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-medium">
                    {state?.template ? state.template.name : serverType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Transport:</span>
                  <span className="font-medium">{transport}</span>
                </div>
                <div className="flex justify-between">
                  <span>Endpoint:</span>
                  <span className="font-medium">{endpoint}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}; 