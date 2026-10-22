import React from 'react';
import { cn } from '@/lib/utils';
import { getGridClasses } from '@/lib/pwaTheme';

interface ResponsiveGridProps {
  children: React.ReactNode;
  type?: 'agents' | 'teams' | 'tools' | 'default';
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gapClasses = {
  sm: 'gap-2',
  md: 'gap-3 md:gap-4',
  lg: 'gap-4 md:gap-6'
};

/**
 * Responsive grid component with mobile-optimized column counts
 */
export function ResponsiveGrid({ 
  children, 
  type = 'default', 
  gap = 'md',
  className 
}: ResponsiveGridProps) {
  return (
    <div className={cn(
      'grid',
      getGridClasses(type),
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
}

