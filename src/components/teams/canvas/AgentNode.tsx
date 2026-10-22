import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { createPortal } from 'react-dom';
import { 
  Bot, 
  MoreVertical, 
  ExternalLink,
  Trash2,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { Agent } from '@/types';

export interface AgentNodeData {
  agent: Agent;
  teamCount?: number; // Number of teams this agent is part of
  isSelected?: boolean;
  
  // Callbacks
  onAgentClick?: (agentId: string) => void;
  onAgentEdit?: (agentId: string) => void;
  onAgentDelete?: (agentId: string) => void;
  onConnectionStart?: (agentId: string, handle: string) => void;
}

// Agent status color mapping
const statusColors = {
  'active': 'bg-green-500',
  'idle': 'bg-yellow-500',
  'offline': 'bg-gray-500',
  'error': 'bg-red-500'
};

export const AgentNode = memo<NodeProps<AgentNodeData>>(({ data, selected }) => {
  // Extract all data from the data prop
  const { agent, teamCount = 0 } = data;
  
  // Extract callbacks from data if available
  const {
    onAgentClick = () => {},
    onAgentEdit = () => {},
    onAgentDelete = () => {},
    onConnectionStart = () => {}
  } = data;
  
  // Custom dropdown state
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isDark, setIsDark] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Check theme on mount and when menu opens
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('chatgpt'));
  }, [showMenu]);
  
  // Calculate menu position when opened
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 160 // Align right edge of menu with button
      });
    }
  }, [showMenu]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAgentClick(agent.id);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAgentEdit(agent.id);
    setShowMenu(false);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAgentDelete(agent.id);
    setShowMenu(false);
  };
  
  const handleConnectionStart = (position: 'top' | 'right' | 'bottom' | 'left') => {
    onConnectionStart(agent.id, position);
  };
  
  return (
    <div
      className={cn(
        "agent-node relative group bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 rounded-lg shadow-md transition-all duration-200",
        "min-w-[180px] max-w-[240px] p-3 cursor-pointer",
        selected && "border-blue-500 shadow-lg scale-105 ring-2 ring-blue-500/50"
      )}
      onClick={handleClick}
    >
      {/* Connection Handles - only visible on hover, with unique IDs */}
      <Handle 
        id="top"
        type="source" 
        position={Position.Top} 
        className={cn(
          "react-flow__handle react-flow__handle-top",
          "!bg-blue-500 !border-2 !border-white",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('top')}
      />
      <Handle 
        id="right"
        type="source" 
        position={Position.Right} 
        className={cn(
          "react-flow__handle react-flow__handle-right",
          "!bg-blue-500 !border-2 !border-white",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('right')}
      />
      <Handle 
        id="bottom"
        type="source" 
        position={Position.Bottom} 
        className={cn(
          "react-flow__handle react-flow__handle-bottom",
          "!bg-blue-500 !border-2 !border-white",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('bottom')}
      />
      <Handle 
        id="left"
        type="source" 
        position={Position.Left} 
        className={cn(
          "react-flow__handle react-flow__handle-left",
          "!bg-blue-500 !border-2 !border-white",
          "!w-3 !h-3 !rounded-full transition-opacity duration-200",
          "!opacity-0 group-hover:!opacity-100"
        )}
        onMouseDown={() => handleConnectionStart('left')}
      />
      
      {/* Target handles for receiving connections - with unique IDs */}
      <Handle 
        id="top-target"
        type="target" 
        position={Position.Top} 
        className="!opacity-0"
      />
      <Handle 
        id="right-target"
        type="target" 
        position={Position.Right} 
        className="!opacity-0"
      />
      <Handle 
        id="bottom-target"
        type="target" 
        position={Position.Bottom} 
        className="!opacity-0"
      />
      <Handle 
        id="left-target"
        type="target" 
        position={Position.Left} 
        className="!opacity-0"
      />
      
      {/* Node Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-500">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-sm truncate" 
              title={agent.name}
            >
              {agent.name}
            </h3>
          </div>
        </div>
        
        {/* Team Count Badge */}
        {teamCount > 0 && (
          <Badge variant="secondary" className="text-xs ml-2">
            {teamCount} team{teamCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
      
      {/* Node Content */}
      <div className="space-y-1.5">
        {/* Model Badge */}
        {agent.model && (
          <div className="flex items-center">
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              {agent.model}
            </Badge>
          </div>
        )}
        
        {/* Description */}
        {agent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={agent.description}>
            {agent.description}
          </p>
        )}
      </div>
      
      {/* Context Menu */}
      <div className="absolute top-1 right-1">
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <MoreVertical className="h-3 w-3" />
        </Button>
        
        {showMenu && createPortal(
          <div 
            ref={menuRef}
            className="fixed rounded-md shadow-lg py-1 min-w-[160px]"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              zIndex: 9999,
              backgroundColor: isDark ? 'hsl(217 25% 12%)' : 'hsl(0 0% 100%)',
              color: isDark ? 'hsl(210 20% 98%)' : 'hsl(240 10% 3.9%)',
              border: `1px solid ${isDark ? 'hsl(217 19% 20%)' : 'hsl(214.3 31.8% 91.4%)'}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center w-full px-3 py-2 text-sm transition-colors text-left"
              style={{
                color: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'hsl(217 19% 20%)' : 'hsl(210 40% 96%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={(e) => {
                handleClick(e);
                setShowMenu(false);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Agent
            </button>
            <button
              className="flex items-center w-full px-3 py-2 text-sm transition-colors text-left"
              style={{
                color: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'hsl(217 19% 20%)' : 'hsl(210 40% 96%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Agent
            </button>
            <div 
              style={{
                height: '1px',
                backgroundColor: isDark ? 'hsl(217 19% 20%)' : 'hsl(214.3 31.8% 91.4%)',
                margin: '4px 0'
              }}
            />
            <button
              className="flex items-center w-full px-3 py-2 text-sm transition-colors text-left"
              style={{
                color: isDark ? 'hsl(0 62.8% 50%)' : 'hsl(0 84.2% 60.2%)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'hsl(217 19% 20%)' : 'hsl(210 40% 96%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Canvas
            </button>
          </div>,
          document.body
        )}
      </div>
      
      {/* Selection indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
      )}
    </div>
  );
});

AgentNode.displayName = 'AgentNode';







