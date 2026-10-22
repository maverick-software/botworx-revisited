# MCP Server Deployment Enum Value Fix

## Problem Summary
When deploying MCP servers, users encountered a database enum constraint violation error:
```
Error: invalid input value for enum account_tool_installation_status_enum: "installed"
```

## Root Cause Analysis

### Database Enum Constraint
The `account_tool_installation_status_enum` has specific valid values, and `"installed"` is not one of them.

**Valid Enum Values:**
- `'pending_install'`
- `'installing'`
- `'active'` ✅ (Correct value to use)
- `'error_install'`
- `'pending_uninstall'`
- `'uninstalling'`
- `'uninstalled'`
- `'error_uninstall'`
- `'pending_config'`
- `'stopped'`
- `'starting'`
- `'stopping'`
- `'error_runtime'`
- `'disabled'`
- `'pending_deploy'`
- `'deploying'`
- `'running'`
- `'error'`
- `'pending_delete'`
- `'deleting'`

### Original Code Issues (❌ Invalid)
```typescript
status_on_toolbox: 'installed',  // ❌ Not a valid enum value
instance.status_on_toolbox === 'installed'  // ❌ Checking invalid value
```

## Solution Applied

### Fixed Code (✅ Valid)
```typescript
status_on_toolbox: 'active',  // ✅ Valid enum value
instance.status_on_toolbox === 'active'  // ✅ Checking valid value
```

### Changes Made

#### 1. deployServer() Method
**Before:**
```typescript
status_on_toolbox: 'installed',
```
**After:**
```typescript
status_on_toolbox: 'active',
```

#### 2. getServers() Method - is_active Field
**Before:**
```typescript
is_active: instance.status_on_toolbox === 'installed',
```
**After:**
```typescript
is_active: instance.status_on_toolbox === 'active',
```

#### 3. getServers() Method - Status Mapping
**Before:**
```typescript
state: instance.status_on_toolbox === 'installed' ? 'running' : 'stopped',
uptime: instance.status_on_toolbox === 'installed' ? Math.floor(...) : 0,
overall: instance.status_on_toolbox === 'installed' ? 'healthy' : 'unhealthy',
connectivity: instance.status_on_toolbox === 'installed',
```
**After:**
```typescript
state: instance.status_on_toolbox === 'active' ? 'running' : 'stopped',
uptime: instance.status_on_toolbox === 'active' ? Math.floor(...) : 0,
overall: instance.status_on_toolbox === 'active' ? 'healthy' : 'unhealthy',
connectivity: instance.status_on_toolbox === 'active',
```

#### 4. updateServer() Method
**Before:**
```typescript
status_on_toolbox: updates.status?.state === 'running' ? 'installed' : 'pending_install',
```
**After:**
```typescript
status_on_toolbox: updates.status?.state === 'running' ? 'active' : 'pending_install',
```

## Validation
- ✅ Database enum constraints satisfied
- ✅ MCP server deployment should now work
- ✅ Status checking logic preserved
- ✅ No breaking changes to existing functionality
- ✅ TypeScript compilation passes

## Semantic Alignment
The change from `'installed'` to `'active'` is semantically correct:
- **installed**: Implies the software is installed but may not be running
- **active**: Implies the service is installed AND currently active/running

This aligns better with the MCP server lifecycle where we want to indicate that the server is not just installed but actively available for use.

## Prevention Measures
1. **Enum Validation**: Add runtime validation for enum values before database operations
2. **Database Documentation**: Maintain clear documentation of all enum constraints
3. **Type Safety**: Consider using TypeScript enums that match database enums exactly 