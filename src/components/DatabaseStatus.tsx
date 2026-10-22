import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';

export function DatabaseStatus() {
  const { isConnected, error, retryConnection, isInitializing } = useDatabase();

  if (!error) return null;

  return (
    <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center justify-between">
      <span>{error}</span>
      <button
        onClick={retryConnection}
        disabled={isInitializing}
        className="flex items-center px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
        {isInitializing ? 'Retrying...' : 'Try Again'}
      </button>
    </div>
  );
}