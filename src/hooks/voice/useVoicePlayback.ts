import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface UseVoicePlaybackOptions {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
  voice?: string; // OpenAI TTS voice: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  speed?: number; // 0.25 to 4.0
}

interface VoicePlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  progress: number; // 0-1
  duration: number; // in seconds
}

export function useVoicePlayback(options: UseVoicePlaybackOptions = {}) {
  const {
    onPlaybackStart,
    onPlaybackEnd,
    onError,
    voice = 'alloy',
    speed = 1.0
  } = options;

  const [state, setState] = useState<VoicePlaybackState>({
    isPlaying: false,
    isLoading: false,
    error: null,
    progress: 0,
    duration: 0
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clean up audio resources
   */
  const cleanup = useCallback(() => {
    // Stop playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    // Clear progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Revoke object URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  /**
   * Update progress while playing
   */
  const startProgressTracking = useCallback(() => {
    progressIntervalRef.current = setInterval(() => {
      if (audioRef.current) {
        const progress = audioRef.current.currentTime / audioRef.current.duration;
        setState(prev => ({ ...prev, progress: isNaN(progress) ? 0 : progress }));
      }
    }, 100); // Update every 100ms
  }, []);

  /**
   * Stop progress tracking
   */
  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  /**
   * Synthesize text to speech and play
   */
  const play = useCallback(async (text: string) => {
    if (!text || text.trim().length === 0) {
      const error = new Error('No text provided for speech synthesis');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call voice-synthesize edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/voice-synthesize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice,
          speed
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Speech synthesis failed: ${response.status}`);
      }

      // Get audio blob
      const audioBlob = await response.blob();
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio from server');
      }

      // Create audio element
      cleanup(); // Clean up any previous audio
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Set up event handlers
      audio.onloadedmetadata = () => {
        setState(prev => ({ 
          ...prev, 
          duration: audio.duration,
          isLoading: false,
          isPlaying: true 
        }));
        onPlaybackStart?.();
        startProgressTracking();
      };

      audio.onended = () => {
        stopProgressTracking();
        setState(prev => ({ 
          ...prev, 
          isPlaying: false, 
          progress: 1 
        }));
        onPlaybackEnd?.();
        cleanup();
      };

      audio.onerror = () => {
        const error = new Error('Audio playback failed');
        stopProgressTracking();
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          isPlaying: false,
          error: error.message 
        }));
        onError?.(error);
        cleanup();
      };

      // Start playback
      await audio.play();

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to synthesize speech');
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        isPlaying: false,
        error: error.message 
      }));
      onError?.(error);
      cleanup();
      console.error('Error in voice playback:', error);
    }
  }, [voice, speed, onPlaybackStart, onPlaybackEnd, onError, cleanup, startProgressTracking, stopProgressTracking]);

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      stopProgressTracking();
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [stopProgressTracking]);

  /**
   * Resume playback
   */
  const resume = useCallback(async () => {
    if (audioRef.current && audioRef.current.paused) {
      try {
        await audioRef.current.play();
        startProgressTracking();
        setState(prev => ({ ...prev, isPlaying: true }));
        onPlaybackStart?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to resume playback');
        setState(prev => ({ ...prev, error: error.message }));
        onError?.(error);
      }
    }
  }, [startProgressTracking, onPlaybackStart, onError]);

  /**
   * Stop playback
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      stopProgressTracking();
      setState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        progress: 0 
      }));
      cleanup();
    }
  }, [stopProgressTracking, cleanup]);

  /**
   * Seek to position (0-1)
   */
  const seek = useCallback((position: number) => {
    if (audioRef.current) {
      const clampedPosition = Math.max(0, Math.min(1, position));
      audioRef.current.currentTime = audioRef.current.duration * clampedPosition;
      setState(prev => ({ ...prev, progress: clampedPosition }));
    }
  }, []);

  /**
   * Check if browser supports audio playback
   */
  const isSupported = useCallback(() => {
    return typeof Audio !== 'undefined';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    play,
    pause,
    resume,
    stop,
    seek,
    isSupported: isSupported()
  };
}

