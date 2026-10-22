import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { X, Settings, User, LogOut, FileText, Shield, Sparkles, MessageSquare, Bot, Users, Zap, FolderOpen, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeGestureOnElement } from '@/hooks/useSwipeGesture';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/lib/supabase';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [gofrAgentId, setGofrAgentId] = useState<string | null>(null);
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null);
  
  // Check if we're on an agent chat page - EXACT COPY from Sidebar.tsx
  const match = location.pathname.match(/^\/agents\/([^/]+)\/chat/);
  const currentAgentId = match?.[1];
  
  // Fetch current agent name if we're on an agent chat page
  useEffect(() => {
    if (currentAgentId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('agents')
            .select('name')
            .eq('id', currentAgentId)
            .single();
          
          if (data && !error) {
            setCurrentAgentName(data.name);
          }
        } catch (err) {
          console.error('Failed to fetch agent name:', err);
        }
      })();
    } else {
      setCurrentAgentName(null);
    }
  }, [currentAgentId]);
  
  // Fetch Gofr agent ID - EXACT COPY from Sidebar.tsx
  useEffect(() => {
    if (!currentAgentId && !gofrAgentId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('agents')
            .select('id')
            .eq('name', 'Gofr')
            .eq('metadata->>is_system_agent', 'true')
            .single();
          
          if (data && !error) {
            setGofrAgentId(data.id);
          }
        } catch (err) {
          console.error('Failed to fetch Gofr agent:', err);
        }
      })();
    }
  }, [currentAgentId, gofrAgentId]);
  
  // Use provided agentId or fallback to Gofr agent - EXACT COPY from Sidebar.tsx
  const effectiveAgentId = currentAgentId || gofrAgentId;
  
  // Fetch conversations for effective agent - EXACT COPY from Sidebar.tsx
  const { items: conversations } = useConversations(effectiveAgentId || '', user?.id || '');

  // Swipe to close
  useSwipeGestureOnElement(drawerRef, {
    onSwipeRight: onClose,
    threshold: 100
  });

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Main navigation items (top section)
  // NOTE: "New Chat" removed - users should create and chat with their own agents
  const mainNavItems = [
    // {
    //   id: 'new-chat',
    //   label: 'New Chat',
    //   icon: Plus,
    //   path: '/chat',
    //   divider: false
    // },
    {
      id: 'agents',
      label: 'My Agents',
      icon: Bot,
      path: '/agents',
      divider: false
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: Users,
      path: '/teams',
      divider: false
    },
    {
      id: 'library',
      label: 'Library',
      icon: FolderOpen,
      path: '/media',
      divider: false
    }
  ];

  // Admin items (only for admins)
  const adminItems = [
    {
      id: 'admin',
      label: 'Admin Panel',
      icon: Shield,
      path: '/admin',
      divider: false,
      adminOnly: true
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={cn(
          'fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] z-50',
          'bg-background',
          'transform transition-transform duration-300 ease-out',
          'md:hidden safe-area-inset',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex flex-col h-full">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold">Gofr Agents</h2>
            <button
              onClick={onClose}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-accent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 overflow-y-auto momentum-scroll px-2">
            {/* Primary Actions */}
            <div className="mb-4">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-3 rounded-lg mb-1',
                      'touch-target no-select transition-colors duration-200',
                      'hover:bg-accent text-foreground group'
                    )}
                  >
                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-border my-4" />

            {/* Chat History Section */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                {currentAgentName ? `${currentAgentName} Chat History` : 'Gofr Chat History'}
              </h3>
              <div className="space-y-1">
                {conversations && conversations.length > 0 ? (
                  conversations.slice(0, 10).map((conversation) => (
                    <Link
                      key={conversation.conversation_id}
                      to={`/agents/${effectiveAgentId}/chat?conversationId=${conversation.conversation_id}`}
                      onClick={onClose}
                      className={cn(
                        'flex items-center space-x-3 px-3 py-2 rounded-lg w-full text-left',
                        'touch-target no-select transition-colors duration-200',
                        'hover:bg-accent text-foreground group'
                      )}
                    >
                      <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">
                        {conversation.title || 'New conversation'}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No conversations yet
                  </div>
                )}
              </div>
            </div>

            {/* Admin Section */}
            {user?.role?.includes('admin') && adminItems.length > 0 && (
              <>
                <div className="border-t border-border my-4" />
                <div>
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={onClose}
                        className={cn(
                          'flex items-center space-x-3 px-3 py-3 rounded-lg mb-1',
                          'touch-target no-select transition-colors duration-200',
                          'hover:bg-accent text-foreground group'
                        )}
                      >
                        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </nav>

          {/* User Profile Footer */}
          <div className="border-t border-border">
            <div className="p-4">
              <Link
                to="/profile"
                onClick={onClose}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || ''}
                  </p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-lg w-full mt-2',
                  'touch-target no-select transition-colors duration-200',
                  'hover:bg-destructive/10 text-destructive text-sm'
                )}
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

