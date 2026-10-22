import { useState, useEffect } from 'react';

type OrientationType = 'portrait' | 'landscape';

interface OrientationState {
  orientation: OrientationType;
  angle: number;
  isPortrait: boolean;
  isLandscape: boolean;
}

/**
 * Hook to track device orientation
 * Useful for optimizing layouts based on device rotation
 */
export function useOrientation(): OrientationState {
  const [orientation, setOrientation] = useState<OrientationType>(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }
    return 'portrait';
  });

  const [angle, setAngle] = useState<number>(0);

  useEffect(() => {
    const handleOrientationChange = () => {
      // Use Screen Orientation API if available
      if (screen.orientation) {
        const type = screen.orientation.type;
        setOrientation(type.includes('portrait') ? 'portrait' : 'landscape');
        setAngle(screen.orientation.angle);
      } else {
        // Fallback to window dimensions
        setOrientation(
          window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
        );
      }
    };

    // Set initial orientation
    handleOrientationChange();

    // Listen for orientation changes
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('orientationchange', handleOrientationChange);
      window.addEventListener('resize', handleOrientationChange);
    }

    // Cleanup
    return () => {
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      } else {
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('resize', handleOrientationChange);
      }
    };
  }, []);

  return {
    orientation,
    angle,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape'
  };
}

/**
 * Hook to lock screen orientation (requires user gesture)
 * @param orientation - Desired orientation to lock
 */
export function useOrientationLock(orientation?: OrientationLockType) {
  useEffect(() => {
    if (!orientation || !screen.orientation) {
      return;
    }

    const lock = async () => {
      try {
        await screen.orientation.lock(orientation);
        console.log(`[Orientation] Locked to ${orientation}`);
      } catch (error) {
        console.warn('[Orientation] Lock failed:', error);
      }
    };

    lock();

    // Cleanup: unlock on unmount
    return () => {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    };
  }, [orientation]);
}

