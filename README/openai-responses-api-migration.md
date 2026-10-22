# OpenAI Responses API - Complete Migration

**Migration Completed:** October 27, 2025  
**Status:** ✅ All systems now use Responses API exclusively

---

## 🎯 Overview

Agentopia has **fully migrated** from the legacy Chat Completions API to OpenAI's new **Responses API** for all LLM interactions. This ensures compatibility with GPT-4o, GPT-5, o1, o3, and all future OpenAI models.

---

## 📚 Official Documentation

- **Main API Reference:** https://platform.openai.com/docs/api-reference/introduction
- **Responses API:** https://platform.openai.com/docs/api-reference/responses
- **Responses API Guide:** https://developers.openai.com/blog/responses-api
- **SDK Documentation:** https://github.com/openai/openai-node

---

## 🔄 What is the Responses API?

The **Responses API** is OpenAI's unified, stateful interface that replaces multiple legacy APIs:

### **Key Differences from Chat Completions API:**

| Feature | Chat Completions API (Old) | Responses API (New) |
|---------|---------------------------|---------------------|
| **Endpoint** | `/v1/chat/completions` | `/v1/responses` |
| **SDK Method** | `openai.chat.completions.create()` | `openai.responses.create()` |
| **Token Limit** | `max_tokens` | `max_output_tokens` |
| **System Messages** | In messages array | Separate `instructions` field |
| **Input Format** | Always array of messages | String or array (flexible) |
| **Structured Output** | `response_format: { type: 'json_object' }` | `text: { format: { type: 'json_object' } }` |
| **Stateful** | ❌ No | ✅ Yes (conversation tracking) |
| **Multimodal** | Partial | ✅ Native support |

---

## ✅ Systems Using Responses API

### **1. Main LLM Router**
**File:** `supabase/functions/shared/llm/router.ts`  
**Provider:** `supabase/functions/shared/llm/openai_provider.ts`

**What it does:**
- Routes all agent LLM calls through the Responses API
- Handles tool calling for function execution
- Manages conversation context and history
- Supports all OpenAI models (GPT-4o, GPT-5, o1, o3)

**Code:**
```typescript
const res = await this.client.responses.create({
  model: 'gpt-4o',
  input: userMessage,
  instructions: systemPrompt,
  max_output_tokens: 1200,
  tools: [...],
  store: false
});
```

---

### **2. Contextual Awareness System**
**File:** `supabase/functions/chat/processor/utils/contextual-awareness.ts`  
**Helper:** `supabase/functions/chat/processor/utils/openai-responses-caller.ts`

**What it does:**
- Analyzes user messages in conversation context
- Resolves implicit references (pronouns, "that", "it")
- Determines user's actual intent before classification
- Uses fast models (gpt-4o-mini) for quick analysis

**Code:**
```typescript
const response = await callOpenAIResponsesAPI(apiKey, {
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextPrompt }
  ],
  temperature: 0.3,
  maxTokens: 500,
  responseFormat: { type: 'json_object' }
});
```

---

### **3. Intent Classification**
**File:** `supabase/functions/chat/processor/utils/intent-classifier.ts`  
**Helper:** `supabase/functions/chat/processor/utils/openai-responses-caller.ts`

**What it does:**
- Classifies user messages (conversation, question, action)
- Determines if tools are required
- Provides confidence scores
- Uses contextual interpretation for accuracy

**Code:**
```typescript
const response = await callOpenAIResponsesAPI(apiKey, {
  model: 'gpt-4o-mini',
  messages: [...],
  temperature: 0.3,
  maxTokens: 150,
  responseFormat: { type: 'json_object' }
});
```

---

### **4. Conversation Title Generation**
**File:** `supabase/functions/chat/index.ts`

**What it does:**
- Generates concise titles for new conversations
- Updates titles after 3rd message for better accuracy
- Uses fast models to minimize latency

**Code:**
```typescript
const { adaptLLMParams } = await import('./processor/utils/model-api-adapter.ts');

const adaptedParams = adaptLLMParams({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You generate short, informative chat titles.' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.3,
  maxTokens: 24
});

const resp = await openai.responses.create(adaptedParams);
```

---

### **5. LLM Caller (Main Chat)**
**File:** `supabase/functions/chat/processor/handlers/llm-caller.ts`

**What it does:**
- Primary interface for all agent chat interactions
- Routes through LLMRouter to OpenAIProvider
- Handles tool calling and response parsing
- Falls back gracefully if router unavailable

**Code:**
```typescript
// Uses router which internally calls Responses API
const resp = await this.router.chat(agentId, messages, {
  tools: [...],
  tool_choice: 'auto',
  temperature: 0.7,
  maxTokens: 1200
});
```

---

### **6. Memory Manager**
**File:** `supabase/functions/chat/core/memory/memory_manager.ts`

