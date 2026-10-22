# Persistent workspace agents: audit and proposed design

October 17, 2026. Status: implementation in progress. The user selected cross-project agent memory with project isolation, persistent active-agent switching through @, and coordination with the other development chat. These choices establish the core design. The goal remains active until the full acceptance matrix is demonstrated.

## Intended outcome

Create a reusable agent such as Mira, give her a stable identity, role, instructions, skills, standard operating procedures (SOPs), allowed tools and guardrails, and invoke her with @ from a new or existing chat in any project. Each assignment runs as a distinct instance of the same agent. Mira can inspect her assignments and retrieve her own relevant memories across projects, subject to the owner's chosen scope. Agents can invoke permitted specialists and inspect their returned work.

Agentopia owns these definitions, permissions and memories. Inference continues through the existing ChatGPT OAuth and OpenRouter connections and the existing native Codex execution path. The definitions do not require a managed ChatGPT workspace agent object. This design does not establish complete parity with ChatGPT's product or guarantee identical behavior across models.

## Audit evidence

The source directory is `D:/Users/charl/software/Agentopia`. Its package version at the start of this audit was 0.43.6. It has no Git repository metadata. Another active Codex chat, “Run the program”, is working in the same source directory. The user authorized coordination with that chat. Runtime and release windows are coordinated explicitly; authentication and browser fixes remain owned by that chat.

| Area | Current evidence | Consequence for this feature |
| --- | --- | --- |
| Agent definitions | `desktop/src/contracts.ts`, `desktop/src/settings.ts`, `desktop/ui/AgentSettings.tsx`, `desktop/database/0003-desktop.sql` | Names, instructions, personality, model preferences, tool connections and several settings already exist. Extend the current identity rather than create a second agent directory. |
| Chat ownership | `desktop/src/broker.ts` `beginChat`; `desktop/database/0003-desktop.sql` `desktop_begin_chat` | Both application and database require an existing conversation's agent to match the requested agent. Mentioning another agent needs an explicit participation model. Changing only the composer would fail at the server. |
| Composer | `desktop/ui/Composer.tsx` | The message field has no agent mention picker. Add a keyboard-accessible picker and an explicit selected-agent chip. Resolve mentions to stable IDs. |
| Memory | `desktop/src/project-memory.ts`, `desktop/database/0025-project-memory.sql` and later project-memory migrations | Existing search and read functions are restricted to the current project and completed message sources. Add agent memory separately, retaining project-memory boundaries. |
| Skills | `desktop/ui/NativeSkills.tsx`, `desktop/src/codex-harness.ts` | Skills are discovered from native/private and selected workspace folders and selected for an individual message. Persist agent assignments and make their content available in every project. A path inside Project A cannot be Mira's only skill source in Project B. |
| Execution | `desktop/src/codex-harness.ts`, `desktop/src/codex-mcp.ts`, `desktop/database/0032-codex-harness.sql`, `0033-background-agents.sql` | Native threads, background children, transcripts, controls, reports and restart recovery already exist. Reuse the native runtime and host tool transport. |
| Tool identity | `desktop/src/broker.ts` `executeNative`, `desktop/src/codex-harness.ts` `create`, `desktop/src/tool-service.ts` | Native child calls currently use the root agent's configured tools and executor. Distinct named-agent policies require execution identity to be bound to the actual instance. A nickname or prompt does not establish that boundary. |
| Native context reuse | `desktop/src/codex-harness.ts` `run` | The reuse signature includes instructions and configuration but does not explicitly include stable agent and instance IDs. Two agents with identical instructions still need distinct execution identities. |
| Capacity | `desktop/src/broker.ts` `beginChat`; `desktop/src/codex-harness.ts` | Four ordinary chats can currently run at once, with up to eight native workers and four native threads per worker. Five simultaneous independent Mira assignments require a scheduler and a verified capacity change. Queued work must be visibly labelled queued. |
| Persistence | Desktop PostgreSQL migrations and native execution context | Extend existing ownership, backup and explicit recovery mechanisms. There are 45 desktop migrations at audit time; reserve a new number only after coordinating with concurrent development. |
| Deletion | `desktop/src/broker.ts` `agents.delete`; foreign keys in `0003-desktop.sql` | Deleting an agent currently deletes its owned conversations. Mixed-agent chats require retiring definitions and preserving message attribution; deleting Mira must not delete a shared conversation's other work. |

