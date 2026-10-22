import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAgents } from './useAgents';
import { useConnections } from '@/integrations/_shared';
import { supabase } from '../lib/supabase';
import { refreshAgentAvatarUrl } from '../lib/avatarUtils';
import { getAgentStorageKey } from '../utils/chatUtils';
import { CHAT_CONSTANTS, WEB_SEARCH_PROVIDERS } from '../constants/chat';
import type { ChatState, ModalState, FileUploadState, AgentSettings, ChatRefs, Agent } from '../types/chat';
import type { Message } from '../types';

export function useAgentChat() {
  const { user } = useAuth();
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { updateAgent } = useAgents();
  const { connections } = useConnections({ includeRevoked: false });

  // Chat State
  const [chatState, setChatState] = useState<ChatState>({
    agent: null,
    messages: [],
    input: '',
    loading: true,
    sending: false,
    error: null,
    isHistoryLoading: true,
    selectedConversationId: (() => {
      const params = new URLSearchParams(location.search);
      const urlConvId = params.get('conv');
      return urlConvId || null;
    })(),
    isCreatingNewConversation: false,
  });

  // Modal State
  const [modalState, setModalState] = useState<ModalState>({
    showTeamAssignmentModal: false,
    showAboutMeModal: false,
    showHowIThinkModal: false,
    showWhatIKnowModal: false,
    showToolsModal: false,
    showChannelsModal: false,
    showTasksModal: false,
    showHistoryModal: false,
    showProcessModal: false,
    showAgentSettingsModal: false,
    agentSettingsInitialTab: 'identity',
  });

  // File Upload State
  const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
    uploading: false,
    uploadProgress: {},
  });

  // Agent Settings
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    reasoningEnabled: (() => {
      const key = getAgentStorageKey(agentId || '', 'reasoning_enabled');
      const v = localStorage.getItem(key);
      return v === null ? true : v === 'true';
    })(),
    webSearchEnabled: (() => {
      const key = getAgentStorageKey(agentId || '', 'web_search_enabled');
      const v = localStorage.getItem(key);
      return v === null ? false : v === 'true';
    })(),
    hasWebSearchCredentials: connections.some(c => 
      WEB_SEARCH_PROVIDERS.includes(c.provider_name as any) && 
      c.connection_status === 'active'
    ),
  });

  // Refs
  const refs: ChatRefs = {
    messagesEndRef: useRef<HTMLDivElement>(null),
    textareaRef: useRef<HTMLTextAreaElement>(null),
    abortControllerRef: useRef<AbortController | null>(null),
    fetchAgentAttempts: useRef(0),
    isMounted: useRef(true),
    fetchInProgress: useRef(false),
  };

  // Update chat state helper
  const updateChatState = useCallback((updates: Partial<ChatState>) => {
    setChatState(prev => ({ ...prev, ...updates }));
  }, []);

  // Update modal state helper
  const updateModalState = useCallback((updates: Partial<ModalState>) => {
    setModalState(prev => ({ ...prev, ...updates }));
  }, []);

  // Update file upload state helper
  const updateFileUploadState = useCallback((updates: Partial<FileUploadState>) => {
    setFileUploadState(prev => ({ ...prev, ...updates }));
  }, []);

  // Update agent settings helper
  const updateAgentSettings = useCallback((updates: Partial<AgentSettings>) => {
    setAgentSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Function to update agent's web search setting in metadata
  const updateAgentWebSearchSetting = useCallback(async (enabled: boolean) => {
    if (!agentId || !chatState.agent) return;
    
    try {
      const currentMetadata = chatState.agent.metadata || {};
      const currentSettings = currentMetadata.settings || {};
      
      const updatedMetadata = {
        ...currentMetadata,
        settings: {
          ...currentSettings,
          web_search_enabled: enabled
        }
      };
      
      const { error } = await supabase
        .from('agents')
        .update({ metadata: updatedMetadata })
        .eq('id', agentId);
        
      if (error) {
        console.error('Error updating agent web search setting:', error);
      } else {
        console.log(`[AgentChat] Web search ${enabled ? 'enabled' : 'disabled'} for agent ${agentId}`);
        updateChatState({ 
          agent: chatState.agent ? { ...chatState.agent, metadata: updatedMetadata } : null 
        });
      }
    } catch (error) {
      console.error('Error updating agent web search setting:', error);
    }
  }, [agentId, chatState.agent, updateChatState]);

  // Sync webSearchEnabled state with agent metadata when agent loads
  useEffect(() => {
    if (chatState.agent && agentId) {
      const settingFromDB = chatState.agent.metadata?.settings?.web_search_enabled;
      if (settingFromDB !== undefined) {
        updateAgentSettings({ webSearchEnabled: settingFromDB });
        localStorage.setItem(getAgentStorageKey(agentId, 'web_search_enabled'), String(settingFromDB));
      }
    }
  }, [chatState.agent, agentId, updateAgentSettings]);

  // Sync selected conversation with URL ?conv= param and localStorage
  useEffect(() => {
    // Listen for task modal activating a conversation
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.agentId === agentId && detail.conversationId) {
        updateChatState({ selectedConversationId: detail.conversationId });
        try { 
          localStorage.setItem(getAgentStorageKey(agentId, 'conversation_id'), detail.conversationId); 
        } catch {}
        // Force a quick refresh of history
        updateChatState({ messages: [] });
        // Ensure sidebar list refreshes by touching last_active
        try {
          supabase.from('conversation_sessions')
            .upsert({ 
              conversation_id: detail.conversationId, 
              agent_id: agentId, 
              user_id: user?.id || null, 
              last_active: new Date().toISOString(), 
              status: 'active' 
            });
        } catch {}
      }
    };
    window.addEventListener('agentopia:conversation:activated', handler as EventListener);
    return () => window.removeEventListener('agentopia:conversation:activated', handler as EventListener);
  }, [agentId, updateChatState, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const conv = params.get('conv');
    if (conv && conv !== chatState.selectedConversationId) {
      // URL has a conversation ID, use it
      updateChatState({ selectedConversationId: conv });
      if (agentId) localStorage.setItem(getAgentStorageKey(agentId, 'conversation_id'), conv);
    } else if (!conv && chatState.selectedConversationId) {
      // URL has no conversation ID but we have one in state
      // This happens when navigating to a new chat - clear the conversation
      updateChatState({ selectedConversationId: null, messages: [] });
      if (agentId) {
        try { 
          localStorage.removeItem(getAgentStorageKey(agentId, 'conversation_id'));
          localStorage.removeItem(getAgentStorageKey(agentId, 'session_id'));
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, agentId]);

  // Reset messages when switching agent or conversation
  useEffect(() => {
    updateChatState({ messages: [], isHistoryLoading: true });
  }, [agentId, chatState.selectedConversationId, updateChatState]);

  // Effect to handle component unmount for async operations
  useEffect(() => {
    refs.isMounted.current = true;
    return () => {
      refs.isMounted.current = false;
      if (refs.abortControllerRef.current) {
        refs.abortControllerRef.current.abort();
      }
    };
  }, [refs]);

  // Fetch agent details
  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId || !user || refs.fetchInProgress.current) return;
      
      refs.fetchInProgress.current = true;
      refs.fetchAgentAttempts.current++;
      
      try {
        updateChatState({ loading: true, error: null });
        
        const controller = new AbortController();
        refs.abortControllerRef.current = controller;
        
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            throw new Error('Agent not found or you do not have permission to access it.');
          }
          throw error;
        }
        
        if (!refs.isMounted.current) {
          console.log('[fetchAgent] Unmounted after Supabase query returned.');
          return;
        }
        
        // Refresh avatar URL if needed
        console.log('Agent loaded with avatar URL:', data.avatar_url);
        const refreshedAvatarUrl = await refreshAgentAvatarUrl(supabase, agentId, data.avatar_url);
        if (refreshedAvatarUrl && refreshedAvatarUrl !== data.avatar_url) {
          console.log('Avatar URL refreshed:', refreshedAvatarUrl);
          data.avatar_url = refreshedAvatarUrl;
        } else if (refreshedAvatarUrl) {
          console.log('Avatar URL is still valid:', refreshedAvatarUrl);
        } else {
          console.log('No avatar URL available for agent:', agentId);
        }

        updateChatState({ agent: data });
      } catch (err) {
        if (!refs.isMounted.current) return;
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to load agent';
        updateChatState({ error: errorMessage });
        console.error('Error fetching agent:', err);
      } finally {
        if (refs.isMounted.current) {
          updateChatState({ loading: false });
          refs.fetchInProgress.current = false;
        }
      }
    };

    fetchAgent();
  }, [agentId, user, updateChatState, refs]);

  return {
    // State
    chatState,
    modalState,
    fileUploadState,
    agentSettings,
    refs,
    
    // State updaters
    updateChatState,
    updateModalState,
    updateFileUploadState,
    updateAgentSettings,
    
    // Utilities
    updateAgentWebSearchSetting,
    
    // Derived values
    agentId,
    user,
    navigate,
    updateAgent,
  };
}
