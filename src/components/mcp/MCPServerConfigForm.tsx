import React from 'react';
import { MCPServer } from '@/lib/mcp/ui-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, Activity, Network, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MCPServerConfigFormProps {
  config: Partial<MCPServer>;
  validationErrors: Record<string, string>;
  readOnly: boolean;
  onInputChange: (field: keyof MCPServer, value: any) => void;
  onNestedChange: (parent: keyof MCPServer, field: string, value: any) => void;
}

export const GeneralConfigForm: React.FC<MCPServerConfigFormProps> = ({
  config,
  validationErrors,
  readOnly,
  onInputChange
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        General Settings
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Server Name *</Label>
          <Input
            id="name"
            value={config.name || ''}
            onChange={(e) => onInputChange('name', e.target.value)}
            className={cn(validationErrors.name && "border-destructive")}
            disabled={readOnly}
          />
          {validationErrors.name && (
            <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="endpoint">Endpoint *</Label>
          <Input
            id="endpoint"
            value={config.endpoint || ''}
            onChange={(e) => onInputChange('endpoint', e.target.value)}
            className={cn(validationErrors.endpoint && "border-destructive")}
            disabled={readOnly}
            placeholder="e.g., http://localhost:3000"
          />
          {validationErrors.endpoint && (
            <p className="text-sm text-destructive mt-1">{validationErrors.endpoint}</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="port">Port *</Label>
          <Input
            id="port"
            type="number"
            min="1"
            max="65535"
            value={config.port || ''}
            onChange={(e) => onInputChange('port', parseInt(e.target.value))}
            className={cn(validationErrors.port && "border-destructive")}
            disabled={readOnly}
          />
          {validationErrors.port && (
            <p className="text-sm text-destructive mt-1">{validationErrors.port}</p>
          )}
        </div>
        <div>
          <Label htmlFor="protocol">Protocol</Label>
          <Select
            value={config.protocol || 'http'}
            onValueChange={(value) => onInputChange('protocol', value)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">HTTP</SelectItem>
              <SelectItem value="https">HTTPS</SelectItem>
              <SelectItem value="websocket">WebSocket</SelectItem>
              <SelectItem value="stdio">STDIO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={config.description || ''}
          onChange={(e) => onInputChange('description', e.target.value)}
          placeholder="Optional description for this server"
          rows={2}
          disabled={readOnly}
        />
      </div>
    </CardContent>
  </Card>
);

export const ResourceConfigForm: React.FC<MCPServerConfigFormProps> = ({
  config,
  readOnly,
  onInputChange
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Resource Limits
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="memory">Memory Limit</Label>
          <Input
            id="memory"
            value={config.memoryLimit || ''}
            onChange={(e) => onInputChange('memoryLimit', e.target.value)}
            placeholder="e.g., 512Mi, 1Gi"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label htmlFor="cpu">CPU Limit</Label>
          <Input
            id="cpu"
            value={config.cpuLimit || ''}
            onChange={(e) => onInputChange('cpuLimit', e.target.value)}
            placeholder="e.g., 0.5, 1.0"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label htmlFor="storage">Storage</Label>
          <Input
            id="storage"
            value={config.storageLimit || ''}
            onChange={(e) => onInputChange('storageLimit', e.target.value)}
            placeholder="e.g., 1Gi, 10Gi"
            disabled={readOnly}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-scaling</Label>
            <p className="text-sm text-muted-foreground">
              Enable automatic scaling based on resource usage
            </p>
          </div>
          <Switch
            checked={config.autoScale || false}
            onCheckedChange={(checked) => onInputChange('autoScale', checked)}
            disabled={readOnly}
          />
        </div>

        {config.autoScale && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div>
              <Label htmlFor="minReplicas">Min Replicas</Label>
              <Input
                id="minReplicas"
                type="number"
                min="1"
                value={config.minReplicas || 1}
                onChange={(e) => onInputChange('minReplicas', parseInt(e.target.value))}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="maxReplicas">Max Replicas</Label>
              <Input
                id="maxReplicas"
                type="number"
                min="1"
                value={config.maxReplicas || 3}
                onChange={(e) => onInputChange('maxReplicas', parseInt(e.target.value))}
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export const NetworkConfigForm: React.FC<MCPServerConfigFormProps> = ({
  config,
  readOnly,
  onInputChange
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Network className="h-5 w-5" />
        Network Settings
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>External Access</Label>
            <p className="text-sm text-muted-foreground">
              Allow external connections to this server
            </p>
          </div>
          <Switch
            checked={config.externalAccess || false}
            onCheckedChange={(checked) => onInputChange('externalAccess', checked)}
            disabled={readOnly}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Load Balancer</Label>
            <p className="text-sm text-muted-foreground">
              Use load balancer for high availability
            </p>
          </div>
          <Switch
            checked={config.loadBalancer || false}
            onCheckedChange={(checked) => onInputChange('loadBalancer', checked)}
            disabled={readOnly}
          />
        </div>

        <div>
          <Label htmlFor="customDomains">Custom Domains</Label>
          <Textarea
            id="customDomains"
            value={config.customDomains?.join('\n') || ''}
            onChange={(e) => onInputChange('customDomains', e.target.value.split('\n').filter(d => d.trim()))}
            placeholder="Enter custom domains, one per line"
            rows={3}
            disabled={readOnly}
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const AdvancedConfigForm: React.FC<MCPServerConfigFormProps> = ({
  config,
  readOnly,
  onInputChange
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Shield className="h-5 w-5" />
        Advanced Settings
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Health Monitoring</Label>
            <p className="text-sm text-muted-foreground">
              Enable automatic health checks
            </p>
          </div>
          <Switch
            checked={config.healthMonitoring || false}
            onCheckedChange={(checked) => onInputChange('healthMonitoring', checked)}
            disabled={readOnly}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Performance Monitoring</Label>
            <p className="text-sm text-muted-foreground">
              Collect performance metrics
            </p>
          </div>
          <Switch
            checked={config.performanceMonitoring || false}
            onCheckedChange={(checked) => onInputChange('performanceMonitoring', checked)}
            disabled={readOnly}
          />
        </div>

        <div>
          <Label htmlFor="logLevel">Log Level</Label>
          <Select
            value={config.logLevel || 'info'}
            onValueChange={(value) => onInputChange('logLevel', value)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="environment">Environment Variables</Label>
          <Textarea
            id="environment"
            value={Object.entries(config.environment || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
            onChange={(e) => {
              const env = {};
              e.target.value.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                  env[key.trim()] = valueParts.join('=').trim();
                }
              });
              onInputChange('environment', env);
            }}
            placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
            rows={5}
            disabled={readOnly}
          />
        </div>
      </div>
    </CardContent>
  </Card>
); 