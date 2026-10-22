import React, { useState } from 'react';
import { 
  Brain, 
  ChevronDown,
  ChevronRight,
  Settings, 
  Wrench,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import type { AIState, ToolExecutionStatus } from './AIThinkingIndicator';

interface ProcessStep {
  state: AIState;
  label: string;
  duration?: number;
  details?: string;
  toolInfo?: ToolExecutionStatus;
  completed: boolean;
}

interface InlineThinkingIndicatorProps {
  isVisible: boolean;
  currentState?: AIState | null;
  currentTool?: ToolExecutionStatus | null;
  processSteps?: ProcessStep[];
  onComplete?: () => void;
  className?: string;
  agentName?: string;
  agentAvatarUrl?: string;
  isCompleted?: boolean;
}

const getStateIcon = (state: AIState, isActive: boolean = false) => {
  const iconClass = cn(
    "w-3 h-3", 
    isActive && "animate-pulse"
  );
  
  switch (state) {
    case 'thinking':
      return <Brain className={cn(iconClass, "text-blue-500")} />;
    case 'analyzing_tools':
      return <Settings className={cn(iconClass, "text-purple-500")} />;
    case 'executing_tool':
      return <Wrench className={cn(iconClass, "text-orange-500")} />;
    case 'processing_results':
      return <Loader2 className={cn(iconClass, "text-green-500", isActive && "animate-spin")} />;
    case 'generating_response':
      return <MessageSquare className={cn(iconClass, "text-indigo-500")} />;
    case 'completed':
      return <CheckCircle className={cn(iconClass, "text-green-600")} />;
    case 'failed':
      return <XCircle className={cn(iconClass, "text-red-500")} />;
    default:
      return <Sparkles className={cn(iconClass, "text-gray-400")} />;
  }
};

const getStateLabel = (state: AIState): string => {
  switch (state) {
    case 'thinking':
      return 'Thinking...';
    case 'analyzing_tools':
      return 'Analyzing tools...';
    case 'executing_tool':
      return 'Executing tool...';
    case 'processing_results':
      return 'Processing results...';
    case 'generating_response':
      return 'Generating response...';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Processing...';
  }
};

export function InlineThinkingIndicator({ 
  isVisible, 
  currentState, 
  currentTool,
  processSteps = [],
  onComplete,
  className,
  agentName = 'Agent',
  agentAvatarUrl,
  isCompleted = false
}: InlineThinkingIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Resolve media library references to signed URLs
  const resolvedAvatarUrl = useMediaLibraryUrl(agentAvatarUrl);

  if (!isVisible && processSteps.length === 0 && !isCompleted) return null;

  const hasCompletedSteps = processSteps.some(step => step.completed);
  const isProcessing = currentState && currentState !== 'completed' && currentState !== 'failed';
  const showAsCompleted = isCompleted || (!isProcessing && hasCompletedSteps);

  return (
    <div className={cn("flex items-start space-x-4 animate-fade-in", className)}>
      {/* Agent Avatar */}
      <div className="flex-shrink-0">
        {resolvedAvatarUrl ? (
          <img 
            src={resolvedAvatarUrl} 
            alt={agentName}
            className="w-8 h-8 rounded-full object-cover"
            onError={(e) => {
              console.warn('Thinking indicator avatar failed to load:', resolvedAvatarUrl);
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center"
          style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
        >
          <span className="text-white text-sm font-medium">
            {agentName.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Thinking Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <span className="text-sm font-medium text-foreground">{agentName}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Processing State */}
        {isProcessing && !showAsCompleted && (
          <div className="flex items-center space-x-3">
            {/* Animated thinking dots */}
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-muted-foreground/70 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-muted-foreground/70 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-muted-foreground/70 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            
            {/* Current state */}
            {currentState && (
              <div className="flex items-center space-x-2">
                {getStateIcon(currentState, true)}
                <span className="text-sm text-muted-foreground">
                  {getStateLabel(currentState)}
                </span>
                {currentTool && (
                  <span className="text-xs bg-muted px-2 py-1 rounded-full">
                    {currentTool.provider}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Completed State - "Thoughts" dropdown */}
        {showAsCompleted && (
          <div className="space-y-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <Brain className="w-4 h-4 text-blue-500" />
              <span className="font-medium">Thoughts</span>
              <span className="text-xs bg-muted px-2 py-1 rounded-full">
                {processSteps.filter(s => s.completed).length} steps
              </span>
            </button>

            {isExpanded && (
              <div className="bg-card/50 border border-border/30 rounded-2xl p-4 animate-fade-in">
                <div className="space-y-3">
                  {processSteps.length > 0 ? processSteps.map((step, index) => (
                    <div 
                      key={index}
                      className="flex items-start space-x-3 text-sm"
                    >
                      <div className="mt-0.5">
                        {step.completed ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          getStateIcon(step.state, false)
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{step.label}</div>
                        {step.details && (
                          <div className="text-muted-foreground mt-1 text-sm">{step.details}</div>
                        )}
                        {step.toolInfo && (
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="bg-muted px-2 py-1 rounded text-xs font-medium">
                              {step.toolInfo.toolName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              via {step.toolInfo.provider}
                            </span>
                          </div>
                        )}
                        {step.duration && (
                          <div className="text-muted-foreground mt-1 flex items-center space-x-1 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>{step.duration}ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-muted-foreground italic">
                      Thinking process details would appear here...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}