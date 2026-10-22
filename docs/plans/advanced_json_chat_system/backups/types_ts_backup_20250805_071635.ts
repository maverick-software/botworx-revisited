// src/lib/mcp/types.ts

// --- Core MCP Structures (Based on https://modelcontextprotocol.io/specification/) ---

/**
 * Represents information about the host application (Agentopia)
 */
export interface MCPHostInformation {
  name: string; // e.g., "Agentopia"
  version: string; // Agentopia version
  // Potentially add agent-specific info if needed by servers
}

/**
 * Represents information about the client connector (within Agentopia)
 */
export interface MCPClientInformation {
  name: string; // e.g., "Agentopia-MCP-Connector"
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
  // Features the Agentopia client supports
  sampling?: boolean | object; // e.g., if Agentopia allows server-initiated sampling
  // Potentially other capabilities Agentopia offers to servers
}

// --- Agentopia-Specific Context Data Sent to Server ---

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
 * Union type for context data Agentopia might send
 */
export type AgentopiaContextData = AgentContextResource | ConversationHistoryResource | UserInputResource; // Add more as needed

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
 * Example: Server requesting tool execution (Less common for Agentopia client)
 */
export interface ServerToolCallRequest {
  toolName: string;
  arguments: Record<string, any>;
  // Correlation ID to match response
}

/**
 * Example: Response from Agentopia after executing a tool (If Agentopia exposes tools)
 */
export interface ClientToolExecutionResult {
  // Correlation ID from request
  success: boolean;
  result?: any;
  error?: string;
}

// --- MCP Server Configuration (Matches DB schema, excludes sensitive/DB-only fields) ---
export interface MCPServerConfig {
  id: number; // DB ID
  config_id: number;
  name: string;
  endpoint_url: string;
  vault_api_key_id?: string | null; // UUID reference to Vault secret
  timeout_ms: number;
  max_retries: number;
  retry_backoff_ms: number;
  priority: number;
  is_active: boolean;
  capabilities?: MCPServerCapabilities | null; // Store discovered capabilities
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