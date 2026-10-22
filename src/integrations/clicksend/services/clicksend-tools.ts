import { supabase } from '@/lib/supabase';

// ClickSend MCP Tool definitions following OpenAI function calling schema
export const CLICKSEND_MCP_TOOLS = {
  send_sms: {
    name: 'clicksend_send_sms',
    description: 'Send an SMS message via ClickSend. Use this when the user asks to send a text message to a phone number.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in international format (e.g., +1234567890)',
        },
        body: {
          type: 'string',
          description: 'SMS message content (max 1600 characters for concatenated messages)',
        },
        from: {
          type: 'string',
          description: 'Sender ID or phone number (optional, uses account default if not specified)',
        },
      },
      required: ['to', 'body'],
    },
  },

  send_mms: {
    name: 'clicksend_send_mms',
    description: 'Send an MMS message with media via ClickSend. Use this when the user asks to send a multimedia message with images or videos.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in international format (e.g., +1234567890)',
        },
        body: {
          type: 'string',
          description: 'MMS message content',
        },
        media_url: {
          type: 'string',
          description: 'URL of the media file to attach (image, video, or audio). Must be publicly accessible.',
        },
        subject: {
          type: 'string',
          description: 'MMS subject line (optional)',
        },
        from: {
          type: 'string',
          description: 'Sender ID or phone number (optional, uses account default if not specified)',
        },
      },
      required: ['to', 'body', 'media_url'],
    },
  },

  get_balance: {
    name: 'clicksend_get_balance',
    description: 'Check ClickSend account balance and credit information. Use this when the user asks about their SMS/MMS account balance or remaining credits.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  get_sms_history: {
    name: 'clicksend_get_sms_history',
    description: 'Retrieve SMS message history and delivery status. Use this when the user asks to see their sent SMS messages.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        limit: {
          type: 'integer',
          description: 'Number of messages to retrieve per page (default: 50, max: 1000)',
          default: 50,
        },
      },
      required: [],
    },
  },

  get_mms_history: {
    name: 'clicksend_get_mms_history',
    description: 'Retrieve MMS message history and delivery status. Use this when the user asks to see their sent MMS messages.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        limit: {
          type: 'integer',
          description: 'Number of messages to retrieve per page (default: 50, max: 1000)',
          default: 50,
        },
      },
      required: [],
    },
  },

  get_delivery_receipts: {
    name: 'clicksend_get_delivery_receipts',
    description: 'Get delivery receipts for sent messages. Use this when the user asks about message delivery status.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
        limit: {
          type: 'integer',
          description: 'Number of receipts to retrieve per page (default: 50, max: 1000)',
          default: 50,
        },
      },
      required: [],
    },
  },
};

// MCP Tool execution context interface
interface MCPToolExecutionContext {
  agentId: string;
  userId: string;
  tool: string;
  parameters: Record<string, any>;
}

// MCP Tool execution result interface
interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms?: number;
    quota_consumed?: number;
    message_id?: string;
    cost?: number;
  };
}

export class ClickSendMCPToolsService {
  /**
   * List available ClickSend tools for an agent
   * Implements tools/list MCP method
   */
  async listTools(agentId: string, userId: string): Promise<any[]> {
    try {
      // Check if user has ClickSend connection
      const { data: connection, error: connectionError } = await supabase.rpc(
        'get_user_clicksend_connection',
        { p_user_id: userId }
      );

      if (connectionError || !connection || connection.length === 0) {
        console.log(`[ClickSend] No connection found for user ${userId}`);
        return [];
      }

      // Check agent permissions
      const { data: hasPermissions, error: permissionError } = await supabase.rpc(
        'validate_agent_clicksend_permissions',
        {
          p_agent_id: agentId,
          p_user_id: userId,
          p_required_scopes: [] // Check if agent has any permissions
        }
      );

      if (permissionError || !hasPermissions) {
        console.log(`[ClickSend] No permissions found for agent ${agentId}`);
        return [];
      }

      // Get agent's allowed scopes to filter available tools
      const { data: permissions } = await supabase
        .from('agent_integration_permissions')
        .select('allowed_scopes')
        .eq('agent_id', agentId)
        .eq('user_oauth_connection_id', connection[0].connection_id)
        .eq('is_active', true)
        .single();

      if (!permissions?.allowed_scopes) {
        return [];
      }

      const allowedScopes = Array.isArray(permissions.allowed_scopes) 
        ? permissions.allowed_scopes 
        : Object.keys(permissions.allowed_scopes);

      // Filter tools based on allowed scopes
      const availableTools = [];

      if (allowedScopes.includes('sms')) {
        availableTools.push(CLICKSEND_MCP_TOOLS.send_sms);
      }

      if (allowedScopes.includes('mms')) {
        availableTools.push(CLICKSEND_MCP_TOOLS.send_mms);
      }

      if (allowedScopes.includes('balance')) {
        availableTools.push(CLICKSEND_MCP_TOOLS.get_balance);
      }

      if (allowedScopes.includes('history')) {
        availableTools.push(CLICKSEND_MCP_TOOLS.get_sms_history);
        availableTools.push(CLICKSEND_MCP_TOOLS.get_mms_history);
        availableTools.push(CLICKSEND_MCP_TOOLS.get_delivery_receipts);
      }

      console.log(`[ClickSend] Found ${availableTools.length} available tools for agent ${agentId}`);
      return availableTools;

    } catch (error) {
      console.error('[ClickSend] Error listing tools:', error);
      return [];
    }
  }

