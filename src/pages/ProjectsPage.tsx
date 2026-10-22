import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, AlertCircle } from 'lucide-react';

export function ProjectsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects Management</h1>
        <Link
          to="/workspaces"
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Access Workspaces
        </Link>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Workspaces Integration
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              We are currently modifying workspaces to work inside of projects. Access workspaces using the button above while we complete this integration.
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-card rounded-lg p-6 border border-border">
        <p className="text-muted-foreground">Projects interface coming soon...</p>
      </div>
    </div>
  );
} 