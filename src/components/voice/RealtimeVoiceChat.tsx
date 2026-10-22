import React, { useState } from 'react';
import { Mic, X, Loader2, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSimpleVoiceChat, type RecordingMode, type PTTKey } from '@/hooks/voice/useSimpleVoiceChat';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface RealtimeVoiceChatProps {
  conversationId?: string;
  agentId: string;
  agentName?: string;
  agentAvatar?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  className?: string;
  onClose?: () => void;
  onConversationCreated?: (conversationId: string) => void;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'echo', label: 'Echo', description: 'Warm and friendly' },
  { value: 'fable', label: 'Fable', description: 'Expressive' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'nova', label: 'Nova', description: 'Energetic' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and gentle' }
] as const;

const RECORDING_MODES: Array<{ value: RecordingMode; label: string; description: string }> = [
  { value: 'manual', label: 'Manual', description: 'Click to start/stop' },
  { value: 'push-to-talk', label: 'Push-to-Talk', description: 'Hold key to record' }
];

const PTT_KEYS: Array<{ value: PTTKey; label: string }> = [
  { value: 'Space', label: 'Space Bar' },
  { value: 'ControlLeft', label: 'Left Ctrl' },
  { value: 'ControlRight', label: 'Right Ctrl' }
];

/**
 * Real-time Voice Chat Component - SIMPLIFIED VERSION
 * Stripped down to just work like the transcription mode
 */
export function RealtimeVoiceChat({
  conversationId: initialConversationId,
  agentId,
  agentName = 'AI Assistant',
  agentAvatar,
  voice: initialVoice = 'alloy',
  className,
  onClose,
  onConversationCreated
}: RealtimeVoiceChatProps) {
  const [selectedVoice, setSelectedVoice] = useState<typeof initialVoice>(initialVoice);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('manual');
  const [pttKey, setPttKey] = useState<PTTKey>('Space');
  const [conversationId, setConversationId] = useState<string>(initialConversationId || '');
  
  // Create conversation ID on mount if none exists (just like text chat does)
  React.useEffect(() => {
    if (!conversationId && agentId) {
      const newConversationId = crypto.randomUUID();
      const newSessionId = crypto.randomUUID();
      
      console.log('[RealtimeVoiceChat] Creating new conversation for voice chat:', newConversationId);
      setConversationId(newConversationId);
      
      // Store in localStorage (same pattern as text chat)
      localStorage.setItem(`agent_${agentId}_conversation_id`, newConversationId);
      localStorage.setItem(`agent_${agentId}_session_id`, newSessionId);
      
      // Notify parent component
      if (onConversationCreated) {
        onConversationCreated(newConversationId);
      }
    }
  }, [conversationId, agentId, onConversationCreated]);
  
  const currentVoiceOption = VOICE_OPTIONS.find(v => v.value === selectedVoice) || VOICE_OPTIONS[0];
  const currentRecordingMode = RECORDING_MODES.find(m => m.value === recordingMode) || RECORDING_MODES[0];
  const currentPTTKey = PTT_KEYS.find(k => k.value === pttKey) || PTT_KEYS[0];

  const {
    isRecording,
    isProcessing,
    error,
    audioLevel,
    isPTTPressed,
    startRecording,
    stopRecording
  } = useSimpleVoiceChat({
    conversationId: conversationId || '',
    agentId,
    voice: selectedVoice,
    recordingMode,
    pttKey,
    onError: (err) => {
      toast.error(err.message || 'Voice chat error');
    },
    onComplete: (messageId) => {
      console.log('[RealtimeVoiceChat] Voice chat completed, message ID:', messageId);
      // Don't auto-close - let user close manually or start another recording
      // This way they can listen to the full audio response
    }
  });

  // Show error toast when error state changes
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  // Calculate orb animation scale based on audio level
  const orbScale = isRecording 
    ? 1 + (audioLevel * 0.3) 
    : isProcessing 
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
      <div className="flex flex-col items-center justify-between flex-1 w-full max-w-2xl px-8 py-12">
        {/* Spacer */}
        <div />

        {/* Agent Avatar with Status Animation */}
        <div className="flex flex-col items-center">
          <div className="relative mb-8">
            <div className="relative">
              <img 
                src={agentAvatar || '/default-avatar.png'} 
                alt={agentName}
                className={cn(
                  "w-48 h-48 rounded-full object-cover transition-all duration-300 shadow-2xl",
                  isRecording && 'shadow-blue-500/40 shadow-2xl',
                  isProcessing && 'shadow-purple-500/40 shadow-2xl'
                )}
                style={{
                  transform: `scale(${orbScale})`,
                  transition: 'transform 100ms ease-out'
                }}
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
                  disabled={isRecording || isProcessing}
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
                {!isRecording && !isProcessing && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">
                    {currentVoiceOption.label}
                  </div>
                )}
              </div>

              {/* Status Text (Thinking, Recording, etc.) */}
              {(isRecording || isProcessing) && (
                <p className="text-sm text-muted-foreground text-center">
                  {isRecording ? 'Listening...' : 'Thinking...'}
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Bottom Controls */}
        <div className="w-full flex flex-col items-center justify-center gap-4">
          {/* Status Text with Settings Icon */}
          {!isRecording && !isProcessing && (
            <div className="flex items-center justify-center gap-3">
              {/* Status Text */}
              <p className="text-sm text-muted-foreground text-center">
                {recordingMode === 'push-to-talk'
                  ? `Hold ${currentPTTKey.label} to talk`
                  : 'Click microphone to talk'}
              </p>

              {/* Settings Menu */}
              <Select
                value={recordingMode}
                onValueChange={(value: RecordingMode) => setRecordingMode(value)}
                disabled={isRecording || isProcessing}
              >
                <SelectTrigger className="w-8 h-8 rounded-full bg-transparent hover:bg-primary/10 border-0 focus:ring-0 flex items-center justify-center p-0 transition-colors">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Recording Mode</div>
                  {RECORDING_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{mode.label}</span>
                        <span className="text-xs text-muted-foreground">{mode.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                  
                  {/* PTT Key Selector (only show if push-to-talk mode) */}
                  {recordingMode === 'push-to-talk' && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">PTT Key</div>
                      {PTT_KEYS.map(key => (
                        <SelectItem 
                          key={key.value} 
                          value={key.value}
                          onClick={() => setPttKey(key.value)}
                        >
                          {key.label}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Microphone Button (only for manual mode) */}
          {recordingMode === 'manual' && (
            <button
              onClick={handleToggleRecording}
              disabled={isProcessing}
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-primary hover:bg-primary/90',
                isProcessing && 'opacity-50 cursor-not-allowed'
              )}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* PTT Indicator (for push-to-talk mode) */}
          {recordingMode === 'push-to-talk' && (
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg',
              isPTTPressed 
                ? 'bg-red-500 animate-pulse' 
                : 'bg-primary/50',
              isProcessing && 'opacity-50'
            )}>
              {isProcessing ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
