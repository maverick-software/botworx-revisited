# Claude Integration Deployment Checklist

**Date**: October 6, 2025  
**Status**: Ready for Deployment  
**Estimated Time**: 15-30 minutes

## Pre-Deployment Checklist

### ✅ Files Created/Modified

- [x] `supabase/functions/shared/llm/anthropic_provider.ts` - New provider implementation
- [x] `supabase/functions/shared/llm/router.ts` - Updated with Anthropic support
- [x] `src/lib/llm/modelRegistry.ts` - Added Claude models to frontend
- [x] `docs/integrations/claude_integration_guide.md` - Comprehensive guide
- [x] `database/helpers/configure_claude_agent.sql` - Helper SQL scripts

### ✅ Requirements Met

- [x] Implements `LLMProvider` interface
- [x] Handles tool calling correctly
- [x] Normalizes message formats (system messages separate)
- [x] Includes error handling and fallbacks
- [x] Documents all models (Claude 3, 3.5, 4)
- [x] Provides configuration examples

## Deployment Steps

### Step 1: Get Anthropic API Key

```bash
# Visit https://console.anthropic.com/
# Create an API key
# Copy the key (starts with sk-ant-)
```

**Time**: 2-3 minutes

### Step 2: Set Supabase Secrets

```powershell
# Navigate to project directory
cd C:\Users\charl\Software\Agentopia

# Set Anthropic API key
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

# Ensure LLM Router is enabled
supabase secrets set USE_LLM_ROUTER=true

# Verify secrets
supabase secrets list
```

**Expected Output**:
```
ANTHROPIC_API_KEY (secret)
USE_LLM_ROUTER (secret)
OPENAI_API_KEY (secret)
... (other secrets)
```

**Time**: 2 minutes

### Step 3: Deploy Updated Edge Functions

```powershell
# Deploy the chat function with Claude support
supabase functions deploy chat

# Optional: Deploy all functions
# supabase functions deploy
```

**Expected Output**:
```
Deploying function chat...
✓ Function deployed successfully
```

**Time**: 2-5 minutes

### Step 4: Configure Test Agent

Option A - Using Supabase SQL Editor:

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Run this query (replace `YOUR_AGENT_UUID`):

```sql
-- Get your agent ID first
SELECT id, name FROM agents WHERE user_id = auth.uid();

-- Configure agent to use Claude
INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
VALUES (
  'YOUR_AGENT_UUID_HERE',
  'anthropic',
  'claude-3-5-sonnet-20241022',
  '{"temperature": 0.7, "maxTokens": 4096}',
  'text-embedding-3-small'
)
ON CONFLICT (agent_id) 
DO UPDATE SET
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  params = EXCLUDED.params,
  embedding_model = EXCLUDED.embedding_model;
```

Option B - Using helper script:

```powershell
# Edit the SQL file with your agent ID
notepad database/helpers/configure_claude_agent.sql

# Then run via Supabase Dashboard SQL Editor
```

**Time**: 3-5 minutes

### Step 5: Test Integration

#### Test 1: Basic Chat
1. Open agent chat interface in browser
2. Send message: "Hello! Can you tell me which AI model you are?"
3. ✅ Should respond as Claude

#### Test 2: Reasoning Test
Send:
```
Analyze the pros and cons of remote work vs office work.
Provide a structured comparison.
```
✅ Should provide detailed, well-structured analysis

#### Test 3: Tool Calling (if agent has tools)
Send:
```
Search my contacts for anyone named "John"
```
✅ Should invoke the search_contacts tool correctly

**Time**: 5-10 minutes

## Verification

### Check 1: View Function Logs

```powershell
supabase functions logs chat --follow
```

Look for:
- `[LLMRouter] Loading preferences for agent...`
- `[AnthropicProvider] Chat request...`
- No error messages

### Check 2: Verify Database

