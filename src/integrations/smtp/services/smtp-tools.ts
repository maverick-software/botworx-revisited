/**
 * SMTP MCP Tools Implementation
 * Following MCP Application Layer Pattern
 * 
 * Provides email sending capabilities via SMTP for agents
 * when Gmail is not authorized or when SMTP is preferred
 */

import { supabase } from '@/lib/supabase';
import { MCPTool, MCPToolResult, MCPToolExecutionContext } from '@/integrations/gmail/services/gmail-tools';

/**
 * SMTP MCP Tools Registry
 */
export const SMTP_MCP_TOOLS: Record<string, MCPTool> = {
  send_email: {
    name: 'send_email',
    description: 'Send emails via SMTP server',
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
        cc: {
          type: 'string',
          description: 'CC recipients (comma-separated)',
          required: false,
        },
        bcc: {
          type: 'string',
          description: 'BCC recipients (comma-separated)',
          required: false,
        },
      },
      required: ['to', 'subject', 'body'],
    },
    required_scopes: ['send_email'],
  },
};

/**
 * SMTP MCP Tools Service
 * Implements MCP Application Layer for SMTP operations
 */
export class SMTPMCPToolsService {
  /**
   * List available SMTP tools
   */
  async listTools(agentId: string, userId: string): Promise<MCPTool[]> {
    try {
      // Check if agent has SMTP permissions
      const { data: permissions } = await supabase
        .from('agent_integration_permissions')
        .select(`
          allowed_scopes,
          is_active,
          user_integration_credentials!inner(
            oauth_provider_id,
            connection_metadata,
            service_providers!inner(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_integration_credentials.user_id', userId)
        .eq('is_active', true)
        .in('user_integration_credentials.service_providers.name', ['smtp', 'sendgrid', 'mailgun']);

      if (!permissions || permissions.length === 0) {
        return [];
      }

      // Return SMTP send_email tool
      return [SMTP_MCP_TOOLS.send_email];
    } catch (error) {
      console.error('Error listing SMTP tools:', error);
      return [];
    }
  }

  /**
   * Execute an SMTP tool
   */
  async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { agentId, userId, tool, parameters } = context;

    try {
      // Validate permissions
      const hasPermission = await this.validatePermissions(agentId, userId, tool);
      if (!hasPermission) {
        return {
          success: false,
          error: 'Agent does not have required permissions for SMTP email operations',
        };
      }

      // Route to appropriate tool handler
      switch (tool) {
        case 'send_email':
          return await this.sendEmail(agentId, userId, parameters);
        default:
          return {
            success: false,
            error: `Unknown SMTP tool: ${tool}`,
          };
      }
    } catch (error) {
      console.error(`Error executing SMTP tool ${tool}:`, error);
      return {
        success: false,
        error: `Failed to execute ${tool}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate agent permissions
   */
  private async validatePermissions(agentId: string, userId: string, tool: string): Promise<boolean> {
    const toolDefinition = SMTP_MCP_TOOLS[tool];
    if (!toolDefinition) {
      return false;
    }

    try {
      // Check if agent has SMTP permissions
      const { data: permissions } = await supabase
        .from('agent_integration_permissions')
        .select('id, allowed_scopes')
        .eq('agent_id', agentId)
        .eq('is_active', true);

      if (!permissions || permissions.length === 0) {
        return false;
      }

      // Check if required scopes are granted
      const grantedScopes = permissions[0].allowed_scopes || [];
      return toolDefinition.required_scopes.every(scope => grantedScopes.includes(scope));
    } catch (error) {
      console.error('Error validating SMTP permissions:', error);
      return false;
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendEmail(agentId: string, userId: string, parameters: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      // Call SMTP API via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('smtp-send', {
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

      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          messageId: data.messageId,
          accepted: data.accepted,
          response: data.response,
        },
        metadata: {
          execution_time_ms: executionTime,
          provider: 'smtp',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error sending email via SMTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'smtp',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

// Export a singleton instance
export const smtpMCPTools = new SMTPMCPToolsService();