  /**
   * Execute a ClickSend tool
   * Implements tools/call MCP method
   */
  async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { agentId, userId, tool, parameters } = context;
    const startTime = Date.now();

    try {
      console.log(`[ClickSend] Executing ${tool} for agent ${agentId}`);

      // Validate permissions for this specific tool
      const requiredScopes = this.getRequiredScopes(tool);
      const { data: hasPermission, error: permissionError } = await supabase.rpc(
        'validate_agent_clicksend_permissions',
        {
          p_agent_id: agentId,
          p_user_id: userId,
          p_required_scopes: requiredScopes
        }
      );

      if (permissionError || !hasPermission) {
        return {
          success: false,
          error: `Agent does not have required permissions for ${tool}. Required scopes: ${requiredScopes.join(', ')}`,
          metadata: {
            execution_time_ms: Date.now() - startTime
          }
        };
      }

      // Get user's auth token for the Edge Function call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return {
          success: false,
          error: 'Authentication required',
          metadata: {
            execution_time_ms: Date.now() - startTime
          }
        };
      }

      // Call the ClickSend Edge Function
      const { data, error } = await supabase.functions.invoke('clicksend-api', {
        body: {
          agent_id: agentId,
          action: tool.replace('clicksend_', ''), // Remove prefix for API call
          parameters: parameters
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error(`[ClickSend] Edge function error:`, error);
        return {
          success: false,
          error: `ClickSend API error: ${error.message}`,
          metadata: {
            execution_time_ms: Date.now() - startTime
          }
        };
      }

      // Return successful result
      return {
        success: data.success,
        data: data.data,
        error: data.error,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          quota_consumed: data.metadata?.quota_consumed,
          message_id: data.metadata?.message_id,
          cost: data.metadata?.cost
        }
      };

    } catch (error: any) {
      console.error(`[ClickSend] Error executing ${tool}:`, error);
      return {
        success: false,
        error: `Failed to execute ${tool}: ${error.message}`,
        metadata: {
          execution_time_ms: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get required scopes for a specific tool
   */
  private getRequiredScopes(toolName: string): string[] {
    const scopeMap: Record<string, string[]> = {
      'clicksend_send_sms': ['sms'],
      'clicksend_send_mms': ['mms'],
      'clicksend_get_balance': ['balance'],
      'clicksend_get_sms_history': ['history'],
      'clicksend_get_mms_history': ['history'],
      'clicksend_get_delivery_receipts': ['history']
    };

    return scopeMap[toolName] || [];
  }

  /**
   * Test ClickSend connection for an agent
   */
  async testConnection(agentId: string, userId: string): Promise<MCPToolResult> {
    try {
      // Test by getting account balance (minimal API call)
      return await this.executeTool({
        agentId,
        userId,
        tool: 'clicksend_get_balance',
        parameters: {}
      });
    } catch (error: any) {
      return {
        success: false,
        error: `Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Get tool usage statistics for an agent
   */
  async getUsageStats(agentId: string, userId: string, days: number = 30): Promise<any> {
    try {
      const { data: stats } = await supabase
        .from('tool_execution_logs')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', userId)
        .eq('tool_provider', 'clicksend')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (!stats) {
        return null;
      }

      const smsStats = stats.filter(s => s.tool_name === 'clicksend_send_sms');
      const mmsStats = stats.filter(s => s.tool_name === 'clicksend_send_mms');
      const balanceStats = stats.filter(s => s.tool_name === 'clicksend_get_balance');
      const historyStats = stats.filter(s => s.tool_name.includes('history'));

      const successfulOperations = stats.filter(s => s.success);
      const successRate = stats.length > 0 ? (successfulOperations.length / stats.length) * 100 : 0;

      return {
        sms_sent: smsStats.filter(s => s.success).length,
        mms_sent: mmsStats.filter(s => s.success).length,
        balance_checks: balanceStats.length,
        history_queries: historyStats.length,
        last_sms_sent: smsStats.find(s => s.success)?.created_at,
        last_mms_sent: mmsStats.find(s => s.success)?.created_at,
        success_rate: Math.round(successRate),
        total_operations: stats.length,
        recent_operations: stats.slice(0, 10)
      };

    } catch (error) {
      console.error('[ClickSend] Error getting usage stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const clicksendMCPTools = new ClickSendMCPToolsService();
