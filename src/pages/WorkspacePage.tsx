import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Send, AlertCircle, CheckCircle2, Loader2, Menu, Users, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage } from '../components/ChatMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Workspace } from './WorkspacesListPage'; // Keep this type
import type { Message } from '../types'; 
import ChannelListSidebar from '@/components/ChannelListSidebar'; 
import { useChatChannels } from '@/hooks/useChatChannels'; 
import WorkspaceMemberSidebar from '@/components/workspaces/WorkspaceMemberSidebar';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { WorkspaceChatInput } from '@/components/WorkspaceChatInput'; 
import { Button } from '@/components/ui/button';
import { useWorkspaces } from '@/hooks/useWorkspaces'; 
import { useChatMessages } from '@/hooks/useChatMessages';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers'; // Assuming this type exists

// Keep WorkspaceMember type if needed by other parts of the component
// interface WorkspaceMember { ... } 

export function WorkspacePage() { 
  const { user } = useAuth();
  const { roomId: workspaceId, channelId } = useParams<{ roomId: string, channelId?: string }>(); 
  const navigate = useNavigate();
  const { channels, loading: channelsLoading } = useChatChannels(workspaceId ?? null); 
  
  // --- Instantiate useWorkspaces to get fetchWorkspaceById --- 
  const { fetchWorkspaceById } = useWorkspaces();
  // --- End instantiation ---
  
  const { 
    members: workspaceMembersData, 
    loading: membersLoading, 
    error: membersError,
    addAgentMember, 
  } = useWorkspaceMembers(workspaceId ?? null); 
  
  // --- Memoize members --- 
  const members = useMemo(() => workspaceMembersData, [workspaceMembersData]);
  // --- End Memoization --- 

  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loadingCurrentWorkspace, setLoadingCurrentWorkspace] = useState(true);
  const [currentWorkspaceError, setCurrentWorkspaceError] = useState<Error | null>(null);

  const { 
    messages, 
    loading: loadingMessages, 
    error: messagesError, 
    sendMessage,
    sending: messagesSending 
  } = useChatMessages(workspaceId ?? null, channelId ?? null); 

  const [isChannelSidebarOpen, setIsChannelSidebarOpen] = useState(false);
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true); 

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Cleanup if needed (e.g., abort controllers inside hooks)
    };
  }, []);

  // --- useEffect to fetch the current workspace ---
  useEffect(() => {
    if (workspaceId && fetchWorkspaceById) {
      let isActive = true;
      const loadWorkspace = async () => {
        setLoadingCurrentWorkspace(true);
        setCurrentWorkspaceError(null);
        try {
          const data = await fetchWorkspaceById(workspaceId); 
          if (isActive) {
            setCurrentWorkspace(data);
          }
        } catch (err) {
          if (isActive) {
             setCurrentWorkspaceError(err instanceof Error ? err : new Error('Failed to fetch workspace'));
          }
        } finally {
          if (isActive) {
            setLoadingCurrentWorkspace(false);
          }
        }
      };
      loadWorkspace();
      return () => { isActive = false; };
    } else {
        // Handle case where workspaceId is missing or fetch function isn't ready
        setLoadingCurrentWorkspace(false);
        if (!workspaceId) setCurrentWorkspaceError(new Error("Workspace ID missing"));
    }
  }, [workspaceId, fetchWorkspaceById]);
  // --- End workspace fetch useEffect ---

  // *** Keep useEffect: Navigate to first channel if none selected ***
  useEffect(() => {
    // Use loading state for the current workspace
    if (!loadingCurrentWorkspace && !channelsLoading && !channelId && channels && channels.length > 0) {
      const firstChannelId = channels[0].id;
      console.log(`[WorkspacePage] No channelId in URL, navigating to first channel: ${firstChannelId}`);
      navigate(`/workspaces/${workspaceId}/channels/${firstChannelId}`, { replace: true });
    }
  }, [workspaceId, channelId, channels, channelsLoading, loadingCurrentWorkspace, navigate]); // Updated dependency

  useEffect(() => {
    // Scroll to bottom when messages change (from useChatMessages hook)
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);
  
  // --- Handle Loading States (Consolidated) ---
  const isLoading = loadingCurrentWorkspace || channelsLoading || membersLoading || (!!channelId && loadingMessages);
  // --- End Loading State Handling ---

  // --- Handle Error States (Consolidated) ---
  // Combine errors from all relevant hooks/state
  const pageError = currentWorkspaceError || membersError || (!!channelId ? messagesError : null);
  // --- End Error State Handling ---

  const handleSendMessage = useCallback(async (content: string, agentId?: string | null) => {
    if (!workspaceId || !channelId || !user?.id || !sendMessage) return; 
    
    try {
      await sendMessage(content, agentId); 
    } catch (error) { 
       console.error("Error sending message:", error);
    }
    
  }, [workspaceId, channelId, user?.id, sendMessage]);

  // Function to handle adding an agent (example using mutation from useWorkspaceMembers)
  const handleAddAgent = useCallback(async (agentId: string, role: string = 'member'): Promise<boolean> => { 
    if (!workspaceId || !addAgentMember) return false; 
    console.log(`[WorkspacePage] Attempting to add agent ${agentId} with role ${role}`);
    try {
      await addAgentMember(agentId, role); 
      console.log(`[WorkspacePage] Agent ${agentId} added successfully.`);
      return true; 
    } catch (error) { 
      console.error(`[WorkspacePage] Failed to add agent ${agentId}:`, error);
      return false; 
    }
  }, [workspaceId, addAgentMember]);

  // --- Early return for missing ID ---
  if (!workspaceId) {
    return <div className="flex h-screen items-center justify-center text-red-500">Workspace ID is missing.</div>;
  }
  // --- End Early return ---

  return (
    <div className="flex h-screen bg-background text-foreground">
      <ChannelListSidebar 
        workspaceId={workspaceId} 
        channels={channels ?? []} 
        loading={channelsLoading} 
        currentChannelId={channelId}
        isOpen={isChannelSidebarOpen}
        setIsOpen={setIsChannelSidebarOpen}
        workspaceName={currentWorkspace?.name ?? 'Loading...'} 
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card p-4 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu for Channel Sidebar (Mobile) */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={() => setIsChannelSidebarOpen(!isChannelSidebarOpen)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            {/* Workspace Title & Description */}
            <div>
              <h1 className="text-lg font-semibold">{currentWorkspace?.name ?? 'Workspace'}</h1>
              {/* Add workspace description if available in the state (needs select in hook/fetch) */}
              {/* <p className="text-sm text-muted-foreground">{currentWorkspace?.description ?? ''}</p> */}
            </div>
          </div>
          <div className="flex items-center gap-4">
             {/* --- ADD Settings Link/Button --- */}
             <Link to={`/workspaces/${workspaceId}/settings`}>
               <Button variant="ghost" size="icon" aria-label="Workspace Settings">
                 <Settings className="h-5 w-5" />
               </Button>
             </Link>
             {/* --- END Settings Link/Button --- */}
            {/* Hamburger Menu for Member Sidebar (Mobile/Tablet) */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden" 
              onClick={() => setIsMemberSidebarOpen(!isMemberSidebarOpen)}
            >
              <Users className="h-6 w-6" />
            </Button>
            {/* Keep Exit Workspace Button */}
            <Button variant="outline" onClick={() => navigate('/workspaces')}>
              Exit Workspace
            </Button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 flex flex-col">
          {isLoading && !messages.length && (
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner />
            </div>
          )}

          {pageError && (
            <div className="flex h-full flex-col items-center justify-center text-red-500">
               <AlertCircle className="mb-2 h-10 w-10" />
               <p className="text-center font-semibold">Error Loading Workspace Data</p>
               <p className="text-center text-sm">
                 {typeof pageError === 'string' ? pageError : pageError?.message ?? 'An unknown error occurred'}
               </p> 
            </div>
          )}

          {!isLoading && !pageError && !channelId && (
             <div className="flex h-full items-center justify-center text-muted-foreground">
               <p>Select a channel to start chatting.</p>
             </div>
          )}

          {!isLoading && !pageError && channelId && messages.length === 0 && !loadingMessages && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p>No messages in this channel yet. Send the first message!</p>
            </div>
          )}

          {/* Render Messages */}
          {channelId && messages.map((msg, index) => (
            <ChatMessage 
              key={msg.id || `msg-${index}`}
              message={msg} 
              members={members ?? []} 
            />
          ))}
          <div ref={messagesEndRef} /> {/* For scrolling */}
        </main>

        {/* Chat Input Area */}
        {channelId && ( // Only show input if a channel is selected
           <footer className="border-t bg-card p-4">
             <WorkspaceChatInput 
               channelId={channelId} 
               workspaceId={workspaceId}
               members={members ?? []} 
               onSendMessage={handleSendMessage}
             />
           </footer>
        )}
      </div>

      <WorkspaceMemberSidebar 
        workspaceId={workspaceId}
        members={members ?? []} 
        loading={membersLoading} 
        error={membersError} 
        onAddAgent={handleAddAgent} 
        isOpen={isMemberSidebarOpen}
        setIsOpen={setIsMemberSidebarOpen}
        currentUserRole={'owner'} 
      />
    </div>
  );
} 