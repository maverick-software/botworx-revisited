/**
 * PWA Theme Configuration
 * Centralized theme management for mobile/desktop views
 */

export const PWA_THEME = {
  // Breakpoints (matching Tailwind)
  breakpoints: {
    mobile: 768,    // < 768px
    tablet: 1024,   // 768-1023px
    desktop: 1024,  // >= 1024px
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
  },

  // Touch target sizes (Apple HIG)
  touchTargets: {
    minimum: 44,    // 44x44px minimum
    comfortable: 48, // 48x48px comfortable
    large: 56       // 56x56px large
  },

  // Spacing scale for mobile vs desktop
  spacing: {
    mobile: {
      page: 'px-4 py-4',
      section: 'px-4 py-3',
      card: 'p-4',
      cardCompact: 'p-3',
      gap: 'gap-3',
      gapSmall: 'gap-2'
    },
    desktop: {
      page: 'px-6 py-6',
      section: 'px-6 py-4',
      card: 'p-6',
      cardCompact: 'p-4',
      gap: 'gap-4',
      gapLarge: 'gap-6'
    }
  },

  // Grid columns by breakpoint
  grid: {
    mobile: {
      agents: 'grid-cols-2',
      teams: 'grid-cols-1',
      tools: 'grid-cols-2',
      default: 'grid-cols-1'
    },
    tablet: {
      agents: 'md:grid-cols-3',
      teams: 'md:grid-cols-2',
      tools: 'md:grid-cols-3',
      default: 'md:grid-cols-2'
    },
    desktop: {
      agents: 'lg:grid-cols-4 xl:grid-cols-5',
      teams: 'lg:grid-cols-3',
      tools: 'lg:grid-cols-4',
      default: 'lg:grid-cols-3'
    }
  },

  // Typography scales
  typography: {
    mobile: {
      h1: 'text-2xl font-bold',
      h2: 'text-xl font-semibold',
      h3: 'text-lg font-semibold',
      h4: 'text-base font-semibold',
      body: 'text-sm',
      small: 'text-xs'
    },
    desktop: {
      h1: 'text-3xl font-bold',
      h2: 'text-2xl font-semibold',
      h3: 'text-xl font-semibold',
      h4: 'text-lg font-semibold',
      body: 'text-base',
      small: 'text-sm'
    }
  },

  // Component heights
  heights: {
    mobileHeader: 'h-14',        // 56px
    desktopHeader: 'h-16',       // 64px
    bottomNav: 'h-16',           // 64px
    input: 'h-10',               // 40px
    inputLarge: 'h-12',          // 48px
    button: 'h-10',              // 40px
    buttonLarge: 'h-12'          // 48px
  },

  // Animations
  animations: {
    drawer: 'transition-transform duration-300 ease-out',
    fade: 'transition-opacity duration-200',
    color: 'transition-colors duration-200',
    all: 'transition-all duration-200'
  },

  // Safe area classes
  safeArea: {
    top: 'safe-area-top',
    bottom: 'safe-area-bottom',
    inset: 'safe-area-inset'
  },

  // PWA-specific
  pwa: {
    bottomNavPadding: 'pb-16',  // Account for bottom nav
    mobileScrollable: 'overflow-y-auto momentum-scroll',
    noSelect: 'no-select',
    touchTarget: 'touch-target'
  }
} as const;

/**
 * Helper function to get responsive classes
 */
export function getResponsiveClass(
  mobile: string,
  desktop: string,
  tablet?: string
): string {
  const classes = [mobile];
  if (tablet) classes.push(tablet);
  classes.push(desktop);
  return classes.join(' ');
}

/**
 * Helper to get page padding based on device
 */
export function getPagePadding(isMobile: boolean): string {
  return isMobile ? PWA_THEME.spacing.mobile.page : PWA_THEME.spacing.desktop.page;
}

/**
 * Helper to get section padding based on device
 */
export function getSectionPadding(isMobile: boolean): string {
  return isMobile ? PWA_THEME.spacing.mobile.section : PWA_THEME.spacing.desktop.section;
}

/**
 * Helper to get grid classes for a specific content type
 */
export function getGridClasses(contentType: 'agents' | 'teams' | 'tools' | 'default'): string {
  return `${PWA_THEME.grid.mobile[contentType]} ${PWA_THEME.grid.tablet[contentType]} ${PWA_THEME.grid.desktop[contentType]}`;
}

/**
 * Helper to get typography classes
 */
export function getTypography(
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small',
  isMobile: boolean
): string {
  return isMobile 
    ? PWA_THEME.typography.mobile[level]
    : PWA_THEME.typography.desktop[level];
}

/**
 * Helper to build mobile-optimized container classes
 */
export function getMobileContainer(isMobile: boolean): string {
  return `${getPagePadding(isMobile)} ${PWA_THEME.pwa.mobileScrollable}`;
}

