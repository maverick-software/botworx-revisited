/**
 * Universal Tool Execution Router
 * Routes tool execution to appropriate integration edge functions
 * This scales to any number of integrations without code changes
 * 
 * Features intelligent error enhancement for LLM-friendly retry mechanism
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { MCPToolResult } from './base.ts';
import { createLogger } from '../../shared/utils/logger.ts';

const logger = createLogger('UniversalToolExecutor');

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
  
  // ClickSend SMS/MMS tools
  'clicksend_': {
    edgeFunction: 'clicksend-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'clicksend_send_sms': 'send_sms',
        'clicksend_send_mms': 'send_mms',
        'clicksend_get_balance': 'get_balance',
        'clicksend_get_sms_history': 'get_sms_history',
        'clicksend_get_delivery_receipts': 'get_delivery_receipts',
        'clicksend_validate_number': 'validate_number'
      };
      return actionMap[toolName] || 'send_sms';
    },
    parameterMapping: (params: Record<string, any>, context: any) => {
      const actionMap: Record<string, string> = {
        'clicksend_send_sms': 'send_sms',
        'clicksend_send_mms': 'send_mms',
        'clicksend_get_balance': 'get_balance',
        'clicksend_get_sms_history': 'get_sms_history',
        'clicksend_get_delivery_receipts': 'get_delivery_receipts',
        'clicksend_validate_number': 'validate_number'
      };
      const action = actionMap[context.toolName] || 'send_sms';
      
      return {
        action: action,
        agent_id: context.agentId,
        user_id: context.userId, 
        params: params
      };
    }
  },
  
  // Microsoft Outlook tools
  'outlook_': {
    edgeFunction: 'microsoft-outlook-api',
    actionMapping: (toolName: string) => {
      const actionMap: Record<string, string> = {
        'outlook_send_email': 'send_email',
        'outlook_read_emails': 'get_emails',
        'outlook_search_emails': 'search_emails',
        'outlook_create_event': 'create_calendar_event',
        'outlook_get_events': 'get_calendar_events',
        'outlook_get_contacts': 'get_contacts',
        'outlook_search_contacts': 'search_contacts'
      };
      return actionMap[toolName] || 'unknown_action';
    },
    parameterMapping: (params: Record<string, any>, context: any) => {
      const actionMap: Record<string, string> = {
        'outlook_send_email': 'send_email',
        'outlook_read_emails': 'get_emails',
        'outlook_search_emails': 'search_emails',
        'outlook_create_event': 'create_calendar_event',
        'outlook_get_events': 'get_calendar_events',
        'outlook_get_contacts': 'get_contacts',
        'outlook_search_contacts': 'search_contacts'
      };
      const action = actionMap[context.toolName] || 'unknown_action';
      
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
  
  // Conversation Memory tools (Working Memory System)
  'search_working_memory': {
    edgeFunction: 'conversation-memory-mcp',
    actionMapping: () => 'search_working_memory',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'search_working_memory',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'search_conversation_summaries': {
    edgeFunction: 'conversation-memory-mcp',
    actionMapping: () => 'search_conversation_summaries',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'search_conversation_summaries',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  'get_conversation_summary_board': {
    edgeFunction: 'conversation-memory-mcp',
    actionMapping: () => 'get_conversation_summary_board',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_conversation_summary_board',
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
  },
  
  // Contact Management tools
  'search_contacts': {
    edgeFunction: 'contact-mcp-tools',
    actionMapping: () => 'search_contacts',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'search_contacts',
      agent_id: context.agentId,
      user_id: context.userId,
      ...params  // Flatten parameters directly into the body
    })
  },
  
  'get_contact_details': {
    edgeFunction: 'contact-mcp-tools',
    actionMapping: () => 'get_contact_details',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_contact_details',
      agent_id: context.agentId,
      user_id: context.userId,
      ...params  // Flatten parameters directly into the body
    })
  },

  // Temporary Chat Links tools
  'create_temporary_chat_link': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'create_temporary_chat_link',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'create_temporary_chat_link',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      ...params
    })
  },

  'list_temporary_chat_links': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'list_temporary_chat_links',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'list_temporary_chat_links',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      ...params
    })
  },

  'update_temporary_chat_link': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'update_temporary_chat_link',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'update_temporary_chat_link',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      ...params
    })
  },

  'delete_temporary_chat_link': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'delete_temporary_chat_link',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'delete_temporary_chat_link',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      ...params
    })
  },

  'get_temporary_chat_analytics': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'get_temporary_chat_analytics',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_temporary_chat_analytics',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      ...params
    })
  },

  'manage_temporary_chat_session': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'manage_temporary_chat_session',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'manage_temporary_chat_session',
      agent_id: context.agentId,
      user_id: context.userId,
      tool_name: context.toolName,
      ...params
    })
  },

  // Artifact tools - AI-generated content management
  'create_artifact': {
    edgeFunction: 'artifacts-mcp',
    actionMapping: () => 'create_artifact',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'create_artifact',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },

  'update_artifact': {
    edgeFunction: 'artifacts-mcp',
    actionMapping: () => 'update_artifact',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'update_artifact',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },

  'list_artifacts': {
    edgeFunction: 'artifacts-mcp',
    actionMapping: () => 'list_artifacts',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'list_artifacts',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },

  'get_artifact': {
    edgeFunction: 'artifacts-mcp',
    actionMapping: () => 'get_artifact',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_artifact',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },

  'get_version_history': {
    edgeFunction: 'artifacts-mcp',
    actionMapping: () => 'get_version_history',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'get_version_history',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },

  'delete_artifact': {
    edgeFunction: 'artifacts-mcp',
    actionMapping: () => 'delete_artifact',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'delete_artifact',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },

  // Canvas MCP Tools (line-by-line editing)
  'canvas_get_content': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_get_content',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_get_content', params })
  },
  'canvas_replace_lines': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_replace_lines',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_replace_lines', params })
  },
  'canvas_insert_lines': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_insert_lines',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_insert_lines', params })
  },
  'canvas_delete_lines': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_delete_lines',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_delete_lines', params })
  },
  'canvas_search_replace': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_search_replace',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_search_replace', params })
  },
  'canvas_get_diff': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_get_diff',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_get_diff', params })
  },
  'canvas_save_snapshot': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_save_snapshot',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_save_snapshot', params })
  },
  'canvas_revert_to_snapshot': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_revert_to_snapshot',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_revert_to_snapshot', params })
  },
  'canvas_undo': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_undo',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_undo', params })
  },
  'canvas_redo': {
    edgeFunction: 'canvas-mcp',
    actionMapping: () => 'canvas_redo',
    parameterMapping: (params: Record<string, any>) => ({ action: 'canvas_redo', params })
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
  const isEmailTool = toolName.startsWith('gmail_') || toolName.startsWith('smtp_') || toolName.startsWith('microsoft_outlook_');
  const isSearchTool = toolName.startsWith('web_search') || toolName.startsWith('news_') || toolName.startsWith('scrape_');
  const isSMSTool = toolName.startsWith('clicksend_');
  const isContactTool = toolName === 'search_contacts' || toolName === 'get_contact_details';
  const isOutlookTool = toolName.startsWith('microsoft_outlook_');
  
  // Missing parameters errors
  if (lowerError.includes('missing') && (lowerError.includes('parameter') || lowerError.includes('field') || lowerError.includes('required'))) {
    if (isOutlookTool) {
      // Specific handling for Outlook/Zapier MCP tools
      if (lowerError.includes('searchvalue') || lowerError.includes('search value')) {
        if (toolName === 'microsoft_outlook_find_emails') {
          return 'Question: To find emails, I need a search value. Please provide:\n' +
                 '• A search term (e.g., "project update", "meeting notes")\n' +
                 '• A sender email address\n' +
                 '• Or leave it empty (use "") to get the most recent emails\n\n' +
                 'Use the "searchValue" parameter, not "instructions".';
        }
      }
      return 'Question: What Outlook information is missing? Please check the required parameters for this tool.';
    }
    if (isEmailTool) {
      return 'Question: What email details are missing? Please provide the recipient email address, subject line, and message content.';
    }
    if (isSearchTool) {
      return 'Question: What would you like me to search for? Please provide a search query or topic.';
    }
    if (isSMSTool) {
      return 'Question: What SMS details are missing? Please provide the recipient phone number (in international format like +1234567890) and the message text you want to send.';
    }
    if (isContactTool) {
      if (toolName === 'search_contacts') {
        return 'Question: What would you like to search for in your contacts? You can use natural language like:\n' +
               '• "list all contacts you have access to"\n' +
               '• "find contacts with numbers that start with 661"\n' +
               '• "show customers at Microsoft"\n' +
               '• "contacts with WhatsApp"\n' +
               '• "internal employees named John"\n' +
               '• "vendors in the technology sector"';
      }
      if (toolName === 'get_contact_details') {
        return 'Question: Which contact would you like to get details for? Please provide the contact ID from a previous search result.';
      }
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
    if (isSMSTool) {
      return 'Question: The ClickSend SMS service needs to be set up. Please go to the Integrations page to configure your ClickSend credentials, then try again.';
    }
    if (isContactTool) {
      return 'Question: There seems to be an issue accessing your contacts. Please ensure you have contacts in your contact list and the agent has permission to access them.';
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
    if (isSMSTool) {
      if (lowerError.includes('phone') || lowerError.includes('number')) {
        return 'Question: The phone number format is invalid. Please provide the phone number in international format (e.g., +1234567890 for US numbers).';
      }
      return 'Question: There seems to be an issue with the SMS parameters. Please check that the phone number is in international format and the message text is provided.';
    }
    if (isSearchTool) {
      return 'Question: There seems to be an issue with the search parameters. Please provide a clear search query or valid URLs to scrape.';
    }
    if (isContactTool) {
      if (toolName === 'search_contacts') {
        return 'Question: Please provide search criteria for contacts. You can use natural language queries like:\n' +
               '• "list all contacts" (shows all accessible contacts)\n' +
               '• "find contacts with phone numbers starting with 661"\n' +
               '• "show customers at Microsoft"\n' +
               '• "contacts with WhatsApp available"\n' +
               '• Or search by name, organization, or job title';
      }
      if (toolName === 'get_contact_details') {
        return 'Question: Please provide a valid contact ID. You can get contact IDs by using search_contacts first.';
      }
    }
  }
  
  // Pass through the actual error message - don't mask it with generic text
  // The error from the edge function is already descriptive and useful
  return error;
}

export class UniversalToolExecutor {
  
  /**
   * Check if tool requires user input before execution
   * Only blocks on first attempt - after user responds, conversation context handles it
   */
  static async checkRequiredUserInput(
    toolName: string, 
    agentId: string, 
    userId: string, 
    parameters: Record<string, any>,
    supabase: any
  ): Promise<{requiresInput: boolean, reason?: string, request?: any}> {
    try {
      // Get tool metadata to see if it requires user input
      const { data: toolsResponse, error } = await supabase.functions.invoke('get-agent-tools', {
        body: { agent_id: agentId, user_id: userId }
      });

      if (error || !toolsResponse?.success) {
        logger.error(`Failed to get tool metadata for input check:`, error);
        return { requiresInput: false };
      }

      const tool = toolsResponse.tools?.find((t: any) => t.name === toolName);
      if (!tool || !tool.requires_user_input) {
        return { requiresInput: false };
      }

      // IMPORTANT: This check only happens on the FIRST attempt
      // After the user provides the info in conversation, the LLM will naturally include it
      // We don't re-check - we trust the intelligent retry system
      
      // For now, just return that input is NOT required
      // The tool will fail naturally if realm_id is missing, and MCP retry handles it
      logger.debug(`Tool ${toolName} has requires_user_input metadata, but skipping check - letting MCP retry handle it`);
      return { requiresInput: false };

    } catch (err) {
      logger.error(`Error checking required user input:`, err);
      return { requiresInput: false }; // Fail open to avoid blocking execution
    }
  }

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
      logger.debug(`Executing ${toolName} for agent ${agentId}`);
      logger.debug(`Parameters:`, parameters);
      
      // Check tool status before execution
      const toolStatus = await this.checkToolStatus(toolName, agentId, userId, supabase);
      if (toolStatus.status !== 'active') {
        logger.warn(`Tool ${toolName} is ${toolStatus.status}: ${toolStatus.error_message}`);
        return {
          success: false,
          data: null,
          error: toolStatus.error_message || `Tool is ${toolStatus.status} and cannot be used.`
        };
      }
      
      // Check if tool requires user input that hasn't been provided yet
      const userInputCheck = await this.checkRequiredUserInput(toolName, agentId, userId, parameters, supabase);
      if (userInputCheck.requiresInput) {
        logger.info(`Tool ${toolName} requires user input: ${userInputCheck.reason}`);
        return {
          success: false,
          data: null,
          error: userInputCheck.reason || 'This tool requires additional information from you.',
          requires_user_input: true,
          user_input_request: userInputCheck.request,
          metadata: { toolName, requiresUserInput: true }
        };
      }
      
      // Find the appropriate routing configuration
      let routingConfig = this.findRoutingConfig(toolName);
      let mcpConnectionId: string | null = null;
      
      // If no prefix match, check if this is an MCP tool
      if (!routingConfig) {
        logger.debug(`No prefix match for ${toolName}, checking if it's an MCP tool...`);
        mcpConnectionId = await this.getMCPToolConnection(toolName, agentId, supabase);
        if (mcpConnectionId) {
          logger.debug(`${toolName} is an MCP tool, routing to mcp-execute`);
          routingConfig = {
            edgeFunction: 'mcp-execute',
            actionMapping: (toolName: string) => toolName, // Pass through tool name
            parameterMapping: (params: Record<string, any>, context: any) => ({
              connection_id: mcpConnectionId,
              tool_name: toolName,
              parameters: params,
              agent_id: context.agentId
            })
          };
        }
      }
      
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
        ? routingConfig.parameterMapping(parameters, mappingContext)
        : { ...baseParams, params: parameters };
      
      logger.info(`Routing ${toolName} -> ${routingConfig.edgeFunction}`);
      logger.debug(`Edge function params:`, edgeFunctionParams);
      
      // Prepare headers for edge function call (only authorization)
      const invokeOptions: any = {
        body: edgeFunctionParams
      };
      
      // Include authorization header if auth token is provided and valid
      if (authToken && authToken.trim().length > 0 && authToken !== 'undefined' && authToken !== 'null') {
        logger.debug(`Adding user auth token (length: ${authToken.length})`);
        invokeOptions.headers = {
          'Authorization': `Bearer ${authToken}`
        };
      } else {
        logger.debug(`No valid auth token - using service role`);
        logger.debug(`Auth token debug:`, { 
          provided: !!authToken, 
          length: authToken?.length || 0,
          value: authToken ? `${authToken.substring(0, 20)}...` : 'null/undefined'
        });
      }
      
      // Call the appropriate edge function
      logger.debug(`Calling edge function: ${routingConfig.edgeFunction}`);
      const { data, error } = await supabase.functions.invoke(routingConfig.edgeFunction, invokeOptions);
      
      logger.debug(`Edge function response:`, { hasError: !!error, hasData: !!data });
      
      if (error) {
        console.error(`[UniversalToolExecutor] Edge function error for ${toolName}:`, error);
        
        // Check if the error has a response body with detailed error information
        // Supabase Functions client puts the Response in error.context for non-2xx status codes
        if (error.context && error.context.body) {
          try {
            // The response body is a ReadableStream, we need to read it
            const errorBody = await error.context.json();
            console.log(`[UniversalToolExecutor] Parsed error response body:`, errorBody);
            
            // If the error body has our structured response, use it
            if (errorBody && typeof errorBody === 'object') {
              // Build comprehensive error message with guidance
              let comprehensiveError = errorBody.error || error.message || 'Unknown error';
              
              if (errorBody.guidance) {
                // Add suggestions
                if (errorBody.guidance.suggestions && errorBody.guidance.suggestions.length > 0) {
                  comprehensiveError += '\n\n💡 SUGGESTIONS:\n' + errorBody.guidance.suggestions.map((s: string) => `  • ${s}`).join('\n');
                }
                
                // Add example parameters
                if (errorBody.guidance.example_parameters) {
                  comprehensiveError += '\n\n✅ EXAMPLE PARAMETERS THAT WORK:\n' + JSON.stringify(errorBody.guidance.example_parameters, null, 2);
                }
                
                // Add available filters
                if (errorBody.guidance.available_filters) {
                  comprehensiveError += '\n\n📋 AVAILABLE FILTERS:\n';
                  for (const [key, value] of Object.entries(errorBody.guidance.available_filters)) {
                    if (Array.isArray(value)) {
                      comprehensiveError += `  • ${key}: [${value.join(', ')}]\n`;
                    } else {
                      comprehensiveError += `  • ${key}: ${value}\n`;
                    }
                  }
                }
              }
              
              return {
                success: false,
                error: comprehensiveError,
                requires_retry: errorBody.requires_retry !== false, // Default to true unless explicitly false
                metadata: { 
                  ...errorBody.metadata,
                  toolName, 
                  edgeFunction: routingConfig.edgeFunction, 
                  action,
                  originalError: errorBody.error,
                  hasGuidance: !!errorBody.guidance
                }
              };
            }
          } catch (parseError) {
            console.error(`[UniversalToolExecutor] Failed to parse error response body:`, parseError);
            // Fall through to generic error handling
          }
        }
        
        // Generic error handling if we couldn't parse the response body
        const originalError = error.message || 'Unknown error';
        const enhancedError = enhanceErrorForRetry(toolName, originalError);
        
        return {
          success: false,
          error: enhancedError,  // Use enhanced error for retry mechanism
          requires_retry: true,  // Default to retry for generic errors
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
          // If it's an error response, build comprehensive error message with all guidance
          if (!data.success && data.error) {
            // Build a comprehensive error message that includes:
            // 1. The actual error
            // 2. Suggestions from the edge function
            // 3. Example parameters if provided
            // 4. Available filters/options if provided
            let comprehensiveError = data.error;
            
            if (data.guidance) {
              // Add suggestions
              if (data.guidance.suggestions && data.guidance.suggestions.length > 0) {
                comprehensiveError += '\n\n💡 SUGGESTIONS:\n' + data.guidance.suggestions.map((s: string) => `  • ${s}`).join('\n');
              }
              
              // Add example parameters
              if (data.guidance.example_parameters) {
                comprehensiveError += '\n\n✅ EXAMPLE PARAMETERS THAT WORK:\n' + JSON.stringify(data.guidance.example_parameters, null, 2);
              }
              
              // Add available filters
              if (data.guidance.available_filters) {
                comprehensiveError += '\n\n📋 AVAILABLE FILTERS:\n';
                for (const [key, value] of Object.entries(data.guidance.available_filters)) {
                  if (Array.isArray(value)) {
                    comprehensiveError += `  • ${key}: [${value.join(', ')}]\n`;
                  } else {
                    comprehensiveError += `  • ${key}: ${value}\n`;
                  }
                }
              }
            }
            
            return {
              ...data,
              error: comprehensiveError,  // Comprehensive error with all guidance
              requires_retry: data.requires_retry,  // Preserve requires_retry flag from edge function
              metadata: { 
                ...data.metadata, 
                toolName, 
                edgeFunction: routingConfig.edgeFunction,
                action,
                originalError: data.error,
                hasGuidance: !!data.guidance
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
   * Check if a tool is an MCP tool and return its connection_id
   * Returns null if not an MCP tool, otherwise returns the connection_id
   */
  private static async getMCPToolConnection(toolName: string, agentId: string, supabase: SupabaseClient): Promise<string | null> {
    try {
      // Query mcp_tools_cache joined with agent_mcp_connections
      const { data, error } = await supabase
        .from('mcp_tools_cache')
        .select('id, connection_id, agent_mcp_connections!inner(agent_id)')
        .eq('tool_name', toolName)
        .eq('agent_mcp_connections.agent_id', agentId)
        .eq('agent_mcp_connections.is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error(`[UniversalToolExecutor] Error checking if ${toolName} is MCP tool:`, error);
        return null;
      }
      
      return data?.connection_id || null;
    } catch (error) {
      console.error(`[UniversalToolExecutor] Exception checking if ${toolName} is MCP tool:`, error);
      return null;
    }
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
    logger.debug(`Added routing for prefix: ${prefix} -> ${config.edgeFunction}`);
  }
}
