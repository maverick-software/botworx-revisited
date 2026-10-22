### MessageAdapter (V1↔V2)

### What it is
A bidirectional converter between legacy V1 payloads and the V2 structured schema.

### Purpose
- Maintain backward compatibility
- Normalize inputs/outputs for a single processor path (V2)

### How it’s integrated
- Used in `index.ts` before/after `MessageProcessor`
- Relies on types in `types/*` and validations in `SchemaValidator.ts`

### How to interact
- `new MessageAdapter().v1ToV2(v1Request)` to up-convert
- `new MessageAdapter().v2ToV1Response(v2Response)` to down-convert

Defaults applied when up-converting:
- `options.memory.enabled=true`, `min_relevance=0.3`, `max_results=10`
- `options.state.save_checkpoint=false`, `include_shared=true`
- `options.response.include_metadata=true`, `include_metrics=true`, `stream` from v1 or false

### How to extend
- Add field mappings in both directions
- Update `SchemaValidator.ts` and `types/*` accordingly
- Keep text extraction resilient: prefer `data.message.content.text`

### Troubleshooting
- Missing `options.*` fields → adapter must set defaults
- Message text not appearing → ensure `v2Response.data.message.content.text` is used when present

### Files
- `supabase/functions/chat/adapters/message_adapter.ts`
- Used by Edge Function `supabase/functions/chat/index.ts`
