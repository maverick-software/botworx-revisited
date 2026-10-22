# Contextual Awareness Failure - Investigation Report

**Date:** October 20, 2025  
**Issue:** Agent ignored user's question and executed unrelated tool  
**Status:** 🔴 **ROOT CAUSE IDENTIFIED**

---

## 🎯 **The Problem**

**User Question:**  
> "Are you able to get backlink information for websites?"

**Expected Behavior:**  
- Contextual awareness analyzes the question
- Understands user is asking about **capabilities** (not requesting action)
- Agent should respond: "Yes, I can get backlink information using the `dataforseo_get_backlinks` tool"

**Actual Behavior:**  
- Agent randomly selected `example.com`  
- Executed `dataforseo_get_backlinks` tool  
- Returned backlink data for a website the user never mentioned

---

## 🔍 **Root Cause Analysis**

### **1. Contextual Guidance Injection Failure** 🔴

**File:** `supabase/functions/chat/processor/handlers.ts`  
**Lines:** 111-131

**The Code:**
```typescript
// STEP 3.5: Inject contextual awareness into conversation
if (contextualInterpretation.confidence === 'high' && 
    contextualInterpretation.interpretedMeaning !== userText &&
    Object.keys(contextualInterpretation.resolvedReferences || {}).length > 0) {  // ❌ THIS IS THE PROBLEM!
  
  const contextualGuidance = `🧠 CONTEXTUAL UNDERSTANDING:...`;
  msgs.push({ role: 'system', content: contextualGuidance });
  console.log('[TextMessageHandler] 💡 Injected contextual guidance into conversation');
}
```

**The Problem:**  
The condition **requires resolved references** (pronouns like "it", "them", "him") to inject contextual guidance. 

For the user's question:
- ✅ `confidence === 'high'` → TRUE
- ✅ `interpretedMeaning !== userText` → TRUE (slightly different wording)
- ❌ `resolvedReferences.length > 0` → **FALSE** (no pronouns to resolve!)

**Result:** Contextual guidance was **NEVER INJECTED** into the LLM prompt, so the LLM never received the interpretation!

---

### **2. Missing Metrics Capture** 🔴

**File:** `supabase/functions/chat/processor/handlers.ts`  
**Lines:** 334-348

**The Code:**
```typescript
const metrics: ProcessingMetrics = {
  start_time: startTime,
  end_time: endTime,
  tokens_used: promptTokens + completionTokens,
  memory_searches: summaryInfo ? 1 : 0,
  tool_executions: toolDetails.length,
  stages: {
    message_prep: 100,
    intent_classification: classification.classificationTimeMs || 0,
    tool_loading: availableTools.length > 0 ? 750 : 0,
    llm_calls: endTime - startTime,
  },
  discovered_tools: availableTools.map((t) => ({ name: t.name, description: t.description })),
  tool_details: toolDetails,
};
// ❌ NO contextual_awareness field!
// ❌ NO intent_classification details!
// ❌ NO contextualInterpretation stored!
```

**The Problem:**  
The `contextualInterpretation` variable is **never added to metrics**, so:
- It's lost after the handler completes
- Can't be viewed in the Debug Modal
- Can't be used for debugging

---

### **3. Conditional Logic is Too Strict** 🔴

**Current Logic:**
```
IF (high confidence) AND (meaning different) AND (references resolved) THEN inject
```

**Should Be:**
```
IF (high confidence) AND (meaning different OR intent clarified) THEN inject
```

**Why:** Not all contextual interpretations involve pronouns! Examples:
- "Are you able to..." → Capability question, not action request
- "What's the status?" → Implied reference to ongoing work
- "Send it" → Pronoun reference

The current logic **only handles the last case** (pronouns) and **ignores the first two** (capability questions, implied context).

---

### **4. No Visibility into Decision** 🔴

**Current Code:**
```typescript
if (/* conditions */) {
  msgs.push({ role: 'system', content: contextualGuidance });
  console.log('[TextMessageHandler] 💡 Injected contextual guidance');
}
// ❌ NO ELSE BLOCK!
// ❌ NO LOG when injection is SKIPPED!
```

