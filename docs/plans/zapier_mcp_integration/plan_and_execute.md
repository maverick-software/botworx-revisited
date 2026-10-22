# Plan and Execute: Zapier MCP Server Integration

**Date:** August 23, 2025  
**Plan ID:** zapier_mcp_integration_20250823  
**Priority:** HIGH – Agent Tool Expansion & Automation Capabilities

## 🎯 Executive Summary

**Objective:** Integrate Zapier MCP server capability for every agent, allowing them to connect to their own unique Zapier MCP server URL and access all available Zapier tools through our existing tool system. This will enable agents to perform complex automation workflows using Zapier's extensive integration ecosystem.

**Key Outcomes:**
- Per-agent Zapier MCP server connections via unique URLs
- Dynamic tool discovery and registration from Zapier MCP servers
- Integration with existing tool permission and execution system
- UI integration through the Tools menu on agent chat page
- Full compliance with MCP protocol specifications

## 🔎 Current State Analysis

**Existing Tool System:**
- Function calling via OpenAI with tool schemas
- Permission-based tool discovery through `FunctionCallingManager`
- Tool execution through provider-specific handlers (Gmail, Web Search)
- UI integration through `EnhancedToolsModal` with tabs for different tool types
- Real-time tool execution feedback and logging

**Current Tool Flow:**
1. `getAvailableTools()` discovers tools based on agent permissions
2. Tools passed to OpenAI as function definitions
3. Tool calls executed through provider-specific handlers
4. Results returned to chat interface with real-time feedback

## ⚠️ Gap Analysis

**Missing Components:**
- MCP client implementation for JSON-RPC 2.0 communication
- Zapier MCP server connection management (per-agent URLs)
- Dynamic tool discovery from external MCP servers
- MCP tool schema conversion to OpenAI function format
- UI for managing Zapier MCP connections
- Database schema for storing MCP connection configurations

## 📐 Target Architecture

### Database Schema
```sql
-- Agent MCP server connections
agent_mcp_connections: {
  id: uuid,
  agent_id: uuid,
  connection_name: text,
  server_url: text,           -- Unique Zapier MCP server URL
  connection_type: 'zapier',  -- Extensible for other MCP providers
  is_active: boolean,
  auth_config: jsonb,         -- Optional auth configuration
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Cached MCP tools from servers
mcp_tools_cache: {
  id: uuid,
  connection_id: uuid,
  tool_name: text,
  tool_schema: jsonb,         -- Full MCP tool definition
  openai_schema: jsonb,       -- Converted OpenAI function schema
  last_updated: timestamptz
}
```

### Core Components

**1. MCP Client (`src/lib/mcp/mcp-client.ts`)**
- JSON-RPC 2.0 client implementation
- HTTP transport support (Streamable HTTP)
- Tool discovery (`tools/list`) and execution (`tools/call`)
- Error handling and timeout management

**2. Zapier MCP Manager (`src/lib/mcp/zapier-mcp-manager.ts`)**
- Agent MCP connection management
- Tool discovery and caching
- Schema conversion (MCP → OpenAI function format)
- Connection health monitoring

**3. MCP Tool Provider (`supabase/functions/chat/providers/mcp-provider.ts`)**
- Integration with existing `FunctionCallingManager`
- Tool execution through MCP client
- Result formatting and error handling

**4. Zapier Connection Modal (`src/components/modals/ZapierMCPModal.tsx`)**
- UI for managing Zapier MCP connections
- Connection testing and validation
- Tool discovery preview

## 📋 Implementation Plan

### Phase 1: Core MCP Infrastructure (Week 1)

#### 1.1 Database Schema Setup
- [ ] Create migration for `agent_mcp_connections` table
- [ ] Create migration for `mcp_tools_cache` table
- [ ] Add RLS policies for agent-scoped access
- [ ] Create database functions for connection management

#### 1.2 MCP Client Implementation
- [ ] Implement JSON-RPC 2.0 client with HTTP transport
- [ ] Add support for `tools/list` and `tools/call` methods
- [ ] Implement proper error handling and timeouts
- [ ] Add connection validation and health checks

#### 1.3 Schema Conversion System
- [ ] Build MCP tool schema to OpenAI function converter
- [ ] Handle input/output schema transformations
- [ ] Implement tool result format conversion
- [ ] Add validation for schema compatibility

### Phase 2: Integration with Existing Tool System (Week 1)

