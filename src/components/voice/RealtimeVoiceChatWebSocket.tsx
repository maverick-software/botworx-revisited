/**
 * Real-time Voice Chat Component using WebSocket
 * 
 * This component connects to the DigitalOcean WebSocket server
 * for true real-time voice chat with OpenAI Realtime API
 */

import React, { useState, useEffect } from 'react';
import { Mic, X, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeWebSocket } from '@/hooks/voice/useRealtimeWebSocket';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface RealtimeVoiceChatWebSocketProps {
  conversationId?: string;
  agentId: string;
  agentName?: string;
  agentAvatar?: string;
  voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
  className?: string;
  onClose?: () => void;
  onConversationCreated?: (conversationId: string) => void;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'ash', label: 'Ash', description: 'Warm and friendly' },
  { value: 'ballad', label: 'Ballad', description: 'Expressive and dynamic' },
  { value: 'coral', label: 'Coral', description: 'Warm and engaging' },
  { value: 'echo', label: 'Echo', description: 'Smooth and resonant' },
  { value: 'sage', label: 'Sage', description: 'Calm and wise' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and gentle' },
  { value: 'verse', label: 'Verse', description: 'Clear and articulate' }
] as const;

export function RealtimeVoiceChatWebSocket({
  conversationId: initialConversationId,
  agentId,
  agentName = 'AI Assistant',
  agentAvatar,
  voice: initialVoice = 'alloy',
  className,
  onClose,
  onConversationCreated
}: RealtimeVoiceChatWebSocketProps) {
  const [selectedVoice, setSelectedVoice] = useState<typeof initialVoice>(initialVoice);
  const [showTranscript, setShowTranscript] = useState(true);

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

  // Check browser support on mount
  useEffect(() => {
    if (!isSupported()) {
      toast.error('Your browser does not support real-time voice chat');
    }
  }, [isSupported]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Notify parent when conversation is created
  useEffect(() => {
    if (conversationId && conversationId !== initialConversationId) {
      console.log('[RealtimeVoiceChatWebSocket] Notifying parent of new conversation:', conversationId);
      onConversationCreated?.(conversationId);
    }
  }, [conversationId, initialConversationId, onConversationCreated]);

  // Show error toast when error state changes
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopStreaming();
    } else if (isConnected) {
      startStreaming();
    } else {
      toast.error('Not connected to server');
    }
  };

  const currentVoiceOption = VOICE_OPTIONS.find(v => v.value === selectedVoice) || VOICE_OPTIONS[0];

  // Get last few transcript messages for display
  const recentTranscript = transcript.slice(-3);

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
      <div className="flex flex-col items-center justify-between flex-1 w-full max-w-2xl px-8 py-12">
        {/* Connection Status Banner */}
        {!isConnected && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting to server...
            </p>
          </div>
        )}

        {/* Agent Avatar with Status Animation */}
        <div className="flex flex-col items-center flex-1 justify-center">
          <div className="relative mb-8">
            <div className="relative">
              <img 
                src={agentAvatar || '/default-avatar.png'} 
                alt={agentName}
                className={cn(
                  "w-48 h-48 rounded-full object-cover transition-all duration-300 shadow-2xl",
                  isRecording && 'shadow-blue-500/40 shadow-2xl scale-110',
                  isPlaying && 'shadow-purple-500/40 shadow-2xl scale-105'
                )}
              />
              
              {/* Pulse rings when recording */}
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full shadow-lg shadow-blue-400/30 animate-ping" 
                       style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-0 rounded-full shadow-lg shadow-blue-400/20 animate-ping" 
                       style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
                </>
              )}

              {/* Pulse rings when AI is speaking */}
              {isPlaying && (
                <>
                  <div className="absolute inset-0 rounded-full shadow-lg shadow-purple-400/30 animate-ping" 
                       style={{ animationDuration: '2s' }} />
                </>
              )}
            </div>
          </div>
          
          {/* Agent Name Below Avatar */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-foreground mb-3">{agentName}</h2>
            
            {/* Voice Mode Status with Voice Tag */}
            <div className="flex flex-col items-center gap-2">
              {/* Voice Mode Selector */}
              <div className="flex items-center justify-center gap-2">
                <Select
                  value={selectedVoice}
                  onValueChange={(value: typeof initialVoice) => setSelectedVoice(value)}
                  disabled={isRecording || isPlaying || !isConnected}
                >
                  <SelectTrigger className="text-sm text-muted-foreground hover:text-foreground transition-colors border-0 bg-transparent p-0 h-auto focus:ring-0 gap-[3px] justify-start w-auto">
                    <SelectValue>Voice Mode</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-0 rounded-xl shadow-2xl">
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
                
                {/* Voice Name Tag */}
                {!isRecording && !isPlaying && isConnected && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
                    {currentVoiceOption.label}
                  </div>
                )}
              </div>

              {/* Status Text (Thinking, Recording, etc.) */}
              {isRecording && (
                <p className="text-sm text-blue-500 text-center animate-pulse">
                  Listening...
                </p>
              )}
              {isPlaying && (
                <p className="text-sm text-purple-500 text-center animate-pulse">
                  Speaking...
                </p>
              )}
            </div>
          </div>

          {/* Transcript Display (optional) */}
          {showTranscript && recentTranscript.length > 0 && (
            <div className="w-full max-w-md mt-6 space-y-2">
              {recentTranscript.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    msg.role === 'user' 
                      ? 'bg-primary/10 text-foreground' 
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <div className="font-medium text-xs mb-1">
                    {msg.role === 'user' ? 'You' : agentName}
                  </div>
                  <div>{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="w-full flex flex-col items-center justify-center gap-4">
          {/* Status Text */}
          {!isRecording && !isPlaying && isConnected && (
            <p className="text-sm text-muted-foreground text-center">
              Click microphone to talk
            </p>
          )}

          {/* Microphone Button */}
          <button
            onClick={handleToggleRecording}
            disabled={!isConnected || isPlaying}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-primary hover:bg-primary/90',
              (!isConnected || isPlaying) && 'opacity-50 cursor-not-allowed'
            )}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {!isConnected ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Connection Info */}
          {isConnected && (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

