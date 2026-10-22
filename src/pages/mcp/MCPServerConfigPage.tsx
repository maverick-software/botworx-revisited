import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MCPServerConfig from '../../components/mcp/MCPServerConfig';
import { useMCPServerConfig } from '../../hooks/useMCPServerConfig';
import { useMCPServerHealth } from '../../hooks/useMCPServerHealth';
import { MCPServer } from '../../lib/mcp/ui-types';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ArrowLeft, AlertCircle, Server } from 'lucide-react';

export const MCPServerConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  
  const { config, loading, error, updateConfig } = useMCPServerConfig(serverId);
  const { health } = useMCPServerHealth(serverId);

  // Redirect if no serverId provided
  useEffect(() => {
    if (!serverId) {
      navigate('/mcp/servers');
    }
  }, [serverId, navigate]);

  const handleSave = async (updates: Partial<MCPServer>) => {
    try {
      await updateConfig(updates);
      // Show success message (could be a toast notification)
      console.log('Configuration updated successfully');
    } catch (err) {
      console.error('Failed to update configuration:', err);
    }
  };

  const handleCancel = () => {
    navigate('/mcp/servers');
  };

  const handleRestart = async () => {
    if (!config) return;
    
    const confirmRestart = confirm(`Are you sure you want to restart "${config.name}"?`);
    if (!confirmRestart) return;

    try {
      // TODO: Implement server restart via API
      console.log('Restarting server:', config.name);
      // Could use a dedicated restart endpoint or update status
    } catch (err) {
      console.error('Failed to restart server:', err);
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    
    const confirmDelete = confirm(
      `Are you sure you want to delete "${config.name}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      // TODO: Implement server deletion via API
      console.log('Deleting server:', config.name);
      // After successful deletion, navigate back to servers list
      navigate('/mcp/servers');
    } catch (err) {
      console.error('Failed to delete server:', err);
    }
  };

  // Show loading state
  if (loading || !serverId) {
    return (
      <div className="space-y-6">
        <nav className="text-sm text-muted-foreground">
                          <a href="/agents" className="hover:text-foreground">Agents</a>
          <span className="mx-2">/</span>
          <a href="/mcp/servers" className="hover:text-foreground">MCP Servers</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Loading...</span>
        </nav>

        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <LoadingSpinner />
              <p className="mt-4 text-muted-foreground">Loading server configuration...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !config) {
    return (
      <div className="space-y-6">
        <nav className="text-sm text-muted-foreground">
                          <a href="/agents" className="hover:text-foreground">Agents</a>
          <span className="mx-2">/</span>
          <a href="/mcp/servers" className="hover:text-foreground">MCP Servers</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Error</span>
        </nav>

        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">Server Not Found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || 'The requested server configuration could not be loaded.'}
                </p>
              </div>
              <div className="space-y-2">
                <Button onClick={() => navigate('/mcp/servers')} className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Servers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show main configuration interface
  return (
    <div className="space-y-6">
      {/* Simple Navigation */}
      <nav className="text-sm text-muted-foreground">
                        <a href="/agents" className="hover:text-foreground">Agents</a>
        <span className="mx-2">/</span>
        <a href="/mcp/servers" className="hover:text-foreground">MCP Servers</a>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{config.name}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/mcp/servers')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Servers
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Server className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{config.name}</h1>
            <p className="text-muted-foreground">
              Configure server settings and manage deployment options
            </p>
          </div>
        </div>
      </div>

      {/* Server Status Alert */}
      {config.status && config.status.state === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Server is in error state: {config.status.lastError || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {/* Health Warning */}
      {health.overall === 'unhealthy' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Server health check failed. Please review the configuration and check server logs.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Configuration Component */}
      <MCPServerConfig
        server={config}
        onSave={handleSave}
        onCancel={handleCancel}
        onRestart={handleRestart}
        onDelete={handleDelete}
        loading={loading}
        error={error || undefined}
        readOnly={false}
      />
    </div>
  );
}; 