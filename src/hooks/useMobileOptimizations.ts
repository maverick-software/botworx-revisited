import { useEffect, useState } from 'react';

interface MobileOptimizationsState {
  isMobile: boolean;
  isKeyboardOpen: boolean;
  viewportHeight: number;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Hook to detect mobile optimizations needed
 * Tracks device type, keyboard state, and viewport dimensions
 */
export function useMobileOptimizations(): MobileOptimizationsState {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  useEffect(() => {
    // Detect device type
    const checkDeviceType = () => {
      const width = window.innerWidth;
      
      // Tailwind breakpoints: sm: 640px, md: 768px, lg: 1024px
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsDesktop(width >= 1024);
      setScreenWidth(width);
      setScreenHeight(window.innerHeight);
    };

    // Detect keyboard open on mobile
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(currentHeight);
      
      // If viewport shrinks significantly, keyboard is likely open
      if (window.innerWidth < 768) {
        const heightDiff = window.innerHeight - currentHeight;
        // Keyboard typically takes up > 150px
        setIsKeyboardOpen(heightDiff > 150);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    // Initialize
    checkDeviceType();
    handleResize();

    // Listen for changes
    window.addEventListener('resize', checkDeviceType);
    window.visualViewport?.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkDeviceType);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isKeyboardOpen,
    viewportHeight,
    screenWidth,
    screenHeight
  };
}

/**
 * Hook to detect if user is on a touch device
 */
export function useTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check if touch events are supported
    const hasTouch = 'ontouchstart' in window || 
                    navigator.maxTouchPoints > 0 ||
                    (navigator as any).msMaxTouchPoints > 0;
    
    setIsTouchDevice(hasTouch);
  }, []);

  return isTouchDevice;
}

/**
 * Hook to get safe area insets for notched devices
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    const updateInsets = () => {
      const style = getComputedStyle(document.documentElement);
      
      setInsets({
        top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
        right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
        bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
        left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0')
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    
    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return insets;
}

