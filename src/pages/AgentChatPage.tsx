import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useAgents } from '../hooks/useAgents';
import { refreshAgentAvatarUrl } from '../lib/avatarUtils';
import type { Database } from '../types/database.types';

// Import extracted components
import { MessageList, ChatStarterScreen } from '../components/chat/MessageComponents';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatHeader, type ChatMode } from '../components/chat/ChatHeader';
import { ChatModals } from '../components/chat/ChatModals';
import { LLMDebugModal } from '../components/modals/LLMDebugModal';
import { RealtimeVoiceChat } from '../components/voice/RealtimeVoiceChat';

// Import custom hooks
import { useConversationLifecycle } from '../hooks/chat/useConversationLifecycle';
import { useChatMessages } from '../hooks/chat/useChatMessages';
import { useAIProcessing } from '../hooks/chat/useAIProcessing';
import { useFileUpload } from '../hooks/chat/useFileUpload';

type Agent = Database['public']['Tables']['agents']['Row'];

export function AgentChatPage() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const { updateAgent } = useAgents();
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgentSettingsModal, setShowAgentSettingsModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [currentProcessingDetails, setCurrentProcessingDetails] = useState<any>(null);
  const [debugProcessingDetails, setDebugProcessingDetails] = useState<any>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('text');
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
  const aiHook = useAIProcessing(agent, user, input);
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
          .single();

        if (error) throw error;

        let finalAgent = data;
        if (data.avatar_url) {
          const refreshedUrl = await refreshAgentAvatarUrl(supabase, data.id, data.avatar_url);
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
      messageHook.markConversationAsFresh(convId); // Mark as fresh - don't fetch history
      localStorage.setItem(`agent_${agent.id}_session_id`, sessId);
    } else {
      convId = conversationHook.conversationLifecycle.status === 'active' || conversationHook.conversationLifecycle.status === 'creating'
        ? conversationHook.conversationLifecycle.id
        : crypto.randomUUID();
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
    aiHook.startAIProcessing(messageHook.setMessages);
    
    requestAnimationFrame(() => {
      messageHook.scrollToBottom();
    });

    try {
      setSending(true);
      setError(null);

      // Validate agent.id before saving
      if (!agent?.id || agent.id === '') {
        console.error('[AgentChatPage] CRITICAL: Cannot save message - invalid agent.id:', { agent });
        throw new Error('Agent ID is invalid');
      }

      // CRITICAL: Ensure conversation_sessions row exists FIRST (required by foreign key constraint)
      // This handles both new conversations AND old conversations from before the migration
      console.log('[AgentChatPage] Ensuring conversation_sessions row exists for:', convId);
      
      // Check if conversation_sessions row exists
      const { data: existingSession } = await supabase
        .from('conversation_sessions')
        .select('conversation_id')
        .eq('conversation_id', convId)
        .maybeSingle();

      if (!existingSession) {
        // Create new session
        console.log('[AgentChatPage] Creating new conversation_sessions row');
        const { error: sessionError } = await supabase
          .from('conversation_sessions')
          .insert({
            conversation_id: convId,
            agent_id: agent.id,
            user_id: user.id,
            title: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
            status: 'active',
            last_active: new Date().toISOString(),
            message_count: 0,
          });

        if (sessionError) {
          console.error('[AgentChatPage] Failed to create conversation_sessions:', sessionError);
          throw sessionError;
        }
      } else {
        // Update existing session's last_active
        console.log('[AgentChatPage] Updating existing conversation_sessions row');
        await supabase
          .from('conversation_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('conversation_id', convId);
      }

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

      // Validate required IDs before making API call
      if (!user?.id) {
        throw new Error('User ID is missing - please refresh the page and try again');
      }
      if (!agent?.id || agent.id === '') {
        console.error('[AgentChatPage] CRITICAL: Invalid agent.id:', { agent, agentId: agent?.id });
        throw new Error('Agent ID is missing or invalid');
      }

      console.log('[AgentChatPage] Calling chat API with:', {
        agent_id: agent.id,
        user_id: user.id,
        conversation_id: convId,
        session_id: sessId
      });

      // Call chat API
      const [response] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: '2.0.0',
            message: {
              role: 'user',
              content: {
                type: 'text',
                text: messageText
              }
            },
            context: {
              agent_id: agent.id,
              user_id: user.id,
              conversation_id: convId,
              session_id: sessId
            },
            options: {
              context: {
                max_messages: 25
              }
            }
          }),
          signal: abortController.signal,
        }),
        processingPromise
      ]);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      // DEBUG: Log the entire response structure
      console.log('[AgentChatPage] Full response:', responseData);
      console.log('[AgentChatPage] Response keys:', Object.keys(responseData));
      console.log('[AgentChatPage] processing_details:', responseData?.processing_details);
      console.log('[AgentChatPage] discovered_tools:', responseData?.processing_details?.discovered_tools);
      
      const assistantReply = responseData?.data?.message?.content?.text || responseData?.message;

      if (typeof assistantReply !== 'string') {
        throw new Error('Received an invalid response format from the chat service.');
      }

      // Capture processing details for the Process modal
      const processingDetails = responseData?.processing_details;
      if (processingDetails) {
        // Add conversation_id for context
        processingDetails.conversation_id = convId;
        console.log('[AgentChatPage] Captured processing details:', processingDetails);
        console.log('[AgentChatPage] Discovered tools count:', processingDetails?.discovered_tools?.length || 0);
      } else {
        console.error('[AgentChatPage] No processing_details in response!');
      }

      const responseMetadata = responseData?.data?.message?.metadata || {};
      // Store processing details in metadata so it can be accessed from the message
      responseMetadata.processingDetails = processingDetails;
      
      console.log('[AgentChatPage] Final metadata with processingDetails:', responseMetadata);
      
      await aiHook.completeAIProcessingWithResponse(assistantReply, responseMetadata, messageHook.setMessages);

      if (aiHook.isMounted.current) {
        requestAnimationFrame(messageHook.scrollToBottom);
      }

      // Mark conversation as active
      if (isFirstMessage) {
        conversationHook.markConversationActive();
      }

      // AUTO-SUMMARIZATION: Check if we should trigger automatic summarization (every 5 messages)
      try {
        const { count } = await supabase
          .from('chat_messages_v2')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convId);
        
        if (count && count % 5 === 0 && count >= 5) {
          console.log(`[AutoSummarization] Triggering summarization at ${count} messages`);
          
          // Call edge function asynchronously (don't await - fire and forget)
          supabase.functions.invoke('conversation-summarizer', {
            body: {
              conversation_id: convId,
              agent_id: agent.id,
              user_id: user.id,
              message_count: count,
              force_full_summary: false,
              manual_trigger: false
            }
          }).then(({ data, error }) => {
            if (error) {
              console.error('[AutoSummarization] Failed to trigger:', error);
            } else {
              console.log('[AutoSummarization] Successfully triggered, response:', data);
            }
          });
        } else {
          console.log(`[AutoSummarization] Message count: ${count}, not triggering yet`);
        }
      } catch (summaryError) {
        // Non-fatal - just log the error
        console.error('[AutoSummarization] Error checking message count:', summaryError);
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[handleSubmit] Chat request cancelled.');
        aiHook.completeAIProcessing(false, messageHook.setMessages);
      } else {
        console.error('Error submitting chat message:', err);
        aiHook.completeAIProcessing(false, messageHook.setMessages);
        
        if (aiHook.isMounted.current) {
          // Add an error message from the agent instead of removing the user message
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `I'm sorry, I encountered an error while processing your message: ${err.message}. Please try again or start a new conversation if the problem persists.`,
            created_at: new Date().toISOString(),
            metadata: {
              error: true,
              originalError: err.message
            }
          };
          
          messageHook.setMessages(prev => [...prev, errorMessage]);
          requestAnimationFrame(messageHook.scrollToBottom);
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
        {/* Real-time Mode - Full Screen Takeover */}
        {chatMode === 'realtime' ? (
          <RealtimeVoiceChat
            conversationId={conversationHook.conversationLifecycle.id || ''}
            agentId={agentId || ''}
            agentName={agent?.name}
            agentAvatar={agent?.avatar_url || undefined}
            voice="alloy"
            onClose={() => setChatMode('text')}
            onConversationCreated={(newConversationId) => {
              // Update conversation lifecycle when voice chat creates a new conversation
              console.log('[AgentChatPage] Voice chat created conversation:', newConversationId);
              conversationHook.startNewConversation(newConversationId);
              messageHook.markConversationAsFresh(newConversationId);
            }}
          />
        ) : (
          <>
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
              
              {/* Show Chat Starter only when no conversation exists */}
              {conversationHook.conversationLifecycle.status === 'none' ? (
                <div className="w-full">
                  <ChatStarterScreen agent={agent} user={user} />
                </div>
              ) : messageHook.isHistoryLoading ? (
                // Show loading spinner only when actually loading history from database
                <div className="flex items-center justify-center h-full w-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                // Show messages (even if empty - will show thinking indicator)
                <div className="max-w-3xl w-full overflow-y-auto chat-scrollbar px-4 py-6 pb-8">
                  <MessageList 
                    messages={messageHook.messages}
                    agent={agent}
                    user={user}
                    aiState={aiHook.aiState}
                    currentTool={aiHook.currentTool}
                    processSteps={aiHook.processSteps}
                    thinkingMessageIndex={aiHook.thinkingMessageIndex}
                    formatMarkdown={(text: string) => text}
                    currentProcessingDetails={currentProcessingDetails}
                    onShowProcessModal={(details) => {
                      console.log('[AgentChatPage] Process modal opened with details:', details);
                      setCurrentProcessingDetails(details);
                      setShowProcessModal(true);
                    }}
                    onShowDebugModal={(details) => {
                      console.log('[AgentChatPage] Debug modal opened with details:', details);
                      setDebugProcessingDetails(details);
                      setShowDebugModal(true);
                    }}
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
              chatMode={chatMode}
              onChatModeChange={setChatMode}
              onSubmit={handleSubmit}
              onKeyDown={handleKeyDown}
              onFileUpload={uploadHook.handleFileUpload}
              onRemoveAttachment={uploadHook.handleRemoveAttachment}
              adjustTextareaHeight={adjustTextareaHeight}
              onShowAgentSettings={() => setShowAgentSettingsModal(true)}
            />
          </>
        )}
      </div>

      {/* Chat Modals */}
      <ChatModals
        agentId={agent.id}
        agent={agent}
        showAgentSettingsModal={showAgentSettingsModal}
        setShowAgentSettingsModal={setShowAgentSettingsModal}
        showProcessModal={showProcessModal}
        setShowProcessModal={setShowProcessModal}
        currentProcessingDetails={currentProcessingDetails}
        onAgentUpdated={(updatedAgent) => setAgent(updatedAgent)}
        updateAgent={async (id: string, data: any) => {
          await updateAgent(id, data);
        }}
      />
      
      {/* LLM Debug Modal */}
      <LLMDebugModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        processingDetails={debugProcessingDetails}
      />
    </div>
  );
}

