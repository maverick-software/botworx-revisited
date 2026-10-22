import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConversations } from '../hooks/useConversations';
import { useAgents } from '../hooks/useAgents';
import { Search, Plus, MoreVertical, Pencil, Archive, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ChatsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { agents } = useAgents();
  const agent = agents.find(a => a.id === agentId);
  
  const { items: conversations, renameConversation, archiveConversation } = useConversations(agentId || '', user?.id || '');

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(conv => 
    (conv.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conv.last_message || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewChat = () => {
    if (!agentId) return;
    // Clear stored conversation ID and navigate to new chat
    try {
      localStorage.removeItem(`agent_${agentId}_conversation_id`);
      localStorage.removeItem(`agent_${agentId}_session_id`);
    } catch {}
    navigate(`/agents/${agentId}/chat`);
  };

  const handleOpenChat = (conversationId: string) => {
    if (!agentId || !user) return;
    
    // Validate conversation is active before opening
    (async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: row } = await supabase
          .from('conversation_sessions')
          .select('status')
          .eq('conversation_id', conversationId)
          .eq('agent_id', agentId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!row || row.status !== 'active') {
          // If not active, clear selection and go to new chat screen
          try { localStorage.removeItem(`agent_${agentId}_conversation_id`); } catch {}
          navigate(`/agents/${agentId}/chat`);
          return;
        }
        
        localStorage.setItem(`agent_${agentId}_conversation_id`, conversationId);
        navigate(`/agents/${agentId}/chat?conv=${conversationId}`);
      } catch {
        navigate(`/agents/${agentId}/chat`);
      }
    })();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      return 'Less than 1 hour ago';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) !== 1 ? 's' : ''} ago`;
    } else if (diffInDays < 30) {
      return `${Math.floor(diffInDays)} day${Math.floor(diffInDays) !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!user || !agentId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Your chat history</h1>
              {agent && (
                <p className="text-sm text-muted-foreground mt-1">
                  Conversations with {agent.name}
                </p>
              )}
            </div>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search your chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Chat count */}
        <div className="mb-6 text-sm text-muted-foreground">
          {filteredConversations.length} chat{filteredConversations.length !== 1 ? 's' : ''} with {agent?.name || 'Agent'}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        {/* Conversations List */}
        <div className="space-y-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                {searchTerm ? 'No chats found matching your search.' : 'No conversations yet.'}
              </div>
              {!searchTerm && (
                <button
                  onClick={handleNewChat}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Start your first conversation
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const displayTitle = conversation.title || 'Untitled Conversation';
              
              return (
                <div
                  key={conversation.conversation_id}
                  className="group flex items-center justify-between p-4 bg-card/50 border border-border/50 rounded-lg hover:bg-card hover:border-border cursor-pointer transition-colors"
                  onClick={() => handleOpenChat(conversation.conversation_id)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground mb-1 truncate">
                      {displayTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Last message {formatRelativeTime(conversation.updated_at)}
                    </p>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-accent rounded-md transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTitle = prompt('Rename conversation', conversation.title || '');
                          if (newTitle !== null) {
                            renameConversation(conversation.conversation_id, newTitle);
                          }
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await archiveConversation(conversation.conversation_id);
                          // Clear from localStorage if it's the current conversation
                          try { 
                            localStorage.removeItem(`agent_${agentId}_conversation_id`); 
                          } catch {}
                        }}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this conversation?')) {
                            await archiveConversation(conversation.conversation_id);
                            // Clear from localStorage if it's the current conversation
                            try { 
                              localStorage.removeItem(`agent_${agentId}_conversation_id`); 
                            } catch {}
                          }
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
