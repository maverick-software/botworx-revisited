### API (V1 and V2)

### What it is
A versioned HTTP interface for the chat Edge Function supporting legacy (V1) and structured (V2) requests.

### Purpose
- Keep old clients working (V1)
- Provide robust, validated JSON contracts (V2)
- Support streaming and rich options (memory/state/tools/context)

### How it’s integrated
- Endpoint: `POST /functions/v1/chat`
- Version detection: `APIVersionRouter.detectVersion(req)` in `index.ts`
- Validation: `validation/SchemaValidator.ts` (Zod)
- Adaptation: `adapters/message_adapter.ts`
 - Auth forwarding: The handler extracts `Authorization: Bearer <JWT>` and injects it into `body.options.auth.token` so downstream tool execution can call provider Edge Functions with user auth.

### How to interact
- V1 client: send `{ agentId, message }` → adapter creates V2
- V2 client: send full schema with `version: "2.0.0"`

V2 Request (minimal valid example):
```
{
  "version": "2.0.0",
  "message": { "role": "user", "content": {"type":"text","text":"Hello"} },
  "options": {
    "response": { "stream": false, "include_metadata": true, "include_metrics": true },
    "memory": { "enabled": true, "types": ["episodic","semantic"], "max_results": 10, "min_relevance": 0.3 },
    "state": { "save_checkpoint": false, "include_shared": true }
  }
}
```

Response (V2):
```
{
  "version":"2.0.0",
  "status":"success",
  "data": { "message": { ... } },
  "metrics": { tokens: { prompt, completion, total }, model: "gpt-4" },
  "processing_details": { ... }
}
```

V1 Response (adapter):
```
{ "message": "...", "agent": {"id":"..."}, "metrics": { ... }, "processing_details": { ... } }
```

### How to extend
- Add new fields to V2: update `types/*`, `SchemaValidator.ts`, and adapter conversions
- Add new streaming modes: extend `index.ts` SSE handler

### Troubleshooting
- `Validation failed...` → ensure `options.memory.enabled`, `options.state.save_checkpoint`, `options.response.include_metrics` exist (adapter sets defaults for V1)
- Streaming fails → check `Accept: text/event-stream` and `options.response.stream=true`

### Files & Edge Functions
- Function: `supabase/functions/chat/index.ts`
- Validation: `supabase/functions/chat/validation/SchemaValidator.ts`
- Adapter: `supabase/functions/chat/adapters/message_adapter.ts`
