### Context Engine

### What it is
A pipeline that retrieves, prioritizes, compresses, and structures context for LLM calls.

### Purpose
- Fit the best information within token budget
- Improve response quality and reduce context rot

### How it’s integrated
- `EnrichmentStage` in `MessageProcessor` calls `ContextEngine.buildContext()`
- `ContextRetriever` pulls candidates (conversation history, memories, knowledge)
- `ContextOptimizer/Compressor/Structurer` process candidates

### How to interact
- Call `buildContext({ query, conversation_context, token_budget, required_sources, excluded_sources })`
- Inspect `OptimizedContext` → `context_window`, `total_tokens`, `sources_used`, `quality_score`

### How to extend
- Add new retrieval sources in `context_retriever.ts`
- Add optimization goals/strategies in `context_optimizer.ts`
- Add compression techniques in `context_compressor.ts`
- Customize final layout in `context_structurer.ts`

### Troubleshooting
- `recent_messages.slice` error → ensure `recent_messages` is optional/array; null-safety added
- Empty context → verify `required_sources`/`excluded_sources` and token budgets

### Files & Edge Functions
- `supabase/functions/chat/core/context/context_engine.ts`
- `supabase/functions/chat/core/context/context_retriever.ts`
- `supabase/functions/chat/core/context/context_optimizer.ts`
- `supabase/functions/chat/core/context/context_compressor.ts`
- `supabase/functions/chat/core/context/context_structurer.ts`
- Edge Function entry: `supabase/functions/chat/index.ts`
