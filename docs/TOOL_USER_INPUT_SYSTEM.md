# Tool User Input System

## Overview

The Tool User Input System allows tools to request additional context or information from users before execution. This is particularly useful for tools that require configuration values (like API credentials, Company IDs, account numbers) that cannot be determined automatically.

## Architecture

```
┌─────────────────┐
│   User Message  │
│  "Get P&L Q1"   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│   LLM selects tool              │
│   quickbooks_online_api_request │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Universal Tool Executor              │
│  - Check tool status                  │
│  - Check requires_user_input metadata │
│  - Missing realm_id? Request it!      │
└────────┬─────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────┐
│  Return requires_user_input: true     │
│  with request details                 │
└────────┬──────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────┐
│  Frontend renders ToolUserInputCard   │
│  User provides: realm_id = 9130...    │
└────────┬──────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────┐
│  Store in tool_user_input_requests    │
│  Status: completed                    │
└────────┬──────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────┐
│  LLM retries tool with realm_id       │
│  Tool executes successfully!          │
└───────────────────────────────────────┘
```

## Components

### 1. Tool Metadata (`get-agent-tools`)

Tools can declare they require user input by including a `requires_user_input` field:

```typescript
{
  name: 'quickbooks_online_api_request',
  description: '...',
  parameters: {...},
  requires_user_input: {
    reason: 'QuickBooks API requests require your Company ID (Realm ID)',
    fields: [
      {
        name: 'quickbooks_realm_id',
        label: 'QuickBooks Company ID',
        description: 'Find this in your QuickBooks URL...',
        type: 'text',
        required: true,
        placeholder: '9130346988354456',
        validation: '^[0-9]{10,20}$'
      }
    ],
    save_for_session: true  // Remember for entire conversation
  }
}
```

### 2. Universal Tool Executor Check

Before executing a tool, the executor checks:

```typescript
const userInputCheck = await this.checkRequiredUserInput(
  toolName, agentId, userId, parameters, supabase
);

if (userInputCheck.requiresInput) {
  return {
    success: false,
    error: userInputCheck.reason,
    requires_user_input: true,
    user_input_request: userInputCheck.request
  };
}
```

### 3. Database Table (`tool_user_input_requests`)

Stores user input requests and responses:

```sql
CREATE TABLE tool_user_input_requests (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    tool_name TEXT NOT NULL,
    tool_call_id TEXT NOT NULL UNIQUE,
    required_fields JSONB NOT NULL,
    user_inputs JSONB,
    status TEXT DEFAULT 'pending',  -- pending | completed | cancelled
    created_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
```

### 4. Edge Function (`tool-user-input`)

Manages the lifecycle of user input requests:

**Actions:**
- `create_request` - Create a new user input request
- `submit_response` - User provides the requested input
- `get_pending` - Get pending requests for a conversation
- `get_session_values` - Get saved values for this conversation

### 5. Frontend Component (`ToolUserInputCard`)

Interactive card that:
- Displays why input is needed
- Shows form fields with validation
- Collects and submits user input
- Shows completion state

## Usage Examples

### Example 1: QuickBooks Company ID

**Scenario:** User asks "Get my P&L report for Q1 2025"

**Flow:**
1. LLM selects `quickbooks_online_api_request`
2. Tool requires `quickbooks_realm_id`
3. Card appears: "QuickBooks Company ID needed"
4. User enters: `9130346988354456`
5. Tool executes with full URL: `https://quickbooks.api.intuit.com/v3/company/9130346988354456/reports/ProfitAndLoss`
6. Success! ✅

**Saved for session:** Next QuickBooks request in same conversation won't ask again.

### Example 2: SSH Connection Parameters

```typescript
requires_user_input: {
  reason: 'SSH connection requires server details',
  fields: [
    {
      name: 'ssh_host',
      label: 'Server Host',
      type: 'text',
      required: true,
      placeholder: 'example.com'
    },
    {
      name: 'ssh_port',
      label: 'Port',
      type: 'number',
      required: false,
      placeholder: '22'
    },
    {
      name: 'ssh_username',
      label: 'Username',
      type: 'text',
      required: true
    }
  ],
  save_for_session: true
}
```

