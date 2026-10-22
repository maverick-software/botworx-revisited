import React, { useState } from 'react';
import { 
  Brain, 
  ChevronDown,
  ChevronUp,
  Settings, 
  Wrench,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Terminal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AIState, ToolExecutionStatus } from './AIThinkingIndicator';

interface DiscreetAIStatusIndicatorProps {
  aiState: AIState | null;
  currentTool?: ToolExecutionStatus | null;
  agentName?: string;
  isExecuting?: boolean;
  className?: string;
}

const getStateIcon = (state: AIState, size: 'sm' | 'xs' = 'xs') => {
  const iconClass = size === 'xs' ? "w-3 h-3" : "w-4 h-4";
  
  switch (state) {
    case 'thinking':
      return <Brain className={`${iconClass} text-blue-500 animate-pulse`} />;
    case 'analyzing_tools':
      return <Settings className={`${iconClass} text-purple-500 animate-spin`} />;
    case 'executing_tool':
      return <Wrench className={`${iconClass} text-orange-500 animate-bounce`} />;
    case 'processing_results':
      return <Loader2 className={`${iconClass} text-green-500 animate-spin`} />;
    case 'generating_response':
      return <MessageSquare className={`${iconClass} text-indigo-500 animate-pulse`} />;
    case 'completed':
      return <CheckCircle className={`${iconClass} text-green-600`} />;
    case 'failed':
      return <XCircle className={`${iconClass} text-red-600`} />;
    default:
      return <Clock className={iconClass} />;
  }
};

const getStateLabel = (_state: AIState) => 'Thinking';

const getStateMessage = (state: AIState, agentName?: string, toolName?: string) => {
  const agent = agentName || 'Agent';
  
  return `${agent} is thinking...`;
};

const formatDuration = (startTime: Date, endTime?: Date) => {
  const end = endTime || new Date();
  const duration = end.getTime() - startTime.getTime();
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}m`;
};

export const DiscreetAIStatusIndicator: React.FC<DiscreetAIStatusIndicatorProps> = ({ 
  aiState, 
  currentTool,
  agentName = 'Agent',
  isExecuting = false,
  className
}) => {
  const [isDetailedViewOpen, setIsDetailedViewOpen] = useState(false);
  const [startTime] = useState(new Date());

  // Don't show anything if no active state
  if (!aiState || aiState === 'completed') {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        AI Assistant
      </p>
    );
  }

  const isActiveState = ['thinking', 'analyzing_tools', 'executing_tool', 'processing_results', 'generating_response'].includes(aiState);

  return (
    <DropdownMenu open={isDetailedViewOpen} onOpenChange={setIsDetailedViewOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto p-0 font-normal text-sm text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
        >
          <div className="flex items-center gap-1.5">
            {getStateIcon(aiState)}
            <span>{getStateLabel(aiState)}</span>
            {isActiveState && (
              <div className="flex space-x-0.5">
                <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            )}
            <ChevronDown className="w-3 h-3 ml-1" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-0">
        <Card className="border-0 shadow-none">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Current Status */}
              <div className="flex items-center gap-2">
                {getStateIcon(aiState, 'sm')}
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {getStateMessage(aiState, agentName, currentTool?.toolName)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(startTime)}</span>
                    {currentTool && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{currentTool.provider}</span>
                      </>
                    )}
                  </div>
                </div>
                {isActiveState && (
                  <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                )}
              </div>

              {/* Tool Execution Details */}
              {currentTool && aiState === 'executing_tool' && (
                <>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Wrench className="w-3 h-3 text-orange-500" />
                      <span className="font-medium">{currentTool.toolName}</span>
                      <span className="text-muted-foreground">via {currentTool.provider}</span>
                    </div>
                    {currentTool.status === 'executing' && (
                      <div className="mt-2 bg-orange-50 dark:bg-orange-950/20 rounded px-2 py-1 text-xs text-orange-700 dark:text-orange-300">
                        🔄 Executing tool operation...
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Error Details */}
              {aiState === 'failed' && currentTool?.error && (
                <div className="border-t border-border pt-3">
                  <div className="bg-red-50 dark:bg-red-950/20 rounded px-2 py-1 text-xs text-red-700 dark:text-red-300">
                    ❌ {currentTool.error}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {aiState.replace('_', ' ')}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setIsDetailedViewOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DiscreetAIStatusIndicator;