Validation performed: `npm run desktop:typecheck` passed for main-process and renderer code. This audit made no inference requests and made no runtime, database, account or credential changes. Prior background-agent live evidence is documented in the repository; it was not rerun or independently requalified here.

## Research and architectural options

OpenAI's workspace-agent documentation describes reusable instructions, models, skills, tools, memory and action constraints. It is a useful behavior reference. Its documented workspace access mechanisms are separate from Agentopia's local ownership model.

OpenAI's Agents SDK distinguishes a handoff, where a specialist becomes the active agent, from calling a specialist as a tool and receiving a result. Both interaction patterns fit this request. Its session documentation also separates stored conversation history from the retrieval decisions made before a run. These are architectural references; adding the Python SDK would introduce an unnecessary second execution system here.

| Approach | Implementation and upkeep | Fit for the requested behavior |
| --- | --- | --- |
| Add reusable prompts to current child chats | Small initial change; existing child controls remain usable | Can reuse instructions, but inherited tools and chat-bound history do not establish independent named-agent policies and shared memory. |
| Store definitions and memory centrally; run named instances through the existing native supervisor | Moderate integration work, using the existing provider and execution paths | Recommended. Supports persistent identity, per-instance permissions, cross-project retrieval and progress queries. |
| Build a separate multi-agent inference engine | Largest implementation and maintenance burden; duplicates lifecycle and provider handling | Could support the workflow, but would need to reproduce existing approvals, interruption, recovery and background reporting. |

## Recommended model

### One durable identity, many task instances

Mira's durable record holds an immutable ID, a unique owner-scoped mention handle, display name, role, purpose, instructions, SOPs, assigned skills, model defaults, tool policy, delegation policy and memory scope. Publishing an edit produces a new revision. Display names may change while handles and IDs remain unambiguous.

An instance records an assignment: owner, agent ID and revision, originating conversation, project, requesting instance, native thread, effective permissions, status and timestamps. It links to the real transcript and tool receipts. It has its own working context while sharing authorized agent memory.

The durable identity acts as Mira's central record. It need not consume inference while idle. A Mira instance can inspect that record and other assignments through tools. A separately running supervisory instance could be added later if an actual workflow needs one.

### Invocation and conversation participation

Accepted behavior: selecting @Mira makes Mira the active agent until the user switches. The same conversation and project remain open. Agent selection does not silently change the user's chosen provider/model or broaden file access. Model overrides remain explicit, with any incompatible selection reported before inference.

Persist conversation participants and active agent separately from the conversation's original owner-agent field. Bind every request and response to the actual agent, revision and instance. Keep historical attribution unchanged. An agent switch creates or resumes that agent's native branch using an identity-aware signature and imports the permitted conversation history as labelled reference material. Old system instructions must not become the new agent's instructions.

Resolve the mention using the chosen picker entry and stable ID. Do not treat email addresses, code blocks, quoted text, or incidental @ text as invocation. Show ambiguous names in the picker with role and handle. Submit the resolved ID separately from the message text. Switching agents during an active turn must be explicit: steer the current agent or queue/start the next agent after that turn, without silently redirecting input.

### Agent memory and live work awareness

Store three distinct kinds of information:

1. Reusable knowledge: preferences, decisions, procedures and facts with source links, scope, timestamps and revision history.
2. Assignment records: what each instance was asked to do, where it is working, its latest checkpoint and its next action.
3. Evidence: the saved conversation, verified tool results and completion or interruption events behind a checkpoint or memory.

Accepted behavior: Mira can retrieve her own work across this owner's projects, with an explicit isolated-project option. This does not grant access to every unrelated chat or to other agents' private memory. Project-only memory remains project-only unless the owner explicitly allows its inclusion in agent-wide memory.

Every turn receives a compact identity and relevant memory summary, plus a bounded list of Mira's active assignments. Search/read tools retrieve details as needed. Do not insert all transcripts into every prompt. First implementation can use existing PostgreSQL text search and indexed assignment filters. Add semantic retrieval later only if tests show a meaningful recall gap.

Assignment lifecycle events are saved automatically from actual execution. Reusable memories proposed by a model remain labelled as agent-authored and linked to their evidence. User corrections and deletions supersede those memories. Independent instances append records or use expected revision numbers when updating; stale writes fail with a clear conflict instead of overwriting newer work. Deleted or isolated sources are excluded from retrieval and future prompt snapshots. Previously sent provider context cannot be recalled; changing scope must use a fresh authorized branch where required.

