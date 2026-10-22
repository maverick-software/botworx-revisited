-- Helper Script: Configure Agent to Use Claude (Anthropic)
-- Date: October 6, 2025
-- Purpose: Quick setup for agents to use Claude models

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================
-- 1. Replace 'YOUR_AGENT_UUID_HERE' with your actual agent ID
-- 2. Choose your preferred Claude model (see options below)
-- 3. Run the script in Supabase SQL Editor or via psql
-- =============================================================================

-- =============================================================================
-- STEP 1: Find Your Agent ID (If you don't know it)
-- =============================================================================

-- List all your agents
SELECT 
  id,
  name,
  user_id,
  created_at
FROM agents
WHERE user_id = auth.uid()  -- Only your agents
ORDER BY name;

-- =============================================================================
-- STEP 2: Configure Agent to Use Claude
-- =============================================================================

-- OPTION 1: Claude 3.5 Sonnet (RECOMMENDED - Best Balance)
INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
VALUES (
  'YOUR_AGENT_UUID_HERE',  -- Replace with your agent ID
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
  embedding_model = EXCLUDED.embedding_model,
  updated_at = now();

-- OPTION 2: Claude 3.5 Haiku (FASTEST - For Quick Responses)
-- INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
-- VALUES (
--   'YOUR_AGENT_UUID_HERE',
--   'anthropic',
--   'claude-3-5-haiku-20241022',
--   '{"temperature": 0.7, "maxTokens": 4096}',
--   'text-embedding-3-small'
-- )
-- ON CONFLICT (agent_id) 
-- DO UPDATE SET
--   provider = EXCLUDED.provider,
--   model = EXCLUDED.model,
--   params = EXCLUDED.params,
--   embedding_model = EXCLUDED.embedding_model,
--   updated_at = now();

-- OPTION 3: Claude 3 Opus (MOST POWERFUL - For Complex Tasks)
-- INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
-- VALUES (
--   'YOUR_AGENT_UUID_HERE',
--   'anthropic',
--   'claude-3-opus-20240229',
--   '{"temperature": 0.7, "maxTokens": 4096}',
--   'text-embedding-3-small'
-- )
-- ON CONFLICT (agent_id) 
-- DO UPDATE SET
--   provider = EXCLUDED.provider,
--   model = EXCLUDED.model,
--   params = EXCLUDED.params,
--   embedding_model = EXCLUDED.embedding_model,
--   updated_at = now();

-- OPTION 4: Claude Sonnet 4.5 (LATEST - If Available)
-- INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
-- VALUES (
--   'YOUR_AGENT_UUID_HERE',
--   'anthropic',
--   'claude-sonnet-4-5',
--   '{"temperature": 0.7, "maxTokens": 4096}',
--   'text-embedding-3-small'
-- )
-- ON CONFLICT (agent_id) 
-- DO UPDATE SET
--   provider = EXCLUDED.provider,
--   model = EXCLUDED.model,
--   params = EXCLUDED.params,
--   embedding_model = EXCLUDED.embedding_model,
--   updated_at = now();

-- =============================================================================
-- STEP 3: Verify Configuration
-- =============================================================================

SELECT 
  a.name as agent_name,
  alp.provider,
  alp.model,
  alp.params,
  alp.embedding_model,
  alp.updated_at
FROM agent_llm_preferences alp
JOIN agents a ON a.id = alp.agent_id
WHERE a.user_id = auth.uid()
ORDER BY a.name;

-- =============================================================================
-- ADVANCED: Bulk Update All Agents to Use Claude
-- =============================================================================

-- Update all your agents to use Claude 3.5 Sonnet
-- CAUTION: This affects ALL your agents!

-- INSERT INTO agent_llm_preferences (agent_id, provider, model, params, embedding_model)
-- SELECT 
--   id,
--   'anthropic',
--   'claude-3-5-sonnet-20241022',
--   '{"temperature": 0.7, "maxTokens": 4096}',
--   'text-embedding-3-small'
-- FROM agents
-- WHERE user_id = auth.uid()
-- ON CONFLICT (agent_id) 
-- DO UPDATE SET
--   provider = EXCLUDED.provider,
--   model = EXCLUDED.model,
--   params = EXCLUDED.params,
--   embedding_model = EXCLUDED.embedding_model,
--   updated_at = now();

-- =============================================================================
-- HELPER: Switch Model for Existing Configuration
-- =============================================================================

-- Switch to faster model (Haiku)
-- UPDATE agent_llm_preferences
-- SET model = 'claude-3-5-haiku-20241022', updated_at = now()
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- Switch to more powerful model (Opus)
-- UPDATE agent_llm_preferences
-- SET model = 'claude-3-opus-20240229', updated_at = now()
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- =============================================================================
-- HELPER: Adjust Parameters
-- =============================================================================

-- Increase creativity (higher temperature)
-- UPDATE agent_llm_preferences
-- SET params = '{"temperature": 0.9, "maxTokens": 4096}', updated_at = now()
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- More deterministic responses (lower temperature)
-- UPDATE agent_llm_preferences
-- SET params = '{"temperature": 0.3, "maxTokens": 4096}', updated_at = now()
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- Longer responses
-- UPDATE agent_llm_preferences
-- SET params = '{"temperature": 0.7, "maxTokens": 8192}', updated_at = now()
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- =============================================================================
-- HELPER: Switch Back to OpenAI
-- =============================================================================

-- If you want to switch an agent back to OpenAI
-- UPDATE agent_llm_preferences
-- SET 
--   provider = 'openai',
--   model = 'gpt-4o-mini',
--   params = '{"temperature": 0.7, "maxTokens": 4096}',
--   updated_at = now()
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- Or delete the preferences to use system defaults
-- DELETE FROM agent_llm_preferences
-- WHERE agent_id = 'YOUR_AGENT_UUID_HERE';

-- =============================================================================
-- TROUBLESHOOTING: Check if LLM Router is Enabled
-- =============================================================================

-- The LLM Router must be enabled for Claude to work
-- Check Supabase secrets for: USE_LLM_ROUTER=true
-- Run this in your terminal:
-- supabase secrets list

-- =============================================================================
-- MODEL RECOMMENDATIONS
-- =============================================================================

/*
CLAUDE 3.5 SONNET (claude-3-5-sonnet-20241022) - RECOMMENDED
- Best balance of capability and cost
- Excellent reasoning and analysis
- Great for general purpose use
- Context: 200k tokens
- Speed: Medium
- Cost: Medium

CLAUDE 3.5 HAIKU (claude-3-5-haiku-20241022) - FASTEST
- Quick responses
- Economical
- Good for simple tasks
- Context: 200k tokens
- Speed: Fast
- Cost: Low

CLAUDE 3 OPUS (claude-3-opus-20240229) - MOST POWERFUL
- Maximum capability
- Best for complex reasoning
- Use when you need the best results
- Context: 200k tokens
- Speed: Slower
- Cost: High

CLAUDE SONNET 4.5 (claude-sonnet-4-5) - LATEST
- Newest model (if available)
- Cutting-edge capabilities
- May not be available to all users yet
- Context: 200k tokens
- Speed: Medium
- Cost: TBD
*/

-- =============================================================================
-- NOTES
-- =============================================================================

/*
1. Changes take effect immediately - no deployment needed!
2. Anthropic does not provide embeddings - we use OpenAI's text-embedding-3-small
3. All Claude models have 200k token context windows
4. Temperature range: 0.0 (deterministic) to 1.0 (creative)
5. Max tokens default: 4096 (can go higher if needed)
6. You need an Anthropic API key set in Supabase secrets:
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
*/