#### 2.1 Zapier MCP Manager
- [ ] Implement connection management (CRUD operations)
- [ ] Build tool discovery and caching system
- [ ] Add automatic tool refresh mechanisms
- [ ] Implement connection health monitoring

#### 2.2 Function Calling Integration
- [ ] Extend `FunctionCallingManager` to support MCP tools
- [ ] Add MCP tool provider to execution pipeline
- [ ] Implement tool execution through MCP client
- [ ] Add proper error handling and logging

#### 2.3 Tool Execution Handler
- [ ] Create MCP tool execution handler
- [ ] Implement result processing and formatting
- [ ] Add execution logging and metrics
- [ ] Handle MCP-specific error scenarios

### Phase 3: UI Integration (Week 1)

#### 3.1 Zapier Connection Modal
- [ ] Create `ZapierMCPModal` component
- [ ] Implement connection form with URL validation
- [ ] Add connection testing functionality
- [ ] Show discovered tools preview

#### 3.2 Enhanced Tools Modal Integration
- [ ] Add Zapier tab to `EnhancedToolsModal`
- [ ] Display connected Zapier MCP servers
- [ ] Show available tools from each connection
- [ ] Add connection management actions

#### 3.3 Tools Menu Integration
- [ ] Link Zapier connection modal to Tools menu
- [ ] Add Zapier connection status indicators
- [ ] Implement tool availability badges

### Phase 4: Testing & Validation (Week 1)

#### 4.1 MCP Protocol Compliance
- [ ] Validate JSON-RPC 2.0 implementation
- [ ] Test tool discovery and execution flows
- [ ] Verify error handling scenarios
- [ ] Test connection management lifecycle

#### 4.2 Integration Testing
- [ ] Test with real Zapier MCP server URLs
- [ ] Validate tool execution end-to-end
- [ ] Test permission and security controls
- [ ] Verify UI responsiveness and error states

#### 4.3 Performance & Security
- [ ] Implement connection pooling and caching
- [ ] Add rate limiting for MCP calls
- [ ] Validate input sanitization
- [ ] Test concurrent connection handling

## 🔧 Technical Implementation Details

### MCP Client Architecture
```typescript
interface MCPClient {
  connect(serverUrl: string): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, arguments: any): Promise<MCPToolResult>;
  disconnect(): Promise<void>;
}

interface MCPTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}
```

### Schema Conversion
```typescript
function convertMCPToolToOpenAI(mcpTool: MCPTool): OpenAIFunction {
  return {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: mcpTool.inputSchema,
  };
}

function convertOpenAICallToMCP(functionCall: OpenAIFunctionCall): MCPToolCall {
  return {
    name: functionCall.function.name,
    arguments: JSON.parse(functionCall.function.arguments),
  };
}
```

### Integration Points
1. **Tool Discovery**: `FunctionCallingManager.getAvailableTools()` includes MCP tools
2. **Tool Execution**: Route MCP tool calls to `MCPToolProvider`
3. **Result Processing**: Convert MCP results to standard tool result format
4. **UI Integration**: Zapier tab in Tools modal shows MCP connections

## 🔒 Security Considerations

1. **URL Validation**: Validate Zapier MCP server URLs for security
2. **Connection Limits**: Limit number of MCP connections per agent
3. **Rate Limiting**: Implement rate limiting for MCP tool calls
4. **Input Sanitization**: Sanitize all tool inputs and outputs
5. **Error Handling**: Prevent information leakage through error messages
6. **Connection Timeouts**: Implement proper timeouts for MCP calls

## 📊 Success Metrics

1. **Functional**: Agents can connect to Zapier MCP servers and execute tools
2. **Performance**: Tool discovery and execution within acceptable latency
3. **Reliability**: Robust error handling and connection management
4. **Usability**: Intuitive UI for managing MCP connections
5. **Compliance**: Full adherence to MCP protocol specifications

## 🚀 Rollout Strategy

1. **Development**: Implement in feature branch with comprehensive testing
2. **Internal Testing**: Test with sample Zapier MCP server instances
3. **Beta Release**: Limited rollout to select agents/users
4. **Production**: Full deployment with monitoring and support
5. **Documentation**: Update user guides and developer documentation

## 📚 Dependencies

- MCP Protocol Specification (2025-06-18)
- Existing tool system architecture
- Zapier MCP server instances
- Database migration capabilities
- UI component library (Shadcn)

This plan provides a comprehensive roadmap for integrating Zapier MCP server capabilities into Agentopia while maintaining compatibility with the existing tool system and following MCP protocol specifications.
