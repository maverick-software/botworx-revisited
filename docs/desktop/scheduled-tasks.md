# Scheduled interface update — October 18, 2026

Current source moves agent selection into the top of the ordinary chat sidebar. The composer has no permanent agent selector; explicit typed @ addressing remains available. Switching agents through the sidebar preserves the current conversation, unsent draft and selected connection/model, and is disabled while that chat or goal is working.

Scheduled now uses a secondary sidebar with Upcoming, concise task rows, search, status filters, Show more and New task. The main landing has six suggestions; weekly and daily suggestions set the corresponding repeat rule. Selecting a task opens its owned conversation or a detail view before it has a conversation. The selected task is remembered as an account-scoped display preference. A collapsible right context card exposes its schedule, project, actual results, file sources and task actions beside the chat. Existing file/browser workspace controls remain available.

The new/edit modal shows name, instructions and repeat/time settings first. Advanced contains working notification choices, a new-chat toggle and existing-chat destination. Model, access and context has a further disclosure for connection/thinking, agent, project, time zone, missed-run rule, permissions, mode and saved files. New tasks default to enabled after the user chooses Create task; earlier definitions still require explicit import as paused tasks. Editing a paused task leaves it paused. Pause/resume, manual runs, cancellation, dismissal of uncertain runs, result read state and recoverable task deletion retain their existing backend operations and revision checks.

Notification policy is captured in the authoritative task/run snapshot. Important updates means failed or held runs needing attention; All results also reports completion; Off suppresses alerts. Windows alerts use saved per-account receipts, seed prior history on application reopen and do not display another signed-in account’s results. This is a local scheduler: the application must remain open, the account signed in and Windows awake. It does not provide an always-on cloud runner or infer the importance of successful content.

Verification includes 105 backend checks, 13 native PostgreSQL groups against a disposable restoration, 14 rendered scheduling workflows, 15 agent/interface checks, 10 goal/queue regressions, four reading-flow checks and five full-shell scheduling workflows. Tests used controlled inference and made no paid requests. These source and controlled-renderer checks do not establish ordinary installed operation; release-image evidence and installed acceptance are tracked separately.

Previous implementation notes follow.

# Durable local scheduled tasks — source integration

October 18, 2026. The source now connects the schedule engine to the actual Codex broker, saved chat queue and Scheduled screen. The installed application still saves its legacy schedules paused. Migrations 0064 through 0066 have run in a disposable database restored on the native Supabase PostgreSQL service; the installed production database remains schema 59 and the new interface is not installed. Verification below separates controlled execution, embedded PostgreSQL and rendered controls from the remaining installed/live requirements.

## Intended experience

Provide standalone tasks that create a new chat and follow-up tasks that return to an existing chat. Keep their agent, model, thinking level, mode, permissions and file scope visible. Provide one-time, interval and calendar schedules, next-run information, a run inbox, source links and controls for manual runs, pause, edit, stop and deletion.

