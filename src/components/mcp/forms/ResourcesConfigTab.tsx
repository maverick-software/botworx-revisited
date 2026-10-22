import React from 'react';
import { MCPServer } from '@/lib/mcp/ui-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface ResourcesConfigTabProps {
  config: Partial<MCPServer>;
  validationErrors: Record<string, string>;
  readOnly: boolean;
  onInputChange: (field: keyof MCPServer, value: any) => void;
  onNestedChange: (parent: keyof MCPServer, field: string, value: any) => void;
}

export const ResourcesConfigTab: React.FC<ResourcesConfigTabProps> = ({
  config,
  validationErrors,
  readOnly,
  onNestedChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Resource Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cpu_limit">CPU Limit (cores)</Label>
            <Input
              id="cpu_limit"
              type="number"
              step="0.1"
              value={config.resourceUsage?.cpu.cores || ''}
              onChange={(e) => onNestedChange('resourceUsage', 'cpu.cores', parseFloat(e.target.value))}
              placeholder="1.0"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label htmlFor="memory_limit">Memory Limit (MB)</Label>
            <Input
              id="memory_limit"
              type="number"
              value={config.resourceUsage?.memory.limit || ''}
              onChange={(e) => onNestedChange('resourceUsage', 'memory.limit', parseInt(e.target.value))}
              placeholder="512"
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Current Resource Usage</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">CPU Usage</div>
              <div className="text-muted-foreground">
                {config.resourceUsage?.cpu.percentage?.toFixed(1) || '0'}%
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">Memory Usage</div>
              <div className="text-muted-foreground">
                {config.resourceUsage?.memory.used || 0} MB / {config.resourceUsage?.memory.limit || 0} MB
                ({config.resourceUsage?.memory.percentage?.toFixed(1) || '0'}%)
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Network Usage</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">Bytes In</div>
              <div className="text-muted-foreground">
                {config.resourceUsage?.network.bytesIn?.toLocaleString() || 0} bytes
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-medium">Bytes Out</div>
              <div className="text-muted-foreground">
                {config.resourceUsage?.network.bytesOut?.toLocaleString() || 0} bytes
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 