**What it does:**
- Generates conversation summaries
- Extracts key facts and entities
- Creates embeddings for semantic search
- Uses Responses API for all summarization

**SDK Version:** OpenAI SDK v6.1.0

---

### **7. Semantic Memory**
**File:** `supabase/functions/chat/core/memory/semantic_memory.ts`

**What it does:**
- Stores long-term knowledge
- Manages concept relationships
- Retrieves relevant context
- Uses Responses API for knowledge extraction

**SDK Version:** OpenAI SDK v6.1.0

---

### **8. Vector Search**
**File:** `supabase/functions/chat/vector_search.ts`

**What it does:**
- Generates embeddings for similarity search
- Searches Pinecone vector database
- Retrieves relevant context
- Uses OpenAI embeddings API

**SDK Version:** OpenAI SDK v6.1.0

---

## 🔧 Implementation Details

### **Unified OpenAI SDK Version**

All systems use **OpenAI SDK v6.1.0** which includes full Responses API support:

```typescript
import OpenAI from 'npm:openai@6.1.0';
```

**Files Updated:**
- ✅ `supabase/functions/chat/index.ts`
- ✅ `supabase/functions/shared/llm/router.ts`
- ✅ `supabase/functions/shared/llm/openai_provider.ts`
- ✅ `supabase/functions/chat/core/memory/memory_manager.ts`
- ✅ `supabase/functions/chat/core/memory/semantic_memory.ts`
- ✅ `supabase/functions/chat/vector_search.ts`
- ✅ `supabase/functions/chat/processor/utils/contextual-awareness.ts`
- ✅ `supabase/functions/chat/processor/utils/intent-classifier.ts`
- ✅ `supabase/functions/chat/processor/utils/openai-responses-caller.ts`

---

### **Helper Utilities**

#### **1. OpenAI Responses Caller**
**File:** `supabase/functions/chat/processor/utils/openai-responses-caller.ts`

Unified function for calling Responses API from utility functions:

```typescript
export async function callOpenAIResponsesAPI(
  apiKey: string,
  options: ResponsesAPICallOptions
): Promise<ResponsesAPIResponse>
```

**Features:**
- ✅ Separates system messages into `instructions`
- ✅ Uses `max_output_tokens` for token limits
- ✅ Handles structured output with `text.format`
- ✅ Disables temperature for reasoning models
- ✅ Parses response output correctly

---

#### **2. Model API Adapter**
**File:** `supabase/functions/chat/processor/utils/model-api-adapter.ts`

Ensures correct parameters for different model families:

```typescript
export function adaptLLMParams(options: LLMCallOptions): AdaptedLLMParams
```

**Handles:**
- GPT-4o models (requires `max_completion_tokens`)
- o1/o3 reasoning models (no temperature, no tools)
- Legacy GPT-4 models (uses `max_tokens`)
- Claude models (Anthropic format)
- Gemini models (Google format)

---

#### **3. Model Resolver**
**File:** `supabase/functions/chat/processor/utils/model-resolver.ts`

Dynamically resolves agent's selected model:

```typescript
export class ModelResolver {
  async getAgentModel(
    agentId: string | undefined,
    context: 'main' | 'fast' | 'embedding'
  ): Promise<ModelResolutionResult>
}
```

**Features:**
- Fetches model from `agent_llm_preferences` table
- Provides intelligent fallbacks (fast models for quick tasks)
- Caches results for 1 minute
- Handles missing preferences gracefully

---

## 🎯 Responses API Best Practices

### **1. Input Format**

**Simple queries (single user message):**
```typescript
{
  model: 'gpt-4o',
  input: 'What is the capital of France?',
  instructions: 'You are a helpful geography assistant.'
}
```

**Complex conversations (multiple messages):**
```typescript
{
  model: 'gpt-4o',
  input: [
    { role: 'user', content: 'Tell me about Paris' },
    { role: 'assistant', content: 'Paris is the capital of France...' },
    { role: 'user', content: 'What about the Eiffel Tower?' }
  ],
  instructions: 'You are a helpful travel guide.'
}
```

---

### **2. Token Limits**

Always use `max_output_tokens` (not `max_tokens`):

```typescript
{
  model: 'gpt-4o',
  input: userMessage,
  max_output_tokens: 1200 // ✅ Correct
  // max_tokens: 1200      // ❌ Wrong - causes 400 error
}
```

---

### **3. Structured Output**

Use `text.format` for JSON responses:

```typescript
{
  model: 'gpt-4o',
  input: 'Analyze this data: {...}',
  text: {
    format: {
      type: 'json_object'
    }
  }
  // response_format: { type: 'json_object' } // ❌ Wrong - old API
}
```

---

### **4. Reasoning Models**

Reasoning models (o1, o3, gpt-5, gpt-4.1) have restrictions:

