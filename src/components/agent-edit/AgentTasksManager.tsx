import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
    Clock, 
    Calendar, 
    Play, 
    Pause, 
    Square, 
    Edit, 
    Trash2, 
    Plus, 
    Mail, 
    Webhook, 
    User, 
    FileUp, 
    MessageSquare,
    Settings,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { ToolSelector } from './ToolSelector';
import { ScheduleSelector } from './ScheduleSelector';

interface AgentTask {
    id: string;
    agent_id: string;
    user_id: string;
    name: string;
    description?: string;
    task_type: 'scheduled' | 'event_based';
    status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
    instructions: string;
    selected_tools: string[];
    cron_expression?: string;
    timezone: string;
    next_run_at?: string;
    last_run_at?: string;
    event_trigger_type?: string;
    event_trigger_config: any;
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    max_executions?: number;
    start_date?: string;
    end_date?: string;
    created_at: string;
    updated_at: string;
}

interface AgentTasksManagerProps {
    agentId: string;
    availableTools: Array<{
        id: string;
        name: string;
        description?: string;
    }>;
}

const EVENT_TRIGGER_TYPES = [
    { value: 'email_received', label: 'When I get a new email', icon: Mail },
    { value: 'integration_webhook', label: 'When a webhook is received', icon: Webhook },
    { value: 'agent_mentioned', label: 'When I am mentioned', icon: User },
    { value: 'file_uploaded', label: 'When a file is uploaded', icon: FileUp },
    { value: 'workspace_message', label: 'When there is a new workspace message', icon: MessageSquare },
];

