import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StepCardProps, TaskStepFormData } from '@/types/tasks';

export function StepCard({
  step,
  isEditing,
  isDragging,
  validationErrors,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onContextToggle
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editData, setEditData] = useState<TaskStepFormData>({
    step_name: step.display_name || step.step_name,
    instructions: step.instructions,
    include_previous_context: step.include_previous_context
  });



  // Handle save with validation
  const handleSave = useCallback(() => {
    const trimmedData = {
      step_name: editData.step_name.trim(),
      instructions: editData.instructions.trim(),
      include_previous_context: editData.include_previous_context
    };
    
    // Basic validation before save
    if (!trimmedData.step_name || trimmedData.step_name.length === 0) {
      return;
    }
    
    if (!trimmedData.instructions || trimmedData.instructions.length < 10) {
      return;
    }
    
    onSave(trimmedData);
  }, [editData, onSave]);

  // Handle cancel editing
  const handleCancel = useCallback(() => {
    setEditData({
      step_name: step.display_name || step.step_name,
      instructions: step.instructions,
      include_previous_context: step.include_previous_context
    });
    onCancel();
  }, [step, onCancel]);

  if (isEditing) {
    return (
      <Card className={cn(
        "border-2 border-blue-500 shadow-lg transition-all duration-200",
        isDragging && "rotate-2 shadow-xl"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                Editing Step
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-7 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Step name input */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Step Name
            </label>
            <Input
              value={editData.step_name}
              onChange={(e) => setEditData(prev => ({ ...prev, step_name: e.target.value }))}
              placeholder="Enter step name..."
              className="text-sm"
              maxLength={100}
            />
            {validationErrors.some(err => err.includes('Step name')) && (
              <p className="text-xs text-red-500 mt-1">
                {validationErrors.find(err => err.includes('Step name'))}
              </p>
            )}
          </div>

          {/* Instructions input */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Instructions
            </label>
            <Textarea
              value={editData.instructions}
              onChange={(e) => setEditData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Enter detailed instructions for this step..."
              className="text-sm min-h-[80px] resize-none"
              maxLength={5000}
            />
            <div className="flex justify-between mt-1">
              {validationErrors.some(err => err.includes('Instructions')) && (
                <p className="text-xs text-red-500">
                  {validationErrors.find(err => err.includes('Instructions'))}
                </p>
              )}
              <p className="text-xs text-gray-500 ml-auto">
                {editData.instructions.length}/5000
              </p>
            </div>
          </div>

          {/* Context toggle */}
          {step.step_order > 1 && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Include Previous Context</p>
                <p className="text-xs text-gray-500">
                  Pass results from Step {step.step_order - 1} to this step
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newValue = !editData.include_previous_context;
                  setEditData(prev => ({ ...prev, include_previous_context: newValue }));
                  onContextToggle(newValue);
                }}
                className="p-1"
              >
                {editData.include_previous_context ? (
                  <ToggleRight className="h-5 w-5 text-blue-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
              </Button>
            </div>
          )}

          {/* Validation errors summary */}
          {validationErrors.length > 0 && (
            <div className="flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-600">
                <p className="font-medium mb-1">Please fix the following issues:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "group hover:shadow-md transition-all duration-200 cursor-pointer border-0 bg-muted/30 dark:bg-muted/20 mb-3",
      isDragging && "rotate-1 shadow-xl opacity-80",
      validationErrors.length > 0 && "border-red-300 bg-red-50/30"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GripVertical className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {step.display_name || step.step_name}
            </h4>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Action buttons - visible on hover */}
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 px-2"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {isExpanded && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Instructions:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs leading-relaxed">
                  {step.instructions}
                </p>
              </div>
              
              {step.include_previous_context && step.step_order > 1 && (
                <div className="flex items-center space-x-2 text-xs text-blue-600">
                  <ToggleRight className="h-3 w-3" />
                  <span>Includes context from Step {step.step_order - 1}</span>
                </div>
              )}
              
              {step.execution_result && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Result:</p>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-20">
                    {JSON.stringify(step.execution_result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          {!isExpanded && step.instructions.length > 100 && step.instructions !== 'Click edit to add instructions for this step...' && (
            <p className="text-xs text-gray-500 truncate">
              {step.instructions.substring(0, 100)}...
            </p>
          )}
        </div>
        
        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mt-3 flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded">
            <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-600">
              {validationErrors.slice(0, 2).map((error, index) => (
                <p key={index}>{error}</p>
              ))}
              {validationErrors.length > 2 && (
                <p>+{validationErrors.length - 2} more issues</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
