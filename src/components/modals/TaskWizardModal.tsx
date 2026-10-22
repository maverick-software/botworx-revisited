import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Zap, Calendar, RotateCcw, FileEdit, Tag, MessageCircle, Wand2, X, ArrowLeft, ArrowRight, Save, Clock, Hash, Lightbulb, Target, Edit3 } from 'lucide-react';
import { TaskStep } from '@/types/tasks';
import { StepManager } from './task-steps/StepManager';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  getSupportedTimezones, 
  formatTimezoneLabel, 
  toUtcIsoForTimezone, 
  generateCronExpression,
  generateOneTimeCronExpression,
  parseCronForRecurring,
  getDefaultTimezone 
} from '@/lib/utils/taskUtils';

interface TaskWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData: { name?: string };
  onTaskCreated: () => void;
  editingTask?: {
    id: string;
    title: string;
    description: string;
    status: string;
    schedule_label?: string;
    cron_expression?: string;
    schedule?: string;
    start_date?: string;
    end_date?: string;
    max_executions?: number;
    timezone?: string;
    task_type?: string;
    instructions?: string;
  } | null;
}

export function TaskWizardModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onTaskCreated,
  editingTask
}: TaskWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [scheduleMode, setScheduleMode] = useState<'one_time' | 'recurring'>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [oneTimeTime, setOneTimeTime] = useState('');
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [recurringTime, setRecurringTime] = useState('');
  const [everyInterval, setEveryInterval] = useState(1);
  const [everyUnit, setEveryUnit] = useState<'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'>('day');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [targetConversationId, setTargetConversationId] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState(getDefaultTimezone());
  
  // Multi-step workflow state
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [stepsValid, setStepsValid] = useState(false);

  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Function to load existing task steps when editing
  const loadExistingTaskSteps = async () => {
    if (!editingTask?.id || !user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_task_steps_with_context', { p_task_id: editingTask.id });
      
      if (error) {
        console.error('Failed to load task steps:', error);
        return;
      }
      
      const loadedSteps = (data || []).map((row: any) => ({
        id: row.step_id || row.id,
        task_id: editingTask.id,
        step_order: row.step_order,
        step_name: row.step_name,
        instructions: row.instructions,
        include_previous_context: row.include_previous_context || false,
        context_data: row.context_data || {},
        status: row.status || 'pending',
        execution_result: row.execution_result || {},
        execution_started_at: row.execution_started_at,
        execution_completed_at: row.execution_completed_at,
        error_message: row.error_message,
        retry_count: row.retry_count || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        // For existing steps, create a user-friendly display name
        display_name: `Step ${row.step_order}`
      }));
      
      console.log('Loaded task steps:', loadedSteps);
      setTaskSteps(loadedSteps);
      
    } catch (err) {
      console.error('Error loading task steps:', err);
    }
  };

  // Initialize form fields when editing a task
  useEffect(() => {
    if (editingTask) {
      console.log('Initializing form with task data:', editingTask);
      
      // Use 'name' field from database, fallback to 'title' for backwards compatibility
      setNewTaskTitle(editingTask.name || editingTask.title || '');
      
      // Set timezone if available
      if (editingTask.timezone) {
        setSelectedTimezone(editingTask.timezone);
      }
      
      // Set target conversation if available
      if (editingTask.conversation_id) {
        setTargetConversationId(editingTask.conversation_id);
      }
      
      // Load existing task steps
      loadExistingTaskSteps();
      
      // Determine schedule mode based on max_executions
      if (editingTask.max_executions === 1) {
        setScheduleMode('one_time');
        
        // Parse cron expression for time (since one-time tasks also use cron)
        if (editingTask.cron_expression) {
          const cronParts = editingTask.cron_expression.split(' ');
          if (cronParts.length === 5) {
            const [minute, hour] = cronParts;
            const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            setOneTimeTime(timeStr);
          }
        }
        
        // Parse start_date for one-time tasks
        if (editingTask.start_date) {
          const startDate = new Date(editingTask.start_date);
          const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
          setOneTimeDate(dateStr);
        }
      } else {
        setScheduleMode('recurring');
        
        // Parse cron expression for recurring tasks
        if (editingTask.cron_expression) {
          const parsed = parseCronForRecurring(editingTask.cron_expression);
          if (parsed) {
            setRecurringTime(parsed.time);
            setEveryInterval(parsed.interval);
            setEveryUnit(parsed.unit);
          } else {
            // Fallback parsing for simple cases
            const cronParts = editingTask.cron_expression.split(' ');
            if (cronParts.length === 5) {
              const [minute, hour] = cronParts;
              if (!minute.includes('*') && !hour.includes('*')) {
                const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
                setRecurringTime(timeStr);
              }
            }
            // Default values if parsing fails
            setEveryInterval(1);
            setEveryUnit('day');
          }
        }
        
        // Parse dates for recurring tasks
        if (editingTask.start_date) {
          const startDate = new Date(editingTask.start_date);
          const dateStr = startDate.toISOString().split('T')[0];
          setRecurringStartDate(dateStr);
        }
        
        if (editingTask.end_date) {
          const endDate = new Date(editingTask.end_date);
          const endDateStr = endDate.toISOString().split('T')[0];
          setRecurringEndDate(endDateStr);
        }
      }
    } else {
      // Reset form when not editing
      setNewTaskTitle('');
      setScheduleMode('one_time');
      setOneTimeDate('');
      setOneTimeTime('');
      setRecurringStartDate('');
      setRecurringEndDate('');
      setRecurringTime('');
      setEveryInterval(1);
      setEveryUnit('day');
      setTargetConversationId('');
      setTaskSteps([]);
      setCurrentStep(1);
      setSelectedTimezone(getDefaultTimezone());
    }
  }, [editingTask]);


  const handleSaveTask = async () => {
    if (!user || !agentId) return;

    setLoading(true);
    try {
      // Determine if using step-based mode
      const usingSteps = taskSteps.length > 0;
      const finalInstructions = `Multi-step task with ${taskSteps.length} steps. See task_steps table for detailed instructions.`;

      const taskData: any = {
        agent_id: agentId,
        name: newTaskTitle,
        description: taskSteps.length > 0 
          ? `Multi-step workflow: ${taskSteps.map(s => s.step_name).join(' → ')}`
          : 'Multi-step task workflow',
        instructions: finalInstructions,
        task_type: 'scheduled',
        timezone: selectedTimezone,
        selected_tools: [],
        event_trigger_type: '',
        event_trigger_config: {},
        target_conversation_id: targetConversationId || null,
        // Add metadata for step-based tasks
        is_multi_step: usingSteps,
        step_count: taskSteps.length
      };

      if (scheduleMode === 'one_time') {
        taskData.start_date = oneTimeDate;
        taskData.cron_expression = generateOneTimeCronExpression(oneTimeDate, oneTimeTime); // Date-specific cron for one-time
        taskData.max_executions = 1;
      } else {
        taskData.start_date = recurringStartDate;
        taskData.end_date = recurringEndDate || null;
        taskData.cron_expression = generateCronExpression(everyUnit, everyInterval, recurringTime); // Recurring cron
      }

      console.log('Sending task data:', taskData);
      
      let result, error;
      
      if (editingTask) {
        // Update existing task
        taskData.task_id = editingTask.id;
        const response = await supabase.functions.invoke('agent-tasks', {
          body: { ...taskData, action: 'update' }
        });
        result = response.data;
        error = response.error;
      } else {
        // Create new task
        const response = await supabase.functions.invoke('agent-tasks', {
          body: taskData
        });
        result = response.data;
        error = response.error;
      }

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(error.message || `Failed to ${editingTask ? 'update' : 'create'} task`);
      }

      // If using steps, save them to the database (only for new tasks, not updates)
      if (usingSteps && result?.task_id && taskSteps.length > 0 && !editingTask) {
        try {
          for (const step of taskSteps) {
            const { error: stepError } = await supabase.rpc('create_task_step', {
              p_task_id: result.task_id,
              p_step_name: step.step_name,
              p_instructions: step.instructions,
              p_include_previous_context: step.include_previous_context,
              p_step_order: step.step_order
            });

            if (stepError) {
              console.error('Failed to create step:', stepError);
              throw new Error(`Failed to create step "${step.step_name}": ${stepError.message}`);
            }
          }
          
          toast.success(`Task created with ${taskSteps.length} steps successfully!`);
        } catch (stepErr: any) {
          toast.error(`Task created but failed to save steps: ${stepErr.message}`);
        }
      } else if (editingTask) {
        // For task updates, steps are managed separately through StepManager
        toast.success('Task updated successfully!');
      } else {
        toast.success(`Task ${editingTask ? 'updated' : 'created'} successfully!`);
      }

      // Reset form
      setCurrentStep(1);
      setScheduleMode('one_time');
      setOneTimeDate('');
      setOneTimeTime('');
      setRecurringStartDate('');
      setRecurringEndDate('');
      setRecurringTime('');
      setEveryInterval(1);
      setEveryUnit('day');

      setNewTaskTitle('');
      setTargetConversationId('');
      setTaskSteps([]);
      setStepsValid(false);

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!newTaskTitle.trim()) return false;
    
    if (scheduleMode === 'one_time') {
      return oneTimeDate && oneTimeTime;
    } else {
      return recurringStartDate && recurringTime && everyInterval >= 1;
    }
  };

  const handleNext = () => {
    let next = currentStep + 1;
    if (scheduleMode === 'one_time' && currentStep === 2) next = 4; // skip recurrence
    setCurrentStep(next);
  };

  const handleBack = () => {
    const prev = (scheduleMode === 'one_time' && currentStep === 4) ? 2 : currentStep - 1;
    setCurrentStep(prev);
  };

  const handleCancel = () => {
    setCurrentStep(1);
    setTaskSteps([]);
    setStepsValid(false);
    setNewTaskTitle('');
    onClose();
  };

  const totalSteps = scheduleMode === 'recurring' ? 6 : 5;
  const isLastStep = currentStep === totalSteps;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto p-0 border-0 bg-transparent">
        <DialogTitle className="sr-only">{editingTask ? 'Edit Task' : 'Schedule Task Wizard'}</DialogTitle>
        <DialogDescription className="sr-only">{editingTask ? 'Edit your automated task' : 'Create automated tasks for your agent using this step-by-step wizard'}</DialogDescription>
        <div className="relative overflow-hidden rounded-xl bg-background dark:bg-background border border-border dark:border-border">
          {/* Header */}
          <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white dark:from-muted dark:to-muted dark:text-foreground rounded-t-xl">
            <h4 className="font-semibold text-lg flex items-center">
              <Wand2 className="w-5 h-5 mr-2" /> {editingTask ? 'Edit Task' : 'Schedule Task'}
            </h4>
            <p className="text-blue-100 dark:text-muted-foreground text-sm mt-1">Create automated tasks for your agent</p>
          </div>
          
          {/* Modern Step Indicator */}
          <div className="px-6 py-3 bg-muted/50 dark:bg-muted/50">
            <div className="flex items-center justify-between">
              {(() => {
                const steps = [
                  { num: 1, label: 'Type', icon: Zap, color: 'text-blue-600 dark:text-blue-400' },
                  { num: 2, label: 'Schedule', icon: Calendar, color: 'text-blue-600 dark:text-blue-400' },
                  ...(scheduleMode === 'recurring' ? [{ num: 3, label: 'Recurrence', icon: RotateCcw, color: 'text-blue-600 dark:text-blue-400' }] : []),
                  { num: 4, label: 'Instructions', icon: FileEdit, color: 'text-blue-600 dark:text-blue-400' },
                  { num: 5, label: 'Title', icon: Tag, color: 'text-blue-600 dark:text-blue-400' },
                  { num: 6, label: 'Conversation', icon: MessageCircle, color: 'text-cyan-600 dark:text-cyan-400' }
                ];
                return steps.map((step, index) => {
                const adjustedStepNum = scheduleMode === 'recurring' ? step.num : (step.num > 3 ? step.num - 1 : step.num);
                const isActive = currentStep === adjustedStepNum;
                const isCompleted = currentStep > adjustedStepNum;
                
                return (
                  <div key={step.num} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                      ${isActive 
                        ? `${step.color} bg-background dark:bg-background border-current shadow-lg scale-110` 
                        : isCompleted 
                          ? 'bg-blue-500 dark:bg-blue-600 border-blue-500 dark:border-blue-600 text-white' 
                          : 'bg-muted dark:bg-muted border-border dark:border-border text-muted-foreground'
                      }
                    `}>
                      {isCompleted ? (
                        <span className="text-sm">✓</span>
                      ) : (
                        <step.icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="ml-2">
                      <div className={`text-xs font-medium ${isActive ? step.color : isCompleted ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                        {step.label}
                      </div>
                    </div>
                    {index < (steps.length - 1) && (
                      <div className={`w-8 h-0.5 mx-2 ${isCompleted ? 'bg-blue-500 dark:bg-blue-600' : 'bg-border dark:bg-border'}`} />
                    )}
                  </div>
                );
              });
              })()}
            </div>
          </div>
          
          {/* Content Area */}
          <div className="px-6 py-4 space-y-4 bg-background dark:bg-background">
            {/* Step 1: Type Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Choose Your Task Type
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Select whether this task runs once or repeats on a schedule
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setScheduleMode('one_time')}
                    className={`
                      group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg
                      ${scheduleMode === 'one_time' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg' 
                        : 'border-border dark:border-border bg-card dark:bg-card hover:border-blue-300 dark:hover:border-blue-600'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="mb-3">
                        <Zap className="w-8 h-8 mx-auto text-blue-500" />
                      </div>
                      <h4 className="font-semibold text-foreground mb-2">One-time</h4>
                      <p className="text-xs text-muted-foreground">Run once at a specific time</p>
                    </div>
                    {scheduleMode === 'one_time' && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      </div>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setScheduleMode('recurring')}
                    className={`
                      group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg
                      ${scheduleMode === 'recurring' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg' 
                        : 'border-border dark:border-border bg-card dark:bg-card hover:border-blue-300 dark:hover:border-blue-600'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="mb-3">
                        <RotateCcw className="w-8 h-8 mx-auto text-blue-500" />
                      </div>
                      <h4 className="font-semibold text-foreground mb-2">Recurring</h4>
                      <p className="text-xs text-muted-foreground">Repeat on a schedule</p>
                    </div>
                    {scheduleMode === 'recurring' && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Schedule */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Set Your Schedule
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Choose when this task should {scheduleMode === 'one_time' ? 'run' : 'start running'}
                  </p>
                </div>
                
                <div className="bg-card dark:bg-card rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        {scheduleMode === 'one_time' ? 'Date' : 'Start date'}
                      </label>
                      <Input 
                        type="date" 
                        value={scheduleMode==='one_time'? oneTimeDate : recurringStartDate} 
                        onChange={(e) => (scheduleMode==='one_time'? setOneTimeDate : setRecurringStartDate)(e.target.value)} 
                        className="border-blue-300 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-500" 
                      />
                    </div>
                    {scheduleMode === 'recurring' && (
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400">
                          <span className="mr-2">🏁</span> End date (optional)
                        </label>
                        <Input 
                          type="date" 
                          value={recurringEndDate} 
                          onChange={(e) => setRecurringEndDate(e.target.value)} 
                          className="border-blue-300 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-500" 
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400">
                      <Clock className="w-4 h-4 mr-2" />
                      Select a time:
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Time</label>
                        <Input 
                          type="time" 
                          value={scheduleMode==='one_time'? oneTimeTime : recurringTime} 
                          onChange={(e) => (scheduleMode==='one_time'? setOneTimeTime : setRecurringTime)(e.target.value)} 
                          className="border-blue-300 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-500" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Timezone</label>
                        <select
                          value={selectedTimezone}
                          onChange={(e) => setSelectedTimezone(e.target.value)}
                          className="w-full p-2 border border-green-300 dark:border-green-700 rounded-lg text-sm bg-background dark:bg-background text-foreground focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800"
                        >
                          {getSupportedTimezones().map(tz => (
                            <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Recurrence (only for recurring tasks) */}
            {currentStep === 3 && scheduleMode === 'recurring' && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    🔄 Set Recurrence
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    How often should this task repeat?
                  </p>
                </div>
                
                <div className="bg-card dark:bg-card rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400">
                        <Hash className="w-4 h-4 mr-2" />
                        Every
                      </label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={everyInterval} 
                        onChange={(e) => setEveryInterval(Math.max(1, parseInt(e.target.value || '1', 10)))} 
                        className="border-blue-300 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-500" 
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400">
                        <Clock className="w-4 h-4 mr-2" />
                        Time unit
                      </label>
                      <select
                        value={everyUnit}
                        onChange={(e) => setEveryUnit(e.target.value as any)}
                        className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded-lg text-sm bg-background dark:bg-background text-foreground focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                      >
                        <option value="minute">Minute(s)</option>
                        <option value="hour">Hour(s)</option>
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                        <option value="year">Year(s)</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted/50 dark:bg-muted/50 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center">
                      <Lightbulb className="w-3 h-3 mr-2" />
                      For weeks and years, intervals greater than 1 are approximated due to cron limits.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Multi-Step Instructions */}
            {currentStep === 4 && (
              <div className="space-y-4">

                
                <StepManager
                  taskId={editingTask?.id} 
                  agentId={agentId}
                  agentName={agentData?.name}
                  initialSteps={taskSteps}
                  onStepsChange={setTaskSteps}
                  onValidationChange={setStepsValid}
                  isEditing={!!editingTask}
                  className="bg-card dark:bg-card rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-4"
                />
                
                {/* Legacy single instruction fallback */}

              </div>
            )}

            {/* Step 5: Title */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    <Tag className="w-5 h-5 mr-2 inline" />
                    Name Your Task
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Give your task a memorable title
                  </p>
                </div>
                
                <div className="bg-card dark:bg-card rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm">
                  <label className="flex items-center text-sm font-medium text-blue-700 dark:text-blue-400 mb-3">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Task Title
                  </label>
                  <Input 
                    placeholder="e.g., Daily Market Research, Weekly Social Media Check" 
                    value={newTaskTitle} 
                    onChange={(e) => setNewTaskTitle(e.target.value)} 
                    className="border-blue-300 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-500 bg-background dark:bg-background"
                  />
                  <div className="mt-3 p-3 bg-muted/50 dark:bg-muted/50 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center">
                      <Lightbulb className="w-3 h-3 mr-2" />
                      Choose a title that makes it easy to identify this task later
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Conversation */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    💬 Choose Conversation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Where should the task results be sent?
                  </p>
                </div>
                
                <div className="bg-card dark:bg-card rounded-xl p-6 border border-cyan-200 dark:border-cyan-800 shadow-sm">
                  <label className="flex items-center text-sm font-medium text-cyan-700 dark:text-cyan-400 mb-3">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Conversation destination
                  </label>
                  <select
                    value={targetConversationId}
                    onChange={(e) => setTargetConversationId(e.target.value)}
                    className="w-full p-3 border border-cyan-300 dark:border-cyan-700 rounded-lg text-sm bg-background dark:bg-background text-foreground focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-800"
                  >
                    <option value="">✨ Create a new conversation</option>
                    {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((c: any) => (
                      <option key={c.conversation_id} value={c.conversation_id}>💬 {c.title || 'Conversation'}</option>
                    ))}
                  </select>
                  <div className="mt-3 p-3 bg-muted/50 dark:bg-muted/50 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <p className="text-xs text-cyan-700 dark:text-cyan-400 flex items-center">
                      <Target className="w-3 h-3 mr-2" />
                      {targetConversationId ? 'Task results will be added to the selected conversation' : 'A new conversation will be created for this task'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modern Navigation Footer */}
          <div className="px-6 py-4 bg-muted/30 dark:bg-muted/30 border-t border-border dark:border-border rounded-b-xl">
            <div className="flex items-center justify-between">
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                {currentStep > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex space-x-3">
                {!isLastStep && (
                  <Button 
                    size="sm" 
                    onClick={handleNext}
                    disabled={
                      (currentStep === 1 && !scheduleMode) ||
                      (currentStep === 2 && ((scheduleMode === 'one_time' && (!oneTimeDate || !oneTimeTime)) || (scheduleMode === 'recurring' && (!recurringStartDate || !recurringTime)))) ||
                      (currentStep === 3 && scheduleMode === 'recurring' && (!everyInterval || everyInterval < 1)) ||
                      (currentStep === 4 && taskSteps.length === 0) ||
                      (currentStep === 5 && !newTaskTitle.trim())
                    }
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                {isLastStep && (
                  <Button 
                    size="sm" 
                    onClick={handleSaveTask} 
                    disabled={!isFormValid() || loading}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {editingTask ? 'Update Task' : 'Save Task'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
