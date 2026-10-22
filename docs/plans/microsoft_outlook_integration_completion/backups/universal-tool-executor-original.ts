/**
 * Universal Tool Execution Router
 * Routes tool execution to appropriate integration edge functions
 * This scales to any number of integrations without code changes
 * 
 * Features intelligent error enhancement for LLM-friendly retry mechanism
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { MCPToolResult } from './base.ts';

export interface MCPToolExecutionContext {
  agentId: string;
  userId: string;
  toolName: string;
  parameters: Record<string, any>;
  supabase: SupabaseClient;
  authToken?: string;  // Add auth token for edge function calls
}

// Tool routing configuration - easily extensible for new integrations
const TOOL_ROUTING_MAP: Record<string, {
  edgeFunction: string;
  actionMapping: (toolName: string) => string;
  parameterMapping?: (params: Record<string, any>, context?: any) => Record<string, any>;
}> = {
  // Gmail tools
  'gmail_': {
    edgeFunction: 'gmail-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'gmail_send_email': 'send_email',
        'gmail_read_emails': 'list_messages',
        'gmail_search_emails': 'search_messages',
        'gmail_email_actions': 'modify_message'
      };
      return actionMap[toolName] || 'unknown_action';
    },
    parameterMapping: (params: Record<string, any>) => ({
      params: params  // Gmail API expects "params" not "parameters"
    })
  },
  
  // SMTP tools
  'smtp_': {
    edgeFunction: 'smtp-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'smtp_send_email': 'send_email',
        'smtp_email_templates': 'email_templates',
        'smtp_email_stats': 'email_stats'
      };
      return actionMap[toolName] || 'send_email';
    },
    parameterMapping: (params: Record<string, any>, context: any) => {
      // Map tool name to action using the actionMapping function
      const actionMap: Record<string, string> = {
        'smtp_send_email': 'send_email',
        'smtp_email_templates': 'email_templates',
        'smtp_email_stats': 'email_stats'
      };
      const action = actionMap[context.toolName] || 'send_email';
      
      return {
        action: action,
        agent_id: context.agentId,
        user_id: context.userId, 
        params: params
      };
    }
  },
  
  // SendGrid tools
  'sendgrid_': {
    edgeFunction: 'sendgrid-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'sendgrid_send_email': 'send_email',
        'sendgrid_email_templates': 'email_templates',
        'sendgrid_email_stats': 'email_stats'
      };
      return actionMap[toolName] || 'send_email';
    },
    parameterMapping: (params: Record<string, any>, context: any) => {
      const actionMap: Record<string, string> = {
        'sendgrid_send_email': 'send_email',
        'sendgrid_email_templates': 'email_templates',
        'sendgrid_email_stats': 'email_stats'
      };
      const action = actionMap[context.toolName] || 'send_email';
      
      return {
        action: action,
        agent_id: context.agentId,
        user_id: context.userId, 
        params: params
      };
    }
  },
  
  // Mailgun tools
  'mailgun_': {
    edgeFunction: 'mailgun-service',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'mailgun_send_email': 'send_email',
        'mailgun_email_templates': 'email_templates',
        'mailgun_email_stats': 'email_stats',
        'mailgun_email_validation': 'email_validation',
        'mailgun_suppression_management': 'suppression_management'
      };
      return actionMap[toolName] || 'send_email';
    },
    parameterMapping: (params: Record<string, any>, context: any) => {
      const actionMap: Record<string, string> = {
        'mailgun_send_email': 'send_email',
        'mailgun_email_templates': 'email_templates',
        'mailgun_email_stats': 'email_stats',
        'mailgun_email_validation': 'email_validation',
        'mailgun_suppression_management': 'suppression_management'
      };
      const action = actionMap[context.toolName] || 'send_email';
      
      return {
        action: action,
        agent_id: context.agentId,
        user_id: context.userId, 
        params: params
      };
    }
  },
  
  // Web search tools (using web-search-api)
  'web_search': {
    edgeFunction: 'web-search-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'web_search': 'web_search',
        'scrape_url': 'scrape_and_summarize',
        'news_search': 'news_search'
      };
      return actionMap[toolName] || 'web_search';
    },
    parameterMapping: (params: Record<string, any>) => ({
      parameters: params  // Nest parameters object as expected by web-search-api
    })
  },
  
  // News search tools
  'news_': {
    edgeFunction: 'web-search-api',
    actionMapping: () => 'news_search',
    parameterMapping: (params: Record<string, any>) => ({
      parameters: params
    })
  },
  
  // OneDrive tools
  'onedrive_': {
    edgeFunction: 'microsoft-onedrive-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'onedrive_list_files': 'list_files',
        'onedrive_download_file': 'download_file',
        'onedrive_upload_file': 'upload_file',
        'onedrive_search_files': 'search_files',
        'onedrive_share_file': 'share_file',
        'onedrive_get_user_info': 'get_user_info'
      };
      return actionMap[toolName] || 'list_files';
    },
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: context.toolName.replace('onedrive_', ''),
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  // Scrape tools
  'scrape_': {
    edgeFunction: 'web-search-api',
    actionMapping: () => 'scrape_and_summarize',
    parameterMapping: (params: Record<string, any>) => ({
      parameters: params
    })
  },
  
  // MCP/Zapier tools - route to MCP handler
  'zapier_': {
    edgeFunction: 'mcp-execute',
    actionMapping: (toolName: string) => toolName // Pass through tool name
  },
  
  // Media Library tools
  'search_documents': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'search_documents',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'search_documents',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'get_document_content': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'get_document_content',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_document_content',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'list_assigned_documents': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'list_assigned_documents',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'list_assigned_documents',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'search_document_content': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'search_document_content',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'search_document_content',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'get_document_summary': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'get_document_summary',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_document_summary',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'find_related_documents': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'find_related_documents',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'find_related_documents',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'reprocess_document': {
    edgeFunction: 'media-library-mcp',
    actionMapping: () => 'reprocess_document',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'reprocess_document',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  // Advanced Reasoning tools (MCP-based)
  'reasoning_': {
    edgeFunction: 'advanced-reasoning',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'reasoning_execute_chain': 'execute_chain',
        'reasoning_inductive': 'inductive_reasoning',
        'reasoning_deductive': 'deductive_reasoning',
        'reasoning_abductive': 'abductive_reasoning'
      };
      return actionMap[toolName] || 'execute_chain';
    },
    parameterMapping: (params: Record<string, any>, context: any) => {
      const action = context.toolName === 'reasoning_execute_chain' ? 'execute_chain' :
                   context.toolName === 'reasoning_inductive' ? 'inductive_reasoning' :
                   context.toolName === 'reasoning_deductive' ? 'deductive_reasoning' :
                   context.toolName === 'reasoning_abductive' ? 'abductive_reasoning' :
                   'execute_chain';
      
      return {
        action: action,
        agent_id: context.agentId,
        user_id: context.userId,
        tool_name: context.toolName,
        ...params  // Pass all reasoning parameters directly
      };
    }
  }
};

/**
 * Enhance error messages to be more LLM-friendly for retry mechanism
 * Converts technical errors into interactive questions when appropriate
 */
