# Accurate saved native activity

This page records the earlier source correction and its original evidence. The subsequent [tool presentation and durable receipt checkpoint](native-tool-presentation-2026-10-19.md) moves the pure helper into backend source, retains its UI reexport, and adds a ToolService metadata change. The earlier statement that backend sources match frozen30 applies to that earlier checkpoint; the later source remains outside the unchanged frozen release.

The historical Slonski browser request exposed a display inconsistency. The host's saved `browser_open` tool receipt says `interrupted`, with “Tool execution was cancelled.” Its native MCP transport item never received completion and remains `inProgress`. The main-chat renderer used its default live label for that old item, so expanding a completed response showed “Working” above the actual interrupted tool receipt.

A read-only query of that exact account, conversation and request establishes the disagreement. The earlier visit to port4174 has a completed native failure and a saved page-loading timeout. The port4176 visit has the interrupted host receipt and incomplete transport event. The source correction addresses the displayed outcomes. Investigation of the earlier loading timeout remains separate.

## Correction and boundaries

`desktop/ui/native-activity-status.ts` resolves the exact host receipt for a displayed native item. It requires the same request, native thread, tool name and call identifier; both live and saved call identifiers must agree when present. Duplicate receipts or an item identifier reused across different turns remain unresolved. The helper reads existing data without altering native events or tool receipts.

Main chats, dedicated child chats, older child activity and parent reports now provide their active/inactive context. An incomplete native host item can display the exact saved Completed, Failed, Declined or Interrupted outcome. The saved reason appears when available. Historical items without a reliable final receipt say “No completion recorded”; active work remains “Working”. Background commands keep their Running in background, Exited, Stopped and Session ended labels. Empty tool payloads no longer render a literal `null`.

This is a source-only renderer correction. Backend sources match frozen0.44.30. The ready0.44.30 archive, Windows installer, backups and ordinary installed0.44.24 remain unchanged. A future delivered image and ordinary installed acceptance must include this correction before it is described as installed.

## Verification

The original renderer reproduces the disagreement in an isolated real Electron window: the native row says Working while its saved tool row says Interrupted. Evidence: `.supabase/desktop-native-activity/ui-1792376074366/evidence.json`.

Seven unit checks and renderer type checking pass. They cover exact saved cancellation, request/thread/tool/call isolation, conflicting identifiers, duplicate receipts and reused IDs, preservation of actual native completion, active versus inactive unknown outcomes, and background-command labels. Six real-renderer workflows cover the cancelled main call and readable reason without a null payload, a declined child call, a failed parent report, unmatched saved activity, live activity and narrow/light layout. Screenshots are inspected. Existing six background-control workflows and six child-guidance checks also pass; the final empty-payload cleanup is covered by the final renderer run.

The final helper is additionally evaluated against the exact saved browser receipts. It displays the completed port4174 failure as Failed and the incomplete port4176 native call as Interrupted. The original records remain unchanged. No ordinary account/history/draft data is modified and no ChatGPT/OpenRouter request is made. Evidence is recorded under `.supabase/desktop-native-activity/`, with `latest-source.json` pointing to the current combined acceptance record.
