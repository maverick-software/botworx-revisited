import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Target,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  FileText,
  Zap,
  Star,
  Archive
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'paused' | 'completed';
  schedule?: string;
  created_at: string;
  cron_expression?: string | null;
  timezone?: string | null;
  next_run_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  schedule_label?: string;
  conversation_id?: string | null;
}

// Simple helpers to build cron and next run
function buildCronExpression(cadence: 'daily'|'weekly'|'monthly', hour: number, minute: number, anchorDate: Date): string {
  const m = `${minute}`;
  const h = `${hour}`;
  if (cadence === 'daily') return `${m} ${h} * * *`;
  if (cadence === 'weekly') {
    const dow = anchorDate.getDay(); // 0-6 (Sun-Sat)
    return `${m} ${h} * * ${dow}`;
  }
  // monthly
  const dom = anchorDate.getDate();
  return `${m} ${h} ${dom} * *`;
}

function computeNextRunAt(cadence: 'daily'|'weekly'|'monthly', startDate: Date, hour: number, minute: number): Date {
  const tzStart = new Date(startDate);
  tzStart.setHours(hour, minute, 0, 0);
  const now = new Date();
  if (cadence === 'daily') {
    if (tzStart > now) return tzStart;
    const d = new Date(tzStart);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (cadence === 'weekly') {
    let d = new Date(tzStart);
    while (d <= now) {
      d.setDate(d.getDate() + 7);
    }
    return d;
  }
  // monthly
  let d = new Date(tzStart);
  while (d <= now) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function parseCronToLabel(cron: string, startDateIso?: string | null): { label: string, cadence: 'daily'|'weekly'|'monthly', time: string } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, _mon, dow] = parts;
  const mm = Number(m);
  const hh = Number(h);
  const time = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  if (dom === '*' && dow === '*') {
    return { label: `Daily at ${time}` , cadence: 'daily', time };
  }
  if (dow !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    const weekday = anchor.toLocaleDateString(undefined, { weekday: 'long' });
    return { label: `Weekly on ${weekday} at ${time}`, cadence: 'weekly', time };
  }
  if (dom !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    const day = anchor.getDate();
    return { label: `Monthly on day ${day} at ${time}`, cadence: 'monthly', time };
  }
  return null;
}

