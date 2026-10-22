/**
 * Gmail Integration
 * Complete Gmail OAuth and API integration
 */

// Components
export { GmailIntegrationCard } from './components/GmailIntegrationCard';
export { GmailSetupModal } from './components/GmailSetupModal';

// Hooks
export { 
  useGmailConnection,
  useAgentGmailPermissions,
  useGmailOperations,
  type GmailConnection,
  type AgentGmailPermission,
  type EmailMessage
} from './hooks/useGmailIntegration';

// Pages
export { GmailCallbackPage } from './pages/GmailCallbackPage';

// Services
export { GmailMCPToolsService } from './services/gmail-tools';