function enhanceErrorForRetry(toolName: string, error: string): string {
  // If error already contains interactive patterns, return as-is
  const hasInteractivePattern = error.toLowerCase().includes('question:') || 
    error.toLowerCase().includes('what ') ||
    error.toLowerCase().includes('please provide') ||
    error.toLowerCase().includes('which ') ||
    error.toLowerCase().includes('how ');
    
  if (hasInteractivePattern) {
    return error;
  }
  
  // Convert common technical errors to interactive questions based on tool type
  const lowerError = error.toLowerCase();
  const isEmailTool = toolName.startsWith('gmail_') || toolName.startsWith('smtp_');
  const isSearchTool = toolName.startsWith('web_search') || toolName.startsWith('news_') || toolName.startsWith('scrape_');
  
  // Missing parameters errors
  if (lowerError.includes('missing') && lowerError.includes('parameter')) {
    if (isEmailTool) {
      return 'Question: What email details are missing? Please provide the recipient email address, subject line, and message content.';
    }
    if (isSearchTool) {
      return 'Question: What would you like me to search for? Please provide a search query or topic.';
    }
  }
  
  // Authentication/API key errors
  if (lowerError.includes('api key') || lowerError.includes('authentication') || lowerError.includes('unauthorized') || lowerError.includes('expired')) {
    if (isEmailTool) {
      if (lowerError.includes('expired') || lowerError.includes('token')) {
        return 'Question: The email service OAuth token has expired. Please go to the Integrations page to re-authorize your email connection, then try again.';
      }
      return 'Question: It looks like the email service needs to be set up. Please ensure your email integration is properly configured with valid credentials.';
    }
    if (isSearchTool) {
      return 'Question: The search service needs to be configured. Please add your web search API key in the integration settings.';
    }
    
    // Generic OAuth expiration message
    if (lowerError.includes('expired') || lowerError.includes('token')) {
      return 'Question: The integration token has expired. Please go to the Integrations page to re-authorize this connection, then try again.';
    }
  }
  
  // Invalid parameter errors  
  if (lowerError.includes('invalid') || lowerError.includes('malformed')) {
    if (isEmailTool) {
      return 'Question: There seems to be an issue with the email parameters. Please check that the recipient email address is valid and all required fields are provided.';
    }
    if (isSearchTool) {
      return 'Question: There seems to be an issue with the search parameters. Please provide a clear search query or valid URLs to scrape.';
    }
  }
  
  // Generic enhancement for any error
  return `Please provide the correct parameters for ${toolName}. ${error}`;
}

