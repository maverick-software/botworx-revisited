import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Check, Loader2, X, Copy, ExternalLink, Eye, EyeOff, RefreshCw, Save, Server, Settings, Link as LinkIcon, Play, StopCircle, Trash2, Key, Edit, Power } from 'lucide-react';
import type { AgentDiscordConnection } from '@/types';
import { FaDiscord } from 'react-icons/fa';
import { CredentialsModal, SettingsModal, TIMEOUT_OPTIONS } from './DiscordModals';
import { BotGuild, DiscordConnectProps, DiscordStatusToggleProps } from '../types/DiscordTypes';

// Temporary cn function until the correct import is fixed
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

// --- Redesigned Status Toggle ---
// Export the toggle component so AgentEditPage can use it
export function SubtleStatusToggle({ 
  workerStatus,
  onActivate, 
  onDeactivate, 
  isActivating, 
  isDeactivating,
  canActivate
}: Omit<DiscordStatusToggleProps, 'isWorkerBusy'>) { // Simplified props slightly

  const isActive = workerStatus === 'active';
  const isTransitioning = isActivating || isDeactivating;
  const isDisabled = isTransitioning || (!isActive && !canActivate);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDisabled) return;
    if (isActive) {
      onDeactivate();
    } else {
      onActivate();
    }
  };

  // Define base classes and state-specific classes
  const baseClasses = "flex items-center justify-center px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const inactiveClasses = "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500";
  const activeClasses = "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700 hover:border-indigo-800";
  const loadingClasses = "bg-gray-600 border-gray-700 text-gray-400"; // Muted color during transition

  const currentClasses = isTransitioning 
    ? loadingClasses 
    : isActive 
      ? activeClasses 
      : inactiveClasses;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(baseClasses, currentClasses)}
      title={isActive ? "Deactivate Bot" : "Activate Bot"}
    >
      {isTransitioning ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Power size={16} />
      )}
      <span className="ml-2 text-xs font-medium">
        {isActive ? "Bot Active" : "Bot Inactive"} 
      </span>
    </button>
  );
}
// --- End Redesigned Status Toggle ---

// Status toggle component - Kept for reference or potential future use, but replaced by SubtleStatusToggle below
/*
export function DiscordStatusToggle({ 
  workerStatus, 
  onActivate, 
  onDeactivate, 
  isActivating, 
  isDeactivating,
  isWorkerBusy,
  canActivate
}: DiscordStatusToggleProps) {
  // ... existing implementation ...
}
*/

