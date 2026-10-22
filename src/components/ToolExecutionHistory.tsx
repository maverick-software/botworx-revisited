import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  Mail,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MCPToolRegistry } from '@/lib/mcp/tool-registry';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface ToolExecutionLog {
  id: string;
  agent_id: string;
  user_id: string;
  tool_name: string;
  tool_provider: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error_message?: string;
  execution_time_ms: number;
  quota_consumed?: number;
  created_at: string;
  agent_name?: string;
}

interface ToolExecutionHistoryProps {
  agentId?: string;
  maxItems?: number;
  showFilters?: boolean;
  showExport?: boolean;
}

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'gmail':
      return <Mail className="w-4 h-4" />;
    case 'slack':
      return <Settings className="w-4 h-4" />;
    default:
      return <Settings className="w-4 h-4" />;
  }
};

const getStatusIcon = (success: boolean) => {
  return success ? (
    <CheckCircle className="w-4 h-4 text-green-500" />
  ) : (
    <XCircle className="w-4 h-4 text-red-500" />
  );
};

const getStatusBadge = (success: boolean) => {
  return success ? (
    <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>
  );
};

const formatExecutionTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const formatToolName = (toolName: string) => {
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const ToolExecutionHistory: React.FC<ToolExecutionHistoryProps> = ({
  agentId,
  maxItems = 50,
  showFilters = true,
  showExport = true
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ToolExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'execution_time_ms' | 'tool_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLog, setSelectedLog] = useState<ToolExecutionLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const mcpToolRegistry = new MCPToolRegistry();

  useEffect(() => {
    loadExecutionHistory();
  }, [agentId, user?.id]);

  const loadExecutionHistory = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const history = await mcpToolRegistry.getToolExecutionHistory(
        agentId || '',
        user.id,
        maxItems
      );
      setLogs(history);
    } catch (error) {
      console.error('Error loading tool execution history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = searchTerm === '' || 
        log.tool_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.tool_provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.agent_name && log.agent_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesProvider = selectedProvider === 'all' || log.tool_provider === selectedProvider;
      const matchesStatus = selectedStatus === 'all' || 
        (selectedStatus === 'success' && log.success) ||
        (selectedStatus === 'failed' && !log.success);
      const matchesTool = selectedTool === 'all' || log.tool_name === selectedTool;

      return matchesSearch && matchesProvider && matchesStatus && matchesTool;
    }).sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [logs, searchTerm, selectedProvider, selectedStatus, selectedTool, sortBy, sortOrder]);

  const uniqueProviders = useMemo(() => {
    return [...new Set(logs.map(log => log.tool_provider))];
  }, [logs]);

  const uniqueTools = useMemo(() => {
    return [...new Set(logs.map(log => log.tool_name))];
  }, [logs]);

  const handleViewDetails = (log: ToolExecutionLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Tool Name', 'Provider', 'Status', 'Execution Time', 'Quota Used'].join(','),
      ...filteredLogs.map(log => [
        log.created_at,
        log.tool_name,
        log.tool_provider,
        log.success ? 'Success' : 'Failed',
        `${log.execution_time_ms}ms`,
        log.quota_consumed || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-execution-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatsData = () => {
    const totalExecutions = filteredLogs.length;
    const successfulExecutions = filteredLogs.filter(log => log.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const averageExecutionTime = totalExecutions > 0 ? 
      filteredLogs.reduce((sum, log) => sum + log.execution_time_ms, 0) / totalExecutions : 0;
    const totalQuotaUsed = filteredLogs.reduce((sum, log) => sum + (log.quota_consumed || 0), 0);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      totalQuotaUsed,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0
    };
  };

  const stats = getStatsData();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading execution history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Tool Execution History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadExecutionHistory}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {showExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={filteredLogs.length === 0}
              >
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.totalExecutions}</div>
                  <div className="text-sm text-muted-foreground">Total Executions</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.successfulExecutions}</div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-600">{stats.failedExecutions}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{formatExecutionTime(stats.averageExecutionTime)}</div>
                  <div className="text-sm text-muted-foreground">Avg Time</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.totalQuotaUsed}</div>
                  <div className="text-sm text-muted-foreground">Total Quota</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {showFilters && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search tools, providers, or agents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {uniqueProviders.map(provider => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedTool} onValueChange={setSelectedTool}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Tool" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tools</SelectItem>
                      {uniqueTools.map(tool => (
                        <SelectItem key={tool} value={tool}>
                          {formatToolName(tool)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p>No tool executions found</p>
                  <p className="text-sm">Try adjusting your filters or search terms</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <Card key={log.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getProviderIcon(log.tool_provider)}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatToolName(log.tool_name)}</span>
                              {getStatusBadge(log.success)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span className="capitalize">{log.tool_provider}</span>
                              <span className="mx-1">•</span>
                              <span>{formatExecutionTime(log.execution_time_ms)}</span>
                              <span className="mx-1">•</span>
                              <span>{formatDistanceToNow(new Date(log.created_at))} ago</span>
                              {log.quota_consumed && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{log.quota_consumed} quota</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.success)}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Tool Execution Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-1">Tool</h4>
                                    <p className="text-sm">{formatToolName(log.tool_name)}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">Provider</h4>
                                    <p className="text-sm capitalize">{log.tool_provider}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">Status</h4>
                                    <p className="text-sm">{log.success ? 'Success' : 'Failed'}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">Execution Time</h4>
                                    <p className="text-sm">{formatExecutionTime(log.execution_time_ms)}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">Timestamp</h4>
                                    <p className="text-sm">{new Date(log.created_at).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">Quota Used</h4>
                                    <p className="text-sm">{log.quota_consumed || 0}</p>
                                  </div>
                                </div>
                                {Object.keys(log.parameters).length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-1">Parameters</h4>
                                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                                      {JSON.stringify(log.parameters, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.result && (
                                  <div>
                                    <h4 className="font-medium mb-1">Result</h4>
                                    <pre className="bg-green-50 p-2 rounded text-xs overflow-auto">
                                      {typeof log.result === 'string' ? log.result : JSON.stringify(log.result, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.error_message && (
                                  <div>
                                    <h4 className="font-medium mb-1">Error</h4>
                                    <pre className="bg-red-50 p-2 rounded text-xs text-red-700">
                                      {log.error_message}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ToolExecutionHistory; 