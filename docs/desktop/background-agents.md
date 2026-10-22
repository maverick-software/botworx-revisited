# Background agents and report delivery

Agentopia 0.28.2 keeps native Codex child agents alive after the parent response finishes. Both ChatGPT and OpenRouter use the same pinned Codex app-server 0.163.0 and native V1 delegation. There is no second custom inference loop for background work.

Ask an agent to delegate a task **in the background**. It can spawn a child, finish its current response, and accept another message while that child works. The model must actually invoke native delegation; prose claiming that it delegated work is not a successful spawn. The child inherits the originating connection, workspace and permission scope. Agentopia exposes its validated workspace, planning, memory and plugin tools through a private native MCP server shared by the parent and children. The unmodified 0.163.0 runtime does not inherit app-server dynamic client tools in V1 children; its MCP configuration does inherit. This is a tool transport change, with the existing Agentopia executor still enforcing ownership, schema checks and approvals.

Agentopia **0.29.0** adds [dedicated sidebar child chats and collapsible inline activity](subagent-chats.md), retaining the execution and report-delivery behavior below.

## Controls in chat

Each parent response has child cards that remain available after completion. The **Background agents** button in the application rail opens those controls from another chat. Each card includes the assignment, current status, transcript, tool output and approvals, saved result, and report-delivery state.

- **Steer subagent** sends input to that child's exact active native turn. Repeated accepted input identifiers are deduplicated; stale turn identifiers are rejected.
- **Stop subagent** interrupts only that child. Stopping the parent response leaves independent children working; use their own Stop controls to cancel them.
- **Send follow-up** starts a new native turn on a stopped or completed child, retaining its thread history. After an application restart, this is an explicit recovery action; uncertain external operations are never automatically replayed.
- Native command/file questions and host-managed tool approvals remain reviewable after parent completion. Approval checks revalidate the current account and role.

The parent response keeps its completed status. Background updates do not recreate a running parent, move the foreground chat, clear its draft, or mix another conversation's stream into it.

## How results reach the main agent

Codex's V1 runtime places a completion notice into the native parent's context. Agentopia retains the worker so that mechanism survives parent completion. It then queues a native parent continuation containing the actual child result, status and identifiers. The continuation uses the original connection and approved permissions. Its output appears as **Main agent · subagent report**, explicitly labelled as an automatic continuation.

The report is reference material with no authority to grant permissions or impersonate the user. Accepted human turns take priority. When changing provider or model branches, completed child results and automatic reports are carried into the new native context as labelled reference records. This includes reports that arrived on an older chat message after another branch had already continued. A child completion is tracked by its native thread and turn identifiers, preventing duplicate automatic delivery. A failed or interrupted report stays visible and requires **Retry report to main agent**. **Stop report** interrupts the automatic continuation without stopping other children.

