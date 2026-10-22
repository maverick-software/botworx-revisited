import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  X, 
  AlertCircle, 
  Eye, 
  ToggleLeft, 
  ToggleRight,
  Edit3,
  Plus,
  Loader2,
  HelpCircle,
  Upload,
  FileText,
  Trash2,
  Paperclip
} from 'lucide-react';
import { StepEditorProps, TaskStepFormData } from '@/types/tasks';
import { cn } from '@/lib/utils';
import { MediaLibrarySelector } from '@/components/modals/MediaLibrarySelector';

export function StepEditor({
  step,
  isOpen,
  onSave,
  onCancel,
  previousStepResult,
  existingStepNames = []
}: StepEditorProps) {
  
  // Form state
  const [formData, setFormData] = useState<TaskStepFormData>({
    step_name: '',
    instructions: '',
    include_previous_context: false
  });
  
  // UI state
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGuidelinesHelp, setShowGuidelinesHelp] = useState(false);
  const [showContextHelp, setShowContextHelp] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    url?: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize form when step changes
  useEffect(() => {
    if (step) {
      setFormData({
        step_name: step.display_name || step.step_name,
        instructions: step.instructions,
        include_previous_context: step.include_previous_context
      });
    } else {
      // New step defaults
      setFormData({
        step_name: '',
        instructions: '',
        include_previous_context: false
      });
    }
    setValidationErrors([]);
    setShowValidationErrors(false);
  }, [step, isOpen]);

  // Form validation
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (!formData.step_name.trim()) {
      errors.push('Step name is required');
    } else if (formData.step_name.length > 100) {
      errors.push('Step name must be 100 characters or less');
    }
    // Note: Removed uniqueness validation - system handles uniqueness automatically
    
    if (!formData.instructions.trim()) {
      errors.push('Instructions are required');
    } else if (formData.instructions.trim().length < 10) {
      errors.push('Instructions must be at least 10 characters');
    } else if (formData.instructions.length > 5000) {
      errors.push('Instructions must be 5000 characters or less');
    }
    
    // Context validation - can't enable context for first step
    if (formData.include_previous_context && step?.step_order === 1) {
      errors.push('First step cannot include previous context');
    }
    
    return errors;
  }, [formData, step, existingStepNames]);

  // Handle form submission
  const handleSave = useCallback(async () => {
    const errors = validateForm();
    setValidationErrors(errors);
    setShowValidationErrors(true); // Only show errors when user tries to save
    
    if (errors.length > 0) {
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave({
        step_name: formData.step_name.trim(),
        instructions: formData.instructions.trim(),
        include_previous_context: formData.include_previous_context
      });
    } catch (err) {
      console.error('Failed to save step:', err);
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateForm, onSave]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setValidationErrors([]);
    setShowValidationErrors(false);
    setShowContextPreview(false);
    onCancel();
  }, [onCancel]);

  // Clear validation errors when user makes changes (with debounce)
  useEffect(() => {
    if (showValidationErrors) {
      const timer = setTimeout(() => {
        // Only clear if user has made some progress on both fields
        const hasStepName = formData.step_name.trim().length > 0;
        const hasInstructions = formData.instructions.trim().length >= 5;
        
        if (hasStepName && hasInstructions) {
          setShowValidationErrors(false);
          setValidationErrors([]);
        }
      }, 1000); // 1 second delay to avoid flashing
      
      return () => clearTimeout(timer);
    }
  }, [formData.step_name, formData.instructions, showValidationErrors]);

  const isEditing = !!step;
  const canShowContextPreview = previousStepResult && formData.include_previous_context;

  // File handling functions
  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      // TODO: Implement actual file upload to media library
      // For now, simulate the upload
      const newFiles = files.map(file => ({
        id: `temp-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file)
      }));
      
      setAttachedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleAttachFromLibrary = (libraryFiles: any[]) => {
    const newFiles = libraryFiles.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url
    }));
    
    setAttachedFiles(prev => [...prev, ...newFiles]);
    setShowMediaLibrary(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent 
        className={cn(
          "sm:max-w-[900px] max-h-[85vh] overflow-y-auto",
          "bg-background dark:bg-background border border-border dark:border-border",
          "!rounded-2xl"
        )}
        style={{ borderRadius: '1rem' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <Edit3 className="h-5 w-5 text-blue-600" />
                <span>Edit Step {step?.step_order}</span>
              </>
            ) : (
              <span>New Step</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuidelinesHelp(!showGuidelinesHelp)}
              className="p-1 h-6 w-6 ml-2"
              title="Step Guidelines"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          </DialogTitle>
          
          <DialogDescription>
            {isEditing 
              ? 'Modify the step name, instructions, and context settings.'
              : 'Create a new step with specific instructions for your agent.'
            }
          </DialogDescription>
          
          {/* Guidelines Help Tooltip */}
          {showGuidelinesHelp && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 mt-2 rounded-lg">
              <CardContent className="p-3">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                  <Edit3 className="h-4 w-4 mr-2 text-blue-600" />
                  Step Guidelines
                </h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Be specific about what the agent should accomplish</li>
                  <li>• Include any necessary context or parameters</li>
                  <li>• Consider what information might be needed from previous steps</li>
                  <li>• Use clear, actionable language</li>
                </ul>
              </CardContent>
            </Card>
          )}
          

        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-3">
          {/* Left Column - Instructions */}
          <div className="space-y-4">
            {/* Step name field */}
            <div className="space-y-2">
              <Label htmlFor="step_name" className="text-sm font-medium">
                Step Name *
              </Label>
              <Input
                id="step_name"
                value={formData.step_name}
                onChange={(e) => setFormData(prev => ({ ...prev, step_name: e.target.value }))}
                placeholder="e.g., Send welcome email, Process user data..."
                className="text-sm rounded-lg"
                maxLength={100}
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  A brief, descriptive name for this step
                </span>
                <span className={cn(
                  "text-muted-foreground",
                  formData.step_name.length > 80 && "text-yellow-600",
                  formData.step_name.length > 95 && "text-red-600"
                )}>
                  {formData.step_name.length}/100
                </span>
              </div>
            </div>

            {/* Instructions field */}
            <div className="space-y-2">
              <Label htmlFor="instructions" className="text-sm font-medium">
                Instructions *
              </Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Provide detailed instructions for what the agent should do in this step..."
                className="text-sm min-h-[200px] resize-y rounded-lg"
                maxLength={5000}
              />
              <div className="flex justify-end text-xs">
                <span className={cn(
                  "text-muted-foreground",
                  formData.instructions.length > 4000 && "text-yellow-600",
                  formData.instructions.length > 4800 && "text-red-600"
                )}>
                  {formData.instructions.length}/5000
                </span>
              </div>
            </div>

            {/* Include Previous Context - moved below instructions */}
            {(!step || step.step_order > 1) && (
              <div className="flex items-center justify-between p-4 bg-muted/30 dark:bg-muted/30 rounded-lg border border-border dark:border-border">
                <div className="flex items-center space-x-3">
                  <Label className="text-sm font-medium text-foreground">
                    Include Previous Context
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContextHelp(!showContextHelp)}
                    className="p-1 h-6 w-6"
                    title="Context Help"
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
                
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    include_previous_context: !prev.include_previous_context 
                  }))}
                  className="p-1 h-8 w-14 rounded-full"
                >
                  <div className={cn(
                    "relative inline-flex h-6 w-12 items-center rounded-full transition-colors",
                    formData.include_previous_context 
                      ? "bg-blue-600" 
                      : "bg-gray-300 dark:bg-gray-600"
                  )}>
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        formData.include_previous_context ? "translate-x-7" : "translate-x-1"
                      )}
                    />
                  </div>
                </Button>
              </div>
            )}

            {/* Context Help Tooltip */}
            {showContextHelp && (
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 rounded-lg">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <ToggleRight className="h-4 w-4 mr-2 text-green-600" />
                    Previous Context
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    When enabled, this step will receive the output/results from the previous step as additional context. 
                    This is useful when steps need to build upon each other or when the current step needs data from the previous step's execution.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - File Attachments */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                File Attachments
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload files or attach from media library to provide additional context for this step.
              </p>
            </div>

            {/* File Upload Actions */}
            <div className="space-y-3">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = '.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp';
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) {
                        handleFileUpload(Array.from(files));
                      }
                    };
                    input.click();
                  }}
                  className="flex-1"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMediaLibrary(true)}
                  className="flex-1"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  From Library
                </Button>
              </div>

              {/* Attached Files List */}
              {attachedFiles.length > 0 && (
                <Card className="rounded-lg">
                  <CardContent className="p-3">
                    <h4 className="text-sm font-medium text-foreground mb-2">
                      Attached Files ({attachedFiles.length})
                    </h4>
                    <div className="space-y-2">
                      {attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded border"
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-1 h-6 w-6 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* File Upload Guidelines */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 rounded-lg">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Supported File Types
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Documents:</strong> PDF, DOC, DOCX, TXT, MD</p>
                    <p><strong>Data:</strong> JSON, CSV, XLSX, XLS</p>
                    <p><strong>Images:</strong> PNG, JPG, JPEG, GIF, WEBP</p>
                    <p className="mt-2 text-blue-600 dark:text-blue-400">
                      Files are stored in your media library and can be reused across steps.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons - moved from footer */}
              <div className="flex justify-between space-x-3 pt-4 border-t border-border dark:border-border">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isEditing ? 'Update Step' : 'Add Step'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">

          {/* Context preview (only show if context is enabled and we have previous results) */}
          {canShowContextPreview && (
            <Card className="bg-muted/50 dark:bg-muted/50 border-border dark:border-border rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-foreground">
                    Previous Step Result Preview
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContextPreview(!showContextPreview)}
                    className="h-6 px-2 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {showContextPreview ? 'Hide' : 'Show'}
                  </Button>
                </div>
                
                {showContextPreview && (
                  <div className="bg-background dark:bg-background border border-border dark:border-border rounded p-3 max-h-32 overflow-y-auto">
                    <pre className="text-xs text-foreground whitespace-pre-wrap">
                      {JSON.stringify(previousStepResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation errors - only show after save attempt */}
          {showValidationErrors && validationErrors.length > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Please complete the following:
                    </p>
                    <ul className="space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index} className="text-xs text-blue-700 dark:text-blue-300 flex items-start">
                          <span className="mr-2">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


        </div>


      </DialogContent>

      {/* Media Library Selector Modal */}
      {showMediaLibrary && (
        <MediaLibrarySelector
          isOpen={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          onSelect={handleAttachFromLibrary}
          multiple={true}
          title="Attach Files from Media Library"
          description="Select files from your media library to attach to this step."
        />
      )}
    </Dialog>
  );
}
