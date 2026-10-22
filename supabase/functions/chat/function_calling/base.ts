/**
 * Base interfaces and types for function calling system
 */

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  inputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  required_scopes: string[];
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms?: number;
  };
}

export interface ProviderPermission {
  allowed_scopes: string[];
  is_active: boolean;
  user_integration_credentials?: {
    id?: string;
    connection_name?: string;
    oauth_provider_id?: string;
    credential_type?: string;
    service_providers?: {
      name?: string;
    };
  };
}

export interface ToolProvider {
  getTools(agentId: string, userId: string): Promise<OpenAIFunction[]>;
  executeTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult>;
  validatePermissions(agentId: string, userId: string, toolName: string): Promise<boolean>;
}
