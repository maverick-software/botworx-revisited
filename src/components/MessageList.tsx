import React, { useRef, useEffect, useState } from 'react';
import { type ChatMessage } from '../types/chat';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Assuming Shadcn
import { format } from 'date-fns'; // For timestamp formatting
import { ArtifactCard } from './chat/ArtifactCard';
import { CanvasMode } from './chat/CanvasMode';
import { useArtifacts } from '@/hooks/useArtifacts';
import type { Artifact } from '@/types/artifacts';

interface MessageListProps {
  messages: ChatMessage[];
  // TODO: Add function prop for loading older messages
  // onLoadOlder: () => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [canvasArtifact, setCanvasArtifact] = useState<Artifact | null>(null);
  const { updateArtifact, downloadArtifact } = useArtifacts();

  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (timestamp: string) => {
    try {
        // Basic formatting, adjust as needed
        return format(new Date(timestamp), 'Pp'); // e.g., 04/26/2025, 10:45:12 AM
    } catch {
        return timestamp; // Fallback if date is invalid
    }
  };

  // Extract artifacts from message metadata
  const getArtifactsFromMessage = (message: ChatMessage): Artifact[] => {
    // Debug logging
    console.log('[MessageList] Checking message for artifacts:', {
      messageId: message.id,
      hasMetadata: !!message.metadata,
      metadata: message.metadata,
      hasArtifacts: !!message.metadata?.artifacts
    });
    
    if (!message.metadata?.artifacts) return [];
    
    // Handle both array and single artifact
    const artifacts = Array.isArray(message.metadata.artifacts)
      ? message.metadata.artifacts
      : [message.metadata.artifacts];
    
    const filtered = artifacts.filter((a: any) => a && typeof a === 'object');
    console.log('[MessageList] Found artifacts:', filtered);
    return filtered;
  };

  // Handle opening canvas mode
  const handleOpenCanvas = (artifact: Artifact) => {
    setCanvasArtifact(artifact);
  };

  // Handle saving artifact from canvas
  const handleSaveArtifact = async (content: string, changes_note?: string) => {
    if (!canvasArtifact) return;
    
    // Get agent_id from the message that created this artifact
    const message = messages.find(m => 
      getArtifactsFromMessage(m).some(a => a.id === canvasArtifact.id)
    );
    
    const agentId = message?.agentId || canvasArtifact.agent_id;
    
    if (!agentId) {
      throw new Error('Cannot save artifact: agent_id not found');
    }

    const updated = await updateArtifact(
      {
        artifact_id: canvasArtifact.id,
        content,
        changes_note
      },
      agentId
    );

    if (updated) {
      setCanvasArtifact(updated);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* TODO: Add button/trigger for loading older messages */} 
        {messages.map((message) => {
          const artifacts = getArtifactsFromMessage(message);
          
          return (
            <div key={message.id} className="flex items-start space-x-3 group">
              {/* Avatar Placeholder */}
              <Avatar className="w-8 h-8 border border-border">
                {/* Conditional rendering based on sender type */} 
                {message.sender_user && (
                  <>
                    <AvatarImage src={message.sender_user?.avatar_url || undefined} alt={message.sender_user?.full_name || 'User'} />
                    <AvatarFallback>{message.sender_user?.full_name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                  </>
                )}
                {message.sender_agent && (
                  <AvatarFallback className="bg-indigo-600 text-white">{message.sender_agent?.name?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
                )}
                {!message.sender_user && !message.sender_agent && (
                  <AvatarFallback>?</AvatarFallback> // Unknown sender?
                )}
              </Avatar>

              <div className="flex-1">
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold text-sm">
                    {message.sender_user?.full_name || message.sender_agent?.name || 'Unknown Sender'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      try {
                        // Handle both timestamp formats for compatibility
                        const timestamp = message.timestamp || message.created_at;
                        if (timestamp instanceof Date) {
                          return timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        } else if (timestamp) {
                          return formatTimestamp(timestamp);
                        }
                        return '--:--';
                      } catch {
                        return '--:--';
                      }
                    })()}
                  </span>
                </div>
                
                {/* Message Content - needs careful handling for potential markdown/code blocks later */}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Render Artifact Cards */}
                {artifacts.length > 0 && (
                  <div className="space-y-2">
                    {artifacts.map((artifact) => (
                      <ArtifactCard
                        key={artifact.id}
                        artifact={artifact}
                        onOpenCanvas={handleOpenCanvas}
                        onDownload={downloadArtifact}
                      />
                    ))}
                  </div>
                )}
                
                {/* TODO: Add reactions/actions on hover? */}
              </div>
            </div>
          );
        })}
        {/* Invisible element to scroll to */} 
        <div ref={endOfMessagesRef} /> 
      </div>

      {/* Canvas Mode Modal */}
      {canvasArtifact && (
        <CanvasMode
          artifact={canvasArtifact}
          onClose={() => setCanvasArtifact(null)}
          onSave={handleSaveArtifact}
          onDownload={downloadArtifact}
        />
      )}
    </>
  );
};

export default MessageList; 