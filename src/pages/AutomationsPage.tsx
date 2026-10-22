import React from 'react';
import { Zap, Settings, Play, Pause, Plus } from 'lucide-react';

export function AutomationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Automations</h1>
              <p className="text-muted-foreground">Create and manage automated workflows</p>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Automations Coming Soon
            </h2>
            
            <p className="text-muted-foreground mb-6 leading-relaxed">
              We're working on powerful automation features that will help you streamline your workflows and boost productivity. Stay tuned for updates!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-muted/50 rounded-lg">
                <Play className="w-6 h-6 text-primary mx-auto mb-2" />
                <h3 className="font-medium text-foreground mb-1">Trigger Events</h3>
                <p className="text-sm text-muted-foreground">Automatically start workflows based on specific conditions</p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <Settings className="w-6 h-6 text-primary mx-auto mb-2" />
                <h3 className="font-medium text-foreground mb-1">Custom Actions</h3>
                <p className="text-sm text-muted-foreground">Define custom actions and responses for your automations</p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <Pause className="w-6 h-6 text-primary mx-auto mb-2" />
                <h3 className="font-medium text-foreground mb-1">Smart Scheduling</h3>
                <p className="text-sm text-muted-foreground">Schedule automations to run at optimal times</p>
              </div>
            </div>

            <button 
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-not-allowed opacity-50"
              disabled
            >
              <Plus className="w-4 h-4 mr-2 inline" />
              Create Automation (Coming Soon)
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Want to be notified when Automations launches? Contact us at support@agentopia.com</p>
        </div>
      </div>
    </div>
  );
}

export default AutomationsPage;