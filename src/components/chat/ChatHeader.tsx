import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, Flag, Trash2, Share, ChevronDown, MessageSquare, Info, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { Database } from '../../types/database.types';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMobileDrawer } from '../Layout';

export type ChatMode = 'text' | 'voice' | 'realtime';

type Agent = Database['public']['Tables']['agents']['Row'];

interface ChatHeaderProps {
  agent: Agent | null;
  agentId: string;
  conversationId?: string;
  onShowAgentSettings: () => void;
}

export function ChatHeader({
  agent,
  agentId,
  conversationId,
  onShowAgentSettings
}: ChatHeaderProps) {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const [isProcessing, setIsProcessing] = useState(false);
  const isMobile = useIsMobile();
  const drawer = useMobileDrawer();

  const handleShare = () => {
    // TODO: Implement share functionality
    toast.success('Share functionality coming soon!');
  };

  const handleReport = () => {
    // TODO: Implement report functionality
    toast.success('Report functionality coming soon!');
  };

  const handleDelete = async () => {
    if (!agentId) {
      toast.error('No agent to delete');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${agent?.name || 'this agent'}? This action cannot be undone and will delete all conversations, messages, and data associated with this agent.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('delete_agent_cascade', {
        agent_uuid: agentId
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Agent and all related data deleted successfully');
      navigate('/agents');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 pt-2.5 pb-0.5 bg-card safe-area-top">
      <div className="flex items-center space-x-2">
        {/* Mobile: Show hamburger menu */}
        {isMobile && (
          <button
            onClick={drawer.open}
            className="touch-target p-2 rounded-lg hover:bg-accent transition-colors -ml-2"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => navigate('/agents')}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        
        {/* Agent Card with Dropdown Menu - ChatGPT Style */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center space-x-3 px-2 py-1.5 -mx-2 hover:bg-accent rounded-lg transition-colors group">
              <div className="flex items-center space-x-3">
                {/* Avatar */}
                <div className="relative">
                  {resolvedAvatarUrl ? (
                    <img 
                      src={resolvedAvatarUrl} 
                      alt={agent?.name || 'Agent'}
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => {
                        console.warn('Header avatar failed to load:', resolvedAvatarUrl);
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                    style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
                  >
                    <span className="text-white text-xs font-medium">
                      {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  </div>
                </div>
                
                {/* Agent Name */}
                <div className="flex items-center space-x-1.5">
                  <h1 className="text-sm font-semibold text-foreground text-left">
                    {agent?.name || 'Loading...'}
                  </h1>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 border-0 shadow-lg rounded-xl">
            <DropdownMenuItem onClick={() => navigate(`/agents/${agentId}/chat`, { replace: true })}>
              <MessageSquare className="mr-2 h-4 w-4" />
              New chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowAgentSettings}>
              <Info className="mr-2 h-4 w-4" />
              About
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center space-x-2">
        {/* Agent Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-accent rounded-lg transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-0 shadow-lg rounded-xl">
            <DropdownMenuItem onClick={handleShare} disabled={isProcessing}>
              <Share className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReport} disabled={isProcessing}>
              <Flag className="mr-2 h-4 w-4" />
              Report
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDelete} 
              disabled={isProcessing || !agentId}
              className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
