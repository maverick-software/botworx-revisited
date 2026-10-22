/**
 * Function Calling Manager - MCP Unified Architecture
 * 
 * Uses proper MCP (Model Context Protocol) architecture where:
 * - ALL tools are MCP tools (Gmail, SMTP, WebSearch, Zapier, etc.)
 * - Single database query for all authorized tools
 * - Unified permission checking via agent_integration_permissions
 * - Tool caching with message-count + time-based invalidation
 * 
 * Replaced old 4-provider system (GmailProvider, SMTPProvider, etc.)
 * with unified MCP tool discovery
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAIFunction, MCPToolResult } from './base.ts';
import { createLogger } from '../../shared/utils/logger.ts';

const logger = createLogger('FunctionCallingManager');

// NOTE: Removed separate providers - now using unified MCP architecture
// All tools (Gmail, SMTP, WebSearch, Zapier) are now MCP tools
// Old providers: SMTPProvider, GmailProvider, WebSearchProvider, MCPProvider

// Tool cache interface
interface CachedTools {
  tools: OpenAIFunction[];
  messageCount: number;
  lastValidated: number;
  expires: number;
}

export class FunctionCallingManager {
  private supabase: SupabaseClient;
  private authToken: string;
  
  // Execution tracking to prevent duplicates
  private executionTracker: Map<string, Promise<MCPToolResult>> = new Map();
  
  // Tool caching system - TEMPORARILY DISABLED for debugging (Oct 6, 2025)
  // Need to diagnose why LLM is not extracting parameters correctly
  private toolsCache: Map<string, CachedTools> = new Map();
  private readonly CACHE_MESSAGE_THRESHOLD = 0; // DISABLED - always refresh
  private readonly CACHE_TIME_THRESHOLD = 0; // DISABLED - always refresh
  
  // Universal tool executor for all integrations
  private toolExecutor: typeof import('./universal-tool-executor.ts').UniversalToolExecutor | null = null;
  
  constructor(supabase: SupabaseClient, authToken: string = '') {
    this.supabase = supabase;
    this.authToken = authToken;
    
    // All tools are now unified under MCP architecture with universal execution routing
    console.log('[FunctionCalling] Initialized with unified MCP architecture and universal tool execution');
  }

  /**
   * Get the universal tool executor (lazy-loaded)
   */
  private async getToolExecutor() {
    if (!this.toolExecutor) {
      const module = await import('./universal-tool-executor.ts');
      this.toolExecutor = module.UniversalToolExecutor;
      console.log(`[FunctionCalling] Loaded universal tool executor with support for: ${this.toolExecutor.getSupportedPrefixes().join(', ')}`);
    }
    return this.toolExecutor;
  }

  /**
   * Get all available tools for an agent using proper MCP architecture
   * Single unified query instead of 4 separate provider calls
   * Revalidates every 15 messages OR 10 minutes, whichever comes first
   */
  async getAvailableTools(agentId: string, userId: string, currentMessageCount?: number): Promise<OpenAIFunction[]> {
    const cacheKey = `${agentId}:${userId}`;
    const now = Date.now();
    const msgCount = currentMessageCount || 0;
    
    // Check cache first
    const cached = this.toolsCache.get(cacheKey);
    if (cached) {
      const messageThresholdPassed = msgCount - cached.messageCount >= this.CACHE_MESSAGE_THRESHOLD;
      const timeThresholdPassed = now - cached.lastValidated >= this.CACHE_TIME_THRESHOLD;
      
      if (!messageThresholdPassed && !timeThresholdPassed) {
        console.log(`[FunctionCalling] ⚡ Using cached MCP tools for agent ${agentId} (${cached.tools.length} tools, age: ${Math.round((now - cached.lastValidated) / 1000)}s, msgs since: ${msgCount - cached.messageCount})`);
        return cached.tools;
      } else {
        console.log(`[FunctionCalling] 🔄 MCP cache expired for agent ${agentId} - Messages: ${messageThresholdPassed ? 'YES' : 'NO'} (${msgCount - cached.messageCount}/${this.CACHE_MESSAGE_THRESHOLD}), Time: ${timeThresholdPassed ? 'YES' : 'NO'} (${Math.round((now - cached.lastValidated) / 1000)}s)`);
      }
    }
    
    console.log(`[FunctionCalling] 🔍 Getting MCP tools for agent ${agentId}, user ${userId}`);
    
    try {
      // Call dedicated get-agent-tools edge function for better architecture
      const { data: toolsResponse, error } = await this.supabase.functions.invoke('get-agent-tools', {
        body: { agent_id: agentId, user_id: userId }
      });

      if (error) {
        console.error('[FunctionCalling] Error calling get-agent-tools function:', error);
        // Fallback to cached tools if available
        if (cached) {
          console.log(`[FunctionCalling] 🚨 Using stale cache as fallback (${cached.tools.length} tools)`);
          return cached.tools;
        }
        return [];
      }

      if (!toolsResponse?.success) {
        console.error('[FunctionCalling] get-agent-tools returned error:', toolsResponse?.error);
        // Fallback to cached tools if available
        if (cached) {
          console.log(`[FunctionCalling] 🚨 Using stale cache as fallback (${cached.tools.length} tools)`);
          return cached.tools;
        }
        return [];
      }

      const mcpTools: OpenAIFunction[] = toolsResponse.tools || [];
      
      console.log(`[FunctionCalling] ✅ Retrieved ${mcpTools.length} tools from ${toolsResponse.metadata?.provider_count || 0} providers via edge function`);
      if (toolsResponse.metadata?.provider_count) {
        console.log(`[FunctionCalling] Providers: ${toolsResponse.metadata.provider_count}, Tools: ${mcpTools.map((t: any) => t.name).join(', ')}`);
      }

      if (mcpTools.length === 0) {
        console.log(`[FunctionCalling] No MCP tools available for agent ${agentId}`);
        const emptyResult: OpenAIFunction[] = [];
        this.toolsCache.set(cacheKey, {
          tools: emptyResult,
          messageCount: msgCount,
          lastValidated: now,
          expires: now + this.CACHE_TIME_THRESHOLD
        });
        return emptyResult;
      }

      // Cache the results
      this.toolsCache.set(cacheKey, {
        tools: mcpTools,
        messageCount: msgCount,
        lastValidated: now,
        expires: now + this.CACHE_TIME_THRESHOLD
      });

      console.log(`[FunctionCalling] ✅ Retrieved ${mcpTools.length} MCP tools for agent ${agentId}`);
      console.log(`[FunctionCalling] MCP tool names:`, JSON.stringify(mcpTools.map(t => t.name), null, 2));

      return mcpTools;
      
    } catch (error) {
      console.error('[FunctionCalling] Error in MCP tool discovery:', error);
      // Return cached tools if available, even if expired, as fallback
      if (cached) {
        console.log(`[FunctionCalling] 🚨 Using stale cache as fallback (${cached.tools.length} tools)`);
        return cached.tools;
      }
      return [];
    }
  }

  /**
   * Map provider name and allowed scopes to actual tool definitions
   * Since tools are not stored in database, we use hardcoded mappings
   */
  private getToolsForProvider(providerName: string, allowedScopes: string[]): OpenAIFunction[] {
    const tools: OpenAIFunction[] = [];

    switch (providerName.toLowerCase()) {
      case 'gmail':
        // Gmail OAuth scopes to tools
        if (allowedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')) {
          tools.push({
            name: 'gmail_read_emails',
            description: 'Read emails from Gmail inbox',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query for emails' },
                max_results: { type: 'number', description: 'Maximum number of emails to return', default: 10 }
              },
              required: ['query']
            }
          });
          tools.push({
            name: 'gmail_search_emails', 
            description: 'Search emails in Gmail',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Gmail search query' },
                max_results: { type: 'number', description: 'Maximum results', default: 10 }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('https://www.googleapis.com/auth/gmail.send')) {
          tools.push({
            name: 'gmail_send_email',
            description: 'Send email via Gmail',
            parameters: {
              type: 'object', 
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body content' },
                cc: { type: 'string', description: 'CC recipients (optional)' },
                bcc: { type: 'string', description: 'BCC recipients (optional)' }
              },
              required: ['to', 'subject', 'body']
            }
          });
        }
        
        if (allowedScopes.includes('https://www.googleapis.com/auth/gmail.modify')) {
          tools.push({
            name: 'gmail_email_actions',
            description: 'Perform actions on Gmail emails (mark read, archive, etc.)',
            parameters: {
              type: 'object',
              properties: {
                message_id: { type: 'string', description: 'Gmail message ID' },
                action: { type: 'string', enum: ['mark_read', 'mark_unread', 'archive', 'delete'], description: 'Action to perform' }
              },
              required: ['message_id', 'action']
            }
          });
        }
        break;

      case 'serper_api':
        // Serper API web search tools
        if (allowedScopes.includes('web_search')) {
          tools.push({
            name: 'web_search',
            description: 'Search the web using Serper API',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 },
                country: { type: 'string', description: 'Country code for localized results', default: 'us' }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('news_search')) {
          tools.push({
            name: 'news_search', 
            description: 'Search news articles using Serper API',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'News search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('image_search')) {
          tools.push({
            name: 'image_search',
            description: 'Search images using Serper API', 
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Image search query' },
                num_results: { type: 'number', description: 'Number of results', default: 10 }
              },
              required: ['query']
            }
          });
        }
        
        if (allowedScopes.includes('local_search')) {
          tools.push({
            name: 'local_search',
            description: 'Search local businesses using Serper API',
            parameters: {
              type: 'object', 
              properties: {
                query: { type: 'string', description: 'Local search query' },
                location: { type: 'string', description: 'Location for local search' }
              },
              required: ['query', 'location']
            }
          });
        }
        break;

      case 'smtp':
        // SMTP email tools
        if (allowedScopes.includes('send_email')) {
          tools.push({
            name: 'smtp_send_email',
            description: 'Send email via SMTP server',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' }, 
                body: { type: 'string', description: 'Email body content' },
                from_name: { type: 'string', description: 'Sender name (optional)' }
              },
              required: ['to', 'subject', 'body']
            }
          });
        }
        
        if (allowedScopes.includes('email_templates')) {
          tools.push({
            name: 'smtp_email_templates',
            description: 'Send templated emails via SMTP',
            parameters: {
              type: 'object',
              properties: {
                template_name: { type: 'string', description: 'Template identifier' },
                to: { type: 'string', description: 'Recipient email' },
                variables: { type: 'object', description: 'Template variables' }
              },
              required: ['template_name', 'to']
            }
          });
        }
        
        if (allowedScopes.includes('email_stats')) {
          tools.push({
            name: 'smtp_email_stats',
            description: 'Get SMTP email sending statistics',
            parameters: {
              type: 'object',
              properties: {
                date_range: { type: 'string', description: 'Date range for stats (e.g., "7d", "30d")' }
              }
            }
          });
        }
        break;

      default:
        console.warn(`[FunctionCalling] Unknown provider: ${providerName}`);
        break;
    }

    return tools;
  }

  /**
   * Manually invalidate tool cache for an agent (useful when permissions change)
   */
  invalidateToolCache(agentId: string, userId: string): void {
    const cacheKey = `${agentId}:${userId}`;
    const deleted = this.toolsCache.delete(cacheKey);
    if (deleted) {
      console.log(`[FunctionCalling] 🗑️ Invalidated tool cache for agent ${agentId}`);
    }
  }

  /**
   * Clear all expired cache entries (maintenance)
   */
  cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, cached] of this.toolsCache.entries()) {
      if (now > cached.expires) {
        this.toolsCache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[FunctionCaching] 🧹 Cleaned up ${removedCount} expired cache entries`);
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): { size: number, entries: Array<{key: string, tools: number, age: number}> } {
    const now = Date.now();
    const entries = Array.from(this.toolsCache.entries()).map(([key, cached]) => ({
      key,
      tools: cached.tools.length,
      age: Math.round((now - cached.lastValidated) / 1000)
    }));
    
    return {
      size: this.toolsCache.size,
      entries
    };
  }

  /**
   * Execute a function call with duplicate prevention
   */
  async executeFunction(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    // Create execution key for duplicate prevention
    const executionKey = `${agentId}:${userId}:${functionName}:${JSON.stringify(parameters)}`;
    
    // Check if this exact execution is already in progress
    if (this.executionTracker.has(executionKey)) {
      console.log(`[FunctionCalling] Duplicate execution detected for ${functionName}, returning existing promise`);
      return await this.executionTracker.get(executionKey)!;
    }

    console.log(`[FunctionCalling] Executing function ${functionName} for agent ${agentId}`);
    
    // Create execution promise
    const executionPromise = this.executeToolInternal(agentId, userId, functionName, parameters);
    
    // Track execution to prevent duplicates
    this.executionTracker.set(executionKey, executionPromise);
    
    try {
      const result = await executionPromise;
      return result;
    } finally {
      // Clean up tracking after 30 seconds
      setTimeout(() => {
        this.executionTracker.delete(executionKey);
      }, 30000);
    }
  }

  /**
   * Internal tool execution using universal router
   * This routes ANY tool to the appropriate integration edge function
   */
  private async executeToolInternal(
    agentId: string,
    userId: string,
    functionName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      // Get the universal tool executor
      const executor = await this.getToolExecutor();
      
      // Permission check: If the tool was discovered by get-agent-tools, it's authorized
      // This is our simplified permission model for the unified architecture
      console.log(`[FunctionCalling] Executing ${functionName} for agent ${agentId} (authorized via tool discovery)`);
      
      // Execute using universal routing
      const result = await executor.executeTool({
        agentId,
        userId,
        toolName: functionName,
        parameters,
        supabase: this.supabase,
        authToken: this.authToken  // Pass auth token for edge function calls
      });
      
      // Add execution time to metadata
      if (result.metadata) {
        result.metadata.execution_time_ms = Date.now() - startTime;
      } else {
        result.metadata = { execution_time_ms: Date.now() - startTime };
      }
      
      return result;
      
    } catch (error: any) {
      console.error(`[FunctionCalling] Error executing ${functionName}:`, error);
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        metadata: { 
          execution_time_ms: Date.now() - startTime,
          error: error.name || 'UnknownError',
          toolName: functionName
        }
      };
    }
  }

  /**
   * Format tool execution result for display
   */
  async formatResult(functionName: string, result: MCPToolResult): Promise<string> {
    logger.debug(`Formatting result for ${functionName} (success: ${result.success})`);
    
    if (result.success) {
      // Use provider-specific formatting if available
      if (functionName.startsWith('smtp_')) {
        try {
          // Use SMTP-specific formatting
          const { SMTPToolResultFormatter } = await import('../smtp-tools.ts');
          return SMTPToolResultFormatter.formatResult(functionName, result.data, true);
        } catch {
          // Fallback to generic formatting if SMTP formatter not available
        }
      }
      
      // Special handling for media library document content
      if (functionName === 'get_document_content' && result.data?.document_content) {
        // Return the actual document content directly so the agent can read it
        return result.data.document_content;
      }
      
      // Special handling for search_documents to make results more readable
      if (functionName === 'search_documents' && result.data?.documents) {
        let formattedResult = `Found ${result.data.documents.length} document(s) matching your search:\n\n`;
        for (const doc of result.data.documents) {
          formattedResult += `📄 ${doc.display_name || doc.file_name}\n`;
          if (doc.relevance_score) {
            formattedResult += `   Relevance: ${(doc.relevance_score * 100).toFixed(1)}%\n`;
          }
          if (doc.snippet) {
            formattedResult += `   Preview: ${doc.snippet}\n`;
          }
          formattedResult += `   ID: ${doc.id}\n\n`;
        }
        return formattedResult;
      }
      
      // Special handling for list_assigned_documents
      if (functionName === 'list_assigned_documents' && result.data?.documents) {
        let formattedResult = `You have ${result.data.documents.length} assigned document(s):\n\n`;
        for (const doc of result.data.documents) {
          formattedResult += `📄 ${doc.display_name || doc.file_name}\n`;
          formattedResult += `   Type: ${doc.file_type}\n`;
          formattedResult += `   Status: ${doc.processing_status}\n`;
          if (doc.text_content) {
            formattedResult += `   Content: ${doc.text_content.length} characters\n`;
          }
          formattedResult += `   ID: ${doc.id}\n\n`;
        }
        return formattedResult;
      }
      
      // Special handling for search_document_content
      if (functionName === 'search_document_content' && result.data?.results) {
        let formattedResult = `Found ${result.data.results_found} result(s) for "${result.data.search_query}" in ${result.data.document_name}`;
        if (result.data.total_matches > result.data.results_found) {
          formattedResult += ` (showing top ${result.data.results_found} of ${result.data.total_matches} matches)`;
        }
        formattedResult += `:\n\n`;
        
        for (const match of result.data.results) {
          formattedResult += `🔍 **Match ${match.rank}** (Relevance: ${Math.round(match.relevance_score * 100)}%)\n`;
          formattedResult += `Position: Character ${match.character_position.toLocaleString()}\n\n`;
          
          if (match.context.before) {
            formattedResult += `...${match.context.before}\n`;
          }
          formattedResult += `**${match.snippet}**\n`;
          if (match.context.after) {
            formattedResult += `${match.context.after}...\n`;
          }
          formattedResult += `\n---\n\n`;
        }
        
        return formattedResult;
      }
      
      // Special handling for contact search
      if (functionName === 'search_contacts' && result.data?.contacts) {
        logger.debug(`Using special contact formatting (${result.data.contacts.length} contacts)`);
        
        const contacts = result.data.contacts;
        const summary = result.data.summary || `Found ${contacts.length} contact(s)`;
        
        if (contacts.length === 0) {
          return `No contacts found. ${summary}`;
        }
        
        logger.debug(`Formatting ${contacts.length} contact(s)`);
        let formattedResult = `${summary}\n\n`;
        for (const contact of contacts) {
          formattedResult += `👤 **${contact.name || contact.display_name}**\n`;
          if (contact.job_title) {
            formattedResult += `   Role: ${contact.job_title}\n`;
          }
          if (contact.organization) {
            formattedResult += `   Company: ${contact.organization}\n`;
          }
          if (contact.primary_email) {
            formattedResult += `   Email: ${contact.primary_email}\n`;
          }
          if (contact.primary_phone) {
            formattedResult += `   Phone: ${contact.primary_phone}\n`;
          }
          if (contact.tags && contact.tags.length > 0) {
            formattedResult += `   Tags: ${contact.tags.join(', ')}\n`;
          }
          formattedResult += `   Contact ID: ${contact.id}\n\n`;
        }
        
        const finalResult = formattedResult.trim();
        logger.debug(`Formatted result: ${finalResult.length} chars`);
        return finalResult;
      }
      
      // Special handling for Outlook/Zapier MCP email tools
      if (functionName.includes('microsoft_outlook') || functionName.includes('find_emails')) {
        // Parse the MCP result content
        const content = result.data?.content || result.data;
        
        if (Array.isArray(content)) {
          // Handle array of content items (MCP protocol format)
          let formattedResult = '';
          for (const item of content) {
            if (item.type === 'text' && item.text) {
              // Try to parse JSON from text
              try {
                const emailData = JSON.parse(item.text);
                if (emailData.emails && Array.isArray(emailData.emails)) {
                  formattedResult += `Found ${emailData.emails.length} email(s):\n\n`;
                  for (const email of emailData.emails.slice(0, 20)) { // Limit to 20 emails max
                    formattedResult += `📧 **${email.subject || '(No subject)'}**\n`;
                    formattedResult += `   From: ${email.from || 'Unknown'}\n`;
                    if (email.receivedDateTime) {
                      formattedResult += `   Received: ${email.receivedDateTime}\n`;
                    }
                    if (email.bodyPreview) {
                      const preview = email.bodyPreview.substring(0, 150);
                      formattedResult += `   Preview: ${preview}${email.bodyPreview.length > 150 ? '...' : ''}\n`;
                    }
                    formattedResult += `\n`;
                  }
                  if (emailData.emails.length > 20) {
                    formattedResult += `\n... and ${emailData.emails.length - 20} more email(s)\n`;
                  }
                  return formattedResult;
                }
              } catch {
                // Not JSON or different format, return as-is (truncated)
                const textContent = item.text.substring(0, 2000);
                return textContent + (item.text.length > 2000 ? '\n\n[Content truncated for brevity]' : '');
              }
            }
          }
        }
      }
      
      // Format successful result (generic)
      let formattedResult = `✅ Successfully executed ${functionName}`;
      
      if (result.data) {
        if (typeof result.data === 'string') {
          formattedResult += `\n\nResult: ${result.data}`;
        } else {
          formattedResult += `\n\nResult: ${JSON.stringify(result.data, null, 2)}`;
        }
      }
      
      if (result.metadata?.execution_time_ms) {
        formattedResult += `\n\n⏱️ Execution time: ${result.metadata.execution_time_ms}ms`;
      }
      
      return formattedResult;
    } else {
      // Use provider-specific error formatting
      if (functionName.startsWith('smtp_')) {
        try {
          const { SMTPToolResultFormatter } = await import('../smtp-tools.ts');
          return SMTPToolResultFormatter.formatResult(functionName, result, false);
        } catch {
          // Fallback to generic formatting if SMTP formatter not available
        }
      }
      
      // Format error result with details
      let errorMessage = `❌ Failed to execute ${functionName}\n\n`;
      errorMessage += `**Error Details:**\n`;
      errorMessage += `• Error: ${result.error || 'Unknown error'}\n`;
      
      if (result.metadata?.execution_time_ms) {
        errorMessage += `• Execution time: ${result.metadata.execution_time_ms}ms\n`;
      }
      
      if (result.data) {
        errorMessage += `• Additional info: ${JSON.stringify(result.data, null, 2)}\n`;
      }
      
      return errorMessage;
    }
  }

  /**
   * Clear all provider caches for an agent
   */
  clearCaches(agentId: string, userId: string): void {
    this.gmailProvider.clearCache(agentId, userId);
    this.smtpProvider.clearCache(agentId, userId);
    this.webSearchProvider.clearCache(agentId, userId);
    this.mcpProvider.clearCache(agentId);
  }

  /**
   * Get execution statistics for debugging
   */
  getExecutionStats(): {
    activeExecutions: number;
    gmail: { size: number; entries: string[] };
    smtp: { size: number; entries: string[] };
    webSearch: { size: number; entries: string[] };
  } {
    return {
      activeExecutions: this.executionTracker.size,
      gmail: this.gmailProvider.getCacheStats(),
      smtp: this.smtpProvider.getCacheStats(),
      webSearch: this.webSearchProvider.getCacheStats(),
    };
  }
}

// Export for backwards compatibility
export { FunctionCallingManager as default };
