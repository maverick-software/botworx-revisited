import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface SoftRefreshProtectionOptions {
  /** Whether to protect against location changes (default: true) */
  protectAgainstLocationChanges?: boolean;
  /** Whether to protect against visibility changes (default: true) */  
  protectAgainstVisibilityChanges?: boolean;
  /** Whether to protect against focus changes (default: true) */
  protectAgainstFocusChanges?: boolean;
  /** Paths that should trigger cleanup (default: any path change) */
  cleanupPaths?: string[];
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Comprehensive hook to protect against soft refresh issues that cause data loss
 * 
 * This hook prevents modal state resets caused by:
 * - Minor URL changes (hash, search params)
 * - Browser tab switching (focus/blur)
 * - Document visibility changes
 * - Unnecessary location listener triggers
 * 
 * Use this hook in components that have modal state that should persist
 * when users tab away and come back.
 */
export function useSoftRefreshProtection(
  onStateReset?: () => void,
  options: SoftRefreshProtectionOptions = {}
) {
  const {
    protectAgainstLocationChanges = true,
    protectAgainstVisibilityChanges = true,
    protectAgainstFocusChanges = true,
    cleanupPaths,
    debug = false
  } = options;

  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);
  const isProtectedRef = useRef(true);

  // Log protection status
  useEffect(() => {
    if (debug) {
      console.log('[SoftRefreshProtection] Protection enabled:', {
        locationChanges: protectAgainstLocationChanges,
        visibilityChanges: protectAgainstVisibilityChanges,
        focusChanges: protectAgainstFocusChanges,
        currentPath: location.pathname
      });
    }
  }, [debug, location.pathname, protectAgainstLocationChanges, protectAgainstVisibilityChanges, protectAgainstFocusChanges]);

  // Handle location changes intelligently
  useEffect(() => {
    if (!protectAgainstLocationChanges) return;

    const currentPathname = location.pathname;
    const previousPathname = previousPathnameRef.current;

    // Only trigger reset if we've actually navigated to a different page
    const hasNavigatedToNewPage = currentPathname !== previousPathname;
    
    // Check if current path is in cleanup paths
    const shouldCleanup = cleanupPaths 
      ? cleanupPaths.some(path => !currentPathname.startsWith(path))
      : hasNavigatedToNewPage;

    if (hasNavigatedToNewPage) {
      if (debug) {
        console.log('[SoftRefreshProtection] Path changed:', {
          from: previousPathname,
          to: currentPathname,
          shouldCleanup,
          search: location.search,
          hash: location.hash
        });
      }

      if (shouldCleanup && onStateReset) {
        if (debug) {
          console.log('[SoftRefreshProtection] Triggering state reset due to navigation');
        }
        onStateReset();
      }
    }

    previousPathnameRef.current = currentPathname;
  }, [location.pathname, protectAgainstLocationChanges, cleanupPaths, onStateReset, debug]);

  // Protect against document visibility changes
  useEffect(() => {
    if (!protectAgainstVisibilityChanges) return;

    const handleVisibilityChange = () => {
      if (debug) {
        console.log('[SoftRefreshProtection] Visibility change detected:', {
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          protected: true
        });
      }
      // Don't reset state on visibility changes - this is the main fix for soft refresh
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [protectAgainstVisibilityChanges, debug]);

  // Protect against window focus/blur
  useEffect(() => {
    if (!protectAgainstFocusChanges) return;

    const handleFocus = () => {
      if (debug) {
        console.log('[SoftRefreshProtection] Window gained focus - state protected');
      }
      // Don't reset state on focus
    };

    const handleBlur = () => {
      if (debug) {
        console.log('[SoftRefreshProtection] Window lost focus - state protected');
      }
      // Don't reset state on blur
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [protectAgainstFocusChanges, debug]);

  // Provide a way to manually trigger cleanup when needed
  const triggerCleanup = useCallback(() => {
    if (debug) {
      console.log('[SoftRefreshProtection] Manual cleanup triggered');
    }
    if (onStateReset) {
      onStateReset();
    }
  }, [onStateReset, debug]);

  return {
    isProtected: isProtectedRef.current,
    currentPath: location.pathname,
    triggerCleanup
  };
}

/**
 * Specialized version for modal components
 */
export function useModalSoftRefreshProtection(
  isModalOpen: boolean,
  onModalClose: () => void,
  options: Omit<SoftRefreshProtectionOptions, 'cleanupPaths'> & {
    /** Additional paths where modal should stay open (default: current page only) */
    allowedPaths?: string[];
  } = {}
) {
  const { allowedPaths, ...protectionOptions } = options;
  const location = useLocation();
  
  // Define cleanup logic - only close modal if we navigate away from allowed paths
  const handleStateReset = useCallback(() => {
    if (isModalOpen) {
      // Check if we're still on an allowed path
      const currentPath = location.pathname;
      const isOnAllowedPath = allowedPaths?.some(path => currentPath.startsWith(path)) ?? true;
      
      if (!isOnAllowedPath) {
        onModalClose();
      }
    }
  }, [isModalOpen, onModalClose, location.pathname, allowedPaths]);

  return useSoftRefreshProtection(handleStateReset, protectionOptions);
}
