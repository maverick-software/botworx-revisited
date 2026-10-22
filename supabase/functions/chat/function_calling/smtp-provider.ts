/**
 * SMTP Tool Provider
 * Handles SMTP email operations with proper deduplication
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { SMTP_MCP_TOOLS, SMTPToolValidator, SMTPToolResultFormatter } from '../smtp-tools.ts';
import { OpenAIFunction, MCPToolResult, ProviderPermission, ToolProvider } from './base.ts';

export class SMTPProvider implements ToolProvider {
  private supabase: SupabaseClient;
  private authToken: string;
  private toolsCache: Map<string, OpenAIFunction[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 0; // Caching disabled for immediate tool updates

  constructor(supabase: SupabaseClient, authToken: string = '') {
    this.supabase = supabase;
    this.authToken = authToken;
  }

  /**
   * Get SMTP tools for an agent with caching and deduplication
   */
  async getTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    const cacheKey = `${agentId}:${userId}`;
    const now = Date.now();

    // Check cache first
    if (this.toolsCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        console.log(`[SMTP] Using cached tools for agent ${agentId}`);
        return this.toolsCache.get(cacheKey) || [];
      }
    }

    try {
      // Check if agent has SMTP permissions using UNIFIED permission system
      const { data: permissions } = await this.supabase
        .from('agent_integration_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_integration_credentials!inner(
            id,
            connection_name,
            oauth_provider_id,
            credential_type,
            service_providers!inner(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.service_providers.name', 'smtp')
        .eq('user_integration_credentials.credential_type', 'api_key')
        .eq('is_active', true)
        .limit(5);

      if (!permissions || permissions.length === 0) {
        console.log(`[SMTP] No SMTP permissions found for agent ${agentId}`);
        this.toolsCache.set(cacheKey, []);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
        return [];
      }

      const grantedScopes = (permissions[0]?.allowed_scopes || []) as string[];
      console.log(`[SMTP] Agent ${agentId} has SMTP scopes:`, grantedScopes);
      console.log(`[SMTP] Available SMTP tool definitions:`, Object.keys(SMTP_MCP_TOOLS));

      // Use Set to prevent duplicates
      const availableToolsSet = new Set<string>();
      const availableTools: OpenAIFunction[] = [];

      // Process permissions but avoid duplicates
      const uniqueConnections = new Map<string, ProviderPermission>();
      for (const permission of permissions) {
        const connectionId = permission.user_integration_credentials?.id;
        if (connectionId && !uniqueConnections.has(connectionId)) {
          uniqueConnections.set(connectionId, permission as ProviderPermission);
        }
      }

      // Add tools for each unique connection
      for (const [connectionId, permission] of uniqueConnections) {
        const connectionName = permission.user_integration_credentials?.connection_name;
        const allowedScopes = permission.allowed_scopes || [];
        
        // Add smtp_send_email tool if permitted
        if (allowedScopes.includes('send_email') && !availableToolsSet.has('smtp_send_email')) {
          const sendEmailTool = SMTP_MCP_TOOLS.smtp_send_email;
          availableTools.push({
            name: sendEmailTool.name,
            description: `${sendEmailTool.description} via ${connectionName}`,
            parameters: sendEmailTool.inputSchema
          });
          availableToolsSet.add('smtp_send_email');
        }
        
        // Add test_connection tool if not already added
        if (!availableToolsSet.has('smtp_test_connection')) {
          const testConnectionTool = SMTP_MCP_TOOLS.smtp_test_connection;
          if (testConnectionTool) {
            availableTools.push({
              name: testConnectionTool.name,
              description: `${testConnectionTool.description} for ${connectionName}`,
              parameters: testConnectionTool.inputSchema
            });
            availableToolsSet.add('smtp_test_connection');
          }
        }
      }

      console.log(`[SMTP] Found ${availableTools.length} SMTP tools for agent ${agentId}`);

      // Cache the results
      this.toolsCache.set(cacheKey, availableTools);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return availableTools;
      
    } catch (error) {
      console.error('[SMTP] Error getting SMTP tools:', error);
      return [];
    }
  }

  /**
   * Validate agent has permission for specific SMTP tool
   */
  async validatePermissions(agentId: string, userId: string, toolName: string): Promise<boolean> {
    const tools = await this.getTools(agentId, userId);
    return tools.some(t => t.name === toolName);
  }

  /**
   * Execute SMTP tool with proper error handling and formatting
   */
  async executeTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[SMTP] Executing ${toolName} for agent ${agentId}`);
      
      // Validate SMTP configuration access
      const configId = parameters.smtp_config_id;
      if (!configId) {
        return {
          success: false,
          error: 'smtp_config_id is required',
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Validate input parameters using SMTP validator
      const validationResult = SMTPToolValidator.validateInput(toolName, parameters);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors.join('; '),
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Execute the specific SMTP tool
      let result: MCPToolResult;

      switch (toolName) {
        case 'smtp_send_email':
          result = await this.executeSendEmail(agentId, userId, parameters);
          break;
        case 'smtp_test_connection':
          result = await this.executeTestConnection(agentId, userId, parameters);
          break;
        default:
          result = {
            success: false,
            error: `Unknown SMTP tool: ${toolName}`,
            metadata: { execution_time_ms: Date.now() - startTime }
          };
      }

      result.metadata = result.metadata || {};
      result.metadata.execution_time_ms = Date.now() - startTime;
      
      return result;

    } catch (error: any) {
      console.error(`[SMTP] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error.message || 'SMTP execution failed',
        metadata: { execution_time_ms: Date.now() - startTime }
      };
    }
  }

  /**
   * Execute SMTP send email
   */
  private async executeSendEmail(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    try {
      // Call the SMTP API Edge Function
      const { data, error } = await this.supabase.functions.invoke('smtp-api', {
        body: {
          action: 'send_email',
          agent_id: agentId,
          user_id: userId,
          ...parameters
        },
        headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}
      });

      if (error) {
        return {
          success: false,
          error: `SMTP API error: ${error.message}`,
          data: error
        };
      }

      return {
        success: true,
        data: data
      };

    } catch (error: any) {
      return {
        success: false,
        error: `SMTP send email failed: ${error.message}`
      };
    }
  }

  /**
   * Execute SMTP test connection
   */
  private async executeTestConnection(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    try {
      // Call the SMTP API Edge Function for testing
      const { data, error } = await this.supabase.functions.invoke('smtp-api', {
        body: {
          action: 'test_connection',
          agent_id: agentId,
          user_id: userId,
          smtp_config_id: parameters.smtp_config_id
        },
        headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}
      });

      if (error) {
        return {
          success: false,
          error: `SMTP test connection error: ${error.message}`,
          data: error
        };
      }

      return {
        success: true,
        data: data
      };

    } catch (error: any) {
      return {
        success: false,
        error: `SMTP test connection failed: ${error.message}`
      };
    }
  }

  /**
   * Clear cache for specific agent (useful for permission updates)
   */
  clearCache(agentId: string, userId: string): void {
    const cacheKey = `${agentId}:${userId}`;
    this.toolsCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.toolsCache.size,
      entries: Array.from(this.toolsCache.keys())
    };
  }
}
