import React from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/voice/useVoiceRecorder';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({ onTranscription, disabled, className }: VoiceInputButtonProps) {
  const {
    isRecording,
    isProcessing,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported
  } = useVoiceRecorder({
    onTranscriptionComplete: (text, confidence) => {
      onTranscription(text);
      if (confidence && confidence < 0.8) {
        toast('Low confidence transcription. Please verify the text.', {
          icon: '⚠️',
          duration: 3000
        });
      } else {
        toast.success('Transcribed successfully!');
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to record audio');
    },
    maxDuration: 60 // 60 seconds max
  });

  // Show error toast when error state changes
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (!isSupported) {
    return null; // Don't show button if browser doesn't support recording
  }

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing && !disabled) {
      startRecording();
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelRecording();
    toast('Recording cancelled', { icon: '🚫' });
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={cn(
          'relative transition-all duration-200 rounded-full',
          isRecording && 'bg-red-600 hover:bg-red-700 text-white'
        )}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square className="h-4 w-4 fill-white" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Recording indicator and cancel button */}
      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-xs font-medium">Recording...</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-6 px-2 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Transcribing...
          </span>
        </div>
      )}
    </div>
  );
}

