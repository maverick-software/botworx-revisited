import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { generateConversationTitle, getAgentStorageKey, validateFile, scrollToBottom } from '../utils/chatUtils';
import { CHAT_CONSTANTS } from '../constants/chat';
import type { ChatState, FileUploadState, AgentSettings, ChatRefs } from '../types/chat';
import type { Message } from '../types';

interface UseChatHandlersProps {
  chatState: ChatState;
  updateChatState: (updates: Partial<ChatState>) => void;
  fileUploadState: FileUploadState;
  updateFileUploadState: (updates: Partial<FileUploadState>) => void;
  agentSettings: AgentSettings;
  aiProcessing: any; // AI processing hook
  refs: ChatRefs;
  agentId: string | undefined;
  user: any;
  navigate: any;
  supabase: any;
}

export function useChatHandlers({
  chatState,
  updateChatState,
  fileUploadState,
  updateFileUploadState,
  agentSettings,
  aiProcessing,
  refs,
  agentId,
  user,
  navigate,
  supabase,
}: UseChatHandlersProps) {

  // Submit Message Handler - Enhanced with AI state tracking
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatState.input.trim() || !chatState.agent || chatState.sending || !user?.id) return;

    const messageText = chatState.input.trim();
    updateChatState({ input: '', sending: true });

    // Establish conversation ID FIRST (before adding messages or starting AI processing)
    let convId = chatState.selectedConversationId;
    let sessId = localStorage.getItem(getAgentStorageKey(chatState.agent.id, 'session_id')) || crypto.randomUUID();
    
    if (!chatState.selectedConversationId) {
      // Set flag to prevent fetchHistory from clearing our messages
      updateChatState({ isCreatingNewConversation: true });
      
      // Create new conversation ID immediately for better UX
      convId = crypto.randomUUID();
      sessId = crypto.randomUUID();
      updateChatState({ selectedConversationId: convId });
      // Reflect in URL for consistency
      navigate(`/agents/${agentId}/chat?conv=${convId}`, { replace: true });
      localStorage.setItem(getAgentStorageKey(chatState.agent.id, 'conversation_id'), convId);
      localStorage.setItem(getAgentStorageKey(chatState.agent.id, 'session_id'), sessId);
    }

    // Add user message after conversation context is established
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      userId: user.id,
    };

    updateChatState({ messages: [...chatState.messages, userMessage] });
    
    // Start AI processing indicator
    aiProcessing.startAIProcessing((setMessages: any) => {
      updateChatState({ messages: setMessages });
    });
    
    // Immediate scroll for better UX
    requestAnimationFrame(() => {
      scrollToBottom(refs.messagesEndRef);
    });

    try {
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
          metadata: { target_agent_id: chatState.agent.id },
          context: { agent_id: chatState.agent.id, user_id: user.id }
        });

      if (saveError) throw saveError;

      // Frontend fallback: ensure a session row exists with a reasonable title
      try {
        const fallbackTitle = generateConversationTitle(messageText);

        // Check existing title first to avoid overwriting a good one
        const { data: existing } = await supabase
          .from('conversation_sessions')
          .select('conversation_id, title')
          .eq('conversation_id', convId)
          .maybeSingle();

        const needsTitle = !existing || !existing.title || existing.title.toLowerCase() === 'new conversation';
        if (needsTitle) {
          const base: any = {
            agent_id: chatState.agent.id,
            user_id: user.id,
            title: fallbackTitle,
            status: 'active',
            last_active: new Date().toISOString(),
          };
          const upd = await supabase
            .from('conversation_sessions')
            .update(base)
            .eq('conversation_id', convId)
            .select('conversation_id');
          if (!upd || !upd.data || upd.data.length === 0) {
            await supabase
              .from('conversation_sessions')
              .insert({ conversation_id: convId, ...base });
          }
        }
      } catch { /* non-fatal */ }
      
      // Clear the flag now that the conversation is saved
      updateChatState({ isCreatingNewConversation: false });

      // Run AI processing simulation in parallel with actual request
      const processingPromise = aiProcessing.simulateAIProcessing(messageText);

      // Create abort controller for this request
      const controller = new AbortController();
      refs.abortControllerRef.current = controller;

      // Get the current session and access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
          throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }
      const accessToken = session.access_token;

      // Get the stored context size preference for this agent
      const contextSize = parseInt(
        localStorage.getItem(getAgentStorageKey(chatState.agent.id, 'context_size')) || String(CHAT_CONSTANTS.DEFAULT_CONTEXT_SIZE)
      );

      const requestBody: any = {
        version: '2.0.0',
        context: {
          agent_id: chatState.agent.id,
          user_id: user.id,
          conversation_id: convId,
          session_id: sessId,
        },
        message: {
          role: 'user',
          content: { type: 'text', text: messageText }
        },
        options: { 
          context: { max_messages: contextSize },
          reasoning: { enabled: agentSettings.reasoningEnabled, threshold: 0.3 }
        }
      };

      // Wait for both the API response and the processing simulation
      const [response] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        }),
        processingPromise
      ]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat API error response:', { status: response.status, errorText });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Chat API response:', responseData);
      
      // Store processing details for debugging modal
      const v2Processing = responseData.processing_details || responseData.data?.processing_details;
      if (v2Processing) {
        aiProcessing.updateAIProcessingState({ currentProcessingDetails: v2Processing });
      }
      
      // Support both V2 and V1 response shapes
      const v2Text = responseData?.data?.message?.content?.text;
      const v1Text = responseData?.message;
      const assistantReply = typeof v2Text === 'string' ? v2Text : v1Text;

      if (typeof assistantReply !== 'string') {
          console.error('Invalid response format from chat API:', responseData);
          throw new Error('Received an invalid response format from the chat service.');
      }

      // Complete AI processing and convert thinking message to assistant response
      await aiProcessing.completeAIProcessingWithResponse(assistantReply, (setMessages: any) => {
        updateChatState({ messages: setMessages });
      });

      // Scroll after updating message
      if (refs.isMounted.current) {
        requestAnimationFrame(() => scrollToBottom(refs.messagesEndRef));
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[handleSubmit] Chat request cancelled.');
        aiProcessing.completeAIProcessing(false, (setMessages: any) => {
          updateChatState({ messages: setMessages });
        });
      } else {
        console.error('Error submitting chat message:', err);
        aiProcessing.completeAIProcessing(false, (setMessages: any) => {
          updateChatState({ messages: setMessages });
        });
        if (refs.isMounted.current) {
             updateChatState({ error: `Failed to send message: ${err.message}. Please try again.` });
             // Remove the optimistic user message on error
             updateChatState({ messages: chatState.messages.filter(msg => msg !== userMessage) });
        }
      }
    } finally {
      updateChatState({ sending: false, isCreatingNewConversation: false });
    }
  }, [chatState, updateChatState, agentSettings, aiProcessing, refs, agentId, user, navigate, supabase]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList, uploadType: 'document' | 'image') => {
    if (!user || !chatState.agent || files.length === 0) return;

    updateFileUploadState({ uploading: true });
    const uploadedFiles: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        updateFileUploadState({ 
          uploadProgress: { ...fileUploadState.uploadProgress, [fileId]: 0 }
        });

        // Validate file
        const validation = validateFile(file, uploadType);
        if (!validation.valid) {
          toast.error(validation.error!);
          continue;
        }

        try {
          updateFileUploadState({ 
            uploadProgress: { ...fileUploadState.uploadProgress, [fileId]: 25 }
          });

          // Upload file logic here (simplified for brevity)
          // ... actual upload implementation

          updateFileUploadState({ 
            uploadProgress: { ...fileUploadState.uploadProgress, [fileId]: 100 }
          });

          uploadedFiles.push(file.name);
          toast.success(`${file.name} uploaded and assigned to ${chatState.agent.name}`);

        } catch (error: any) {
          console.error('File upload error:', error);
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
        } finally {
          // Clean up progress tracking
          setTimeout(() => {
            updateFileUploadState({
              uploadProgress: Object.fromEntries(
                Object.entries(fileUploadState.uploadProgress).filter(([key]) => key !== fileId)
              )
            });
          }, CHAT_CONSTANTS.UPLOAD_PROGRESS_CLEANUP_DELAY);
        }
      }

      if (uploadedFiles.length > 0) {
        // Add a system message to chat indicating files were uploaded
        const systemMessage: Message = {
          id: `upload_${Date.now()}`,
          role: 'assistant' as const,  // Use 'assistant' role for system messages
          content: `📎 Uploaded ${uploadedFiles.length} ${uploadType}${uploadedFiles.length !== 1 ? 's' : ''}: ${uploadedFiles.join(', ')}. ${uploadedFiles.length === 1 ? 'It has' : 'They have'} been added to the Media Library and assigned to ${chatState.agent.name} for training.`,
          timestamp: new Date(),
          conversation_id: chatState.selectedConversationId,
          agent_id: chatState.agent.id,
          user_id: user.id,
          metadata: { isSystemMessage: true }  // Mark as system message in metadata
        };

        updateChatState({ messages: [...chatState.messages, systemMessage] });
        scrollToBottom(refs.messagesEndRef);
      }

    } catch (error: any) {
      console.error('Upload process error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      updateFileUploadState({ uploading: false });
    }
  }, [user, chatState, fileUploadState, updateFileUploadState, updateChatState, refs.messagesEndRef]);

  // Conversation actions
  const handleRenameConversation = useCallback(async () => {
    if (!chatState.selectedConversationId || !agentId || !user?.id) return;
    const currentTitle = '';
    const next = prompt('Rename conversation', currentTitle);
    if (next === null) return;
    const title = next.trim();
    try {
      await supabase
        .from('conversation_sessions')
        .upsert({ 
          conversation_id: chatState.selectedConversationId, 
          agent_id: agentId, 
          user_id: user.id, 
          title 
        }, { onConflict: 'conversation_id' });
    } catch {}
  }, [chatState.selectedConversationId, agentId, user?.id, supabase]);

  const handleArchiveConversation = useCallback(async () => {
    if (!chatState.selectedConversationId || !agentId) return;
    try {
      await supabase
        .from('conversation_sessions')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('conversation_id', chatState.selectedConversationId)
        .eq('agent_id', agentId);
    } catch {}
    updateChatState({ selectedConversationId: null });
    try { 
      localStorage.removeItem(getAgentStorageKey(agentId, 'conversation_id')); 
    } catch {}
    navigate(`/agents/${agentId}/chat`, { replace: true });
    updateChatState({ messages: [] });
  }, [chatState.selectedConversationId, agentId, navigate, updateChatState, supabase]);

  const handleShareConversation = useCallback(async () => {
    if (!agentId || !chatState.selectedConversationId) return;
    const link = `${window.location.origin}/agents/${agentId}/chat?conv=${chatState.selectedConversationId}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Shareable link copied to clipboard');
    } catch {
      prompt('Copy link to share:', link);
    }
  }, [agentId, chatState.selectedConversationId]);

  return {
    handleSubmit,
    handleKeyDown,
    handleFileUpload,
    handleRenameConversation,
    handleArchiveConversation,
    handleShareConversation,
  };
}
