# Readable tool activity with retained Codex details

Expanding the ordinary Exa search showed four Codex MCP transport rows followed by four Agentopia host cards. Both sets describe the same actions. The raw rows use generic names such as `agentopia_host · mcp_call`, while the host cards identify the reviewed search and page-fetch tools. The previous renderer reproduces those eight rows from the saved completed request without repeating any work.

The current source presents the readable host cards first and puts the underlying Codex records in one closed **Codex tool details** section. Every native record remains available there. Calls without host records continue to appear directly, so missing receipts do not erase recorded activity. Two separate discovery calls remain separate cards; calls are not merged by name or by similar arguments.

The same presentation applies to child transcripts and parent report activity. Host tool cards now stay inside the child's collapsible transcript. A child waiting for a host review opens that transcript automatically, including the compact Background agents view. Parent reports also open their activity when a host review needs input. Existing command Stop controls, native questions, child guidance and generated-image display remain available.

## Saved call identity

The actual ToolService previously emitted `native_call_id` while a generic MCP call was running but omitted its saved equivalent for discovery and ordinary MCP calls. Reopening those chats therefore lost the exact connection between the native event and its host receipt. Browser and several other tool types already saved that metadata.

Future native calls now retain the host-supplied `provider_call_id` in their existing saved arguments metadata. It is added after model argument validation; a model cannot submit its own host identifier. Generic MCP argument redaction remains in place, and the stored reviewed arguments and result remain accessible through the host card. The request/thread/tool/call checks continue to reject conflicting or ambiguous receipt matches. This requires no migration and does not backfill or reinterpret historical calls.

The pure receipt/status helper is now at `desktop/src/native-activity-presentation.ts`; the UI module reexports it. This also lets the ordinary compiled backend tests import it without a special UI compilation path. Existing transport outcomes, unknown completion labels and background command states retain their earlier rules.

## Evidence and limits

The exact ToolService source compiles into an isolated output directory. Eleven compiled checks cover durable discovery identities under both provider configurations, distinct repeated calls, parent/child isolation, reviewed MCP results, saved argument redaction, refusal of a model-supplied identifier and the existing status rules. The database and remote service in these checks are controlled fixtures. They do not contact OpenRouter, ChatGPT or Exa.

Ten actual Electron-renderer workflows cover interrupted main calls, declined child work, failed reports, unknown historical completion, active calls, narrow/light layout, visible report reviews, visible compact-child reviews, the saved ordinary Exa result and access to all original native records. The saved request is `10e6c0e2-d79e-404f-8a3c-9ff0ea5034d2`; it is rendered from a read-only capture and is never sent again. The resulting screenshot is inspected. The seven renderer/status checks, six child-guidance checks and six background-control workflows also pass. The background workflows confirm independent parent/child Stop behavior and saved output without automatic restart.

Initial verification attempts exposed test setup errors: the isolated backend output needed its CommonJS package declaration, a hardcoded test-array index changed when the helper moved, and a broad UI selector matched both main and report details. Those attempts are retained. Corrected runs pass, including default compiled test imports.

Combined evidence: `.supabase/desktop-native-activity/presentation-acceptance-1792378953068/evidence.json`. Preview: `.supabase/desktop-native-activity/presentation-ui-1792378868156/ordinary-search-refined.png`.

This is a **source checkpoint**. It is absent from the installed0.44.24 app and frozen0.44.30 candidate. The existing candidate, installer, verified backups and ordinary accounts/history/drafts remain unchanged. A future delivered build must include this checkpoint and pass its package/native-database/ordinary acceptance before the refinement is described as installed. Full desktop parity remains active.
