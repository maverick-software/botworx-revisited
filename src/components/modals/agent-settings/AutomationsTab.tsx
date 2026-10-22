import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Plus, Settings, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface AutomationsTabProps {
  agentId: string;
}

export function AutomationsTab({ agentId }: AutomationsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Automations</h3>
        <p className="text-sm text-muted-foreground">
          Set up automated actions and triggers for this agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Active Automations
          </CardTitle>
          <CardDescription>
            Manage automated actions that run based on triggers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">No automations configured</h4>
              <p className="text-sm text-muted-foreground">
                Create automations to trigger actions based on events
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Automation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
          <CardDescription>
            Configure how this agent handles automated actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Enable automations</label>
              <p className="text-xs text-muted-foreground">
                Allow this agent to execute automated actions
              </p>
            </div>
            <Switch />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Schedule-based triggers</label>
              <p className="text-xs text-muted-foreground">
                Enable time-based automation triggers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Switch />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Event-based triggers</label>
              <p className="text-xs text-muted-foreground">
                Enable automations triggered by specific events
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <Switch />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Automation logging</label>
              <p className="text-xs text-muted-foreground">
                Keep detailed logs of automation executions
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common automation templates for this agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            <Clock className="h-4 w-4 mr-2" />
            Daily Report Automation
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Target className="h-4 w-4 mr-2" />
            Event Response Automation
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Zap className="h-4 w-4 mr-2" />
            Task Completion Automation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
