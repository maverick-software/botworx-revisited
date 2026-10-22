# Tool Execution Visibility

## Overview

This document describes the comprehensive tool execution visibility system implemented in Agentopia to provide users with complete transparency into agent tool usage.

## Problem Statement

Previously, when agents attempted to use tools (like sending emails via Gmail), users had:
- No visibility into what was happening during execution
- Generic error messages that didn't explain the actual problem
- No way to review past tool executions
- No console logs or debugging information

## Solution Components

### 1. Enhanced Error Messages

**Location**: `supabase/functions/chat/function_calling.ts`

The error formatting now provides:
- Detailed error descriptions
- Specific troubleshooting steps based on error type
- Execution time information
- User-friendly guidance

Example:
```typescript
❌ Failed to execute send_email

**Error Details:**
• Error: Gmail authentication failed. Please reconnect your Gmail account.
• Execution time: 1234ms

**What you can try:**
• Your Gmail authentication may have expired
• Please reconnect your Gmail account in Integrations
```

### 2. Real-Time Tool Execution Logger

**Component**: `src/components/ToolExecutionLogger.tsx`

Features:
- Real-time console logs during tool execution
- Collapsible/expandable interface
- Copy logs to clipboard
- Download logs as JSON
- Full-screen mode for detailed viewing
- Color-coded log levels (info, warn, error, success, debug)
- Timestamps with millisecond precision

### 3. Tool Execution History

**Component**: `src/components/ToolExecutionHistory.tsx`

Features:
- Complete history of all tool executions
- Filter by tool, provider, status
- View detailed parameters and results
- Export to CSV
- Statistics view (success rate, average execution time)
- Integrated into agent edit page

### 4. Tool Execution Status Indicator

**Component**: `src/components/ToolExecutionStatusIndicator.tsx`

Features:
- Visual progress indicator during execution
- Step-by-step execution status
- Elapsed time tracking
- Provider-specific icons
- Animated effects during execution

### 5. Backend Logging Infrastructure

**Tables**:
- `tool_execution_logs` - General tool execution tracking
- `gmail_operation_logs` - Gmail-specific operation logs

**Logging Points**:
- Tool validation
- Permission checks
- API calls
- Error details
- Execution timing

## User Experience Flow

1. **During Execution**:
   - AI Thinking Indicator shows current state
   - Tool Execution Logger displays real-time logs
   - Tool Status Indicator shows progress

2. **After Execution**:
   - Detailed error messages in chat
   - Complete logs available in Tool Execution Logger
   - Permanent record in Tool Execution History

3. **Historical Review**:
   - Access Tool Execution History from agent edit page
   - Filter and search past executions
   - Export data for analysis

## Debugging Tools

### View Gmail Logs Script
```bash
node scripts/view_gmail_logs.js [agentId] [limit]
```

Shows:
- Gmail operation parameters
- Actual API responses
- Detailed error messages
- Execution timing

### Diagnostic Scripts
- `scripts/diagnose_gmail_tools.js` - Diagnose Gmail tool availability
- `scripts/test_gmail_tools_availability.js` - Test RPC functions

## Implementation Details

### Event System
The system uses a custom event system for real-time updates:

```typescript
// Emit log
window.dispatchEvent(new CustomEvent('tool-execution-log', {
  detail: {
    level: 'info',
    message: 'Sending email...',
    toolName: 'send_email',
    phase: 'execution'
  }
}));
```

### Database Schema
```sql
-- tool_execution_logs
CREATE TABLE tool_execution_logs (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  user_id UUID REFERENCES auth.users(id),
  tool_name TEXT NOT NULL,
  tool_provider TEXT NOT NULL,
  parameters JSONB,
  result_data JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  quota_consumed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Benefits

1. **Complete Transparency**: Users can see exactly what their agents are doing
2. **Better Debugging**: Detailed logs help identify and fix issues quickly
3. **User Trust**: Visibility builds confidence in the system
4. **Learning Tool**: Users can understand how tools work by viewing execution details
5. **Audit Trail**: Complete history for compliance and review

## Future Enhancements

1. **Real-time streaming logs from backend**: WebSocket connection for live backend logs
2. **Log aggregation**: Combine logs from multiple sources
3. **Alert system**: Notify users of failed executions
4. **Performance metrics**: Track tool performance over time
5. **Cost tracking**: Show API usage costs per execution 