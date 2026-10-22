/**
 * MCP Client for Supabase Edge Functions
 * Implements the Model Context Protocol for server communication
 */

import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  isError?: boolean;
  [key: string]: any;
}

export class MCPClientError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'MCPClientError';
  }
}

export class MCPClient {
  private sessionId?: string;
  private requestId = 0;

  constructor(private serverUrl: string) {}

  /**
   * Initialize connection with the MCP server
   */
  async initialize(): Promise<void> {
    this.sessionId = uuidv4();
    
    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {},
          sampling: {}
        },
        clientInfo: {
          name: 'agentopia-mcp-client',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPClientError(
        `Failed to initialize MCP connection: ${response.error.message}`,
        response.error.code,
        response.error
      );
    }

    // Send initialized notification (optional, non-blocking)
    try {
      await this.sendNotification({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      });
    } catch (error) {
      // Log but don't fail - some servers don't support this notification
      console.warn('[MCPClient] Optional initialized notification failed:', error);
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.sessionId) {
      await this.initialize();
    }

    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/list',
      params: {}
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPClientError(
        `Failed to list tools: ${response.error.message}`,
        response.error.code,
        response.error
      );
    }

    return response.result?.tools || [];
  }

  /**
   * Call a specific tool with arguments
   */
  async callTool(toolName: string, args: Record<string, any> = {}): Promise<MCPToolResult> {
    if (!this.sessionId) {
      await this.initialize();
    }

    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPClientError(
        `Tool execution failed: ${response.error.message}`,
        response.error.code,
        response.error
      );
    }

    return response.result || {};
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  private async sendRequest(request: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2024-11-05'
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        // Try to parse error response
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          errorDetails = await response.text();
        }

        throw new MCPClientError(
          `HTTP ${response.status}: ${response.statusText}`,
          `HTTP_${response.status}`,
          errorDetails
        );
      }

      // Check content type to determine how to parse response
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        // Handle SSE response - read the stream and parse messages
        const text = await response.text();
        const lines = text.split('\n');
        
        // Parse SSE format to extract JSON-RPC response
        let jsonData = null;
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6); // Remove 'data: ' prefix
            if (dataStr.trim()) {
              try {
                jsonData = JSON.parse(dataStr);
                // If this is our JSON-RPC response, use it
                if (jsonData.jsonrpc === '2.0' && jsonData.id === request.id) {
                  return jsonData;
                }
              } catch {
                // Continue if this line isn't valid JSON
              }
            }
          }
        }
        
        // If we didn't find a valid response, throw error
        if (!jsonData) {
          throw new MCPClientError(
            'No valid JSON-RPC response found in SSE stream',
            'PARSE_ERROR',
            text
          );
        }
        
        return jsonData;
      } else {
        // Handle regular JSON response
        const data = await response.json();
        return data;
      }
    } catch (error) {
      if (error instanceof MCPClientError) {
        throw error;
      }
      
      throw new MCPClientError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        error
      );
    }
  }

  /**
   * Send a notification (no response expected)
   */
  private async sendNotification(notification: any): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2024-11-05'
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification)
    });

    // For notifications, we accept 200, 202, or 204 as success
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      console.warn(`[MCPClient] Notification returned status ${response.status}`);
    }
  }

  /**
   * Test connection to the MCP server
   */
  async testConnection(): Promise<{ success: boolean; tools?: MCPTool[]; error?: string }> {
    try {
      await this.initialize();
      const tools = await this.listTools();
      return { success: true, tools };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.sendNotification({
          jsonrpc: '2.0',
          method: 'notifications/shutdown',
          params: {}
        });
      } catch (error) {
        console.warn('[MCPClient] Shutdown notification failed:', error);
      }
      
      this.sessionId = undefined;
      this.requestId = 0;
    }
  }
}
