### Advanced JSON Chat System Documentation

This directory documents Agentopia’s Advanced JSON-based chat system.

### What it is
A modular, versioned, JSON-first conversational system running as a Supabase Edge Function with rich context, memory, state, tools, metrics, and backward compatibility.

### Purpose
- Provide a robust, extensible chat pipeline
- Maintain V1 compatibility while adopting V2 structured messages
- Enable deep introspection via `processing_details` and metrics

### How it’s integrated
- Backend: Supabase Edge Function at `supabase/functions/chat/index.ts`
- Core processor: `processor/MessageProcessor.ts` orchestrates stages
- Adapters: `adapters/*` handle V1↔V2, feature flags, rollback
- Context/Memory/State cores under `core/*`
- Frontend: `src/pages/AgentChatPage.tsx` calls the function and renders messages/thoughts/process modal

### How to interact
- Call `POST {SUPABASE_URL}/functions/v1/chat` with either V1 or V2 shape
- Inspect `processing_details` in the response (enable `options.response.include_metrics` in V2)
- On the frontend, store `processing_details` and use `ProcessModal` to visualize

### How to extend
- Add a stage/handler in `MessageProcessor`
- Add new context sources via `core/context/context_retriever.ts`
- Add memory providers in `core/memory/*`
- Add state backends or policies in `core/state/*`
- Add new adapter fields by updating `types/*`, `validation/SchemaValidator.ts`, and `adapters/message_adapter.ts`

### Troubleshooting (high-level)
- Validation errors → see `docs/chat/api.md` and ensure required fields exist
- Missing methods/clients → see `docs/chat/context_engine.md` and `docs/chat/architecture.md`
- Messages vanish → ensure assistant rows persist (see `frontend_integration.md`)

### Related files & Edge Functions
- Edge Function: `supabase/functions/chat/index.ts`
- Core: `supabase/functions/chat/processor/MessageProcessor.ts`
- Adapters: `supabase/functions/chat/adapters/*`
- Context/Memory/State: `supabase/functions/chat/core/*`
- Types/Validation: `supabase/functions/chat/types/*`, `validation/SchemaValidator.ts`

See detailed guides:
- `architecture.md`
- `api.md`
- `message_adapter.md`
- `context_engine.md`
- `memory_system.md`
- `state_management.md`
- `monitoring_metrics.md`
- `configuration.md`
- `frontend_integration.md`
- `troubleshooting.md`
