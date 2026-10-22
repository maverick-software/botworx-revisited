import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Clock, CheckCircle2, AlertCircle, Check, Edit2, Zap, Trash2 } from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  schedule_label?: string;
  cron_expression?: string;
  schedule?: string;
}

interface TaskListModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData: { name?: string };
  onCreateTask: () => void;
  onAgentUpdated?: (updatedData: any) => void;
  onEditTask?: (task: Task) => void;
}

export function TaskListModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onCreateTask,
  onAgentUpdated,
  onEditTask
}: TaskListModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  const loadTasks = async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tasks?agent_id=${agentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', response.status, errorText);
        throw new Error(`Failed to load tasks: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen, agentId, user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <Check className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-tasks', {
        method: 'DELETE',
        body: { task_id: taskId }
      });

      if (error) {
        console.error('Error deleting task:', error);
        throw error;
      }

      await loadTasks();
      if (onAgentUpdated) {
        onAgentUpdated({ ...agentData });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const runTaskNow = async (taskId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('task-executor', {
        body: {
          action: 'execute_task',
          task_id: taskId,
          trigger_type: 'manual',
          trigger_data: {}
        },
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to execute task');
      }

      console.log('Task executed successfully');
      await loadTasks(); // Refresh the task list
    } catch (error) {
      console.error('Error running task:', error);
    }
  };

  const beginEditTask = (task: Task) => {
    if (onEditTask) {
      onEditTask(task);
    } else {
      console.log('Edit task:', task);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            🎯 Scheduled Tasks
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create and manage recurring or one-time tasks for this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Task scheduler</h3>
              <Button
                onClick={onCreateTask}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg text-sm px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                ✨ Add Task
              </Button>
            </div>

            {/* Task List */}
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className={`p-6 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                      task.status === 'active'
                        ? 'border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getStatusIcon(task.status)}
                          <h4 className="font-medium text-sm">{task.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                        {(task.schedule_label || task.cron_expression || task.schedule) && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{task.schedule_label || task.cron_expression || task.schedule}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => beginEditTask(task)}
                          className="h-9 px-3 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200"
                          title="Edit Task"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runTaskNow(task.id)}
                          className="h-9 px-3 border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/50 transition-all duration-200"
                          title="Run Task Now"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-9 px-3 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all duration-200"
                          title="Delete Task"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-cyan-950/20">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No tasks yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
                  Create your first automated task to have your agent work on a schedule
                </p>
                <Button 
                  onClick={onCreateTask}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg px-8 py-3"
                >
                  <Plus className="h-4 w-4 mr-2" /> ✨ Create Your First Task
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
