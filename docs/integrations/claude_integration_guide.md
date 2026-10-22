# Claude (Anthropic) Integration Guide

**Date**: October 6, 2025  
**Status**: ✅ Production Ready  
**Provider**: Anthropic  
**Documentation**: https://docs.anthropic.com/en/api/overview

## Overview

Agentopia now supports Anthropic's Claude models through the LLM Router system. This integration provides access to Claude's advanced reasoning capabilities, large context windows (200k tokens), and sophisticated tool-calling features.

## Available Models

### Claude 4 Series (Latest)
- **claude-sonnet-4-5**: Most advanced reasoning model
- **claude-opus-4**: Highest capability model for complex tasks
- **claude-sonnet-4**: Balanced performance and capability

### Claude 3.5 Series (Latest Stable - Recommended)
- **claude-3-5-sonnet-20241022**: Advanced reasoning and analysis (October 2024)
- **claude-3-5-haiku-20241022**: Fast, efficient responses (October 2024)

### Claude 3 Series (Original)
- **claude-3-opus-20240229**: Powerful reasoning (February 2024)
- **claude-3-sonnet-20240229**: Balanced performance (February 2024)
- **claude-3-haiku-20240307**: Fast and economical (March 2024)

## Key Features

### ✅ Supported
- **200k Context Window**: All Claude 3+ models support 200,000 tokens
- **Tool Calling**: Full function/tool calling support
- **Advanced Reasoning**: Superior reasoning capabilities
- **Long-form Content**: Excellent for analysis, writing, and complex tasks
- **Multilingual**: Strong performance across languages

### ⏳ Coming Soon
- **Streaming**: Server-Sent Events streaming support
- **Vision**: Image analysis capabilities
- **Token Counting**: Native token counting via API

## Setup Instructions

### Step 1: Get Anthropic API Key

1. Visit https://console.anthropic.com/
2. Sign up or log in to your account
3. Navigate to **Account Settings** → **API Keys**
4. Click **Create Key**
5. Copy your API key (starts with `sk-ant-`)

### Step 2: Add API Key to Supabase Secrets

Using PowerShell (Windows):

```powershell
# Navigate to your project directory
cd C:\Users\charl\Software\Agentopia

# Set the Anthropic API key
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Verify the secret was set:

```powershell
supabase secrets list
```

### Step 3: Enable LLM Router (If Not Already Enabled)

```powershell
supabase secrets set USE_LLM_ROUTER=true
```

### Step 4: Deploy Updated Functions

Deploy the chat function with the new Claude support:

```powershell
supabase functions deploy chat
```

### Step 5: Configure Agent to Use Claude

You have two options:

#### Option A: SQL Direct Update

```sql
-- Insert Claude preferences for an agent
INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
VALUES (
  'your-agent-uuid-here',
  'anthropic',
  'claude-3-5-sonnet-20241022',
  '{"temperature": 0.7, "maxTokens": 4096}',
  'text-embedding-3-small'  -- OpenAI for embeddings since Claude doesn't provide them
)
ON CONFLICT (agent_id) 
DO UPDATE SET
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  params = EXCLUDED.params,
  embedding_model = EXCLUDED.embedding_model;
