/**
 * Shared Integration Utilities
 * Common components, hooks, and services used across all integrations
 */

// Components
export { CredentialSelector } from './components/CredentialSelector';

// Hooks  
export { useConnections } from './hooks/useConnections';
export { 
  useIntegrationCategories, 
  useIntegrationsByCategory,
  useIntegrationsByClassification, 
  useIntegrationStats, 
  useUserIntegrations 
} from './hooks/useIntegrations';
export { 
  useAgentIntegrationPermissions, 
  getAgentIntegrationPermissions 
} from './hooks/useAgentIntegrationPermissions';

// Services
export { VaultService } from './services/VaultService';
export * from './services/connections';

// Integration Setup Registry
export { 
  integrationSetupRegistry,
  getIntegrationSetupComponent,
  getIntegrationCapabilities,
  getIntegrationDefaultScopes,
  getIntegrationCredentialType
} from './registry/IntegrationSetupRegistry';

// Types
export type { IntegrationSetupProps, IntegrationSetupComponent, IntegrationSetupRegistryEntry } from './types/IntegrationSetup';
