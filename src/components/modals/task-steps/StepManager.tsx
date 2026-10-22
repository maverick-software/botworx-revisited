import React, { useState, useCallback, useEffect } from 'react';
import { StepList } from './StepList';
import { StepEditor } from './StepEditor';
import { useTaskSteps } from '@/hooks/useTaskSteps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ListOrdered, 
  Plus, 
  AlertCircle, 
  CheckCircle,
  Loader2
} from 'lucide-react';
import { StepManagerProps, TaskStepFormData } from '@/types/tasks';
import { cn } from '@/lib/utils';

export function StepManager({
  taskId,
  initialSteps = [],
  onStepsChange,
  onValidationChange,
  isEditing = false,
  disabled = false,
  agentId,
  agentName,
  className
}: StepManagerProps) {
  
  // Step management hook
  const {
    steps,
    isLoading,
    error,
    validationErrors,
    isValid,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps
  } = useTaskSteps({
    taskId,
    initialSteps,
    onStepsChange,
    validateSteps: true
  });

  // Local UI state
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [stepToEdit, setStepToEdit] = useState<any>(null);

  // Notify parent of validation changes
  useEffect(() => {
    onValidationChange?.(isValid && steps.length > 0);
  }, [isValid, steps.length, onValidationChange]);

  // Generate unique step name
  const generateUniqueStepName = useCallback(() => {
    const existingNames = new Set(steps.map(step => step.step_name));
    let counter = 1;
    let proposedName = `New Step ${counter}`;
    
    // Keep incrementing until we find a unique name
    while (existingNames.has(proposedName)) {
      counter++;
      proposedName = `New Step ${counter}`;
    }
    
    return proposedName;
  }, [steps]);

  // Handle adding a new step (instant gratification)
  const handleAddNewStep = useCallback(async () => {
    try {
      // Create a new step with default values immediately
      const uniqueStepName = generateUniqueStepName();
      const newStepData = {
        step_name: uniqueStepName,
        instructions: 'Click edit to add instructions for this step...',
        include_previous_context: false
      };
      
      await addStep(newStepData);
    } catch (err) {
      console.error('Failed to create new step:', err);
    }
  }, [generateUniqueStepName, addStep]);

  // Handle step editing
  const handleStepEdit = useCallback((stepId: string | null) => {
    if (stepId === 'new') {
      // This now triggers immediate step creation
      handleAddNewStep();
    } else if (stepId) {
      const step = steps.find(s => s.id === stepId);
      setStepToEdit(step);
      setShowStepEditor(true);
    } else {
      setEditingStep(null);
      setShowStepEditor(false);
      setStepToEdit(null);
    }
  }, [steps, handleAddNewStep]);

  // Handle step save from editor
  const handleStepSave = useCallback(async (stepData: TaskStepFormData) => {
    try {
      if (stepToEdit) {
        // Update existing step
        await updateStep(stepToEdit.id, stepData);
      } else {
        // Add new step
        await addStep(stepData);
      }
      setShowStepEditor(false);
      setStepToEdit(null);
    } catch (err) {
      console.error('Failed to save step:', err);
    }
  }, [stepToEdit, updateStep, addStep]);

  // Handle step update from inline editing
  const handleStepUpdate = useCallback(async (stepId: string, updates: Partial<TaskStepFormData>) => {
    await updateStep(stepId, updates);
    setEditingStep(null);
  }, [updateStep]);

  // Handle step deletion
  const handleStepDelete = useCallback(async (stepId: string) => {
    if (window.confirm('Are you sure you want to delete this step? This action cannot be undone.')) {
      await deleteStep(stepId);
    }
  }, [deleteStep]);

  // Handle drag operations
  const handleDragStart = useCallback((stepId: string) => {
    setDraggedStep(stepId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedStep(null);
  }, []);

  // Handle step reordering
  const handleStepReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    await reorderSteps(fromIndex, toIndex);
  }, [reorderSteps]);

  if (disabled) {
    return (
      <Card className={cn("opacity-60", className)}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center">
            <ListOrdered className="h-4 w-4 mr-2" />
            Task Steps (Disabled)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Step management is disabled in this context.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Add Step button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Configure Task Steps</h3>
          <p className="text-sm text-muted-foreground">Break down your task into sequential steps with specific instructions</p>
        </div>
        <Button
          onClick={() => handleStepEdit('new')}
          size="sm"
          className="flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">
                Loading task steps...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step list */}
      {!isLoading && steps.length > 0 && (
        <StepList
          steps={steps}
          editingStep={editingStep}
          draggedStep={draggedStep}
          validationErrors={validationErrors}
          onStepUpdate={handleStepUpdate}
          onStepDelete={handleStepDelete}
          onStepEdit={handleStepEdit}
          onStepReorder={handleStepReorder}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}
      
      {/* Empty state for new tasks */}
      {!isLoading && steps.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-16 h-16 bg-muted/50 dark:bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <ListOrdered className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Steps Added Yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Break down your task into sequential steps. Each step can have its own instructions and optionally receive context from the previous step.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step Editor Modal */}
      <StepEditor
        step={stepToEdit}
        isOpen={showStepEditor}
        onSave={handleStepSave}
        onCancel={() => {
          setShowStepEditor(false);
          setStepToEdit(null);
        }}
        previousStepResult={
          stepToEdit && stepToEdit.step_order > 1 
            ? steps.find(s => s.step_order === stepToEdit.step_order - 1)?.execution_result
            : undefined
        }
        existingStepNames={steps.map(s => s.step_name)}
      />


    </div>
  );
}