### Example 3: Database Selection

```typescript
requires_user_input: {
  reason: 'Which database should I query?',
  fields: [
    {
      name: 'database_name',
      label: 'Database',
      type: 'select',
      options: ['production', 'staging', 'development'],
      required: true
    }
  ],
  save_for_session: false  // Ask each time for safety
}
```

## Session Persistence

When `save_for_session: true`:

1. **First Request:** User provides `quickbooks_realm_id = 9130346988354456`
2. **Stored in:** `tool_user_input_requests` with `conversation_id`
3. **Second Request in same conversation:** Executor checks session, finds value, skips input request
4. **New Conversation:** Asks again (fresh session)

## Adding User Input to New Tools

### Step 1: Add metadata in `get-agent-tools/index.ts`

```typescript
let requiresUserInput = null;
if (mcpTool.tool_name.includes('your_tool_prefix')) {
  requiresUserInput = {
    reason: 'Why this input is needed',
    fields: [
      {
        name: 'field_name',
        label: 'User-facing label',
        description: 'Help text',
        type: 'text',  // or 'number', 'select'
        required: true,
        placeholder: 'Example value',
        validation: '^regex$'  // optional
      }
    ],
    save_for_session: true  // or false
  };
}

tools.push({
  name: mcpTool.tool_name,
  // ... other fields ...
  requires_user_input: requiresUserInput
});
```

### Step 2: Handle the parameter in your tool

```typescript
// In your edge function or tool handler
const realmId = params.quickbooks_realm_id || 'default_value';
const url = `https://api.example.com/company/${realmId}/endpoint`;
```

### Step 3: Deploy

```powershell
supabase functions deploy get-agent-tools --no-verify-jwt
```

That's it! The system handles the rest automatically.

## Frontend Integration

```typescript
import { ToolUserInputCard } from '@/components/chat/ToolUserInputCard';

// In your chat message renderer
{message.requires_user_input && (
  <ToolUserInputCard
    request={message.user_input_request}
    onSubmit={async (toolCallId, inputs) => {
      await supabase.functions.invoke('tool-user-input', {
        body: {
          action: 'submit_response',
          tool_call_id: toolCallId,
          user_inputs: inputs
        }
      });
      
      // Trigger retry with new input
      retryToolExecution(toolCallId, inputs);
    }}
    onCancel={(toolCallId) => {
      // Mark as cancelled
      cancelToolExecution(toolCallId);
    }}
  />
)}
```

## Security Considerations

1. **RLS Policies:** Users can only see/modify their own input requests
2. **Validation:** Frontend and backend validate input format
3. **Sensitive Data:** User inputs stored in regular columns (not encrypted)
   - If storing sensitive data, integrate with Supabase Vault
4. **Session Scope:** Values only persist within conversation, not globally

## Future Enhancements

- [ ] Integrate with Supabase Vault for sensitive values
- [ ] Allow tools to pre-populate values from previous successful calls
- [ ] Support conditional fields (show field B only if field A = X)
- [ ] Rich field types (file upload, date picker, etc.)
- [ ] Multi-step input collection for complex tools
- [ ] Global user preferences (save realm_id for all conversations)

## Troubleshooting

**Q: User input card doesn't appear**
- Check tool metadata has `requires_user_input` field
- Verify frontend is checking for `message.requires_user_input`
- Check browser console for errors

**Q: Tool still fails after providing input**
- Verify parameter name matches field name
- Check tool is using the parameter in execution
- Look at edge function logs

**Q: Session values not persisting**
- Verify `save_for_session: true` in metadata
- Check `tool_user_input_requests` table for completed entries
- Ensure `conversation_id` is consistent

**Q: How to clear session values?**
- End the conversation (start new one)
- Or update status to 'cancelled' in database

