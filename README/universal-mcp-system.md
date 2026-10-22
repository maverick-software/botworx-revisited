# Universal MCP System

**Last Updated**: October 4, 2025  
**Status**: Production-Ready  
**Phase**: 1 of 4 Complete

---

## 📖 Overview

Agentopia's MCP (Model Context Protocol) system has been transformed from a Zapier-only integration into a **Universal MCP Platform** capable of connecting to ANY MCP-compliant server. This architectural enhancement enables seamless integration with multiple MCP server types while maintaining 100% backward compatibility with existing Zapier connections.

## 🎯 What is the Universal MCP System?

The Universal MCP System is a server-agnostic integration layer that:

1. **Auto-detects** server types when connecting
2. **Extracts** server capabilities and metadata automatically
3. **Routes** tool calls to the appropriate execution paths
4. **Monitors** connection health in real-time
5. **Supports** any MCP-compliant server implementation

### Supported MCP Server Types

| Server Type | Description | Use Cases | Status |
|------------|-------------|-----------|--------|
| **Zapier** | 8,000+ app integrations | Email, CRM, automation | ✅ Production |
| **Retell AI** | Voice agent platform | Phone calls, voice interactions | ✅ Ready |
| **Anthropic** | Claude-specific tools | Research, analysis, Claude features | ✅ Ready |
| **OpenAI** | OpenAI tool ecosystem | GPT tools, custom functions | ✅ Ready |
| **Custom** | User-deployed servers | Internal tools, proprietary systems | ✅ Ready |
| **Generic** | Standard MCP protocol | Any MCP-compliant implementation | ✅ Ready |

## 🏗️ Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        Agent Makes Request                        │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Universal Tool Executor                        │
│              (Routes to appropriate edge function)                │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                      mcp-execute Function                         │
│  1. Load connection from database                                │
│  2. Get server type metadata                                     │
│  3. Call MCP server with tool/parameters                         │
│  4. Record successful execution                                  │
│  5. Return result                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                       MCP Server (Any Type)                       │
│              Zapier │ Retell │ Anthropic │ Custom                │
└──────────────────────────────────────────────────────────────────┘
```

### Server Detection Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              User Connects to MCP Server                          │
│              (Provides URL via UI)                                │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                create-mcp-connection Function                     │
│  1. Call MCP server initialize method                            │
│  2. Receive initialization response                              │
│  3. Extract serverInfo and capabilities                          │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│              Server Detection Module                              │
│              (mcp-server-detection.ts)                            │
│  - Analyze server URL                                            │
│  - Check serverInfo metadata                                     │
│  - Examine capabilities structure                                │
│  - Return detected server type                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│              Store Connection in Database                         │
│  - connection_type: auto-detected type                           │
│  - server_capabilities: extracted capabilities                   │
│  - server_info: server metadata                                  │
│  - protocol_version: MCP version                                 │
└──────────────────────────────────────────────────────────────────┘
```

## 🔧 Key Components

### 1. Server Detection Module
**File**: `supabase/functions/_shared/mcp-server-detection.ts`

Intelligent detection system that identifies MCP server types:

```typescript
export function detectServerType(
  serverUrl: string, 
  initResponse: MCPServerInfo
): MCPServerType {
  // Checks URL patterns
  if (serverUrl.includes('mcp.zapier.com')) return 'zapier';
  
  // Checks serverInfo metadata
  if (initResponse.serverInfo?.provider === 'retell_ai') return 'retell_ai';
  
  // Checks capabilities
  if (initResponse.capabilities?.anthropic_tools) return 'anthropic';
  
  // Falls back to generic
  return 'generic';
}
```

**Features**:
- URL pattern matching
- ServerInfo analysis
- Capability inspection
- Metadata extraction
- Validation checks

### 2. Connection Creation
**File**: `supabase/functions/create-mcp-connection/index.ts`

Handles new MCP server connections:

1. Validates server URL
2. Calls MCP `initialize` method
3. Auto-detects server type
4. Extracts capabilities
5. Stores connection with metadata

**Auto-detected Metadata**:
- Server type (zapier, retell_ai, anthropic, etc.)
- Server name and version
- Protocol version
- Available capabilities
- Transport type

### 3. Tool Execution
**File**: `supabase/functions/mcp-execute/index.ts`

Universal tool execution with health monitoring:

1. Loads connection from database
2. Retrieves server type metadata
3. Executes tool on MCP server
4. Records successful execution
5. Updates `last_successful_call` timestamp

**Health Tracking**:
- Automatic timestamp updates
- Connection health status
- Tool execution statistics

### 4. Database Schema
**Migration**: `supabase/migrations/20251002000001_universal_mcp_support.sql`

New columns in `agent_mcp_connections`:

| Column | Type | Purpose |
|--------|------|---------|
| `server_capabilities` | JSONB | Discovered server capabilities |
| `server_info` | JSONB | Server name, version, metadata |
| `protocol_version` | TEXT | MCP protocol version |
| `last_successful_call` | TIMESTAMPTZ | Health monitoring timestamp |

**Health Monitoring Functions**:
- `check_mcp_server_health(connection_id)` - Check connection health
- `record_mcp_tool_success(connection_id)` - Update health timestamp
- `get_mcp_server_type_stats()` - Server type statistics
- `mark_mcp_schema_refresh_needed(connection_id)` - Flag for schema refresh

## 📊 Health Monitoring

### Real-Time Health Tracking

Every successful tool execution automatically updates:
- `last_successful_call` timestamp
- Connection health status
- Tool usage statistics

### Health Check SQL

