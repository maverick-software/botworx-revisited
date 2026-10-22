import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MCPServerList from '../../components/mcp/MCPServerList';
import { useMCPServers } from '../../hooks/useMCPServers';
import { MCPServer, MCPServerAction, MCPServerFilters, MCPServerSortField } from '../../lib/mcp/ui-types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Plus, Store, RefreshCw, AlertCircle, Server } from 'lucide-react';

export const MCPServersPage: React.FC = () => {
  const navigate = useNavigate();
  const { servers, loading, error, refetch, updateServer, deleteServer } = useMCPServers();
  
  const [filters, setFilters] = useState<MCPServerFilters>({});
  const [sortBy, setSortBy] = useState<MCPServerSortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleServerSelect = (server: MCPServer) => {
    navigate(`/mcp/config/${server.id}`);
  };

  const handleServerAction = async (action: MCPServerAction, server: MCPServer) => {
    try {
      switch (action) {
        case 'start':
        case 'stop':
        case 'restart':
          await updateServer(server.id.toString(), { 
            status: { 
              ...server.status, 
              state: action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'starting' 
            } 
          });
          // Trigger refresh to get updated status
          setTimeout(() => refetch(), 1000);
          break;
        
        case 'configure':
          navigate(`/mcp/config/${server.id}`);
          break;
        
        case 'delete':
          if (confirm(`Are you sure you want to delete "${server.name}"? This action cannot be undone.`)) {
            await deleteServer(server.id.toString());
            await refetch();
          }
          break;
        
        case 'view-logs':
          // TODO: Implement logs view
          console.log('View logs for server:', server.name);
          break;
        
        case 'view-metrics':
          // TODO: Implement metrics view
          console.log('View metrics for server:', server.name);
          break;
        
        case 'clone':
          // TODO: Implement server cloning
          console.log('Clone server:', server.name);
          break;
        
        default:
          console.warn('Unknown action:', action);
      }
    } catch (err) {
      console.error(`Failed to perform action ${action} on server ${server.name}:`, err);
    }
  };

  const handleSortChange = (field: MCPServerSortField, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-8">
        {/* Simple Navigation */}
        <nav className="text-sm text-muted-foreground">
                          <a href="/agents" className="hover:text-foreground transition-colors">Agents</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">MCP Servers</span>
        </nav>

        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                <Server className="h-10 w-10 text-primary" />
                MCP Servers
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Manage your Model Context Protocol servers and their configurations
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/mcp/marketplace')}
                className="gap-2"
              >
                <Store className="h-4 w-4" />
                Browse Marketplace
              </Button>
              <Button 
                onClick={() => navigate('/mcp/deploy')}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Deploy Server
              </Button>
            </div>
          </div>
        </div>

        {/* Global Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-blue-900">Total Servers</CardTitle>
              <Server className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{servers.length}</div>
              <p className="text-xs text-blue-700 mt-1">
                {servers.length === 1 ? 'server' : 'servers'} configured
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-green-900">Running</CardTitle>
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {servers.filter(s => s.status.state === 'running').length}
              </div>
              <p className="text-xs text-green-700 mt-1">
                active connections
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-gray-50 to-slate-100 border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900">Stopped</CardTitle>
              <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {servers.filter(s => s.status.state === 'stopped').length}
              </div>
              <p className="text-xs text-gray-700 mt-1">
                offline servers
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-rose-100 border-red-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-red-900">Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900">
                {servers.filter(s => s.health.overall === 'unhealthy' || s.status.state === 'error').length}
              </div>
              <p className="text-xs text-red-700 mt-1">
                need attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Server List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Servers</h2>
            {servers.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {servers.length} server{servers.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          
          <Card className="overflow-hidden">
            <MCPServerList
              servers={servers}
              onServerSelect={handleServerSelect}
              onServerAction={handleServerAction}
              loading={loading}
              error={error || undefined}
              filters={filters}
              onFiltersChange={setFilters}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}; 