# Retry Mechanism Investigation - Parameter Issue Analysis

**Date:** October 10, 2025  
**Issue:** LLM retry mechanism not providing correct parameter values  
**Status:** ROOT CAUSE IDENTIFIED

---

## 🔍 The Problem

User query: *"Why isn't our retry mechanism adding proper values?"*

**Log Evidence:**
```
[RetryCoordinator] LLM approved retry for quickbooks_online_api_request_beta: 
The error message indicates that the 'instructions' parameter is missing or undefined. 
This is a parameter issue, which is typically retryable once the correct parameters are provided. 
(Confidence: 100%)
```

**The Issue:**
- LLM knows the parameter is missing
- LLM says it's retryable
- But **LLM doesn't know WHAT VALUE to provide**
- The retry guidance says "provide correct parameters" but doesn't tell the LLM HOW

---

## 🎯 Root Cause Analysis

### Problem 1: Schema IS Being Used, But It's Incomplete

Looking at the flow:

```typescript
// 1. LLM gets tool schema from get-agent-tools
{
  name: "quickbooks_online_api_request_beta",
  parameters: {
    // Schema might say 'instructions' is required
    // BUT doesn't give examples or defaults
  }
}

// 2. User says: "show me my quickbooks data"
// 3. LLM generates tool call with NO instructions (user didn't specify)
{
  "instructions": undefined  // or missing
}

// 4. Zapier MCP rejects: "instructions field is missing"
// 5. Retry mechanism says: "provide instructions"
// 6. LLM thinks: "But what instructions? The user didn't say!"
```

### Problem 2: MCP Error Messages Are Too Vague

**Current Error:**
```
"The 'instructions' parameter is missing or undefined"
```

**What LLM Needs:**
```
"Question: To make a QuickBooks API request, what data would you like me to retrieve?

Please provide instructions for the API request. Examples:
- 'Get customer list'
- 'Retrieve recent invoices'  
- 'Show account balances'

Use the 'instructions' parameter to specify your request."
```

### Problem 3: LLM Doesn't Have Context About What User Wants

When retry happens:

```typescript
// Retry guidance says:
"Generate a COMPLETELY NEW tool call with correct parameters"

// LLM thinks:
"OK, I need 'instructions' parameter... but the user just said 
'show me my quickbooks data' - what specific instruction should I give?"

// LLM's options:
1. Ask user (breaks the flow)
2. Guess (might be wrong)
3. Use empty string (gets rejected)
4. Give up (current behavior)
```

---

## 🔧 The Solution - Multi-Part Fix

### Fix 1: Enhance MCP Error Messages (Zapier Side or Our Transform)

**Current:**
```json
{
  "error": "Field 'instructions' is missing"
}
```

**Should Be:**
```json
{
  "error": "Question: What QuickBooks operation would you like to perform? Please provide specific instructions in the 'instructions' parameter. Examples: 'list customers', 'get invoice #12345', 'retrieve account balances'."
}
```

**Implementation:**
```typescript
// In mcp-execute/index.ts - transform vague errors into helpful ones
if (error.includes('missing') && error.includes('instructions')) {
  const contextualError = `Question: To execute this tool, I need specific instructions. 
  
Based on the user's request "${context.userMessage}", please provide the 'instructions' parameter with a clear, specific API request.

Examples for this tool:
- For data retrieval: "Get list of [resource]"
- For specific records: "Retrieve [resource] with ID [value]"
- For operations: "Create/Update/Delete [resource]"

User's original request: "${context.userMessage}"
Please generate an 'instructions' value that fulfills this request.`;
  
  error = contextualError;
}
```

### Fix 2: Include User's Original Intent in Retry Context

