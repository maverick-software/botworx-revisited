import React from 'react';
import { MCPServer } from '@/lib/mcp/ui-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

interface AdvancedConfigTabProps {
  config: Partial<MCPServer>;
  validationErrors: Record<string, string>;
  readOnly: boolean;
  onInputChange: (field: keyof MCPServer, value: any) => void;
  onNestedChange: (parent: keyof MCPServer, field: string, value: any) => void;
}

export const AdvancedConfigTab: React.FC<AdvancedConfigTabProps> = ({
  config,
  validationErrors,
  readOnly,
  onInputChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Advanced Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label>Server Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {config.tags?.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              )) || <div className="text-sm text-muted-foreground">No tags assigned</div>}
            </div>
          </div>

          <div>
            <Label>Health Monitoring</Label>
            <div className="space-y-3 mt-2">
              {config.health && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Response Time</div>
                    <div className="text-muted-foreground">
                      {config.health.checks.responseTime} ms
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Error Rate</div>
                    <div className="text-muted-foreground">
                      {config.health.checks.errorRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Connectivity</div>
                    <div className="text-muted-foreground">
                      {config.health.checks.connectivity ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Last Checked</div>
                    <div className="text-muted-foreground">
                      {new Date(config.health.lastChecked).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Server Status Information</Label>
            <div className="space-y-3 mt-2">
              {config.status && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Uptime</div>
                    <div className="text-muted-foreground">
                      {config.status.uptime ? `${Math.floor(config.status.uptime / 3600)}h ${Math.floor((config.status.uptime % 3600) / 60)}m` : 'Unknown'}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Restart Count</div>
                    <div className="text-muted-foreground">
                      {config.status.restartCount || 0}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Last Started</div>
                    <div className="text-muted-foreground">
                      {config.status.lastStarted ? new Date(config.status.lastStarted).toLocaleString() : 'Never'}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium">Last Error</div>
                    <div className="text-muted-foreground text-xs">
                      {config.status.lastError || 'None'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Deployment Information</Label>
            <div className="p-3 bg-muted rounded-lg mt-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium">Deployment ID</div>
                  <div className="text-muted-foreground">{config.deploymentId || 'Not deployed'}</div>
                </div>
                <div>
                  <div className="font-medium">Priority Level</div>
                  <div className="text-muted-foreground">{config.priority || 'Default'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 