# Chat interaction parity

Updated October 16, 2026. Desktop 0.30.0. This specification uses the supplied ChatGPT/Codex desktop screenshots and current official documentation as the reference. It distinguishes visible interaction checks from runtime capabilities. The private desktop client implementation was not inspected.

## Reference behavior and evidence

The supplied screenshots show a quiet disclosure row above the answer, labelled with the elapsed work duration; a compact card listing edited files and added/removed lines; View changes and Undo actions; a Show more files disclosure; and document links within the answer. Earlier supplied screenshots establish the separate activity rail, project/chat sidebar, chat column, and right workspace with tabs and folder navigation.

Official documentation describes working with files and outputs beside the chat in the [desktop app](https://learn.chatgpt.com/docs/app), and inspecting file diffs in the [review pane](https://learn.chatgpt.com/docs/code-review?surface=app). These are the public interaction references. An observed screenshot establishes appearance and available controls; the tests below establish what our controls actually do.

## The conversation contract

| State or action | Required interaction |
|---|---|
| New chat | Composer is prominent; provider, model, thinking, permission, attachments, mode, and agent choices remain explicit. |
| Submitted | Create one identifiable turn. Retain the user message and show actual response progress. |
| Running | Stream real output; show a live elapsed-time row and recorded actions. Keep cancellation available. |
| Waiting for approval | Make the pending operation visible even when work history is collapsed. Show its actual arguments or diff. |
| Finished | Freeze elapsed time, preserve the final status, and leave detailed work history collapsed until requested. |
| Stopped, failed, interrupted | Label the outcome accurately, preserve partial output and recorded operations, and retain history. |
| Inspect work | Expand the recorded tool activity using mouse or keyboard. Never imply that this is private model reasoning. |
| Inspect file changes | Show only confirmed, still-applied text edits. Open saved snapshots in a right-side Changes tab. |
| Undo | Review the scope, reverse edits in order, and check each current file before modifying it. If a conflict occurs, explain partial progress and stop. |
| Follow a document/source link | Open the corresponding owned document, source location, or browser tab inside the existing workspace. |
| Read older messages | Preserve the reader's scroll position while new output arrives. Offer a return-to-latest control. |
| Reopen | Restore the conversation, recorded outcomes, work duration, and owned workspace tabs. |

## Implemented in this iteration

The assistant response now has a turn-level Working/Worked/Stopped/Failed/Interrupted disclosure. Saved duration comes from PostgreSQL request creation and completion timestamps. The live display uses real elapsed time. Duration includes model and tool work and approval waits; it is not a measure of reasoning time. Recovered interruptions show Interrupted without a claimed completed-work duration because recovery timestamps can include time while the application was closed. Pending approvals appear outside the collapsed history.

The Edited files card summarizes completed text-file writes. Verified consecutive edits to the same path combine into a before-first/after-last diff. Proposed, declined, failed, interrupted, reverted, and net-zero edit chains do not appear as applied changes. Counts are computed from saved contents, with an explicit unavailable-count result for a diff that exceeds the computation limit. Multiple independent edit groups for one path require separate snapshots because intervening changes cannot be attributed to the agent.

View changes and file rows open a Changes workspace tab alongside the existing folder navigation. The tab loads its saved response through the broker's account/ownership checks. It displays before-and-after diffs and can open the actual file. Its stored identifiers receive the same ownership and deleted-message checks as conversation-source tabs.

Undo opens the review before asking whether to reverse the response's edits. Reversal uses existing hash checks and runs from the latest edit backward, limited to the changes represented in the review. Net-zero sequences omitted from the card are excluded from undo too. A conflict preserves the conflicting file and leaves remaining edits untouched. Earlier successful reversals remain applied and are reported. File moves, folders, and recoverable removal continue through File operations and recovery; the text-file card does not claim to summarize those operations or arbitrary shell side effects.

Document links retain the existing owned file/source resolver and browser routing, with keyboard link semantics and a local-document affordance. Existing streaming, draft, citation, sidebar, workspace, and scroll behavior remain part of regression verification.

## Mapping the actual Codex runtime

The current release still uses the existing Agentopia execution loop. The new presentation consumes real existing tool records; adding this presentation does not integrate Codex app-server.

When the runtime migration is implemented, use an event adapter rather than rebuilding its behavior in chat text:

| Codex event or operation | Agentopia presentation |
|---|---|
| Thread/turn/item identifiers | Stable conversation, response, activity, and review identities |
| Agent-message deltas and completed items | Streamed text with the runtime's actual message boundaries |
| Command/MCP/file-change items | Recorded activity with native arguments, output, status, and diffs |
| Approval and user-input requests | Visible pending decision, scoped to its exact thread/turn/item |
| Turn completion/interruption/failure | Frozen duration and accurate final state |
| Plan/goal/child-agent/compaction events | Actual plan, goal, delegated-work, and context activity |

The [app-server protocol](https://learn.chatgpt.com/docs/app-server) supplies these event and lifecycle interfaces. Persist native identifiers and resumable state; do not flatten native history into a single text answer and then reconstruct events from prose. Keep user choices intact when history refreshes, and ignore late events from a different account or chat.

Keep file undo separate from conversation-history reversal. The documented `thread/revert` operation removes conversation turns and leaves local files unchanged. A native-runtime integration must retain a real file-review/restore operation for the Undo action shown in the screenshots. [Thread history reversal](https://learn.chatgpt.com/docs/app-server#revert-thread-history).

The full architecture and provider qualifications are in [Codex harness research](codex-harness-research.md). Version 0.27.1 implements native steering, parallel working chats, workspace skills, native V1 subagents, and the existing validated plugin tool bridge. Browser automation, provider voice, rich artifacts, plugin-bundled executable hooks, and fuller delegated-agent controls remain distinct capability gates. [Native integration](native-codex.md). A complete UI parity claim requires those gates and the runtime comparison, not only matching these screenshots.

## Remaining interaction differences

| Interaction | Current boundary | Required next work |
|---|---|---|
| Talk to an agent while it works | The enabled composer sends native turn/steer with the exact active turn identifier. Accepted guidance is saved with the native turn. | Additional queue editing controls remain further work. |
| Move among parallel working chats | Up to four owned chats can run independently; navigation restores each chat’s request and approval state. | Broader scheduling and cross-device coordination remain further work. |
| Commentary, final answers, and delegated work | Native item identities and phases are retained. Completed commentary is in the work disclosure; final answers and child transcripts retain their actual boundaries. | Version 0.28.2 adds child cards and a Background agents panel with independent execution, steering, cancellation, follow-up, native MCP tools, automatic parent reports and restart recovery. Version 0.29.0 adds dedicated child sidebar chats, separate drafts, saved navigation and collapsible live activity. Broader desktop parity remains further work. [Child chat verification](subagent-chats.md). [Controls and verification](background-agents.md). |
| Permission controls | Native read-only/untrusted and explicit Full access policies are mapped. Approval/input callbacks are scoped to owned native requests; standard accounts cannot approve native commands. Existing host tools retain their reviewed boundaries. | Broader live qualification of native patch, command, and question interactions remains further work. |
| Whole-workspace change review | Host text-file edits retain right-pane checked Undo. Native file-change items display their real diffs in chat. | Whole-repository review and separate recovery for native patch/command side effects remain further work. |
| Native plans, goals, and skills | Native collaboration Plan mode and skill discovery/invocation are connected. Agentopia’s reviewed plan canvas and bounded goals remain host services exposed to the native runtime. | Direct native thread-goal lifecycle controls and a full plugin skill installation UI remain further work. |
| Browser automation and rich canvases | Browsing and existing previews are available; this does not establish native automation or every artifact editor. | Supply and qualify the appropriate host tools, permissions, and interactive artifact integrations. |

These differences should remain visible in the acceptance checklist. Model selection alone cannot enable a missing interaction or grant a native capability.

## Verification

The repeatable workspace workflow creates actual temporary files using controlled provider tool calls. It checks visible approval while history is collapsed, applied diff counts, five-file disclosure, keyboard expansion, right-pane diffs, local document navigation, layout reload recovery, saved elapsed time, and reverse-order undo that stops on a newer human edit. Existing denial, cancellation, single-file undo, and saved activity checks remain included.

Automated model checks cover verified edit chains, independent intervening changes, excluded statuses, net-zero changes, file creation, invalid timing, and completion-time freezing. Database navigation checks cover owned review tabs, attempts to save another user's identifiers, and removal of tabs for deleted messages.

The final 122-check automated suite passed, including undo scope, interrupted timing, and review-tab ownership. Installed 0.26.1 checks completed in stages: the broad run passed settings, composer/voice, attachments/documents, editing/plans, terminals, file management, workspace organization, preview search, and source navigation; the release stage passed project memory, plugins, stream continuity, the real five-file review/undo workflow, external tools, core permissions, backups, and forced-termination recovery; the focused navigation stage passed project context, both sidebars, folder/file panes, canvas/browser routing, resize, persistence, and menu transitions.

Initial verification attempts stopped on controlled-fixture assumptions and test selectors that still treated the new disclosures and citation links as the old controls. Those checks were corrected; failure artifacts were retained. The new undo scope and interrupted-duration edge cases were fixed before the final installer. The default installed-test scripts contain the corrected selectors, and the release/navigation flags allow the relevant stages to run independently.

The real 0.26.1 installer retained a disposable account, project, protected MCP credential, agent instructions, conversation, and request lifecycle. The original administrator session and both saved provider connections reopened. An earlier real-provider chat displayed its saved duration, file card, right-pane diff, and folder navigation. Its new personal upgrade backup was confirmed.

The final audit verified the original two accounts, one administrator, unchanged password hashes, earlier live conversation/file evidence, all 31 migration checksums, installed compiled/UI resources, six healthy native services, local Whisper readiness, and no remaining test-provider records. The app is open on that original chat and review. Current evidence is in `.supabase/desktop-poc/chat-interface/`; its `installed-prefix-0.26.1.log`, `installed-release-0.26.1.log`, and `installed-navigation-0.26.1.log` record the installed stages. `all-tests.log`, `personal-installed.json`, `final-data-check.json`, and `installer.json` record the remaining final checks. Controlled provider tests establish interface and persistence behavior; they do not establish Codex runtime integration or live-provider capability equivalence.

Native 0.27.1 installed verification and model-compliance limits are recorded in [Native Codex](native-codex.md).
