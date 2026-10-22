// src/components/mcp/MCPServerConfig.tsx
import React, { useState, useEffect } from 'react';
import { MCPServerConfigProps, MCPServer } from '@/lib/mcp/ui-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  Save, 
  X, 
  RotateCcw,
  Trash2,
  Play,
  Server,
  AlertCircle,
  Info
} from 'lucide-react';

// Import tab components
import { GeneralConfigTab } from './forms/GeneralConfigTab';
import { ResourcesConfigTab } from './forms/ResourcesConfigTab';
import { NetworkingConfigTab } from './forms/NetworkingConfigTab';
import { AdvancedConfigTab } from './forms/AdvancedConfigTab';

const MCPServerConfig: React.FC<MCPServerConfigProps> = ({
  server,
  onSave,
  onCancel,
  onRestart,
  onDelete,
  loading = false,
  error,
  readOnly = false
}) => {
  const [config, setConfig] = useState<Partial<MCPServer>>(server);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setConfig(server);
    setHasChanges(false);
  }, [server]);

  const handleInputChange = (field: keyof MCPServer, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleNestedChange = (
    parent: keyof MCPServer,
    field: string,
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!config.name?.trim()) {
      errors.name = 'Server name is required';
    }

    if (!config.endpoint_url?.trim()) {
      errors.endpoint_url = 'Server endpoint URL is required';
    }

    // Validate timeout_ms is positive if provided
    if (config.timeout_ms && config.timeout_ms <= 0) {
      errors.timeout_ms = 'Timeout must be greater than 0';
    }

    // Validate max_retries is non-negative if provided
    if (config.max_retries && config.max_retries < 0) {
      errors.max_retries = 'Max retries cannot be negative';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(config);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save configuration:', err);
    }
  };

  const handleReset = () => {
    setConfig(server);
    setHasChanges(false);
    setValidationErrors({});
  };

  // Shared props for tab components
  const tabProps = {
    config,
    validationErrors,
    readOnly,
    onInputChange: handleInputChange,
    onNestedChange: handleNestedChange
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Server Configuration</h2>
          <p className="text-muted-foreground">Configure {server.name} settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={server.status.state === 'running' ? 'default' : 'secondary'}>
            {server.status.state}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Server className="h-3 w-3 mr-1" />
            MCP Server
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasChanges && !readOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Remember to save before leaving this page.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="networking">Networking</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralConfigTab {...tabProps} />
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <ResourcesConfigTab {...tabProps} />
        </TabsContent>

        <TabsContent value="networking" className="mt-6">
          <NetworkingConfigTab {...tabProps} />
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <AdvancedConfigTab {...tabProps} />
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {!readOnly && (
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={onRestart}
              disabled={loading}
            >
              <Play className="h-4 w-4 mr-2" />
              Restart Server
            </Button>
            <Button 
              variant="destructive"
              onClick={onDelete}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Server
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleReset}
              disabled={loading || !hasChanges}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || !hasChanges}
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPServerConfig; 