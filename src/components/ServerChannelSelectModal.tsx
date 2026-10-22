import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Server } from 'lucide-react';

// Define a simple type for the expected guild structure
interface DiscordGuild {
  id: string;
  name: string;
  icon?: string; // Optional icon hash
}

interface ServerChannelSelectModalProps {
  guilds: DiscordGuild[]; // Expect an array of guilds
  selectedGuildId?: string | null;
  // selectedChannelId?: string | null; // Add later if channel selection needed
  onSave: (guildId: string | null) => Promise<void>; // Pass only guildId for now
  onClose: () => void;
  loading?: boolean; // For fetch or save operations
}

export function ServerChannelSelectModal({
  guilds = [],
  selectedGuildId = null,
  onSave,
  onClose,
  loading = false,
}: ServerChannelSelectModalProps) {

  const [currentGuildId, setCurrentGuildId] = useState<string | null>(selectedGuildId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sync state if the prop changes from parent
    setCurrentGuildId(selectedGuildId);
  }, [selectedGuildId]);

  const handleSaveClick = async () => {
    setError(null);
    try {
      await onSave(currentGuildId);
      // Parent closes modal on success
    } catch (err: any) {
      setError(err.message || 'Failed to save server selection.');
      console.error("Error in ServerChannelSelectModal save:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Select Discord Server</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Choose the Discord server where you want this agent to be primarily active or respond to commands. Ensure the bot has been invited to the selected server.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        {loading && guilds.length === 0 && (
           <div className="text-center py-6">
             <Loader2 className="animate-spin w-6 h-6 text-indigo-400 mx-auto mb-2" />
             <p className="text-sm text-gray-400">Loading servers...</p>
           </div>
        )}

        {!loading && guilds.length === 0 && (
          <div className="text-center py-6 bg-gray-700/50 rounded border border-dashed border-gray-600">
             <Server className="w-8 h-8 text-gray-500 mx-auto mb-2" />
             <p className="text-sm text-gray-400">No servers found.</p>
             <p className="text-xs text-gray-500 mt-1">Ensure the bot token is correct and the bot has joined at least one server.</p>
           </div>
        )}

        {guilds.length > 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="guildSelect" className="block text-sm font-medium text-gray-300 mb-1">Server</label>
              <select
                id="guildSelect"
                value={currentGuildId ?? ''} // Use empty string for "None" option
                onChange={(e) => setCurrentGuildId(e.target.value || null)}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">-- Select a Server --</option>
                {/* <option value="">(None)</option> */}
                {guilds.map(guild => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Placeholder for Channel selection - Add later if needed */}
            {/* <div>
              <label htmlFor="channelSelect" className="block text-sm font-medium text-gray-300 mb-1">Channel (Optional)</label>
              <select id="channelSelect" disabled={loading || !currentGuildId} className="...">...</select>
            </div> */}
          </div>
        )}

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
            disabled={loading || guilds.length === 0 || currentGuildId === selectedGuildId} // Disable if no change or no guilds
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Selection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 