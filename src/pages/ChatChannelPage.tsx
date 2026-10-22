import React from 'react';
import { useParams } from 'react-router-dom';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatChannels } from '../hooks/useChatChannels'; // To get channel details
import MessageList from '../components/MessageList'; // Assuming component exists
import MessageInput from '../components/MessageInput'; // Assuming component exists
import { Loader2 } from 'lucide-react';

const ChatChannelPage: React.FC = () => {
  const { roomId, channelId } = useParams<{ roomId: string; channelId: string }>();

  // Fetch channel details (name, topic)
  // Note: useChatChannels fetches *all* channels for the room. 
  // We could optimize by adding a fetchChannelById to the hook or fetching here.
  // For now, find it in the list fetched by the sidebar's hook instance (might not be ideal).
  // A better approach might involve a dedicated hook or context for current channel details.
  const { channels: roomChannels, loading: loadingChannels, error: channelError } = useChatChannels(roomId ?? null);
  const currentChannel = roomChannels.find(ch => ch.id === channelId);

  // Fetch messages for the current channel
  const { messages, loading: loadingMessages, error: messageError, createMessage } = useChatMessages(channelId ?? null);

  // Handle loading states
  if (loadingChannels && !currentChannel) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin" /> Loading Channel...</div>;
  }

  // Handle invalid channel ID or failure to find channel
  if (!channelId || (!loadingChannels && !currentChannel)) {
      return <div className="text-center text-red-500">Channel not found or invalid ID.</div>;
  }

  // Error display (combine errors?)
  const displayError = channelError || messageError;

  return (
    <div className="flex flex-col h-full max-h-full">
      {/* Channel Header */}
      <div className="border-b border-border p-4 sticky top-0 bg-card shadow-sm z-10">
        <h1 className="text-xl font-semibold text-foreground"># {currentChannel?.name || 'Channel'}</h1>
        {currentChannel?.topic && <p className="text-sm text-muted-foreground mt-1">{currentChannel.topic}</p>}
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg m-4">
          Error: {typeof displayError === 'string' ? displayError : 'Failed to load data'}
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loadingMessages && messages.length === 0 && <div className="text-center"><Loader2 className="animate-spin" /> Loading Messages...</div>}
        <MessageList messages={messages} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card shadow-sm">
        {/* Pass channelId and createMessage function to the input component */}
        <MessageInput channelId={channelId} onCreateMessage={createMessage} />
      </div>
    </div>
  );
};

export default ChatChannelPage; 