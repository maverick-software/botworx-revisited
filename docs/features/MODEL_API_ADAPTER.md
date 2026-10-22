# Model API Adapter - Universal Model Compatibility

**Created:** October 24, 2025  
**Purpose:** Handle different API requirements across all LLM model families

---

## 🎯 Problem Solved

Different LLM model families have **vastly different API requirements**:

| Model Family | Token Param | Temperature | Tools | Response Format |
|-------------|-------------|-------------|-------|-----------------|
| **GPT-4o** | `max_completion_tokens` | ✅ Yes | ✅ Yes | ✅ Yes |
| **o1/o3 Reasoning** | `max_completion_tokens` | ❌ **NO** | ❌ **NO** | ❌ **NO** |
| **GPT-4 Legacy** | `max_tokens` | ✅ Yes | ✅ Yes | ✅ Yes |
| **Claude** | `max_tokens` | ✅ Yes | ✅ Yes | ❌ No |
| **Gemini** | `max_tokens` | ✅ Yes | ✅ Yes | ❌ No |

**Without this adapter**, using incompatible parameters causes **400 errors**:
```
Error: 400 Unsupported parameter: 'max_tokens' is not supported with this model.
Use 'max_completion_tokens' instead.
```

Or worse:
```
Error: 400 Unsupported parameter: 'temperature' is not supported with this model.
```

---

## ✅ Solution: Model API Adapter

**File:** `supabase/functions/chat/processor/utils/model-api-adapter.ts`

A centralized adapter that:
1. **Detects** which model family is being used
2. **Strips** unsupported parameters
3. **Transforms** parameter names (e.g., `max_tokens` → `max_completion_tokens`)
4. **Logs** when parameters are removed for transparency

---

## 🔍 Model Categories

### **1. GPT-4o Family**
```typescript
{
  patterns: ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024'],
  supportsTools: true,
  supportsTemperature: true,
  supportsResponseFormat: true,
  tokenParam: 'max_completion_tokens' // ✅ New parameter
}
```

**Models:**
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4o-2024-08-06`
- `gpt-4o-2024-11-20`

---

### **2. o1/o3 Reasoning Models** (Most Restricted!)
```typescript
{
  patterns: ['o1-', 'o1-preview', 'o1-mini', 'o3-', 'o3-mini'],
  supportsTools: false,          // ❌ NO TOOLS!
  supportsTemperature: false,    // ❌ NO TEMPERATURE!
  supportsResponseFormat: false, // ❌ NO RESPONSE FORMAT!
  tokenParam: 'max_completion_tokens'
}
```

**Models:**
- `o1-preview`
- `o1-mini`
- `o3-mini`
- Future: `o1`, `o3`, `gpt-5` (likely)

**⚠️ Critical Notes:**
- These models **cannot call tools** - they're for pure reasoning
- They **ignore temperature** - they use their own internal reasoning process
- They **cannot output structured JSON** via `response_format`
- If your agent needs tools, the system will **automatically fallback** to `gpt-4o`

---

### **3. GPT-4 Legacy**
```typescript
{
  patterns: ['gpt-4-turbo', 'gpt-4-0', 'gpt-4-1', 'gpt-3.5-turbo'],
  supportsTools: true,
  supportsTemperature: true,
  supportsResponseFormat: true,
  tokenParam: 'max_tokens' // ✅ Old parameter
}
```

**Models:**
- `gpt-4`
- `gpt-4-turbo`
- `gpt-4-turbo-preview`
- `gpt-3.5-turbo`
- `gpt-3.5-turbo-16k`

---

### **4. Claude (Anthropic)**
```typescript
{
  patterns: ['claude-'],
  supportsTools: true,
  supportsTemperature: true,
  supportsResponseFormat: false, // ❌ No structured output
  tokenParam: 'max_tokens'
}
```

**Models:**
- `claude-3-opus-20240229`
- `claude-3-5-sonnet-20241022`
- `claude-3-7-sonnet-20250219`
- `claude-3-haiku-20240307`

---

### **5. Gemini (Google)**
```typescript
{
  patterns: ['gemini-'],
  supportsTools: true,
  supportsTemperature: true,
  supportsResponseFormat: false, // ❌ No structured output
  tokenParam: 'max_tokens'
}
```

**Models:**
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-2.0-flash-exp`

