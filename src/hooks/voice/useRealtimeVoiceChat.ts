import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useVoiceActivityDetection } from './useVoiceActivityDetection';
import { usePushToTalk, type PTTKey } from './usePushToTalk';

export type RecordingMode = 'manual' | 'conversational' | 'push-to-talk';

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ToolExecution {
  name: string;
  status: 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

interface UseRealtimeVoiceChatOptions {
  conversationId: string;
  agentId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  recordingMode?: RecordingMode;
  pttKey?: PTTKey;
  onError?: (error: Error) => void;
  onTranscriptUpdate?: (transcript: TranscriptMessage[]) => void;
  onToolExecution?: (tool: ToolExecution) => void;
}

interface RealtimeVoiceChatState {
  isRecording: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  error: string | null;
  transcript: TranscriptMessage[];
  currentToolExecution: ToolExecution | null;
  audioLevel: number;
}

export function useRealtimeVoiceChat(options: UseRealtimeVoiceChatOptions) {
  const {
    conversationId,
    agentId,
    voice = 'alloy',
    recordingMode = 'manual',
    pttKey = 'Space',
    onError,
    onTranscriptUpdate,
    onToolExecution
  } = options;

  const [state, setState] = useState<RealtimeVoiceChatState>({
    isRecording: false,
    isProcessing: false,
    isPlaying: false,
    error: null,
    transcript: [],
    currentToolExecution: null,
    audioLevel: 0
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingAudioRef = useRef(false);
  const vadInitializedRef = useRef(false);

  // Forward declarations for hooks integration
  const startRecordingInternal = useRef<() => Promise<void>>(async () => {});
  const stopRecordingInternal = useRef<() => void>(() => {});

  // Voice Activity Detection (for conversational mode)
  const vad = useVoiceActivityDetection({
    enabled: recordingMode === 'conversational' && state.isRecording,
    silenceThreshold: 0.01,
    silenceDuration: 1500,
    minRecordingDuration: 1000,
    onSilenceDetected: () => {
      console.log('[RealtimeVoiceChat] VAD triggered auto-stop');
      stopRecordingInternal.current();
    },
    onVolumeChange: (volume) => {
      setState(prev => ({ ...prev, audioLevel: volume }));
    }
  });

  // Push-to-Talk (for PTT mode)
  const ptt = usePushToTalk({
    enabled: recordingMode === 'push-to-talk',
    key: pttKey,
    onPressStart: () => {
      console.log('[RealtimeVoiceChat] PTT activated, starting recording');
      if (state.isRecording) {
        console.warn('[RealtimeVoiceChat] Already recording, ignoring PTT start');
        return;
      }
      startRecordingInternal.current();
    },
    onPressEnd: () => {
      console.log('[RealtimeVoiceChat] PTT deactivated, stopping recording');
      if (!state.isRecording) {
        console.warn('[RealtimeVoiceChat] Not recording, ignoring PTT end');
        return;
      }
      stopRecordingInternal.current();
    }
  });

  /**
   * Play audio queue
   */
  const playNextAudioChunk = useCallback(() => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    const audioBlob = audioQueueRef.current.shift();
    if (!audioBlob) return;

    isPlayingAudioRef.current = true;
    setState(prev => ({ ...prev, isPlaying: true }));

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      isPlayingAudioRef.current = false;
      
      // Play next chunk if available
      if (audioQueueRef.current.length > 0) {
        playNextAudioChunk();
      } else {
        setState(prev => ({ ...prev, isPlaying: false }));
      }
    };

    audio.onerror = (err) => {
      console.error('[RealtimeVoiceChat] Audio playback error:', err);
      URL.revokeObjectURL(audioUrl);
      isPlayingAudioRef.current = false;
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    audio.play().catch(err => {
      console.error('[RealtimeVoiceChat] Failed to play audio:', err);
      isPlayingAudioRef.current = false;
      setState(prev => ({ ...prev, isPlaying: false }));
    });
  }, []);

  /**
   * Add transcript message
   */
  const addTranscriptMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const message: TranscriptMessage = {
      role,
      content,
      timestamp: new Date()
    };

    setState(prev => {
      const newTranscript = [...prev.transcript, message];
      onTranscriptUpdate?.(newTranscript);
      return { ...prev, transcript: newTranscript };
    });
  }, [onTranscriptUpdate]);

  /**
   * Update audio level visualization
   */
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && state.isRecording) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      
      setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state.isRecording]);

  /**
   * Start recording and streaming
   */
  const startRecording = useCallback(async () => {
    try {
      // Clean up any existing recording first
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log('[RealtimeVoiceChat] Stopping existing MediaRecorder');
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        console.log('[RealtimeVoiceChat] Stopping existing stream');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setState(prev => ({ ...prev, error: null, transcript: [] }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
          // Let browser choose best sample rate
        } 
      });
      
      streamRef.current = stream;

      // Set up audio visualization (for manual mode only, VAD handles its own)
      if (recordingMode !== 'conversational') {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }

      // Initialize VAD for conversational mode
      if (recordingMode === 'conversational' && !vadInitializedRef.current) {
        vad.initializeVAD(stream);
        vadInitializedRef.current = true;
      }

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('[RealtimeVoiceChat] Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('[RealtimeVoiceChat] MediaRecorder error:', event.error);
        setState(prev => ({ ...prev, error: 'Recording failed: ' + event.error?.message }));
      };

      mediaRecorder.onstop = async () => {
        console.log('[RealtimeVoiceChat] MediaRecorder onstop fired, total chunks:', audioChunksRef.current.length);
        console.trace('[RealtimeVoiceChat] onstop call stack');
        // Clean up VAD
        if (recordingMode === 'conversational') {
          vad.cleanup();
          vadInitializedRef.current = false;
        }

        // Stop audio visualization (manual mode)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Clean up audio context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Process the recorded audio
        await processAudioStream();
      };

      // Start recording (without timeslice - data will be available when stopped)
      console.log('[RealtimeVoiceChat] Starting MediaRecorder with mimeType:', mimeType);
      console.log('[RealtimeVoiceChat] Stream active:', stream.active, 'tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
      mediaRecorder.start(); // No timeslice - collect all data when stopped
      console.log('[RealtimeVoiceChat] MediaRecorder state after start:', mediaRecorder.state);
      setState(prev => ({ ...prev, isRecording: true, audioLevel: 0 }));
      
      // Start audio level monitoring (manual mode only)
      if (recordingMode !== 'conversational') {
        updateAudioLevel();
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to access microphone');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      console.error('[RealtimeVoiceChat] Error starting recording:', error);
    }
  }, [onError, updateAudioLevel, recordingMode, vad]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    console.log('[RealtimeVoiceChat] stopRecording called, isRecording:', state.isRecording, 'MediaRecorder state:', mediaRecorderRef.current?.state);
    console.trace('[RealtimeVoiceChat] stopRecording call stack');
    if (mediaRecorderRef.current && state.isRecording) {
      console.log('[RealtimeVoiceChat] Actually stopping MediaRecorder');
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));
    }
  }, [state.isRecording]);

  /**
   * Process recorded audio and stream to backend
   */
  const processAudioStream = useCallback(async () => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Create blob from recorded chunks
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });

      if (audioBlob.size < 1000) {
        throw new Error('Recording is too short. Hold the space bar for at least 1-2 seconds to record your message.');
      }

      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Connect to voice-chat-stream edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/voice-chat-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_input: base64Audio,
          conversation_id: conversationId,
          agent_id: agentId,
          voice: voice,
          format: 'webm'  // Browser MediaRecorder outputs audio/webm
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Voice chat failed: ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentAssistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const jsonStr = line.slice(6); // Remove 'data: ' prefix
            const event = JSON.parse(jsonStr);

            switch (event.event) {
              case 'conversation_created':
                // Update conversation ID if it was created on backend
                console.log('[RealtimeVoiceChat] Conversation created:', event.conversation_id);
                // Note: We don't store this in state since it's passed as prop
                // The parent component should handle conversation lifecycle
                break;

              case 'text':
                // Accumulate text transcript
                currentAssistantMessage += event.data;
                setState(prev => ({
                  ...prev,
                  transcript: prev.transcript.map((msg, idx) => 
                    idx === prev.transcript.length - 1 && msg.role === 'assistant'
                      ? { ...msg, content: currentAssistantMessage }
                      : msg
                  )
                }));
                break;

              case 'audio':
                // Decode and queue audio for playback
                const audioData = atob(event.data);
                const audioArray = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                  audioArray[i] = audioData.charCodeAt(i);
                }
                const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
                audioQueueRef.current.push(audioBlob);
                playNextAudioChunk();
                break;

              case 'tool_call':
                // Show tool execution
                const toolExec: ToolExecution = {
                  name: event.tool_name,
                  status: 'executing'
                };
                setState(prev => ({ ...prev, currentToolExecution: toolExec }));
                onToolExecution?.(toolExec);
                break;

              case 'tool_result':
                // Update tool execution status
                const toolResult: ToolExecution = {
                  name: event.tool_name,
                  status: event.result.success ? 'completed' : 'failed',
                  result: event.result.result,
                  error: event.result.error
                };
                setState(prev => ({ ...prev, currentToolExecution: toolResult }));
                onToolExecution?.(toolResult);
                
                // Clear after a delay
                setTimeout(() => {
                  setState(prev => ({ ...prev, currentToolExecution: null }));
                }, 3000);
                break;

              case 'complete':
                // Stream completed
                if (currentAssistantMessage) {
                  addTranscriptMessage('assistant', currentAssistantMessage);
                }
                setState(prev => ({ ...prev, isProcessing: false, currentToolExecution: null }));
                break;

              case 'error':
                throw new Error(event.error || 'Stream error');
            }

          } catch (parseError) {
            console.error('[RealtimeVoiceChat] Error parsing SSE event:', parseError);
          }
        }
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process audio');
      setState(prev => ({ ...prev, isProcessing: false, error: error.message }));
      onError?.(error);
      console.error('[RealtimeVoiceChat] Error processing audio:', error);
    } finally {
      // Clean up
      audioChunksRef.current = [];
    }
  }, [conversationId, agentId, voice, onError, addTranscriptMessage, onToolExecution, playNextAudioChunk]);

  /**
   * Stop all audio playback
   */
  const stopPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: [] }));
  }, []);

  /**
   * Check if browser supports real-time voice chat
   */
  const isSupported = useCallback(() => {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== 'undefined' &&
      typeof EventSource !== 'undefined'
    );
  }, []);

  // Wire up internal refs for VAD and PTT hooks
  useEffect(() => {
    startRecordingInternal.current = startRecording;
    stopRecordingInternal.current = stopRecording;
  }, [startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      // Clean up VAD
      if (vadInitializedRef.current) {
        vad.cleanup();
      }
    };
  }, [vad]);

  return {
    ...state,
    startRecording,
    stopRecording,
    stopPlayback,
    clearTranscript,
    isSupported: isSupported(),
    recordingMode,
    pttKey,
    isPTTPressed: ptt.isPressed
  };
}

