# Progressive Web App (PWA) Transformation Master Plan
**Project**: Agentopia/Gofr Agents  
**Created**: October 22, 2025  
**Status**: Planning Phase  
**Goal**: Transform platform into a fully-featured PWA with exceptional mobile experience

---

## 📋 Executive Summary

This master plan outlines the comprehensive transformation of Agentopia into a Progressive Web App (PWA) that provides an exceptional experience for both desktop and mobile users. The implementation follows a phased approach prioritizing core PWA features, mobile UI optimization, and progressive enhancement.

### Key Objectives
1. **Installability**: Enable users to install the app on their devices
2. **Offline Capability**: Provide robust offline functionality with smart caching
3. **Mobile Excellence**: Deliver a native app-like experience on mobile devices
4. **Performance**: Optimize for mobile networks and lower-powered devices
5. **Engagement**: Enable push notifications and background sync

---

## 🎯 Current State Assessment

### ✅ Existing Strengths
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints (sm/md/lg/xl/2xl)
- **Modern Stack**: React 18 + Vite provides excellent PWA foundation
- **Component Architecture**: Well-organized, modular components
- **HTTPS Ready**: Already requires HTTPS via Supabase
- **Performance**: Code splitting and lazy loading already implemented

### ⚠️ Gaps to Address
- **No PWA Manifest**: Missing `manifest.json` file
- **No Service Worker**: No offline capability or caching strategy
- **No Install Prompt**: Users cannot install the app
- **Mobile UI Needs Enhancement**: Some components need mobile-specific optimization
- **No Push Notifications**: Missing engagement features
- **No Offline Fallback**: No graceful degradation when offline

### 📊 Technical Assessment

**Current Responsive Breakpoints**:
```css
Mobile:        0-640px   (sm)
Tablet:        641-768px (md)
Desktop:       769-1024px (lg)
Large Desktop: 1025px+   (xl, 2xl)
```

**Build Configuration**:
- Vite with manual chunking for optimization
- React vendor, Monaco Editor, and Virtualization chunks
- Chunk size warning at 1000KB

**Viewport Configuration**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

---

## 🗺️ Implementation Phases

### **Phase 1: PWA Core Setup** (Week 1-2)
Establish foundational PWA infrastructure

### **Phase 2: Mobile UI Excellence** (Week 3-4)
Optimize all UI components for mobile experience

### **Phase 3: Offline & Performance** (Week 5-6)
Implement robust offline capabilities and performance optimizations

### **Phase 4: Advanced Features** (Week 7-8)
Add push notifications, background sync, and advanced PWA features

### **Phase 5: Testing & Launch** (Week 9-10)
Comprehensive testing, monitoring, and production deployment

---

## 📦 Phase 1: PWA Core Setup

### 1.1 Web App Manifest Creation

**File**: `public/manifest.json`

```json
{
  "name": "Gofr Agents - AI Agent Platform",
  "short_name": "Gofr Agents",
  "description": "Create, manage, and deploy AI agents with enterprise-grade capabilities",
  "start_url": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone", "minimal-ui"],
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "any",
  "scope": "/",
  "categories": ["productivity", "business", "utilities"],
  "dir": "ltr",
  "lang": "en-US",
  "prefer_related_applications": false,
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-chat.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Agent Chat Interface"
    },
    {
      "src": "/screenshots/mobile-chat.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Mobile Chat Experience"
    }
  ],
  "shortcuts": [
    {
      "name": "New Chat",
      "short_name": "Chat",
      "description": "Start a new agent conversation",
      "url": "/agents",
      "icons": [{ "src": "/icons/shortcut-chat.png", "sizes": "96x96" }]
    },
    {
      "name": "Agents",
      "short_name": "Agents",
      "description": "Manage your AI agents",
      "url": "/agents",
      "icons": [{ "src": "/icons/shortcut-agents.png", "sizes": "96x96" }]
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "attachments",
          "accept": ["image/*", "application/pdf", "text/*"]
        }
      ]
    }
  }
}
```

