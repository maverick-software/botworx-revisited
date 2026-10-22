import React from 'react';
import { Menu, ArrowLeft, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMobileDrawer } from '@/components/Layout';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
  onMenuClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
  // Agent-specific props
  agentAvatar?: string;
  agentName?: string;
  agentCount?: number;
  onAgentClick?: () => void;
}

export function MobileHeader({
  title,
  showBack = false,
  showMenu = true,
  onMenuClick,
  actions,
  className,
  agentAvatar,
  agentName,
  agentCount,
  onAgentClick
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const drawer = useMobileDrawer();

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      drawer.open();
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full bg-background border-b border-border',
        'safe-area-top md:hidden',
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-3">
        {/* Left Side */}
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors -ml-1 flex-shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {showMenu && !showBack && (
            <button
              onClick={handleMenuClick}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors -ml-1 flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          
          {/* Agent Avatar & Name (ChatGPT-style) */}
          {agentAvatar || agentName ? (
            <button
              onClick={onAgentClick}
              className="flex items-center space-x-2 flex-1 min-w-0 py-1 px-2 rounded-lg hover:bg-accent transition-colors"
            >
              {agentAvatar ? (
                <img
                  src={agentAvatar}
                  alt={agentName || 'Agent'}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-sm font-semibold">
                    {agentName?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-1 min-w-0">
                <span className="text-base font-semibold truncate">
                  {agentName || title}
                </span>
                {agentCount !== undefined && (
                  <span className="text-sm text-muted-foreground flex-shrink-0">
                    {agentCount}
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </button>
          ) : (
            <h1 className="text-base font-semibold truncate">{title}</h1>
          )}
        </div>

        {/* Right Side - Actions */}
        {actions && <div className="flex items-center space-x-1 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