**Update RetryCoordinator:**
```typescript
// Add user's original message to retry context
const mcpRetryMessage = MCPRetryHandler.generateRetrySystemMessage({
  toolName: toolDetail.name,
  originalParams: toolDetail.input_params || {},
  errorMessage: toolDetail.error || '',
  attempt: retryAttempts,
  maxAttempts: this.MAX_RETRY_ATTEMPTS,
  suggestedFix: retryAnalysis.suggestedFix,
  userIntent: context.originalUserMessage // NEW: Include what user actually asked for
});
```

**Update MCP Retry Message:**
```typescript
static generateRetrySystemMessage(context: MCPRetryContext): string {
  return `🔄 MCP TOOL RETRY - Attempt ${context.attempt}/${context.maxAttempts}

ERROR: ${context.errorMessage}

USER'S ORIGINAL REQUEST: "${context.userIntent}"

🎯 YOUR TASK:
Based on the user's request above, generate the missing parameter value that will fulfill their intent.

For example:
- If user said "show me my invoices" → instructions: "Get list of invoices"
- If user said "customer data" → instructions: "Retrieve customer list"
- If user said "recent transactions" → instructions: "Get recent transaction history"

Generate a NEW tool call for ${context.toolName} with the appropriate parameter value derived from the user's request.`;
}
```

### Fix 3: LLM-Powered Parameter Inference

**New Function:**
```typescript
// In intelligent-retry-system.ts
static async inferMissingParameterValue(
  toolName: string,
  missingParam: string,
  userMessage: string,
  openai: any
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `You are a parameter inference system. 
      
Given:
- Tool: ${toolName}
- Missing parameter: ${missingParam}
- User's request: "${userMessage}"

Infer the most appropriate value for the missing parameter that would fulfill the user's intent.

Examples:
- Tool: search_emails, Param: query, User: "show my emails from john" → "from:john"
- Tool: get_data, Param: instructions, User: "get customer list" → "Retrieve customer list"
- Tool: api_request, Param: endpoint, User: "show invoices" → "invoices"

Return ONLY the inferred parameter value, nothing else.`
    }],
    max_tokens: 100
  });
  
  return completion.choices[0].message.content.trim();
}
```

### Fix 4: Enhanced Retry Guidance with Inferred Values

**In RetryCoordinator:**
```typescript
// After LLM determines error is retryable
if (isMCPError) {
  // Try to infer missing parameter value
  let inferredValue: string | undefined;
  const missingParam = extractMissingParamName(toolDetail.error);
  
  if (missingParam && context.originalUserMessage) {
    console.log(`[RetryCoordinator] 🧠 Inferring value for ${missingParam}...`);
    
    inferredValue = await IntelligentRetrySystem.inferMissingParameterValue(
      toolDetail.name,
      missingParam,
      context.originalUserMessage,
      openai
    );
    
    console.log(`[RetryCoordinator] 💡 Inferred value: "${inferredValue}"`);
  }
  
  const mcpRetryMessage = MCPRetryHandler.generateRetrySystemMessage({
    toolName: toolDetail.name,
    originalParams: toolDetail.input_params || {},
    errorMessage: toolDetail.error || '',
    attempt: retryAttempts,
    maxAttempts: this.MAX_RETRY_ATTEMPTS,
    suggestedFix: retryAnalysis.suggestedFix,
    userIntent: context.originalUserMessage,
    inferredParameterValue: inferredValue ? {
      param: missingParam,
      value: inferredValue
    } : undefined
  });
}
```

**Update MCP Retry Message:**
```typescript
${context.inferredParameterValue ? `
💡 SUGGESTED PARAMETER VALUE (AI-INFERRED):
Based on the user's request, use this value:
  ${context.inferredParameterValue.param}: "${context.inferredParameterValue.value}"
` : ''}
```

---

## 📊 Expected vs Actual Behavior

### Current (Broken) Flow:

```
1. User: "show me my quickbooks data"
2. LLM: calls quickbooks_online_api_request_beta with {}
3. Error: "'instructions' is missing"
4. Retry: "Please provide 'instructions'"
5. LLM: "I don't know what instructions to provide"
6. ❌ FAIL
```

### Fixed Flow:

```
1. User: "show me my quickbooks data"
2. LLM: calls quickbooks_online_api_request_beta with {}
3. Error: "'instructions' is missing"
4. Retry System:
   a. Extracts missing param: "instructions"
   b. User intent: "show me my quickbooks data"
   c. LLM inference: "Get QuickBooks data overview"