export function TasksModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: TasksModalProps) {
  const { user } = useAuth();
  
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [scheduleMode, setScheduleMode] = useState<'one_time'|'recurring'>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState(''); // yyyy-mm-dd
  const [oneTimeTime, setOneTimeTime] = useState(''); // HH:MM
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [recurringTime, setRecurringTime] = useState('');
  const [recurringCadence, setRecurringCadence] = useState<'daily'|'weekly'|'monthly'>('daily');
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  });

  // Timezone helpers
  const getSupportedTimezones = (): string[] => {
    const fallback = ['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'];
    // @ts-ignore
    if (typeof (Intl as any).supportedValuesOf === 'function') {
      try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return fallback; }
    }
    return fallback;
  };

  const toUtcIsoForTimezone = (dateStr: string, timeStr: string, tz: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    // Build a UTC date from components (treating them as UTC)
    const asUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0));
    // Find what that UTC time looks like in the target timezone, then adjust by the diff
    const tzDate = new Date(asUtc.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = asUtc.getTime() - tzDate.getTime();
    const target = new Date(asUtc.getTime() + offsetMs);
    return target.toISOString();
  };
  const [targetConversationId, setTargetConversationId] = useState<string>('');

  // Load tasks from DB
  const loadTasks = useCallback(async () => {
    if (!user?.id || !agentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped: Task[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.name,
        description: row.description || row.instructions || '',
        priority: (row.event_trigger_config?.priority as 'low'|'medium'|'high') || 'medium',
        status: row.status,
        schedule: row.cron_expression || row.next_run_at || '',
        created_at: row.created_at,
        cron_expression: row.cron_expression,
        timezone: row.timezone,
        next_run_at: row.next_run_at,
        start_date: row.start_date,
        end_date: row.end_date,
        schedule_label: row.max_executions === 1 && row.next_run_at
          ? `Runs once at ${new Date(row.next_run_at).toLocaleString()}`
          : (row.cron_expression ? (parseCronToLabel(row.cron_expression, row.start_date)?.label || row.cron_expression) : ''),
      }));
      setTasks(mapped);
    } catch (e: any) {
      console.error('Failed to load tasks', e);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [user?.id, agentId]);

  useEffect(() => {
    if (isOpen) {
      setSaved(false);
      loadTasks();
      // Lightweight fetch to populate conversation selector
      (async () => {
        try {
          if (!agentId || !user?.id) return;
          const { data } = await supabase
            .from('conversation_sessions')
            .select('conversation_id, title')
            .eq('agent_id', agentId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('last_active', { ascending: false })
            .limit(50);
          (window as any).__agentopiaConversations = data || [];
        } catch {}
      })();
    }
  }, [isOpen, agentData, loadTasks]);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !user?.id) return;
    try {
      setLoading(true);
      const timezone = selectedTimezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

      let cron_expression: string | null = null;
      let next_run_at: string | null = null;
      let max_executions: number | null = null;
      let start_date: string | null = null;
      let end_date: string | null = null;

      if (scheduleMode === 'one_time') {
        if (!oneTimeDate || !oneTimeTime) {
          toast.error('Please provide a date and time');
          setLoading(false);
          return;
        }
        const [hStr, mStr] = oneTimeTime.split(':');
        const h = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        // Use a harmless cron; executor uses next_run_at then will complete due to max_executions=1
        cron_expression = '* * * * *';
        const runAtUtcIso = toUtcIsoForTimezone(oneTimeDate, oneTimeTime, timezone);
        next_run_at = runAtUtcIso;
        max_executions = 1;
        start_date = runAtUtcIso;
      } else {
        // recurring
        if (!recurringStartDate || !recurringTime) {
          toast.error('Please provide start date and time');
          setLoading(false);
          return;
        }
        const [hStr, mStr] = recurringTime.split(':');
        const h = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        const anchor = new Date(`${recurringStartDate}T${recurringTime}:00`);
        cron_expression = buildCronExpression(recurringCadence, h, m, anchor);
        // First intended occurrence in selected timezone
        const firstIso = toUtcIsoForTimezone(recurringStartDate, recurringTime, timezone);
        const nowUtcMs = Date.now();
        // If first run is in the past, roll forward one interval in tz
        let firstDate = new Date(firstIso);
        while (firstDate.getTime() <= nowUtcMs) {
          if (recurringCadence === 'daily') {
            const d2 = new Date(firstDate);
            d2.setUTCDate(d2.getUTCDate() + 1);
            firstDate = d2;
          } else if (recurringCadence === 'weekly') {
            const d2 = new Date(firstDate);
            d2.setUTCDate(d2.getUTCDate() + 7);
            firstDate = d2;
          } else {
            const d2 = new Date(firstDate);
            d2.setUTCMonth(d2.getUTCMonth() + 1);
            firstDate = d2;
          }
        }
        next_run_at = firstDate.toISOString();
        // Store start_date as midnight in selected tz converted to UTC
        start_date = toUtcIsoForTimezone(recurringStartDate, '00:00', timezone);
        end_date = recurringEndDate ? new Date(`${recurringEndDate}T23:59:59`).toISOString() : null;
      }

      const payload: any = {
        agent_id: agentId,
        user_id: user.id,
        name: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        task_type: 'scheduled',
      status: 'active',
        instructions: newTaskDescription.trim() || newTaskTitle.trim(),
        cron_expression,
        timezone,
        next_run_at,
        start_date,
        end_date,
        max_executions,
        event_trigger_config: { priority: newTaskPriority, mode: scheduleMode, cadence: scheduleMode==='recurring'?recurringCadence: undefined },
        conversation_id: targetConversationId || null,
      };

      let error: any = null;
      if (editingTaskId) {
        const resp = await supabase.from('agent_tasks').update(payload).eq('id', editingTaskId);
        error = resp.error;
      } else {
        const resp = await supabase.from('agent_tasks').insert(payload);
        error = resp.error;
      }
      if (error) throw error;
      toast.success('Task added! 📝');
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
      setOneTimeDate('');
      setOneTimeTime('');
      setRecurringStartDate('');
      setRecurringEndDate('');
      setRecurringTime('');
      setRecurringCadence('daily');
    setShowNewTaskForm(false);
      setEditingTaskId(null);
      await loadTasks();
    } catch (e: any) {
      console.error('Add task failed', e);
      toast.error(e?.message || 'Failed to add task');
    } finally {
      setLoading(false);
    }
  }, [newTaskTitle, newTaskDescription, newTaskPriority, user?.id, agentId, scheduleMode, oneTimeDate, oneTimeTime, recurringStartDate, recurringEndDate, recurringTime, recurringCadence, loadTasks, editingTaskId]);

  const handleToggleTaskStatus = async (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    const next = t.status === 'active' ? 'paused' : 'active';
    try {
      await supabase.from('agent_tasks').update({ status: next }).eq('id', taskId);
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: next } : task));
    } catch (e: any) {
      console.error('Toggle status failed', e);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('agent_tasks').delete().eq('id', taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast.success('Task removed');
    } catch (e: any) {
      console.error('Delete task failed', e);
      toast.error('Failed to remove task');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      setLoading(true);
      const { data: result, error } = await supabase.functions.invoke('task-executor', {
        body: { action: 'execute_task', task_id: taskId, trigger_type: 'manual' }
      });
      if (error) throw error;
      toast.success('Task executed');
      console.log('Task execution result:', result);
      // If a conversation was created/used, make it active and refresh chat view
      const convoId = (result as any)?.conversation_id;
      if (convoId) {
        try {
          localStorage.setItem(`agent_${agentId}_conversation_id`, convoId);
          // Ensure the conversation exists/visible under RLS and bump last_active using update-or-insert
          const base: any = {
            agent_id: agentId,
            user_id: user!.id,
            title: newTaskTitle?.trim() ? newTaskTitle.trim() : 'Conversation',
            status: 'active',
            last_active: new Date().toISOString(),
          };
          const upd = await supabase
            .from('conversation_sessions')
            .update(base)
            .eq('conversation_id', convoId)
            .select('conversation_id');
          if (!upd || !upd.data || upd.data.length === 0) {
            await supabase
              .from('conversation_sessions')
              .insert({ conversation_id: convoId, ...base });
          }
        } catch {}
        // Best-effort: dispatch a custom event to let chat page react
        window.dispatchEvent(new CustomEvent('agentopia:conversation:activated', { detail: { agentId, conversationId: convoId } }));
      }
    } catch (e: any) {
      console.error('Execute task failed', e);
      toast.error('Task execution failed');
    } finally {
      setLoading(false);
    }
  };

  // Begin edit of existing task
  const beginEditTask = (task: Task) => {
    setShowNewTaskForm(true);
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setNewTaskPriority(task.priority);
    // infer mode
    if (task.next_run_at && (!task.cron_expression || task.cron_expression === '* * * * *')) {
      setScheduleMode('one_time');
      const d = new Date(task.next_run_at);
      setOneTimeDate(d.toISOString().slice(0,10));
      setOneTimeTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
    } else {
      setScheduleMode('recurring');
      const start = task.start_date ? new Date(task.start_date) : new Date();
      setRecurringStartDate(start.toISOString().slice(0,10));
      setRecurringEndDate(task.end_date ? new Date(task.end_date).toISOString().slice(0,10) : '');
      const parsed = task.cron_expression ? parseCronToLabel(task.cron_expression, task.start_date) : null;
      setRecurringCadence(parsed?.cadence || 'daily');
      setRecurringTime(parsed?.time || '09:00');
    }
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    setLoading(true);
    try {
      await loadTasks();
      toast.success('Tasks refreshed');
      setSaved(true);
      if (onAgentUpdated) {
        onAgentUpdated({ tasks });
      }
    } catch (error: any) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to refresh tasks');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, onAgentUpdated, tasks, loadTasks]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
      case 'low': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <Check className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const hasChanges = () => true;

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
                variant="outline"
                size="sm"
                onClick={() => setShowNewTaskForm(true)}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Task
              </Button>
            </div>

            {showNewTaskForm && (
              <div className="p-4 border border-border rounded-lg bg-card space-y-3">
                <h4 className="font-medium text-sm">Add New Scheduled Task</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Task title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Task instructions / description..."
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Priority</label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as 'low'|'medium'|'high')}
                        className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Mode</label>
                      <select
                        value={scheduleMode}
                        onChange={(e) => setScheduleMode(e.target.value as 'one_time'|'recurring')}
                        className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
                      >
                        <option value="one_time">One-time</option>
                        <option value="recurring">Recurring</option>
                      </select>
                    </div>
                  </div>

                  {/* Conversation selector */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Execute in conversation</label>
                    <select
                      value={targetConversationId}
                      onChange={(e) => setTargetConversationId(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
                    >
                      <option value="">Auto-create new conversation</option>
                      {/** We reuse sidebar query indirectly: build list from conversation_sessions for this agent+user */}
                      {/* This list will be fetched ad-hoc here */}
                      {/** Options populated via a lightweight effect below */}
                      {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((c: any) => (
                        <option key={c.conversation_id} value={c.conversation_id}>{c.title || 'Conversation'}</option>
                      ))}
                    </select>
                  </div>

                  {scheduleMode === 'one_time' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Run date</label>
                        <Input type="date" value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Run time</label>
                        <Input type="time" value={oneTimeTime} onChange={(e) => setOneTimeTime(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Start date</label>
                          <Input type="date" value={recurringStartDate} onChange={(e) => setRecurringStartDate(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">End date (optional)</label>
                          <Input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Time of day</label>
                          <Input type="time" value={recurringTime} onChange={(e) => setRecurringTime(e.target.value)} className="mt-1" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cadence</label>
                        <select
                          value={recurringCadence}
                          onChange={(e) => setRecurringCadence(e.target.value as 'daily'|'weekly'|'monthly')}
                          className="w-full mt-1 p-2 border rounded-md text-sm bg-card text-foreground border-border"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly (based on start date weekday)</option>
                          <option value="monthly">Monthly (based on start date day)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button onClick={handleAddTask} size="sm" disabled={!newTaskTitle.trim()}>
                      {editingTaskId ? 'Save Changes' : (<span className="inline-flex items-center"><Plus className="h-3 w-3 mr-1" />Add Task</span>)}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowNewTaskForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Task List */}
            <div className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border transition-all ${
                    task.status === 'active'
                      ? 'border-border bg-card'
                      : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(task.status)}
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <Badge className={`text-xs px-2 py-0.5 ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      {(task.schedule_label || task.cron_expression || task.schedule) && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{task.schedule_label || task.cron_expression || task.schedule}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => beginEditTask(task)}
                        className="h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => runTaskNow(task.id)}
                        className="h-8 w-8 p-0"
                        title="Run now"
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {tasks.length === 0 && !showNewTaskForm && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No scheduled tasks yet</p>
                <p className="text-sm text-muted-foreground">Create a one-time or recurring task above</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges()}
            className="min-w-[120px]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {loading ? 'Working...' : saved ? 'Saved!' : 'Refresh'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}