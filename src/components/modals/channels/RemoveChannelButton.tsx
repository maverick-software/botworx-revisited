import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface RemoveChannelButtonProps {
  connectionId: string;
  connectionName?: string;
  onRemoveSuccess: () => void;
}

export function RemoveChannelButton({ 
  connectionId, 
  connectionName = 'Channel',
  onRemoveSuccess 
}: RemoveChannelButtonProps) {
  const supabase = useSupabaseClient();

  const handleRemove = async () => {
    if (!confirm(`Remove ${connectionName} from this agent?`)) return;
    
    try {
      const { error } = await supabase.rpc('revoke_agent_integration_permission', { 
        p_permission_id: connectionId 
      });
      if (error) throw error;
      
      onRemoveSuccess();
      toast.success(`${connectionName} removed from agent`);
    } catch (e: any) {
      console.error('Revoke permission error', e);
      toast.error(`Failed to remove ${connectionName}`);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500"
      onClick={handleRemove}
    >
      Remove
    </Button>
  );
}
