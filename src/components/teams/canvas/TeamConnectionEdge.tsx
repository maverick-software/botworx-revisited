import React, { memo, useState, useRef, useEffect } from 'react';
import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  getBezierPath,
  getSimpleBezierPath,
  getStraightPath,
  MarkerType,
  EdgeProps
} from 'reactflow';
import { X, Edit, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { ConnectionEdgeData, ConnectionType } from './types/canvas';

// Connection styling based on type
const connectionStyles = {
  reports_to: {
    stroke: 'hsl(var(--foreground))',
    strokeWidth: 2,
    strokeDasharray: 'none',
    markerEnd: MarkerType.ArrowClosed,
  },
  collaborates_with: {
    stroke: 'hsl(var(--muted-foreground))',
    strokeWidth: 2,
    strokeDasharray: '10 5',
    markerEnd: undefined,
  },
  supports: {
    stroke: 'hsl(var(--success))',
    strokeWidth: 2,
    strokeDasharray: '2 3',
    markerEnd: MarkerType.Arrow,
  },
  custom: {
    stroke: 'hsl(var(--primary))',
    strokeWidth: 2,
    strokeDasharray: 'none',
    markerEnd: MarkerType.Arrow,
  }
};

// Connection labels for display
const connectionLabels = {
  reports_to: 'Reports To',
  collaborates_with: 'Collaborates With',
  supports: 'Supports',
  custom: 'Custom'
};

export const TeamConnectionEdge = memo<EdgeProps<ConnectionEdgeData>>(({
  id,
  source,
  target,
  selected,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const connection = data.connection;
  const connectionType = connection.type;
  const style = connectionStyles[connectionType];
  const label = connection.label || connectionLabels[connectionType];
  
  // Extract callbacks from data
  const {
    onEdgeClick = () => {},
    onEdgeDelete = () => {},
    onEdgeEdit = () => {}
  } = data;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);
  
  // Use custom color if provided
  const strokeColor = connection.color || style.stroke;
  
  // Calculate path based on connection style preference
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgeClick(id);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgeDelete(id);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleTypeChange = (newType: ConnectionType) => {
    // Call the edit callback with the new type
    onEdgeEdit(id, newType);
    setShowDropdown(false);
  };
  
  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected || showDropdown ? style.strokeWidth + 2 : style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: selected || showDropdown ? 1 : 0.8,
        }}
        markerEnd={style.markerEnd ? `url(#${style.markerEnd})` : undefined}
        onClick={handleClick}
        className={cn(
          "cursor-pointer transition-all duration-200",
          (selected || showDropdown) && "drop-shadow-lg"
        )}
      />
      
      {/* Edge label and controls */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            zIndex: 1000
          }}
          className="pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="group flex items-center space-x-2">
            {/* Connection label - click to edit */}
            <Badge 
              variant={selected ? "default" : "secondary"}
              className={cn(
                "text-xs px-2 py-1 cursor-pointer transition-all duration-200",
                "bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700 shadow-md",
                selected && "shadow-lg scale-105 ring-2 ring-blue-500",
                showDropdown && "ring-2 ring-blue-500"
              )}
              onClick={handleEdit}
              title="Click to change connection type"
              style={{ zIndex: 1000 }}
            >
              {label}
            </Badge>
            
            {/* Controls - show dropdown arrow on hover, delete button on selection */}
            <div className="flex items-center space-x-1">
              {/* Edit dropdown - show on hover */}
              <div className={cn(
                "relative opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                showDropdown && "opacity-100"
              )} ref={dropdownRef}>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 bg-background/90 backdrop-blur-sm"
                  onClick={handleEdit}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                
                {/* Inline dropdown */}
                {showDropdown && (
                  <div 
                    className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl py-1 min-w-[160px] z-[9999]"
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', zIndex: 9999 }}
                  >
                    <button
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left",
                        connectionType === 'collaborates_with' && "bg-gray-100 dark:bg-gray-700"
                      )}
                      onClick={() => handleTypeChange('collaborates_with')}
                    >
                      Collaborates With
                    </button>
                    <button
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left",
                        connectionType === 'reports_to' && "bg-gray-100 dark:bg-gray-700"
                      )}
                      onClick={() => handleTypeChange('reports_to')}
                    >
                      Reports To
                    </button>
                    <button
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left",
                        connectionType === 'supports' && "bg-gray-100 dark:bg-gray-700"
                      )}
                      onClick={() => handleTypeChange('supports')}
                    >
                      Supports
                    </button>
                    <button
                      className={cn(
                        "flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left",
                        connectionType === 'custom' && "bg-gray-100 dark:bg-gray-700"
                      )}
                      onClick={() => handleTypeChange('custom')}
                    >
                      Custom
                    </button>
                  </div>
                )}
              </div>
              
              {/* Delete button - only show when selected */}
              {selected && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 bg-background/90 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleDelete}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
      
      {/* Selection indicator */}
      {selected && (
        <BaseEdge
          id={`${id}-selection`}
          path={edgePath}
          style={{
            stroke: 'hsl(var(--primary))',
            strokeWidth: style.strokeWidth + 3,
            strokeDasharray: 'none',
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
});

TeamConnectionEdge.displayName = 'TeamConnectionEdge';
