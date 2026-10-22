/**
 * MCP Tool Registration System
 * Following MCP Application Layer Pattern
 * 
 * This system provides:
 * - Tool discovery (tools/list implementation)
 * - Tool execution (tools/call implementation)
 * - Permission validation
 * - Integration with existing Gmail tools
 */

import { gmailMCPTools, MCPTool, MCPToolResult, MCPToolExecutionContext } from '@/integrations/gmail/services/gmail-tools';
import { smtpMCPTools } from '@/integrations/smtp/services/smtp-tools';
import { clicksendMCPTools } from '@/integrations/clicksend/services/clicksend-tools';
import { supabase } from '../supabase';

export interface RegisteredTool extends MCPTool {
  provider: string;
  category: string;
  version: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolExecutionRequest {
  agent_id: string;
  user_id: string;
  tool_name: string;
  tool_provider: string;
  parameters: Record<string, any>;
  context?: Record<string, any>;
}

export interface ToolExecutionResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    quota_consumed?: number;
    tool_version?: string;
    provider?: string;
  };
}

/**
 * MCP Tool Registry Service
 * Manages tool registration, discovery, and execution
 */
export class MCPToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private toolProviders: Map<string, any> = new Map();

  constructor() {
    // Register tool providers - they will check permissions internally
    // DO NOT auto-add tools without permission checks
    this.registerToolProvider('gmail', gmailMCPTools);
    this.registerToolProvider('smtp', smtpMCPTools);
    this.registerToolProvider('clicksend', clicksendMCPTools);
  }

  /**
   * Register a tool provider (e.g., Gmail, Slack, etc.)
   */
  registerToolProvider(providerId: string, provider: any): void {
    this.toolProviders.set(providerId, provider);
    console.log(`MCP Tool Provider registered: ${providerId}`);
  }

  /**
   * Get all available tools for a specific agent
   * Implements tools/list JSON-RPC method
   */
  async getAvailableTools(agentId: string, userId: string): Promise<RegisteredTool[]> {
    const availableTools: RegisteredTool[] = [];

    // Check what email tools the agent has permissions for
    const { data: emailPermissions } = await supabase
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        is_active,
        user_integration_credentials!inner(
          oauth_provider_id,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', agentId)
      .eq('user_integration_credentials.user_id', userId)
      .eq('is_active', true)
      .in('user_integration_credentials.service_providers.name', ['gmail', 'smtp', 'sendgrid', 'mailgun', 'clicksend_sms']);

    // Process email permissions
    for (const permission of emailPermissions || []) {
      const providerName = permission.user_integration_credentials?.service_providers?.name;
      
      if (providerName === 'gmail') {
        // Only add Gmail tools if agent has Gmail permissions
        const gmailTools = await gmailMCPTools.listTools(agentId, userId);
        for (const tool of gmailTools) {
          availableTools.push({
            ...tool,
            provider: 'gmail',
            category: 'email',
            version: '1.0.0',
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } else if (['smtp', 'sendgrid', 'mailgun'].includes(providerName)) {
        // Add SMTP-based email tools for these providers
        // Import SMTP tools when they're created
        if (this.toolProviders.has('smtp')) {
          const smtpProvider = this.toolProviders.get('smtp');
          const smtpTools = await smtpProvider.listTools(agentId, userId);
          for (const tool of smtpTools) {
            availableTools.push({
              ...tool,
              provider: providerName,
              category: 'email',
              version: '1.0.0',
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } else if (providerName === 'clicksend_sms') {
        // Add ClickSend SMS/MMS tools
        const clicksendTools = await clicksendMCPTools.listTools(agentId, userId);
        for (const tool of clicksendTools) {
          availableTools.push({
            ...tool,
            provider: 'clicksend',
            category: 'messaging',
            version: '1.0.0',
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    // Future: Add other tool providers here (Slack, GitHub, etc.)
    
    return availableTools;
  }

  /**
   * Get tools by category
   */
  async getToolsByCategory(category: string, agentId: string, userId: string): Promise<RegisteredTool[]> {
    const allTools = await this.getAvailableTools(agentId, userId);
    return allTools.filter(tool => tool.category === category);
  }

  /**
   * Get tools by provider
   */
  async getToolsByProvider(provider: string, agentId: string, userId: string): Promise<RegisteredTool[]> {
    const allTools = await this.getAvailableTools(agentId, userId);
    return allTools.filter(tool => tool.provider === provider);
  }

  /**
   * Execute a tool
   * Implements tools/call JSON-RPC method
   */
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const startTime = Date.now();
    
    try {
      // Correct any wrong tool names before execution
      const toolNameCorrections: Record<string, string> = {
        'gmail_send_message': 'send_email',
        'gmail_send': 'send_email',
        'gmail_read_messages': 'read_emails',
        'gmail_search': 'search_emails',
        'gmail_search_messages': 'search_emails',
        'gmail_email_actions': 'email_actions',
      };
      
      const correctedToolName = toolNameCorrections[request.tool_name] || request.tool_name;
      const correctedRequest = { ...request, tool_name: correctedToolName };
      
      // Validate tool exists
      const availableTools = await this.getAvailableTools(correctedRequest.agent_id, correctedRequest.user_id);
      const tool = availableTools.find(t => t.name === correctedRequest.tool_name && t.provider === correctedRequest.tool_provider);
      
      if (!tool) {
        return {
          success: false,
          error: `Tool ${correctedRequest.tool_name} not found or not available for this agent`,
          metadata: {
            execution_time_ms: Date.now() - startTime,
            provider: correctedRequest.tool_provider,
          }
        };
      }

      // Route to appropriate provider
      let result: MCPToolResult;
      
      switch (correctedRequest.tool_provider) {
        case 'gmail':
          result = await gmailMCPTools.executeTool({
            agentId: correctedRequest.agent_id,
            userId: correctedRequest.user_id,
            tool: correctedRequest.tool_name,
            parameters: correctedRequest.parameters,
          });
          break;
        
        case 'clicksend':
          result = await clicksendMCPTools.executeTool({
            agentId: correctedRequest.agent_id,
            userId: correctedRequest.user_id,
            tool: correctedRequest.tool_name,
            parameters: correctedRequest.parameters,
          });
          break;
        
        // Future providers
        // case 'slack':
        //   result = await slackMCPTools.executeTool({ ... });
        //   break;
        
        default:
          return {
            success: false,
            error: `Unknown tool provider: ${correctedRequest.tool_provider}`,
            metadata: {
              execution_time_ms: Date.now() - startTime,
              provider: correctedRequest.tool_provider,
            }
          };
      }

      // Log tool execution
      await this.logToolExecution(correctedRequest, result, Date.now() - startTime);

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          quota_consumed: result.metadata?.quota_consumed,
          tool_version: tool.version,
          provider: correctedRequest.tool_provider,
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log error execution
      await this.logToolExecution(request, { success: false, error: errorMessage }, Date.now() - startTime);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: request.tool_provider,
        }
      };
    }
  }

  /**
   * Get tool execution history for an agent
   */
  async getToolExecutionHistory(agentId: string, userId: string, limit = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tool_execution_logs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching tool execution history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching tool execution history:', error);
      return [];
    }
  }

  /**
   * Get tool usage statistics for an agent
   */
  async getToolUsageStats(agentId: string, userId: string): Promise<{
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    tools_used: string[];
    providers_used: string[];
    average_execution_time: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('tool_execution_logs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', userId);

      if (error || !data) {
        return {
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
          tools_used: [],
          providers_used: [],
          average_execution_time: 0,
        };
      }

      const successful = data.filter(log => log.success);
      const failed = data.filter(log => !log.success);
      const toolsUsed = [...new Set(data.map(log => log.tool_name))];
      const providersUsed = [...new Set(data.map(log => log.tool_provider))];
      const avgTime = data.reduce((sum, log) => sum + (log.execution_time_ms || 0), 0) / data.length;

      return {
        total_executions: data.length,
        successful_executions: successful.length,
        failed_executions: failed.length,
        tools_used: toolsUsed,
        providers_used: providersUsed,
        average_execution_time: Math.round(avgTime),
      };
    } catch (error) {
      console.error('Error fetching tool usage stats:', error);
      return {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        tools_used: [],
        providers_used: [],
        average_execution_time: 0,
      };
    }
  }

  /**
   * Validate tool permissions for an agent
   */
  async validateToolPermissions(agentId: string, userId: string, toolName: string, provider: string): Promise<boolean> {
    try {
      const availableTools = await this.getAvailableTools(agentId, userId);
      const tool = availableTools.find(t => t.name === toolName && t.provider === provider);
      return !!tool;
    } catch (error) {
      console.error('Error validating tool permissions:', error);
      return false;
    }
  }

  /**
   * Log tool execution for audit and analytics
   */
  private async logToolExecution(request: ToolExecutionRequest, result: MCPToolResult, executionTime: number): Promise<void> {
    try {
      // Correct any wrong tool names before logging
      const toolNameCorrections: Record<string, string> = {
        'gmail_send_message': 'send_email',
        'gmail_send': 'send_email',
        'gmail_read_messages': 'read_emails',
        'gmail_search': 'search_emails',
        'gmail_search_messages': 'search_emails',
        'gmail_email_actions': 'email_actions',
      };
      
      const correctedToolName = toolNameCorrections[request.tool_name] || request.tool_name;
      
      await supabase
        .from('tool_execution_logs')
        .insert({
          agent_id: request.agent_id,
          user_id: request.user_id,
          tool_name: correctedToolName,
          tool_provider: request.tool_provider,
          parameters: request.parameters,
          result_data: result.data,
          success: result.success,
          error_message: result.error,
          execution_time_ms: executionTime,
          quota_consumed: result.metadata?.quota_consumed || 0,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error logging tool execution:', error);
    }
  }

  /**
   * Get tool schema for validation
   */
  async getToolSchema(toolName: string, provider: string): Promise<any | null> {
    try {
      const providerService = this.toolProviders.get(provider);
      if (!providerService) {
        return null;
      }

      // For Gmail tools, get from static registry
      if (provider === 'gmail') {
        const gmailTools = await import('@/integrations/gmail/services/gmail-tools');
        return gmailTools.GMAIL_MCP_TOOLS[toolName]?.parameters || null;
      }

      // For ClickSend tools, get from static registry
      if (provider === 'clicksend') {
        const clicksendTools = await import('@/integrations/clicksend/services/clicksend-tools');
        return clicksendTools.CLICKSEND_MCP_TOOLS[toolName]?.parameters || null;
      }

      return null;
    } catch (error) {
      console.error('Error getting tool schema:', error);
      return null;
    }
  }

  /**
   * Health check for all registered tool providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [providerId, provider] of this.toolProviders) {
      try {
        // Basic health check - ensure provider is accessible
        health[providerId] = !!provider;
        
        // Could add more sophisticated health checks here
        // e.g., ping provider endpoints, check database connections, etc.
      } catch (error) {
        console.error(`Health check failed for provider ${providerId}:`, error);
        health[providerId] = false;
      }
    }
    
    return health;
  }
}

// Export singleton instance
export const mcpToolRegistry = new MCPToolRegistry();

// Export utility functions
export const registerMCPTool = (tool: RegisteredTool): void => {
  // Future: Add tool registration logic
  console.log('MCP Tool registered:', tool.name);
};

export const unregisterMCPTool = (toolName: string, provider: string): void => {
  // Future: Add tool unregistration logic
  console.log('MCP Tool unregistered:', `${provider}:${toolName}`);
};

/**
 * React hook for MCP tool management
 */
export const useMCPTools = (agentId?: string, userId?: string) => {
  const [tools, setTools] = React.useState<RegisteredTool[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTools = React.useCallback(async () => {
    if (!agentId || !userId) return;

    try {
      setLoading(true);
      setError(null);
      const availableTools = await mcpToolRegistry.getAvailableTools(agentId, userId);
      setTools(availableTools);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  }, [agentId, userId]);

  const executeTool = React.useCallback(async (
    toolName: string,
    provider: string,
    parameters: Record<string, any>
  ): Promise<ToolExecutionResponse> => {
    if (!agentId || !userId) {
      throw new Error('Agent ID and User ID are required');
    }

    return mcpToolRegistry.executeTool({
      agent_id: agentId,
      user_id: userId,
      tool_name: toolName,
      tool_provider: provider,
      parameters,
    });
  }, [agentId, userId]);

  React.useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return {
    tools,
    loading,
    error,
    executeTool,
    refetch: fetchTools,
  };
};

// Add React import if not already imported
import * as React from 'react'; 