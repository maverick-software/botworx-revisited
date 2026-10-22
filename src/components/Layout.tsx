import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNavigation } from './mobile/BottomNavigation';
import { MobileDrawer } from './mobile/MobileDrawer';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Context to control mobile drawer from anywhere
export const MobileDrawerContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {}
});

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMobile = useIsMobile();

  // Temporarily disable transition effect that causes modal state resets when tabbing
  // TODO: Implement a smarter transition that doesn't interfere with modal state
  // useEffect(() => {
  //   setIsTransitioning(true);
  //   const timer = setTimeout(() => setIsTransitioning(false), 300);
  //   return () => clearTimeout(timer);
  // }, [location.pathname]);

  // Match any route starting with /workspaces/ except /workspaces/new
  const isWorkspaceSpecificView = matchPath(
    { path: "/workspaces/:roomId", end: false }, 
    location.pathname
  ) && location.pathname !== '/workspaces/new'; // Ensure /new doesn't count

  // Only show the main Sidebar if NOT in a specific workspace view
  const showMainSidebar = !isWorkspaceSpecificView;

  // Mobile drawer controls
  const drawerControls = {
    isOpen: isMobileDrawerOpen,
    open: () => setIsMobileDrawerOpen(true),
    close: () => setIsMobileDrawerOpen(false),
    toggle: () => setIsMobileDrawerOpen(prev => !prev)
  };

  return (
    <MobileDrawerContext.Provider value={drawerControls}>
      <div className="flex h-screen-mobile w-full overflow-hidden bg-background text-foreground">
        {/* Desktop Sidebar - Hidden on Mobile */}
        {showMainSidebar && !isMobile && (
          <Sidebar 
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
          />
        )}

        {/* Main content area flexes to fill space */}
        {/* Apply w-full only if sidebar is hidden to take full width */} 
        <div className={`flex-1 flex flex-col overflow-hidden ${!showMainSidebar ? 'w-full' : ''}`}>
          {/* Desktop Header - Hidden on Mobile */}
          {!isMobile && <Header />}
          
          <main className={`flex-1 ${location.pathname.includes('/chat') ? 'overflow-hidden' : 'overflow-y-auto momentum-scroll'} ${isMobile ? 'pb-16' : ''}`}>
            {isTransitioning ? (
              <div className="fixed inset-0 z-50 flex justify-center items-center bg-background transition-opacity duration-300">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              // Remove padding for full-screen chat pages
              location.pathname.includes('/chat') ? (
                children
              ) : (
                <div className={isMobile ? 'p-4' : 'p-6'}>
                  {children}
                </div>
              )
            )}
          </main>
        </div>
      </div>

      {/* Mobile-Only Navigation */}
      {isMobile && (
        <>
          <BottomNavigation />
          <MobileDrawer 
            isOpen={isMobileDrawerOpen} 
            onClose={() => setIsMobileDrawerOpen(false)} 
          />
        </>
      )}
    </MobileDrawerContext.Provider>
  );
};

// Hook to use mobile drawer
export function useMobileDrawer() {
  return useContext(MobileDrawerContext);
}

export default Layout;