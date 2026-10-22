/**
 * SMTP Integration
 * Complete SMTP email integration with multiple provider support
 */

// Components
export { SMTPIntegrationCard } from './components/SMTPIntegrationCard';
export { SMTPSetupModal } from './components/SMTPSetupModal';

// Hooks
export { useSMTPConfigurations } from './hooks/useSMTPConfigurations';
export { useSMTPPermissions } from './hooks/useSMTPPermissions';

// Pages
export { SMTPIntegrationsPage } from './pages/SMTPIntegrationsPage';

// Types
export * from './types/smtp';

// Services
export { smtpMCPTools, SMTPMCPToolsService } from './services/smtp-tools';
