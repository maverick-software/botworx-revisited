import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Conversation Lifecycle State Machine
 * 
 * @property {status: 'none'} - No conversation exists, showing clean slate
 * @property {status: 'creating'} - User sent first message, creating conversation
 * @property {status: 'active'} - Conversation exists and is active
 */
export type ConversationLifecycle = 
  | { status: 'none' }
  | { status: 'creating'; id: string }
  | { status: 'active'; id: string };

export function useConversationLifecycle(agentId: string | undefined, userId: string | undefined) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [conversationLifecycle, setConversationLifecycle] = useState<ConversationLifecycle>(() => {
    const params = new URLSearchParams(location.search);
    const urlConvId = params.get('conv');
    if (urlConvId) {
      console.log('[useConversationLifecycle] Initial conversation from URL:', urlConvId);
      return { status: 'active', id: urlConvId };
    }
    console.log('[useConversationLifecycle] No conversation - clean slate');
    return { status: 'none' };
  });
  
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);

  // Sync with URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const conv = params.get('conv');
    
    if (conv) {
      const currentId = conversationLifecycle.status === 'active' || conversationLifecycle.status === 'creating' 
        ? conversationLifecycle.id 
        : null;
        
      if (conv !== currentId) {
        console.log('[useConversationLifecycle] Setting conversation ID from URL:', conv, 'previous:', currentId);
        setConversationLifecycle({ status: 'active', id: conv });
        if (agentId) localStorage.setItem(`agent_${agentId}_conversation_id`, conv);
      } else {
        console.log('[useConversationLifecycle] Same conversation clicked, forcing reload:', conv);
        setConversationRefreshKey(prev => prev + 1);
      }
    } else if (!conv) {
      console.log('[useConversationLifecycle] No conversation ID, showing clean slate');
      setConversationLifecycle({ status: 'none' });
      if (agentId) {
        try { 
          localStorage.removeItem(`agent_${agentId}_conversation_id`);
          localStorage.removeItem(`agent_${agentId}_session_id`);
        } catch {}
      }
    }
  }, [location.search, agentId, conversationLifecycle.status, conversationLifecycle.id]);

  // Listen for external conversation activation events
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.agentId === agentId && detail.conversationId) {
        setConversationLifecycle({ status: 'active', id: detail.conversationId });
        try { localStorage.setItem(`agent_${agentId}_conversation_id`, detail.conversationId); } catch {}
        // Ensure sidebar list refreshes
        try {
          supabase.from('conversation_sessions')
            .upsert({ 
              conversation_id: detail.conversationId, 
              agent_id: agentId, 
              user_id: userId || null, 
              last_active: new Date().toISOString(), 
              status: 'active' 
            });
        } catch {}
      }
    };
    window.addEventListener('agentopia:conversation:activated', handler as EventListener);
    return () => window.removeEventListener('agentopia:conversation:activated', handler as EventListener);
  }, [agentId, userId]);

  const startNewConversation = useCallback((conversationId: string) => {
    setConversationLifecycle({ status: 'creating', id: conversationId });
    navigate(`/agents/${agentId}/chat?conv=${conversationId}`, { replace: true });
    if (agentId) {
      localStorage.setItem(`agent_${agentId}_conversation_id`, conversationId);
    }
  }, [agentId, navigate]);

  const markConversationActive = useCallback(() => {
    setConversationLifecycle(prev => 
      prev.status === 'creating' ? { status: 'active', id: prev.id } : prev
    );
  }, []);

  const archiveConversation = useCallback(async () => {
    const conversationId = conversationLifecycle.status === 'active' ? conversationLifecycle.id : null;
    if (!conversationId || !agentId) return;
    
    try {
      await supabase
        .from('conversation_sessions')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('agent_id', agentId);
    } catch {}
    
    setConversationLifecycle({ status: 'none' });
    try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
    navigate(`/agents/${agentId}/chat`, { replace: true });
  }, [conversationLifecycle, agentId, navigate]);

  const renameConversation = useCallback(async (title: string) => {
    const conversationId = conversationLifecycle.status === 'active' ? conversationLifecycle.id : null;
    if (!conversationId || !agentId || !userId) return;
    
    try {
      await supabase
        .from('conversation_sessions')
        .upsert({ 
          conversation_id: conversationId, 
          agent_id: agentId, 
          user_id: userId, 
          title 
        }, { onConflict: 'conversation_id' });
    } catch {}
  }, [conversationLifecycle, agentId, userId]);

  const getShareLink = useCallback(() => {
    const conversationId = conversationLifecycle.status === 'active' ? conversationLifecycle.id : null;
    if (!agentId || !conversationId) return null;
    return `${window.location.origin}/agents/${agentId}/chat?conv=${conversationId}`;
  }, [agentId, conversationLifecycle]);

  return {
    conversationLifecycle,
    setConversationLifecycle,
    conversationRefreshKey,
    startNewConversation,
    markConversationActive,
    archiveConversation,
    renameConversation,
    getShareLink,
  };
}