Read tools return the latest saved state with its timestamp. A running model's unsaved reasoning is unavailable. A progress checkpoint is an agent report; a tool receipt establishes the corresponding observed action. The UI must keep that distinction visible.

### Delegation and tools

Expose host-checked operations such as `list_agents`, `invoke_agent`, `list_agent_instances`, `read_agent_instance`, `search_agent_memory`, `read_agent_memory` and `save_agent_memory`. Names are proposed; implement them through the existing declared tool transport.

`invoke_agent` starts an owned named instance through the current native supervisor and returns its assignment ID and status. A persisted receipt prevents duplicate starts. The caller can wait up to 30 seconds and explicitly query saved status and results. The owner’s assignment view refreshes as execution changes. Automatic parent continuation for named assignments is deferred; generic native background reporting retains its existing behavior. Specialist output is reference material and cannot grant permissions.

A target agent can have its own assigned connections, but delegation cannot broaden the caller's approved action/workspace scope. Effective authority is the intersection of account authority, target-agent policy, originating task scope, current project restrictions and current user permission selection. Requests needing broader authority surface that exact missing grant. Agent-to-agent invocation never fabricates a human approval.

Enforce recursion depth, total child assignments, concurrent work and per-task turn limits in host code. Detect delegation cycles. Use a queue when capacity is reached and show its state. Validate the user's five-instance example with five genuinely running independent instances after the capacity change; do not count queued instances as proof of simultaneous execution.

Native V1 subagents remain available for same-policy subtasks. Named specialists with different policy run in separately scoped native executions. Their host tools resolve the real instance, never a caller-supplied impersonation ID.

### Guardrails and skill/SOP consistency

Use host-enforced controls for allowed tools, file scope, project-memory scope, permitted delegation, execution budgets and action reviews. Check current policy immediately before an operation as well as when building the model's tool list. Policy revocation interrupts or invalidates affected work. A restrictive agent policy must also configure native shell/patch capabilities so they cannot bypass host tool restrictions. Full access selected in chat remains bounded by that agent's policy.

Natural-language rules govern tone, procedure, escalation and quality checks; their effectiveness depends on the model following them. Keep this distinction clear in the editor. Skills and SOPs guide execution and cannot enlarge permissions. Persist assigned skill content as owner-controlled revisions or immutable package references available across projects, with content hashes; do not rely exclusively on a transient workspace path. User-owned SOP edits become versioned definition changes.

### Persistence and recovery

Keep definitions, assignments, memory, invocation receipts and policy snapshots in the existing PostgreSQL database with owner-scoped access. Keep native histories in the existing private runtime store. Include both in existing backups. Store no provider tokens in memory, definitions or recoverable task payloads.

Execution currently requires Agentopia to remain open. On restart, restore the saved identity and visible assignment state, mark uncertain work interrupted, and require explicit resumption of an operation whose external outcome is unknown. Memory and source retrieval must respect the currently authenticated account after sign-out/sign-in. Retire an agent separately from deleting memories or conversation history.

## Proposed implementation sequence

1. Definition and ownership foundation. Add `desktop/src/agent-contracts.ts`, `agent-policy.ts` and `agent-service.ts`; add additive database migrations for definition revisions, participants, instances, memories and invocation receipts. Backfill current agents and conversations. Keep migration numbering coordinated. Verify account isolation, revision conflicts and backward-compatible reads against a disposable database fixture.
2. Definition editor. Extend `desktop/ui/AgentSettings.tsx`, `desktop/src/settings.ts` and agent service operations for roles, SOPs, persistent skills, guardrails, memory/delegation settings and revision display. Keep existing tool connection configuration. Verify saving, reopening, retiring and assigning skills in a different project.
3. Conversation participation and @ invocation. Extend `desktop/ui/Composer.tsx`, `DesktopApp.tsx`, `desktop/src/contracts.ts`, `broker.ts`, native execution signatures and the begin-chat database function. Add participant/active-agent state and per-response attribution. Verify old conversations, new/project chats, keyboard navigation, agent switching and retained drafts/model choices.
4. Instance registry and memory retrieval. Add `desktop/src/agent-memory.ts` and `agent-instances.ts`; integrate lifecycle events and context retrieval in `broker.ts`, `tool-service.ts` and `codex-harness.ts`. Add an agent work/memory panel. Verify source citations, bounded retrieval, simultaneous updates, deletions, isolated projects and restart behavior.
5. Named-agent delegation. Add host tool definitions and a scheduler using existing native execution and persisted invocation IDs. Verify different target policies, call cycles, single result delivery, cancellation, account changes and five simultaneous Mira instances within configured limits.
6. Qualification and packaging. Run targeted permission/lifecycle database tests, renderer tests and relevant existing regressions. Use ChatGPT OAuth for routine live qualification. Simulate OpenRouter adapters first and make only a narrowly justified live compatibility request if existing evidence is insufficient. Inspect existing request receipts before retrying uncertain work. Coordinate shared builds, app restarts, migration application and installer work with the other chat.

