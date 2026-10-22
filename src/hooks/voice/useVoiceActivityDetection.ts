/**
 * Voice Activity Detection (VAD) Hook
 * 
 * Detects when user starts/stops speaking using audio analysis
 * Automatically stops recording after silence threshold is reached
 */

import { useCallback, useRef, useEffect } from 'react';

export interface VADOptions {
  enabled: boolean;
  silenceThreshold?: number;      // Volume threshold below which is considered silence (0-1, default: 0.01)
  silenceDuration?: number;        // How long silence before stopping (ms, default: 1500)
  minRecordingDuration?: number;   // Minimum recording time (ms, default: 1000)
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSilenceDetected?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export function useVoiceActivityDetection({
  enabled,
  silenceThreshold = 0.01,
  silenceDuration = 1500,
  minRecordingDuration = 1000,
  onSpeechStart,
  onSpeechEnd,
  onSilenceDetected,
  onVolumeChange
}: VADOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Initialize VAD with audio stream
   */
  const initializeVAD = useCallback((stream: MediaStream) => {
    if (!enabled) return;

    try {
      // Create audio context and analyser
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      recordingStartTimeRef.current = Date.now();
      isSpeakingRef.current = false;

      console.log('[VAD] Initialized');
      startVolumeMonitoring();
    } catch (err) {
      console.error('[VAD] Failed to initialize:', err);
    }
  }, [enabled]);

  /**
   * Monitor audio volume and detect speech/silence
   */
  const startVolumeMonitoring = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume (0-1 scale)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const volume = average / 255;

      onVolumeChange?.(volume);

      // Check if user is speaking
      const isSpeaking = volume > silenceThreshold;
      const recordingDuration = Date.now() - recordingStartTimeRef.current;

      // Speech started
      if (isSpeaking && !isSpeakingRef.current) {
        console.log('[VAD] Speech detected');
        isSpeakingRef.current = true;
        onSpeechStart?.();

        // Clear any pending silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      // Speech ended (silence detected)
      if (!isSpeaking && isSpeakingRef.current) {
        console.log('[VAD] Silence detected');

        // Only trigger silence if we've been recording long enough
        if (recordingDuration >= minRecordingDuration) {
          // Start silence timer
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log('[VAD] Silence threshold reached, stopping recording');
              isSpeakingRef.current = false;
              onSilenceDetected?.();
              onSpeechEnd?.();
            }, silenceDuration);
          }
        }
      }

      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }, [silenceThreshold, silenceDuration, minRecordingDuration, onSpeechStart, onSpeechEnd, onSilenceDetected, onVolumeChange]);

  /**
   * Cleanup VAD resources
   */
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    isSpeakingRef.current = false;

    console.log('[VAD] Cleaned up');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    initializeVAD,
    cleanup,
    isSpeaking: isSpeakingRef.current
  };
}

