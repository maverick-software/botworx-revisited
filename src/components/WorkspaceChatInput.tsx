import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// --- Update Props Interface --- 
interface WorkspaceChatInputProps {
  workspaceId: string;
  channelId: string | null;
  members: WorkspaceMemberDetail[]; 
  onSendMessage: (content: string, agentId?: string | null) => Promise<void>; 
}
// --- End Update --- 

// RENAME function to match filename convention if needed (e.g., WorkspaceChatInput)
export function WorkspaceChatInput({ workspaceId, channelId, members, onSendMessage }: WorkspaceChatInputProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Restore mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WorkspaceMemberDetail[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); 
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore handleSubmit (it was mostly unchanged)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !user?.id || !workspaceId || !channelId) {
      console.warn("Submit cancelled: Check input, user, workspaceId, channelId.");
      return;
    }
    
    const agentIdToSend = selectedAgentId; 
    
    setInput(''); 
    setSelectedAgentId(null); 
    setMentionQuery(null); // Ensure mention state is cleared on submit
    setSuggestions([]);   // Ensure suggestions are cleared on submit
    setError(null);
    
    try {
        setSending(true); 
        await onSendMessage(content, agentIdToSend);
    } catch (err: any) {
        console.error("[WorkspaceChatInput] Error calling onSendMessage:", err);
        setError(err.message || 'Failed to send message');
    } finally {
        setSending(false);
    }
  }, [input, user?.id, workspaceId, channelId, onSendMessage, selectedAgentId]);

  // Restore suggestion/popover handlers
  const handleSelectSuggestion = (selectedMember: WorkspaceMemberDetail) => {
    if (!selectedMember.agent || !selectedMember.agent_id) return;
    setInput(prevInput => prevInput.replace(/@\S*$/, `@${selectedMember.agent?.name} `));
    setSelectedAgentId(selectedMember.agent_id);
    setMentionQuery(null);
    setSuggestions([]);
    inputRef.current?.focus();
  };
  const handlePopoverOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        setMentionQuery(null);
        setSuggestions([]);
    }
  };

  // --- useEffect for Debounced Suggestion Logic --- 
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    const mentionMatch = input.match(/@(\S*)$/);
    if (mentionMatch) {
      debounceTimeoutRef.current = setTimeout(() => {
        const query = mentionMatch[1].toLowerCase();
        setMentionQuery(query); 
        const filteredAgents = members.filter(member => 
          member.agent_id && member.agent && member.agent.name?.toLowerCase().includes(query)
        );
        setSuggestions(filteredAgents); 
      }, 300); 
    } else {
      setMentionQuery(null);
      setSuggestions([]);
    }
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [input, members]); // Ensure dependency array uses 'members'
  // --- End useEffect --- 

  // Restore original handleInputChange
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = e.target.value;
    setInput(currentValue); 
    setError(null); 
    // Suggestion logic is handled by the useEffect
  };

  return (
    <form onSubmit={handleSubmit} className="sticky bottom-0 left-0 right-0 bg-card px-4 py-3 border-t">
      {/* Restore Popover */}
      <Popover 
        open={mentionQuery !== null && suggestions.length > 0} 
        onOpenChange={handlePopoverOpenChange}
      >
        <div className="relative flex items-center">
          {/* Restore PopoverTrigger */}
          <PopoverTrigger asChild>
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type your message or @mention an agent..." // Restore placeholder
              value={input}
              onChange={handleInputChange}
              disabled={sending || !channelId} 
              className="flex-grow pr-12"
              autoComplete="off"
              // Restore onKeyDown 
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                 if (mentionQuery !== null && suggestions.length > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab')) {
                   e.preventDefault(); 
                 }
              }}
            />
          </PopoverTrigger>
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim() || !channelId} 
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {/* Restore PopoverContent */}
        <PopoverContent 
          className="p-0 w-[--radix-popover-trigger-width] max-h-48 overflow-y-auto shadow-md bg-popover text-popover-foreground"
          onOpenAutoFocus={(e) => e.preventDefault()} 
        >
          {suggestions.length === 0 && mentionQuery !== null ? (
            <div className="p-2 text-sm text-muted-foreground">No matching agents found.</div>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-2 text-sm hover:bg-muted cursor-pointer flex items-center"
                onClick={() => handleSelectSuggestion(suggestion)}
                onMouseDown={(e) => e.preventDefault()} 
              >
                <span className="truncate">{suggestion.agent?.name || 'Unnamed Agent'}</span>
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>

      {error && (
        <p className="mt-2 text-sm text-destructive flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}
    </form>
  );
} 