**Implementation Checklist**:
- [ ] Create manifest.json file
- [ ] Generate icon set (72px to 512px) with maskable variants
- [ ] Create screenshots for app stores
- [ ] Link manifest in index.html
- [ ] Add theme-color meta tags
- [ ] Configure apple-touch-icon for iOS
- [ ] Test manifest with Lighthouse

### 1.2 Index.html PWA Metadata

**Update**: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    
    <!-- PWA Viewport Configuration -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    
    <!-- PWA Display Mode -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    
    <!-- Theme Colors -->
    <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1e40af" media="(prefers-color-scheme: dark)" />
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json" />
    
    <!-- Icons -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-180x180.png" />
    
    <!-- iOS Splash Screens -->
    <link rel="apple-touch-startup-image" href="/splash/iphone5_splash.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />
    <link rel="apple-touch-startup-image" href="/splash/iphone6_splash.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
    <link rel="apple-touch-startup-image" href="/splash/iphoneplus_splash.png" media="(device-width: 621px) and (device-height: 1104px) and (-webkit-device-pixel-ratio: 3)" />
    <link rel="apple-touch-startup-image" href="/splash/iphonex_splash.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
    <link rel="apple-touch-startup-image" href="/splash/iphonexr_splash.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
    <link rel="apple-touch-startup-image" href="/splash/iphonexsmax_splash.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" />
    <link rel="apple-touch-startup-image" href="/splash/ipad_splash.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />
    <link rel="apple-touch-startup-image" href="/splash/ipadpro1_splash.png" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)" />
    <link rel="apple-touch-startup-image" href="/splash/ipadpro3_splash.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" />
    <link rel="apple-touch-startup-image" href="/splash/ipadpro2_splash.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" />
    
    <!-- App Title -->
    <meta name="application-name" content="Gofr Agents" />
    <meta name="apple-mobile-web-app-title" content="Gofr Agents" />
    
    <!-- App Description -->
    <meta name="description" content="Create, manage, and deploy AI agents with enterprise-grade capabilities. Collaborate with intelligent agents in workspaces." />
    
    <title>Gofr Agents</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 1.3 Vite PWA Plugin Integration

**Install Dependencies**:
```powershell
npm install -D vite-plugin-pwa workbox-window
```

**Update**: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'splash/*.png'],
      manifest: false, // We use our custom manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'supabase-functions-cache'
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      overlay: false
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'monaco-editor': ['react-monaco-editor'],
          'virtualization': ['react-window', 'react-virtualized-auto-sizer']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

### 1.4 Service Worker Registration

**Create**: `src/utils/pwa.ts`

```typescript
import { Workbox } from 'workbox-window';

export interface PWAUpdateHandler {
  onUpdate: (registration: ServiceWorkerRegistration) => void;
  onSuccess: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady: () => void;
}

export function registerPWA(handlers?: PWAUpdateHandler) {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js');

    // Service Worker update available
    wb.addEventListener('waiting', () => {
      console.log('[PWA] New service worker waiting');
      
      // Show update notification to user
      if (handlers?.onUpdate && wb.messageSW) {
        wb.messageSW({ type: 'SKIP_WAITING' }).then(() => {
          window.location.reload();
        });
      }
    });

    // Service Worker activated
    wb.addEventListener('activated', (event) => {
      console.log('[PWA] Service worker activated');
      
      if (!event.isUpdate && handlers?.onSuccess) {
        // First time activation
        handlers.onSuccess(event as any);
      }
    });

    // App is ready to work offline
    wb.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        console.log('[PWA] Cache updated');
      }
    });

    // Register the service worker
    wb.register()
      .then((registration) => {
        console.log('[PWA] Service worker registered:', registration);
        
        if (handlers?.onOfflineReady) {
          handlers.onOfflineReady();
        }
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed:', error);
      });

    return wb;
  }

  return null;
}

// Check if app is installed as PWA
export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

// Get install prompt state
export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = React.useState<any>(null);
  const [isInstalled, setIsInstalled] = React.useState(isPWAInstalled());

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('[PWA] Install prompt available');
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      console.log('[PWA] App installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) {
      return false;
    }

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    console.log('[PWA] Install prompt outcome:', outcome);
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }

    return outcome === 'accepted';
  };

  return { installPrompt, promptInstall, isInstalled };
}
```

