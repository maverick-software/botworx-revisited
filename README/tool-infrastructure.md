# Tool Infrastructure - MCP Protocol & Function Calling

This document provides comprehensive information about Gofr Agents' tool infrastructure, including the Model Context Protocol (MCP) implementation, function calling system, and how to develop, register, and deploy new tools.

## 📋 Table of Contents

- [Overview](#overview)
- [MCP Architecture](#mcp-architecture)
- [Tool Development Lifecycle](#tool-development-lifecycle)
- [Universal Tool Executor](#universal-tool-executor)
- [Tool Discovery System](#tool-discovery-system)
- [Tool Settings & Toggles](#tool-settings--toggles)
- [Creating New MCP Tools](#creating-new-mcp-tools)
- [Tool Registration Process](#tool-registration-process)
- [Parameter Generation](#parameter-generation)
- [Edge Function Development](#edge-function-development)
- [Testing & Debugging](#testing--debugging)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Gofr Agents uses a sophisticated tool infrastructure based on the Model Context Protocol (MCP) to enable AI agents to interact with external services and internal systems. The system has been architected as a **Universal MCP Platform**, capable of connecting to ANY MCP-compliant server.

### Universal MCP Platform Features

- **Universal Server Support**: Connect to Zapier, Retell AI, Anthropic, OpenAI, custom, and generic MCP servers
- **Automatic Server Detection**: Server type, capabilities, and protocol version auto-detected on connection
- **Health Monitoring**: Real-time connection health tracking with last successful call timestamps
- **Zero Breaking Changes**: Existing Zapier connections continue to work seamlessly
- **Universal Tool Execution**: Single execution pathway for all tool types from any MCP server
- **Dynamic Tool Discovery**: Automatic tool registration and availability checking from any server
- **Permission-Based Access**: Role-based tool access control across all server types
- **Scalable Architecture**: Easy addition of new MCP servers without code changes
- **Intelligent Retry Logic**: LLM-friendly error responses with automatic parameter correction
- **Error Handling**: Comprehensive error reporting and retry mechanisms

### Key Components

1. **Universal Tool Executor**: Routes tool calls to appropriate edge functions
2. **Server Detection System**: Auto-detects MCP server type and capabilities
3. **Tool Discovery System**: Automatically discovers and registers available tools from any MCP server
4. **MCP Edge Functions**: Individual serverless functions for tool execution
5. **Parameter Generation**: Dynamic schema generation for tool parameters
6. **Permission System**: Agent-based tool access control
7. **Health Monitoring**: Real-time connection health tracking and statistics

## MCP Architecture

### System Flow

```
Agent Request → Universal Tool Executor → Tool Router → Edge Function → External Service
     ↓                    ↓                    ↓              ↓              ↓
Tool Discovery ← Parameter Schema ← Permission Check ← Tool Execution ← API Response
```

### Core Files

- **`supabase/functions/chat/function_calling/universal-tool-executor.ts`**: Main routing logic
- **`supabase/functions/_shared/mcp-server-detection.ts`**: Server type detection and capability extraction
- **`supabase/functions/create-mcp-connection/index.ts`**: MCP server connection with auto-detection
- **`supabase/functions/mcp-execute/index.ts`**: Universal MCP tool execution with health tracking
- **`supabase/functions/get-agent-tools/index.ts`**: Tool discovery and registration
- **`supabase/functions/get-agent-tools/tool-generator.ts`**: Parameter schema generation
- **`supabase/functions/[tool-name]-mcp/index.ts`**: Individual tool implementations

### Database Schema

- **`agent_mcp_connections`**: Stores MCP server connections with metadata
  - `connection_type`: Auto-detected server type (zapier, retell_ai, anthropic, openai, custom, generic)
  - `server_capabilities`: JSONB containing discovered capabilities
  - `server_info`: JSONB with server name, version, and metadata
  - `protocol_version`: MCP protocol version (e.g., '2024-11-05')
  - `last_successful_call`: Timestamp of last successful tool execution
- **`mcp_tools_cache`**: Cached tool definitions from MCP servers
- **Health Monitoring Functions**: `check_mcp_server_health`, `record_mcp_tool_success`, `get_mcp_server_type_stats`

## Tool Development Lifecycle

### 1. Planning Phase
- Define tool functionality and parameters
- Identify external APIs or internal services
- Plan permission requirements
- Design error handling

### 2. Development Phase
- Create MCP edge function
- Implement tool logic
- Add parameter validation
- Handle authentication

### 3. Registration Phase
- Add tool routing to Universal Tool Executor
- Register tool in discovery system
- Add parameter generation
- Configure permissions

### 4. Testing Phase
- Test tool execution
- Validate parameter schemas
- Test permission controls
- Verify error handling

### 5. Deployment Phase
- Deploy edge function
- Update routing functions
- Test in production environment
- Monitor tool usage

## Universal Tool Executor

The Universal Tool Executor (`universal-tool-executor.ts`) is the central routing system that directs tool calls to appropriate edge functions.

### Tool Routing Map

Tools are registered in the `TOOL_ROUTING_MAP` with this structure:

```typescript
const TOOL_ROUTING_MAP: Record<string, {
  edgeFunction: string;
  actionMapping: (toolName: string) => string;
  parameterMapping?: (params: Record<string, any>, context?: any) => Record<string, any>;
}> = {
  
  // Example: Contact Management tools
  'search_contacts': {
    edgeFunction: 'contact-mcp-tools',
    actionMapping: () => 'search_contacts',
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: 'search_contacts',
      agent_id: context.agentId,
      user_id: context.userId,
      params: params
    })
  },
  
  // Example: Gmail tools with prefix matching
  'gmail_': {
    edgeFunction: 'gmail-api',
    actionMapping: (toolName: string) => toolName.replace('gmail_', ''),
    parameterMapping: (params: Record<string, any>, context: any) => ({
      action: context.toolName.replace('gmail_', ''),
      agent_id: context.agentId,
      user_id: context.userId,
      ...params
    })
  },
  
  // Temporary Chat Links tools
  'create_temporary_chat_link': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'create_temporary_chat_link'
  },
  'list_temporary_chat_links': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'list_temporary_chat_links'
  },
  'update_temporary_chat_link': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'update_temporary_chat_link'
  },
  'delete_temporary_chat_link': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'delete_temporary_chat_link'
  },
  'get_temporary_chat_analytics': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'get_temporary_chat_analytics'
  },
  'manage_temporary_chat_session': {
    edgeFunction: 'temporary-chat-mcp',
    actionMapping: () => 'manage_temporary_chat_session'
  }
};
```

### Key Properties

- **`edgeFunction`**: Name of the Supabase edge function to call
- **`actionMapping`**: Maps tool name to action within the edge function
- **`parameterMapping`**: Transforms parameters for the edge function

### Adding New Tool Routes

To add a new tool to the routing system:

1. **Single Tool Route**:
```typescript
'your_tool_name': {
  edgeFunction: 'your-edge-function',
  actionMapping: () => 'your_action',
  parameterMapping: (params, context) => ({
    action: 'your_action',
    agent_id: context.agentId,
    user_id: context.userId,
    params: params
  })
}
```

2. **Prefix-Based Route** (for tool families):
```typescript
'your_prefix_': {
  edgeFunction: 'your-edge-function',
  actionMapping: (toolName: string) => toolName.replace('your_prefix_', ''),
  parameterMapping: (params, context) => ({
    action: context.toolName.replace('your_prefix_', ''),
    agent_id: context.agentId,
    user_id: context.userId,
    ...params
  })
}
```

## Tool Discovery System

The Tool Discovery System (`get-agent-tools/index.ts`) automatically discovers and registers tools based on:

1. **Integration Permissions**: Tools from connected services (Gmail, Outlook, etc.)
2. **Internal Tools**: Built-in tools like Media Library, Contact Management, and Temporary Chat Links
3. **Agent Permissions**: Role-based access control

### Integration-Based Discovery

Tools are discovered through the `agent_integration_permissions` table:

```typescript
// Get agent permissions for integrated services
const { data: emailPermissions } = await supabase
  .from('agent_integration_permissions')
  .select(`
    allowed_scopes,
    is_active,
    user_integration_credentials!inner(
      oauth_provider_id,
      service_providers!inner(name)
    )
  `)
  .eq('agent_id', agentId)
  .eq('user_integration_credentials.user_id', userId)
  .eq('is_active', true);
```

### Internal Tool Discovery

Internal tools are added directly in the discovery function:

```typescript
// Check for contact tools (always available if agent has contact permissions)
let hasContactPermissions = false;
try {
  const { data: contactPermissions } = await supabase
    .from('agent_contact_permissions')
    .select('id')
    .eq('agent_id', agent_id)
    .limit(1);
  
  hasContactPermissions = contactPermissions && contactPermissions.length > 0;
} catch (error) {
  console.warn(`Error checking for agent contact permissions:`, error);
}

if (hasContactPermissions) {
  const contactTools = ['search_contacts', 'get_contact_details'];
  
  for (const toolName of contactTools) {
    const parameters = generateParametersForCapability(toolName);
    
    tools.push({
      name: toolName,
      description: `${toolName} - Contact Management`,
      parameters,
      status: 'active',
      provider_name: 'Contact Management',
      connection_name: 'Internal'
    });
  }
}
```

## Tool Settings & Toggles

The platform includes a UI-based tool management system that allows users to enable/disable specific tool categories on a per-agent basis. This provides fine-grained control over which tools agents have access to.

### Available Tool Settings

The following tool categories can be toggled in the Agent Settings → Tools tab:

1. **Voice Synthesis** (`voice_enabled`)
   - Provider: ElevenLabs
   - Enables text-to-speech capabilities
   - Default: `false` (disabled)

2. **Web Search** (`web_search_enabled`)
   - Provider: Serper API
   - Enables web search, news, images, and local search
   - Default: `false` (disabled)

3. **Document Creation** (`document_creation_enabled`)
   - Provider: Document API
   - Enables document creation and editing
   - Default: `false` (disabled)

4. **Read Documents** (`ocr_processing_enabled`)
   - Provider: OCR API (OCR.space or Mistral AI)
   - Enables PDF and image text extraction
   - Default: `false` (disabled)

5. **Temporary Chat Links** (`temporary_chat_links_enabled`)
   - Provider: Internal (Built-in)
   - Enables anonymous public chat link creation
   - Default: `false` (disabled)

### Tool Settings Storage

Tool settings are stored in the agent's metadata:

```json
{
  "metadata": {
    "settings": {
      "voice_enabled": false,
      "web_search_enabled": false,
      "document_creation_enabled": false,
      "ocr_processing_enabled": false,
      "temporary_chat_links_enabled": false
    }
  }
}
```

### How Tool Filtering Works

The `get-agent-tools` edge function enforces these settings by:

1. **Fetching Tool Settings**: Retrieves all toggle states from `metadata.settings`
2. **Provider Mapping**: Maps service providers to their required settings:
   ```typescript
   const providerToSettingMap: Record<string, string> = {
     'serper_api': 'web_search_enabled',
     'elevenlabs': 'voice_enabled',
   };
   ```
3. **Filtering Providers**: Skips providers if their required setting is `false`
4. **Default Behavior**: All settings default to `false` if not explicitly set

### Always-Available Tools

The following tool categories are **always available** (no toggle required):

1. **Contact Management** - Enabled if agent has contact permissions
2. **Email Integration** (Gmail, Outlook, SMTP, etc.) - Based on connected credentials
3. **SMS Integration** (ClickSend, Twilio, etc.) - Based on connected credentials
4. **Media Library** (Document Search) - Enabled if agent has assigned documents
5. **Zapier MCP** - Available if Zapier MCP server is connected

These tools are controlled by their respective permission systems rather than global toggles.

### Best Practices for Tool Toggles

1. **Default to Off**: New tool categories should default to `false` for security
2. **Explicit Opt-In**: Users must explicitly enable tools they want to use
3. **Clear UI Feedback**: Show toggle state clearly in the UI
4. **Provider-Level Filtering**: Filter at the provider level, not individual tools
5. **Consistent Naming**: Use `[category]_enabled` pattern for all settings

### Adding New Internal Tools

To add new internal tools to discovery:

1. **Add Permission Check**:
```typescript
// Check for your tool permissions
let hasYourToolPermissions = false;
try {
  const { data: permissions } = await supabase
    .from('your_permissions_table')
    .select('id')
    .eq('agent_id', agent_id)
    .limit(1);
  
  hasYourToolPermissions = permissions && permissions.length > 0;
} catch (error) {
  console.warn(`Error checking permissions:`, error);
}
```

2. **Add Tool Registration**:
```typescript
if (hasYourToolPermissions) {
  const yourTools = ['your_tool_1', 'your_tool_2'];
  
  for (const toolName of yourTools) {
    const parameters = generateParametersForCapability(toolName);
    
    tools.push({
      name: toolName,
      description: `${toolName} - Your Service`,
      parameters,
      status: 'active',
      provider_name: 'Your Service',
      connection_name: 'Internal'
    });
  }
}
```

## Creating New MCP Tools

### 1. Edge Function Structure

Create a new edge function in `supabase/functions/your-tool-mcp/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types for MCP tool responses
interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    tool_name: string;
    agent_id?: string;
    user_id?: string;
  };
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { action, agent_id, user_id, params } = await req.json();
    const startTime = Date.now();

    // Validate required parameters
    if (!agent_id || !user_id) {
      return Response.json({
        success: false,
        error: 'Missing required parameters: agent_id and user_id'
      }, { status: 400 });
    }

    let result: MCPToolResponse;

    switch (action) {
      case 'your_action_1':
        result = await handleYourAction1(supabase, { agent_id, user_id, ...params });
        break;
      
      case 'your_action_2':
        result = await handleYourAction2(supabase, { agent_id, user_id, ...params });
        break;
      
      case 'list_tools':
        result = await handleListTools();
        break;
      
      default:
        result = {
          success: false,
          error: `Unknown action: ${action}`,
          metadata: {
            execution_time_ms: Date.now() - startTime,
            tool_name: action,
            agent_id,
            user_id
          }
        };
    }

    return Response.json(result);

  } catch (error) {
    console.error('MCP Tool Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
      metadata: {
        execution_time_ms: Date.now() - Date.now(),
        tool_name: 'unknown'
      }
    }, { status: 500 });
  }
});

// Tool implementation functions
async function handleYourAction1(supabase: any, params: any): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    // Validate permissions
    const hasPermission = await validatePermissions(supabase, params.agent_id, params.user_id);
    if (!hasPermission) {
      return {
        success: false,
        error: 'Agent does not have permission to access this tool',
        metadata: {
          execution_time_ms: Date.now() - startTime,
          tool_name: 'your_action_1',
          agent_id: params.agent_id,
          user_id: params.user_id
        }
      };
    }

    // Implement your tool logic here
    const data = await performYourAction(params);

    return {
      success: true,
      data: data,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        tool_name: 'your_action_1',
        agent_id: params.agent_id,
        user_id: params.user_id
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to execute tool',
      metadata: {
        execution_time_ms: Date.now() - startTime,
        tool_name: 'your_action_1',
        agent_id: params.agent_id,
        user_id: params.user_id
      }
    };
  }
}

async function validatePermissions(supabase: any, agentId: string, userId: string): Promise<boolean> {
  try {
    // Implement your permission validation logic
    const { data, error } = await supabase
      .from('your_permissions_table')
      .select('id')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .limit(1);

    return !error && data && data.length > 0;
  } catch (error) {
    console.error('Permission validation error:', error);
    return false;
  }
}

async function handleListTools(): Promise<MCPToolResponse> {
  return {
    success: true,
    data: [
      {
        name: 'your_action_1',
        description: 'Description of your first action',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First parameter' },
            param2: { type: 'number', description: 'Second parameter' }
          },
          required: ['param1']
        }
      },
      {
        name: 'your_action_2',
        description: 'Description of your second action',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        }
      }
    ],
    metadata: {
      execution_time_ms: 0,
      tool_name: 'list_tools'
    }
  };
}
```

### 2. Parameter Validation

Always validate parameters in your tool functions:

```typescript
function validateParams(params: any, required: string[]): string | null {
  for (const field of required) {
    if (!params[field]) {
      return `Missing required parameter: ${field}`;
    }
  }
  return null;
}

// Usage in tool function
const validationError = validateParams(params, ['required_param1', 'required_param2']);
if (validationError) {
  return {
    success: false,
    error: validationError,
    metadata: { /* ... */ }
  };
}
```

## Parameter Generation

The parameter generation system (`tool-generator.ts`) creates JSON schemas for tool parameters.

### Adding Parameter Schemas

Add parameter generation for your tools:

```typescript
// Handle Your Tool parameters
if (toolName === 'your_action_1') {
  return {
    ...baseSchema,
    properties: {
      param1: { type: 'string', description: 'First parameter description' },
      param2: { 
        type: 'number', 
        description: 'Second parameter description',
        minimum: 1,
        maximum: 100,
        default: 10
      },
      param3: {
        type: 'string',
        enum: ['option1', 'option2', 'option3'],
        description: 'Third parameter with options'
      }
    },
    required: ['param1']
  };
}

if (toolName === 'your_action_2') {
  return {
    ...baseSchema,
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Maximum results', default: 20 }
    },
    required: ['query']
  };
}
```

### Schema Best Practices

1. **Descriptive Properties**: Always include clear descriptions
2. **Validation Rules**: Use `minimum`, `maximum`, `enum` for validation
3. **Default Values**: Provide sensible defaults where appropriate
4. **Required Fields**: Only mark truly essential parameters as required
5. **Type Safety**: Use appropriate JSON Schema types

## Edge Function Development

### Deployment Commands

```bash
# Deploy a single function
supabase functions deploy your-tool-mcp

# Deploy all functions
supabase functions deploy

# Deploy with environment variables
supabase functions deploy your-tool-mcp --no-verify-jwt
```

### Environment Variables

Access Supabase credentials in your edge function:

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl!, supabaseKey!);
```

### Error Handling

Implement comprehensive error handling:

```typescript
try {
  // Tool logic
} catch (error) {
  console.error(`[YourTool] Error:`, error);
  
  return {
    success: false,
    error: error.message || 'Unknown error occurred',
    metadata: {
      execution_time_ms: Date.now() - startTime,
      tool_name: toolName,
      agent_id: agentId,
      user_id: userId
    }
  };
}
```

## Testing & Debugging

### Local Testing

Test edge functions locally:

```bash
# Start local development
supabase start

# Deploy functions locally
supabase functions serve your-tool-mcp

# Test with curl
curl -X POST http://localhost:54321/functions/v1/your-tool-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "action": "your_action_1",
    "agent_id": "test-agent-id",
    "user_id": "test-user-id",
    "params": {
      "param1": "test-value"
    }
  }'
```

### Production Testing

Test in production environment:

```bash
# Test via Supabase CLI
supabase functions invoke your-tool-mcp \
  --data '{
    "action": "your_action_1",
    "agent_id": "real-agent-id",
    "user_id": "real-user-id",
    "params": {
      "param1": "test-value"
    }
  }'
```

### Debugging Tips

1. **Logging**: Use `console.log` and `console.error` for debugging
2. **Error Messages**: Provide clear, actionable error messages
3. **Metadata**: Include execution time and context in responses
4. **Validation**: Validate all inputs and provide specific error messages

## Best Practices

### Security

1. **Permission Validation**: Always validate agent permissions
2. **Input Sanitization**: Sanitize all user inputs
3. **RLS Policies**: Use Row Level Security for database access
4. **Service Role**: Use service role key for database operations

### Performance

1. **Connection Pooling**: Reuse Supabase client instances
2. **Async Operations**: Use async/await for all database operations
3. **Error Handling**: Implement proper error handling and timeouts
4. **Caching**: Cache frequently accessed data when appropriate

### Maintainability

1. **Modular Code**: Separate concerns into different functions
2. **Type Safety**: Use TypeScript interfaces for parameters
3. **Documentation**: Document all functions and parameters
4. **Testing**: Write comprehensive tests for all tool functions

### Tool Design

1. **Single Responsibility**: Each tool should have a clear, single purpose
2. **Consistent Interface**: Use consistent parameter patterns
3. **Error Messages**: Provide helpful error messages for users
4. **Backwards Compatibility**: Maintain compatibility when updating tools

## Troubleshooting

### Common Issues

#### Tool Not Found
**Error**: `Tool your_tool_name not found or not available for this agent`

**Solutions**:
1. Check tool registration in `get-agent-tools/index.ts`
2. Verify permission check logic
3. Ensure tool is added to parameter generation
4. Check agent has required permissions

#### Routing Error
**Error**: `No handler configured for tool: your_tool_name`

**Solutions**:
1. Add tool to `TOOL_ROUTING_MAP` in `universal-tool-executor.ts`
2. Verify edge function name matches routing configuration
3. Check parameter mapping function
4. Deploy updated chat function

#### Permission Denied
**Error**: `Agent does not have permission to access this tool`

**Solutions**:
1. Grant agent permissions via Agent Settings
2. Check permission validation logic in edge function
3. Verify RLS policies allow access
4. Check user ownership of resources

#### Edge Function Error
**Error**: `Internal server error` or function timeout

**Solutions**:
1. Check edge function logs in Supabase Dashboard
2. Verify environment variables are set
3. Test function locally with `supabase functions serve`
4. Check database connection and queries
5. Verify JSON parsing and response format

### Debugging Steps

1. **Check Tool Discovery**:
   ```bash
   # Test tool discovery
   supabase functions invoke get-agent-tools \
     --data '{"agent_id": "your-agent-id", "user_id": "your-user-id"}'
   ```

2. **Test Edge Function Directly**:
   ```bash
   # Test your edge function
   supabase functions invoke your-tool-mcp \
     --data '{"action": "list_tools"}'
   ```

3. **Check Permissions**:
   ```sql
   -- Check agent permissions
   SELECT * FROM agent_contact_permissions 
   WHERE agent_id = 'your-agent-id';
   ```

4. **Review Logs**:
   - Check Supabase Dashboard function logs
   - Look for console.log output
   - Check for database errors

### Performance Monitoring

Monitor tool performance through:

1. **Execution Time**: Track `execution_time_ms` in responses
2. **Error Rates**: Monitor failed vs successful executions
3. **Usage Patterns**: Track which tools are used most frequently
4. **Database Performance**: Monitor query execution times

---

## Complete Tool Development Example

Here's a complete example of adding a new "Weather" tool:

### 1. Create Edge Function
`supabase/functions/weather-mcp/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { action, agent_id, user_id, params } = await req.json();
    const startTime = Date.now();

    switch (action) {
      case 'get_weather':
        // Weather API call logic here
        const weatherData = await fetchWeather(params.location);
        return Response.json({
          success: true,
          data: weatherData,
          metadata: {
            execution_time_ms: Date.now() - startTime,
            tool_name: 'get_weather',
            agent_id,
            user_id
          }
        });
      
      default:
        return Response.json({
          success: false,
          error: `Unknown action: ${action}`
        });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

async function fetchWeather(location: string) {
  // Implementation here
  return { temperature: 72, condition: 'sunny' };
}
```

### 2. Add Tool Routing
In `universal-tool-executor.ts`:

```typescript
'get_weather': {
  edgeFunction: 'weather-mcp',
  actionMapping: () => 'get_weather',
  parameterMapping: (params, context) => ({
    action: 'get_weather',
    agent_id: context.agentId,
    user_id: context.userId,
    params: params
  })
}
```

### 3. Add Tool Discovery
In `get-agent-tools/index.ts`:

```typescript
// Weather tools (always available)
const weatherTools = ['get_weather'];

for (const toolName of weatherTools) {
  const parameters = generateParametersForCapability(toolName);
  
  tools.push({
    name: toolName,
    description: `${toolName} - Weather Service`,
    parameters,
    status: 'active',
    provider_name: 'Weather Service',
    connection_name: 'Internal'
  });
}
```

### 4. Add Parameter Generation
In `tool-generator.ts`:

```typescript
if (toolName === 'get_weather') {
  return {
    ...baseSchema,
    properties: {
      location: { type: 'string', description: 'City name or coordinates' }
    },
    required: ['location']
  };
}
```

### 5. Deploy
```bash
supabase functions deploy weather-mcp
supabase functions deploy get-agent-tools
supabase functions deploy chat
```

This example demonstrates the complete process of adding a new MCP tool to Gofr Agents' infrastructure.

---

**Last Updated**: September 16, 2025  
**Version**: 1.0  
**Related Documentation**: [Integrations](integrations.md), [Backend Services](backend-services.md), [Security Updates](security-updates.md)

