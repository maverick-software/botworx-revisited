import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

interface AppIdPublicKeyModalProps {
  initialAppId?: string;
  initialPublicKey?: string;
  onSave: (appId: string, publicKey: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function AppIdPublicKeyModal({
  initialAppId = '',
  initialPublicKey = '',
  onSave,
  onClose,
  loading = false,
}: AppIdPublicKeyModalProps) {
  const [appId, setAppId] = useState(initialAppId);
  const [publicKey, setPublicKey] = useState(initialPublicKey);
  const [error, setError] = useState<string | null>(null);

  const handleSaveClick = async () => {
    if (!appId.trim() || !publicKey.trim()) {
      setError('Both Application ID and Public Key are required.');
      return;
    }
    setError(null);
    try {
      await onSave(appId, publicKey);
      // onClose(); // Parent component (AgentEdit) will close the modal on successful save
    } catch (err: any) {
      // Error handling might be done in the parent, but we can show a local one too
      setError(err.message || 'Failed to save details.');
      console.error("Error in AppIdPublicKeyModal save:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Enter Discord Application Details</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Paste your Discord Application ID and Public Key below. You can find these in the{' '}
          <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
             Discord Developer Portal
          </a>.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="appId" className="block text-sm font-medium text-gray-300 mb-1">Application ID *</label>
            <input
              type="text"
              id="appId"
              required
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Paste Application ID here"
            />
          </div>
          <div>
            <label htmlFor="publicKey" className="block text-sm font-medium text-gray-300 mb-1">Public Key *</label>
            <input
              type="text"
              id="publicKey"
              required
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder="Paste Public Key here"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 mt-2 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !appId.trim() || !publicKey.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save & Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 