function DiscordConnectComponent({ 
  connection,
  hasCredentials,
  onConnectionChange,
  saveDiscordBotToken,
  discord_app_id,
  onGenerateInviteLink,
  isGeneratingInvite,
  isSavingToken,
  workerStatus,
  onActivate,
  onDeactivate,
  isActivating,
  isDeactivating,
  className = '',
  allGuilds,
  currentGuildId,
  showStatusToggle = true
}: DiscordConnectProps) {
  
  // State management
  const [showFullUI, setShowFullUI] = useState(hasCredentials);

  // Modal states
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Local state for modal inputs
  const placeholderKey = "••••••••••••••••"; // Define placeholder
  const [modalBotKey, setModalBotKey] = useState(() => hasCredentials ? placeholderKey : ''); // Initialize based on initial hasCredentials
  const [modalAppId, setModalAppId] = useState(connection?.discord_app_id || '');
  const [modalPublicKey, setModalPublicKey] = useState(connection?.discord_public_key || '');
  const [localTimeout, setLocalTimeout] = useState(connection?.inactivity_timeout_minutes ?? 10);
  
  const [error, setError] = useState<string | null>(null);

  // Update local state when props change
  useEffect(() => { 
    // Update UI state and placeholder when hasCredentials changes
    setShowFullUI(hasCredentials);
    setModalBotKey(hasCredentials ? placeholderKey : '');
  }, [hasCredentials]);
  
  useEffect(() => { 
    setModalAppId(connection?.discord_app_id || ''); 
  }, [connection?.discord_app_id]);
  
  useEffect(() => { 
    setModalPublicKey(connection?.discord_public_key || ''); 
  }, [connection?.discord_public_key]);

  useEffect(() => {
    setLocalTimeout(connection?.inactivity_timeout_minutes ?? 10);
  }, [connection?.inactivity_timeout_minutes]); 

  // Computed values
  const canActivate = hasCredentials && !!currentGuildId;
  const isWorkerBusy = isActivating || isDeactivating || workerStatus === 'activating' || workerStatus === 'stopping';

  // Modal handlers
  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  const handleSaveChangesFromCredentialsModal = async () => {
    // Apply App ID and Public Key changes immediately to parent (synchronous part)
    onConnectionChange('discord_app_id', modalAppId);
    onConnectionChange('discord_public_key', modalPublicKey);
    
    const shouldSaveKey = modalBotKey && modalBotKey !== placeholderKey;
    if (shouldSaveKey) {
      console.log("[DiscordConnect] User entered a new bot key. Attempting to save...");
      try {
        await saveDiscordBotToken(modalBotKey); // Call the save function from props
        // Success: hook will re-fetch details, which might close modal if hasCredentials changes etc.
        // Or, we can close modal explicitly after successful save if desired.
        // For now, let the re-fetch handle UI updates.
        console.log("[DiscordConnect] Bot token save process initiated via hook.");
        // If save is successful and leads to hasCredentials changing, useEffects will handle modal closure/UI update.
        // If modal should always close after attempting save:
        // handleCloseSettingsModal(); 
      } catch (saveError: any) {
        console.error("[DiscordConnect] Error saving bot token via hook:", saveError);
        setError(saveError.message || "Failed to save bot token.");
        // Do not close modal on error, so user can see the error / retry.
      }
    } else {
      console.log("[DiscordConnect] Bot key not changed or is placeholder, skipping key save.");
      // If only App ID/Public Key changed, and no token save attempt, and modal needs to close:
      // handleCloseSettingsModal();
    }
  };
  
  const handleClearCredentials = async () => {
    setModalBotKey('');
    setModalAppId('');
    setModalPublicKey('');
    
    onConnectionChange('discord_app_id', '');
    onConnectionChange('discord_public_key', '');
    
    // Also clear the bot token in the database using the save function
    try {
      await saveDiscordBotToken(''); // Send empty string to clear
      console.log("[DiscordConnect] Bot token cleared via hook.");
    } catch (clearError: any) {
        console.error("[DiscordConnect] Error clearing bot token via hook:", clearError);
        setError(clearError.message || "Failed to clear bot token.");
        // Proceed with deactivation and modal closure even if clearing token fails, 
        // as App ID/Pub Key are already cleared locally.
    }
    
    if (workerStatus === 'active' && !isDeactivating) {
      await onDeactivate();
    }
    handleCloseSettingsModal();
  };

  const handleTimeoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setLocalTimeout(numericValue);
      onConnectionChange('inactivity_timeout_minutes', numericValue);
    }
  };

  const handleGuildChange = (value: string | null) => {
    onConnectionChange('guild_id', value);
  };

  // Handle Generate Invite Link
  const handleGenerateInvite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onGenerateInviteLink();
  };

  // Find the selected server name
  const selectedServer = allGuilds.find(guild => guild.id === currentGuildId);
  
  // Compute interaction endpoint URL
  const interactionEndpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler`;

  // Stop event propagation and prevent default on modal-related interactions
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Toggle rendering removed from here */}
      {/* {showStatusToggle && selectedServer && (
           <div className="flex justify-end mb-3">
             <SubtleStatusToggle
               workerStatus={workerStatus || 'inactive'}
               canActivate={canActivate}
               onActivate={onActivate}
               onDeactivate={onDeactivate}
               isActivating={isActivating}
               isDeactivating={isDeactivating}
             />
           </div>
      )} */}
          
      {/* Server Box */}
      <div className="flex items-start space-x-4 pt-2.5"> 
        {/* Server display box - make it grow */}
        <div 
          className="flex-grow relative flex items-center p-4 bg-[#2e3543] rounded-lg border border-[#484f5c] shadow-md overflow-hidden cursor-pointer hover:bg-[#333a4a] transition-colors"
          onClick={handleModalClick} // Keep click on the box itself
          onMouseDown={handleOpenSettingsModal}
          title="Click to configure Discord connection"
        >
          <div className="absolute top-2 right-2 text-gray-400 hover:text-white">
            <Settings size={16} />
          </div>
          <div className="flex-shrink-0 mr-4 bg-gray-800 p-2.5 rounded-md">
            <Server size={22} className="text-[#5865F2]" />
          </div>
          <div className="flex-grow">
            {selectedServer ? (
              <>
                <div className="text-sm font-medium text-gray-400">Connected to server:</div>
                <div className="text-lg font-semibold text-white">{selectedServer.name}</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-400">Server Status:</div>
                <div className="text-lg font-semibold text-gray-300">Not connected</div>
                <div className="text-xs text-gray-500 mt-1">Click to connect your agent to a Discord server</div>
              </>
            )}
          </div>
          {/* Toggle is removed from here */}
        </div>
      </div>

      <div className="text-sm text-gray-400 mt-2">
        <p>
          Manage your Discord bot configuration and settings here. Visit the{" "}
          <a 
            href="https://discord.com/developers/applications" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Discord Developer Portal
          </a>{" "}
          to create or edit your bot application.
        </p>
        {error && <p className="text-sm text-destructive mt-2">Error: {error}</p>} {/* Display local errors */}
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        currentGuildId={currentGuildId}
        onGuildChange={handleGuildChange}
        localTimeout={localTimeout}
        onTimeoutChange={handleTimeoutChange}
        allGuilds={allGuilds}
        isWorkerBusy={isWorkerBusy}
        interactionEndpointUrl={interactionEndpointUrl}
        onGenerateInviteLink={onGenerateInviteLink}
        isGeneratingInvite={isGeneratingInvite}
        modalBotKey={modalBotKey}
        setModalBotKey={setModalBotKey}
        modalAppId={modalAppId}
        setModalAppId={setModalAppId}
        modalPublicKey={modalPublicKey}
        setModalPublicKey={setModalPublicKey}
        onSave={handleSaveChangesFromCredentialsModal}
        onClear={handleClearCredentials}
        isSavingCredentials={isSavingToken}
        initialTab={hasCredentials ? "server" : "credentials"}
      />
    </div>
  );
}

// Export the memo-wrapped component
export const DiscordConnect = React.memo(DiscordConnectComponent);