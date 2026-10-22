import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useWorkspaceSettings, WorkspaceContextSettings } from '@/hooks/useWorkspaceSettings';
import { Loader2, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider, 
  TooltipTrigger
} from '@/components/ui/tooltip';

interface ContextSettingsTabProps {
  workspaceId: string;
}

export const ContextSettingsTab: React.FC<ContextSettingsTabProps> = ({ workspaceId }) => {
  const {
    contextSettings,
    loading,
    error,
    fetchSettings,
    updateSettings
  } = useWorkspaceSettings();

  const [messageCount, setMessageCount] = useState<number>(20);
  const [tokenLimit, setTokenLimit] = useState<number>(8000);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings(workspaceId);
  }, [workspaceId, fetchSettings]);

  useEffect(() => {
    if (contextSettings) {
      setMessageCount(contextSettings.context_window_size);
      setTokenLimit(contextSettings.context_window_token_limit);
    }
  }, [contextSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const success = await updateSettings(workspaceId, {
        context_window_size: messageCount,
        context_window_token_limit: tokenLimit
      });

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError('Failed to save settings. Please try again.');
      }
    } catch (err) {
      setSaveError('An unexpected error occurred.');
      console.error('Error saving context settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading context settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md flex items-center">
        <AlertCircle className="h-5 w-5 text-destructive mr-2" />
        <p className="text-destructive">Error loading context settings: {error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchSettings(workspaceId)}
          className="ml-auto"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">Context Window Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how much conversation history is included when agents respond.
        </p>
      </div>

      <div className="space-y-5">
        {/* Message Count Setting */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="message-count" className="text-base flex items-center">
              Message History Count
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 ml-1.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Maximum number of previous messages to include in agent's context</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-sm font-medium">{messageCount} messages</span>
          </div>
          <Input
            id="message-count"
            type="number"
            min={5}
            max={100}
            value={messageCount}
            onChange={(e) => setMessageCount(parseInt(e.target.value, 10) || 5)}
            className="w-full"
          />
        </div>

        {/* Token Limit Setting */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="token-limit" className="text-base flex items-center">
              Token Limit
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 ml-1.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Maximum number of tokens (approximately 4 characters per token) to include in agent's context window</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <span className="text-sm font-medium">{tokenLimit} tokens</span>
          </div>
          <Input
            id="token-limit"
            type="number"
            min={1000}
            max={16000}
            step={1000}
            value={tokenLimit}
            onChange={(e) => setTokenLimit(parseInt(e.target.value, 10) || 1000)}
            className="w-full"
          />
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          
          {/* Success/Error Messages */}
          {saveSuccess && (
            <p className="mt-2 text-sm text-green-600 text-center">Settings saved successfully!</p>
          )}
          {saveError && (
            <p className="mt-2 text-sm text-destructive text-center">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  );
}; 