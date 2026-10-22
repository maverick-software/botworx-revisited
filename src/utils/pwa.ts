import { useState, useEffect } from 'react';
import { Workbox } from 'workbox-window';

export interface PWAUpdateHandler {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
}

/**
 * Register the PWA service worker with update handlers
 */
export function registerPWA(handlers?: PWAUpdateHandler) {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js');

    // Service Worker update available
    wb.addEventListener('waiting', () => {
      console.log('[PWA] New service worker waiting');
      
      // Show update notification to user
      if (handlers?.onUpdate) {
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

/**
 * Check if app is installed as PWA
 */
export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

/**
 * Get display mode
 */
export function getDisplayMode(): 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser' {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  return 'browser';
}

interface InstallPromptState {
  installPrompt: any | null;
  promptInstall: () => Promise<boolean>;
  isInstalled: boolean;
  isInstallable: boolean;
}

/**
 * Hook to manage PWA install prompt
 */
export function useInstallPrompt(): InstallPromptState {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(isPWAInstalled());
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] Install prompt available');
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setIsInstallable(false);
      console.log('[PWA] App installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed on mount
    if (isPWAInstalled()) {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!installPrompt) {
      console.warn('[PWA] No install prompt available');
      return false;
    }

    try {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      console.log('[PWA] Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstallable(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return false;
    }
  };

  return { installPrompt, promptInstall, isInstalled, isInstallable };
}

/**
 * Check if user dismissed install prompt recently
 */
export function wasInstallPromptDismissed(): boolean {
  const dismissedAt = localStorage.getItem('pwa_install_dismissed_at');
  if (!dismissedAt) return false;

  const dismissedDate = new Date(dismissedAt);
  const now = new Date();
  const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

  // Show again after 7 days
  return daysSinceDismissed < 7;
}

/**
 * Mark install prompt as dismissed
 */
export function dismissInstallPrompt(): void {
  localStorage.setItem('pwa_install_dismissed_at', new Date().toISOString());
}

/**
 * Detect if running on iOS
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Detect if running on iOS Safari (not standalone)
 */
export function isIOSSafari(): boolean {
  return isIOS() && !isPWAInstalled();
}

