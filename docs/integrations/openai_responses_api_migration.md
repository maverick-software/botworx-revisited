# OpenAI Responses API Migration Guide

## Overview

Agentopia has been upgraded to use OpenAI's **Responses API** instead of the legacy Chat Completions API. This migration brings significant improvements in performance, cost efficiency, and capabilities.

## What Changed?

### API Endpoint
- **Old**: `/v1/chat/completions`
- **New**: `/v1/responses`

### Key Benefits

1. **Better Performance**: 3% improvement in intelligence benchmarks (SWE-bench) with GPT-5
2. **Lower Costs**: 40-80% improvement in cache utilization
3. **Agentic by Default**: Built-in multi-tool calling in a single request
4. **Native Tools**: Web search, file search, code interpreter, computer use, MCP servers
5. **Stateful Context**: Optional `previous_response_id` for chaining conversations
6. **Future-Proof**: Optimized for upcoming GPT models

### New GPT Models Supported

#### GPT-5 Series (Latest)
- `gpt-5-chat` - General purpose conversational model (200k context)
- `gpt-5` - Reasoning-focused flagship model (200k context)
- `gpt-5-mini` - Balanced general model (200k context)
- `gpt-5-nano` - Fast, efficient model (128k context)

#### GPT-4.1 Series
- `gpt-4.1` - Reasoning model (128k context)
- `gpt-4.1-mini` - Balanced model (128k context)
- `gpt-4.1-nano` - Fast model (128k context)

#### GPT-4o Series
- `gpt-4o` - General purpose (128k context)
- `gpt-4o-mini` - Fast variant (128k context)

## Technical Changes

### Message Format
**Before (Chat Completions)**:
```typescript
{
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ]
}
```

**After (Responses API)**:
```typescript
{
  model: "gpt-5",
  instructions: "You are a helpful assistant.",
  input: "Hello!"
}
```

### Response Format
**Before**:
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      }
    }
  ]
}
```

**After**:
```json
{
  "id": "resp_abc123",
  "output": [
    {
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": "Hello! How can I help you?"
        }
      ]
    }
  ]
}
```

### Function Calling
**Before (Externally-tagged)**:
```typescript
{
  type: "function",
  function: {
    name: "get_weather",
    description: "Get weather",
    parameters: { ... }
  }
}
```

**After (Internally-tagged)**:
```typescript
{
  type: "function",
  name: "get_weather",
  description: "Get weather",
  parameters: { ... },
  strict: true // Functions are strict by default
}
```

### Multi-Turn Conversations
**Before**:
```typescript
// Manual context management
let messages = [...previousMessages, newMessage];
const response = await chat(messages);
```

**After**:
```typescript
// Option 1: Manual context management (still supported)
let context = [...previousContext, newMessage];
const response = await chat(context);

// Option 2: Use previous_response_id (new, recommended)
const response = await chat(newMessage, {
  previousResponseId: previousResponse.id
});
```

## Implementation Details

### OpenAI Provider Updates

The `OpenAIProvider` class in `supabase/functions/shared/llm/openai_provider.ts` has been updated to:

1. **Use Responses API**: All requests now use `client.responses.create()` instead of `client.chat.completions.create()`

2. **Separate Instructions**: System messages are automatically extracted and passed as `instructions` parameter

3. **Parse Output Items**: Response parsing handles the new `output` array with typed items (message, function_call, reasoning)

4. **Support Response Chaining**: The `responseId` is now returned and can be used in subsequent requests via `previousResponseId`

5. **Update Function Format**: Tools are formatted using the internally-tagged structure with `strict: true` by default

6. **Improved Model Info**: Updated `modelInfo()` to return correct context sizes for GPT-5 (200k), GPT-4 (128k), and GPT-3.5 (16k)

### Interface Changes

New fields added to `interfaces.ts`:

```typescript
export interface LLMChatOptions {
  // ... existing fields
  previousResponseId?: string; // For multi-turn conversations
}

export interface LLMChatResponse {
  // ... existing fields
  responseId?: string; // Response ID for chaining
}
```

## Privacy & Data Retention

- **Storage Disabled by Default**: All requests use `store: false` to prevent OpenAI from storing conversation data
- **Zero Data Retention**: For organizations with ZDR requirements, this is enforced automatically
- **Encrypted Reasoning**: Reasoning items can be encrypted if needed for stateless workflows

## Backward Compatibility

The changes are **fully backward compatible**:
- Existing message arrays are still accepted
- The internal LLM abstraction layer handles the translation
- No changes required to agent configurations
- No database migrations needed

## Testing

All existing functionality has been tested and verified:
- ✅ Basic chat generation
- ✅ Function calling
- ✅ Multi-turn conversations
- ✅ Temperature and max_tokens parameters
- ✅ Model selection (GPT-5, GPT-4.1, GPT-4o)
- ✅ Embedding generation (unchanged)

## Troubleshooting

### Error: "responses is not a function"
**Solution**: Update OpenAI SDK to v4.28.0 or later.

### Error: "Unknown parameter: previous_response_id"
**Solution**: Ensure you're using the Responses API endpoint (`/v1/responses`), not Chat Completions.

### Function calls not working
**Check**: Ensure your function definitions use the new internally-tagged format (no nested `function` object).

### Context window exceeded
**Solution**: GPT-5 models support 200k context, GPT-4 models support 128k. Use the appropriate model for your use case.

## Migration Checklist

- [x] Update OpenAI provider to use Responses API
- [x] Update function calling format (internally-tagged)
- [x] Add support for `previousResponseId`
- [x] Update response parsing for output items
- [x] Add new GPT-5, GPT-4.1, and GPT-4o models
- [x] Update model context window detection
- [x] Deploy updated edge functions
- [ ] Monitor performance and cost improvements
- [ ] Collect user feedback on new models

## Next Steps

1. **Monitor Performance**: Track response times and quality improvements
2. **Cost Analysis**: Monitor token usage and caching benefits
3. **Explore Native Tools**: Consider integrating web_search, code_interpreter, etc.
4. **Update Documentation**: Inform users about new GPT-5 models
5. **Streaming Support**: Implement streaming for Responses API (future work)

## References

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/api-reference/responses)
- [Migration Guide](https://platform.openai.com/docs/guides/responses-api-migration)
- [Function Calling in Responses API](https://platform.openai.com/docs/guides/function-calling)
- [Model Context Windows](https://platform.openai.com/docs/models)

---

**Last Updated**: October 6, 2025
**Status**: ✅ Production Ready
**Next Review**: November 2025

