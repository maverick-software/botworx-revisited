# Systematic Fix Plan for mcpService.ts Linter Errors

## Phase 4: System-Wide Fix Strategy

### Fix Order (Based on Dependency Chain)

#### Fix 1: MCPDeploymentConfig Property Access Errors
**Lines**: 149-152, 168-172, 188, 191
**Problem**: Accessing non-existent properties on MCPDeploymentConfig
**Solution**: Map MCPDeploymentConfig properties correctly

**Current Wrong Usage**:
```typescript
config.server_type      // ❌ doesn't exist
config.endpoint_url     // ❌ doesn't exist  
config.transport_type   // ❌ doesn't exist
config.capabilities     // ❌ doesn't exist
config.serverType       // ❌ doesn't exist
config.endpoint         // ❌ doesn't exist
updates.endpoint        // ❌ should be endpoint_url
```

**Correct MCPDeploymentConfig Properties**:
```typescript
config.templateId       // ✅ exists
config.name            // ✅ exists
config.configuration   // ✅ exists (Record<string, any>)
config.networking      // ✅ exists
```

#### Fix 2: MCPDeploymentStatus Property Issues
**Lines**: 164, 534
**Problem**: Invalid properties and enum values
**Solution**: 
- Remove `deploymentId` (not in interface)
- Change "completed" to "running" (valid enum value)

#### Fix 3: MCPServer Field Mapping Issues  
**Lines**: 45, 537, 191
**Problem**: Field access on Partial<MCPServer>
**Solution**: Use correct field names from MCPServerConfig

### Implementation Strategy

#### Step 1: Fix MCPDeploymentConfig Usage
Replace invalid property access with valid configuration mapping:
- Use `config.templateId` to determine server type
- Use `config.configuration` for server-specific settings
- Use `config.networking` for endpoint configuration

#### Step 2: Fix MCPDeploymentStatus Construction
- Remove invalid `deploymentId` property
- Use valid enum values for status
- Ensure proper return object structure

#### Step 3: Fix MCPServer Property Access
- Use `endpoint_url` instead of `endpoint`
- Ensure all field names match MCPServerConfig interface

### Database to Interface Mapping Strategy
Create proper mapping between database fields and interface properties:

```typescript
// Database -> MCPServerConfig mapping
{
  id: parseInt(instance.id),                    // number
  config_id: 0,                                // number (placeholder)
  name: instance.instance_name_on_toolbox,     // string
  endpoint_url: instance.mcp_endpoint_path,    // string
  vault_api_key_id: null,                      // string | null
  timeout_ms: 30000,                           // number
  max_retries: 3,                              // number  
  retry_backoff_ms: 1000,                      // number
  priority: 1,                                 // number
  is_active: instance.status_on_toolbox === 'installed', // boolean
  capabilities: instance.mcp_server_capabilities // MCPServerCapabilities | null
}
``` 