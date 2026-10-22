### Memory System

### What it is
Structured long-term knowledge storage: Episodic (events), Semantic (concepts/facts), Procedural, Working.

### Purpose
- Retain relevant knowledge across sessions
- Improve personalization and retrieval quality

### How it’s integrated
- `MemoryManager` orchestrates Pinecone/OpenAI + DB
- Context Engine can query memory during retrieval
- Optional Pinecone (runs without if no API key)

### How to interact
- Through `MemoryManager` APIs (read/write/search)
- Request-level memory controls in V2 `options.memory.*`

### How to extend
- Add new memory sources/providers in `core/memory/*`
- Add consolidation policies in `memory_consolidation.ts`
- Add DB functions (see migrations) for similarity or stats

### Troubleshooting
- Missing embeddings column names → ensure migrations use correct `embeddings`
- Pinecone missing → set `PINECONE_API_KEY` or run without vector search

### Files & Edge Functions
- `supabase/functions/chat/core/memory/memory_manager.ts`
- `supabase/functions/chat/core/memory/episodic_memory.ts`
- `supabase/functions/chat/core/memory/semantic_memory.ts`
- `supabase/functions/chat/core/memory/memory_consolidation.ts`
- DB migrations under `supabase/migrations/*` (agent_memories, functions)
- Edge entry: `supabase/functions/chat/index.ts`
