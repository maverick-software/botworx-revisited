### Architecture Overview

High-level flow:
1. Request → `index.ts` detects API version via `APIVersionRouter`.
2. If V1, convert using `MessageAdapter.v1ToV2()`.
3. `MessageProcessor.process()` runs stages:
   - ParsingStage → ValidationStage (Zod) → EnrichmentStage (ContextEngine) → MainProcessingStage (LLM/Tools) → ResponseStage.
4. Response is built as `MessageResponse` with `metrics` and `processing_details`.
5. If legacy client, `MessageAdapter.v2ToV1Response()` adapts back.

Key modules:
- Adapters: version routing, feature flags, rollback procedures
- Context Engine: retriever, optimizer, compressor, structurer
- Memory: episodic/semantic managers, consolidation, factory
- State: manager, persistence, synchronizer, versioning
- Utils: logger (`utils/logger.ts`), metrics (`utils/metrics.ts`)

Design goals:
- JSON-first, strongly-typed, extensible schemas
- Backward compatibility and dual-format support
- Introspection via rich `processing_details` and metrics