Do not modify immutable old migration files. Add schema versions and rollback notes. Before release, produce a backup and demonstrate upgrade preservation on disposable data. This repository has no Git checkout to isolate changes automatically; use new dedicated files first and coordinate shared-file edits.

## Acceptance tests

| Scenario | Required evidence |
| --- | --- |
| Stable identity | Mira keeps the same ID, handle, role, assigned skills/SOPs and revision across chats, projects, model changes and application restart. |
| Existing chat invocation | @Mira works in a chat started with another agent; the transcript remains intact and new responses show Mira's identity. |
| Cross-project recall | Save a fresh unique decision in Mira's Project A assignment; invoke Mira in B without including that value in the new prompt. She retrieves and cites its actual saved source. |
| Five instances | Start five independent Mira assignments; confirm five actual running executions and query their recorded status from a sixth invocation when capacity allows. Queue state is tested separately. |
| Specialist invocation | Mira invokes a permitted agent with different instructions/tool policy; that target actually executes and returns evidence attributable to its own instance. |
| Isolation | Another account, an unrelated agent, and an isolated project cannot retrieve prohibited memory, even with direct forged tool arguments. |
| Policy enforcement | A denied tool cannot execute through the host executor, a native shell/patch path, or delegation. A policy change is checked before the next operation. |
| Shared memory updates | Two concurrent instances save updates; both survive. A stale replacement produces a conflict. Deleting/correcting a memory prevents its later retrieval. |
| Honest progress | Queued, awaiting review, running, completed, failed and interrupted states match actual lifecycle events. Progress reports link to evidence and carry timestamps. |
| Recovery | Restart preserves definitions/memory/transcripts and identifies interrupted work; explicit resume does not duplicate an uncertain external action. |
| Provider compatibility | Owned context and the same permission boundaries reach ChatGPT OAuth and tool-capable OpenRouter models. Unsupported tool behavior fails visibly. |
| Existing behavior | Project memory, goals/plans, background children, approvals, attachments, protected drafts and provider switching retain their tested behavior. |

## Decisions requested

The user has been asked:

- Whether Mira may search her own work across all owned projects by default, or only explicitly assigned projects, or only the current project.
- Whether @ invocation changes the active agent until switched, invokes the agent for one message, or starts a multi-agent conversation.
- Whether coordination messages may be sent to the existing “Run the program” chat.

Additional design choices to confirm in the brief:

- Recommended: automatically save assignment checkpoints and source-linked agent memories, with inspect/edit/forget controls; model-authored memories never modify agent policy or instructions. An alternative is user review for every reusable memory write.
- Recommended: per-agent delegation policy with bounded automatic calls to explicitly permitted specialists; tool/action approvals remain in force. An alternative is user review for every agent invocation.
- Initial delivery uses existing local-account ownership and desktop runtime. Multi-user shared-agent publishing and always-on execution with Agentopia closed require separate scope.

The user's explicit choices establish the core behavior and authorize implementation. The remaining recommended defaults are editable agent settings: automatic source-linked memories, bounded delegation to owned agents, and execution through the existing desktop runtime.

## Follow-up integration audit

The next goal turn re-read the current source and confirmed that no persistent named-agent implementation had appeared: the source still has the existing browser-agent module, the desktop migrations still end at 0045, and the package remains 0.43.6. The previous goal turn made progress by producing the design and establishing the typecheck baseline. The present follow-up adds the dependencies below. Pending design choices have not been treated as approval.

