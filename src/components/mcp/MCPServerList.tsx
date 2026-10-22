// src/components/mcp/MCPServerList.tsx
import React, { useState, useMemo } from 'react';
import { 
  MCPServerListProps, 
  MCPServer, 
  MCPServerAction,
  MCPServerFilters,
  MCPServerSortField 
} from '@/lib/mcp/ui-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  MoreHorizontal, 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  Trash2, 
  FileText, 
  BarChart3,
  Search,
  Filter,
  ArrowUpDown,
  Server
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  onServerSelect,
  onServerAction,
  loading = false,
  error,
  filters,
  onFiltersChange,
  sortBy = 'name',
  sortOrder = 'asc',
  onSortChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort servers
  const filteredAndSortedServers = useMemo(() => {
    let result = [...servers];

    // Apply search filter
    if (searchQuery) {
      result = result.filter(server =>
        server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        server.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply additional filters
    if (filters) {
      if (filters.status?.length) {
        result = result.filter(server => filters.status!.includes(server.status.state));
      }
      if (filters.health?.length) {
        result = result.filter(server => filters.health!.includes(server.health.overall));
      }
      if (filters.verified !== undefined) {
        result = result.filter(server => server.is_active === filters.verified);
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status.state;
          bValue = b.status.state;
          break;
        case 'health':
          aValue = a.health.overall;
          bValue = b.health.overall;
          break;
        case 'uptime':
          aValue = a.status.uptime || 0;
          bValue = b.status.uptime || 0;
          break;
        case 'memoryUsage':
          aValue = a.resourceUsage?.memory.percentage || 0;
          bValue = b.resourceUsage?.memory.percentage || 0;
          break;
        case 'lastSeen':
          aValue = a.lastSeen?.getTime() || 0;
          bValue = b.lastSeen?.getTime() || 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [servers, searchQuery, filters, sortBy, sortOrder]);

  const getStatusBadgeVariant = (state: MCPServer['status']['state']) => {
    switch (state) {
      case 'running': return 'default';
      case 'error': return 'destructive';
      case 'stopped': return 'secondary';
      case 'starting': return 'outline';
      default: return 'secondary';
    }
  };

  const getHealthBadgeVariant = (health: MCPServer['health']['overall']) => {
    switch (health) {
      case 'healthy': return 'default';
      case 'degraded': return 'outline';
      case 'unhealthy': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleServerAction = (action: MCPServerAction, server: MCPServer) => {
    onServerAction?.(action, server);
  };

  const handleSort = (field: MCPServerSortField) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange?.(field, newOrder);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2 text-muted-foreground">Loading MCP servers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <h3 className="font-semibold mb-2">Error Loading Servers</h3>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleSort('name')}>
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('status')}>
              Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('health')}>
              Health {sortBy === 'health' && (sortOrder === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('uptime')}>
              Uptime {sortBy === 'uptime' && (sortOrder === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Server Cards */}
      <div className="space-y-4">
        {filteredAndSortedServers.length === 0 ? (
          <div className="text-center py-12">
            <Server className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No MCP servers found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? "Try adjusting your search or filters" 
                : "You haven't deployed any servers yet"}
            </p>
            {!searchQuery && (
              <Button onClick={() => window.location.href = '/mcp/marketplace'}>
                Browse Marketplace
              </Button>
            )}
          </div>
        ) : (
          filteredAndSortedServers.map((server) => (
            <Card 
              key={server.id} 
              className={cn(
                "transition-all duration-200 hover:shadow-md hover:scale-[1.01] cursor-pointer group",
                server.status.state === 'error' && "border-destructive/50"
              )}
              onClick={() => onServerSelect?.(server)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{server.name}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(server.status.state)} className="font-medium">
                      {server.status.state}
                    </Badge>
                    <Badge variant={getHealthBadgeVariant(server.health.overall)} className="font-medium">
                      {server.health.overall}
                    </Badge>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {server.status.state === 'stopped' && (
                        <DropdownMenuItem onClick={() => handleServerAction('start', server)}>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </DropdownMenuItem>
                      )}
                      {server.status.state === 'running' && (
                        <DropdownMenuItem onClick={() => handleServerAction('stop', server)}>
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleServerAction('restart', server)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restart
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleServerAction('configure', server)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleServerAction('view-logs', server)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Logs
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleServerAction('view-metrics', server)}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Metrics
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleServerAction('delete', server)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="space-y-1">
                    <span className="font-medium text-foreground">Endpoint:</span>
                    <p className="text-muted-foreground break-all font-mono text-xs bg-muted px-2 py-1 rounded">
                      {server.endpoint_url}
                    </p>
                  </div>
                  
                  {server.status.uptime && (
                    <div className="space-y-1">
                      <span className="font-medium text-foreground">Uptime:</span>
                      <p className="text-muted-foreground font-medium">
                        {Math.floor(server.status.uptime / 3600)}h {Math.floor((server.status.uptime % 3600) / 60)}m
                      </p>
                    </div>
                  )}
                  
                  {server.resourceUsage && (
                    <div className="space-y-1">
                      <span className="font-medium text-foreground">Memory Usage:</span>
                      <p className="text-muted-foreground">
                        <span className="font-medium">{server.resourceUsage.memory.percentage.toFixed(1)}%</span>
                        <span className="text-xs ml-1">
                          ({server.resourceUsage.memory.used}MB / {server.resourceUsage.memory.limit}MB)
                        </span>
                      </p>
                    </div>
                  )}
                </div>
                
                {server.tags && server.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {server.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MCPServerList; 