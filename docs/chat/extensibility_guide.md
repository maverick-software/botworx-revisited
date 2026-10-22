### Extensibility Guide

This guide explains how to add new message processors, message handlers, context retrieval sources, optimizers, compressors, structurers, and memory adapters to the Advanced JSON Chat System.

Use feature flags for gradual rollout and keep V1 compatibility via `adapters/message_adapter.ts`.

---

## 1) Add a new Processing Stage (Message Processor)

Files to know:
- `supabase/functions/chat/processor/MessageProcessor.ts` (pipeline + stages)

Steps:
1. Create a class implementing the stage interface:
   - Must provide: `name: string` and `process(message, context, metrics)`.
2. Import and insert it into the pipeline array in the constructor (before/after existing stages):
   - Typical order: Parsing → Validation → (YourStage) → Enrichment → MainProcessing → Response.
3. Update metrics (`metrics.stage_timings`, `stages`) and emit logs via `createLogger()` as needed.
4. Optional: gate with a feature flag from `adapters/feature_flags.ts`.

Testing:
- Unit test the stage with mock `message/context`.
- Deploy and confirm stage shows in `processing_details.pipeline_stages`.

---

## 2) Add a new Message Handler

Files to know:
- `supabase/functions/chat/processor/MessageProcessor.ts` (handlers map + `MainProcessingStage`)

Steps:
1. Implement interface:
```
interface MessageHandler {
  canHandle(message: AdvancedChatMessage): boolean;
  handle(message: AdvancedChatMessage, context: ProcessingContext): Promise<ProcessedMessage>;
}
```
2. Create a handler class (e.g., `ImageMessageHandler`) and implement `canHandle` + `handle`.
3. Register it in the handlers map in the `MessageProcessor` constructor:
```
this.handlers = new Map([
  ['text', new TextMessageHandler(openai, supabase)],
  ['structured', new StructuredMessageHandler()],
  ['image', new ImageMessageHandler(/* deps */)],
  ['tool_call', new ToolCallHandler()],
]);
```
4. If it calls an external provider, add configuration to `configuration.md` and thread credentials via constructor.

Testing:
- Post a message with your content type and verify the handler executes and metrics are populated.

---

## 3) Add a new Retrieval Source (Context Engine)

Files to know:
- `supabase/functions/chat/core/context/context_retriever.ts`
- `supabase/functions/chat/core/context/context_engine.ts`

Steps:
1. In `context_retriever.ts`, implement a method that produces `ContextCandidate[]` from your source.
2. Add an enum value to `ContextSource` and include your source in `retrieveAll()` (guard with `excluded_sources`).
3. Ensure token estimates (`estimateTokens`) and relevance scores are set.
4. In `context_engine.ts`, your candidates will flow through optimization/compression/structuring automatically.

Testing:
- Add a request with `required_sources` to force inclusion, then inspect `processing_details.context_operations.retrieval_sources`.

---

## 4) Add a new Optimizer (Context Engine)

Files to know:
- `supabase/functions/chat/core/context/context_optimizer.ts`

Steps:
1. Implement an optimization strategy function (e.g., priority re-weighting, diversity constraints).
2. Expose a configuration knob (e.g., `optimization_goals`) in the `ContextBuildRequest` if needed.
3. Integrate it into the optimizer pipeline.

Testing:
- Compare `sources_used`, `quality_score`, and `budget_utilization` before/after.

---

## 5) Add a new Compressor (Context Engine)

Files to know:
- `supabase/functions/chat/core/context/context_compressor.ts`

Steps:
1. Implement a compression method (e.g., map-reduce summaries, sentence trimming, structured bulleting).
2. Honor `token_budget` and record `compression_applied`.

Testing:
- Verify `compression_applied=true` and `total_tokens` reduction in `OptimizedContext`.

---

## 6) Add a new Structurer (Context Engine)

Files to know:
- `supabase/functions/chat/core/context/context_structurer.ts`

Steps:
1. Implement a new `StructureType` or structuring function to reformat context for a given provider.
2. Integrate via a switch or strategy injection to build the `ContextWindow`.

Testing:
- Confirm the final `context_window` content and token counts meet expectations.

---

## 7) Add a new Memory Adapter/Provider

Files to know:
- `supabase/functions/chat/core/memory/*`
- DB migrations in `supabase/migrations/*` (for new tables/indexes)

Steps:
1. Extend `MemoryManager` to register a provider (e.g., new vector DB, KG, or cache layer).
2. Implement read/write/search APIs consistent with manager expectations.
3. Update `types/memory.types.ts` if adding new memory categories, and ensure validation covers them.
4. Add configuration in `configuration.md` and read creds in the constructor.

Testing:
- Run queries through the Context Engine (set `options.memory.enabled=true`) and verify hits appear in `processing_details.memory_operations`.

---

## 8) Validation, Flags, and Telemetry Checklist

- Validation: add Zod schema fields in `validation/SchemaValidator.ts` for new options.
- Feature Flags: gate new behavior in `adapters/feature_flags.ts`.
- Adapter Defaults: ensure `adapters/message_adapter.ts` populates sensible defaults for V1.
- Metrics: record `stage_timings`, `tokens`, and custom fields in `ProcessingMetrics`.
- Logs: use `createLogger({ request_id })` for traceability.

---

## 9) Troubleshooting

- Stage not running: ensure it’s inserted in the pipeline in `MessageProcessor`.
- Handler not selected: check `canHandle()` and content type.
- Retrieval source missing: verify `excluded_sources`/`required_sources` and that your enum is wired in `retrieveAll()`.
- Compression/structuring ineffective: check token budget and structure type selection.
- Memory adapter silent: confirm credentials and provider initialization; add debug logs and unit tests.

---

## 10) Related Files & Edge Function

- Edge Function entry: `supabase/functions/chat/index.ts`
- Processor & stages/handlers: `supabase/functions/chat/processor/MessageProcessor.ts`
- Context Engine: `supabase/functions/chat/core/context/*`
- Memory system: `supabase/functions/chat/core/memory/*`
- State system: `supabase/functions/chat/core/state/*`
- Adapters: `supabase/functions/chat/adapters/*`
- Validation: `supabase/functions/chat/validation/SchemaValidator.ts`
- Types: `supabase/functions/chat/types/*`
