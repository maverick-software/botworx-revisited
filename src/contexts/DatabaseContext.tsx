import React, { createContext, useContext, useState, useEffect } from 'react';
import { isSupabaseConnected } from '../lib/supabase';

interface DatabaseContextType {
  isConnected: boolean;
  isInitializing: boolean;
  error: string | null;
  retryConnection: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const checkConnection = async () => {
    try {
      setError(null);
      const connected = await isSupabaseConnected();
      setIsConnected(connected);
      
      if (!connected) {
        const errorMessage = retryCount >= maxRetries
          ? 'Unable to connect to the database after multiple attempts. Please check your connection and try again later.'
          : 'Unable to connect to the database. Retrying...';
        setError(errorMessage);
        setRetryCount(prev => prev + 1);
      } else {
        setRetryCount(0);
      }
    } catch (err) {
      console.error('Database connection error:', {
        error: err,
        message: err.message,
        stack: err.stack
      });
      setError('Failed to establish database connection. Please try again.');
      setIsConnected(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const retryConnection = async () => {
    setIsInitializing(true);
    setRetryCount(0);
    await checkConnection();
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isConnected && retryCount < maxRetries) {
      timeoutId = setTimeout(() => {
        checkConnection();
      }, Math.min(1000 * Math.pow(2, retryCount), 8000));
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isConnected, retryCount]);

  useEffect(() => {
    checkConnection();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Establishing database connection...</p>
        </div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={{ 
      isConnected, 
      isInitializing, 
      error, 
      retryConnection 
    }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}