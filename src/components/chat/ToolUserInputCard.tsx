// Tool User Input Card Component
// Displays an interactive card requesting additional user input for tool execution
// File: src/components/chat/ToolUserInputCard.tsx

import React, { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ToolUserInputField {
  name: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  validation?: string;
  options?: string[];
}

interface ToolUserInputRequest {
  id: string;
  tool_name: string;
  tool_call_id: string;
  reason?: string;
  required_fields: ToolUserInputField[];
  status: 'pending' | 'completed' | 'cancelled';
}

interface ToolUserInputCardProps {
  request: ToolUserInputRequest;
  onSubmit: (toolCallId: string, inputs: Record<string, any>) => Promise<void>;
  onCancel?: (toolCallId: string) => void;
}

export const ToolUserInputCard: React.FC<ToolUserInputCardProps> = ({
  request,
  onSubmit,
  onCancel
}) => {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleInputChange = (fieldName: string, value: any) => {
    setInputs(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of request.required_fields) {
      const value = inputs[field.name];

      // Check required fields
      if (field.required && !value) {
        newErrors[field.name] = `${field.label} is required`;
        continue;
      }

      // Validate format if validation regex provided
      if (value && field.validation) {
        const regex = new RegExp(field.validation);
        if (!regex.test(value)) {
          newErrors[field.name] = `Invalid format for ${field.label}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(request.tool_call_id, inputs);
      setIsCompleted(true);
    } catch (error) {
      console.error('Failed to submit user input:', error);
      setErrors({ _general: 'Failed to submit input. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel(request.tool_call_id);
    }
  };

  if (isCompleted) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Check className="w-5 h-5" />
            Input Provided
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-600 dark:text-green-400">
            Thank you! The tool can now proceed with your information.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Additional Information Needed
        </CardTitle>
        <CardDescription>
          {request.reason || `The tool "${request.tool_name}" requires additional information to proceed.`}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {errors._general && (
          <Alert variant="destructive">
            <AlertDescription>{errors._general}</AlertDescription>
          </Alert>
        )}

        {request.required_fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}

            {field.type === 'select' && field.options ? (
              <select
                id={field.name}
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                value={inputs[field.name] || ''}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Select...</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                type={field.type}
                placeholder={field.placeholder}
                value={inputs[field.name] || ''}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                disabled={isSubmitting}
                className={errors[field.name] ? 'border-red-500' : ''}
              />
            )}

            {errors[field.name] && (
              <p className="text-xs text-red-500">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ToolUserInputCard;