### Historical authorship must survive agent switching

`desktop/src/broker.ts` `loadMessages` currently selects `id,role,content,metadata` from `chat_messages_v2`, omitting the existing `sender_agent_id`. `desktop/ui/ConversationTranscript.tsx` supplies one `agentName` to every `ChatMessage`, and `WorkspaceViews.tsx` uses that value for the response's accessible label. A mixed-agent transcript therefore needs changes at all three points, including a visible author label and an author snapshot for retired or renamed agents. The old database already records the assistant's sender ID, so migration can backfill attribution from that ID and the historical request rather than infer it from response text.

Required proof: start with another agent, switch to Mira, rename or retire the first agent, reopen the chat and inspect both visible and accessible author labels. Earlier messages must retain the recorded author and definition revision; switching back must not relabel Mira's messages.

### Plans and goals need explicit ownership

`desktop/database/0017-plans.sql` `desktop_save_plan` creates a plan with `chat.agent_id`; `desktop_implement_plan` creates the implementation goal with the plan's stored `agent_id`. `desktop/src/broker.ts` `runGoal` continues with that goal's agent. These relationships are useful durable ownership records, but they must be exposed separately from the chat's current active agent.

Recommended rule: a running plan or goal retains its assigned agent and instance. A normal @ switch selects who answers the next ordinary message. Reassigning an ongoing plan is a separate, recorded action that pauses work, checks permissions, binds the successor instance and preserves the approved plan revision. Reading a shared plan does not itself authorize another agent to advance it. Any decision to support collaborative progress updates must bind each update to an authorized request and the current expected plan revision.

The plan-implementation function currently rejects a new implementation when any owned request or goal is running. Concurrent named-agent plan work therefore requires reviewing this global gate as well as the four-chat limit. Replace the broad gate only with explicit per-conversation/plan exclusivity and scheduler reservations; otherwise two instances could start the same approved work. Retain revision and action authorization checks.

### Retirement and deletion require different operations

The baseline database has `ON DELETE CASCADE` from `conversation_sessions.agent_id` and `chat_messages_v2.sender_agent_id` to `agents.id`. Desktop requests and plans also cascade from their agent records. Changing the delete button alone would leave database-level deletion capable of removing mixed-agent history.

Use retirement for ordinary removal from the agent directory: stop new invocations and affected active work while keeping the identity record and author snapshots available for history. Hard deletion is an explicit data-removal operation with a transactionally defined scope. Before enabling mixed-agent participation, test deletion/retirement against old single-agent chats, mixed-agent chats, native mappings, plans, goals and source-linked memories. A migration must preserve the owner-deletion cleanup path without allowing an individual agent deletion to erase other participants' work.

### Proposed data contracts and transaction boundaries

These are implementation contracts to refine after the pending choices, not newly created database tables:

| Record | Identity and minimum data | Integrity requirement |
| --- | --- | --- |
| Definition revision | owner, agent ID, revision, handle, display name, role, instructions, SOPs, skill versions, policy, model defaults | Owner-scoped unique handle; immutable published revisions; expected revision on edit. |
| Conversation participant | owner, conversation ID, agent ID, joined time, last active instance | Conversation and agent belong to the same owner; idempotent join; active agent stored separately. |
| Assignment instance | owner, instance ID, agent/revision, conversation/project, assignment, parent instance, state, checkpoint time | Every linked owner is validated; native identity is bound by host code; one active native turn per instance. |
| Memory item and revision | owner, memory ID, agent ID, scope, optional project, content, provenance, source IDs, revision, tombstone | Source access validated at write and read; append/revision updates retain concurrent work; forgotten content excluded from prompt snapshots. |
| Invocation receipt | owner, caller instance, call ID, target agent/revision, resulting instance ID, requested scope, state | Unique caller/call pair; transactionally reserve capacity and instance; reuse receipt on retry; reject changed payload. |
| Response attribution | request/message IDs, agent ID and revision, instance ID, author display snapshot | Actual executor supplies attribution; renderer arguments cannot impersonate another instance. |

Enforce ownership at database relationships and host boundaries. A service-role database connection bypasses row-level read policies, so every new service operation must constrain the authenticated owner explicitly. Caller-supplied agent, project, source or instance IDs are selectors to validate, never authority. Cross-agent delegation checks both the caller's right to invoke and the target's available action scope. Memory tools derive the speaking agent from the bound execution record.

