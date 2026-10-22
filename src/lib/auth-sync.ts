/**
 * Multi-Tab Authentication Synchronization
 * 
 * This utility ensures that auth state changes (login/logout) are synchronized
 * across all browser tabs in real-time using BroadcastChannel API with 
 * localStorage fallback for older browsers.
 */

type AuthSyncEvent = 'LOGOUT' | 'LOGIN' | 'TOKEN_REFRESH';

interface AuthSyncMessage {
  type: AuthSyncEvent;
  timestamp: number;
  userId?: string;
}

type AuthSyncCallback = (event: AuthSyncEvent, data?: any) => void;

class AuthSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<AuthSyncCallback>();
  private readonly channelName = 'agentopia-auth-sync';
  private readonly storageKey = 'agentopia-auth-event';
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    // Try to use BroadcastChannel API (modern browsers)
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        console.log('[AuthSync] BroadcastChannel initialized');
      } catch (error) {
        console.warn('[AuthSync] BroadcastChannel failed, falling back to localStorage:', error);
        this.channel = null;
      }
    } else {
      console.log('[AuthSync] BroadcastChannel not supported, using localStorage');
    }

    // Always listen to storage events as fallback/backup
    window.addEventListener('storage', this.handleStorageEvent);

    // Listen for Supabase's own storage events
    window.addEventListener('storage', this.handleSupabaseStorageEvent);

    this.isInitialized = true;
  }

  private handleMessage(message: AuthSyncMessage): void {
    if (!message || !message.type) return;

    console.log('[AuthSync] Received message:', message);

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(message.type, { 
          timestamp: message.timestamp,
          userId: message.userId 
        });
      } catch (error) {
        console.error('[AuthSync] Error in listener:', error);
      }
    });
  }

  private handleStorageEvent = (event: StorageEvent): void => {
    // Handle our custom auth events
    if (event.key === this.storageKey && event.newValue) {
      try {
        const message: AuthSyncMessage = JSON.parse(event.newValue);
        this.handleMessage(message);
      } catch (error) {
        console.error('[AuthSync] Error parsing storage event:', error);
      }
    }
  };

  private handleSupabaseStorageEvent = (event: StorageEvent): void => {
    // Detect when Supabase session is removed from localStorage
    // Supabase stores session data with keys like "sb-<project-ref>-auth-token"
    if (event.key && event.key.includes('sb-') && event.key.includes('auth-token')) {
      if (event.oldValue && !event.newValue) {
        // Session was removed (logout)
        console.log('[AuthSync] Detected Supabase session removal in localStorage');
        this.handleMessage({
          type: 'LOGOUT',
          timestamp: Date.now()
        });
      } else if (!event.oldValue && event.newValue) {
        // Session was added (login)
        console.log('[AuthSync] Detected Supabase session addition in localStorage');
        this.handleMessage({
          type: 'LOGIN',
          timestamp: Date.now()
        });
      }
    }
  };

  /**
   * Broadcast an auth event to all other tabs
   */
  broadcast(type: AuthSyncEvent, userId?: string): void {
    const message: AuthSyncMessage = {
      type,
      timestamp: Date.now(),
      userId
    };

    console.log('[AuthSync] Broadcasting:', message);

    // Use BroadcastChannel if available
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (error) {
        console.error('[AuthSync] BroadcastChannel error:', error);
      }
    }

    // Always use localStorage as fallback/backup
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(message));
      // Clear it immediately so the same event can be detected again
      setTimeout(() => {
        try {
          localStorage.removeItem(this.storageKey);
        } catch (e) {
          // Ignore errors
        }
      }, 100);
    } catch (error) {
      console.error('[AuthSync] localStorage error:', error);
    }
  }

  /**
   * Add a listener for auth events from other tabs
   */
  addListener(callback: AuthSyncCallback): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Remove a specific listener
   */
  removeListener(callback: AuthSyncCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    window.removeEventListener('storage', this.handleStorageEvent);
    window.removeEventListener('storage', this.handleSupabaseStorageEvent);
    
    this.listeners.clear();
    this.isInitialized = false;
    
    console.log('[AuthSync] Destroyed');
  }
}

// Export singleton instance
export const authSync = new AuthSyncManager();

// Export types
export type { AuthSyncEvent, AuthSyncCallback };

