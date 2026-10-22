/**
 * MCP Tool Provider
 * Handles Model Context Protocol (MCP) tools like Zapier integrations
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAIFunction, MCPToolResult, ToolProvider } from './base.ts';

export class MCPProvider implements ToolProvider {
  private supabase: SupabaseClient;
  private authToken: string;
  private toolsCache: Map<string, OpenAIFunction[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private toolMetadataMap: Map<string, { connectionId: string; toolName: string }> = new Map();
  private readonly CACHE_DURATION = 0; // Caching disabled for immediate tool updates

  constructor(supabase: SupabaseClient, authToken: string = '') {
    this.supabase = supabase;
    this.authToken = authToken;
  }

  /**
   * Get MCP tools for an agent
   */
  async getTools(agentId: string): Promise<OpenAIFunction[]> {
    const cacheKey = agentId;
    const now = Date.now();

    // Check cache
    if (this.toolsCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        return this.toolsCache.get(cacheKey) || [];
      }
    }

    try {
      console.log(`[MCP] Getting MCP tools for agent ${agentId}`);

      // Get cached MCP tools for this agent
      const { data: mcpTools } = await this.supabase
        .from('mcp_tools_cache')
        .select(`
          tool_name,
          openai_schema,
          agent_mcp_connections!inner(
            id,
            connection_name,
            is_active
          )
        `)
        .eq('agent_mcp_connections.agent_id', agentId)
        .eq('agent_mcp_connections.is_active', true);

      if (!mcpTools || mcpTools.length === 0) {
        console.log(`[MCP] No MCP tools found for agent ${agentId}`);
        this.toolsCache.set(cacheKey, []);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
        return [];
      }

      const tools: OpenAIFunction[] = [];

      // Process each MCP tool
      for (const tool of mcpTools) {
        const toolName = tool.tool_name;
        const openaiSchema = tool.openai_schema;
        const connection = tool.agent_mcp_connections;

        // Filter out email tools for security (these should be handled by dedicated providers)
        if (this.isEmailTool(toolName)) {
          console.log(`[MCP] Filtering out email tool ${toolName} for security`);
          continue;
        }

        // Add tool to available tools
        tools.push({
          name: toolName,
          description: openaiSchema.description || `Execute ${toolName} via MCP`,
          parameters: openaiSchema.parameters || {}
        });

        // Store metadata for execution routing
        this.toolMetadataMap.set(toolName, {
          connectionId: connection.id,
          toolName: toolName
        });
      }

      console.log(`[MCP] Filtered MCP tools: ${mcpTools.length} -> ${tools.length} (removed email tools for security)`);
      console.log(`[MCP] Found ${tools.length} MCP tools for agent ${agentId}`);
      
      if (tools.length > 0) {
        console.log(`[MCP] MCP tool names:`, tools.map(t => t.name));
      }

      // Cache results
      this.toolsCache.set(cacheKey, tools);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return tools;

    } catch (error) {
      console.error('[MCP] Error getting MCP tools:', error);
      return [];
    }
  }

  /**
   * Check if a tool is an email-related tool that should be filtered out
   */
  private isEmailTool(toolName: string): boolean {
    const emailKeywords = ['email', 'mail', 'message', 'send', 'gmail', 'smtp', 'sendgrid', 'mailgun'];
    const lowerName = toolName.toLowerCase();
    return emailKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Validate permissions - MCP tools are available if they're cached for the agent
   */
  async validatePermissions(agentId: string, userId: string, toolName: string): Promise<boolean> {
    const tools = await this.getTools(agentId);
    return tools.some(t => t.name === toolName);
  }

  /**
   * Execute MCP tool
   */
  async executeTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[MCP] Executing ${toolName} for agent ${agentId}`);

      // Get tool metadata
      const metadata = this.toolMetadataMap.get(toolName);
      if (!metadata) {
        return {
          success: false,
          error: `MCP tool ${toolName} not found in metadata map`,
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Execute via MCP provider
      const { data, error } = await this.supabase.functions.invoke('mcp-execute-tool', {
        body: {
          connection_id: metadata.connectionId,
          tool_name: metadata.toolName,
          parameters: parameters,
          agent_id: agentId
        },
        headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}
      });

      if (error) {
        return {
          success: false,
          error: `MCP execution error: ${error.message}`,
          data: error,
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      return {
        success: true,
        data: data,
        metadata: { execution_time_ms: Date.now() - startTime }
      };

    } catch (error: any) {
      console.error(`[MCP] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error.message || 'MCP execution failed',
        metadata: { execution_time_ms: Date.now() - startTime }
      };
    }
  }

  /**
   * Clear cache for specific agent
   */
  clearCache(agentId: string): void {
    this.toolsCache.delete(agentId);
    this.cacheExpiry.delete(agentId);
    
    // Also clear metadata for tools of this agent
    const tools = Array.from(this.toolMetadataMap.keys());
    for (const toolName of tools) {
      // This is a simplified approach - in a full implementation,
      // we'd track which tools belong to which agent
      // For now, we'll keep the metadata as it's needed for execution
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.toolsCache.size,
      entries: Array.from(this.toolsCache.keys())
    };
  }
}
