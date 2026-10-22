import { useState, useRef, useEffect, RefObject } from 'react';

interface PullToRefreshConfig {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance to pull before triggering refresh
  resistance?: number; // Resistance factor (higher = harder to pull)
  enabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
  canRefresh: boolean;
}

/**
 * Hook to implement pull-to-refresh functionality
 * @param containerRef - Ref to the scrollable container
 * @param config - Pull-to-refresh configuration
 */
export function usePullToRefresh(
  containerRef: RefObject<HTMLElement>,
  config: PullToRefreshConfig
): PullToRefreshState {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
    canRefresh: false
  });

  const threshold = config.threshold || 80; // Default 80px
  const resistance = config.resistance || 2.5; // Default 2.5x resistance
  const enabled = config.enabled !== false; // Default true

  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at top of scroll
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        setState(prev => ({ ...prev, isPulling: false }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (state.isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const pullDistance = currentY.current - startY.current;

      // Only handle pull down when at top
      if (pullDistance > 0 && container.scrollTop === 0) {
        // Prevent default scroll behavior
        e.preventDefault();

        // Apply resistance
        const adjustedDistance = pullDistance / resistance;
        const canRefresh = adjustedDistance >= threshold;

        setState({
          isPulling: true,
          pullDistance: adjustedDistance,
          isRefreshing: false,
          canRefresh
        });
      }
    };

    const handleTouchEnd = async () => {
      if (state.isPulling && state.canRefresh && !state.isRefreshing) {
        setState(prev => ({
          ...prev,
          isRefreshing: true,
          isPulling: false
        }));

        try {
          await config.onRefresh();
        } catch (error) {
          console.error('[Pull-to-Refresh] Error:', error);
        } finally {
          setState({
            isPulling: false,
            pullDistance: 0,
            isRefreshing: false,
            canRefresh: false
          });
        }
      } else {
        setState({
          isPulling: false,
          pullDistance: 0,
          isRefreshing: false,
          canRefresh: false
        });
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, enabled, state.isRefreshing, state.isPulling, state.canRefresh, threshold, resistance]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

/**
 * Pull-to-refresh indicator component props
 */
export interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  canRefresh: boolean;
  threshold: number;
}