This follows the completion-notification interaction described in [Claude's public subagent documentation](https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background), while execution remains Codex. Native turn lifecycle, steering and interruption use the [public Codex app-server protocol](https://learn.chatgpt.com/docs/app-server). This integration uses the pinned protocol generated from 0.163.0; newer online fields are not assumed to exist in the bundled runtime.

## Persistence, isolation and limits

PostgreSQL stores owned native execution contexts, child state, report receipts, steering, approvals and UI snapshots. Codex retains its private thread histories under the user's Agentopia application data. No provider credential is included in the recoverable execution context or given to the renderer.

Workers are reused within the same account/conversation/connection/model/workspace/permission scope. They remain alive while a parent, child or report is active. Idle workers exit after one minute. The supervisor permits eight workers; each native worker permits four threads and two levels of delegation. Up to four ordinary parent chats can run concurrently. Model and provider limits can reduce practical concurrency.

**Agentopia must remain open for execution.** Signing out, closing the application, account suspension, permission revocation, pausing or completing a parent goal, or deleting the parent conversation stops the corresponding native work. Saved child transcripts remain readable. After restart, unfinished children are labelled interrupted and require explicit resumption. A changed connection, tool configuration, agent instructions or workspace scope may require restoring the original configuration or starting a new task.

Backups require all active parents, children and report processing to stop or finish. The supervisor closes idle workers and awaits process exit before copying native SQLite state and PostgreSQL. Temporary native caches and the executable-seeded system-skills directory are regenerated rather than copied; custom skills, rollouts, databases and workspaces remain included. External selected folders still need their own backups. Native shell/patch side effects and already-started remote operations cannot be undone by interrupting a turn.

The Background agents panel lists children from the most recent 100 native parent records; older children remain available in their saved parent chats. Provider-specific model compatibility and model compliance require real qualification. This does not establish complete behavioral parity with another desktop product.

## Verification

`desktop/tests/background-agents.test.cjs` checks parent/child lifetime separation, owned child controls, stale input, independent cancellation, approvals after parent completion, prioritization of human turns, and single report delivery using a controlled native transport. These are supervisor checks rather than live model evidence.

`scripts/desktop/test-background-agents.mjs` uses the original installation's protected ChatGPT and OpenRouter connections, the actual Electron interface, and real native child commands. A fresh value exists only in a temporary workspace file. The test requires child execution to continue after parent completion, steers the child through its card, and checks that the real main-agent continuation uses the returned value. It also exercises child cancellation, follow-up, explicit recovery after an application restart, saved reports and a backup. Records are written to `.supabase/desktop-background-agents/`. An application restart is distinct from a full Windows reboot.

The V1 tool-inheritance behavior is established by the [pinned Codex spawning implementation](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/src/agent/control/spawn.rs). The private MCP bridge checks native thread metadata supplied by Codex, requires a random worker-scoped credential, accepts only declared tools, and carries child cancellation through to the host executor. Auto-approval is configured only for this internal transport; Agentopia still reviews file writes, commands and external operations according to the original permission selection.

## Installed verification - October 16, 2026

The final private release is **0.28.2**, with unmodified Codex **0.163.0**. All **138 automated checks** passed. These include controlled lifecycle/permission tests, real PostgreSQL and Windows process checks, native MCP authentication/cancellation, and discovery/calls through the actual bundled Codex executable. Provider inference in the legacy regression fixtures remains simulated; those fixtures are separate from the following live evidence.

The installed application ran from a temporary working directory using the original protected ChatGPT and OpenRouter connections, both with GPT-6.1 Sol. Both native children continued after parent completion, accepted steering through the interface, and returned actual command results to native parent continuations. ChatGPT and OpenRouter children also used the private MCP host file tool, with receipts attributed to their own native thread identifiers. A Default-permissions child used that tool successfully. Changing to OpenRouter with file access disabled recalled an earlier ChatGPT child result from saved conversation context.

Dedicated child Stop and Follow-up controls passed. Closing and reopening the installed application labelled unfinished work interrupted; an explicit follow-up resumed the exact same native child thread and delivered its new result to the main agent. Reports reopened in chat. The backup contained PostgreSQL, native SQLite state and the recovered child's rollout, while excluding regenerated caches. This was an application restart, not a full Windows reboot.

The actual installer upgrade retained a disposable account, project, protected MCP credential, agent instructions and conversation, then removed that fixture. The final preservation audit confirmed the original two accounts, one administrator, unchanged password fingerprints, earlier real-provider conversations/files, all 34 immutable migration checksums, six healthy Supabase services, and installed code/resources matching the verified build. Agentopia was reopened normally afterward.

Evidence: `.supabase/desktop-background-agents/evidence.json`; `.supabase/desktop-poc/background-agents/automated-0.28.2.log`, `installed-live-0.28.2.log`, `upgrade-0.28.2.log`, `final-data-check.json`, and `installer.json`.

Earlier qualification found that V1 children lacked app-server dynamic client tools. The release fixes this with native MCP rather than accepting a text-only claim of tool use. Regression checks also cover a child completing before the parent ends, single report delivery, native wait deduplication, and cancellation of a parent message queued behind an automatic report.
