import { useEffect } from 'react';

/**
 * Hook to prefetch common routes to speed up navigation
 * 
 * This helps reduce the white flash when navigating between pages by
 * preloading the JS chunks for common routes.
 */
export function useRoutePrefetch() {
  useEffect(() => {
    // Common routes that should be prefetched
    const routesToPrefetch = [
      'DashboardPage',
      'AgentsPage',
      'DatastoresPage',
      'AgentEditPage'
    ];
    
    const prefetchLink = (route: string) => {
      // Check if link already exists
      const existingLink = document.head.querySelector(`link[href*="${route}"]`);
      if (existingLink) return;
      
      // Create prefetch link
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'script';
      link.href = `/src/pages/${route}.tsx`;
      
      // Add to document head
      document.head.appendChild(link);
    };
    
    // Prefetch all routes
    routesToPrefetch.forEach(prefetchLink);
    
    // Cleanup function
    return () => {
      // Optionally remove the prefetch links when component unmounts
      // This is usually not necessary as they don't hurt to keep around
    };
  }, []);
} 