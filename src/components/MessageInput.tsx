import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from "@/components/ui/button"; // Assuming Shadcn alias
import { Textarea } from "@/components/ui/textarea"; // Assuming Shadcn alias
import { useAuth } from '../contexts/AuthContext'; // Corrected import
import { type ChatMessage } from '../types/chat'; // For return type of onCreateMessage

interface MessageInputProps {
  channelId: string;
  onCreateMessage: (
    channelId: string,
    content: string,
    sender: { senderUserId?: string; senderAgentId?: string },
    metadata?: Record<string, any>
  ) => Promise<ChatMessage | null>;
}

const MessageInput: React.FC<MessageInputProps> = ({ channelId, onCreateMessage }) => {
  const { user } = useAuth();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !user) {
      // Basic validation: require content and logged-in user
      return;
    }
    
    setIsSending(true);
    setError(null);
    try {
      const newMessage = await onCreateMessage(
        channelId,
        messageContent.trim(),
        { senderUserId: user.id }, // Assume message is from the current user
        {} // No metadata for now
      );
      
      if (newMessage) {
        setMessageContent(''); // Clear input on success
      } else {
          // Error handling might be done within the hook, but set local error if needed
          setError('Failed to send message.');
      }
    } catch (err: any) { 
      console.error("Error sending message:", err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter press (but not Shift+Enter)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline
      handleSendMessage();
    }
  };

  return (
    <div className="relative">
      {error && <p className="text-red-500 text-xs mb-1">Error: {error}</p>}
      <Textarea
        value={messageContent}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Message #${channelId}...`} // Placeholder, improve later
        className="pr-16 resize-none border rounded-md p-2 w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
        rows={1} // Start with 1 row, potentially auto-expand
        disabled={isSending}
      />
      <Button
        type="button"
        size="icon"
        className="absolute right-2 bottom-2 w-8 h-8"
        onClick={handleSendMessage}
        disabled={isSending || !messageContent.trim()}
        aria-label="Send message"
      >
        <Send size={16} />
      </Button>
    </div>
  );
};

export default MessageInput; 