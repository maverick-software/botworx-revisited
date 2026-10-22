### Configuration

### What it is
Run-time configuration for Edge Function, providers, and feature flags.

### Purpose
- Enable/disable capabilities and set credentials

### How it’s integrated
- Read via `Deno.env.get` in `index.ts` and modules
- Feature flags in `adapters/feature_flags.ts`

### How to interact
- Set env vars in Supabase dashboard:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - `OPENAI_API_KEY`
  - `PINECONE_API_KEY` (optional)
  - Any feature flags (e.g., `FEATURE_ADV_JSON=true`)

### How to extend
- Add new flags in `adapters/feature_flags.ts`
- Add provider configs in service constructors

### Troubleshooting
- Pinecone errors → unset key to run without or set valid index
- Missing auth tokens → ensure `getSession()` returns a token on frontend

### Files & Edge Functions
- `supabase/functions/chat/index.ts`
- `supabase/functions/chat/adapters/feature_flags.ts`
