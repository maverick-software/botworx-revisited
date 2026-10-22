import React from 'react';
import { Button } from '@/components/ui/button';
import { SubtleStatusToggle, DiscordConnect } from './DiscordConnect';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { AgentDiscordConnection } from '@/types';
import type { BotGuild as Guild } from '../types/DiscordTypes';

// Define WorkerStatus type based on linter feedback
type WorkerStatus = 'inactive' | 'activating' | 'active' | 'stopping' | 'error';

// Define component props based on actual component signatures
interface AgentDiscordSettingsProps {
  connection: Partial<AgentDiscordConnection> | null;
  hasCredentials: boolean;
  workerStatus: WorkerStatus | undefined; // Allow undefined as per linter feedback
  allGuilds: Guild[];
  isActivating: boolean;
  isDeactivating: boolean;
  isGeneratingInvite: boolean;
  isSavingToken: boolean;
  discordLoading: boolean;
  discordError: string | null;
  // Use onConnectionChange instead of updateConnectionField
  onConnectionChange: (field: keyof AgentDiscordConnection, value: any) => void; 
  saveDiscordBotToken: (token: string) => Promise<void>;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  generateInviteLink: () => Promise<string | null>;
}

export const AgentDiscordSettings: React.FC<AgentDiscordSettingsProps> = ({
  connection,
  hasCredentials,
  workerStatus,
  allGuilds,
  isActivating,
  isDeactivating,
  isGeneratingInvite,
  isSavingToken,
  discordLoading,
  discordError,
  onConnectionChange, // Correct prop name
  saveDiscordBotToken,
  activate,
  deactivate,
  generateInviteLink
}) => {
  
  // Calculate canActivate for the toggle
  const canActivateToggle = hasCredentials && !!connection?.guild_id;

  return (
    <div className="space-y-4">
      {discordLoading && <p className="text-sm text-muted-foreground">Loading Discord info...</p>}
      {discordError && <p className="text-sm text-destructive">Error: {discordError}</p>}
      
      {!discordLoading && (
        <>
          {/* DiscordConnect Component */}
          <DiscordConnect
            connection={connection || {}}
            hasCredentials={hasCredentials} // Pass this prop
            onConnectionChange={onConnectionChange} // Correct prop name
            saveDiscordBotToken={saveDiscordBotToken}
            allGuilds={allGuilds}
            discord_app_id={connection?.discord_app_id}
            onGenerateInviteLink={generateInviteLink}
            isGeneratingInvite={isGeneratingInvite}
            isSavingToken={isSavingToken}
            workerStatus={workerStatus}
            onActivate={activate}
            onDeactivate={deactivate}
            isActivating={isActivating}
            isDeactivating={isDeactivating}
            currentGuildId={connection?.guild_id}
          />
        </>
      )}
    </div>
  );
}; 