/**
 * MCP Tool Provider
 * 
 * Integrates MCP tools with the existing function calling system
 * Handles tool execution through MCP clients and result formatting
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface MCPToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  content?: string;
  execution_time_ms?: number;
  metadata?: Record<string, any>;
}

export interface MCPToolCall {
  connectionId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export class MCPToolProvider {
  constructor(
    private supabase: SupabaseClient,
    private authToken?: string
  ) {}

  /**
   * Execute an MCP tool
   */
  async executeTool(
    agentId: string,
    userId: string,
    toolCall: MCPToolCall
  ): Promise<MCPToolExecutionResult> {
    const startTime = Date.now();

    try {
      console.log(`[MCPProvider] Executing tool ${toolCall.toolName} for agent ${agentId}`);

      // Validate that the connection belongs to the agent
      const { data: connection, error: connectionError } = await this.supabase
        .from('agent_mcp_connections')
        .select('*')
        .eq('id', toolCall.connectionId)
        .eq('agent_id', agentId)
        .single();

      if (connectionError || !connection) {
        return {
          success: false,
          error: 'MCP connection not found or access denied',
          execution_time_ms: Date.now() - startTime
        };
      }

      if (!connection.is_active) {
        return {
          success: false,
          error: 'MCP connection is inactive',
          execution_time_ms: Date.now() - startTime
        };
      }

      // Execute the tool through the MCP client
      const result = await this.callMCPTool(
        connection.server_url,
        toolCall.toolName,
        toolCall.arguments
      );

      const executionTime = Date.now() - startTime;

      // Log the execution
      await this.logToolExecution(
        agentId,
        userId,
        toolCall.toolName,
        toolCall.arguments,
        result,
        executionTime
      );

      return {
        ...result,
        execution_time_ms: executionTime,
        metadata: {
          connection_id: toolCall.connectionId,
          connection_name: connection.connection_name,
          server_url: connection.server_url
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.error(`[MCPProvider] Tool execution failed:`, error);

      const errorResult: MCPToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        execution_time_ms: executionTime
      };

      // Log the failed execution
      await this.logToolExecution(
        agentId,
        userId,
        toolCall.toolName,
        toolCall.arguments,
        errorResult,
        executionTime
      );

      return errorResult;
    }
  }

  /**
   * Get available MCP tools for an agent
   */
  async getAvailableTools(agentId: string): Promise<{
    name: string;
    description: string;
    parameters: any;
    _mcpConnectionId: string;
    _mcpToolName: string;
  }[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_agent_mcp_tools', { p_agent_id: agentId });

      if (error) {
        console.error('[MCPProvider] Failed to fetch MCP tools:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row.openai_schema,
        _mcpConnectionId: row.connection_id,
        _mcpToolName: row.tool_name
      }));
    } catch (error) {
      console.error('[MCPProvider] Error fetching MCP tools:', error);
      return [];
    }
  }

  /**
   * Check if a tool name is an MCP tool
   */
  isMCPTool(toolName: string): boolean {
    // MCP tools are prefixed with connection info in our system
    // This is a simple check - in practice, you might want a more robust method
    return toolName.includes('_mcp_') || toolName.startsWith('zapier_');
  }

  /**
   * Parse MCP tool call from function name and arguments
   */
  parseMCPToolCall(functionName: string, functionArgs: string): MCPToolCall | null {
    try {
      const args = JSON.parse(functionArgs);
      
      // Extract connection ID and tool name from the function call
      // This assumes the function name contains MCP metadata
      if (args._mcpConnectionId && args._mcpToolName) {
        const { _mcpConnectionId, _mcpToolName, ...toolArgs } = args;
        
        return {
          connectionId: _mcpConnectionId,
          toolName: _mcpToolName,
          arguments: toolArgs
        };
      }

      return null;
    } catch (error) {
      console.error('[MCPProvider] Failed to parse MCP tool call:', error);
      return null;
    }
  }

  /**
   * Call MCP tool directly
   */
  private async callMCPTool(
    serverUrl: string,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<MCPToolExecutionResult> {
    // Import MCP client from local lib
    const { MCPClient } = await import('../lib/mcp-client.ts');
    
    const client = new MCPClient(serverUrl);
    
    try {
      await client.initialize();
      const result = await client.callTool(toolName, arguments_);
      await client.disconnect();
      
      // Convert MCP result to standard format
      return {
        success: !result.isError,
        result: result.content?.[0]?.text || JSON.stringify(result),
        error: result.isError ? (result.content?.[0]?.text || 'Tool execution failed') : undefined
      };
    } catch (error) {
      await client.disconnect();
      throw error;
    }
  }

  /**
   * Log tool execution for audit and debugging
   */
  private async logToolExecution(
    agentId: string,
    userId: string,
    toolName: string,
    arguments_: Record<string, any>,
    result: MCPToolExecutionResult,
    executionTimeMs: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('tool_execution_logs')
        .insert({
          agent_id: agentId,
          user_id: userId,
          tool_name: toolName,
          tool_provider: 'mcp',
          arguments: arguments_,
          result: result.result,
          success: result.success,
          error_message: result.error,
          execution_time_ms: executionTimeMs,
          metadata: result.metadata
        });
    } catch (error) {
      console.error('[MCPProvider] Failed to log tool execution:', error);
      // Don't throw here - logging failures shouldn't break tool execution
    }
  }

  /**
   * Refresh tools for all agent connections
   */
  async refreshAgentTools(agentId: string): Promise<void> {
    try {
      // This would typically be called periodically or when connections change
      const { ZapierMCPManager } = await import('../../../src/lib/mcp/zapier-mcp-manager.ts');
      
      // Note: In a real implementation, you'd need to pass the user ID
      // For now, we'll skip the refresh in the Edge Function context
      console.log(`[MCPProvider] Tool refresh requested for agent ${agentId}`);
    } catch (error) {
      console.error('[MCPProvider] Failed to refresh agent tools:', error);
    }
  }

  /**
   * Validate MCP tool arguments
   */
  validateToolArguments(
    toolSchema: any,
    arguments_: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolSchema || !toolSchema.parameters) {
      return { valid: true, errors: [] };
    }

    const { properties, required } = toolSchema.parameters;

    // Check required fields
    if (required && Array.isArray(required)) {
      for (const field of required) {
        if (!(field in arguments_)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Basic type checking (simplified)
    if (properties) {
      for (const [field, value] of Object.entries(arguments_)) {
        const fieldSchema = properties[field];
        if (fieldSchema && fieldSchema.type) {
          const expectedType = fieldSchema.type;
          const actualType = typeof value;
          
          if (expectedType === 'string' && actualType !== 'string') {
            errors.push(`Field ${field} should be a string`);
          } else if (expectedType === 'number' && actualType !== 'number') {
            errors.push(`Field ${field} should be a number`);
          } else if (expectedType === 'boolean' && actualType !== 'boolean') {
            errors.push(`Field ${field} should be a boolean`);
          } else if (expectedType === 'object' && (actualType !== 'object' || value === null)) {
            errors.push(`Field ${field} should be an object`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
