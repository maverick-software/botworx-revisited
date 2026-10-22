import { useRef, useEffect, RefObject } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for a swipe to register (px)
  velocityThreshold?: number; // Minimum velocity for a swipe (px/ms)
}

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

/**
 * Hook to handle swipe gestures on touch devices
 * @param config - Swipe configuration with callbacks and thresholds
 * @returns Object with touch event handlers
 */
export function useSwipeGesture(config: SwipeConfig) {
  const touchStart = useRef<TouchPosition | null>(null);
  const threshold = config.threshold || 50; // Default 50px minimum swipe
  const velocityThreshold = config.velocityThreshold || 0.3; // Default 0.3 px/ms

  const handleTouchStart = (e: TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = touchEnd.x - touchStart.current.x;
    const deltaY = touchEnd.y - touchStart.current.y;
    const deltaTime = touchEnd.time - touchStart.current.time;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Calculate velocity
    const velocityX = absX / deltaTime;
    const velocityY = absY / deltaTime;

    // Determine if it's a horizontal or vertical swipe
    if (absX > absY) {
      // Horizontal swipe
      if (absX > threshold && velocityX > velocityThreshold) {
        if (deltaX > 0 && config.onSwipeRight) {
          config.onSwipeRight();
        } else if (deltaX < 0 && config.onSwipeLeft) {
          config.onSwipeLeft();
        }
      }
    } else {
      // Vertical swipe
      if (absY > threshold && velocityY > velocityThreshold) {
        if (deltaY > 0 && config.onSwipeDown) {
          config.onSwipeDown();
        } else if (deltaY < 0 && config.onSwipeUp) {
          config.onSwipeUp();
        }
      }
    }

    touchStart.current = null;
  };

  return { handleTouchStart, handleTouchEnd };
}

/**
 * Hook to attach swipe gestures to a specific element
 * @param ref - Ref to the element to attach gestures to
 * @param config - Swipe configuration
 */
export function useSwipeGestureOnElement(
  ref: RefObject<HTMLElement>,
  config: SwipeConfig
) {
  const { handleTouchStart, handleTouchEnd } = useSwipeGesture(config);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, config]); // eslint-disable-line react-hooks/exhaustive-deps
}

