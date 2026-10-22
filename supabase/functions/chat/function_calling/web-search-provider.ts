/**
 * Web Search Tool Provider
 * Handles web search operations
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAIFunction, MCPToolResult, ToolProvider } from './base.ts';

export class WebSearchProvider implements ToolProvider {
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
   * Get web search tools for an agent
   */
  async getTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    const cacheKey = `${agentId}:${userId}`;
    const now = Date.now();

    // Check cache
    if (this.toolsCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        return this.toolsCache.get(cacheKey) || [];
      }
    }

    try {
      // Check if agent has web search enabled and user has active credentials
      const { data: agent } = await this.supabase
        .from('agents')
        .select('web_search_enabled')
        .eq('id', agentId)
        .eq('user_id', userId)
        .single();

      if (!agent?.web_search_enabled) {
        console.log(`[WebSearch] Web search not enabled for agent ${agentId}`);
        this.toolsCache.set(cacheKey, []);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
        return [];
      }

      // Check for active web search credentials from unified integration credentials
      const { data: credentials } = await this.supabase
        .from('user_integration_credentials')
        .select(`
          *,
          service_providers!inner(name, display_name)
        `)
        .eq('user_id', userId)
        .eq('credential_type', 'api_key')
        .eq('connection_status', 'active');

      // Filter for web search providers (Serper, SerpAPI, Brave Search)
      const webSearchCredentials = credentials?.filter(c => 
        c.service_providers && 
        ['serper_api', 'serpapi', 'brave_search'].includes(c.service_providers.name)
      ) || [];

      if (webSearchCredentials.length === 0) {
        console.log(`[WebSearch] No active web search credentials for user ${userId}`);
        this.toolsCache.set(cacheKey, []);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
        return [];
      }

      console.log(`[WebSearch] Agent ${agentId} has web search enabled and user has ${webSearchCredentials.length} active web search credentials`);

      const tools: OpenAIFunction[] = [
        {
          name: 'web_search',
          description: 'Search the web for current information and recent news. Use this when you need up-to-date information that might not be in your training data.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query. Be specific and include relevant keywords.',
              },
              num_results: {
                type: 'number',
                description: 'Number of search results to return (default: 10, max: 20)',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'scrape_and_summarize',
          description: 'Scrape content from a specific URL and provide an AI-powered summary. Useful for analyzing articles, documentation, or web pages.',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to scrape and summarize',
              },
              focus: {
                type: 'string',
                description: 'Optional focus area for the summary (e.g., "main points", "pricing", "technical details")',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'news_search',
          description: 'Search for recent news articles on a specific topic. Useful for current events and recent developments.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'News search query',
              },
              days_back: {
                type: 'number',
                description: 'How many days back to search (default: 7, max: 30)',
                default: 7,
              },
            },
            required: ['query'],
          },
        },
      ];

      console.log(`[WebSearch] Available web search tools for agent ${agentId}:`, tools.map(t => t.name));

      // Cache results
      this.toolsCache.set(cacheKey, tools);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return tools;

    } catch (error) {
      console.error('[WebSearch] Error getting web search tools:', error);
      return [];
    }
  }

  /**
   * Validate permissions for web search tools
   */
  async validatePermissions(agentId: string, userId: string, toolName: string): Promise<boolean> {
    const tools = await this.getTools(agentId, userId);
    return tools.some(t => t.name === toolName);
  }

  /**
   * Execute web search tool
   */
  async executeTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[WebSearch] Executing ${toolName} for agent ${agentId}`);

      // Validate permissions
      if (!(await this.validatePermissions(agentId, userId, toolName))) {
        return {
          success: false,
          error: `Web search tool ${toolName} is not available for this agent`,
          metadata: { execution_time_ms: Date.now() - startTime }
        };
      }

      // Call web search API
      const { data, error } = await this.supabase.functions.invoke('web-search-api', {
        body: {
          action: toolName,
          user_id: userId,
          agent_id: agentId,
          ...parameters
        },
        headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}
      });

      if (error) {
        return {
          success: false,
          error: `Web search API error: ${error.message}`,
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
      console.error(`[WebSearch] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error.message || 'Web search execution failed',
        metadata: { execution_time_ms: Date.now() - startTime }
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(agentId: string, userId: string): void {
    const cacheKey = `${agentId}:${userId}`;
    this.toolsCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
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