```

#### Option B: Via UI (If Model Selector Implemented)

Navigate to Agent Settings → General Tab → Model Configuration and select:
- **Provider**: Anthropic
- **Model**: Claude 3.5 Sonnet (Oct 2024)
- **Temperature**: 0.7
- **Max Tokens**: 4096

## Testing the Integration

### Test 1: Simple Chat

1. Open the agent chat interface
2. Send a message: "Hello! Can you confirm you're Claude?"
3. Claude should respond identifying itself

### Test 2: Complex Reasoning

```
Analyze the following scenario and provide a structured response:
A company has 3 options for expansion. Help me evaluate them systematically.
```

Claude excels at structured analysis and reasoning.

### Test 3: Tool Calling

If your agent has tools configured:

```
Search my emails for messages about "project deadline" from the last week.
```

Claude should properly invoke the tool with correct parameters.

## Model Recommendations

### For Different Use Cases

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| **Complex Analysis** | claude-3-5-sonnet-20241022 | Best reasoning capabilities |
| **General Chat** | claude-3-5-sonnet-20241022 | Balanced performance |
| **Fast Responses** | claude-3-5-haiku-20241022 | Quick, economical |
| **Maximum Capability** | claude-opus-4 | Most powerful (if available) |
| **Creative Writing** | claude-3-5-sonnet-20241022 | Excellent prose |
| **Code Analysis** | claude-3-5-sonnet-20241022 | Strong technical understanding |

### Context Window Usage

All Claude models have 200k token context windows. Use this for:
- Long document analysis
- Extensive conversation history
- Multi-file code reviews
- Complex research tasks

## Configuration Parameters

### Recommended Settings

```json
{
  "temperature": 0.7,     // 0.0-1.0, higher = more creative
  "maxTokens": 4096,      // Max output tokens (default: 4096)
  "topP": 0.9            // Optional: nucleus sampling (0.0-1.0)
}
```

### Temperature Guidelines

- **0.0-0.3**: Factual, deterministic responses (coding, analysis)
- **0.4-0.7**: Balanced creativity and accuracy (general chat)
- **0.8-1.0**: Highly creative (writing, brainstorming)

## Embeddings Note

**Important**: Anthropic does not provide embedding models. When using Claude models, you must specify an OpenAI embedding model for vector search and memory functions.

Default fallback: `text-embedding-3-small` (OpenAI)

## Pricing Considerations

As of October 2024, Claude pricing (approximate):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3.5 Haiku | $0.80 | $4.00 |
| Claude 3 Opus | $15.00 | $75.00 |
| Claude 3 Sonnet | $3.00 | $15.00 |
| Claude 3 Haiku | $0.25 | $1.25 |

Visit https://www.anthropic.com/pricing for current pricing.

## Technical Implementation Details

### Architecture

The Claude integration uses:

1. **AnthropicProvider** (`supabase/functions/shared/llm/anthropic_provider.ts`)
   - Implements `LLMProvider` interface
   - Handles API communication
   - Normalizes responses to standard format

2. **LLMRouter** (`supabase/functions/shared/llm/router.ts`)
   - Routes requests based on agent preferences
   - Loads provider-specific configuration
   - Handles fallbacks

3. **Database** (`agent_llm_preferences` table)
   - Stores per-agent model selection
   - Maintains configuration parameters
   - Supports hot-swapping models

### Key Differences from OpenAI

1. **System Messages**: Claude uses a separate `system` parameter instead of system messages in the conversation
2. **Tool Format**: Uses `tool_use` content blocks instead of `tool_calls` array
3. **API Headers**: Requires `anthropic-version` header (currently `2023-06-01`)
4. **Response Structure**: Different JSON structure requiring normalization

### Error Handling

The provider includes comprehensive error handling:

```typescript
- API errors: Logged and thrown with context
- Missing API key: Falls back to OpenAI
- Invalid responses: Detailed error messages
- Network issues: Standard HTTP error handling
```

## Troubleshooting

### Issue: "Anthropic API Key not set"

**Solution**: Ensure `ANTHROPIC_API_KEY` is set in Supabase secrets:
```powershell
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
supabase functions deploy chat
```

### Issue: Agent Still Using OpenAI

**Cause**: Agent preferences not updated or LLM Router not enabled

**Solution**:
1. Check `USE_LLM_ROUTER=true` is set
2. Verify agent preferences in database:
```sql
SELECT * FROM agent_llm_preferences WHERE agent_id = 'your-agent-id';
```
3. Update if needed using SQL from Step 5

### Issue: "Anthropic does not provide native embeddings"

**Expected Behavior**: This is normal. Specify an OpenAI embedding model:
```sql
UPDATE agent_llm_preferences 
SET embedding_model = 'text-embedding-3-small'
WHERE agent_id = 'your-agent-id';
```

### Issue: Tool Calls Not Working

**Check**:
1. Agent has appropriate tool permissions
2. Tool definitions are valid JSON schemas
3. Claude model supports tools (all Claude 3+ do)
4. Check function logs for tool call details

## Advanced Configuration

### Per-Agent Custom Parameters

```sql
UPDATE agent_llm_preferences 
SET params = '{
  "temperature": 0.5,
  "maxTokens": 8192,
  "topP": 0.95
}'
WHERE agent_id = 'your-agent-id';
```

### Switch Between Models Dynamically

```sql
-- Switch to faster model for quick responses
UPDATE agent_llm_preferences 
SET model = 'claude-3-5-haiku-20241022'
WHERE agent_id = 'your-agent-id';

-- Switch to most powerful model for complex tasks
UPDATE agent_llm_preferences 
SET model = 'claude-3-5-sonnet-20241022'
WHERE agent_id = 'your-agent-id';
```

Changes take effect immediately—no deployment needed!

## Monitoring & Logs

Check Edge Function logs for Claude-specific messages:

```powershell
# View logs in real-time
supabase functions logs chat --follow
```

Look for:
- `[AnthropicProvider]` prefixed messages
- `[LLMRouter]` provider selection logs
- Token usage statistics
- Error details

## Best Practices

1. **Start with Claude 3.5 Sonnet**: Best balance of capability and cost
2. **Use Haiku for Speed**: When response time matters more than depth
3. **Monitor Token Usage**: 200k context can be expensive
4. **Test Tool Calling**: Verify tools work correctly before production
5. **Keep OpenAI for Embeddings**: Use OpenAI's embedding models
6. **Configure Temperature**: Adjust based on use case
7. **Set Reasonable Max Tokens**: Default 4096 is usually sufficient

## Next Steps

1. ✅ Test with a single agent
2. ✅ Monitor performance and costs
3. ✅ Gradually migrate agents to Claude
4. ✅ Compare results with OpenAI
5. ✅ Optimize parameters per agent

## Support & Resources

- **Anthropic Documentation**: https://docs.anthropic.com/
- **API Reference**: https://docs.anthropic.com/en/api/messages
- **Model Capabilities**: https://docs.anthropic.com/en/docs/models-overview
- **Pricing**: https://www.anthropic.com/pricing
- **Console**: https://console.anthropic.com/

## Version History

- **October 6, 2025**: Initial Claude integration
  - Added Claude 3.5 Sonnet, Claude 3.5 Haiku
  - Added Claude 3 series (Opus, Sonnet, Haiku)
  - Added Claude 4 series placeholders
  - Implemented AnthropicProvider with tool calling
  - Updated LLMRouter with fallback logic
  - Added model registry entries

---

**Status**: ✅ Ready for Production Use  
**Tested**: Chat, Tool Calling, Error Handling  
**Pending**: Streaming support, Vision support

