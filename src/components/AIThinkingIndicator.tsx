import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Loader2, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Clock,
  Sparkles,
  Wrench,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type AIState = 
  | 'thinking' 
  | 'analyzing_tools' 
  | 'executing_tool' 
  | 'processing_results' 
  | 'generating_response'
  | 'completed'
  | 'failed';

export interface ToolExecutionStatus {
  toolName: string;
  provider: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

interface AIThinkingIndicatorProps {
  state: AIState;
  currentTool?: ToolExecutionStatus;
  onComplete?: () => void;
  agentName?: string;
}

const getStateIcon = (state: AIState, isAnimated = false) => {
  const iconClass = isAnimated ? "w-4 h-4 animate-spin" : "w-4 h-4";
  
  switch (state) {
    case 'thinking':
      return <Brain className={`${iconClass} text-blue-500`} />;
    case 'analyzing_tools':
      return <Settings className={`${iconClass} text-purple-500`} />;
    case 'executing_tool':
      return <Wrench className={`${iconClass} text-orange-500`} />;
    case 'processing_results':
      return <Loader2 className={`${iconClass} text-green-500`} />;
    case 'generating_response':
      return <MessageSquare className={`${iconClass} text-indigo-500`} />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className={iconClass} />;
  }
};

const getStateMessage = (state: AIState, agentName?: string, toolName?: string) => {
  const agent = agentName || 'Agent';
  
  switch (state) {
    case 'thinking':
      return `${agent} is analyzing your request...`;
    case 'analyzing_tools':
      return `${agent} is checking available tools...`;
    case 'executing_tool':
      return toolName ? `${agent} is using ${toolName}...` : `${agent} is executing a tool...`;
    case 'processing_results':
      return `${agent} is processing the results...`;
    case 'generating_response':
      return `${agent} is preparing the response...`;
    case 'completed':
      return `${agent} has completed the task successfully`;
    case 'failed':
      return `${agent} encountered an error`;
    default:
      return `${agent} is working...`;
  }
};

const getStateColor = (state: AIState) => {
  switch (state) {
    case 'thinking':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'analyzing_tools':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'executing_tool':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'processing_results':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'generating_response':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatDuration = (startTime: Date, endTime?: Date) => {
  const end = endTime || new Date();
  const duration = end.getTime() - startTime.getTime();
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}m`;
};

export const AIThinkingIndicator: React.FC<AIThinkingIndicatorProps> = ({ 
  state, 
  currentTool,
  onComplete,
  agentName = 'Agent'
}) => {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [startTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(true);

  // Animation effect for active states
  useEffect(() => {
    const isActiveState = ['thinking', 'analyzing_tools', 'executing_tool', 'processing_results', 'generating_response'].includes(state);
    
    if (isActiveState) {
      const interval = setInterval(() => {
        setAnimationPhase(prev => (prev + 1) % 3);
      }, 600);
      return () => clearInterval(interval);
    }
  }, [state]);

  // Auto-hide completed/failed states after delay
  useEffect(() => {
    if (state === 'completed' || state === 'failed') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state, onComplete]);

  // Hide if not visible
  if (!isVisible) return null;

  const animationDots = '.'.repeat(animationPhase + 1);
  const isActiveState = !['completed', 'failed'].includes(state);

  return (
    <Card className="mb-3 border-l-4 border-l-blue-500 animate-in slide-in-from-left-5 duration-300">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {getStateIcon(state, isActiveState)}
              {isActiveState && (
                <div className="absolute -inset-1">
                  <div className="w-6 h-6 bg-blue-200 rounded-full animate-ping opacity-20"></div>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {getStateMessage(state, agentName, currentTool?.toolName)}
                  {isActiveState && animationDots}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getStateColor(state)}`}
                >
                  {state.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(startTime)}</span>
                
                {currentTool && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{currentTool.provider}</span>
                    {currentTool.startTime && (
                      <>
                        <span>•</span>
                        <span>Tool: {formatDuration(currentTool.startTime, currentTool.endTime)}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          {isActiveState && (
            <div className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Tool execution details */}
        {currentTool && state === 'executing_tool' && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="w-3 h-3 text-orange-500" />
              <span className="font-medium">{currentTool.toolName}</span>
              <span className="text-muted-foreground">via {currentTool.provider}</span>
            </div>
            {currentTool.status === 'executing' && (
              <div className="mt-1 bg-orange-50 rounded px-2 py-1 text-xs text-orange-700">
                🔄 Executing tool operation{animationDots}
              </div>
            )}
          </div>
        )}

        {/* Error details */}
        {state === 'failed' && currentTool?.error && (
          <div className="mt-3 pt-2 border-t border-red-100">
            <div className="bg-red-50 rounded px-2 py-1 text-xs text-red-700">
              ❌ {currentTool.error}
            </div>
          </div>
        )}

        {/* Success summary */}
        {state === 'completed' && (
          <div className="mt-3 pt-2 border-t border-green-100">
            <div className="bg-green-50 rounded px-2 py-1 text-xs text-green-700">
              ✅ Task completed successfully
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIThinkingIndicator; 