5. Retry: "Use: instructions: 'Get QuickBooks data overview'"
6. LLM: calls quickbooks_online_api_request_beta({instructions: "Get QuickBooks data overview"})
7. ✅ SUCCESS
```

---

## 🎯 Immediate Action Items

### Priority 1: Add User Intent to Retry Context
**File:** `supabase/functions/chat/processor/utils/retry-coordinator.ts`
**Changes:**
- Pass `context.originalUserMessage` to `generateRetrySystemMessage`
- Include user's request in retry guidance

### Priority 2: Implement Parameter Value Inference
**File:** `supabase/functions/chat/processor/utils/intelligent-retry-system.ts`
**Changes:**
- Add `inferMissingParameterValue()` method
- Call during retry to suggest actual values

### Priority 3: Enhance Error Messages
**File:** `supabase/functions/mcp-execute/index.ts`
**Changes:**
- Transform generic errors into contextual questions
- Include user's original request in error context

### Priority 4: Update MCP Retry Guidance
**File:** `supabase/functions/chat/processor/utils/mcp-retry-handler.ts`
**Changes:**
- Add user intent section
- Add inferred parameter value section
- Make guidance more actionable

---

## 🔬 Why This Happens

### The Schema Limitation

Tool schemas define:
- ✅ Parameter names
- ✅ Parameter types
- ✅ Required vs optional
- ❌ NOT what VALUE to use for user's specific request

Example schema:
```json
{
  "parameters": {
    "instructions": {
      "type": "string",
      "description": "Instructions for the API request",
      "required": true
    }
  }
}
```

**LLM knows:**
- "instructions" is required
- It must be a string

**LLM DOESN'T know:**
- What string to provide for "show me my quickbooks data"
- Should it be "Get data" or "List all records" or "Retrieve QuickBooks info"?

### The Context Gap

```
❌ What LLM Has:
- Tool schema (generic)
- Error message ("instructions missing")
- Original parameters (empty)

✅ What LLM Needs:
- User's original request
- Examples of valid values
- Mapping from user intent → parameter value
```

---

## 📝 Testing Plan

### Test Case 1: QuickBooks Request
```
User: "show me my quickbooks data"
Expected: LLM infers instructions: "Retrieve QuickBooks data"
Result: Tool executes successfully
```

### Test Case 2: Email Search
```
User: "find emails from john"
Expected: LLM infers searchValue: "from:john"
Result: Tool executes successfully
```

### Test Case 3: Generic Request
```
User: "get my contacts"
Expected: LLM infers appropriate parameter for contact tool
Result: Tool executes successfully
```

---

## ✅ Success Criteria

After implementing fixes:

1. **Parameter Inference:** LLM can generate appropriate parameter values from user intent
2. **Retry Success Rate:** >80% of retries succeed (vs current ~0%)
3. **User Experience:** No visible errors, seamless execution
4. **Logging:** Clear inference reasoning in logs

---

## 🎉 Conclusion

**Problem:** Retry mechanism tells LLM WHAT to provide but not WHAT VALUE

**Root Cause:** Missing context about user's original intent + vague error messages

**Solution:** 
1. Pass user intent to retry system
2. Use LLM to infer missing parameter values  
3. Provide specific, actionable retry guidance
4. Transform generic errors into helpful questions

**Next Steps:** Implement the 4 priority fixes outlined above

---

**Status:** ANALYSIS COMPLETE - READY FOR IMPLEMENTATION
**Estimated Time:** 2-3 hours
**Impact:** HIGH - Will fix persistent retry failures