---

## 🔧 How It Works

### **1. Before (Broken)**
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o', // ❌ Uses max_completion_tokens
  messages,
  tools,
  temperature: 0.7,
  max_tokens: 1200, // ❌ ERROR! Should be max_completion_tokens
  response_format: { type: 'json_object' }
});
```

**Result:** `400 Unsupported parameter: 'max_tokens'`

---

### **2. After (Fixed)**
```typescript
import { adaptLLMParams } from './model-api-adapter.ts';

const adaptedParams = adaptLLMParams({
  model: 'gpt-4o',
  messages,
  tools,
  temperature: 0.7,
  maxTokens: 1200, // ✅ Will become max_completion_tokens
  response_format: { type: 'json_object' }
});

const completion = await openai.chat.completions.create(adaptedParams);
```

**Result:** ✅ Success! Correct parameters used automatically.

---

## 🚀 Usage Examples

### **Example 1: GPT-4o (New Parameter)**
```typescript
adaptLLMParams({
  model: 'gpt-4o',
  messages: [...],
  tools: [...],
  temperature: 0.7,
  maxTokens: 1200,
  response_format: { type: 'json_object' }
});

// Returns:
{
  model: 'gpt-4o',
  messages: [...],
  tools: [...],
  temperature: 0.7,
  max_completion_tokens: 1200, // ✅ Transformed
  response_format: { type: 'json_object' }
}
```

---

### **Example 2: o1-preview (Reasoning Model)**
```typescript
adaptLLMParams({
  model: 'o1-preview',
  messages: [...],
  tools: [...],              // ❌ Will be stripped
  temperature: 0.7,         // ❌ Will be stripped
  maxTokens: 1200,
  response_format: { type: 'json_object' } // ❌ Will be stripped
});

// Returns:
{
  model: 'o1-preview',
  messages: [...],
  max_completion_tokens: 1200  // ✅ Only supported params
}

// Console warnings:
// ⚠️ Model o1-preview does not support temperature parameter - stripping
// ⚠️ Model o1-preview does not support tools - stripping
// ⚠️ Model o1-preview does not support response_format - stripping
```

---

### **Example 3: Claude (Anthropic)**
```typescript
adaptLLMParams({
  model: 'claude-3-5-sonnet-20241022',
  messages: [...],
  tools: [...],
  temperature: 0.7,
  maxTokens: 1200,
  response_format: { type: 'json_object' } // ❌ Will be stripped
});

// Returns:
{
  model: 'claude-3-5-sonnet-20241022',
  messages: [...],
  tools: [...],
  temperature: 0.7,
  max_tokens: 1200  // ✅ Old parameter name
}

// Console warning:
// ⚠️ Model claude-3-5-sonnet-20241022 does not support response_format - stripping
```

---

## 🛡️ Automatic Fallbacks

### **Reasoning Model Fallback**

If a user selects an o1/o3 reasoning model but the **system needs to call tools**, the adapter provides a fallback:

```typescript
import { getReasoningFallback } from './model-api-adapter.ts';

const userSelectedModel = 'o1-preview';

if (needsTools) {
  const fallbackModel = getReasoningFallback(userSelectedModel);
  console.log(fallbackModel); // 'gpt-4o' - Best balance of capability and speed
}
```

**Why?** Reasoning models **cannot call tools**. If the conversation requires tools (e.g., web search, calculator), we automatically use the best available tool-capable model.

---

## 📊 Integration Points

The adapter is integrated into **all LLM call points**:

### **1. LLMCaller** (Main Chat)
```typescript
// File: processor/handlers/llm-caller.ts

import { adaptLLMParams } from '../utils/model-api-adapter.ts';