export const AgentTasksManager: React.FC<AgentTasksManagerProps> = ({ agentId, availableTools }) => {
    const [tasks, setTasks] = useState<AgentTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [editingTask, setEditingTask] = useState<AgentTask | null>(null);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    
    // Wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [totalSteps, setTotalSteps] = useState(5);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        task_type: 'scheduled' as 'scheduled' | 'event_based',
        instructions: '',
        selected_tools: [] as string[],
        cron_expression: '',
        timezone: 'UTC',
        event_trigger_type: '',
        event_trigger_config: {},
        max_executions: undefined as number | undefined,
        start_date: '',
        end_date: '',
    });

    const supabase = useSupabaseClient();

    useEffect(() => {
        fetchTasks();
    }, [agentId]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            
            // For GET requests with query parameters, use direct fetch approach
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setTasks(data.tasks || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async () => {
        try {
            setSaving(true);
            const taskData = {
                agent_id: agentId,
                ...formData,
                instructions: formData.description, // Map description to instructions
                selected_tools: formData.selected_tools,
            };

            const { data: result, error } = await supabase.functions.invoke('agent-tasks', {
                body: taskData,
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (error) {
                throw new Error(error.message || 'Failed to create task');
            }

            toast.success('Task created successfully');
            setShowCreateDialog(false);
            resetForm();
            fetchTasks();
        } catch (error) {
            console.error('Error creating task:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create task');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateTask = async (task: AgentTask) => {
        try {
            setSaving(true);
            const updateData = {
                ...formData,
                instructions: formData.description, // Map description to instructions
            };
            const response = await fetch(`/functions/v1/agent-tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update task');
            }

            toast.success('Task updated successfully');
            setEditingTask(null);
            resetForm();
            fetchTasks();
        } catch (error) {
            console.error('Error updating task:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update task');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const response = await fetch(`/functions/v1/agent-tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete task');
            }

            toast.success('Task deleted successfully');
            fetchTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Failed to delete task');
        }
    };

    const handleToggleTaskStatus = async (task: AgentTask) => {
        const newStatus = task.status === 'active' ? 'paused' : 'active';
        
        try {
            const response = await fetch(`/functions/v1/agent-tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                throw new Error('Failed to update task status');
            }

            toast.success(`Task ${newStatus === 'active' ? 'activated' : 'paused'}`);
            fetchTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
            toast.error('Failed to update task status');
        }
    };

    const handleRunTaskNow = async (taskId: string) => {
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

            toast.success('Task executed successfully');
            fetchTasks();
        } catch (error) {
            console.error('Error executing task:', error);
            toast.error('Failed to execute task');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            task_type: 'scheduled',
            instructions: '',
            selected_tools: [],
            cron_expression: '',
            timezone: 'UTC',
            event_trigger_type: '',
            event_trigger_config: {},
            max_executions: undefined,
            start_date: '',
            end_date: '',
        });
        setCurrentStep(1);
    };

    const nextStep = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const canProceedToNext = () => {
        switch (currentStep) {
            case 1:
                return formData.name.trim().length > 0 && formData.task_type;
            case 2:
                return formData.description.trim().length > 0;
            case 3:
                return formData.task_type === 'event_based' ? 
                    !!formData.event_trigger_type : 
                    !!formData.cron_expression;
            case 4:
                return formData.selected_tools.length > 0;
            case 5:
                return true; // Optional step
            default:
                return false;
        }
    };

    const startEditing = (task: AgentTask) => {
        setFormData({
            name: task.name,
            description: task.instructions || task.description || '', // Map instructions to description for editing
            task_type: task.task_type,
            instructions: task.instructions,
            selected_tools: task.selected_tools,
            cron_expression: task.cron_expression || '',
            timezone: task.timezone,
            event_trigger_type: task.event_trigger_type || '',
            event_trigger_config: task.event_trigger_config,
            max_executions: task.max_executions,
            start_date: task.start_date ? task.start_date.split('T')[0] : '',
            end_date: task.end_date ? task.end_date.split('T')[0] : '',
        });
        setCurrentStep(totalSteps); // Go to final step for editing
        setEditingTask(task);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'paused':
                return <Pause className="h-4 w-4 text-yellow-500" />;
            case 'completed':
                return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'cancelled':
                return <Square className="h-4 w-4 text-gray-500" />;
            default:
                return <AlertCircle className="h-4 w-4 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'paused':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'completed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'failed':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatNextRun = (nextRunAt?: string) => {
        if (!nextRunAt) return 'Not scheduled';
        return new Date(nextRunAt).toLocaleString();
    };

    const getStepTitle = () => {
        switch (currentStep) {
            case 1: return "Name Your Task";
            case 2: return "Describe Your Task";
            case 3: return formData.task_type === 'scheduled' ? "Set Schedule" : "Choose Event Trigger";
            case 4: return "Select Tools";
            case 5: return "Optional Settings";
            default: return "Create Task";
        }
    };

    const getStepDescription = () => {
        switch (currentStep) {
            case 1: return "Give your task a clear, descriptive name";
            case 2: return "Explain what this task should accomplish";
            case 3: return formData.task_type === 'scheduled' ? "When should this task run?" : "What should trigger this task?";
            case 4: return "Which tools can this task use?";
            case 5: return "Set limits and date ranges (optional)";
            default: return "";
        }
    };

    const TaskForm = ({ isEditing = false }) => (
        <div className="space-y-6">
            {/* Step Progress Indicator */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                    {Array.from({ length: totalSteps }, (_, i) => (
                        <div key={i} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                    i + 1 <= currentStep
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                            >
                                {i + 1}
                            </div>
                            {i < totalSteps - 1 && (
                                <div
                                    className={`w-8 h-0.5 mx-2 ${
                                        i + 1 < currentStep ? 'bg-primary' : 'bg-muted'
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <div className="text-sm text-muted-foreground">
                    Step {currentStep} of {totalSteps}
                </div>
            </div>

            {/* Step Title and Description */}
            <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">{getStepTitle()}</h3>
                <p className="text-muted-foreground">{getStepDescription()}</p>
            </div>

            {/* Step Content */}
            <div className="min-h-[300px]">
                {currentStep === 1 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-name">Task Name</Label>
                            <Input
                                id="task-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Daily Email Summary, Weekly Report Generation"
                                className="text-lg"
                                autoFocus
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="task-type">Task Type</Label>
                            <Select
                                value={formData.task_type}
                                onValueChange={(value: 'scheduled' | 'event_based') => 
                                    setFormData({ ...formData, task_type: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="scheduled">⏰ Scheduled (Time-based)</SelectItem>
                                    <SelectItem value="event_based">⚡ Event-based (Triggered)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-description">What should this task do?</Label>
                            <Textarea
                                id="task-description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Be specific about what you want the agent to accomplish. For example: 'Check my email and create a summary of important messages' or 'Generate a weekly report of my project progress'"
                                rows={6}
                                className="text-base"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-4">
                        {formData.task_type === 'scheduled' ? (
                            <ScheduleSelector
                                cronExpression={formData.cron_expression}
                                timezone={formData.timezone}
                                onScheduleChange={(cronExpression, timezone) => 
                                    setFormData({
                                        ...formData,
                                        cron_expression: cronExpression,
                                        timezone: timezone
                                    })
                                }
                                disabled={saving}
                            />
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="event-trigger">What should trigger this task?</Label>
                                <Select
                                    value={formData.event_trigger_type}
                                    onValueChange={(value) => setFormData({ ...formData, event_trigger_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose what will trigger this task" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EVENT_TRIGGER_TYPES.map((trigger) => (
                                            <SelectItem key={trigger.value} value={trigger.value}>
                                                <div className="flex items-center gap-2">
                                                    <trigger.icon className="h-4 w-4" />
                                                    {trigger.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-4">
                        <ToolSelector
                            agentId={agentId}
                            selectedTools={formData.selected_tools}
                            onToolSelectionChange={(selectedTools) => 
                                setFormData({
                                    ...formData,
                                    selected_tools: selectedTools
                                })
                            }
                            disabled={saving}
                        />
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start-date">Start Date (Optional)</Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="end-date">End Date (Optional)</Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="max-executions">Max Executions (Optional)</Label>
                            <Input
                                id="max-executions"
                                type="number"
                                min="1"
                                value={formData.max_executions || ''}
                                onChange={(e) => setFormData({ 
                                    ...formData, 
                                    max_executions: e.target.value ? parseInt(e.target.value) : undefined 
                                })}
                                placeholder="Leave empty for unlimited"
                            />
                            <p className="text-sm text-muted-foreground">
                                Maximum number of times this task should execute
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t">
                <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1 || saving}
                    className="flex items-center gap-2"
                >
                    ← Previous
                </Button>

                {currentStep < totalSteps ? (
                    <Button
                        onClick={nextStep}
                        disabled={!canProceedToNext() || saving}
                        className="flex items-center gap-2"
                    >
                        Next →
                    </Button>
                ) : (
                    <Button
                        onClick={() => isEditing ? (editingTask && handleUpdateTask(editingTask)) : handleCreateTask()}
                        disabled={saving}
                        className="flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isEditing ? 'Updating...' : 'Creating...'}
                            </>
                        ) : (
                            <>
                                {isEditing ? 'Update Task' : 'Create Task'}
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Tasks
                    </CardTitle>
                    <CardDescription>Manage scheduled and event-based tasks for this agent</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Tasks
                        </CardTitle>
                        <CardDescription>
                            Manage scheduled and event-based tasks for this agent
                        </CardDescription>
                    </div>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Task
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New Task</DialogTitle>
                                <DialogDescription>
                                    Create a scheduled or event-based task for your agent
                                </DialogDescription>
                            </DialogHeader>
                            <TaskForm />
                            <DialogFooter>
                                <Button variant="outline" onClick={() => {
                                    setShowCreateDialog(false);
                                    resetForm();
                                }} disabled={saving}>
                                    Cancel
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {tasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No tasks configured</p>
                        <p className="mb-4">Create your first task to automate agent actions</p>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Task
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tasks.map((task) => (
                            <div key={task.id} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedTask(
                                                expandedTask === task.id ? null : task.id
                                            )}
                                        >
                                            {expandedTask === task.id ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                        
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium">{task.name}</h4>
                                                <Badge 
                                                    variant="outline" 
                                                    className={getStatusColor(task.status)}
                                                >
                                                    {getStatusIcon(task.status)}
                                                    {task.status}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    {task.task_type === 'scheduled' ? (
                                                        <Clock className="h-3 w-3 mr-1" />
                                                    ) : (
                                                        <Calendar className="h-3 w-3 mr-1" />
                                                    )}
                                                    {task.task_type === 'scheduled' ? 'Scheduled' : 'Event-based'}
                                                </Badge>
                                            </div>
                                            {task.description && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {task.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleRunTaskNow(task.id)}
                                            disabled={task.status !== 'active'}
                                        >
                                            <Play className="h-4 w-4" />
                                        </Button>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleToggleTaskStatus(task)}
                                        >
                                            {task.status === 'active' ? (
                                                <Pause className="h-4 w-4" />
                                            ) : (
                                                <Play className="h-4 w-4" />
                                            )}
                                        </Button>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => startEditing(task)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleDeleteTask(task.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {expandedTask === task.id && (
                                    <div className="mt-4 pt-4 border-t space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium">Instructions:</span>
                                                <p className="text-muted-foreground mt-1">{task.instructions}</p>
                                            </div>
                                            
                                            <div>
                                                <span className="font-medium">Statistics:</span>
                                                <div className="text-muted-foreground mt-1">
                                                    <p>Total: {task.total_executions}</p>
                                                    <p>Successful: {task.successful_executions}</p>
                                                    <p>Failed: {task.failed_executions}</p>
                                                </div>
                                            </div>
                                            
                                            {task.task_type === 'scheduled' && (
                                                <div>
                                                    <span className="font-medium">Schedule:</span>
                                                    <div className="text-muted-foreground mt-1">
                                                        <p>Expression: {task.cron_expression}</p>
                                                        <p>Next run: {formatNextRun(task.next_run_at)}</p>
                                                        <p>Timezone: {task.timezone}</p>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {task.task_type === 'event_based' && (
                                                <div>
                                                    <span className="font-medium">Event Trigger:</span>
                                                    <p className="text-muted-foreground mt-1">
                                                        {EVENT_TRIGGER_TYPES.find(t => t.value === task.event_trigger_type)?.label}
                                                    </p>
                                                </div>
                                            )}
                                            
                                            <div>
                                                <span className="font-medium">Tools:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {task.selected_tools.map(toolId => {
                                                        const tool = availableTools.find(t => t.id === toolId);
                                                        return tool ? (
                                                            <Badge key={toolId} variant="secondary" className="text-xs">
                                                                {tool.name}
                                                            </Badge>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Edit Task Dialog */}
                <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Task</DialogTitle>
                            <DialogDescription>
                                Update the task configuration
                            </DialogDescription>
                        </DialogHeader>
                        <TaskForm isEditing={true} />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                setEditingTask(null);
                                resetForm();
                            }} disabled={saving}>
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}; 