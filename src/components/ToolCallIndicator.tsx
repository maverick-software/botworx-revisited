import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  AlertCircle,
  Play,
  Pause
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ToolCallDetails {
  tool_name: string;
  tool_provider: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  execution_time_ms?: number;
  error_message?: string;
  result?: any;
  created_at: string;
}

interface ToolCallIndicatorProps {
  toolCall: ToolCallDetails;
  compact?: boolean;
}

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'gmail':
      return <Mail className="w-4 h-4" />;
    case 'slack':
      return <Settings className="w-4 h-4" />;
    default:
      return <Settings className="w-4 h-4" />;
  }
};

const getStatusIcon = (status: string, isAnimated = false) => {
  const iconClass = isAnimated ? "w-4 h-4 animate-spin" : "w-4 h-4";
  
  switch (status) {
    case 'pending':
      return <Clock className={iconClass} />;
    case 'executing':
      return <Loader2 className={iconClass} />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'executing':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatToolName = (toolName: string) => {
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatExecutionTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({ 
  toolCall, 
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Animation effect for executing state
  useEffect(() => {
    if (toolCall.status === 'executing') {
      const interval = setInterval(() => {
        setAnimationPhase(prev => (prev + 1) % 3);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [toolCall.status]);

  const animationDots = '.'.repeat(animationPhase + 1);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs">
        {getProviderIcon(toolCall.tool_provider)}
        <span>{formatToolName(toolCall.tool_name)}</span>
        {getStatusIcon(toolCall.status, toolCall.status === 'executing')}
      </div>
    );
  }

  return (
    <Card className="mb-2 border-l-4 border-l-blue-500">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getProviderIcon(toolCall.tool_provider)}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {formatToolName(toolCall.tool_name)}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getStatusColor(toolCall.status)}`}
                >
                  {toolCall.status === 'executing' ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Executing{animationDots}
                    </span>
                  ) : (
                    toolCall.status
                  )}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="capitalize">{toolCall.tool_provider}</span>
                {toolCall.execution_time_ms && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{formatExecutionTime(toolCall.execution_time_ms)}</span>
                  </>
                )}
                <span className="mx-1">•</span>
                <span>{new Date(toolCall.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(toolCall.status, toolCall.status === 'executing')}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {/* Parameters */}
            {Object.keys(toolCall.parameters).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Parameters:</h4>
                <div className="bg-gray-50 rounded p-2 text-xs font-mono">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(toolCall.parameters, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Result */}
            {toolCall.result && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Result:</h4>
                <div className="bg-green-50 rounded p-2 text-xs font-mono">
                  <pre className="whitespace-pre-wrap">
                    {typeof toolCall.result === 'object' 
                      ? JSON.stringify(toolCall.result, null, 2)
                      : toolCall.result
                    }
                  </pre>
                </div>
              </div>
            )}

            {/* Error */}
            {toolCall.error_message && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">Error:</h4>
                <div className="bg-red-50 rounded p-2 text-xs text-red-700">
                  {toolCall.error_message}
                </div>
              </div>
            )}

            {/* Execution Status */}
            {toolCall.status === 'executing' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Tool is currently executing{animationDots}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ToolCallIndicator; 