```sql
SELECT 
  a.name,
  alp.provider,
  alp.model,
  alp.params
FROM agent_llm_preferences alp
JOIN agents a ON a.id = alp.agent_id
WHERE a.user_id = auth.uid();
```

Should show `anthropic` as provider.

### Check 3: Monitor Usage

Check Anthropic Console for API usage:
https://console.anthropic.com/settings/usage

## Rollback Plan (If Needed)

If something goes wrong, you can quickly revert:

### Option 1: Switch Agent Back to OpenAI

```sql
UPDATE agent_llm_preferences
SET 
  provider = 'openai',
  model = 'gpt-4o-mini'
WHERE agent_id = 'YOUR_AGENT_UUID';
```

### Option 2: Delete Preferences (Use System Defaults)

```sql
DELETE FROM agent_llm_preferences
WHERE agent_id = 'YOUR_AGENT_UUID';
```

### Option 3: Disable LLM Router

```powershell
supabase secrets set USE_LLM_ROUTER=false
supabase functions deploy chat
```

## Post-Deployment

### Monitor for 24-48 Hours

- [ ] Check error rates in function logs
- [ ] Monitor response times
- [ ] Track API costs in Anthropic Console
- [ ] Collect user feedback on Claude vs OpenAI

### Cost Comparison

Track costs for similar conversations:
- OpenAI GPT-4o-mini: ~$0.15 per 1M input tokens
- Claude 3.5 Sonnet: ~$3.00 per 1M input tokens
- Claude 3.5 Haiku: ~$0.80 per 1M input tokens

### Optimization

After initial testing:

1. **Adjust Models Per Agent**:
   - Use Haiku for simple chat agents
   - Use Sonnet for complex reasoning agents
   - Use Opus only when maximum capability needed

2. **Tune Parameters**:
   - Lower temperature for factual responses
   - Higher temperature for creative tasks
   - Adjust maxTokens based on needs

3. **Monitor Context Window Usage**:
   - Claude has 200k tokens - track usage
   - Implement context trimming if needed

## Success Criteria

✅ All tests pass  
✅ No error spikes in logs  
✅ Response quality meets expectations  
✅ Costs are within budget  
✅ No performance degradation  

## Troubleshooting

### Issue: "ANTHROPIC_API_KEY not set"

**Fix**:
```powershell
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
supabase functions deploy chat
```

### Issue: Agent still using OpenAI

**Fix**:
1. Check `USE_LLM_ROUTER=true`
2. Verify agent preferences in database
3. Clear browser cache
4. Check function logs

### Issue: "Anthropic does not provide native embeddings"

**Expected**: This is normal behavior. Ensure:
```sql
SELECT embedding_model FROM agent_llm_preferences 
WHERE agent_id = 'YOUR_AGENT_UUID';
-- Should return: text-embedding-3-small
```

### Issue: Tool calls failing

**Debug**:
1. Check tool definitions are valid JSON schemas
2. Verify agent has tool permissions
3. Check function logs for tool call details
4. Test same tools with OpenAI to isolate issue

## Next Steps

1. **Gradual Rollout**:
   - Start with 1-2 test agents
   - Expand to 10-20% of agents
   - Monitor for 1 week
   - Full rollout if successful

2. **Documentation**:
   - Share integration guide with team
   - Update internal documentation
   - Create usage guidelines

3. **Optimization**:
   - Analyze which agents benefit most from Claude
   - Optimize model selection per use case
   - Implement cost controls if needed

## Support

- **Integration Guide**: `docs/integrations/claude_integration_guide.md`
- **SQL Helpers**: `database/helpers/configure_claude_agent.sql`
- **Anthropic Docs**: https://docs.anthropic.com/
- **Support**: https://console.anthropic.com/support

---

**Deployment Status**: ⏳ Ready to Deploy  
**Risk Level**: Low (has fallback to OpenAI)  
**Estimated ROI**: High (better reasoning, larger context)

