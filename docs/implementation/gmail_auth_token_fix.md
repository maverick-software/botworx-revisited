# Gmail Auth Token Fix

## Date: July 18, 2025

## Issue
The Gmail agent was failing to send emails with the error "Invalid or expired token" in the gmail-api function logs. The agent would attempt to call `gmail_send_message` (wrong tool name) and then fail with authentication errors.

## Root Cause
The chat function was not passing the JWT authorization token when invoking the gmail-api edge function. The gmail-api function requires a valid JWT token to authenticate the user, but it was receiving none.

## Solution Implemented

1. **Modified chat/index.ts** to extract the auth token:
   ```typescript
   const authToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
   ```

2. **Updated handleAgentMessage** to accept the auth token as a parameter

3. **Modified FunctionCallingManager** constructor to accept and store the auth token:
   ```typescript
   constructor(
     private supabaseClient: SupabaseClient,
     private authToken: string = ''
   ) {}
   ```

4. **Updated gmail-api invocation** to pass the Authorization header:
   ```typescript
   const { data, error } = await this.supabaseClient.functions.invoke('gmail-api', {
     body: {
       action: toolName,
       agent_id: agentId,
       user_id: userId,
       parameters,
     },
     headers: {
       'Authorization': `Bearer ${this.authToken}`
     }
   });
   ```

## Files Modified
- `supabase/functions/chat/index.ts`
- `supabase/functions/chat/function_calling.ts`

## Testing
After deploying the updated chat function, the Gmail agent should now be able to:
1. Properly authenticate when calling the gmail-api function
2. Send emails successfully
3. Log operations to both tool_execution_logs and gmail_operation_logs tables

## Additional Notes
- The tool name issue (gmail_send_message vs send_email) was also fixed in a previous update
- The ToolExecutionLogger component was updated to fetch logs from the database for better visibility
- Both logging tables (tool_execution_logs and gmail_operation_logs) were created via migrations 