export interface Task {
  id: string;
  user_id: string;
  agent_id: string;
  title: string;
  description: string;
  task_type: 'scheduled' | 'event_based';
  status: 'active' | 'paused' | 'completed' | 'failed';
  cron_expression?: string;
  scheduled_at?: string;
  start_date?: string;
  end_date?: string;
  max_executions?: number;
  execution_count: number;
  timezone: string;
  target_conversation_id?: string;
  schedule_label?: string;
  schedule?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskFormData {
  scheduleMode: 'one_time' | 'recurring';
  oneTimeDate: string;
  oneTimeTime: string;
  recurringStartDate: string;
  recurringEndDate: string;
  recurringTime: string;
  everyInterval: number;
  everyUnit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  newTaskDescription: string;
  newTaskTitle: string;
  targetConversationId: string;
  selectedTimezone: string;
}

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData: { name?: string };
  onAgentUpdated?: (updatedData: any) => void;
}

// Multi-Step Task Types
export interface TaskStep {
  id: string;
  task_id: string;
  step_order: number;
  step_name: string; // Unique internal name for database
  instructions: string;
  include_previous_context: boolean;
  context_data?: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  execution_result?: any;
  execution_started_at?: string;
  execution_completed_at?: string;
  execution_duration_ms?: number;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
  display_name?: string; // User-friendly name for UI display
}

export interface TaskStepFormData {
  step_name: string;
  instructions: string;
  include_previous_context: boolean;
}

export interface StepManagerProps {
  taskId?: string;
  initialSteps?: TaskStep[];
  onStepsChange: (steps: TaskStep[]) => void;
  onValidationChange: (isValid: boolean) => void;
  isEditing?: boolean;
  disabled?: boolean;
  agentId: string;
  agentName?: string;
  className?: string;
}

export interface StepListProps {
  steps: TaskStep[];
  editingStep: string | null;
  draggedStep: string | null;
  validationErrors: Record<string, string[]>;
  onStepUpdate: (stepId: string, updates: Partial<TaskStep>) => void;
  onStepDelete: (stepId: string) => void;
  onStepEdit: (stepId: string | null) => void;
  onStepReorder: (fromIndex: number, toIndex: number) => void;
  onDragStart: (stepId: string) => void;
  onDragEnd: () => void;
}

export interface StepCardProps {
  step: TaskStep;
  isEditing: boolean;
  isDragging: boolean;
  validationErrors: string[];
  onEdit: () => void;
  onSave: (updates: Partial<TaskStep>) => void;
  onCancel: () => void;
  onDelete: () => void;
  onContextToggle: (enabled: boolean) => void;
}

export interface StepEditorProps {
  step?: TaskStep;
  isOpen: boolean;
  onSave: (stepData: TaskStepFormData) => void;
  onCancel: () => void;
  previousStepResult?: any;
  existingStepNames?: string[];
}

export interface ContextToggleProps {
  enabled: boolean;
  previousStepResult?: any;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}