Invocation must reserve its receipt and instance before inference. If startup outcome becomes uncertain, inspect the persisted/native request before retrying. Capacity slots are released from actual terminal lifecycle state; merely returning a tool timeout does not prove execution stopped. Cancellation invalidates queued work and interrupts running native work, then records the observed outcome. Plan ownership changes and agent retirement must serialize against new starts.

### Test harness constraints

`scripts/desktop/test.mjs` acquires the shared desktop operation lock, requires the installed application to be closed, selects a provisioned WSL backend, and may start that backend. Several settings and database tests create fixture accounts and temporarily touch shared settings. These checks should be run only after coordinating the selected disposable backend and shared runtime use. The follow-up audit did not start them, close Agentopia or operate on the user's database.

Existing native protocol tests use a temporary private runtime and a nonresponsive local inference endpoint to establish thread startup, skill discovery and stale-turn rejection without paid inference. These are useful lower-level checks after changes, but do not prove named-agent memory, policy separation or simultaneous assignment behavior. The full acceptance matrix above still requires purpose-built tests and narrowly scoped live ChatGPT verification.

## Primary references

## Implementation checkpoint: native execution, memory and controls

October 17, 2026. The goal remains active. Source implementation includes stable agent profiles and revision history; roles, SOPs, written guardrails and persistent skills; exact tool policies and delegation ceilings; @ selection and per-message authorship; source-linked memory editing/forgetting; isolated projects; saved instances and transcript/tool receipts; a bounded native assignment queue; cancellation and explicit restart recovery.

The identity is a central durable database record. Separate task instances use their own native runtime homes and retain their requesting authority chain. A named assignment inherits the caller's selected provider/model and intersects both agents' permissions. Its receipt and instance are reserved before inference, and repeated receipts do not start another execution. The owner can inspect saved work through tools and the Memory settings panel. Named results are available through bounded waits and explicit result reads; no always-running supervisory model or scheduled agent execution is introduced.

Migrations 0046–0054 applied and passed transactional assertions in the schema-only disposable database `agentopia_agents_a17c49` in the copied runtime `AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd`. They cover revisions and stale writes, participant switching and historical authorship, cross-project memory and isolation, correction and forgetting, owned source relationships, named invocation reservation/claim, inherited authority and goal revocation, cancelled-start prevention, assignment pagination, and old background work remaining visible across newer chat turns. Every SQL fixture run rolls back. Migration hashes and preservation counters are retained in `.supabase/desktop-workspace-agents/database.json`.

Migration 0054 also passed transactional assertions. It tracks memory revisions and assignment sources returned by agent tools, validates them before subsequent inference, and saves these references with native recovery state. A corrected, forgotten or isolated source invalidates stale references. The agent that successfully corrects a memory records the new revision for its current response.

Completed verification:

- Main-process and renderer TypeScript checks pass using isolated build output.
- 29 focused agent/session tests pass for policies, mention parsing, native denial, queued invocation/cancellation, reference tracking and existing durable sign-in behavior.
- 39 existing native, provider, attachment, OAuth, new-chat default, transcript and event regression checks pass through read-only module redirection into isolated build output. The real bundled Codex initializes and calls the private host tool transport without paid inference.
- 15 renderer checks pass using actual Composer and AgentSettings components with a generated fixture. They verify keyboard @ switching, email/code/quote handling, preserved unsaved definition edits, role/skill saving, memory correction and forgetting, long transcript paging, assignment stop controls, isolated scope selection and narrow layout. Full DesktopApp checks also establish existing-chat/draft retention, provider/model retention across addressed and following sends, historical authorship and retired-agent navigation. Light/dark/narrow screenshots and machine-readable evidence are retained under `.supabase/desktop-workspace-agents/ui`.
- A further 12 OAuth recovery checks pass against the combined output, bringing the focused/regression total to 80. Five additional checks pass against the minified renderer delivered in the private 0.44.0 package, with a controlled bridge and no model requests.
- The actual broker, disposable PostgreSQL/PostgREST and native Codex supervisor ran five concurrent Mira instances through controlled inference responses. A sixth instance queried the five saved assignments. Cancelling one stopped its native turn while the other four completed. A completed invocation receipt was reused without replay. A restricted agent under Full access started without native shell, patch or generic spawn tools. Evidence: `.supabase/desktop-workspace-agents/runtime/controlled-1792284711034/evidence.json`.

