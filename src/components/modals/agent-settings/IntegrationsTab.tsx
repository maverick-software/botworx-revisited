import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plug, ExternalLink } from 'lucide-react';

interface IntegrationsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export function IntegrationsTab({ agentId, agentData, onAgentUpdated }: IntegrationsTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Third-Party Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Manage connections to external services and APIs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Integration Management
          </CardTitle>
          <CardDescription>
            This section provides access to the full integrations interface where you can configure API keys, OAuth connections, and third-party services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 border border-dashed border-border rounded-lg text-center">
            <div className="p-3 bg-primary/10 rounded-lg inline-block mb-4">
              <Plug className="w-8 h-8 text-primary" />
            </div>
            <h4 className="font-medium mb-2">Full Integration Interface</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Access the complete tools and integrations modal to configure:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 text-sm">
              <div className="text-left">
                <h5 className="font-medium mb-1">API Integrations</h5>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Web Search APIs</li>
                  <li>• Email Services</li>
                  <li>• Voice Synthesis</li>
                  <li>• Document APIs</li>
                </ul>
              </div>
              <div className="text-left">
                <h5 className="font-medium mb-1">OAuth Services</h5>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Gmail Integration</li>
                  <li>• Slack Workspace</li>
                  <li>• Google Drive</li>
                  <li>• Microsoft 365</li>
                </ul>
              </div>
            </div>
            <Button className="w-full max-w-xs">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Integrations Manager
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg inline-block mb-2">
                  <Plug className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h5 className="font-medium text-sm">API Keys</h5>
                <p className="text-xs text-muted-foreground">
                  Manage service API keys
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg inline-block mb-2">
                  <Plug className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h5 className="font-medium text-sm">OAuth</h5>
                <p className="text-xs text-muted-foreground">
                  Connect OAuth services
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg inline-block mb-2">
                  <Plug className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h5 className="font-medium text-sm">MCP Servers</h5>
                <p className="text-xs text-muted-foreground">
                  Connect MCP tools
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
