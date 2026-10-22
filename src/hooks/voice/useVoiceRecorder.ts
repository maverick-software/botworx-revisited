import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseVoiceRecorderOptions {
  onTranscriptionComplete?: (text: string, confidence?: number) => void;
  onError?: (error: Error) => void;
  maxDuration?: number; // Maximum recording duration in seconds
}

interface VoiceRecorderState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  audioLevel: number;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const {
    onTranscriptionComplete,
    onError,
    maxDuration = 60 // Default 60 seconds max
  } = options;

  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioLevel: 0
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Start recording audio from the microphone
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
          const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
          
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
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Process the recorded audio
        await processAudio();
      };

      // Start recording
      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true, audioLevel: 0 }));
      updateAudioLevel();

      // Set maximum duration timer
      if (maxDuration > 0) {
        maxDurationTimerRef.current = setTimeout(() => {
          stopRecording();
        }, maxDuration * 1000);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to access microphone');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      console.error('Error starting recording:', error);
    }
  }, [maxDuration, onError]);

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));

      // Clear max duration timer
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = null;
      }
    }
  }, [state.isRecording]);

  /**
   * Process recorded audio and send to Whisper API
   */
  const processAudio = useCallback(async () => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Create blob from recorded chunks
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });

      // Check if audio is too small (likely empty)
      if (audioBlob.size < 1000) {
        throw new Error('Recording is too short. Please try again.');
      }

      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Prepare form data for transcription
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      // Call our voice-transcribe edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/voice-transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      const transcription = result.text?.trim();
      const confidence = result.confidence;

      if (!transcription) {
        throw new Error('No speech detected. Please try again.');
      }

      // Call success callback
      onTranscriptionComplete?.(transcription, confidence);

      setState(prev => ({ ...prev, isProcessing: false, error: null }));

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process audio');
      setState(prev => ({ ...prev, isProcessing: false, error: error.message }));
      onError?.(error);
      console.error('Error processing audio:', error);
    } finally {
      // Clean up
      audioChunksRef.current = [];
    }
  }, [onTranscriptionComplete, onError]);

  /**
   * Cancel recording and clean up
   */
  const cancelRecording = useCallback(() => {
    // Stop media recorder without processing
    if (mediaRecorderRef.current && state.isRecording) {
      // Remove the onstop handler temporarily
      const originalOnStop = mediaRecorderRef.current.onstop;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = originalOnStop;

      // Clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = null;
      }

      audioChunksRef.current = [];
      setState(prev => ({ ...prev, isRecording: false, isProcessing: false, audioLevel: 0 }));
    }
  }, [state.isRecording]);

  /**
   * Check if browser supports audio recording
   */
  const isSupported = useCallback(() => {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported: isSupported()
  };
}

