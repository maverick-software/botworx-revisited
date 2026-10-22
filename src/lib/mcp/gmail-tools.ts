/**
 * Gmail MCP Tools Implementation
 * Following MCP Application Layer Pattern
 * 
 * Based on MCP guidelines:
 * - Tools: Operations or functions the server can perform on request
 * - Tools have side effects or perform computations
 * - Enable the LLM to act as an agent that can affect external systems
 */

import { supabase } from '../supabase';

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_scopes: string[];
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MCPToolExecutionContext {
  agentId: string;
  userId: string;
  tool: string;
  parameters: Record<string, any>;
}

/**
 * Gmail MCP Tools Registry
 * Implements tools/list functionality
 */
export const GMAIL_MCP_TOOLS: Record<string, MCPTool> = {
  send_email: {
    name: 'send_email',
    description: 'Send emails with optional attachments via Gmail',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text)',
        },
        html: {
          type: 'string',
          description: 'Email body content (HTML format)',
          required: false,
        },
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
          required: false,
        },
      },
      required: ['to', 'subject', 'body'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.send'],
  },

  read_emails: {
    name: 'read_emails',
    description: 'Read and list emails from Gmail inbox with filtering options',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "is:unread", "from:example@gmail.com")',
          required: false,
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of emails to return (default: 50)',
          default: 50,
          minimum: 1,
          maximum: 500,
        },
        label_ids: {
          type: 'array',
          description: 'Array of label IDs to filter by',
          items: { type: 'string' },
          required: false,
        },
        include_body: {
          type: 'boolean',
          description: 'Whether to include email body content',
          default: false,
        },
      },
      required: [],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },

  search_emails: {
    name: 'search_emails',
    description: 'Search emails with advanced Gmail search filters',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Advanced Gmail search query (e.g., "from:example@gmail.com has:attachment")',
        },
        labels: {
          type: 'array',
          description: 'Array of label names to filter by',
          items: { type: 'string' },
          required: false,
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of search results (default: 100)',
          default: 100,
          minimum: 1,
          maximum: 500,
        },
        date_range: {
          type: 'object',
          description: 'Date range filter',
          properties: {
            after: { type: 'string', description: 'Search after this date (YYYY-MM-DD)' },
            before: { type: 'string', description: 'Search before this date (YYYY-MM-DD)' },
          },
          required: false,
        },
      },
      required: ['query'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },

  manage_labels: {
    name: 'manage_labels',
    description: 'Create, modify, and delete Gmail labels',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'modify', 'delete', 'list'],
          description: 'Action to perform on labels',
        },
        label_name: {
          type: 'string',
          description: 'Name of the label to create/modify/delete',
        },
        new_label_name: {
          type: 'string',
          description: 'New name for label (modify action only)',
          required: false,
        },
        color: {
          type: 'string',
          description: 'Label color (hex code or predefined color)',
          required: false,
        },
        label_list_visibility: {
          type: 'string',
          enum: ['labelShow', 'labelHide'],
          description: 'Whether label appears in label list',
          required: false,
        },
        message_list_visibility: {
          type: 'string',
          enum: ['show', 'hide'],
          description: 'Whether label appears in message list',
          required: false,
        },
      },
      required: ['action'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.labels'],
  },

  email_actions: {
    name: 'email_actions',
    description: 'Perform actions on Gmail emails (mark as read, archive, delete, etc.)',
    parameters: {
      type: 'object',
      properties: {
        message_ids: {
          type: 'array',
          description: 'Array of Gmail message IDs to act upon',
          items: { type: 'string' },
        },
        action: {
          type: 'string',
          enum: ['mark_read', 'mark_unread', 'archive', 'unarchive', 'delete', 'star', 'unstar'],
          description: 'Action to perform on the messages',
        },
        labels_to_add: {
          type: 'array',
          description: 'Array of label IDs to add to messages',
          items: { type: 'string' },
          required: false,
        },
        labels_to_remove: {
          type: 'array',
          description: 'Array of label IDs to remove from messages',
          items: { type: 'string' },
          required: false,
        },
      },
      required: ['message_ids', 'action'],
    },
    required_scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  },
};

/**
 * Gmail MCP Tools Service
 * Implements MCP Application Layer for Gmail operations
 */
