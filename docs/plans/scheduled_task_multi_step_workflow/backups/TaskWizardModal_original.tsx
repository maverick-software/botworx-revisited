import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getSupportedTimezones, 
  formatTimezoneLabel, 
  toUtcIsoForTimezone, 
  generateCronExpression, 
  getDefaultTimezone 
} from '@/lib/utils/taskUtils';

interface TaskWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData: { name?: string };
  onTaskCreated: () => void;
}

export function TaskWizardModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onTaskCreated
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
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [targetConversationId, setTargetConversationId] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState(getDefaultTimezone());

  const supabase = useSupabaseClient();
  const { user } = useAuth();



  const handleSaveTask = async () => {
    if (!user || !agentId) return;

    setLoading(true);
    try {
      const taskData: any = {
        agent_id: agentId,
        name: newTaskTitle,
        description: newTaskDescription,
        instructions: newTaskDescription, // Map description to instructions
        task_type: 'scheduled',
        timezone: selectedTimezone,
        selected_tools: [],
        event_trigger_type: '',
        event_trigger_config: {},
        target_conversation_id: targetConversationId || null
      };

      if (scheduleMode === 'one_time') {
        taskData.start_date = oneTimeDate;
        taskData.cron_expression = generateCronExpression('day', 1, oneTimeTime); // Simple cron for one-time
        taskData.max_executions = 1;
      } else {
        taskData.start_date = recurringStartDate;
        taskData.end_date = recurringEndDate || null;
        taskData.cron_expression = generateCronExpression(everyUnit, everyInterval, recurringTime);
      }

      const { data: result, error } = await supabase.functions.invoke('agent-tasks', {
        body: taskData,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(error.message || 'Failed to create task');
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
      setNewTaskDescription('');
      setNewTaskTitle('');
      setTargetConversationId('');

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!newTaskTitle.trim() || !newTaskDescription.trim()) return false;
    
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
    onClose();
  };

  const totalSteps = scheduleMode === 'recurring' ? 6 : 5;
  const isLastStep = currentStep === totalSteps;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Schedule Task Wizard</DialogTitle>
        <DialogDescription className="sr-only">Create automated tasks for your agent using this step-by-step wizard</DialogDescription>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-purple-50 to-cyan-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800">
          {/* Header with gradient */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <h4 className="font-semibold text-lg flex items-center">
              <span className="mr-2">🪄</span> Schedule Task
            </h4>
            <p className="text-blue-100 text-sm mt-1">Create automated tasks for your agent</p>
          </div>
          
          {/* Modern Step Indicator */}
          <div className="px-6 py-4 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              {[
                { num: 1, label: 'Type', icon: '⚡', color: 'text-blue-600' },
                { num: 2, label: 'Schedule', icon: '📅', color: 'text-green-600' },
                ...(scheduleMode === 'recurring' ? [{ num: 3, label: 'Recurrence', icon: '🔄', color: 'text-orange-600' }] : []),
                { num: 4, label: 'Instructions', icon: '📝', color: 'text-purple-600' },
                { num: 5, label: 'Title', icon: '🏷️', color: 'text-pink-600' },
                { num: 6, label: 'Conversation', icon: '💬', color: 'text-cyan-600' }
              ].map((step, index) => {
                const adjustedStepNum = scheduleMode === 'recurring' ? step.num : (step.num > 3 ? step.num - 1 : step.num);
                const isActive = currentStep === adjustedStepNum;
                const isCompleted = currentStep > adjustedStepNum;
                
                return (
                  <div key={step.num} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                      ${isActive 
                        ? `${step.color} bg-white border-current shadow-lg scale-110` 
                        : isCompleted 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : 'bg-gray-100 border-gray-300 text-gray-400'
                      }
                    `}>
                      {isCompleted ? '✓' : step.icon}
                    </div>
                    <div className="ml-2">
                      <div className={`text-xs font-medium ${isActive ? step.color : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                        {step.label}
                      </div>
                    </div>
                    {index < ([
                      { num: 1, label: 'Type', icon: '⚡', color: 'text-blue-600' },
                      { num: 2, label: 'Schedule', icon: '📅', color: 'text-green-600' },
                      ...(scheduleMode === 'recurring' ? [{ num: 3, label: 'Recurrence', icon: '🔄', color: 'text-orange-600' }] : []),
                      { num: 4, label: 'Instructions', icon: '📝', color: 'text-purple-600' },
                      { num: 5, label: 'Title', icon: '🏷️', color: 'text-pink-600' },
                      { num: 6, label: 'Conversation', icon: '💬', color: 'text-cyan-600' }
                    ].length - 1) && (
                      <div className={`w-8 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Content Area */}
          <div className="px-6 py-6 space-y-6">
            {/* Step 1: Type Selection */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Choose Your Task Type
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select whether this task runs once or repeats on a schedule
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setScheduleMode('one_time')}
                    className={`
                      group relative p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg
                      ${scheduleMode === 'one_time' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-lg' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-3">⚡</div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">One-time</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Run once at a specific time</p>
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
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 shadow-lg' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300'
                      }
                    `}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-3">🔄</div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Recurring</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Repeat on a schedule</p>
                    </div>
                    {scheduleMode === 'recurring' && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
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
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    📅 Set Your Schedule
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose when this task should {scheduleMode === 'one_time' ? 'run' : 'start running'}
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-green-200 dark:border-green-800 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-green-700 dark:text-green-400">
                        <span className="mr-2">📅</span> {scheduleMode === 'one_time' ? 'Date' : 'Start date'}
                      </label>
                      <Input 
                        type="date" 
                        value={scheduleMode==='one_time'? oneTimeDate : recurringStartDate} 
                        onChange={(e) => (scheduleMode==='one_time'? setOneTimeDate : setRecurringStartDate)(e.target.value)} 
                        className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500" 
                      />
                    </div>
                    {scheduleMode === 'recurring' && (
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-green-700 dark:text-green-400">
                          <span className="mr-2">🏁</span> End date (optional)
                        </label>
                        <Input 
                          type="date" 
                          value={recurringEndDate} 
                          onChange={(e) => setRecurringEndDate(e.target.value)} 
                          className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500" 
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <label className="flex items-center text-sm font-medium text-green-700 dark:text-green-400">
                      <span className="mr-2">🕐</span> Select a time:
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Time</label>
                        <Input 
                          type="time" 
                          value={scheduleMode==='one_time'? oneTimeTime : recurringTime} 
                          onChange={(e) => (scheduleMode==='one_time'? setOneTimeTime : setRecurringTime)(e.target.value)} 
                          className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-500" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Timezone</label>
                        <select
                          value={selectedTimezone}
                          onChange={(e) => setSelectedTimezone(e.target.value)}
                          className="w-full p-2 border border-green-300 dark:border-green-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800"
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
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    🔄 Set Recurrence
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    How often should this task repeat?
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-orange-200 dark:border-orange-800 shadow-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-orange-700 dark:text-orange-400">
                        <span className="mr-2">🔢</span> Every
                      </label>
                      <Input 
                        type="number" 
                        min={1} 
                        value={everyInterval} 
                        onChange={(e) => setEveryInterval(Math.max(1, parseInt(e.target.value || '1', 10)))} 
                        className="border-orange-300 dark:border-orange-700 focus:border-orange-500 dark:focus:border-orange-500" 
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <label className="flex items-center text-sm font-medium text-orange-700 dark:text-orange-400">
                        <span className="mr-2">⏰</span> Time unit
                      </label>
                      <select
                        value={everyUnit}
                        onChange={(e) => setEveryUnit(e.target.value as any)}
                        className="w-full p-2 border border-orange-300 dark:border-orange-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800"
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
                  <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center">
                      <span className="mr-2">💡</span>
                      For weeks and years, intervals greater than 1 are approximated due to cron limits.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Instructions */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    📝 Task Instructions
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tell your agent exactly what you want it to do
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-purple-200 dark:border-purple-800 shadow-sm">
                  <label className="flex items-center text-sm font-medium text-purple-700 dark:text-purple-400 mb-3">
                    <span className="mr-2">💭</span> Instructions
                  </label>
                  <Textarea 
                    placeholder="Be specific about what you want the agent to do. For example: 'Search for the latest AI news and summarize the top 3 articles' or 'Check our company's social media engagement and provide a brief report.'" 
                    value={newTaskDescription} 
                    onChange={(e) => setNewTaskDescription(e.target.value)} 
                    className="min-h-[120px] resize-none border-purple-300 dark:border-purple-700 focus:border-purple-500 dark:focus:border-purple-500 bg-purple-50/30 dark:bg-purple-950/20" 
                  />
                  <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center">
                      <span className="mr-2">✨</span>
                      Clear instructions help your agent perform tasks more effectively
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Title */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    🏷️ Name Your Task
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Give your task a memorable title
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-pink-200 dark:border-pink-800 shadow-sm">
                  <label className="flex items-center text-sm font-medium text-pink-700 dark:text-pink-400 mb-3">
                    <span className="mr-2">✍️</span> Task Title
                  </label>
                  <Input 
                    placeholder="e.g., Daily Market Research, Weekly Social Media Check" 
                    value={newTaskTitle} 
                    onChange={(e) => setNewTaskTitle(e.target.value)} 
                    className="border-pink-300 dark:border-pink-700 focus:border-pink-500 dark:focus:border-pink-500 bg-pink-50/30 dark:bg-pink-950/20"
                  />
                  <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-950/30 rounded-lg border border-pink-200 dark:border-pink-800">
                    <p className="text-xs text-pink-700 dark:text-pink-400 flex items-center">
                      <span className="mr-2">💡</span>
                      Choose a title that makes it easy to identify this task later
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Conversation */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    💬 Choose Conversation
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Where should the task results be sent?
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-cyan-200 dark:border-cyan-800 shadow-sm">
                  <label className="flex items-center text-sm font-medium text-cyan-700 dark:text-cyan-400 mb-3">
                    <span className="mr-2">🗨️</span> Conversation destination
                  </label>
                  <select
                    value={targetConversationId}
                    onChange={(e) => setTargetConversationId(e.target.value)}
                    className="w-full p-3 border border-cyan-300 dark:border-cyan-700 rounded-lg text-sm bg-cyan-50/30 dark:bg-cyan-950/20 text-gray-800 dark:text-gray-200 focus:border-cyan-500 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-800"
                  >
                    <option value="">✨ Create a new conversation</option>
                    {(Array.isArray(window.__agentopiaConversations) ? window.__agentopiaConversations : []).map((c: any) => (
                      <option key={c.conversation_id} value={c.conversation_id}>💬 {c.title || 'Conversation'}</option>
                    ))}
                  </select>
                  <div className="mt-3 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                    <p className="text-xs text-cyan-700 dark:text-cyan-400 flex items-center">
                      <span className="mr-2">🎯</span>
                      {targetConversationId ? 'Task results will be added to the selected conversation' : 'A new conversation will be created for this task'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modern Navigation Footer */}
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
            <div className="flex items-center justify-between">
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ❌ Cancel
                </Button>
                {currentStep > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBack}
                    className="border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                  >
                    ← Back
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
                      (currentStep === 4 && !newTaskDescription.trim()) ||
                      (currentStep === 5 && !newTaskTitle.trim())
                    }
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-lg"
                  >
                    Next → ✨
                  </Button>
                )}
                {isLastStep && (
                  <Button 
                    size="sm" 
                    onClick={handleSaveTask} 
                    disabled={!isFormValid() || loading}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-lg"
                  >
                    🚀 Save and Exit
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
