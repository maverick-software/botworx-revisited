import { useState, useEffect, useCallback } from 'react';

interface VisibilityOptions {
  /** Whether to fire callbacks on visibility changes */
  enableCallbacks?: boolean;
  /** Whether to log visibility changes for debugging */
  debug?: boolean;
}

/**
 * Hook to handle document visibility changes without causing unwanted side effects
 * 
 * This hook helps prevent the soft refresh issue by:
 * - Tracking document visibility state properly
 * - Not triggering unnecessary re-renders or state resets
 * - Providing callbacks for when visibility actually matters
 * - Helping components decide whether to update state based on visibility
 */
export function useDocumentVisibility(options: VisibilityOptions = {}) {
  const { enableCallbacks = true, debug = false } = options;
  
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [visibilityState, setVisibilityState] = useState(document.visibilityState);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const newIsVisible = !document.hidden;
      const newVisibilityState = document.visibilityState;
      
      setIsVisible(newIsVisible);
      setVisibilityState(newVisibilityState);
      
      if (debug) {
        console.log('[useDocumentVisibility] Visibility changed:', {
          isVisible: newIsVisible,
          visibilityState: newVisibilityState,
          timestamp: new Date().toISOString()
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [debug]);

  // Stable callbacks for components that need to react to visibility changes
  const onVisible = useCallback((callback: () => void) => {
    if (enableCallbacks && isVisible) {
      callback();
    }
  }, [enableCallbacks, isVisible]);

  const onHidden = useCallback((callback: () => void) => {
    if (enableCallbacks && !isVisible) {
      callback();
    }
  }, [enableCallbacks, isVisible]);

  // Helper to determine if it's safe to make expensive operations
  const isSafeToUpdate = useCallback(() => {
    return isVisible && visibilityState === 'visible';
  }, [isVisible, visibilityState]);

  return {
    isVisible,
    visibilityState,
    onVisible,
    onHidden,
    isSafeToUpdate
  };
}

/**
 * Hook that prevents unnecessary API calls or expensive operations when page is hidden
 */
export function useVisibilityAwareEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  options: { runWhenHidden?: boolean } = {}
) {
  const { runWhenHidden = false } = options;
  const { isVisible } = useDocumentVisibility();

  useEffect(() => {
    // Only run effect if page is visible OR if explicitly allowed to run when hidden
    if (isVisible || runWhenHidden) {
      return effect();
    }
    
    // If page is hidden and we shouldn't run when hidden, do nothing
    return undefined;
  }, [isVisible, runWhenHidden, ...deps]);
}
