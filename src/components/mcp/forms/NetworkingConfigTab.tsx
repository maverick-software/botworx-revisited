import React from 'react';
import { MCPServer } from '@/lib/mcp/ui-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

interface NetworkingConfigTabProps {
  config: Partial<MCPServer>;
  validationErrors: Record<string, string>;
  readOnly: boolean;
  onInputChange: (field: keyof MCPServer, value: any) => void;
  onNestedChange: (parent: keyof MCPServer, field: string, value: any) => void;
}

export const NetworkingConfigTab: React.FC<NetworkingConfigTabProps> = ({
  config,
  validationErrors,
  readOnly,
  onInputChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Network Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="vault_api_key_id">API Key ID (Vault)</Label>
            <Input
              id="vault_api_key_id"
              value={config.vault_api_key_id || ''}
              onChange={(e) => onInputChange('vault_api_key_id', e.target.value)}
              placeholder="UUID from Supabase Vault"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Reference to encrypted API key in Supabase Vault
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Server Information</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">Server ID</div>
                <div className="text-muted-foreground">{config.id || 'Not assigned'}</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">Config ID</div>
                <div className="text-muted-foreground">{config.config_id || 'Not assigned'}</div>
              </div>
            </div>
          </div>

          <div>
            <Label>Connection Status</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">Last Seen</div>
                <div className="text-muted-foreground">
                  {config.lastSeen ? new Date(config.lastSeen).toLocaleString() : 'Never'}
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">Health Status</div>
                <div className="text-muted-foreground">
                  {config.health?.overall || 'Unknown'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label>Server Capabilities</Label>
            <div className="p-3 bg-muted rounded-lg mt-2">
              <div className="text-sm">
                {config.capabilities ? (
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(config.capabilities, null, 2)}
                  </pre>
                ) : (
                  <div className="text-muted-foreground">No capabilities discovered yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 