**Update**: `src/main.tsx`

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './utils/suppressWarnings';
import { registerPWA } from './utils/pwa';
import toast from 'react-hot-toast';

// Register PWA Service Worker
registerPWA({
  onUpdate: () => {
    toast.success(
      'New version available! Reload to update.',
      {
        duration: 10000,
        position: 'bottom-center'
      }
    );
  },
  onSuccess: () => {
    console.log('[PWA] App ready for offline use');
  },
  onOfflineReady: () => {
    toast.success('App ready to work offline!', {
      duration: 3000,
      position: 'bottom-center'
    });
  }
});

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

---

## 📱 Phase 2: Mobile UI Excellence

### 2.1 Mobile Navigation Enhancement

**Challenge**: Current sidebar takes up valuable mobile screen space

**Solution**: Implement bottom navigation for mobile devices

**Create**: `src/components/mobile/BottomNavigation.tsx`

```typescript
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Users, Settings, Menu } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: <Home size={20} />, path: '/' },
  { id: 'agents', label: 'Agents', icon: <MessageSquare size={20} />, path: '/agents' },
  { id: 'teams', label: 'Teams', icon: <Users size={20} />, path: '/teams' },
  { id: 'more', label: 'More', icon: <Menu size={20} />, path: '/settings' },
];

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isActive(item.path)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.icon}
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```

**Update**: `src/index.css` - Add safe area support

```css
/* Safe area insets for notched devices */
.safe-area-top {
  padding-top: env(safe-area-inset-top);
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-area-left {
  padding-left: env(safe-area-inset-left);
}

.safe-area-right {
  padding-right: env(safe-area-inset-right);
}

/* Mobile viewport height fix */
.h-screen-mobile {
  height: 100vh;
  height: -webkit-fill-available;
}

/* Touch action optimization */
.touch-action-pan-y {
  touch-action: pan-y;
}

.touch-action-pan-x {
  touch-action: pan-x;
}

.touch-action-none {
  touch-action: none;
}
```

### 2.2 Agent Chat Mobile Optimization

**File**: `src/pages/AgentChatPage.tsx`

**Mobile-Specific Enhancements**:
1. **Swipe gestures** for sidebar navigation
2. **Pull-to-refresh** for conversation history
3. **Floating action button** for quick actions
4. **Optimized message bubbles** for narrow screens
5. **Keyboard-aware input** positioning

**Create**: `src/hooks/useMobileOptimizations.ts`

```typescript
import { useEffect, useState } from 'react';

export function useMobileOptimizations() {
  const [isMobile, setIsMobile] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Detect keyboard open on mobile
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(currentHeight);
      
      // If viewport shrinks significantly, keyboard is likely open
      if (window.innerWidth < 768) {
        const heightDiff = window.innerHeight - currentHeight;
        setIsKeyboardOpen(heightDiff > 150);
      }
    };

    checkMobile();
    handleResize();

    window.addEventListener('resize', checkMobile);
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return { isMobile, isKeyboardOpen, viewportHeight };
}
```

### 2.3 Touch Gesture Support

**Create**: `src/hooks/useSwipeGesture.ts`

```typescript
import { useRef, useEffect } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export function useSwipeGesture(config: SwipeConfig) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const threshold = config.threshold || 50;

  const handleTouchStart = (e: TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;

    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;

    // Horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > threshold && config.onSwipeRight) {
        config.onSwipeRight();
      } else if (deltaX < -threshold && config.onSwipeLeft) {
        config.onSwipeLeft();
      }
    }
    // Vertical swipe
    else {
      if (deltaY > threshold && config.onSwipeDown) {
        config.onSwipeDown();
      } else if (deltaY < -threshold && config.onSwipeUp) {
        config.onSwipeUp();
      }
    }

    touchStart.current = null;
  };

  return { handleTouchStart, handleTouchEnd };
}
```

### 2.4 Mobile-Optimized Components Checklist

**Components Requiring Mobile Optimization**:

- [ ] **AgentChatPage**: Swipe gestures, keyboard handling, message bubbles
- [ ] **AgentsPage**: Touch-friendly cards, swipe actions
- [ ] **IntegrationsPage**: Modal optimization for mobile
- [ ] **SettingsPage**: Stack layout on mobile
- [ ] **Sidebar**: Drawer on mobile, fixed on desktop
- [ ] **Modals**: Full-screen on mobile, dialog on desktop
- [ ] **Tables**: Horizontal scroll or card layout on mobile
- [ ] **Forms**: Optimized input sizes and spacing

**Mobile UI Patterns to Implement**:
1. **Bottom Sheets** for quick actions
2. **Floating Action Buttons** for primary actions
3. **Swipe Actions** for list items
4. **Pull-to-Refresh** for data reloading
5. **Skeleton Screens** for loading states
6. **Toast Notifications** for feedback (already implemented)

---

## 🚀 Phase 3: Offline & Performance

### 3.1 Offline Page & Strategy

**Create**: `public/offline.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - Gofr Agents</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1rem;
      line-height: 1.5;
      opacity: 0.9;
    }
    button {
      margin-top: 2rem;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      transform: scale(1.05);
      transition: transform 0.2s;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Don't worry, you can still access some cached content.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>
```

### 3.2 Caching Strategy

**Workbox Caching Layers**:

1. **App Shell** (Cache First)
   - HTML, CSS, JavaScript bundles
   - Images, fonts, icons
   - Long-term caching with versioning

2. **API Data** (Network First)
   - Supabase REST API calls
   - Fall back to cache if offline
   - 5-minute cache expiration

3. **Static Assets** (Cache First)
   - Supabase Storage files (avatars, documents)
   - Google Fonts
   - 7-day cache expiration

4. **Edge Functions** (Network Only)
   - Chat completions
   - Real-time operations
   - No caching for fresh data

### 3.3 Background Sync Implementation

**Feature**: Queue messages when offline, sync when online

**Create**: `src/utils/backgroundSync.ts`

```typescript
interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
}

const QUEUE_KEY = 'pwa_message_queue';

export class MessageQueue {
  private queue: QueuedMessage[] = [];

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }

  private saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
  }

  add(message: Omit<QueuedMessage, 'id' | 'timestamp'>) {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    this.queue.push(queuedMessage);
    this.saveQueue();

    // Register background sync if supported
    if ('serviceWorker' in navigator && 'sync' in (navigator as any).serviceWorker) {
      (navigator as any).serviceWorker.ready.then((registration: any) => {
        return registration.sync.register('sync-messages');
      });
    }

    return queuedMessage.id;
  }

  getAll(): QueuedMessage[] {
    return [...this.queue];
  }

  remove(id: string) {
    this.queue = this.queue.filter(msg => msg.id !== id);
    this.saveQueue();
  }

  clear() {
    this.queue = [];
    localStorage.removeItem(QUEUE_KEY);
  }
}

export const messageQueue = new MessageQueue();
```

### 3.4 Performance Optimizations

**Metrics to Target**:
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

**Optimization Strategies**:

1. **Code Splitting**:
   - Route-based splitting (already implemented)
   - Component lazy loading for modals
   - Dynamic imports for heavy libraries

2. **Image Optimization**:
   - WebP format with PNG fallback
   - Responsive images with srcset
   - Lazy loading for below-the-fold images
   - Avatar image compression

3. **Bundle Size Reduction**:
   - Tree shaking unused code
   - Analyze bundle with `rollup-plugin-visualizer`
   - Remove duplicate dependencies
   - Use lighter alternatives where possible

4. **Network Optimization**:
   - HTTP/2 push for critical resources
   - Prefetch next-page data
   - Debounce API calls
   - Request deduplication

---

## 🔔 Phase 4: Advanced PWA Features

### 4.1 Push Notifications

**Backend Setup** (Supabase Edge Function):

```typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { subscription, title, body, data } = await req.json();

  // Send push notification using Web Push protocol
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '86400'
    },
    body: JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data
    })
  });

  return Response.json({ success: response.ok });
});
```

**Frontend Implementation**:

