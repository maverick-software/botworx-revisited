# LLM Integration Fix Plan

## Problem Statement

The chat system is experiencing critical errors where the OpenAI API rejects requests with the error:
"An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'."

## Root Cause Analysis

After the MCP retry loop completes successfully, the final synthesis LLM call receives a malformed message array that contains:
1. Assistant messages with `tool_calls` property
2. Missing corresponding tool response messages

This violates OpenAI's API requirement that every assistant message with tool_calls MUST be immediately followed by tool response messages.

## Technical Context

### Current Flow
1. Initial LLM call → generates tool_calls
2. MCP Retry Loop (up to 3 attempts):
   - Executes tools
   - Adds tool results to messages
   - Calls LLM again with tool_choice: 'required'
   - LLM may generate NEW tool_calls
   - Process repeats
3. Final Synthesis Call:
   - Calls LLM with tools: [], tool_choice: undefined
   - **BUG**: Messages array contains assistant messages with tool_calls but NO tool responses

### Why This Happens

In `handlers.ts` and `mcp-retry-loop.ts`, we're cleaning messages before retry calls:

```typescript
const cleanedMsgs = msgs
  .filter(msg => msg.role !== 'tool')  // ❌ REMOVES TOOL RESPONSES
  .map(msg => {
    const cleaned: any = { role: msg.role, content: msg.content };
    return cleaned;  // ❌ REMOVES tool_calls property
  });
```

But for the FINAL synthesis call, we're NOT cleaning the messages, so they still have:
- Assistant messages with `tool_calls` property
- No matching tool response messages (they were never added to the final msgs array)

## Solution Strategy

### Option 1: Clean Messages for Final Synthesis (RECOMMENDED)
Strip `tool_calls` from all assistant messages before the final synthesis call, since we're not providing tools anyway.

### Option 2: Include Tool Responses in Final Synthesis
Keep both tool_calls and tool responses in the message history for context.

### Option 3: Complete Message Reconstruction
Rebuild the entire message array with proper pairing of tool_calls and responses.

## Recommended Approach: Option 1

**Why:** Simplest, cleanest, and aligns with the intent of the final synthesis call (no tools, just text response).

**Implementation:**
1. In `handlers.ts`, before the final synthesis LLM call
2. Create a message cleaning function that:
   - Keeps all user and system messages intact
   - For assistant messages: removes `tool_calls` property
   - Removes all tool role messages (they're not needed for synthesis)

## Files Affected

1. `supabase/functions/chat/processor/handlers.ts` (Line ~154)
2. Potentially `supabase/functions/chat/processor/handlers/mcp-retry-loop.ts`

## Testing Strategy

1. Test with QuickBooks tool that requires multiple retries
2. Verify final synthesis call succeeds
3. Check that tool execution results are still communicated to user
4. Ensure no regression in MCP retry loop functionality

## Success Criteria

- [ ] No more "tool_calls must be followed by tool messages" errors
- [ ] Final synthesis completes successfully after tool execution
- [ ] User receives coherent response with tool results
- [ ] MCP retry loop continues to work correctly
- [ ] All message sequences are valid per OpenAI API requirements

