import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { createPortal } from 'react-dom';
import { 
  Users, 
  MoreVertical, 
  ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { TeamNodeData } from './types/canvas';

// Team color mapping based on type or default gradient
const teamColors = {
  'engineering': 'from-blue-500 to-blue-600',
  'marketing': 'from-purple-500 to-purple-600', 
  'sales': 'from-green-500 to-green-600',
  'hr': 'from-orange-500 to-orange-600',
  'operations': 'from-gray-500 to-gray-600',
  'default': 'from-primary to-primary/80'
};

export const TeamNode = memo<NodeProps<TeamNodeData>>(({ data, selected }) => {
  // Extract all data from the data prop
  const { team, memberCount = 0, agentNames = [], teamType = 'default' } = data;
  
  // Extract callbacks from data if available
  const {
    onTeamClick = () => {},
    onTeamEdit = () => {},
    onTeamDelete = () => {},
    onConnectionStart = () => {}
  } = data;
  
  const gradientClass = teamColors[teamType as keyof typeof teamColors] || teamColors.default;
  
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
        left: rect.right - 140 // Align right edge of menu with button
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
    onTeamClick(team.id);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTeamEdit(team.id);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTeamDelete(team.id);
  };
  
  const handleConnectionStart = (position: 'top' | 'right' | 'bottom' | 'left') => {
    onConnectionStart(team.id, position);
  };
  
  return (
    <div
      className={cn(
        "team-node relative group bg-card border-2 rounded-xl shadow-md transition-all duration-200",
        "min-w-[200px] max-w-[280px] p-4 cursor-pointer",
        selected && "border-primary shadow-lg scale-105 bg-primary/5"
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
          "!bg-primary !border-2 !border-primary-foreground",
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
          "!bg-primary !border-2 !border-primary-foreground",
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
          "!bg-primary !border-2 !border-primary-foreground",
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
          "!bg-primary !border-2 !border-primary-foreground",
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            `bg-gradient-to-br ${gradientClass}`
          )}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-sm truncate" 
              title={team.name}
            >
              {team.name}
            </h3>
          </div>
        </div>
        
        {/* Member Count Badge */}
        <Badge variant="secondary" className="text-xs ml-2">
          {memberCount}
        </Badge>
      </div>
      
      {/* Node Content */}
      <div className="space-y-2">
        {/* Agent List */}
        {agentNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agentNames.slice(0, 3).map((name, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs px-1 py-0"
              >
                {name}
              </Badge>
            ))}
            {agentNames.length > 3 && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                +{agentNames.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Context Menu - Custom implementation to avoid Radix UI infinite loop */}
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
            className="fixed rounded-md shadow-lg py-1 min-w-[140px]"
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
              View Team
            </button>
          </div>,
          document.body
        )}
      </div>
      
      {/* Selection indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-primary rounded-xl pointer-events-none" />
      )}
      

    </div>
  );
});

TeamNode.displayName = 'TeamNode';
