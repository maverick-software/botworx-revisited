# Native context compaction and saved progress

October 21, 2026. An isolated copy of the installed Agentopia 0.44.52 image passed automatic native compaction, checkpoint recall and deliberate continuation after normal reopening. The application image and model configuration were unchanged. Production accounts, chats and installed files were untouched.

## What was tested and why

Long conversations eventually exceed what a model can keep in active context. Codex can summarize the conversation and replace older active context with that summary. This check exercised that actual native path and then inspected the next model inputs and saved database records.

The delivered gateway declares remote compaction unsupported. The real Codex 0.163.0 process used its local compaction path through the ordinary Responses endpoint. Its own request contained the “CONTEXT CHECKPOINT COMPACTION” instruction. It emitted matching started/completed `contextCompaction` items, which Agentopia saved in PostgreSQL. This event is documented in the [official app-server item reference](https://learn.chatgpt.com/docs/app-server#items).

The test reported ten million input tokens in a controlled model response to trigger compaction without generating a genuinely full conversation. The native process reported an effective context window of 258,400 tokens. The summary and subsequent model decisions were deterministic fixtures. Agentopia’s packaged broker, native process, authentication, memory service, database, permissions and receipts were real; upstream model responses were controlled. No paid inference or real external service action occurred.

## Results

The initial phase saved one agent-authored checkpoint with its source message and conversation. Compaction occurred, and the next input contained the summary, original task, latest constraint and checkpoint reference. A real memory search retrieved the checkpoint and its citation. There was one saved memory and one write receipt, with no repeated write.

A second phase used that existing checkpoint without changing memory. It triggered native compaction in the current configuration, preserved the task/constraint/checkpoint markers in subsequent inputs and performed two successful memory reads. After normal closure and reopening, the test observed zero automatic model calls. A deliberate follow-up resumed the same native thread and configuration scope, received the compacted summary and current memory, and successfully read the original checkpoint once. Its saved reply remained visible on a further read-only reopening, which also made zero model calls. The checkpoint identity and content were unchanged.

The stable-memory compaction phase used four controlled model responses, including the real summary request. Its deliberate cold continuation used two more. The earlier checkpoint-writing phase used four successful controlled responses. The earlier rejected cold assertion is retained separately. All test processes closed normally, including verifier-failure cleanup; the owned test runtime stopped afterward. Actual packaged screenshots were inspected.

## Memory changes and verifier corrections

Saving, correcting or deleting an agent memory advances its memory revision. That revision participates in native configuration scope, so a later message can start a fresh branch with visible conversation history and the current permitted memory. In the initial cold check, memory advanced from revision zero to one after the write. The fresh branch received the original task, latest constraint and checkpoint, but the verifier incorrectly required the prior branch’s internal summary marker. The controlled provider rejected that assertion, and Agentopia saved a failed request with zero tool receipts. The failed request and its visible failure remain in the disposable test chat. No paid provider rejection occurred.

The stable-memory check separates that scope transition from compaction persistence. It retained memory revision one through compaction and cold continuation, and the native thread and configuration remained the same. Retention of every internal summary detail across a deliberate scope change remains unproven.

Two later UI verifier errors occurred after their functional requests completed: an exact-text locator matched two existing replies, and a direct broker invocation was inspected before the renderer reloaded its saved history. The locators/history checks were corrected. Read-only continuations inspected the completed results; the successful requests and memory write were never replayed. Original failure evidence remains alongside final acceptance.

## Evidence and limits

Qualification: `F:/Agentopia/.supabase/desktop-composio-candidate52/1792560932895/context-compaction-qualification.json`.

Accepted stable-memory workflow: `F:/Agentopia/.supabase/desktop-composio-candidate52/1792560932895/context-compaction-1792566284705/evidence.json`. It retains native events, model-input marker observations, source-linked checkpoint identity, completed receipts, scope/revision checks and verifier continuations. Qualification pins the image, supporting scripts and inspected screenshots, and records completed/failed request IDs that must not be replayed.

This establishes that native compaction runs, transports a supplied summary into subsequent requests, preserves saved progress and resumes an unchanged configuration after normal reopening. It does not establish live summary quality, performance with a genuinely full conversation, hours-long completion, Windows reboot or recovery under another Windows user. Those remain within broader acceptance work. The full parity and workspace-agent goal remains active and incomplete.
