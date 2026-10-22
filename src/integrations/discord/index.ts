/**
 * Discord Integration
 * Discord bot and server integration for community management
 */

// Components
export { DiscordConnect, SubtleStatusToggle } from './components/DiscordConnect';
export { CredentialsModal, SettingsModal, TIMEOUT_OPTIONS } from './components/DiscordModals';
export { DiscordSetupModal } from './components/DiscordSetupModal';
export { AgentDiscordSettings } from './components/AgentDiscordSettings';

// Hooks
export { 
  useAgentDiscordConnection,
  type UseAgentDiscordConnectionReturn 
} from './hooks/useAgentDiscordConnection';
export { useAgentDiscordConnection_refactored } from './hooks/useAgentDiscordConnection_refactored';

// Types
export { 
  type BotGuild,
  type DiscordConnectProps,
  type DiscordStatusToggleProps
} from './types/DiscordTypes';

// Pages
export { Discord } from './pages/Discord';
