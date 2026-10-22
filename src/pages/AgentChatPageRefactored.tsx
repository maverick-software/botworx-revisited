import React, { useEffect, useCallback } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { formatMarkdown, scrollToBottom, adjustTextareaHeight, generateConversationTitle, getAgentStorageKey, validateFile } from '../utils/chatUtils';
import { CHAT_CONSTANTS } from '../constants/chat';
import { useAgentChat } from '../hooks/useAgentChat';
import { useAIProcessing } from '../hooks/useAIProcessing';
import { useChatHistory } from '../hooks/useChatHistory';
import { useChatHandlers } from '../hooks/useChatHandlers';

// Import extracted components
import { MessageList, ChatStarterScreen } from '../components/chat/MessageComponents';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatModals } from '../components/chat/ChatModals';

export function AgentChatPageRefactored() {
  const {
    chatState,
    modalState,
    fileUploadState,
    agentSettings,
    refs,
    updateChatState,
    updateModalState,
    updateFileUploadState,
    updateAgentSettings,
    updateAgentWebSearchSetting,
    agentId,
    user,
    navigate,
    updateAgent,
  } = useAgentChat();

  const aiProcessing = useAIProcessing(chatState.agent, user);

  const { fetchHistory } = useChatHistory(
    agentId,
    user,
    chatState.selectedConversationId,
    chatState.isCreatingNewConversation,
    updateChatState,
    navigate
  );

  const {
    handleSubmit,
    handleKeyDown,
    handleFileUpload,
    handleRenameConversation,
    handleArchiveConversation,
    handleShareConversation,
  } = useChatHandlers({
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
  });

  // Auto-resize textarea
  const handleAdjustTextareaHeight = useCallback(() => {
    adjustTextareaHeight(refs.textareaRef);
  }, [refs.textareaRef]);

  useEffect(() => {
    handleAdjustTextareaHeight();
  }, [chatState.input, handleAdjustTextareaHeight]);

  // Auto-scroll to bottom when messages change - more controlled
  useEffect(() => {
    if (!chatState.isHistoryLoading && chatState.messages.length > 0 && refs.messagesEndRef.current) {
      const container = refs.messagesEndRef.current.closest('.overflow-y-auto');
      if (container) {
        // Only auto-scroll if user is near the bottom (within 100px)
        const isNearBottom = container.scrollTop >= container.scrollHeight - container.clientHeight - CHAT_CONSTANTS.SCROLL_THRESHOLD;
        
        if (isNearBottom) {
          requestAnimationFrame(() => {
            scrollToBottom(refs.messagesEndRef);
          });
        }
      }
    }
  }, [chatState.messages, chatState.isHistoryLoading, refs.messagesEndRef]);

  // Initial scroll when history loading completes - instant
  useEffect(() => {
    if (!chatState.isHistoryLoading && chatState.messages.length > 0) {
      setTimeout(() => {
        if (refs.messagesEndRef.current) {
          refs.messagesEndRef.current.scrollIntoView({ 
            behavior: 'auto', // Instant scroll for initial load
            block: 'end' 
          });
        }
      }, CHAT_CONSTANTS.SCROLL_DELAY);
    }
  }, [chatState.isHistoryLoading, refs.messagesEndRef]);

  // Fetch chat history
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="text-foreground text-lg">Please sign in to chat with agents.</div>
        </div>
      </div>
    );
  }

  if (chatState.loading && !chatState.agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <div className="text-foreground">Loading agent...</div>
        </div>
      </div>
    );
  }

  if (chatState.error && !chatState.agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <div className="text-destructive mb-4">Error loading agent: {chatState.error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!chatState.loading && !chatState.agent) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-yellow-400 mx-auto mb-4" />
          <div className="text-yellow-400">Agent not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Main Column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Chat Header */}
        <ChatHeader
          agent={chatState.agent}
          agentId={agentId || ''}
          aiState={aiProcessing.aiProcessingState.aiState}
          toolExecutionStatus={aiProcessing.aiProcessingState.currentTool}
          onShowTeamAssignment={() => updateModalState({ showTeamAssignmentModal: true })}
          onShowAboutMe={() => updateModalState({ showAboutMeModal: true })}
          onShowHowIThink={() => updateModalState({ showHowIThinkModal: true })}
          onShowWhatIKnow={() => updateModalState({ showWhatIKnowModal: true })}
          onShowTools={() => updateModalState({ showToolsModal: true })}
          onShowChannels={() => updateModalState({ showChannelsModal: true })}
          onShowTasks={() => updateModalState({ showTasksModal: true })}
          onShowHistory={() => updateModalState({ showHistoryModal: true })}
          onShowAgentSettings={() => updateModalState({ showAgentSettingsModal: true })}
        />

        {/* Messages Container - Hidden scrollbar */}
        <div className="flex-1 overflow-y-auto hide-scrollbar min-h-0 relative">
          {/* Gradient fade effect at top of messages - Fixed positioning to prevent shifts */}
          <div className="absolute top-0 left-0 right-0 h-20 chat-gradient-fade-top pointer-events-none z-10 opacity-0 transition-opacity duration-300" 
               style={{ opacity: chatState.messages.length > 0 ? 1 : 0 }} />
          {chatState.isHistoryLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chatState.messages.length === 0 ? (
              <ChatStarterScreen agent={chatState.agent} />
            ) : (
              <div className="max-w-3xl mx-auto px-4 py-6 pb-8 min-h-full">
                <MessageList 
                  messages={chatState.messages}
                  agent={chatState.agent}
                  user={user}
                  thinkingMessageIndex={aiProcessing.aiProcessingState.thinkingMessageIndex}
                  formatMarkdown={formatMarkdown}
                />
                <div ref={refs.messagesEndRef} />
              </div>
            )}
        </div>

        {/* Chat Input */}
        <ChatInput
          input={chatState.input}
          setInput={(value) => updateChatState({ input: value })}
          agent={chatState.agent}
          sending={chatState.sending}
          uploading={fileUploadState.uploading}
          uploadProgress={fileUploadState.uploadProgress}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          onFileUpload={handleFileUpload}
          adjustTextareaHeight={handleAdjustTextareaHeight}
        />
      </div>

      {/* Chat Modals */}
      <ChatModals
        showTeamAssignmentModal={modalState.showTeamAssignmentModal}
        showAboutMeModal={modalState.showAboutMeModal}
        showHowIThinkModal={modalState.showHowIThinkModal}
        showWhatIKnowModal={modalState.showWhatIKnowModal}
        showToolsModal={modalState.showToolsModal}
        showChannelsModal={modalState.showChannelsModal}
        showTasksModal={modalState.showTasksModal}
        showHistoryModal={modalState.showHistoryModal}
        showProcessModal={modalState.showProcessModal}
        showAgentSettingsModal={modalState.showAgentSettingsModal}
        setShowTeamAssignmentModal={(show) => updateModalState({ showTeamAssignmentModal: show })}
        setShowAboutMeModal={(show) => updateModalState({ showAboutMeModal: show })}
        setShowHowIThinkModal={(show) => updateModalState({ showHowIThinkModal: show })}
        setShowWhatIKnowModal={(show) => updateModalState({ showWhatIKnowModal: show })}
        setShowToolsModal={(show) => updateModalState({ showToolsModal: show })}
        setShowChannelsModal={(show) => updateModalState({ showChannelsModal: show })}
        setShowTasksModal={(show) => updateModalState({ showTasksModal: show })}
        setShowHistoryModal={(show) => updateModalState({ showHistoryModal: show })}
        setShowProcessModal={(show) => updateModalState({ showProcessModal: show })}
        setShowAgentSettingsModal={(show) => updateModalState({ showAgentSettingsModal: show })}
        agentId={agentId || ''}
        agent={chatState.agent}
        currentProcessingDetails={aiProcessing.aiProcessingState.currentProcessingDetails}
        agentSettingsInitialTab={modalState.agentSettingsInitialTab}
        onAgentUpdated={(updatedAgent) => updateChatState({ agent: updatedAgent })}
        updateAgent={updateAgent}
      />
    </div>
  );
}
