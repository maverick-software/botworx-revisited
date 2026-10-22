/**
 * Simple Voice Chat Hook - COPIED FROM WORKING useVoiceRecorder
 * Stripped down version that just records and sends to voice-chat-stream
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type RecordingMode = 'manual' | 'push-to-talk';
export type PTTKey = 'Space' | 'ControlLeft' | 'ControlRight';

interface UseSimpleVoiceChatOptions {
  conversationId: string;
  agentId: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  recordingMode?: RecordingMode;
  pttKey?: PTTKey;
  onError?: (error: Error) => void;
  onComplete?: (messageId: string) => void;
}

interface VoiceChatState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  audioLevel: number;
  transcript: string;
}

export function useSimpleVoiceChat(options: UseSimpleVoiceChatOptions) {
  const {
    conversationId,
    agentId,
    voice = 'alloy',
    recordingMode = 'manual',
    pttKey = 'Space',
    onError,
    onComplete
  } = options;

  const [state, setState] = useState<VoiceChatState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioLevel: 0,
    transcript: ''
  });
  const [isPTTPressed, setIsPTTPressed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pttActiveRef = useRef(false);

  /**
   * Start recording - EXACT COPY FROM useVoiceRecorder.ts
   */
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;

      // Set up audio visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current && state.isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = Math.min(average / 128, 1);
          
          setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio visualization
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Clean up audio context
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Process the audio
        await processAudio();
      };

      // Start recording
      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true, audioLevel: 0 }));
      updateAudioLevel();

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start recording');
      setState(prev => ({ ...prev, error: err.message }));
      onError?.(err);
    }
  }, [state.isRecording, onError]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));
    }
  }, [state.isRecording]);

  /**
   * Process audio and send through proper pipeline:
   * 1. STT (Whisper) → transcribe to text
   * 2. Chat (/functions/v1/chat) → process through full chat pipeline
   * 3. TTS (OpenAI) → synthesize response to audio
   */
  const processAudio = useCallback(async () => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Create blob from recorded chunks
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });

      console.log('[SimpleVoiceChat] Audio blob size:', audioBlob.size, 'bytes, chunks:', audioChunksRef.current.length);

      if (audioBlob.size < 1000) {
        throw new Error('Recording is too short. Please hold the key for at least 1-2 seconds to record your message.');
      }

      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // ========== STEP 1: STT - Transcribe audio to text ==========
      console.log('[SimpleVoiceChat] Step 1: Transcribing audio...');
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/voice-transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const transcribeData = await transcribeResponse.json();
      const transcript = transcribeData.text; // voice-transcribe returns { text, language, duration, confidence }
      console.log('[SimpleVoiceChat] Transcription:', transcript);

      if (!transcript) {
        throw new Error('No transcription received from audio');
      }

      setState(prev => ({ ...prev, transcript }));

      // ========== STEP 2: Chat - Send through full chat pipeline ==========
      console.log('[SimpleVoiceChat] Step 2: Processing through chat pipeline...');
      
      // Get session_id from localStorage (same pattern as text chat)
      const session_id = localStorage.getItem(`agent_${agentId}_session_id`) || crypto.randomUUID();
      
      const chatResponse = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '2.0.0',
          message: {
            role: 'user',
            content: {
              type: 'text',
              text: transcript
            },
            context: {
              input_method: 'realtime_voice', // Tag it as voice input
              audio_stored: false
            }
          },
          context: {
            agent_id: agentId,
            conversation_id: conversationId,
            session_id: session_id
          },
          options: {
            context: {
              max_messages: 25
            }
          }
        })
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error('[SimpleVoiceChat] Chat error response:', chatResponse.status, errorText);
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Chat request failed: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      console.log('[SimpleVoiceChat] Chat response data:', chatData);
      const assistantReply = chatData?.data?.message?.content?.text || chatData?.message;
      
      console.log('[SimpleVoiceChat] Chat response:', assistantReply);

      if (typeof assistantReply !== 'string') {
        throw new Error('Received invalid response from chat service');
      }

      setState(prev => ({ ...prev, transcript: assistantReply }));

      // ========== STEP 3: TTS - Synthesize response to audio ==========
      console.log('[SimpleVoiceChat] Step 3: Synthesizing audio response...');
      
      const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/voice-synthesize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: assistantReply,
          voice: voice,
          agent_id: agentId
        })
      });

      if (!ttsResponse.ok) {
        const ttsErrorText = await ttsResponse.text();
        console.warn('[SimpleVoiceChat] TTS failed:', ttsResponse.status, ttsErrorText);
      } else {
        // voice-synthesize returns raw audio data, not JSON
        const audioBlob = await ttsResponse.blob();
        console.log('[SimpleVoiceChat] TTS audio received:', audioBlob.size, 'bytes');
        
        if (audioBlob.size > 0) {
          console.log('[SimpleVoiceChat] Auto-playing audio response...');
          try {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              console.log('[SimpleVoiceChat] Audio playback finished');
            };
            
            audio.onerror = (e) => {
              console.error('[SimpleVoiceChat] Audio error event:', e);
            };
            
            await audio.play();
            console.log('[SimpleVoiceChat] Audio playback started successfully');
          } catch (playError) {
            console.error('[SimpleVoiceChat] Audio playback failed:', playError);
          }
        } else {
          console.warn('[SimpleVoiceChat] No audio data in TTS response');
        }
      }

      setState(prev => ({ ...prev, isProcessing: false }));

      // Notify parent - use conversation_id since messages are saved in chat pipeline
      if (onComplete) {
        onComplete(conversationId);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to process audio');
      setState(prev => ({ ...prev, error: err.message, isProcessing: false }));
      onError?.(err);
    }
  }, [conversationId, agentId, voice, onError, onComplete]);

  // PTT keyboard event handlers
  useEffect(() => {
    if (recordingMode !== 'push-to-talk') return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === pttKey && !pttActiveRef.current && !state.isProcessing) {
        e.preventDefault();
        pttActiveRef.current = true;
        setIsPTTPressed(true);
        console.log('[SimpleVoiceChat] PTT key pressed, starting recording');
        await startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === pttKey && pttActiveRef.current) {
        e.preventDefault();
        pttActiveRef.current = false;
        setIsPTTPressed(false);
        console.log('[SimpleVoiceChat] PTT key released, stopping recording');
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recordingMode, pttKey, startRecording, stopRecording, state.isProcessing]);

  return {
    ...state,
    isPTTPressed,
    recordingMode,
    pttKey,
    startRecording,
    stopRecording
  };
}

