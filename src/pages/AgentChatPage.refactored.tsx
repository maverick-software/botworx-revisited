import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useAgents } from '../hooks/useAgents';
import { useConnections } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';
import { refreshAgentAvatarUrl } from '../lib/avatarUtils';
import type { Database } from '../types/database.types';

// Import extracted components
import { ConversationSelector, SidebarConversations } from '../components/chat/ConversationComponents';
import { MessageList, ChatStarterScreen } from '../components/chat/MessageComponents';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatModals } from '../components/chat/ChatModals';

// Import custom hooks
import { useConversationLifecycle } from '../hooks/chat/useConversationLifecycle';
import { useChatMessages } from '../hooks/chat/useChatMessages';
import { useAIProcessing } from '../hooks/chat/useAIProcessing';
import { useFileUpload } from '../hooks/chat/useFileUpload';

type Agent = Database['public']['Tables']['agents']['Row'];

export function AgentChatPage() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { updateAgent } = useAgents();
  const { connections } = useConnections({ includeRevoked: false });
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgentSettingsModal, setShowAgentSettingsModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Custom hooks
  const conversationHook = useConversationLifecycle(agentId, user?.id);
  const messageHook = useChatMessages(
    agentId,
    user?.id,
    conversationHook.conversationLifecycle,
    conversationHook.conversationRefreshKey
  );
  const aiHook = useAIProcessing(agent, input);
  const uploadHook = useFileUpload(user, agent);

  // Fetch agent data
  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId || !user) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        let finalAgent = data;
        if (data.avatar_url) {
          const refreshedUrl = await refreshAgentAvatarUrl(data.avatar_url);
          if (refreshedUrl !== data.avatar_url) {
            finalAgent = { ...data, avatar_url: refreshedUrl };
          }
        }

        setAgent(finalAgent);
      } catch (err) {
        console.error('Failed to fetch agent:', err);
        setError('Could not load agent');
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [agentId, user]);

  // Submit message handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !agent || sending || !user?.id) return;

    const messageText = input.trim();
    setInput('');
    uploadHook.setAttachedDocuments([]);
    setSending(true);

    // Determine if this is the first message
    const isFirstMessage = conversationHook.conversationLifecycle.status === 'none';
    
    let convId: string;
    let sessId: string;
    
    if (isFirstMessage) {
      convId = crypto.randomUUID();
      sessId = crypto.randomUUID();
      console.log('[AgentChatPage] First message - creating new conversation:', convId);
      conversationHook.startNewConversation(convId);
      localStorage.setItem(`agent_${agent.id}_session_id`, sessId);
    } else {
      convId = conversationHook.conversationLifecycle.id;
      sessId = localStorage.getItem(`agent_${agent.id}_session_id`) || crypto.randomUUID();
      console.log('[AgentChatPage] Subsequent message in conversation:', convId);
    }

    // Add user message
    const userMessage = {
      role: 'user' as const,
      content: messageText,
      timestamp: new Date(),
      userId: user.id,
    };

    messageHook.setMessages(prev => [...prev, userMessage]);
    aiHook.startAIProcessing();
    
    requestAnimationFrame(() => {
      messageHook.scrollToBottom();
    });

    try {
      setSending(true);
      setError(null);

      // Save user message to database
      const { error: saveError } = await supabase
        .from('chat_messages_v2')
        .insert({
          conversation_id: convId,
          session_id: sessId,
          channel_id: null,
          role: 'user',
          content: { type: 'text', text: messageText },
          sender_user_id: user.id,
          sender_agent_id: null,
          metadata: { target_agent_id: agent.id },
          context: { agent_id: agent.id, user_id: user.id }
        });

      if (saveError) throw saveError;

      // Run AI processing simulation
      const processingPromise = aiHook.simulateAIProcessing();

      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Call chat API
      const [response] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageText,
            agent_id: agent.id,
            user_id: user.id,
            conversation_id: convId,
            session_id: sessId,
            context_size: 25,
          }),
          signal: abortController.signal,
        }),
        processingPromise
      ]);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      const assistantReply = responseData?.data?.message?.content?.text || responseData?.message;

      if (typeof assistantReply !== 'string') {
        throw new Error('Received an invalid response format from the chat service.');
      }

      const responseMetadata = responseData?.data?.message?.metadata || {};
      await aiHook.completeAIProcessingWithResponse(assistantReply, responseMetadata, messageHook.setMessages);

      if (aiHook.isMounted.current) {
        requestAnimationFrame(messageHook.scrollToBottom);
      }

      // Mark conversation as active
      if (isFirstMessage) {
        conversationHook.markConversationActive();
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[handleSubmit] Chat request cancelled.');
        aiHook.completeAIProcessing(false);
      } else {
        console.error('Error submitting chat message:', err);
        aiHook.completeAIProcessing(false);
        if (aiHook.isMounted.current) {
          setError(`Failed to send message: ${err.message}. Please try again.`);
          messageHook.setMessages(prev => prev.filter(msg => msg !== userMessage));
        }
      }
    } finally {
      setSending(false);
    }
  }, [input, agent, sending, user?.id, conversationHook, messageHook, aiHook, uploadHook]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [handleSubmit]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200;
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Conversation actions
  const handleShareConversation = useCallback(async () => {
    const link = conversationHook.getShareLink();
    if (!link) return;
    
    try {
      await navigator.clipboard.writeText(link);
      alert('Shareable link copied to clipboard');
    } catch {
      prompt('Copy link to share:', link);
    }
  }, [conversationHook]);

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">{error}</p>
          <button onClick={() => window.location.reload()} className="text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Main Column */}
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          agent={agent}
          agentId={agentId || ''}
          conversationId={conversationHook.conversationLifecycle.status === 'active' ? conversationHook.conversationLifecycle.id : undefined}
          onShowAgentSettings={() => setShowAgentSettingsModal(true)}
        />

        {/* Messages Container */}
        <div className="flex-1 min-h-0 relative flex justify-center">
          <div className="absolute top-0 left-0 right-0 h-20 chat-gradient-fade-top pointer-events-none z-10 opacity-0 transition-opacity duration-300" 
               style={{ opacity: messageHook.messages.length > 0 ? 1 : 0 }} />
          {messageHook.isHistoryLoading ? (
            <div className="flex items-center justify-center h-full w-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messageHook.messages.length === 0 ? (
            <div className="w-full">
              <ChatStarterScreen agent={agent} user={user} />
            </div>
          ) : (
            <div className="max-w-3xl w-full overflow-y-auto chat-scrollbar px-4 py-6 pb-8">
              <MessageList 
                messages={messageHook.messages}
                agent={agent}
                aiState={aiHook.aiState}
                currentTool={aiHook.currentTool}
                processSteps={aiHook.processSteps}
              />
              <div ref={messageHook.messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          agent={agent}
          sending={sending}
          uploading={uploadHook.uploading}
          uploadProgress={uploadHook.uploadProgress}
          attachedDocuments={uploadHook.attachedDocuments}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          onFileUpload={uploadHook.handleFileUpload}
          onRemoveAttachment={uploadHook.handleRemoveAttachment}
          adjustTextareaHeight={adjustTextareaHeight}
          onShowAgentSettings={() => setShowAgentSettingsModal(true)}
        />
      </div>

      {/* Chat Modals */}
      <ChatModals
        agent={agent}
        showAgentSettingsModal={showAgentSettingsModal}
        setShowAgentSettingsModal={setShowAgentSettingsModal}
        updateAgent={updateAgent}
      />
    </div>
  );
}

