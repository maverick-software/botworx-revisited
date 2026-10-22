# MCP Protocol Implementation Fix - Proper LLM-Based Retry

## ⚠️ ROOT CAUSE IDENTIFIED

**The REAL issue is STALE TOOL SCHEMAS in `mcp_tools_cache`!**

While we've implemented comprehensive retry logic, the fundamental problem is:
- The cached OpenAI schema has `instructions` as the parameter
- Zapier's current MCP schema expects `searchValue` 
- When LLM uses cached schema → sends wrong parameters → fails

**SOLUTION:** Call `refresh-mcp-tools` edge function to update schemas from Zapier MCP server.

See `docs/FIX_OUTLOOK_MCP_SCHEMA.md` for immediate fix instructions.

---

# Original Implementation (Retry Logic Enhancement)

## Problem Statement

The intelligent retry system was bypassing the LLM and trying to automatically fix parameters. This violates the MCP (Model Context Protocol) specification which requires:

1. **Interactive Error Messages**: MCP servers return conversational error messages like "Question: What should I search for?"
2. **LLM-Based Retry**: The LLM reads the error message and makes a NEW tool call with corrected parameters
3. **Natural Conversation Flow**: Errors should feel like a helpful assistant asking for clarification

## Current Issue

When `microsoft_outlook_find_emails` fails with:
```
"Question: To find emails, I need a search value. Please provide: ... 
Use the 'searchValue' parameter, not 'instructions'."
```

**What was happening**:
- ❌ Intelligent retry system tries to automatically transform parameters
- ❌ Bypasses the LLM entirely
- ❌ Error message shown to user instead of automatic retry

**What should happen** (per MCP protocol):
- ✅ Add error message to conversation as system message
- ✅ LLM reads the error and understands what's needed
- ✅ LLM makes NEW tool call with corrected parameters
- ✅ User never sees the error - seamless retry

## Solution Implemented

### 1. MCP Retry Handler (`mcp-retry-handler.ts`)
- Detects MCP interactive errors (Question:, please provide, etc.)
- Generates proper system messages following MCP protocol
- Extracts parameter hints from error messages

### 2. Updated Retry Coordinator
- Checks if error is MCP interactive error
- Adds MCP retry guidance to conversation
- Sets `requiresLLMRetry` flag instead of executing directly
- Returns control to handler for LLM call

### 3. Tool Execution Types
- Added `requiresLLMRetry` flag to signal handler
- Added `retryGuidanceAdded` flag to track state

### 4. Handler Integration (TODO)
- Handler needs to check `toolExecResult.requiresLLMRetry`
- If true, call LLM again with updated conversation
- LLM will make NEW tool calls based on MCP guidance
- Execute new tool calls and continue

## MCP Protocol Flow

```
User: "Show me my last 10 emails"
    ↓
LLM generates: microsoft_outlook_find_emails({})
    ↓
Tool executes → MCP Error: "Question: Use 'searchValue' parameter"
    ↓
Add MCP error message to conversation as system message
    ↓
Set requiresLLMRetry = true
    ↓
Handler sees flag, calls LLM again
    ↓
LLM reads error, generates: microsoft_outlook_find_emails({ searchValue: "" })
    ↓
Tool executes → SUCCESS
    ↓
User sees: "Here are your last 10 emails..."
```

## Files Modified

1. ✅ `mcp-retry-handler.ts` - NEW: MCP protocol implementation
2. ✅ `retry-coordinator.ts` - Detects MCP errors, adds guidance
3. ✅ `tool-execution-types.ts` - Added retry flags
4. ✅ `tool-execution-orchestrator.ts` - Passes flags through
5. ⏳ `handlers.ts` - TODO: Check flags and retry LLM call

## Next Steps

The handler (`handlers.ts`) needs to be updated to:

```typescript
const toolExecResult = await ToolExecutor.executeToolCalls(...);

// Check if MCP retry is needed
if (toolExecResult.requiresLLMRetry && toolExecResult.retryGuidanceAdded) {
  console.log(`[TextMessageHandler] MCP retry required, calling LLM again`);
  
  // Call LLM again - it will read the MCP guidance and make new tool calls
  const retryCompletion = await llm.chat(msgs, { tools: availableTools });
  const retryToolCalls = retryCompletion.tool_calls || [];
  
  if (retryToolCalls.length > 0) {
    // Execute the retry tool calls
    const retryResult = await ToolExecutor.executeToolCalls(retryToolCalls, ...);
    // Merge results...
  }
}
```

## Benefits of Proper MCP Implementation

1. **✅ LLM-Powered Intelligence**: LLM reads error messages and corrects parameters
2. **✅ Flexible**: Works with ANY MCP server error format
3. **✅ Natural**: Follows conversational error protocol
4. **✅ Maintainable**: No hard-coded parameter transformations needed
5. **✅ Scalable**: Works for all current and future MCP tools

## Testing Checklist

- [ ] Test `microsoft_outlook_find_emails` with missing searchValue
- [ ] Verify LLM reads MCP error and provides searchValue on retry
- [ ] Test with other MCP tools (Gmail, contacts, etc.)
- [ ] Verify max 3 retry attempts
- [ ] Test non-MCP errors still use intelligent retry
- [ ] Verify user never sees MCP error messages

## Deployment Status

- ✅ MCP retry handler created
- ✅ Retry coordinator updated
- ✅ Types updated
- ✅ Orchestrator updated
- ✅ Handler integration COMPLETE (MCP retry loop implemented)
- ✅ DEPLOYED to production
- ⏳ Testing with live Outlook MCP queries

## References

- `archive/tool_use/mcp_client_error_response_protocol.md` - Official MCP error protocol
- `docs/requirements/mcp_integration_requirements_04_10_2025.md` - MCP integration requirements
- Model Context Protocol Specification: https://modelcontextprotocol.io/specification/

