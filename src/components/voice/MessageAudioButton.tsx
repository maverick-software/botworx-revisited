import React from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { useVoicePlayback } from '@/hooks/voice/useVoicePlayback';
import { toast } from 'react-hot-toast';

interface MessageAudioButtonProps {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
  className?: string;
}

export function MessageAudioButton({ text, voice = 'alloy', speed = 1.0, className }: MessageAudioButtonProps) {
  const {
    isPlaying,
    isLoading,
    error,
    play,
    stop,
    isSupported
  } = useVoicePlayback({
    voice,
    speed,
    onError: (err) => {
      toast.error(err.message || 'Failed to play audio');
    }
  });

  // Show error toast when error state changes
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (!isSupported) {
    return null; // Don't show button if browser doesn't support audio
  }

  const handleClick = () => {
    if (isPlaying) {
      stop();
    } else if (!isLoading) {
      play(text);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || !text}
      className={`text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors ${className}`}
      title={isPlaying ? 'Stop audio' : 'Play as audio'}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isPlaying ? (
        <Square className="w-5 h-5" />
      ) : (
        <Volume2 className="w-5 h-5" />
      )}
    </button>
  );
}