export class UniversalToolExecutor {
  
  /**
   * Check tool status by calling get-agent-tools and finding the specific tool
   */
  static async checkToolStatus(toolName: string, agentId: string, userId: string, supabase: any): Promise<{status: string, error_message?: string}> {
    try {
      // Call get-agent-tools to get current tool status
      const { data: toolsResponse, error } = await supabase.functions.invoke('get-agent-tools', {
        body: { agent_id: agentId, user_id: userId }
      });

      if (error || !toolsResponse?.success) {
        console.error(`[UniversalToolExecutor] Failed to get tool status:`, error);
        return { status: 'error', error_message: 'Unable to check tool status' };
      }

      // Find the specific tool
      const tool = toolsResponse.tools?.find((t: any) => t.name === toolName);
      if (!tool) {
        return { status: 'error', error_message: `Tool ${toolName} not found or not authorized` };
      }

      return {
        status: tool.status || 'active',
        error_message: tool.error_message
      };
    } catch (err) {
      console.error(`[UniversalToolExecutor] Error checking tool status:`, err);
      return { status: 'error', error_message: 'Failed to check tool status' };
    }
  }

  /**
   * Execute any tool by routing to the appropriate edge function
   * This is the universal solution that scales to any integration
   */
  static async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
    const { toolName, parameters, supabase, agentId, userId, authToken } = context;
    