The runtime integration exposed a real PostgREST JSON-containment encoding bug in the agent mutation path; the source now supplies a JSON string for the authority-chain filter. Expanded integration checks pass for cross-project recall, correction, forgetting, isolation, controlled OpenRouter transport switching and parent cancellation propagating to descendants. A second fresh Electron process reads the same definition and memory and marks an unstarted receipt interrupted without inference. Evidence is retained in the same run directory and its `restart` subdirectory. Model responses were controlled in this suite; these checks establish execution and persistence behavior, not live-model task performance.

The other chat installed maintenance release 0.43.7 from private staging and verified account/data/resource preservation. Shared source/package version remains0.43.6 by the coordination agreement. This feature has not been built into or migrated onto the installed app. Production was last confirmed at 2 users, 101 conversations, 338 messages and 45 migrations; later ordinary verification chats in the maintenance thread may change the conversation/message counters. The original runtime remains stopped.

Live ChatGPT agent qualification is blocked at preflight: the saved access token expired, and the maintenance chat's single renewal returned HTTP 400 / invalid_grant. Agent qualification sent no inference request and did not refresh or write canonical credentials. Connection recovery belongs to the maintenance chat; it has returned the runtime window for disposable-database qualification. Source work, isolated compilation and non-database tests can continue independently. OpenRouter is preserved and is not used as an unsolicited paid fallback.

Remaining work before completion:

1. Preserve the qualified migration bytes and complete any final source changes with focused tests. Source output remains isolated; production migrations are still unapplied.
2. After ChatGPT authorization is restored, run the prepared live acceptance workflow for saved role/SOP/skill use, @ participation, cross-project memory recall/citation and named specialist execution under its own restricted tools. Inspect persisted request IDs before any follow-up; never replay uncertain operations.
3. Preserve the completed DesktopApp renderer qualification while integrating the concurrent authentication, browser and slim-layout changes.
4. The agent release version reservation is 0.44.0; maintenance has reserved 0.43.8. Coordinate the shared build/migration/install window. Back up preserved data and credentials, run applicable combined regressions, and verify the installed release before marking this goal complete.

### Research links

- [ChatGPT workspace agents](https://help.openai.com/en/articles/20001143-chatgpt-workspace-agents-for-enterprise-and-business): reusable definitions, skills, tools and action constraints.
- [OpenAI agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/): handoffs and specialists called as tools.
- [OpenAI sessions](https://openai.github.io/openai-agents-python/sessions/): durable conversation history, retrieval and concurrent update considerations.
- [Codex app-server](https://learn.chatgpt.com/docs/app-server): native thread/turn lifecycle reference; implementation must follow bundled 0.163.0 protocol types.
- [Pinned Codex 0.163.0 child spawning](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/src/agent/control/spawn.rs): native child execution reference, alongside locally audited host identity checks.
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection): require support for requested parameters; Agentopia's existing legacy adapter already sets `require_parameters` for tool calls.

## Private 0.44.0 candidate

The frozen OAuth source proof was verified before staging. A private source snapshot, compiled output and production renderer were prepared under `.supabase/desktop-workspace-agents/candidate-0440`. The application package contains 1,009 compiled modules and all 54 migrations. File comparison verified 6,144 delivered resources. Relative to 0.43.7, six compiled modules changed and eight were added; the other 995 compiled modules are identical. All 2,231 existing dependency payload files are identical; only dependency lock metadata changed.

Package evidence is `candidate-0440/package-proof.json`. The production renderer passed five additional smoke checks using generated records and a controlled bridge (`built-ui/evidence.json`). This establishes the delivered frontend behavior without launching the candidate against the user's database. The private Windows installer was created successfully and its rebuilt application archive matches the qualified package. Its embedded payload and restoration of build-tool files were verified (`candidate-0440/installer-proof.json`). Installation, production migration and live OAuth agent acceptance remain pending.

An optional attempt to add a separate disposable authentication service did not start successfully because the schema-only clone had different schema ownership/search-path configuration. Automatic approval review rejected restarting that additional fixture with “blocked by policy.” It was not retried; its API process was stopped. That extra coverage remains unverified, and no production data or provider credential was changed.