const adaptedParams = adaptLLMParams({
  model,
  messages: chatMessages,
  tools: [...],
  tool_choice: toolChoice,
  temperature: 0.7,
  maxTokens: 1200
});

const completion = await this.openai.chat.completions.create(adaptedParams);
```

---

### **2. Contextual Awareness**
```typescript
// File: processor/utils/contextual-awareness.ts

import { adaptLLMParams } from './model-api-adapter.ts';

const adaptedParams = adaptLLMParams({
  model,
  messages: [...],
  temperature: 0.3,
  maxTokens: 500,
  response_format: { type: 'json_object' }
});

const response = await this.openai.chat.completions.create(adaptedParams);
```

---

### **3. Intent Classification**
```typescript
// File: processor/utils/intent-classifier.ts

import { adaptLLMParams } from './model-api-adapter.ts';

const adaptedParams = adaptLLMParams({
  model,
  messages,
  temperature: 0.3,
  maxTokens: 150,
  response_format: { type: 'json_object' }
});

const response = await this.openai.chat.completions.create(adaptedParams);
```

---

### **4. Title Generation**
```typescript
// File: index.ts

const { adaptLLMParams } = await import('./processor/utils/model-api-adapter.ts');

const adaptedParams = adaptLLMParams({
  model,
  messages: [...],
  temperature: 0.3,
  maxTokens: 24
});

const resp = await openai.chat.completions.create(adaptedParams);
```

---

## 🧪 Testing

### **Test 1: GPT-4o**
```bash
# Agent Settings → GPT-4o
# Send message
# Check Debug Modal → Main LLM Call
```
**Expected:** `max_completion_tokens: 1200` (not `max_tokens`)

---

### **Test 2: o1-preview**
```bash
# Agent Settings → o1-preview
# Send message
# Check Debug Modal → Main LLM Call
```
**Expected:** 
- ✅ `max_completion_tokens: 1200`
- ❌ No `temperature`
- ❌ No `tools`
- ❌ No `response_format`

---

### **Test 3: Claude 3.5 Sonnet**
```bash
# Agent Settings → Claude 3.5 Sonnet
# Send message
# Check Debug Modal → Main LLM Call
```
**Expected:** `max_tokens: 1200` (old parameter)

---

## 🎯 Benefits

### **For Users:**
✅ **No more 400 errors** when using newer models  
✅ **Automatic compatibility** across all model families  
✅ **Transparent warnings** when parameters are stripped  

### **For Developers:**
✅ **Single source of truth** for model capabilities  
✅ **Future-proof** - easy to add new models  
✅ **Type-safe** - TypeScript interfaces enforce correctness  

### **For System:**
✅ **Universal compatibility** - works with OpenAI, Anthropic, Google  
✅ **Graceful degradation** - strips unsupported params instead of failing  
✅ **Clear logging** - always know what's happening  

---

## 🔮 Future Enhancements

1. **Automatic Model Detection from Response**
   - Detect new models from API responses
   - Automatically categorize based on error messages

2. **Per-Agent Model Rules**
   - Override default categorization per agent
   - Custom fallback chains

3. **Cost-Aware Fallbacks**
   - If reasoning model selected but tools needed
   - Choose cheapest tool-capable model

4. **Performance Monitoring**
   - Track which models are used most
   - Identify cost vs quality tradeoffs

---

## 📚 Related Files

- **Core Adapter:** `processor/utils/model-api-adapter.ts`
- **Model Resolver:** `processor/utils/model-resolver.ts`
- **LLM Caller:** `processor/handlers/llm-caller.ts`
- **Contextual Awareness:** `processor/utils/contextual-awareness.ts`
- **Intent Classifier:** `processor/utils/intent-classifier.ts`
- **Title Generation:** `index.ts`

---

**Implementation Complete** ✅  
All LLM calls now use the Model API Adapter for universal compatibility across GPT-4o, o1/o3 reasoning models, Claude, Gemini, and legacy GPT-4 models.