    try {
      console.log(`[UniversalToolExecutor] Executing ${toolName} for agent ${agentId}`);
      
      // Check tool status before execution
      const toolStatus = await this.checkToolStatus(toolName, agentId, userId, supabase);
      if (toolStatus.status !== 'active') {
        console.log(`[UniversalToolExecutor] Tool ${toolName} is ${toolStatus.status}: ${toolStatus.error_message}`);
        return {
          success: false,
          data: null,
          error: toolStatus.error_message || `Tool is ${toolStatus.status} and cannot be used.`
        };
      }
      
      // Find the appropriate routing configuration
      const routingConfig = this.findRoutingConfig(toolName);
      
      if (!routingConfig) {
        console.error(`[UniversalToolExecutor] No routing configuration found for tool: ${toolName}`);
        return {
          success: false,
          error: `No handler configured for tool: ${toolName}`,
          metadata: { toolName, availableTools: Object.keys(TOOL_ROUTING_MAP) }
        };
      }
      
      // Map tool name to action
      const action = routingConfig.actionMapping(toolName);
      
      // Prepare parameters for the edge function
      const baseParams = {
        action,
        agent_id: agentId,  // Use agent_id as expected by edge functions
        user_id: userId,
        tool_name: toolName
      };
      
      // Apply parameter mapping if provided, otherwise merge parameters directly
      const mappingContext = { agentId, userId, toolName, parameters };
      const edgeFunctionParams = routingConfig.parameterMapping 
        ? { ...baseParams, ...routingConfig.parameterMapping(parameters, mappingContext) }
        : { ...baseParams, ...parameters };
      
      console.log(`[UniversalToolExecutor] Routing ${toolName} -> ${routingConfig.edgeFunction} (action: ${action})`);
      console.log(`[UniversalToolExecutor] Edge function params:`, JSON.stringify(edgeFunctionParams, null, 2));
      
      // Prepare headers for edge function call (only authorization)
      const invokeOptions: any = {
        body: edgeFunctionParams
      };
      
      // Include authorization header if auth token is provided and valid
      if (authToken && authToken.trim().length > 0 && authToken !== 'undefined' && authToken !== 'null') {
        console.log(`[UniversalToolExecutor] Adding user auth token for ${toolName} (length: ${authToken.length})`);
        invokeOptions.headers = {
          'Authorization': `Bearer ${authToken}`
        };
      } else {
        console.log(`[UniversalToolExecutor] No valid auth token provided for ${toolName} - using service role`);
        console.log(`[UniversalToolExecutor] Auth token debug:`, { 
          provided: !!authToken, 
          length: authToken?.length || 0,
          value: authToken ? `${authToken.substring(0, 20)}...` : 'null/undefined'
        });
      }
      
      // Call the appropriate edge function
      const { data, error } = await supabase.functions.invoke(routingConfig.edgeFunction, invokeOptions);
      
      if (error) {
        console.error(`[UniversalToolExecutor] Edge function error for ${toolName}:`, error);
        const originalError = error.message || 'Unknown error';
        const enhancedError = enhanceErrorForRetry(toolName, originalError);
        
        return {
          success: false,
          error: enhancedError,  // Use enhanced error for retry mechanism
          metadata: { 
            toolName, 
            edgeFunction: routingConfig.edgeFunction, 
            action,
            originalError: error.code || error.name,
            enhanced: enhancedError !== originalError  // Flag if error was enhanced
          }
        };
      }
      
      // Handle different response patterns from edge functions
      if (data && typeof data === 'object') {
        // If the response already has a success field, use it as-is
        if ('success' in data) {
          // If it's an error response, enhance the error message for retry
          if (!data.success && data.error) {
            const enhancedError = enhanceErrorForRetry(toolName, data.error);
            return {
              ...data,
              error: enhancedError,  // Use enhanced error for retry mechanism
              metadata: { 
                ...data.metadata, 
                toolName, 
                edgeFunction: routingConfig.edgeFunction,
                action,
                originalError: data.error,
                enhanced: enhancedError !== data.error  // Flag if error was enhanced
              }
            };
          }
          
          // Success response - return as-is with metadata
          return {
            ...data,
            metadata: { 
              ...data.metadata, 
              toolName, 
              edgeFunction: routingConfig.edgeFunction,
              action 
            }
          };
        }
        
        // Otherwise, wrap the response as successful
        return {
          success: true,
          data: data,
          metadata: { toolName, edgeFunction: routingConfig.edgeFunction, action }
        };
      }
      
      // Handle primitive responses (strings, numbers, etc.)
      return {
        success: true,
        data: data,
        metadata: { toolName, edgeFunction: routingConfig.edgeFunction, action }
      };
      
    } catch (error: any) {
      console.error(`[UniversalToolExecutor] Unexpected error executing ${toolName}:`, error);
      return {
        success: false,
        error: error.message || `Unexpected error executing ${toolName}`,
        metadata: { 
          toolName, 
          error: error.name || 'UnknownError',
          stack: error.stack?.split('\n')[0] // Just the first line for debugging
        }
      };
    }
  }
  
  /**
   * Find the routing configuration for a tool name
   * Checks prefixes in order of specificity (longest first)
   */
  private static findRoutingConfig(toolName: string) {
    // Sort prefixes by length (descending) to match most specific first
    const sortedPrefixes = Object.keys(TOOL_ROUTING_MAP).sort((a, b) => b.length - a.length);
    
    for (const prefix of sortedPrefixes) {
      if (toolName.startsWith(prefix)) {
        return TOOL_ROUTING_MAP[prefix];
      }
    }
    
    return null;
  }
  
  /**
   * Get all supported tool prefixes (for debugging/documentation)
   */
  static getSupportedPrefixes(): string[] {
    return Object.keys(TOOL_ROUTING_MAP);
  }
  
  /**
   * Add a new integration routing configuration
   * This allows dynamic addition of new integrations
   */
  static addIntegration(
    prefix: string, 
    config: {
      edgeFunction: string;
      actionMapping: (toolName: string) => string;
      parameterMapping?: (params: Record<string, any>, context?: any) => Record<string, any>;
    }
  ) {
    TOOL_ROUTING_MAP[prefix] = config;
    console.log(`[UniversalToolExecutor] Added routing for prefix: ${prefix} -> ${config.edgeFunction}`);
  }
}
