import React, { useState, useEffect } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  Zap,
  Clock,
  Send,
  Database,
  Mail,
  MessageSquare,
  FileText,
  Search,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ToolExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

interface ToolExecutionStatusIndicatorProps {
  toolName: string;
  provider: string;
  status: 'initializing' | 'validating' | 'executing' | 'processing' | 'completed' | 'failed';
  steps?: ToolExecutionStep[];
  error?: string;
  startTime?: Date;
  className?: string;
}

const providerIcons: Record<string, React.ComponentType<any>> = {
  gmail: Mail,
  slack: MessageSquare,
  notion: FileText,
  search: Search,
  web: Globe,
  database: Database,
  default: Wrench
};

const statusMessages: Record<string, string> = {
  initializing: 'Preparing tool...',
  validating: 'Validating permissions...',
  executing: 'Executing action...',
  processing: 'Processing results...',
  completed: 'Completed successfully',
  failed: 'Execution failed'
};

export const ToolExecutionStatusIndicator: React.FC<ToolExecutionStatusIndicatorProps> = ({
  toolName,
  provider,
  status,
  steps = [],
  error,
  startTime,
  className
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);

  // Update elapsed time
  useEffect(() => {
    if (startTime && status !== 'completed' && status !== 'failed') {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime());
      }, 100);
      return () => clearInterval(interval);
    }
  }, [startTime, status]);

  // Calculate progress
  useEffect(() => {
    switch (status) {
      case 'initializing':
        setProgress(10);
        break;
      case 'validating':
        setProgress(30);
        break;
      case 'executing':
        setProgress(60);
        break;
      case 'processing':
        setProgress(85);
        break;
      case 'completed':
        setProgress(100);
        break;
      case 'failed':
        setProgress(0);
        break;
    }
  }, [status]);

  const ProviderIcon = providerIcons[provider] || providerIcons.default;

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
  };

  return (
    <Card className={cn("overflow-hidden transition-all duration-300", className)}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ProviderIcon className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">{toolName}</span>
            <Badge variant="outline" className="text-xs">
              {provider}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {elapsedTime > 0 && status !== 'completed' && status !== 'failed' && (
              <span className="text-xs text-muted-foreground">
                {formatTime(elapsedTime)}
              </span>
            )}
            {getStatusIcon()}
          </div>
        </div>

        {/* Status Message */}
        <div className={cn("text-sm mb-3", getStatusColor())}>
          {error || statusMessages[status]}
        </div>

        {/* Progress Bar */}
        {status !== 'failed' && (
          <Progress 
            value={progress} 
            className="h-1.5 mb-3"
          />
        )}

        {/* Steps (if provided) */}
        {steps.length > 0 && (
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center justify-between text-xs p-2 rounded",
                  step.status === 'running' && "bg-blue-500/10",
                  step.status === 'completed' && "bg-green-500/10",
                  step.status === 'failed' && "bg-red-500/10",
                  step.status === 'pending' && "opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  {step.status === 'running' && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {step.status === 'completed' && (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                  {step.status === 'pending' && (
                    <Clock className="w-3 h-3 text-muted-foreground" />
                  )}
                  {step.status === 'skipped' && (
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  )}
                  <span>{step.name}</span>
                </div>
                {step.endTime && step.startTime && (
                  <span className="text-muted-foreground">
                    {formatTime(step.endTime.getTime() - step.startTime.getTime())}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {status === 'failed' && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-muted-foreground">
                Check the execution logs for more details
              </span>
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs">
              <Zap className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">
                Tool executed successfully
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Animated Border Effect */}
      {status === 'executing' && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-gradient-x" />
      )}
    </Card>
  );
};

export default ToolExecutionStatusIndicator; 