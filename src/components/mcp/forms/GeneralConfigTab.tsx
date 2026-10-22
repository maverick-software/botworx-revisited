import React from 'react';
import { MCPServer } from '@/lib/mcp/ui-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneralConfigTabProps {
  config: Partial<MCPServer>;
  validationErrors: Record<string, string>;
  readOnly: boolean;
  onInputChange: (field: keyof MCPServer, value: any) => void;
  onNestedChange: (parent: keyof MCPServer, field: string, value: any) => void;
}

export const GeneralConfigTab: React.FC<GeneralConfigTabProps> = ({
  config,
  validationErrors,
  readOnly,
  onInputChange
}) => {
  return (
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
            <Label htmlFor="endpoint_url">Endpoint URL *</Label>
            <Input
              id="endpoint_url"
              value={config.endpoint_url || ''}
              onChange={(e) => onInputChange('endpoint_url', e.target.value)}
              className={cn(validationErrors.endpoint_url && "border-destructive")}
              disabled={readOnly}
              placeholder="e.g., http://localhost:3000"
            />
            {validationErrors.endpoint_url && (
              <p className="text-sm text-destructive mt-1">{validationErrors.endpoint_url}</p>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="timeout_ms">Timeout (ms)</Label>
            <Input
              id="timeout_ms"
              type="number"
              value={config.timeout_ms || ''}
              onChange={(e) => onInputChange('timeout_ms', parseInt(e.target.value))}
              disabled={readOnly}
              placeholder="5000"
            />
          </div>
          <div>
            <Label htmlFor="max_retries">Max Retries</Label>
            <Input
              id="max_retries"
              type="number"
              value={config.max_retries || ''}
              onChange={(e) => onInputChange('max_retries', parseInt(e.target.value))}
              disabled={readOnly}
              placeholder="3"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="retry_backoff_ms">Retry Backoff (ms)</Label>
            <Input
              id="retry_backoff_ms"
              type="number"
              value={config.retry_backoff_ms || ''}
              onChange={(e) => onInputChange('retry_backoff_ms', parseInt(e.target.value))}
              disabled={readOnly}
              placeholder="1000"
            />
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={config.priority || ''}
              onChange={(e) => onInputChange('priority', parseInt(e.target.value))}
              disabled={readOnly}
              placeholder="1"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Active</Label>
            <p className="text-sm text-muted-foreground">
              Enable this MCP server connection
            </p>
          </div>
          <Switch
            checked={config.is_active || false}
            onCheckedChange={(checked) => onInputChange('is_active', checked)}
            disabled={readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
}; 