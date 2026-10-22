# Tool Authorization System - FIXED

## Overview

The Agentopia tool authorization system now properly implements the MCP (Model Context Protocol) pattern:

1. **Tool Discovery** - Agents only see tools they're authorized to use
2. **Tool Namespacing** - All tools have unique names to prevent collisions
3. **Permission Enforcement** - Database-driven authorization at both discovery and execution

## How It Works

### 1. Tool Discovery Phase (`getAvailableTools`)

When an agent starts a conversation, the system:

```typescript
// In supabase/functions/chat/function_calling.ts
async getAvailableTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
  // Check database for what this SPECIFIC agent can access
  const gmailTools = await this.getGmailTools(agentId, userId);    // Only if Gmail authorized
  const smtpTools = await this.getSMTPTools(agentId, userId);      // Only if SMTP authorized
  const sendgridTools = await this.getSendgridTools(agentId, userId); // Only if SendGrid authorized
  // ... etc
  
  return [...gmailTools, ...smtpTools, ...sendgridTools, ...];
}
```

### 2. Tool Presentation to LLM

The LLM receives ALL authorized tools at once:

```typescript
// In supabase/functions/chat/processor/handlers.ts
const availableTools = await fcm.getAvailableTools(context.agent_id, context.user_id);
const toolNames = availableTools.map(t => t.name).join(', ');
// Example: "gmail_send_email, gmail_read_emails, smtp_send_email, web_search"

// LLM gets the complete list
const guidance = `Available tools for this agent: ${toolNames}...`;
```

### 3. Tool Namespacing (Prevents Collisions)

Before (BROKEN - name collisions):
```
Gmail:    send_email
SMTP:     send_email  // Same name! 
SendGrid: send_email  // Same name!
```

After (FIXED - unique names):
```
Gmail:    gmail_send_email
SMTP:     smtp_send_email
SendGrid: sendgrid_send_email
Mailgun:  mailgun_send_email
```

### 4. Tool Execution with Permission Check

When the LLM chooses a tool:

```typescript
async executeTool(agentId, userId, functionName, parameters) {
  // Route based on prefix
  if (functionName.startsWith('gmail_')) {
    // Double-check permissions at execution time
    const gmailTools = await this.getGmailTools(agentId, userId);
    if (!gmailTools.find(t => t.name === functionName)) {
      return { success: false, error: 'Tool not available for this agent' };
    }
    return await this.executeGmailTool(...);
  }
  // ... same for smtp_, sendgrid_, mailgun_, etc.
}
```

## Database Structure

The authorization is stored in `agent_integration_permissions`:

```sql
-- Example: Angela has SMTP but NOT Gmail
SELECT * FROM agent_integration_permissions 
WHERE agent_id = 'angela-uuid';

-- Result: Only SMTP connection, no Gmail
connection_id | provider  | allowed_scopes
--------------|-----------|-----------------
uuid-1234     | smtp      | ['send_email']
-- No Gmail row exists!
```

## Security Guarantees

1. **No Discovery = No Access**: If an agent doesn't have permission in the database, the tool won't even appear in their list
2. **Double Verification**: Even if somehow a tool name is guessed, execution checks permissions again
3. **Vault Security**: All credentials go through Supabase Vault, never plain text
4. **Audit Trail**: All tool executions are logged

## Testing the Fix

### Test 1: Angela with SMTP Only
```
1. Angela has SMTP credentials in DB
2. Angela has NO Gmail credentials
3. When asked to send email, Angela sees: smtp_send_email
4. Angela does NOT see: gmail_send_email
5. Email sends via SMTP successfully
```

### Test 2: Agent with Gmail
```
1. Different agent has Gmail OAuth connected
2. Agent sees: gmail_send_email, gmail_read_emails, etc.
3. Agent can send/read via Gmail
```

### Test 3: Agent with Multiple Email Providers
```
1. Agent has both Gmail AND SMTP
2. Agent sees BOTH: gmail_send_email, smtp_send_email
3. LLM chooses based on context/user request
```

## Summary

The system now properly implements MCP:
- ✅ Tools are discovered from database (not hardcoded)
- ✅ Each agent only sees their authorized tools
- ✅ No name collisions (proper namespacing)
- ✅ LLM gets complete tool list upfront
- ✅ Permission checks at discovery AND execution
- ✅ Secure credential storage via Vault

Angela can no longer use Gmail because she literally doesn't know it exists!
