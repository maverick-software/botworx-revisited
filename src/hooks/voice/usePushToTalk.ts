/**
 * Push-to-Talk (PTT) Hook
 * 
 * Handles keyboard shortcuts for push-to-talk functionality
 * Press and hold a key to record, release to stop
 */

import { useEffect, useCallback, useRef } from 'react';

export type PTTKey = 'Space' | 'Tab' | 'Control' | 'Alt' | 'Shift' | 'Meta';

export interface PTTOptions {
  enabled: boolean;
  key: PTTKey;
  onPressStart: () => void;
  onPressEnd: () => void;
}

export function usePushToTalk({
  enabled,
  key,
  onPressStart,
  onPressEnd
}: PTTOptions) {
  const isPressingRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const onPressStartRef = useRef(onPressStart);
  const onPressEndRef = useRef(onPressEnd);

  // Keep refs up to date
  useEffect(() => {
    onPressStartRef.current = onPressStart;
    onPressEndRef.current = onPressEnd;
  }, [onPressStart, onPressEnd]);

  /**
   * Map PTT key to keyboard event key
   */
  const getKeyCode = useCallback((pttKey: PTTKey): string => {
    switch (pttKey) {
      case 'Space': return ' ';
      case 'Tab': return 'Tab';
      case 'Control': return 'Control';
      case 'Alt': return 'Alt';
      case 'Shift': return 'Shift';
      case 'Meta': return 'Meta';
      default: return ' ';
    }
  }, []);

  /**
   * Check if the pressed key matches our PTT key
   */
  const isTargetKey = useCallback((event: KeyboardEvent): boolean => {
    const targetKey = getKeyCode(key);
    
    switch (key) {
      case 'Space':
        return event.key === ' ' || event.code === 'Space';
      case 'Tab':
        return event.key === 'Tab';
      case 'Control':
        return event.ctrlKey || event.key === 'Control';
      case 'Alt':
        return event.altKey || event.key === 'Alt';
      case 'Shift':
        return event.shiftKey || event.key === 'Shift';
      case 'Meta':
        return event.metaKey || event.key === 'Meta';
      default:
        return false;
    }
  }, [key, getKeyCode]);

  /**
   * Handle key down event
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || !isTargetKey(event)) return;

    // Prevent default behavior (e.g., spacebar scrolling)
    if (key === 'Space' || key === 'Tab') {
      event.preventDefault();
    }

    // Don't trigger if already pressing or recording (important for key repeat)
    if (isPressingRef.current || isRecordingRef.current) {
      // Key is being held down (repeat event), just prevent default and return
      return;
    }

    // Ignore if user is typing in an input field
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    console.log('[PTT] Key pressed, starting recording');
    isPressingRef.current = true;
    isRecordingRef.current = true;
    onPressStartRef.current();
  }, [enabled, key, isTargetKey]);

  /**
   * Handle key up event
   */
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!enabled || !isTargetKey(event)) return;

    // Only stop if we were pressing
    if (!isPressingRef.current) return;

    console.log('[PTT] Key released, stopping recording');
    isPressingRef.current = false;
    isRecordingRef.current = false;
    onPressEndRef.current();
  }, [enabled, isTargetKey]);

  /**
   * Register keyboard event listeners
   */
  useEffect(() => {
    if (!enabled) {
      console.log('[PTT] Not enabled, skipping');
      return;
    }

    console.log(`[PTT] Mounting event listeners with key: ${key}`);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      console.log('[PTT] Unmounting event listeners');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, handleKeyDown, handleKeyUp, key]);

  /**
   * Manually trigger recording (for UI buttons)
   */
  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    onPressStart();
  }, [onPressStart]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    onPressEnd();
  }, [onPressEnd]);

  return {
    isPressed: isPressingRef.current,
    isRecording: isRecordingRef.current,
    startRecording,
    stopRecording
  };
}