```typescript
// ❌ DON'T do this with reasoning models
{
  model: 'o1-preview',
  input: userMessage,
  temperature: 0.7,        // ❌ Not supported
  tools: [...],            // ❌ Not supported
  text: { format: {...} }  // ❌ Not supported
}

// ✅ DO this instead
{
  model: 'o1-preview',
  input: userMessage,
  max_output_tokens: 1200  // ✅ Only this is supported
}
```

---

### **5. Function Calling (Tools)**

Tools are defined differently in Responses API:

```typescript
{
  model: 'gpt-4o',
  input: userMessage,
  tools: [
    {
      type: 'function',
      name: 'search_web',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query'],
        additionalProperties: false  // ✅ Required for strict mode
      },
      strict: true  // ✅ Enable strict mode
    }
  ]
}
```

**Note:** Responses API doesn't support `tool_choice` parameter. To force tool usage, add explicit instructions:

```typescript
{
  model: 'gpt-4o',
  input: userMessage,
  instructions: 'You MUST use one of the available function tools to complete this request.',
  tools: [...]
}
```

---

## 📊 Response Format

Responses API returns a different structure:

```json
{
  "id": "resp_abc123",
  "object": "response",
  "created_at": 1741476542,
  "status": "completed",
  "model": "gpt-4o",
  "output": [
    {
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": "Paris is the capital of France."
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 36,
    "output_tokens": 87,
    "total_tokens": 123
  }
}
```

**Parsing:**
```typescript
let content = '';
for (const item of response.output || []) {
  if (item.type === 'message') {
    for (const contentBlock of item.content || []) {
      if (contentBlock.type === 'output_text') {
        content = contentBlock.text;
      }
    }
  }
}
```

---

## 🚀 Migration Benefits

### **Performance Improvements**

✅ **Stateful Conversations:** Automatic context management reduces token usage  
✅ **Better Caching:** Improved cache utilization reduces latency by ~30%  
✅ **Lower Costs:** Cache hits can reduce costs by up to 50%  

### **Feature Enhancements**

✅ **Multimodal Support:** Native support for text, images, audio  
✅ **Built-in Tools:** Web Search, File Search, Code Interpreter  
✅ **Better Streaming:** Improved streaming for real-time responses  

### **Future-Proofing**

✅ **GPT-5 Ready:** Works with all current and future models  
✅ **Reasoning Models:** Native support for o1, o3 models  
✅ **Unified API:** Single interface for all AI capabilities  

---

## 🔍 Debugging

### **Enable Detailed Logging**

All Responses API calls include detailed logging:

```
[ResponsesAPI] Calling with: {
  model: 'gpt-4o',
  hasInstructions: true,
  inputType: 'string',
  temperature: 0.7,
  maxOutputTokens: 1200
}
```

### **Common Issues**

**Issue 1: "Unsupported parameter: 'max_tokens'"**
- **Cause:** Using old Chat Completions API parameter
- **Fix:** Use `max_output_tokens` instead

**Issue 2: "Unsupported parameter: 'temperature'"**
- **Cause:** Using temperature with reasoning models
- **Fix:** Remove temperature for o1/o3/gpt-5 models

**Issue 3: "Unsupported parameter: 'tools'"**
- **Cause:** Using tools with reasoning models
- **Fix:** Reasoning models don't support tools - use GPT-4o instead

---

## 📝 Testing

### **Test with Different Models**

```bash
# Test GPT-4o
curl -X POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "input": "What is 2+2?",
    "max_output_tokens": 10
  }'

# Test o1-preview (reasoning model)
curl -X POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "o1-preview",
    "input": "Solve this complex problem: ...",
    "max_output_tokens": 1000
  }'
```

---

## 🔗 Related Documentation

- [Intelligent Chat System](./intelligent-chat-system.md) - Complete chat processing pipeline
- [Dynamic Model Selection](../docs/features/DYNAMIC_MODEL_SELECTION_IMPLEMENTATION.md) - Agent model configuration
- [Model API Adapter](../docs/features/MODEL_API_ADAPTER.md) - Multi-model compatibility

---

## ✅ Migration Checklist

- [x] Updated all OpenAI SDK imports to v6.1.0
- [x] Migrated OpenAIProvider to use `openai.responses.create()`
- [x] Created unified Responses API caller utility
- [x] Updated contextual awareness system
- [x] Updated intent classification system
- [x] Updated title generation functions
- [x] Updated memory manager
- [x] Updated semantic memory
- [x] Updated vector search
- [x] Tested with GPT-4o
- [x] Tested with GPT-5
- [x] Tested with o1/o3 reasoning models
- [x] Updated documentation

---

**Migration Status:** ✅ **COMPLETE**  
**Last Updated:** October 27, 2025  
**Next Review:** When new OpenAI models are released

