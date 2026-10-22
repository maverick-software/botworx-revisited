/**
 * DigitalOcean Integration
 * Complete DigitalOcean API integration with MCP tools support
 */

// Components
export { DigitalOceanIntegrationCard } from './components/DigitalOceanIntegrationCard';
export { DigitalOceanSetupModal } from './components/DigitalOceanSetupModal';

// Hooks
export { 
  useDigitalOceanConnection,
  useAgentDigitalOceanPermissions,
  DIGITALOCEAN_SCOPES,
  DEFAULT_DIGITALOCEAN_SCOPES,
  type DigitalOceanConnection,
  type AgentDigitalOceanPermission
} from './hooks/useDigitalOceanIntegration';

// Core DigitalOcean API Services
export { 
  createDigitalOceanDroplet,
  listDigitalOceanDroplets,
  deleteDigitalOceanDroplet,
  getDropletById
} from './services/digitalocean_service/droplets';

export type {
  CreateDropletServiceOptions,
  DigitalOceanDroplet
} from './services/digitalocean_service/types';

// MCP Tools
export { 
  DigitalOceanMCPToolsService,
  DIGITALOCEAN_MCP_TOOLS,
  type MCPTool,
  type MCPToolResult,
  type MCPToolExecutionContext
} from './services/digitalocean-tools';