**The Problem:**  
When contextual guidance is **not injected**, there's:
- No log message
- No indication why it was skipped
- No way to debug the issue

---

## 🎬 **What Actually Happened**

### **Timeline:**

1. **User Message:** "Are you able to get backlink information for websites?"

2. **Contextual Awareness Analysis:** ✅ **RAN**
   ```json
   {
     "originalMessage": "Are you able to get backlink information for websites?",
     "interpretedMeaning": "User is asking about the agent's capability to retrieve backlink information, not requesting backlinks for a specific website",
     "userIntent": "inquire_about_capabilities",
     "contextualFactors": ["Question format suggests capability inquiry", "No specific website mentioned"],
     "confidence": "high",
     "resolvedReferences": {}  // ← EMPTY! No pronouns to resolve
   }
   ```

3. **Intent Classification:** ✅ **RAN**
   ```json
   {
     "requiresTools": true,  // ❌ WRONG! Should be false for capability question
     "confidence": "medium",
     "reasoning": "User mentions 'backlink information' which matches tool capabilities"
   }
   ```

4. **Contextual Guidance Injection:** ❌ **SKIPPED**
   - Condition failed: `resolvedReferences.length === 0`
   - LLM **NEVER saw** the contextual interpretation!

5. **Tool Loading:** ✅ **RAN**
   - Intent classifier said `requiresTools: true`
   - Loaded all SEO tools including `dataforseo_get_backlinks`

6. **LLM Call:** ❌ **WITHOUT CONTEXT**
   - LLM saw: "Are you able to get backlink information for websites?"
   - LLM **DID NOT see**: "User is asking about capabilities, not requesting action"
   - LLM thought: "User wants backlinks, I should call the tool"
   - LLM selected random website: `example.com`

7. **Tool Execution:** ❌ **UNINTENDED**
   - `dataforseo_get_backlinks(domain: "example.com")`
   - Returned backlink data for a website user never mentioned

---

## 💡 **Why This Happened**

### **Design Flaw:**  
The contextual guidance injection logic was designed primarily for **pronoun resolution** ("send it", "find them"), NOT for **intent classification** ("Are you able to...", "Can you...").

### **Intent Classifier Weakness:**  
The intent classifier sees keywords like "backlink information" and "websites" and thinks: "This is about SEO data → needs tools → `requiresTools: true`"

It **doesn't understand** the difference between:
- "Are you able to get backlinks?" (capability question)
- "Get backlinks for example.com" (action request)

### **Missing Context Injection:**  
Even though contextual awareness **correctly identified** it was a capability question, this insight was **NEVER passed to the LLM** because:
- No resolved references (empty `resolvedReferences` object)
- Conditional injection failed
- LLM proceeded without context

---

## 🔧 **The Fixes Needed**

### **Fix 1: Relax Injection Conditions** 🔴 **CRITICAL**

**Current:**
```typescript
if (contextualInterpretation.confidence === 'high' && 
    contextualInterpretation.interpretedMeaning !== userText &&
    Object.keys(contextualInterpretation.resolvedReferences || {}).length > 0) {
```

**Should Be:**
```typescript
if (contextualInterpretation.confidence === 'high' && 
    (contextualInterpretation.interpretedMeaning !== userText ||
     contextualInterpretation.userIntent !== 'unknown' ||
     Object.keys(contextualInterpretation.resolvedReferences || {}).length > 0)) {
```

**Why:** Inject guidance if **ANY** of these are true:
- Meaning was interpreted differently
- User intent was identified
- References were resolved

---

### **Fix 2: Add Contextual Awareness to Metrics** 🔴 **CRITICAL**

