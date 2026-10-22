### Plan: Human-Reasoning Markov CoT Processor (Inductive/Abductive/Deductive)

Goals
- Auto-score message complexity; gate CoT when beneficial.
- Select reasoning style (inductive/abductive/deductive) per context and tools.
- Execute dynamic Markov chain (analyze→hypothesize→test/tool→observe→update→conclude).
- Persist safe reasoning summaries; surface in Process modal.

Scope
- Backend (Edge Function): reasoning stage, adapters, reasoning core.
- Frontend: ProcessModal enhancements only.

Schema/Options (V2)
- Add `options.reasoning` in `SchemaValidator.ts`:
```
{
  enabled: boolean,
  mode: 'summary'|'trace',
  threshold?: number,      // default 0.6
  max_steps?: number,      // default 8
  max_tool_calls?: number, // default 3
  styles_allowed?: ('inductive'|'abductive'|'deductive')[],
  style_bias?: 'inductive'|'abductive'|'deductive',
  budget_tokens?: number,
  timeout_ms?: number
}
```
- Adapter defaults (V1→V2): enabled:true, mode:'summary', threshold:0.6, max_steps:6.

Design
- New directory: `supabase/functions/chat/core/reasoning/`
  - `types.ts`: ReasoningStyle, ReasoningState, ReasoningStep, ReasoningDecision
  - `reasoning_scorer.ts`: complexity/info-gap/tool-relevance scoring
  - `reasoning_selector.ts`: choose style based on message/context/tools
  - `reasoning_markov.ts`: state machine with adaptive transition weights
  - `reasoning_adapter.ts`: interface for provider adapters
  - `openai_reasoning_adapter.ts`: question generation + JSON reasoning summary

Processor Integration
- Add `ReasoningStage` in `MessageProcessor` before `MainProcessingStage`:
  1) score; if below threshold → record reasoning: none.
  2) select style; run Markov chain; call tools inside test states.
  3) write `metrics.reasoning_steps` and `processing_details.reasoning_chain` + `{style, score}`.
- `TextMessageHandler`: if `mode==='trace'` and no steps, run quick summary to populate steps.

Tool Loop (RAOR)
- Reason → Act (tool) → Observe → Reflect/update → continue/finish.
- Respect `max_tool_calls`, `timeout_ms`, `budget_tokens`.

Frontend
- `ProcessModal`: show Reasoning style, score; render steps with state badges and tool observations.

Flags/Config
- `COT_ENABLED`, `COT_TRACE_ENABLED`, `COT_MAX_TOKENS` in `feature_flags.ts` and `configuration.md`.

Testing
- Unit: scorer, selector, Markov transitions.
- Integration: stage end-to-end with tool stubs.
- E2E: complex vs simple prompts; verify steps show; tools invoked when needed.

Rollout
- Phase 1: score + style selection only (no extra LLM calls) → visualize.
- Phase 2: enable reasoning-summary generation for high scores.
- Phase 3: tune thresholds based on metrics.

Acceptance
- Reasoning data present in `processing_details` and UI; V1 unaffected; flags allow instant disable.