```typescript
// src/utils/pushNotifications.ts
export async function subscribeToPushNotifications(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        import.meta.env.VITE_VAPID_PUBLIC_KEY
      )
    });

    // Save subscription to database
    await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: subscription.toJSON(),
        created_at: new Date().toISOString()
      });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}
```

**Notification Types**:
1. **Agent Message Received**: New message from agent
2. **Task Completed**: Scheduled task finished
3. **Integration Alert**: OAuth token expiring
4. **Team Invitation**: Invited to new team
5. **System Update**: New features available

### 4.2 App Shortcuts & Quick Actions

Already configured in manifest.json with:
- **New Chat** shortcut
- **Agents** shortcut

**Add Dynamic Shortcuts**:

```typescript
// src/utils/shortcuts.ts
export async function updateDynamicShortcuts(recentAgents: Agent[]) {
  if (!('setAppBadge' in navigator)) return;

  const shortcuts = recentAgents.slice(0, 4).map((agent, index) => ({
    name: `Chat with ${agent.name}`,
    short_name: agent.name,
    description: `Start conversation with ${agent.name}`,
    url: `/agents/${agent.id}/chat`,
    icons: [{ src: agent.avatar_url || '/icons/default-agent.png', sizes: '96x96' }]
  }));

  // Note: Dynamic shortcuts API is still experimental
  if ('shortcuts' in navigator) {
    await (navigator as any).shortcuts.update(shortcuts);
  }
}
```

### 4.3 Share Target API

**Handle Shared Content**:

**Create**: `src/pages/ShareHandlerPage.tsx`

```typescript
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ShareHandlerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/share');
      return;
    }

    const title = searchParams.get('title');
    const text = searchParams.get('text');
    const url = searchParams.get('url');

    // Store shared content in localStorage
    const sharedContent = {
      title,
      text,
      url,
      timestamp: Date.now()
    };

    localStorage.setItem('shared_content', JSON.stringify(sharedContent));

    // Redirect to agents page to select agent
    navigate('/agents?action=share');
  }, [user, searchParams, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Processing shared content...</h2>
      </div>
    </div>
  );
}
```

### 4.4 App Badging API

**Show Unread Message Count**:

```typescript
// src/utils/appBadge.ts
export function setAppBadge(count: number) {
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      (navigator as any).setAppBadge(count);
    } else {
      (navigator as any).clearAppBadge();
    }
  }
}

// Usage in chat system
useEffect(() => {
  const unreadCount = conversations.filter(c => c.unread_count > 0)
    .reduce((sum, c) => sum + c.unread_count, 0);
  
  setAppBadge(unreadCount);
}, [conversations]);
```

---

## 🧪 Phase 5: Testing & Launch

### 5.1 Testing Checklist

**PWA Audit**:
- [ ] Lighthouse PWA score > 90
- [ ] Manifest validation passed
- [ ] Service worker registered correctly
- [ ] Offline functionality works
- [ ] Install prompt appears
- [ ] Icons display correctly

**Mobile Testing**:
- [ ] iPhone (Safari) - iOS 15+
- [ ] Android (Chrome) - Android 10+
- [ ] iPad (Safari)
- [ ] Android Tablet (Chrome)
- [ ] Various screen sizes (375px to 428px)

**Feature Testing**:
- [ ] Install on home screen
- [ ] Offline chat loading
- [ ] Message queue when offline
- [ ] Push notifications (if enabled)
- [ ] Share target functionality
- [ ] Swipe gestures
- [ ] Bottom navigation
- [ ] Keyboard handling

**Performance Testing**:
- [ ] Lighthouse performance > 90
- [ ] First load < 3s on 3G
- [ ] Smooth 60fps scrolling
- [ ] No layout shifts
- [ ] Memory usage < 100MB

### 5.2 Browser Compatibility Matrix

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Web App Manifest | ✅ | ✅ | ✅ | ✅ |
| Install Prompt | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ (iOS 16.4+) | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |
| Share Target | ✅ | ✅ (iOS 15+) | ❌ | ✅ |
| App Shortcuts | ✅ | ❌ | ❌ | ✅ |
| Badge API | ✅ | ❌ | ❌ | ✅ |