The [official scheduled-task documentation](https://learn.chatgpt.com/docs/automations?surface=app) describes standalone and existing-chat destinations, a Scheduled inbox and selected model/reasoning settings. Tasks using local files require the computer and desktop app to remain running. Agentopia's local implementation must state that operating requirement. Advanced recurrence rules, worktree execution and multi-project schedules remain additional parity work.

## Source implemented

- `scheduled-task-contracts.ts` defines immutable execution snapshots and task/run states. A successful run requires a conversation identifier.
- `task-cadence.ts` validates one-time, anchored interval and five-field calendar schedules. Interval arithmetic continues across hour boundaries; calendar schedules use the pinned Croner time-zone rules. Missed-run policy either skips or admits one latest occurrence, avoiding an accumulated burst.
- `task-scheduler.ts` stages due work and claims it through a persistent store before calling the host. Account changes and closure stop owned work. A claimed reservation counts as busy before native preparation, so a consistent backup can refuse concurrent dispatch. A wake-up requested during an existing pass schedules a subsequent pass; a busy refusal cannot lose the follow-up wake-up.
- `scheduled-task-store.ts` uses service-only PostgreSQL operations, normalizes records and preserves exact file-binding paths. Known pre-submission deferral is permitted only while its reserved chat request is absent. Unknown submission outcomes are held.
- `scheduled-task-execution.ts` captures actual owned agent/project revisions and file references. It retains explicit connection choices, asks the existing default-routing callback for an initial choice, validates thinking/model availability and refuses revoked context. It does not select another provider when a stored model fails.
- `scheduled-tasks.ts` provides authenticated list/save/control operations. The host supplies authoritative context. A late account change prevents an older account's response from being returned to the new caller. Deletion/cancellation obtains its affected request set from PostgreSQL rather than renderer assertions.
- `scheduled-task-queue.ts` puts existing-chat runs into the durable conversation queue, reconciles restart orphans and keeps generated instructions outside generic edit/resume/steer controls. Removing one cancels its scheduled run.
- The broker saves the activation marker before native execution, waits for the saved response outcome and validates inherited schedule/file restrictions before subsequent inference and tool actions. The marker survives deletion of its chat, preventing accidental replay. Sign-out, shutdown and backup reservations include scheduled work; cancellation preserves unrelated chats and children.
- The Scheduled screen and agent settings share an inline editor with one-time, interval, daily, weekday, weekly and custom calendar choices. Model/thinking, context, permissions, destination, missed-run rules, next occurrence, unread results and run controls are visible. Legacy paused definitions remain collapsed and are not enabled automatically. Review import opens the inline editor with the original agent, instructions, calendar and time zone. Connection and context are selected before import. Import always creates a paused task; enabling remains a separate action.

## PostgreSQL migration 0064

New task and run tables preserve legacy `agent_tasks`. Occurrence and open-run constraints prevent duplicate claims. The service-only functions save definitions with revision checks, stage/claim work, record chat provenance, complete from a saved successful chat receipt and recover interrupted state. Native children use the originating request; named-agent and cross-chat descendants inherit the originating schedule's restrictions through their instance ancestry.

Recovery distinguishes saved terminal chat outcomes from uncertain running requests and from runs that never created a chat request. It does not replay a completed or uncertain model request. Pausing scheduling cancels pending occurrences while an already claimed response remains independently controllable. Editing requires an active or uncertain run to be stopped or inspected first. Deletion removes future authority and returns the owned request set for host cancellation; saved conversations remain available.

## Explicit legacy import — migration 0065

An owner-scoped import records the original task identifier and source timestamp. The original `agent_tasks` row remains unchanged. Import locks that source row and links it to one new paused task. Concurrent retries return the same task; a deleted import cannot be revived by repeating the import. A stale source, foreign owner or different target agent is refused. The authenticated broker captures current agent/project revisions and file context, validates the chosen connection, and refuses an import request that tries to enable future work. These application operations remain separate from the reviewed scheduling tools described below.

## Reviewed scheduling through the agent chat — migration 0066

The source advertises four host tools to the actual Codex harness: list, read, save and control scheduled tasks. ChatGPT OAuth and compatible OpenRouter connections use the same tools. Default/Full permissions in Work mode expose them; Chat only, Selected files, Plan mode and the legacy harness do not. Agent tool allowlists apply. Reading task configuration requires memory access; creating/changing future work also requires delegation permission.

New tasks inherit the real originating agent, connection/model, thinking, permissions, selected context and project. Models cannot supply an owner, credentials, approval, alternate provider or broader grants. Existing tasks retain their destination and connection/context; broader or different-connection edits require an explicit change through Scheduled or the current chat configuration. Read/list results stay within the current agent/project and either a standalone task or the current chat.

Save and pause/resume/delete proposals always wait for the human inline decision, including Full access. The review shows readable calendar timing, next-time preview, destination, model, thinking, permissions, instructions and expandable file/tool/skill/window scope. Relative intervals begin when saved. Declining or cancelling preserves its receipt without creating future authority. A compact saved receipt links back to Scheduled and explicitly distinguishes saved configuration from a completed run. No attachment-sharing dialog was added.

Migration 0066 gives native mutation calls a unique request/thread/call receipt. Repeating an attempted call returns its saved result or inspection requirement rather than opening another review. New-task identifiers are stable for that scope. The database compares the reviewed revision, status and next occurrence under the same row lock as the save/control operation, so a task changed while review was open requires a fresh proposal. Account, originating assignment, agent/project revisions and file grants are revalidated before saving; backup reservations include mutation commits.

## Native PostgreSQL restore and independent clients

`.supabase/desktop-scheduler/native-1792358851560/evidence.json` records **twelve passing groups** against a scratch database on the running native Supabase PostgreSQL service. A verified backup was restored and migrations 60–66 were applied only there. Every pre-scheduler auth/application/vault table retained its row fingerprint, excluding the newly added nullable request field, and all 190 encrypted records remained readable using the runtime's existing key. Eight independent SQL clients produced one occurrence and one successful claim. Tests also cover real chat-creation/checkpoint functions, child assignment scope, ownership, role restrictions, pause/manual-run retries, cancellation racing a claim, and recovery of completed, uncertain or deleted activated requests. Six simultaneous import attempts produced one paused task with no scheduled run; the original definition was unchanged.

The test removes its uniquely named scratch database and compares installed account, profile, role, agent, conversation, message and migration fingerprints before/after. They matched, with zero model requests or production migrations. It shares the running PostgreSQL process and encryption key; cron background-job objects are excluded from the scratch restore. Fresh SQL connections test persistent recovery decisions, but this does not establish a full service restart, independent installation restore, broker/renderer integration against that database, or live inference.

## Verification

Backend compilation and **101 source checks** pass:

`.supabase/desktop-scheduler/check-1792358958300/evidence.json`

They exercise cadence, daylight-saving transitions, missed runs, atomic-store dispatch, account changes, cancellation, uncertain receipts, file bindings, model choices, authenticated controls, queue reconciliation and broker execution. One check starts the actual bundled Codex through the broker, using controlled inference and persistence, and verifies activation before inference and a saved reply. Separate checks start actual bundled Codex through each connection configuration, invoke the actual schedule ToolService, wait for an inline decision, save one task and return the saved result to Codex. Both use controlled inference and persistence with two simulated model responses each. The controlled store does not establish native database integration or live provider behavior. Native database checks remain separately scoped below.

**Thirteen embedded PostgreSQL checks** pass:

`.supabase/desktop-scheduler/postgres-1792356428599/evidence.json`

PGlite 0.5.10 runs PostgreSQL 18.6 on WebAssembly with a minimal schema fixture. The checks bind migration 0064, execute its functions and constraints, require saved completion receipts, preserve provenance, revoke descendants, enforce owner checks, distinguish recovery cases and deny authenticated clients access to service-only operations. The engine and fixture differ from the Supabase runtime; restoration, native PostgreSQL multi-client concurrency and end-to-end application behavior remain release gates.

**Eleven rendered interface checks** pass in `.supabase/desktop-scheduler/ui-1792358996473/evidence.json`. Real React components run in Electron against a controlled bridge. The checks cover inline creation with the default ChatGPT connection, saved cadence/context, revision-aware pause/resume, stable manual run identifiers, cancellation, unread result navigation, a narrow light-theme layout, explicit paused legacy import using the default ChatGPT connection, generated queue controls, and inline scheduling review/approval/decline with compact receipt navigation in both themes. Review data is produced by the actual backend proposal class. They do not access production data or AI services. Screenshots are retained beside that evidence; matching the reference application's behavior still needs broader comparison.

```powershell
npm run desktop:test:scheduler
npm run desktop:prepare:scheduler-tests
npm run desktop:test:scheduler:postgres
npm run desktop:test:scheduler:native
npm run desktop:test:scheduler:ui
```

The embedded PostgreSQL package and lockfile are test-only fixtures. Preparation uses its exact locked package and does not change the application backend or packaged dependencies. All checks above make zero live provider requests.

## Remaining release work

1. Complete broker/renderer execution against native storage, active-goal/human-queue priority and actual application/service termination recovery. Scratch restoration, concurrent native clients and inherited revocation passed with the scope above.
2. Exercise the integrated reviewed tools, native storage and renderer in the exact packaged application, including revoked context during a pending review and interrupted commits. Source, native SQL and rendered checks pass separately; their combination remains a release gate. Explicitly selected task context follows implicit attachment consent.
3. Qualify the exact package, installed controls, restart behavior and live ChatGPT execution. Keep OpenRouter-specific live checks limited and inspect prior outcomes before another paid request.
4. Compare the complete interface and behavior against the reference, then address advanced recurrence rules, worktrees and multiple-project schedules as separately demonstrated capabilities.

The ordinary installation remains 0.44.17/schema59 with its separately verified UI appearance repairs; its backend and database are unchanged. Frozen 0.44.18/0.44.19 archives predate these scheduling and UI changes. No new production schedule is enabled by this source work.

The current source also passes 74 chat-delivery, agent-policy and native-routing regressions at `.supabase/desktop-chat-delivery/check-1792359023085/evidence.json`, with no live provider requests.
