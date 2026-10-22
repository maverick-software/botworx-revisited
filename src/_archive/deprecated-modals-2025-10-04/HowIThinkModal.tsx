import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Brain,
  MessageCircle,
  BookOpen,
  Users,
  Lightbulb,
  Target,
  Sparkles
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { AgentFormInstructions } from '@/components/agent-edit/AgentFormInstructions';
import { toast } from 'react-hot-toast';

interface HowIThinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    system_instructions?: string;
    assistant_instructions?: string;
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

// This modal now uses the real AgentFormInstructions component

export function HowIThinkModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: HowIThinkModalProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Form state - using real agent instruction fields
  const [systemInstructions, setSystemInstructions] = useState('');
  const [assistantInstructions, setAssistantInstructions] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize form data when modal opens or agent data changes
  useEffect(() => {
    if (isOpen && agentData) {
      setSystemInstructions(agentData.system_instructions || '');
      setAssistantInstructions(agentData.assistant_instructions || '');
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleEditorChange = useCallback((fieldName: string, value: string) => {
    if (fieldName === 'system_instructions') {
      setSystemInstructions(value);
    } else if (fieldName === 'assistant_instructions') {
      setAssistantInstructions(value);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    
    try {
      const updatePayload = {
        system_instructions: systemInstructions.trim() || undefined,
        assistant_instructions: assistantInstructions.trim() || undefined
      };

      const { data: updatedAgent, error } = await supabase
        .from('agents')
        .update(updatePayload)
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Behavior updated! 🧠');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated && updatedAgent) {
        onAgentUpdated(updatedAgent);
      }
      
    } catch (error: any) {
      console.error('Error updating agent behavior:', error);
      toast.error('Failed to update behavior');
    } finally {
      setLoading(false);
    }
  }, [agentId, systemInstructions, assistantInstructions, supabase, user, onAgentUpdated]);

  const hasChanges = () => {
    if (!agentData) return true;
    return (
      systemInstructions !== (agentData.system_instructions || '') ||
      assistantInstructions !== (agentData.assistant_instructions || '')
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            🧠 Behavior
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Help me understand how you'd like me to think and communicate so I can be most helpful to you.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          {/* Use the real AgentFormInstructions component */}
          <AgentFormInstructions
            systemInstructions={systemInstructions}
            assistantInstructions={assistantInstructions}
            handleEditorChange={handleEditorChange}
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges()}
            className="min-w-[140px]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Update Behavior'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}