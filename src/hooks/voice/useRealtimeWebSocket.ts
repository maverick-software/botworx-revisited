import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UseRealtimeWebSocketOptions {
  conversationId?: string;
  agentId: string;
  voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
  onError?: (error: Error) => void;
}

interface RealtimeState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  error: string | null;
  transcript: TranscriptMessage[];
  conversationId: string | null;
}

export function useRealtimeWebSocket(options: UseRealtimeWebSocketOptions) {
  const {
    conversationId: initialConversationId,
    agentId,
    voice = 'alloy',
    onError
  } = options;

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    error: null,
    transcript: [],
    conversationId: initialConversationId || null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);

  /**
   * Connect to the Realtime WebSocket
   */
  const connect = useCallback(async () => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Build WebSocket URL for DigitalOcean server
      const wsBaseUrl = import.meta.env.VITE_VOICE_WEBSOCKET_URL || 'wss://voice.agentopia.ai';
      const params = new URLSearchParams({
        token: session.access_token,
        agent_id: agentId,
        voice: voice,
        ...(state.conversationId ? { conversation_id: state.conversationId } : {})
      });

      const url = `${wsBaseUrl}?${params}`;

      console.log('[RealtimeWebSocket] Connecting to DigitalOcean WebSocket server:', url);

      // Create WebSocket connection
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[RealtimeWebSocket] Connected');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerEvent(data);
        } catch (err) {
          console.error('[RealtimeWebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[RealtimeWebSocket] Error:', error);
        setState(prev => ({ ...prev, error: 'Connection error', isConnected: false }));
        onError?.(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        console.log('[RealtimeWebSocket] Disconnected');
        setState(prev => ({ ...prev, isConnected: false }));
        cleanup();
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      console.error('[RealtimeWebSocket] Connection error:', error);
    }
  }, [agentId, voice, state.conversationId, onError]);

  /**
   * Handle server events from OpenAI
   */
  const handleServerEvent = useCallback((event: any) => {
    console.log('[RealtimeWebSocket] Server event:', event.type);

    switch (event.type) {
      case 'conversation.created':
        // New conversation created by server
        console.log('[RealtimeWebSocket] Conversation created:', event.conversation_id);
        setState(prev => ({ ...prev, conversationId: event.conversation_id }));
        break;

      case 'session.created':
      case 'session.updated':
        console.log('[RealtimeWebSocket] Session ready');
        break;

      case 'input_audio_buffer.speech_started':
        setState(prev => ({ ...prev, isRecording: true }));
        break;

      case 'input_audio_buffer.speech_stopped':
        setState(prev => ({ ...prev, isRecording: false }));
        break;

      case 'response.audio.delta':
        // Audio is being played (we'd handle PCM audio here)
        setState(prev => ({ ...prev, isPlaying: true }));
        playAudioChunk(event.delta);
        break;

      case 'response.audio.done':
        setState(prev => ({ ...prev, isPlaying: false }));
        break;

      case 'response.audio_transcript.delta':
        // Append assistant transcript
        addTranscriptDelta('assistant', event.delta);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcription
        addTranscriptMessage('user', event.transcript);
        break;

      case 'error':
        console.error('[RealtimeWebSocket] Server error:', event.error);
        setState(prev => ({ ...prev, error: event.error }));
        break;
    }
  }, []);

  /**
   * Add transcript message
   */
  const addTranscriptMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setState(prev => ({
      ...prev,
      transcript: [...prev.transcript, {
        role,
        content,
        timestamp: new Date()
      }]
    }));
  }, []);

  /**
   * Add transcript delta (for streaming text)
   */
  const addTranscriptDelta = useCallback((role: 'user' | 'assistant', delta: string) => {
    setState(prev => {
      const transcript = [...prev.transcript];
      const lastMessage = transcript[transcript.length - 1];
      
      if (lastMessage && lastMessage.role === role) {
        // Append to existing message
        lastMessage.content += delta;
      } else {
        // Create new message
        transcript.push({
          role,
          content: delta,
          timestamp: new Date()
        });
      }
      
      return { ...prev, transcript };
    });
  }, []);

  /**
   * Play PCM16 audio chunk
   */
  const playAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      // Decode base64 PCM16 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // Create audio buffer and play
      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();

    } catch (err) {
      console.error('[RealtimeWebSocket] Failed to play audio:', err);
    }
  }, []);

  /**
   * Start streaming microphone audio
   */
  const startStreaming = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;

      // Create AudioContext for processing
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create ScriptProcessorNode for PCM conversion
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        // Send to server
        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }));
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      console.log('[RealtimeWebSocket] Started streaming audio');

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to access microphone');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      console.error('[RealtimeWebSocket] Microphone error:', error);
    }
  }, [onError]);

  /**
   * Stop streaming
   */
  const stopStreaming = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    console.log('[RealtimeWebSocket] Stopped streaming');
  }, []);

  /**
   * Disconnect and cleanup
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopStreaming();
    cleanup();
  }, [stopStreaming]);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioWorkletRef.current) {
      audioWorkletRef.current.disconnect();
      audioWorkletRef.current = null;
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    isSupported: () => {
      return (
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.getUserMedia !== 'undefined' &&
        typeof WebSocket !== 'undefined' &&
        typeof AudioContext !== 'undefined'
      );
    }
  };
}

