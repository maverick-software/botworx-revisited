import React from 'react';
import { MobileHeader } from './MobileHeader';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface MobilePageProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
  showBack?: boolean;
  showMenu?: boolean;
  onMenuClick?: () => void;
  headerActions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  fullHeight?: boolean;
}

/**
 * Wrapper component for mobile-optimized pages
 * Provides consistent mobile header and layout
 */
export function MobilePage({
  children,
  title,
  showHeader = true,
  showBack = false,
  showMenu = true,
  onMenuClick,
  headerActions,
  className,
  contentClassName,
  fullHeight = false
}: MobilePageProps) {
  const isMobile = useIsMobile();

  // Only render mobile optimizations on mobile
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn('flex flex-col', fullHeight ? 'h-screen-mobile' : 'min-h-screen-mobile', className)}>
      {showHeader && title && (
        <MobileHeader
          title={title}
          showBack={showBack}
          showMenu={showMenu}
          onMenuClick={onMenuClick}
          actions={headerActions}
        />
      )}
      
      <div className={cn(
        'flex-1 overflow-y-auto momentum-scroll pb-16',
        contentClassName
      )}>
        {children}
      </div>
    </div>
  );
}