**Add to metrics:**
```typescript
const metrics: ProcessingMetrics = {
  // ... existing fields ...
  contextual_awareness: {
    original_message: userText,
    interpreted_meaning: contextualInterpretation.interpretedMeaning,
    user_intent: contextualInterpretation.userIntent,
    confidence: contextualInterpretation.confidence,
    resolved_references: contextualInterpretation.resolvedReferences || {},
    contextual_factors: contextualInterpretation.contextualFactors || [],
    analysis_time_ms: contextualInterpretation.analysisTimeMs,
    injection_applied: /* true if guidance was injected */,
  },
  intent_classification: {
    requires_tools: classification.requiresTools,
    confidence: classification.confidence,
    detected_intent: classification.detectedIntent,
    reasoning: classification.reasoning,
    classification_time_ms: classification.classificationTimeMs,
  },
  // ... rest of fields ...
};
```

---

### **Fix 3: Add Visibility Logging** 🟡 **IMPORTANT**

**Add logging:**
```typescript
if (/* injection conditions */) {
  msgs.push({ role: 'system', content: contextualGuidance });
  console.log('[TextMessageHandler] 💡 Injected contextual guidance into conversation');
} else {
  console.log('[TextMessageHandler] ⚠️ Skipped contextual guidance injection:', {
    confidence: contextualInterpretation.confidence,
    meaningDifferent: contextualInterpretation.interpretedMeaning !== userText,
    resolvedRefsCount: Object.keys(contextualInterpretation.resolvedReferences || {}).length,
    reason: 'Conditions not met for injection'
  });
}
```

---

### **Fix 4: Improve Intent Classification Prompt** 🟡 **IMPORTANT**

**Add to intent classifier system prompt:**
```
CAPABILITY QUESTIONS (DO NOT REQUIRE TOOLS):
- "Are you able to..." - User asking what you CAN do
- "Can you..." - User asking about capabilities
- "Do you have access to..." - User asking about available tools
- "What can you do with..." - User asking about features

These are INFORMATIONAL questions about capabilities, NOT action requests.
Respond with `requiresTools: false` and let the agent describe its capabilities.
```

---

## 📊 **Evidence from Logs**

Based on the screenshots provided:

1. **Processing Details Modal:**
   - ✅ Shows "Discovered Tools" including SEO tools
   - ❌ NO "Contextual Awareness" section
   - ❌ NO "Intent Classification" section
   - ✅ Shows tool execution: `dataforseo_get_backlinks (11385ms)`

2. **Agent Response:**
   - Executed tool for `example.com` domain
   - Returned 23,766,878 backlinks for a website user never mentioned
   - Shows backlinks from `www.start-me.net`, `procaly.babafig.com`, `pallad.co`

3. **Expected vs Actual:**
   - **Expected:** "Yes, I have access to the `dataforseo_get_backlinks` tool which can retrieve backlink information for any website you specify."
   - **Actual:** Executed tool with random website and returned data

---

## 🎯 **Summary**

| Component | Status | Issue |
|-----------|--------|-------|
| Contextual Awareness Analysis | ✅ Working | Correctly identified capability question |
| Contextual Guidance Injection | ❌ **FAILED** | Condition too strict (requires resolved references) |
| Intent Classification | ⚠️ **WEAK** | Misclassified capability question as action request |
| Metrics Capture | ❌ **MISSING** | Contextual data not stored for debugging |
| Visibility/Logging | ❌ **MISSING** | No logs when injection skipped |

---

## 🚀 **Next Steps**

1. **CRITICAL:** Fix injection condition to handle capability questions
2. **CRITICAL:** Add contextual_awareness and intent_classification to metrics
3. **IMPORTANT:** Add logging for skipped injections
4. **IMPORTANT:** Improve intent classifier prompt for capability questions
5. **TEST:** Verify fixes with capability questions like:
   - "Are you able to send emails?"
   - "Can you search for contacts?"
   - "Do you have access to Google Calendar?"

---

**Status:** 🔴 **ROOT CAUSE IDENTIFIED - FIXES REQUIRED**  
**Priority:** P0 (Critical - affects core functionality)  
**Impact:** Agent executes unintended actions instead of answering questions

