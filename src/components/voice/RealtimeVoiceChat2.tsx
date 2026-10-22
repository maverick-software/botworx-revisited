import React, { useState, useEffect } from 'react';
import { Mic, X, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeWebSocket } from '@/hooks/voice/useRealtimeWebSocket';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface RealtimeVoiceChatProps {
  conversationId?: string;
  agentId: string;
  voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
  className?: string;
  onClose?: () => void;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Balanced and neutral' },
  { value: 'ash', label: 'Ash', description: 'Clear and articulate' },
  { value: 'ballad', label: 'Ballad', description: 'Smooth and melodic' },
  { value: 'coral', label: 'Coral', description: 'Warm and inviting' },
  { value: 'echo', label: 'Echo', description: 'Confident and optimistic' },
  { value: 'sage', label: 'Sage', description: 'Wise and thoughtful' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright and inquisitive' },
  { value: 'verse', label: 'Verse', description: 'Expressive and dynamic' },
] as const;

export function RealtimeVoiceChat2({ 
  conversationId: initialConversationId, 
  agentId, 
  voice: initialVoice = 'alloy',
  className,
  onClose
}: RealtimeVoiceChatProps) {
  const [selectedVoice, setSelectedVoice] = useState<typeof initialVoice>(initialVoice);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const currentVoiceOption = VOICE_OPTIONS.find(v => v.value === selectedVoice) || VOICE_OPTIONS[0];

  const {
    isConnected,
    isRecording,
    isPlaying,
    error,
    transcript,
    conversationId,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    isSupported
  } = useRealtimeWebSocket({
    conversationId: initialConversationId,
    agentId,
    voice: selectedVoice,
    onError: (err) => {
      toast.error(err.message || 'Voice chat error');
    }
  });

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, []);

  // Show error toast when error state changes
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (!isSupported()) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <div className="text-muted-foreground">
          <p className="font-medium mb-2">Real-time voice chat not supported</p>
          <p className="text-sm">Your browser doesn't support the required features for real-time voice chat.</p>
        </div>
      </div>
    );
  }

  const handleToggleMicrophone = async () => {
    if (isStreaming) {
      stopStreaming();
      setIsStreaming(false);
    } else {
      await startStreaming();
      setIsStreaming(true);
    }
  };

  // Calculate orb animation scale based on state
  const orbScale = isRecording 
    ? 1.2
    : isPlaying 
    ? 1.1 
    : 1;

  return (
    <div className={cn('relative flex flex-col items-center justify-center h-full bg-gradient-to-b from-background to-background/95', className)}>
      {/* Close Button - Top Right */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-50"
          title="Close voice chat"
        >
          <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl px-8">
        {/* Animated Orb */}
        <div className="relative mb-12">
          <div 
            className={cn(
              'w-48 h-48 rounded-full transition-all duration-300',
              'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600',
              'shadow-2xl shadow-blue-500/50',
              isRecording && 'shadow-blue-500/80 animate-pulse',
              isPlaying && 'shadow-blue-400/60'
            )}
            style={{
              transform: `scale(${orbScale})`,
              transition: 'transform 100ms ease-out'
            }}
          >
            {/* Inner glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-white/20 to-transparent" />
          </div>
          
          {/* Pulse rings when active */}
          {(isRecording || isPlaying) && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" 
                   style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/20 animate-ping" 
                   style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
            </>
          )}
        </div>

        {/* Transcript Display */}
        {transcript.length > 0 && (
          <div className="w-full max-h-48 overflow-y-auto mb-8 space-y-3 px-4">
            {transcript.slice(-3).map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'text-center',
                  msg.role === 'user' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <p className={cn(
                  'text-sm',
                  msg.role === 'user' ? 'font-medium' : 'font-normal'
                )}>
                  {msg.role === 'user' ? 'You: ' : 'AI: '}
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Voice Selector */}
        <div className="mb-8 flex items-center justify-center gap-4">
          <Select
            value={selectedVoice}
            onValueChange={(value: typeof initialVoice) => setSelectedVoice(value)}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-[120px] h-8 text-sm bg-transparent border-0 focus:ring-0">
              <SelectValue>{currentVoiceOption.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map(voice => (
                <SelectItem key={voice.value} value={voice.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{voice.label}</span>
                    <span className="text-xs text-muted-foreground">{voice.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full flex items-center justify-center gap-4 pb-8">
        {/* Connection Status */}
        {!isConnected && (
          <div className="text-sm text-muted-foreground">
            Connecting...
          </div>
        )}

        {/* Microphone Button */}
        <button
          onClick={handleToggleMicrophone}
          disabled={!isConnected}
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
            'hover:scale-110 active:scale-95',
            isStreaming 
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : !isConnected
              ? 'bg-muted cursor-not-allowed'
              : 'bg-white hover:bg-white/90 text-black'
          )}
          title={isStreaming ? 'Stop microphone' : 'Start microphone'}
        >
          {!isConnected ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Status Text */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center">
        <div className="text-center">
          {!isConnected && (
            <p className="text-sm text-muted-foreground">
              Connecting to voice service...
            </p>
          )}
          {isRecording && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Listening...
            </p>
          )}
          {isPlaying && (
            <p className="text-sm text-muted-foreground">
              Speaking...
            </p>
          )}
          {isConnected && !isStreaming && !isRecording && !isPlaying && (
            <p className="text-xs text-muted-foreground/60">
              Click the microphone to start talking
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