```sql
-- Check specific connection health
SELECT * FROM check_mcp_server_health('connection-uuid-here');

-- View all server type statistics
SELECT * FROM get_mcp_server_type_stats();

-- Find unhealthy connections (no call in 7 days)
SELECT * FROM agent_mcp_connections 
WHERE last_successful_call < NOW() - INTERVAL '7 days'
OR last_successful_call IS NULL;

-- View server type breakdown
SELECT * FROM mcp_server_type_summary;
```

## 🚀 Usage Guide

### Connecting to an MCP Server

**UI Flow**:
1. Go to agent settings
2. Click "MCP" tab
3. Click "Connect MCP Server"
4. Enter server URL (works with ANY MCP server)
5. Click "Connect"

**What Happens**:
- System calls server's `initialize` method
- Server type is auto-detected
- Capabilities are extracted
- Tools are discovered automatically
- Connection is stored with metadata

### Supported Server URLs

```
# Zapier MCP
https://mcp.zapier.com/server/...

# Retell AI
https://api.retellai.com/mcp/...

# Anthropic (example)
https://mcp.anthropic.com/...

# OpenAI (example)
https://mcp.openai.com/...

# Custom server
https://your-server.com/mcp
```

### Using Tools from Connected Servers

Tools from connected MCP servers automatically appear in:
- Agent settings → MCP tab → Available Tools
- Agent conversation (if enabled in tool discovery)
- Function calling system

**Example**:
```typescript
// Agent automatically has access to tools like:
microsoft_outlook_find_emails
zapier_gmail_send_email
retell_make_phone_call
custom_internal_tool
```

## 🔒 Security

### Vault Integration
All MCP server URLs stored in Supabase Vault:
- Zero plain-text storage
- Encrypted at rest
- Access via RPC only

### Connection Validation
Every connection attempt:
- Validates server URL format
- Tests MCP protocol compliance
- Checks initialization response
- Verifies authentication if required

### Permission System
- Agent-specific MCP connections
- Tool-level access control
- User permission checking

## 📈 Monitoring & Analytics

### Connection Statistics

```sql
-- Total connections by type
SELECT 
  connection_type,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active THEN 1 END) as active
FROM agent_mcp_connections
GROUP BY connection_type;

-- Recently used connections
SELECT 
  connection_name,
  connection_type,
  last_successful_call,
  NOW() - last_successful_call as time_since_last_use
FROM agent_mcp_connections
WHERE last_successful_call IS NOT NULL
ORDER BY last_successful_call DESC
LIMIT 10;
```

### Server Type Metadata

View detected server information:

```sql
SELECT 
  connection_name,
  connection_type,
  server_info->>'name' as server_name,
  protocol_version,
  server_capabilities
FROM agent_mcp_connections;
```

## 🛠️ Adding New Server Types

The system automatically detects most MCP servers. To add explicit support:

### 1. Update Detection Logic

```typescript
// In mcp-server-detection.ts
export function detectServerType(serverUrl: string, initResponse: MCPServerInfo): MCPServerType {
  // Add your detection logic
  if (serverUrl.includes('newserver.com')) {
    return 'new_server_type';
  }
  // ... existing logic
}
```

### 2. Add Server Metadata

```typescript
// In mcp-server-detection.ts
const SERVER_TYPE_METADATA: Record<MCPServerType, MCPServerTypeMetadata> = {
  // ... existing types
  new_server_type: {
    name: 'New Server MCP',
    displayName: 'New Server',
    defaultTransport: 'http',
    requiresAuth: true,
    capabilities: ['tools', 'prompts']
  }
};
```

### 3. Done!

No other changes needed. The system will:
- Auto-detect new server type
- Store appropriate metadata
- Route tool calls correctly
- Track health automatically

## 🧪 Testing

### Verify Detection Works

```sql
-- After connecting to a new server
SELECT 
  connection_name,
  connection_type,
  server_info,
  server_capabilities
FROM agent_mcp_connections
WHERE id = 'your-new-connection-id';
```

### Test Tool Execution

Use any tool from the connected server. Then check:

```sql
SELECT 
  connection_name,
  last_successful_call
FROM agent_mcp_connections
WHERE id = 'your-connection-id';
```

`last_successful_call` should update after tool use.

## 📚 Additional Documentation

- **Investigation Report**: `docs/MCP_UNIVERSAL_SYSTEM_INVESTIGATION_REPORT.md`
- **Deployment Guide**: `docs/UNIVERSAL_MCP_PHASE1_DEPLOYMENT_GUIDE.md`
- **Completion Summary**: `docs/UNIVERSAL_MCP_PHASE1_COMPLETE.md`
- **Tool Infrastructure**: `README/tool-infrastructure.md`
- **Integrations Guide**: `README/integrations.md`

## 🎯 Future Enhancements (Phase 2-4)

### Phase 2: Enhanced UI
- Server type badges in connection cards
- Capability visualization
- Health indicator icons
- Connection status dashboard

### Phase 3: Advanced Features
- Tool filtering by server type
- Server-specific optimization
- Advanced retry strategies
- Performance analytics

### Phase 4: Community & Marketplace
- Server compatibility directory
- Integration guides per server
- Community server contributions
- Server ratings and reviews

## ✅ Verification Checklist

After connecting a new MCP server:

- [ ] Connection shows in agent settings → MCP tab
- [ ] Server type correctly detected
- [ ] `server_capabilities` populated
- [ ] `server_info` contains server name
- [ ] Tools appear in available tools list
- [ ] Tool execution works
- [ ] `last_successful_call` updates after use
- [ ] Health check returns valid status

## 🤝 Contributing

To contribute new server type support:

1. Test your MCP server for protocol compliance
2. Add detection logic if needed
3. Document server capabilities
4. Submit PR with detection updates
5. Include example connection URL

---

**The Universal MCP System makes Agentopia the most flexible AI agent platform for tool connectivity.** Connect to ANY MCP server and start using tools immediately!