export class GmailMCPToolsService {
  /**
   * List available Gmail tools (implements tools/list)
   * @param agentId - Agent requesting tools
   * @param userId - User ID for permission checking
   * @returns Array of available tools for the agent
   */
  async listTools(agentId: string, userId: string): Promise<MCPTool[]> {
    try {
      // Get agent's Gmail permissions
      const { data: permissions } = await supabase
        .from('agent_oauth_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_oauth_connections(
            oauth_provider_id,
            oauth_providers(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_oauth_connections.user_id', userId)
        .eq('is_active', true);

      // Filter for Gmail provider on client-side
      const gmailPermissions = (permissions || []).filter((permission: any) => 
        permission.user_oauth_connections && 
        permission.user_oauth_connections.oauth_providers && 
        permission.user_oauth_connections.oauth_providers.name === 'gmail'
      );

      const gmailPermission = gmailPermissions.length > 0 ? gmailPermissions[0] : null;

      if (!gmailPermission) {
        return [];
      }

      const grantedScopes = gmailPermission.allowed_scopes || [];
      
      // Filter tools based on granted scopes
      const availableTools = Object.values(GMAIL_MCP_TOOLS).filter(tool => {
        return tool.required_scopes.every(scope => {
          return grantedScopes.includes(scope) || 
                 grantedScopes.some((grantedScope: string) => {
                   return grantedScope.endsWith(scope.split('/').pop() as string);
                 });
        });
      });

      return availableTools;
    } catch (error) {
      console.error('Error listing Gmail tools:', error);
      return [];
    }
  }

  /**
   * Execute a Gmail tool (implements tools/call)
   * @param context - Tool execution context
   * @returns Tool execution result
   */
  async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { agentId, userId, tool, parameters } = context;

    try {
      // Validate agent permissions
      const hasPermission = await this.validatePermissions(agentId, userId, tool);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Agent does not have required permissions for this Gmail operation',
        };
      }

      // Route to appropriate tool handler
      switch (tool) {
        case 'send_email':
          return await this.sendEmail(agentId, userId, parameters);
        case 'read_emails':
          return await this.readEmails(agentId, userId, parameters);
        case 'search_emails':
          return await this.searchEmails(agentId, userId, parameters);
        case 'manage_labels':
          return await this.manageLabels(agentId, userId, parameters);
        case 'email_actions':
          return await this.emailActions(agentId, userId, parameters);
        default:
          return {
            success: false,
            error: `Unknown Gmail tool: ${tool}`,
          };
      }
    } catch (error) {
      console.error(`Error executing Gmail tool ${tool}:`, error);
      return {
        success: false,
        error: `Failed to execute ${tool}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate agent permissions for a specific tool
   */
  private async validatePermissions(agentId: string, userId: string, tool: string): Promise<boolean> {
    const toolDefinition = GMAIL_MCP_TOOLS[tool];
    if (!toolDefinition) {
      return false;
    }

    try {
      const { data: isValid } = await supabase
        .rpc('validate_agent_gmail_permissions', {
          p_agent_id: agentId,
          p_user_id: userId,
          p_required_scopes: toolDefinition.required_scopes,
        });

      return isValid || false;
    } catch (error) {
      console.error('Error validating permissions:', error);
      return false;
    }
  }

  /**
   * Send email tool implementation
   */
  private async sendEmail(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      // Call Gmail API via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'send_email',
          agent_id: agentId,
          user_id: userId,
          parameters,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Log the operation
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'send_email',
        p_operation_params: parameters,
        p_operation_result: data,
        p_status: 'success',
        p_quota_consumed: 100, // Gmail API quota for sending
        p_execution_time_ms: Date.now() - startTime,
      });

      return {
        success: true,
        data: data,
        metadata: {
          quota_consumed: 100,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      // Log the error
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'send_email',
        p_operation_params: parameters,
        p_status: 'error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_execution_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Read emails tool implementation
   */
  private async readEmails(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'read_emails',
          agent_id: agentId,
          user_id: userId,
          parameters,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Log the operation
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'read_emails',
        p_operation_params: parameters,
        p_operation_result: data,
        p_status: 'success',
        p_quota_consumed: 5, // Gmail API quota for reading
        p_execution_time_ms: Date.now() - startTime,
      });

      return {
        success: true,
        data: data,
        metadata: {
          quota_consumed: 5,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'read_emails',
        p_operation_params: parameters,
        p_status: 'error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_execution_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Search emails tool implementation
   */
  private async searchEmails(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'search_emails',
          agent_id: agentId,
          user_id: userId,
          parameters,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'search_emails',
        p_operation_params: parameters,
        p_operation_result: data,
        p_status: 'success',
        p_quota_consumed: 5,
        p_execution_time_ms: Date.now() - startTime,
      });

      return {
        success: true,
        data: data,
        metadata: {
          quota_consumed: 5,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'search_emails',
        p_operation_params: parameters,
        p_status: 'error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_execution_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Manage labels tool implementation
   */
  private async manageLabels(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'manage_labels',
          agent_id: agentId,
          user_id: userId,
          parameters,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'manage_labels',
        p_operation_params: parameters,
        p_operation_result: data,
        p_status: 'success',
        p_quota_consumed: 5,
        p_execution_time_ms: Date.now() - startTime,
      });

      return {
        success: true,
        data: data,
        metadata: {
          quota_consumed: 5,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'manage_labels',
        p_operation_params: parameters,
        p_status: 'error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_execution_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Email actions tool implementation
   */
  private async emailActions(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'email_actions',
          agent_id: agentId,
          user_id: userId,
          parameters,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'email_actions',
        p_operation_params: parameters,
        p_operation_result: data,
        p_status: 'success',
        p_quota_consumed: 5,
        p_execution_time_ms: Date.now() - startTime,
      });

      return {
        success: true,
        data: data,
        metadata: {
          quota_consumed: 5,
          execution_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      await supabase.rpc('log_gmail_operation', {
        p_agent_id: agentId,
        p_user_id: userId,
        p_operation_type: 'email_actions',
        p_operation_params: parameters,
        p_status: 'error',
        p_error_message: error instanceof Error ? error.message : 'Unknown error',
        p_execution_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }
}

// Export singleton instance
export const gmailMCPTools = new GmailMCPToolsService(); 