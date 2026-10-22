// src/components/mcp/MCPServerDeployment.tsx
import React, { useState, useEffect } from 'react';
import { MCPServerDeploymentProps, MCPDeploymentConfig } from '@/lib/mcp/ui-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  Play, 
  X, 
  Settings, 
  Server, 
  Shield, 
  Activity, 
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MCPServerDeployment: React.FC<MCPServerDeploymentProps> = ({
  template,
  onDeploy,
  onCancel,
  availableCredentials = [],
  defaultConfig,
  loading = false,
  error
}) => {
  const [config, setConfig] = useState<MCPDeploymentConfig>({
    templateId: template.id,
    name: template.name,
    description: `Deployed ${template.name} server`,
    environment: 'development',
    configuration: {},
    resourceLimits: {
      memory: template.resourceRequirements.memory,
      cpu: template.resourceRequirements.cpu,
      storage: template.resourceRequirements.storage
    },
    scaling: {
      replicas: 1,
      autoScale: false
    },
    networking: {
      expose: true,
      ports: [],
      domains: []
    },
    credentials: [],
    healthCheck: {
      enabled: true,
      interval: 30,
      timeout: 10,
      retries: 3
    },
    monitoring: {
      enabled: true,
      alerts: false,
      logLevel: 'info'
    },
    ...defaultConfig
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (defaultConfig) {
      setConfig(prev => ({ ...prev, ...defaultConfig }));
    }
  }, [defaultConfig]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!config.name.trim()) {
      errors.name = 'Server name is required';
    } else if (config.name.length < 3) {
      errors.name = 'Server name must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(config.name)) {
      errors.name = 'Server name can only contain letters, numbers, hyphens, and underscores';
    }

    if (!config.resourceLimits.memory) {
      errors.memory = 'Memory limit is required';
    }

    if (!config.resourceLimits.cpu) {
      errors.cpu = 'CPU limit is required';
    }

    if (config.scaling.autoScale && (!config.scaling.minReplicas || !config.scaling.maxReplicas)) {
      errors.scaling = 'Min and max replicas are required when auto-scaling is enabled';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDeploy = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onDeploy(config);
    } catch (err) {
      console.error('Deployment failed:', err);
    }
  };

  const handleInputChange = (field: keyof MCPDeploymentConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNestedChange = (
    parent: keyof MCPDeploymentConfig,
    field: string,
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deploy MCP Server</h2>
          <p className="text-muted-foreground">Configure and deploy {template.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {template.verified && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Shield className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
          <Badge variant="outline">v{template.version}</Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Basic Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Server Name *</Label>
                  <Input
                    id="name"
                    value={config.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={cn(validationErrors.name && "border-destructive")}
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="environment">Environment</Label>
                  <Select
                    value={config.environment}
                    onValueChange={(value: 'development' | 'staging' | 'production') => 
                      handleInputChange('environment', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={config.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Optional description for this deployment"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resource Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Resource Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="memory">Memory Limit *</Label>
                  <Input
                    id="memory"
                    value={config.resourceLimits.memory}
                    onChange={(e) => handleNestedChange('resourceLimits', 'memory', e.target.value)}
                    placeholder="e.g., 512Mi, 1Gi"
                    className={cn(validationErrors.memory && "border-destructive")}
                  />
                  {validationErrors.memory && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.memory}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="cpu">CPU Limit *</Label>
                  <Input
                    id="cpu"
                    value={config.resourceLimits.cpu}
                    onChange={(e) => handleNestedChange('resourceLimits', 'cpu', e.target.value)}
                    placeholder="e.g., 0.5, 1.0"
                    className={cn(validationErrors.cpu && "border-destructive")}
                  />
                  {validationErrors.cpu && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.cpu}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="storage">Storage (Optional)</Label>
                  <Input
                    id="storage"
                    value={config.resourceLimits.storage || ''}
                    onChange={(e) => handleNestedChange('resourceLimits', 'storage', e.target.value)}
                    placeholder="e.g., 1Gi, 10Gi"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scaling & Networking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Advanced Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-scaling</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically scale based on resource usage
                    </p>
                  </div>
                  <Switch
                    checked={config.scaling.autoScale}
                    onCheckedChange={(checked) => handleNestedChange('scaling', 'autoScale', checked)}
                  />
                </div>

                {config.scaling.autoScale && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <Label htmlFor="minReplicas">Min Replicas</Label>
                      <Input
                        id="minReplicas"
                        type="number"
                        min="1"
                        value={config.scaling.minReplicas || 1}
                        onChange={(e) => handleNestedChange('scaling', 'minReplicas', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxReplicas">Max Replicas</Label>
                      <Input
                        id="maxReplicas"
                        type="number"
                        min="1"
                        value={config.scaling.maxReplicas || 3}
                        onChange={(e) => handleNestedChange('scaling', 'maxReplicas', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Health Monitoring</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable automatic health checks
                    </p>
                  </div>
                  <Switch
                    checked={config.healthCheck.enabled}
                    onCheckedChange={(checked) => handleNestedChange('healthCheck', 'enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Monitoring & Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable performance monitoring
                    </p>
                  </div>
                  <Switch
                    checked={config.monitoring.enabled}
                    onCheckedChange={(checked) => handleNestedChange('monitoring', 'enabled', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Template Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Author</Label>
                <p className="text-sm text-muted-foreground">{template.author}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <p className="text-sm text-muted-foreground">
                  {template.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Required Resources</Label>
                <div className="text-sm text-muted-foreground">
                  <p>Memory: {template.resourceRequirements.memory}</p>
                  <p>CPU: {template.resourceRequirements.cpu}</p>
                  {template.resourceRequirements.storage && (
                    <p>Storage: {template.resourceRequirements.storage}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deployment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deployment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Environment:</span>
                <Badge variant="outline">{config.environment}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Auto-scaling:</span>
                <span>{config.scaling.autoScale ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Monitoring:</span>
                <span>{config.monitoring.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />
                You can modify these settings after deployment
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleDeploy} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Deploying...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Deploy Server
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPServerDeployment; 