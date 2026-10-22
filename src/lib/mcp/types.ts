// src/lib/mcp/types.ts

// --- Core MCP Structures (Based on https://modelcontextprotocol.io/specification/) ---

/**
 * Represents information about the host application (Gofr Agents)
 */
export interface MCPHostInformation {
  name: string; // e.g., "Gofr Agents"
  version: string; // Gofr Agents version
  // Potentially add agent-specific info if needed by servers
}

/**
 * Represents information about the client connector (within Gofr Agents)
 */
export interface MCPClientInformation {
  name: string; // e.g., "Gofr-Agents-MCP-Connector"
  version: string; // Connector version
}

/**
 * Represents server-reported capabilities after initialization
 */
export interface MCPServerCapabilities {
  // Standard MCP features the server supports
  resources?: boolean | object; // Details on resource support
  prompts?: boolean | object;   // Details on prompt support
  tools?: boolean | object;     // Details on tool support
  sampling?: boolean | object;  // Details on sampling support
  // Custom capabilities specific to the server
  [key: string]: any;
}

/**
 * Represents client-reported capabilities
 */
export interface MCPClientCapabilities {
  // Features the Gofr Agents client supports
  sampling?: boolean | object; // e.g., if Gofr Agents allows server-initiated sampling
  // Potentially other capabilities Gofr Agents offers to servers
}

// --- Gofr Agents-Specific Context Data Sent to Server ---

/**
 * Structure for packaging Agent context sent via mcp/resources or similar
 */
export interface AgentContextResource {
  type: 'agentContext'; // Custom resource type
  id: string; // Agent ID
  name: string;
  personality: string;
  systemInstructions?: string;
  assistantInstructions?: string;
  // Add other relevant agent data based on server needs/capabilities
}

/**
 * Structure for packaging conversation history
 */
export interface ConversationHistoryResource {
  type: 'conversationHistory';
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }>;
  // Max history length might be determined by server capabilities
}

/**
 * Structure for packaging the latest user input
 */
export interface UserInputResource {
  type: 'userInput';
  content: string;
  timestamp: string;
}

/**
 * Union type for context data Gofr Agents might send
 */
export type GofrAgentsContextData = AgentContextResource | ConversationHistoryResource | UserInputResource; // Add more as needed

// --- Data Structures for Server Responses ---

/**
 * Example: Server providing updated context data
 */
export interface ServerResourceUpdate {
  type: string; // e.g., 'externalKnowledge', 'userData'
  id: string;
  content: any; // Structure defined by the server/capability
  // Metadata like source, timestamp, relevance score
}

/**
 * Example: Server requesting tool execution (Less common for Gofr Agents client)
 */
export interface ServerToolCallRequest {
  toolName: string;
  arguments: Record<string, any>;
  // Correlation ID to match response
}

/**
 * Example: Response from Gofr Agents after executing a tool (If Gofr Agents exposes tools)
 */
export interface ClientToolExecutionResult {
  // Correlation ID from request
  success: boolean;
  result?: any;
  error?: string;
}

// --- Toolbox Configuration (Matches relevant parts of DB schema for what might be configured or displayed) ---
// This was MCPServerConfig. It described a server entry linked to an mcp_configuration.
// It will be re-evaluated in the context of Toolboxes, Deployed Services, and Agent Toolbelt items.
export interface MCPServerConfig {
  id: number; // DB ID of the mcp_servers record
  config_id: number; // DB ID of the parent mcp_configurations record
  name: string; // User-defined name for the server/connection
  endpoint_url: string; // The actual URL of the external MCP server
  vault_api_key_id?: string | null; // UUID reference to Vault secret for API key
  timeout_ms: number;
  max_retries: number;
  retry_backoff_ms: number;
  priority: number; // For ordering if multiple servers are used for an agent
  is_active: boolean;
  capabilities?: MCPServerCapabilities | null; // Store discovered capabilities from the server
}

// --- Aggregated Results (Internal to MCPManager) ---

/**
 * Structure held by MCPManager after querying multiple servers
 */
export interface AggregatedMCPResults {
  resources: ServerResourceUpdate[];
  // toolCalls: ServerToolCallRequest[]; // If needed
  errors: Array<{ serverId: number; error: Error }>;
} 