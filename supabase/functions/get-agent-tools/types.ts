/**
 * Type definitions for the Get Agent Tools function
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  status: 'active' | 'expired' | 'error';
  error_message?: string;
  provider_name: string;
  connection_name: string;
}

export interface AgentToolsResponse {
  success: boolean;
  tools?: ToolDefinition[];
  error?: string;
  metadata?: {
    agent_id: string;
    user_id: string;
    provider_count: number;
    total_tools: number;
    cached: boolean;
  };
}

export interface AgentPermission {
  agent_id: string;
  allowed_scopes: string[];
  permission_level: string;
  is_active: boolean;
  user_integration_credentials?: {
    id: string;
    user_id: string;
    oauth_provider_id: string;
    connection_name: string;
    connection_status: string;
    token_expires_at?: string;
  };
}

export interface ServiceProvider {
  id: string;
  name: string;
  display_name: string;
}

export interface CredentialStatus {
  status: 'active' | 'expired' | 'error';
  error_message?: string;
}
