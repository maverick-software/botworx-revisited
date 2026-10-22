import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Calendar, 
  MessageSquare,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

interface TaskExecution {
  id: string;
  task_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  trigger_type: string;
  instructions_used: string;
  tools_used: any[];
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  output: string | null;
  tool_outputs: any[];
  error_message: string | null;
  metadata: any;
  conversation_id: string | null;
  // Task details
  task_name?: string;
  task_description?: string;
  task_type?: string;
  cron_expression?: string;
  max_executions?: number;
}

interface TaskHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'running':
      return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-gray-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    completed: 'default',
    failed: 'destructive',
    running: 'secondary',
    pending: 'outline',
    cancelled: 'secondary'
  };
  
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  };

  return (
    <Badge className={colors[status] || colors.pending}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const formatDuration = (ms: number | null): string => {
  if (!ms) return 'N/A';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
  
  const date = new Date(dateStr);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export function TaskHistoryModal({ isOpen, onClose, agentId }: TaskHistoryModalProps) {
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null);
  
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  const loadTaskHistory = async () => {
    if (!user || !agentId) return;
    
    setLoading(true);
    try {
      // Fetch task executions with task details
      const { data, error } = await supabase
        .from('agent_task_executions')
        .select(`
          *,
          agent_tasks!inner(
            name,
            description,
            task_type,
            cron_expression,
            max_executions,
            status,
            user_id
          )
        `)
        .eq('agent_id', agentId)
        .eq('agent_tasks.user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading task history:', error);
        return;
      }

      // Transform the data to include task details
      const transformedData = (data || []).map((execution: any) => ({
        ...execution,
        task_name: execution.agent_tasks?.name,
        task_description: execution.agent_tasks?.description,
        task_type: execution.agent_tasks?.task_type,
        cron_expression: execution.agent_tasks?.cron_expression,
        max_executions: execution.agent_tasks?.max_executions
      }));

      setExecutions(transformedData);
    } catch (error) {
      console.error('Error loading task history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTaskHistory();
    }
  }, [isOpen, agentId, user]);

  const openConversation = (conversationId: string) => {
    // Navigate to the conversation
    window.open(`/agents/${agentId}/chat?conv=${conversationId}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-hidden flex flex-col border-0 bg-transparent p-0">
        <DialogTitle className="sr-only">Task Execution History</DialogTitle>
        
        <div className="bg-background border rounded-lg shadow-lg p-6 flex flex-col h-full">
          <div className="flex-shrink-0 mb-6">
            <h2 className="text-xl font-semibold mb-2">Task Execution History</h2>
            <p className="text-sm text-muted-foreground">
              View the execution history of all scheduled tasks for this agent.
            </p>
          </div>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Loading execution history...</span>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No execution history</h3>
              <p className="text-sm text-muted-foreground">
                Task executions will appear here once they start running.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-auto pr-2">
              {/* Execution List */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Recent Executions ({executions.length})
                </h4>
                <div className="space-y-2 max-h-[calc(90vh-200px)] overflow-y-auto">
                  {executions.map((execution) => (
                    <Card 
                      key={execution.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedExecution?.id === execution.id 
                          ? 'ring-2 ring-primary' 
                          : ''
                      }`}
                      onClick={() => setSelectedExecution(execution)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(execution.status)}
                            <h5 className="font-medium text-sm truncate">
                              {execution.task_name || 'Unnamed Task'}
                            </h5>
                          </div>
                          {getStatusBadge(execution.status)}
                        </div>
                        
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDateTime(execution.started_at)}
                          </span>
                          <span>{formatDuration(execution.duration_ms)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Execution Details */}
              <div className="border-l pl-4">
                {selectedExecution ? (
                  <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
                        Execution Details
                      </h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-medium">{selectedExecution.task_name}</h5>
                          </div>
                          {getStatusBadge(selectedExecution.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Started:</span>
                            <div className="font-mono">
                              {formatDateTime(selectedExecution.started_at)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Completed:</span>
                            <div className="font-mono">
                              {formatDateTime(selectedExecution.completed_at)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <div className="font-mono">
                              {formatDuration(selectedExecution.duration_ms)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Trigger:</span>
                            <div className="font-mono">
                              {selectedExecution.trigger_type}
                            </div>
                          </div>
                        </div>

                        {selectedExecution.conversation_id && (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConversation(selectedExecution.conversation_id!)}
                              className="flex items-center gap-2"
                            >
                              <MessageSquare className="w-4 h-4" />
                              View Conversation
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        )}

                        {selectedExecution.output && (
                          <div>
                            <span className="text-muted-foreground text-sm">Output:</span>
                            <div className="mt-1 p-3 bg-muted rounded-lg text-sm font-mono max-h-40 overflow-y-auto">
                              {selectedExecution.output}
                            </div>
                          </div>
                        )}

                        {selectedExecution.error_message && (
                          <div>
                            <span className="text-muted-foreground text-sm">Error:</span>
                            <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm font-mono text-red-700 dark:text-red-300 max-h-40 overflow-y-auto">
                              {selectedExecution.error_message}
                            </div>
                          </div>
                        )}

                        {selectedExecution.tools_used && selectedExecution.tools_used.length > 0 && (
                          <div>
                            <span className="text-muted-foreground text-sm">Tools Used:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedExecution.tools_used.map((tool, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {typeof tool === 'string' ? tool : tool.name || 'Unknown Tool'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select an execution to view details
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
