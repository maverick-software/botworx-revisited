import type { AgentDiscordConnection } from '@/types';

// Common interfaces used across Discord components
export interface BotGuild {
  id: string;
  name: string;
}

export interface DiscordConnectProps {
  connection: Partial<AgentDiscordConnection>;
  hasCredentials: boolean;
  onConnectionChange: (field: keyof AgentDiscordConnection | 'guild_id' | 'discord_app_id' | 'discord_public_key', value: any) => void;
  saveDiscordBotToken: (token: string) => Promise<void>;
  discord_app_id?: string | null;
  onGenerateInviteLink: () => Promise<string | null>;
  isGeneratingInvite: boolean;
  isSavingToken: boolean;
  workerStatus?: AgentDiscordConnection['worker_status'];
  onActivate: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  isActivating: boolean;
  isDeactivating: boolean;
  className?: string;
  allGuilds: BotGuild[];
  currentGuildId?: string | null;
  showStatusToggle?: boolean;
}

export interface DiscordStatusToggleProps {
  workerStatus: string; 
  onActivate: () => void; 
  onDeactivate: () => void;
  isActivating: boolean;
  isDeactivating: boolean;
  isWorkerBusy: boolean;
  canActivate: boolean;
} 