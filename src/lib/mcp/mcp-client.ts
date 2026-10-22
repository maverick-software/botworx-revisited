/**
 * MCP (Model Context Protocol) Client Implementation
 * 
 * Implements JSON-RPC 2.0 client for communicating with MCP servers
 * Supports Streamable HTTP transport as specified in MCP protocol
 */

export interface MCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  annotations?: Record<string, any>;
}

export interface MCPContent {
  type: 'text' | 'image' | 'audio' | 'resource_link' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  name?: string;
  description?: string;
  annotations?: Record<string, any>;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
  structuredContent?: any;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export class MCPClientError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPClientError';
  }
}

export class MCPClient {
  private serverUrl: string;
  private sessionId?: string;
  private requestId = 1;
  private timeout: number;
  private protocolVersion = '2025-06-18';

  constructor(serverUrl: string, options: { timeout?: number } = {}) {
    this.serverUrl = serverUrl;
    this.timeout = options.timeout || 30000; // 30 second default timeout
  }

  /**
   * Initialize connection with MCP server
   */
  async initialize(): Promise<void> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: this.protocolVersion,
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        clientInfo: {
          name: 'Gofr Agents',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPClientError(
        `Initialization failed: ${response.error.message}`,
        response.error.code,
        response.error.data
      );
    }

    // Extract session ID if provided from response headers
    // This is handled in sendRequest method
    
    // Send initialized notification - this is optional per MCP spec
    try {
      await this.sendNotification({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });
    } catch (error) {
      // Some servers may not require or support the initialized notification
      // This is not a fatal error, so we continue
      console.warn('[MCPClient] Initialized notification failed (this is often normal):', error.message);
    }
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(cursor?: string): Promise<{ tools: MCPTool[]; nextCursor?: string }> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
      params: cursor ? { cursor } : undefined
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPClientError(
        `Failed to list tools: ${response.error.message}`,
        response.error.code,
        response.error.data
      );
    }

    return {
      tools: response.result?.tools || [],
      nextCursor: response.result?.nextCursor
    };
  }

  /**
   * Call a specific tool on the MCP server
   */
  async callTool(name: string, arguments_: Record<string, any>): Promise<MCPToolResult> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name,
        arguments: arguments_
      }
    };

    const response = await this.sendRequest(request);
    
    if (response.error) {
      throw new MCPClientError(
        `Tool call failed: ${response.error.message}`,
        response.error.code,
        response.error.data
      );
    }

    return {
      content: response.result?.content || [],
      isError: response.result?.isError || false,
      structuredContent: response.result?.structuredContent
    };
  }

  /**
   * Test connection to MCP server
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple initialization without the notification first
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.getNextRequestId(),
        method: 'initialize',
        params: {
          protocolVersion: this.protocolVersion,
          capabilities: {
            tools: {
              listChanged: false
            }
          },
          clientInfo: {
            name: 'Gofr Agents',
            version: '1.0.0'
          }
        }
      };

      const response = await this.sendRequest(request);
      
      if (response.error) {
        throw new MCPClientError(
          `Initialization failed: ${response.error.message}`,
          response.error.code,
          response.error.data
        );
      }

      // Try to list tools to verify the connection works
      await this.listTools();
      return true;
    } catch (error) {
      console.error('MCP connection test failed:', error);
      return false;
    }
  }

  /**
   * Send JSON-RPC request to MCP server
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': this.protocolVersion
      };

      // Add session ID if available
      if (this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId;
      }

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Extract session ID from response headers if present
      const sessionId = response.headers.get('Mcp-Session-Id');
      if (sessionId) {
        this.sessionId = sessionId;
      }

      if (!response.ok) {
        throw new MCPClientError(
          `HTTP error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        // Single JSON response
        const jsonResponse = await response.json();
        return jsonResponse as MCPResponse;
      } else if (contentType.includes('text/event-stream')) {
        // SSE stream - for now, we'll read the first event
        // In a full implementation, this would handle streaming responses
        const text = await response.text();
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim()) {
              try {
                return JSON.parse(data) as MCPResponse;
              } catch (e) {
                // Continue to next line if JSON parse fails
              }
            }
          }
        }
        
        throw new MCPClientError('No valid JSON response found in SSE stream');
      } else {
        throw new MCPClientError(`Unsupported content type: ${contentType}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof MCPClientError) {
        throw error;
      }
      
      if (error.name === 'AbortError') {
        throw new MCPClientError('Request timeout');
      }
      
      throw new MCPClientError(
        `Network error: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Send JSON-RPC notification to MCP server
   */
  private async sendNotification(notification: MCPNotification): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': this.protocolVersion
      };

      if (this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId;
      }

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(notification),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Accept both 202 (Accepted) and 200 (OK) for notifications
      // Some servers may return 200 instead of 202
      if (response.status !== 202 && response.status !== 200) {
        throw new MCPClientError(
          `Notification failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof MCPClientError) {
        throw error;
      }
      
      if (error.name === 'AbortError') {
        throw new MCPClientError('Notification timeout');
      }
      
      throw new MCPClientError(
        `Notification error: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get next request ID
   */
  private getNextRequestId(): number {
    return this.requestId++;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        const response = await fetch(this.serverUrl, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': this.sessionId,
            'MCP-Protocol-Version': this.protocolVersion
          }
        });
        
        // Server may respond with 405 if it doesn't support explicit termination
        if (response.status !== 200 && response.status !== 405) {
          console.warn(`Session termination returned status: ${response.status}`);
        }
      } catch (error) {
        console.warn('Failed to terminate session:', error);
      }
      
      this.sessionId = undefined;
    }
  }
}

/**
 * Convert MCP tool schema to OpenAI function schema
 */
export function convertMCPToolToOpenAI(mcpTool: MCPTool): {
  name: string;
  description: string;
  parameters: any;
} {
  return {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: mcpTool.inputSchema
  };
}

/**
 * Convert OpenAI function call to MCP tool call format
 */
export function convertOpenAICallToMCP(functionCall: {
  name: string;
  arguments: string;
}): {
  name: string;
  arguments: Record<string, any>;
} {
  return {
    name: functionCall.name,
    arguments: JSON.parse(functionCall.arguments)
  };
}

/**
 * Convert MCP tool result to standard tool result format
 */
export function convertMCPResultToStandard(mcpResult: MCPToolResult): {
  success: boolean;
  result?: any;
  error?: string;
  content?: string;
} {
  if (mcpResult.isError) {
    const errorContent = mcpResult.content.find(c => c.type === 'text')?.text || 'Tool execution failed';
    return {
      success: false,
      error: errorContent
    };
  }

  // Extract text content for display
  const textContent = mcpResult.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');

  return {
    success: true,
    result: mcpResult.structuredContent || mcpResult.content,
    content: textContent
  };
}
