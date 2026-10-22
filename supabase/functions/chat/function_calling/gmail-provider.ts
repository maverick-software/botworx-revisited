/**
 * Gmail Tool Provider
 * Handles Gmail operations with proper scope validation and deduplication
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAIFunction, MCPToolResult, ProviderPermission, ToolProvider, MCPTool } from './base.ts';

/**
 * Gmail MCP Tools Registry
 */
export const GMAIL_MCP_TOOLS: Record<string, MCPTool> = {
  gmail_send_email: {
    name: 'gmail_send_email',
    description: 'Send an email through Gmail using your connected Gmail account. Use this when you need to send from your Gmail inbox.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body content (plain text)' },
        html: { type: 'string', description: 'Email body content (HTML format)' },
        attachments: {
          type: 'array',
          description: 'Email attachments',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded content' },
              contentType: { type: 'string' },
            },
          },
        },
      },
      required: ['to', 'subject', 'body'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.send'],
  },

  gmail_read_emails: {
    name: 'gmail_read_emails',
    description: 'Read emails from Gmail inbox with optional filters and body preview.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g., "from:example@domain.com", "subject:Meeting")' },
        max_results: { type: 'number', description: 'Maximum number of emails to return (default: 10, max: 50)' },
        include_body_preview: { type: 'boolean', description: 'Whether to include email body preview (default: false)' },
      },
      required: [],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },

  gmail_search_emails: {
    name: 'gmail_search_emails',
    description: 'Search Gmail emails with advanced query syntax.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query using Gmail search syntax' },
        max_results: { type: 'number', description: 'Maximum results to return (1-100, default: 20)' },
      },
      required: ['query'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },

  gmail_email_actions: {
    name: 'gmail_email_actions',
    description: 'Perform actions on Gmail emails (mark read/unread, archive, star, delete).',
    parameters: {
      type: 'object',
      properties: {
        message_ids: { type: 'array', items: { type: 'string' }, description: 'Array of Gmail message IDs' },
        action: { 
          type: 'string', 
          enum: ['mark_read', 'mark_unread', 'archive', 'unarchive', 'star', 'unstar', 'delete', 'delete_forever'],
          description: 'Action to perform on the emails'
        },
      },
      required: ['message_ids', 'action'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  }
};

export class GmailProvider implements ToolProvider {
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
   * Get Gmail tools for an agent with caching and proper scope validation
   */
  async getTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    const cacheKey = `${agentId}:${userId}`;
    const now = Date.now();

    // Check cache first
    if (this.toolsCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        console.log(`[Gmail] Using cached tools for agent ${agentId}`);
        return this.toolsCache.get(cacheKey) || [];
      }
    }

    try {
      // Check if agent has Gmail permissions
      const { data: permissions } = await this.supabase
        .from('agent_integration_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_integration_credentials!inner(
            oauth_provider_id,
            credential_type,
            service_providers!inner(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('user_integration_credentials.service_providers.name', 'gmail')
        .eq('user_integration_credentials.credential_type', 'oauth')
        .eq('is_active', true)
        .limit(5);

      if (!permissions || permissions.length === 0) {
        console.log(`[Gmail] No Gmail permissions found for agent ${agentId}`);
        console.log(`[Gmail] SECURITY: Gmail tools BLOCKED for agent ${agentId}`);
        this.toolsCache.set(cacheKey, []);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
        return [];
      }

      const grantedScopes = (permissions[0]?.allowed_scopes || []) as string[];
      console.log(`[Gmail] Agent ${agentId} has Gmail scopes:`, grantedScopes);
      console.log(`[Gmail] Available Gmail tool definitions:`, Object.keys(GMAIL_MCP_TOOLS));
      
      // Filter tools based on granted scopes
      const availableTools: OpenAIFunction[] = [];
      
      for (const [toolName, tool] of Object.entries(GMAIL_MCP_TOOLS)) {
        const hasRequiredScopes = tool.required_scopes.every(scope => {
          // Normalize both sides to allow short names (e.g., 'gmail.send') or full URLs
          const normalize = (s: string) => s.toLowerCase()
            .replace('https://www.googleapis.com/auth/', '')
            .replace('https://mail.google.com/', 'mail.google.com');
          const req = normalize(scope);
          return grantedScopes.some((grantedScope: string) => {
            const g = normalize(grantedScope);
            return g === req || g.endsWith(req) || req.endsWith(g);
          });
        });
        
        if (hasRequiredScopes) {
          console.log(`[Gmail] Adding tool ${toolName} (has required scopes)`);
          availableTools.push({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          });
        } else {
          console.log(`[Gmail] Skipping tool ${toolName} (missing required scopes: ${tool.required_scopes.join(', ')})`);
        }
      }

      console.log(`[Gmail] Found ${availableTools.length} Gmail tools for agent ${agentId}`);

      // Cache the results
      this.toolsCache.set(cacheKey, availableTools);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return availableTools;
      
    } catch (error) {
      console.error('[Gmail] Error getting Gmail tools:', error);
      return [];
    }
  }

  /**
   * Validate agent has permission for specific Gmail tool
   */
  async validatePermissions(agentId: string, userId: string, toolName: string): Promise<boolean> {
    const tools = await this.getTools(agentId, userId);
    return tools.some(t => t.name === toolName);
  }

  /**
   * Execute Gmail tool
   */
  async executeTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Gmail] Executing ${toolName} for agent ${agentId}`);
      
      // Validate permissions
      if (!(await this.validatePermissions(agentId, userId, toolName))) {
        return {
          success: false,
          error: `Gmail tool ${toolName} is not available for this agent`,
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Execute via Gmail API Edge Function
      const { data, error } = await this.supabase.functions.invoke('gmail-api', {
        body: {
          action: toolName.replace('gmail_', ''),
          agent_id: agentId,
          user_id: userId,
          ...parameters
        },
        headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}
      });

      if (error) {
        return {
          success: false,
          error: `Gmail API error: ${error.message}`,
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
      console.error(`[Gmail] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error.message || 'Gmail execution failed',
        metadata: { execution_time_ms: Date.now() - startTime }
      };
    }
  }

  /**
   * Clear cache for specific agent
   */
  clearCache(agentId: string, userId: string): void {
    const cacheKey = `${agentId}:${userId}`;
    this.toolsCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.toolsCache.size,
      entries: Array.from(this.toolsCache.keys())
    };
  }
}
