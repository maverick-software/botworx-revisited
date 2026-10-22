import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { TaskStep, TaskStepFormData } from '@/types/tasks';
import { toast } from 'react-hot-toast';

interface UseTaskStepsOptions {
  taskId?: string;
  initialSteps?: TaskStep[];
  onStepsChange?: (steps: TaskStep[]) => void;
  validateSteps?: boolean;
}

interface UseTaskStepsReturn {
  steps: TaskStep[];
  isLoading: boolean;
  error: string | null;
  validationErrors: Record<string, string[]>;
  isValid: boolean;
  
  // CRUD operations
  addStep: (stepData: TaskStepFormData) => Promise<TaskStep | null>;
  updateStep: (stepId: string, updates: Partial<TaskStepFormData>) => Promise<boolean>;
  deleteStep: (stepId: string) => Promise<boolean>;
  reorderSteps: (fromIndex: number, toIndex: number) => Promise<boolean>;
  
  // Utility operations
  loadSteps: () => Promise<void>;
  validateAllSteps: () => void;
  resetSteps: () => void;
  getStepByOrder: (order: number) => TaskStep | undefined;
}

export function useTaskSteps(options: UseTaskStepsOptions): UseTaskStepsReturn {
  const { taskId, initialSteps = [], onStepsChange, validateSteps = true } = options;
  
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // State management
  const [steps, setSteps] = useState<TaskStep[]>(initialSteps);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Validation logic
  const validateStep = useCallback((step: TaskStep): string[] => {
    const errors: string[] = [];
    
    if (!step.step_name || step.step_name.trim().length === 0) {
      errors.push('Step name is required');
    }
    
    if (step.step_name && step.step_name.length > 100) {
      errors.push('Step name must be 100 characters or less');
    }
    
    if (!step.instructions || step.instructions.trim().length < 10) {
      errors.push('Instructions must be at least 10 characters');
    }
    
    if (step.instructions && step.instructions.length > 5000) {
      errors.push('Instructions must be 5000 characters or less');
    }
    
    // Note: First step can include previous context (conversation context)
    // No validation needed here as it's a valid use case
    
    return errors;
  }, []);

  const validateAllSteps = useCallback(() => {
    if (!validateSteps) return;
    
    const errors: Record<string, string[]> = {};
    
    // Validate each step
    steps.forEach(step => {
      const stepErrors = validateStep(step);
      if (stepErrors.length > 0) {
        errors[step.id] = stepErrors;
      }
    });
    
    // Note: Removed step name uniqueness validation since system handles uniqueness automatically
    
    setValidationErrors(errors);
  }, [steps, validateStep, validateSteps]);

  // Computed values
  const isValid = useMemo(() => {
    return Object.keys(validationErrors).length === 0 && steps.length > 0;
  }, [validationErrors, steps.length]);

  // Load steps from database
  const loadSteps = useCallback(async () => {
    if (!taskId || !user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: loadError } = await supabase
        .rpc('get_task_steps_with_context', { p_task_id: taskId });
      
      if (loadError) throw loadError;
      
      const loadedSteps: TaskStep[] = (data || []).map((row: any) => ({
        id: row.step_id,
        task_id: taskId,
        step_order: row.step_order,
        step_name: row.step_name,
        instructions: row.instructions,
        include_previous_context: row.include_previous_context,
        context_data: row.context_data,
        status: row.status,
        execution_result: row.execution_result,
        execution_started_at: row.execution_started_at,
        execution_completed_at: row.execution_completed_at,
        error_message: row.error_message,
        retry_count: row.retry_count || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        // For existing steps, use a human-readable display name
        display_name: `Step ${row.step_order}`
      }));
      
      setSteps(loadedSteps);
      onStepsChange?.(loadedSteps);
      
    } catch (err: any) {
      setError(err.message);
      toast.error(`Failed to load task steps: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, user, supabase, onStepsChange]);

  // Generate unique step name automatically
  const generateUniqueStepName = useCallback((userStepName: string, stepOrder: number): string => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return `step_${stepOrder}_${timestamp}_${randomId}`;
  }, []);

  // Add new step
  const addStep = useCallback(async (stepData: TaskStepFormData): Promise<TaskStep | null> => {
    if (!user) return null;
    
    try {
      const stepOrder = steps.length + 1;
      const uniqueStepName = generateUniqueStepName(stepData.step_name, stepOrder);
      
      // Create temporary step for immediate UI feedback
      const tempStep: TaskStep = {
        id: `temp-${Date.now()}`,
        task_id: taskId || '',
        step_order: stepOrder,
        step_name: uniqueStepName, // Use unique name internally
        instructions: stepData.instructions,
        include_previous_context: stepData.include_previous_context,
        status: 'pending',
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store user's display name separately for UI
        display_name: stepData.step_name
      };
      
      // Add to local state immediately
      const newSteps = [...steps, tempStep];
      setSteps(newSteps);
      onStepsChange?.(newSteps);
      
      // If we have a taskId, save to database
      if (taskId) {
        const { data, error: createError } = await supabase
          .rpc('create_task_step', {
            p_task_id: taskId,
            p_step_name: uniqueStepName, // Use unique name for database
            p_instructions: stepData.instructions,
            p_include_previous_context: stepData.include_previous_context
          });
        
        if (createError) throw createError;
        
        // Replace temp step with real step
        const realStep: TaskStep = { ...tempStep, id: data };
        const updatedSteps = newSteps.map(s => s.id === tempStep.id ? realStep : s);
        setSteps(updatedSteps);
        onStepsChange?.(updatedSteps);
        
        return realStep;
      }
      
      return tempStep;
      
    } catch (err: any) {
      // Remove temp step on error
      setSteps(steps);
      onStepsChange?.(steps);
      setError(err.message);
      toast.error(`Failed to add step: ${err.message}`);
      return null;
    }
  }, [user, steps, taskId, supabase, onStepsChange]);

  // Update existing step
  const updateStep = useCallback(async (stepId: string, updates: Partial<TaskStepFormData>): Promise<boolean> => {
    try {
      // Generate unique name if step_name is being updated
      let dbUpdates = { ...updates };
      if (updates.step_name) {
        const currentStep = steps.find(s => s.id === stepId);
        if (currentStep) {
          dbUpdates.step_name = generateUniqueStepName(updates.step_name, currentStep.step_order);
        }
      }
      
      // Update local state immediately
      const updatedSteps = steps.map(step => 
        step.id === stepId 
          ? { 
              ...step, 
              ...dbUpdates,
              display_name: updates.step_name || step.display_name, // Keep user's display name
              updated_at: new Date().toISOString() 
            }
          : step
      );
      setSteps(updatedSteps);
      onStepsChange?.(updatedSteps);
      
      // If we have a taskId and real stepId, update database
      if (taskId && !stepId.startsWith('temp-')) {
        const { error: updateError } = await supabase
          .rpc('update_task_step', {
            p_step_id: stepId,
            p_step_name: dbUpdates.step_name, // Use unique name for database
            p_instructions: updates.instructions,
            p_include_previous_context: updates.include_previous_context
          });
        
        if (updateError) throw updateError;
      }
      
      return true;
      
    } catch (err: any) {
      // Revert local state on error
      setSteps(steps);
      onStepsChange?.(steps);
      setError(err.message);
      toast.error(`Failed to update step: ${err.message}`);
      return false;
    }
  }, [steps, taskId, supabase, onStepsChange, generateUniqueStepName]);

  // Delete step
  const deleteStep = useCallback(async (stepId: string): Promise<boolean> => {
    try {
      // Prevent deletion if only one step
      if (steps.length <= 1) {
        toast.error('Cannot delete the last step - tasks must have at least one step');
        return false;
      }
      
      // Remove from local state immediately
      const filteredSteps = steps.filter(s => s.id !== stepId);
      // Reorder remaining steps
      const reorderedSteps = filteredSteps.map((step, index) => ({
        ...step,
        step_order: index + 1,
        updated_at: new Date().toISOString()
      }));
      
      setSteps(reorderedSteps);
      onStepsChange?.(reorderedSteps);
      
      // If we have a taskId and real stepId, delete from database
      if (taskId && !stepId.startsWith('temp-')) {
        const { error: deleteError } = await supabase
          .rpc('delete_task_step', { p_step_id: stepId });
        
        if (deleteError) throw deleteError;
      }
      
      return true;
      
    } catch (err: any) {
      // Revert local state on error
      setSteps(steps);
      onStepsChange?.(steps);
      setError(err.message);
      toast.error(`Failed to delete step: ${err.message}`);
      return false;
    }
  }, [steps, taskId, supabase, onStepsChange]);

  // Reorder steps
  const reorderSteps = useCallback(async (fromIndex: number, toIndex: number): Promise<boolean> => {
    try {
      const reorderedSteps = [...steps];
      const [movedStep] = reorderedSteps.splice(fromIndex, 1);
      reorderedSteps.splice(toIndex, 0, movedStep);
      
      // Update step orders
      const updatedSteps = reorderedSteps.map((step, index) => ({
        ...step,
        step_order: index + 1,
        updated_at: new Date().toISOString()
      }));
      
      setSteps(updatedSteps);
      onStepsChange?.(updatedSteps);
      
      // If we have a taskId, update database
      if (taskId) {
        const stepOrders = updatedSteps
          .filter(s => !s.id.startsWith('temp-'))
          .map(s => ({ stepId: s.id, newOrder: s.step_order }));
        
        if (stepOrders.length > 0) {
          const { error: reorderError } = await supabase
            .rpc('reorder_task_steps', {
              p_task_id: taskId,
              p_step_orders: stepOrders
            });
          
          if (reorderError) throw reorderError;
        }
      }
      
      return true;
      
    } catch (err: any) {
      // Revert local state on error
      setSteps(steps);
      onStepsChange?.(steps);
      setError(err.message);
      toast.error(`Failed to reorder steps: ${err.message}`);
      return false;
    }
  }, [steps, taskId, supabase, onStepsChange]);

  // Utility functions
  const resetSteps = useCallback(() => {
    setSteps(initialSteps);
    setError(null);
    setValidationErrors({});
    onStepsChange?.(initialSteps);
  }, [initialSteps, onStepsChange]);

  const getStepByOrder = useCallback((order: number): TaskStep | undefined => {
    return steps.find(step => step.step_order === order);
  }, [steps]);

  // Load steps when taskId changes
  useEffect(() => {
    if (taskId) {
      loadSteps();
    }
  }, [taskId, loadSteps]);

  // Validate steps when they change
  useEffect(() => {
    validateAllSteps();
  }, [validateAllSteps]);

  return {
    steps,
    isLoading,
    error,
    validationErrors,
    isValid,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
    loadSteps,
    validateAllSteps,
    resetSteps,
    getStepByOrder
  };
}
