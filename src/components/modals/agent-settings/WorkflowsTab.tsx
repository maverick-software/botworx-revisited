import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, Plus, Settings, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowsTabProps {
  agentId: string;
}

export function WorkflowsTab({ agentId }: WorkflowsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Workflows</h3>
        <p className="text-sm text-muted-foreground">
          Configure automated workflows and process flows for this agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Agent Workflows
          </CardTitle>
          <CardDescription>
            Manage automated workflows that this agent can execute
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">No workflows configured</h4>
              <p className="text-sm text-muted-foreground">
                Create workflows to automate complex tasks and processes
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Settings</CardTitle>
          <CardDescription>
            Configure how this agent handles workflow execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto-execute workflows</label>
              <p className="text-xs text-muted-foreground">
                Allow workflows to run automatically when triggered
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Workflow notifications</label>
              <p className="text-xs text-muted-foreground">
                Send notifications when workflows complete
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
