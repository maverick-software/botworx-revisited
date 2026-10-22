/**
 * Web Search Integration
 * Multi-provider web search integration (Serper, SerpAPI, Brave)
 */

// Components
export { WebSearchIntegrationCard } from './components/WebSearchIntegrationCard';
export { WebSearchSetupModal } from './components/WebSearchSetupModal';

// Hooks
export { 
  useWebSearchConnection,
  useAgentWebSearchPermissions,
  type WebSearchConnection,
  type AgentWebSearchPermission
} from './hooks/useWebSearchIntegration';

// Provider configurations can be added here as needed