### 5.3 Monitoring & Analytics

**PWA-Specific Metrics**:
- Install rate (install events / visits)
- Retention rate (7-day, 30-day)
- Offline usage percentage
- Service worker cache hit rate
- Update adoption rate

**Implementation**:

```typescript
// src/utils/analytics.ts
export function trackPWAEvent(event: string, data?: any) {
  // Send to analytics service
  if (window.gtag) {
    window.gtag('event', event, {
      event_category: 'PWA',
      ...data
    });
  }
}

// Track install
window.addEventListener('appinstalled', () => {
  trackPWAEvent('pwa_installed');
});

// Track display mode
if (window.matchMedia('(display-mode: standalone)').matches) {
  trackPWAEvent('pwa_launched', { mode: 'standalone' });
}
```

### 5.4 Deployment Checklist

**Pre-Deployment**:
- [ ] Generate all required icons
- [ ] Create iOS splash screens
- [ ] Test service worker caching
- [ ] Validate manifest.json
- [ ] Update environment variables
- [ ] Test on real devices

**Deployment**:
- [ ] Build production bundle
- [ ] Deploy to hosting (Netlify/Vercel)
- [ ] Verify HTTPS configuration
- [ ] Test service worker registration
- [ ] Monitor error logs

**Post-Deployment**:
- [ ] Monitor Lighthouse scores
- [ ] Track install rates
- [ ] Monitor service worker errors
- [ ] Gather user feedback
- [ ] Iterate on mobile UX

---

## 📊 Success Metrics

### Key Performance Indicators

**Technical Metrics**:
- **Lighthouse PWA Score**: Target > 95
- **Performance Score**: Target > 90
- **Accessibility Score**: Target > 95
- **SEO Score**: Target > 95

**User Metrics**:
- **Install Rate**: Target > 10% of mobile users
- **7-Day Retention**: Target > 40%
- **30-Day Retention**: Target > 25%
- **Offline Usage**: Target > 5% of sessions

**Engagement Metrics**:
- **Session Duration**: Increase by 30%
- **Daily Active Users**: Increase by 25%
- **Mobile Conversion**: Increase by 40%

---

## 🚀 Rollout Strategy

### Phase Rollout Plan

**Week 1-2**: Internal Testing
- Deploy to staging environment
- Internal team testing
- Fix critical bugs

**Week 3-4**: Beta Testing
- Invite 50-100 beta testers
- Gather feedback
- Iterate on mobile UX

**Week 5-6**: Gradual Rollout
- 10% of users see install prompt
- Monitor metrics and errors
- Increase to 50% if successful

**Week 7-8**: Full Launch
- 100% rollout
- Marketing push
- Monitor and optimize

---

## 📝 Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1-2 | Phase 1: PWA Core | Manifest, Service Worker, Icons |
| 3-4 | Phase 2: Mobile UI | Bottom Nav, Touch Gestures, Mobile Components |
| 5-6 | Phase 3: Offline | Caching Strategy, Background Sync, Performance |
| 7-8 | Phase 4: Advanced | Push Notifications, Shortcuts, Share Target |
| 9-10 | Phase 5: Testing | Comprehensive Testing, Monitoring, Launch |

**Total Estimated Time**: 10 weeks

---

## 🔗 Resources & References

### Documentation
- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev PWA](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

### Tools
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [PWA Builder](https://www.pwabuilder.com/)
- [Maskable.app](https://maskable.app/) - Icon generator
- [Splash Screen Generator](https://appsco.pe/developer/splash-screens)

### Testing
- [BrowserStack](https://www.browserstack.com/) - Cross-device testing
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - PWA debugging
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Auditing

---

## 🎯 Next Steps

1. **Review & Approve Plan**: Stakeholder review and approval
2. **Set Up Project Board**: Create tasks in project management tool
3. **Assign Resources**: Allocate developer time
4. **Create Icons**: Design and generate all required assets
5. **Begin Phase 1**: Start with PWA core setup

---

**Document Status**: Draft for Review  
**Last Updated**: October 22, 2025  
**Next Review**: Upon approval to proceed

