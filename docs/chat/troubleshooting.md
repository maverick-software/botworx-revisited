### Troubleshooting (System-wide)

- Validation errors → see `api.md`; ensure adapter defaults are applied
- Method/constructor mismatches → see `architecture.md` and `context_engine.md`
- Supabase client issues → confirm `ContextEngine` receives `supabase` instance
- Metrics export warnings → create `system_metrics` or ignore

### Troubleshooting by component
- API/Adapter: fields missing, bad conversions → update `message_adapter.md`
- Context Engine: null history, empty context → `context_engine.md`
- Memory: embeddings column mismatch, missing Pinecone → `memory_system.md`
- State: RLS/index mismatches → `state_management.md`
- Frontend: JSX/visibility/persistence → `frontend_integration.md`
