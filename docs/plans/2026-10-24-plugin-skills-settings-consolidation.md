# Agentopia: plugins, skills, credentials, and settings consolidation

Draft for review — October 24, 2026

## Intended outcome

Agentopia should present a familiar chat workspace with persistent workspace agents. Users should have one place to connect plugins, one place to manage skills, one place to connect AI providers, and one place to maintain saved credentials. A plugin supplies tools; a skill supplies instructions and supporting resources. Enabling a plugin makes its tools available to authorized agents under the existing chat permissions.

Remove the global Tools page. Replace Public/Personal/Composio with **Integrated** and **Composio**. Move integration setup into Plugins. Remove obsolete settings and consolidate duplicated controls. Preserve accounts, chats, agent definitions, assignments, credentials, schedules, documents, memory, and permission boundaries during the transition.

This document is a code audit and implementation plan. No application behavior, installed files, credentials, or database records were changed to prepare it.

## Audit basis and limits

- Active source: `F:\Agentopia`, Git checkpoint `4dc9b16` (`Add local per-account Composio MCP connections and version menu`). The working tree already has unrelated maintenance changes, including package version `0.44.78`. Preserve those changes.
- Running application observed at `C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.77\Agentopia.exe`. This audit does not establish that every source change is installed.
- The older `D:\Users\charl\software\Agentopia` copy reports `0.43.6`; it is unsuitable as the implementation baseline.
- Reviewed the desktop entry points, all settings destinations and agent-editor sections, plugin declarations and validation, skill import/discovery/materialization, source selection, broker routing, both execution paths, credential stores, relevant database migrations, recovery code, and existing verification scripts. Also searched the older web application, integration modules, services, and server functions for dependencies.
- A TypeScript import traversal surveyed 1,300 desktop TypeScript/TSX files, including generated protocol definitions. Its five roots reached 795 files and found no imports into the older root `src/` application. Static imports are only one form of dependency: the document worker is launched by filename and was checked separately.
- This is a source-backed audit, not a new operational qualification. No live model requests, third-party connection tests, database migration trials, or installed-interface tests were run. Current account-specific credential counts and migration totals must be captured when implementation begins. Historical test scripts and documentation describe prior work; their presence does not establish a fresh pass.

## Findings that determine the implementation

### 1. The global Tools page combines several unrelated, still-used functions

`desktop/ui/CustomizePages.tsx:11` composes the current-chat tool chooser, per-agent connection summaries, the legacy credential panel, and chat-coordination permissions. `desktop/ui/CustomizeNavigation.tsx:7` and `desktop/ui/WorkspaceViews.tsx:25` make it a top-level destination. Similar controls appear again in Settings.

Removing this page is appropriate, but its useful controls need destinations first: plugin selection belongs in the composer, connection configuration belongs in Plugins, saved secrets belong in Credentials, and chat-to-chat permission revocation belongs with workspace-agent permissions.

### 2. Skill-only imports are deliberately stored as plugins

`desktop/src/plugins.ts:44` classifies a package with files and no MCP declaration as `kind: 'skills'`. `desktop/ui/PluginManager.tsx:24` and `:39` put every nonbundled record in Personal plugins. `desktop/ui/CustomizeNavigation.tsx` lists the same records under Installed.

The numbered Codex bundles have a concrete origin: `scripts/desktop/export-codex-skills130.mjs` exported a historical inventory of 228 skills into `codex-skills-01`, `codex-skills-02`, and further packages. It split them to meet package file, byte, and skill limits. `scripts/desktop/import-codex-skills130.cjs` installed and assigned those packages through the plugin registry. These are packaging batches, so they should disappear as user-facing plugins after their individual skills are migrated. The current live inventory must be counted again; 228 is the import script's historical input.

### 3. Three skill representations must be handled together

| Representation | Current storage/execution | Consequence |
| --- | --- | --- |
| Imported or plugin-supplied skill bundles | Base64 files in plugin packages; `NativePluginSkills` validates and materializes them for native discovery | Separating the catalog requires preserving files, digests, grants, and native discovery. |
| Workspace skills | `.agents/skills/<name>/SKILL.md` beneath explicitly selected folders; captured and validated by `chat-workspace-skills.ts` and `preview-workspace-skills.ts` | Their source and access depend on the selected workspace. The global library must distinguish availability from account installation. |
| Persistent agent skills | `AgentProfile.skills`, edited through `AgentDefinitionEditor`/`AgentBehaviorFields`, included in instructions by `agent-policy.ts:19` | These actively affect responses and need a visible, editable representation in the consolidated Skills page. |

`desktop/ui/CustomizePages.tsx:14` currently lists only packaged skills, decodes them in the renderer, and displays their text. Its “Manage skill packages” action returns to Plugins. `NativeSkills.tsx` is a current-chat selector. Neither is a complete skill-management surface.

### 4. Plugin conversion already exists for some tools

The plugin system already has schema validation, account enablement, agent assignment, protected connection wrappers, reviewed imports/updates, search adapters, Chrome DevTools, image generation, and Composio account connections. `Plugins.ensure()` wraps older agent MCP connections while retaining connection IDs and Vault references.

The remaining inconsistency is significant: browser, workspace, terminal, computer, planning, document, memory, scheduling, and agent-coordination tool families are assembled separately in `broker.ts` and `tool-service.ts`. Removing the Tools page alone would leave these sources outside consistent plugin enablement.

Extend the existing plugin and execution services. Keep the underlying browser, terminal, file, agent, and scheduling implementations; place their model-facing tools under bundled plugin declarations and the same availability checks.

### 5. The credential page does not describe all credentials the desktop uses

`ProjectSettingsPanels.tsx:25` now mostly redirects to Plugins and hides older integration credentials in a disclosure. Its legacy editor lists `user_integration_credentials` and supports API-key replacement/revocation. It does not give a unified view of search keys, MCP tokens, MCP browser sign-ins, Composio, and image credentials, or identify their available tools.

The application already stores secrets locally in two protected stores: the local database's Supabase Vault, and Electron `safeStorage` in `credentials.bin`. A unified Credentials page should project metadata from these existing stores. Moving every secret into a new store is unnecessary for the first delivery.

### 6. Several legacy settings are storage controls without desktop execution

`contracts.ts:36` still offers ElevenLabs voice synthesis, Serper-specific search wording, Mistral document reading, document creation, and temporary chat links. Search has an active desktop consumer. Searches found no corresponding desktop runtime reads for the other capability switches. Voice and document processing have newer implementations.

The agent editor also retains channel switches, legacy integration Sources, team/contact permissions, vector datastore assignments, GetZep account-graph preferences, and a Workflows placeholder. Their desktop paths save configuration; the inspected desktop execution paths do not implement those older features. Preserve imported records while removing misleading operational controls. Future service capabilities should return as functioning plugins.

### 7. Some apparent duplication is functioning product behavior

- `UsageSettings.tsx` opens ChatGPT and OpenRouter usage dashboards. Retain it as **AI usage**; it is independent of the older Stripe billing administration.
- `AgentAutomations.tsx` uses the current task scheduler. Both Schedule and Automations in the agent editor render it. Consolidate these entries into one Automations destination.
- Current documents, agent memory, project memory, notifications, storage cleanup, draft recovery, computer sharing, and command permissions are active product functions. Preserve them and remove duplicate entry points selectively.
- `ChatCoordinationSettings.tsx` can revoke ongoing chat-pair grants. Give it a permanent destination before removing Tools & credentials.

### 8. Removing System API keys must preserve search

`settings.ts:19` still defines the old OpenAI, Anthropic, Mistral, and Serper settings panel. Desktop inference uses the AI connection service. However, `plugins.ts:42`, `remote-tools.ts:53`, and creation-preview search still use `system_api_keys` for Serper/Tavily.

Remove the System API keys interface. Retain existing search storage until plugin-owned credential references replace those reads. A ChatGPT browser sign-in and an OpenAI API key are different credentials; migration must preserve their purposes. Do not silently convert or overwrite one with the other.

### 9. Older web and hosted services remain a separate retirement boundary

The desktop renderer builds from `desktop/ui` through `desktop/vite.config.mjs`; its main code builds from `desktop/src`. The older web application's `src/routing/routeConfig.tsx` still exposes billing, admin keys, integrations, credentials, teams, contacts, and old workflow routes. Hosted functions include Stripe checkout/webhooks, Gmail/Microsoft callbacks, messaging adapters, old chat/tool discovery, and older task execution.

These are candidates for a later web/service retirement pass. Desktop nonuse alone does not establish that deployed callbacks, webhooks, or other installations can be deleted. Desktop database baseline migrations also preserve shared historical schema. Leave migration history intact and explicitly resolve service consumers before dropping schema or endpoints.

## Target product structure

| Destination | What the user does there |
| --- | --- |
| **Plugins → Integrated** | View bundled and directly installed plugins together; connect services; save required local credentials; enable/disable; assign agents; inspect supplied tools. Origin may appear as descriptive metadata. |
| **Plugins → Composio** | Manage the per-account Composio browser connection and its agent access. Keep existing API-key connections accessible while their consumers remain. |
| **Skills** | Search human-readable names; read and edit instructions; inspect references/scripts/assets; import/export; assign agents; see source and availability. |
| **Settings → AI connections** | Configure inference providers, accounts, models, and their connection status. |
| **Settings → Credentials** | See saved plugin/service credentials, their plugin and tool associations, status, edit/reconnect actions, and refresh/check results. |
| **Agent editor** | Maintain identity, instructions, skills, plugin assignments, memory, documents, permissions, and automations. |
| **Composer** | Select plugins and skills for the current chat; retain existing permission and Plan-mode controls. |

The Customize navigation contains Plugins and Skills. There is no Tools destination. Settings links that lead to Plugins or Skills open these canonical pages; they do not render another management application.

**Integrated** means plugins managed directly in Agentopia, including imported remote MCP packages. It does not imply they are all bundled, publicly available, or publisher-certified. Keep stored `source` metadata and stable package IDs unchanged when merging the tabs.

## Complete settings disposition

| Existing setting | Planned disposition and reason |
| --- | --- |
| General | Keep composer and sidebar preferences. |
| Appearance | Keep theme and text size. |
| Notifications | Keep working Windows notification preferences. |
| Account | Keep profile, local account identity, and sign out. Link to AI connections. |
| Archived chats | Put the archive manager in Data controls/Storage and redirect the old entry. Render one shared archive-management component. |
| Voice | Keep microphone, dictation, hands-free behavior, and Windows reply voice. An optional external synthesis service can later be supplied by a plugin. |
| Keyboard shortcuts | Keep. |
| Usage & billing | Rename **AI usage** and retain provider dashboard links. Remove wording suggesting Agentopia subscription administration. |
| Data controls | Keep backup, diagnostics, and links to archive/storage/recovery. Avoid rendering a second archive list. |
| Storage | Keep the working chat/working-copy cleanup implementation and its review steps. Link or nest it under Data controls. |
| Draft recovery | Keep recovery functionality, reachable under Data controls. Preserve unsaved agent and preview recovery. |
| Browser | Retain browser preferences; link from the Browser plugin as needed. Browser preferences and permission controls retain one implementation. |
| AI connections | Keep as the single inference connection destination. |
| Skills inside Settings | Remove the embedded selector page; route to Skills. Current-chat selection stays in the composer. |
| Chat tools | Remove. Its useful selection UI becomes **Plugins for this chat**. |
| Plugins & apps inside Settings | Remove the duplicate manager; route to Plugins. |
| Computer use | Preserve window-sharing and authorization controls; expose them from Computer Use plugin details and the current chat. Retain one implementation and clear account/chat scope. |
| Windows terminal | Preserve command enablement/revocation and terminal launch; expose them from Files & Terminal plugin details. Full access remains a separate explicit permission. |
| Tools & credentials | Replace with **Credentials**. Relocate chat coordination to workspace-agent Permissions. |
| Agent settings | Route to the existing Agents directory/editor, avoiding a second list of agents. |
| Administration | Keep local user/role/registration administration and last-administrator protection. |
| System API keys | Remove the page. Classify retained keys by real consumer and surface required ones through Plugins/Credentials or a supported AI connection. Preserve unknown/legacy keys privately. |
| Integrations | Remove the settings tab. Move functioning connector setup and supported advanced configuration to Plugins. Keep old provider metadata privately for compatibility. |
| Stripe billing | Remove the desktop page and its account-test/product-sync actions when no desktop caller remains. Retain stored credentials and billing history for recovery. Hosted Stripe services require a separate consumer check before retirement. |
| System prompts | Remove the desktop legacy library editor after confirming its callers. Offer retained prompts as importable agent-instruction templates when useful. Current desktop agent instructions continue to come from the agent definition. |

This table changes navigation and ownership of controls. It does not authorize deletion of stored recovery data as a side effect of removing a page.

## Complete agent-editor disposition

| Current section | Planned disposition |
| --- | --- |
| General | Keep name, description, provider/model selection, and primary instructions. Use one shared instruction editor for General/Behavior rather than competing saves. |
| Identity | Keep appearance, personality, name, and relevant role fields. Preserve MBTI/purpose metadata; hide fields that do not affect behavior unless they have an explicit descriptive purpose. |
| Behavior | Consolidate instructions, role, procedures, guardrails, and working agent policy. Skill chips open the canonical Skills editor in this agent's scope. |
| Capabilities | Replace the old service switches with functioning plugin assignments and a clear Permissions section. Preserve the active search restriction until migrated. Remove disconnected document, voice, and temporary-link switches. |
| Memory | Keep working agent/project memory and conversation-history limit. Remove vector/GetZep controls from the operational editor; preserve old assignments. |
| Documents | Keep the current document library, assignment, search/read, and PDF-page behavior. |
| Channels | Remove saved-only messaging switches. Connector-specific messaging permissions belong to actual messaging plugins. |
| Sources | Replace legacy integration assignments with plugin access. Retain the old records for compatibility; migrate only permissions with a demonstrated equivalent. |
| Team | Remove the old team-membership picker from desktop settings. Preserve working workspace-agent delegation, selected-agent policy, reporting, and histories. Old team hierarchy needs an explicit mapping before any data removal. |
| Contacts | Remove the legacy contact-policy editor until a functioning Contacts plugin uses an equivalent policy. Keep restrictive grants in storage; do not broaden them during conversion. |
| Apps (internal `mcp` section) | Use Plugins as the single assignment/configuration interface. Fold the raw MCP editor into advanced connection details instead of allowing a parallel creation path. |
| Schedule | Merge into Automations. Provide a reviewed import for older paused definitions; stop offering a second old-schedule creation form. |
| Workflows | Remove the placeholder. Preserve stored definitions for possible future import. |
| Automations | Keep the current scheduler and show the same tasks on the main Scheduled page. Preserve recurrence, time zone, targets, snapshots, and run history. |

## Tool ownership and plugin behavior

Use a small set of bundled plugin families around existing services. The names below are proposed display names; permanent IDs must be selected once and retained.

| Family | Existing implementation to retain |
| --- | --- |
| Browser | `agent-browser.ts`, browser tabs/frames/downloads/uploads, current review UI |
| Files & Terminal | `workspace-tools.ts`, scoped file operations, terminal/interactive sessions, selected-path checks |
| Computer Use | Computer client/service, shared-window selection, screenshots/input reviews |
| Workspace Agents | Named agents, delegation/reporting, chat inspection, chat delivery, memory tools; existing policy restrictions remain |
| Documents & Planning | Agent document reading/search, project-context retrieval, planning tools; native artifact work continues through existing workspace/command permissions |
| Scheduled Tasks | Current scheduler tools and their proposal/review/receipt flow |
| Existing service plugins | Serper, Tavily, Chrome DevTools, Image Generation, direct MCP plugins, Composio |

A bundled plugin may refer to trusted in-process adapters through the existing `com.agentopia` extension. Update its local validation to permit specifically declared bundled adapters. Imported packages must continue to be unable to select host adapters or execute arbitrary installation code. Keep the pinned portable schemas intact; add host behavior in the host extension and enforce its allowlist.

Every tool definition should identify its owning plugin. Use existing `ToolDefinition.hostPlugins` where it already serves this purpose; require complete ownership for the families being migrated. Do not add an independent second tool registry.

The shared availability calculation must apply before advertisement and again before execution:

1. The plugin is enabled for this account.
2. The saved agent, or the unsaved creation being previewed, has the required grant.
3. The required connection and credential are usable.
4. The chat selection permits that plugin/source.
5. Current chat mode, file/window grants, agent policy, and inherited delegation limits permit the operation.
6. The grant, connection, credential, and reviewed schema still match immediately before execution.

Retain the tool broker as the executor and review/history service. Its technical existence is required to run plugin-provided tools. Remove the competing user-facing management model.

Apply ownership checks to **all** execution entry points: ordinary native chat, compatibility provider chat, child/named agents, goals, scheduled tasks, and saved/new-agent previews. Native shell and file-editing capabilities also need plugin-based gating; filtering only the host MCP tool list would leave native actions available. Inspect `codex-harness.ts` worker configuration, native command enablement, sandbox/patch policy, and inherited child settings together.

User-driven file browsing/editing, opening a browser tab, or changing a schedule in the application should continue to work independently of whether an agent has its model-facing tool plugin enabled.

## Skills design and migration

### Canonical catalog and editing

Add a small skill service with a normalized catalog entry: stable ID, machine name, display name, description, source, source revision/digest, enabled state, agent scope/grants, and supported files. Reuse the current validation, private cache, and native discovery mechanisms behind that service.

- Store standalone imported skills independently of `desktop_plugins`. Two new tables, provisionally `desktop_skills` and `desktop_agent_skills`, are sufficient for owned bundles and grants. Keep a unique origin mapping for migration and old-selection aliases. Use service-only writes and enforce account/agent ownership like the plugin tables.
- Project persistent `AgentProfile.skills` into the same catalog with an agent-specific source. Initially keep their existing storage and instruction-injection behavior. Editing one must call the profile service with its existing revision check. This avoids rewriting agent definitions just to unify the interface.
- Preserve each source's activation behavior: persistent agent instructions continue to accompany that agent's requests, while chat-selected/native-discovered skills retain their existing selection behavior. Identify entries by source and stable ID, not just display name. A unified catalog must neither inject the same skill twice nor silently merge separate skills that happen to share a name.
- Project plugin-supplied skills as resources linked to their real plugin. The plugin stays in Plugins because it supplies a connection/runtime; its instructions appear in Skills with their source visible.
- Show workspace skills with their selected workspace and availability. Only an authorized selected folder can supply executable skill context.
- Use a supplied display title where available; otherwise produce a readable title from the machine name while retaining its exact identity. Include source information to distinguish duplicate names. Avoid renaming files or identifiers for display purposes.
- Provide an instruction editor with preview, save/cancel, an expected revision/hash check, and a resource list. Preserve drafts with the existing editor-draft mechanism where practical. A stale edit must ask for reload/reconciliation rather than overwrite newer content.
- Standalone imported copies and agent-owned instructions are editable. For a publisher-managed skill, offer **Create editable copy** so a local modification has its own identity and update lifecycle. Retain the source association. The copy receives no tool or credential grants automatically.
- Workspace edits use existing scoped file-writing checks and expected-content hashes. Skills outside an authorized writable workspace remain viewable with an explicit editable-copy action.
- Import a standalone `SKILL.md`, a skill folder, or a collection without fabricating a plugin manifest. A real combined plugin package remains a plugin import and contributes skill resources to Skills.

### Existing numbered packages

1. Identify candidates structurally: imported, no MCP servers, no trusted runtime adapter, and valid skill files. Never identify migration candidates solely by a `codex-skills-*` name.
2. Capture each skill's instruction bytes, all references/scripts/assets, original paths, content digest, package origin, account enablement, and agent assignments.
3. Create one standalone skill bundle per skill. Preserve relative resource paths and any bundled adapted references. Do not reread a separate Codex installation as a replacement for the saved bytes.
4. Preserve effective access: a disabled source package yields disabled skills; disabled agent grants stay disabled. Keep the same users and agents. New agents do not gain access merely because migration ran.
5. Persist aliases from `agentopia-plugin:<package>:<digest>:skills/<directory>/SKILL.md` to stable skill identities and the migrated revision. Existing chat drafts, saved options, agent-creation drafts, and scheduled snapshots need compatibility resolution.
6. Preserve historical request/message metadata and tool receipts as historical evidence. Do not rewrite their content in place. A scheduler snapshot with hashes/revisions must be upgraded through its own versioned path or resolved compatibly, without silently enabling the task.
7. Verify every file hash, assignment, disabled state, and old selection against the new representation. Then exclude the old skill-only package from Plugins and Installed navigation. Retain its original record and migration mapping for rollback during the transition.
8. Switch discovery, packaged-file readers, creation resources, and the native extra-roots setup to the skill service. Handle changes through the existing worker invalidation path so an active session cannot continue with revoked or stale skill bytes.

Keep instruction-only use in Chat only mode consistent with the current implementation. Loading a skill must never enable its described browser, command, computer, network, or credential capabilities.

## Credentials and integration conversion

### One credentials view over existing protected stores

Expose public metadata only: credential/connection ID, plugin ID/display name, service, account/shared scope, auth method, configured/expired/failed/needs-sign-in status, last checked time, assigned agents, and supplied tools. Tools can be loaded lazily using the current schema-checked catalog.

Provide these actions according to connection type:

- API key/token: replace, remove/revoke locally, and check connection using a documented bounded operation. Saving and checking are separate states.
- Browser authorization: connect/reconnect, disconnect, status check, and supported token refresh through the existing authorization service. Providers that require another consent use Reconnect.
- Protected legacy URL: retain its protected storage and original connection ID. Display host/service information without exposing embedded secrets.
- Shared administrator credential: preserve its shared scope and administrator-only editing. Do not copy it into every user's account or make it editable by standard users.
- Retained legacy credential: identify it as retained, show its known service, and state whether it has a functioning desktop plugin binding. Never mark it connected solely because a secret exists.

Plugin details and Credentials must call the same credential/connection operations, so a replacement is reflected in both. Reuse `Secrets`, local Vault references, `McpOAuthConnections`, image connection handling, and Composio services. Introduce only the missing metadata/projection and typed dispatch; do not copy secrets into catalog records or plugin manifests.

New plugin keys should default to account-owned protected storage. Keep older shared search keys through a compatibility reference until the user intentionally chooses an account-specific key. AI-provider credentials remain in AI connections; an image plugin may reference an existing supported provider connection without duplicating its secret. Preserve the requested disabled state of image generation.

Changing/removing a credential must invalidate discovery caches and affected native/preview workers and require fresh authorization for pending calls. A local removal must accurately describe whether remote access was revoked. Refreshing the display, refreshing authorization, and rediscovering tools are distinct operations with accurate results.

### Converting older integrations

An OAuth provider entry contains connection configuration; it does not define callable tool schemas or an MCP transport. Conversion therefore needs an explicit service-to-plugin mapping:

| Existing family | Conversion route |
| --- | --- |
| Agent MCP connections | Keep their existing plugin wrappers, connection IDs, endpoint/token storage, and effective grants. Merge duplicate-looking UI only when identity and credentials are actually equivalent. |
| Serper/Tavily and other search credentials | Keep working bundled adapters; replace hidden capability/fallback behavior with explicit migrated plugin grants. Add another search provider only with an implemented adapter or usable MCP package. |
| Gmail; Microsoft Outlook, Teams, OneDrive | Bind a supported MCP/Composio connector or implement a pinned adapter using required scopes and real tool schemas. Old tokens can be retained; changing OAuth client/audience/scopes may require reconnect. |
| SMTP, SendGrid, Mailgun, unified email relay, ClickSend, Discord | Package working execution adapters as integrated plugins, or use a supported connector with equivalent operations and permissions. Retain inbound/webhook configuration until its consumers are resolved. |
| DigitalOcean/SSH, Zapier MCP | Preserve working MCP endpoints through protected wrappers; give non-MCP operations an explicit adapter. Do not install old server-management components just to display a plugin. |
| Pinecone/GetZep; Mistral/Azure document processing; ElevenLabs | Keep retained credentials. Introduce service plugins only where a supported execution path is implemented and needed. Existing local documents, memory, and voice remain available. |
| Old OpenAI/Anthropic system keys | Preserve and classify by actual service consumer. Offer only implemented AI-provider or plugin destinations; do not add unused inference providers to complete a migration table. |
| Stripe platform billing | Retire the desktop administration path. A future Stripe business-data plugin would be a separate capability with explicit grants and tools. |

Before enabling a converted integration, demonstrate a schema-validated discovery/read and its intended operation through the shared execution path using controlled fixtures. Test missing credentials, denied access, and revocation. Keep write operations under the user's existing permissions and reviews. If a legacy restriction has no equivalent, retain the restriction and show conversion required instead of granting broader access.

## Implementation slices and acceptance gates

Implement in this order. Each slice must leave a usable application. Tests listed below are planned work, not results from this audit.

### Slice 0 — Record the implementation baseline

**Files/areas:** existing `scripts/desktop` snapshot/recovery utilities; new focused migration inventory helper; new additive migrations in `desktop/database` when needed.

1. Reconcile the currently modified working tree with the release being prepared. Add only consolidation changes; do not reset other work.
2. Capture a recoverable baseline and a secret-free inventory of plugin/skill/grant identities, old selections, credential references, agent/profile revisions, drafts, and schedule states. Reuse current backup infrastructure.
3. Record the exact installed/source version and available verification evidence. Use F: for all output.

**Acceptance:** baseline inventory is complete for the selected account(s); recovery verifies account/chat/agent data and both credential-store paths; unknown source types are reported and retained. No credentials are printed. No tasks or image generation are enabled.

### Slice 1 — Simplify navigation and the plugin catalog

**Modify:** `desktop/ui/CustomizeNavigation.tsx`, `CustomizePages.tsx`, `PluginManager.tsx`, `WorkspaceViews.tsx`, `DesktopApp.tsx`, `SettingsPanel.tsx`, `ComposerContextMenu.tsx`, `AgentTools.tsx`; `desktop/src/contracts.ts`, `desktop-location.ts`, related saved-location restoration.

1. Merge directly managed plugins into Integrated and keep Composio. Remove Public/Personal UI state while retaining package-origin metadata.
2. Exclude skill-only packages from plugin listings and Installed navigation; keep them discoverable through Skills during migration.
3. Relocate chat coordination to agent/workspace Permissions. Preserve the current-chat plugin selector in the composer and advanced connection access in Plugins.
4. Remove the global Tools destination and embedded settings duplicates. Add compatibility redirects for old `/tools`, saved locations, and settings identifiers. Clear or redirect stale selected-plugin state that refers to a skill-only package.
5. Rename AI usage and remove Stripe/System keys settings navigation. Keep backend compatibility until its consumer checks pass.

**Acceptance:** both catalogs are keyboard-accessible; the Installed list contains actual plugins; every existing live control has a reachable canonical destination; Back/Forward, saved location restore, account switching, and current chat selections work. Saved credentials and assignments do not change.

### Slice 2 — Deliver the independent, editable Skills page

**Modify/extend:** `CustomizePages.tsx`, `NativeSkills.tsx`, `AgentDefinitionEditor.tsx`, `AgentEditorResources.tsx`, `AgentBehaviorFields.tsx`, `native-plugin-skills.ts`, `plugin-files.ts`, `plugin-skill-files.ts`, `codex-harness.ts`, `broker.ts`, `CreationApps.tsx`, `creation-tool-resources.ts`, creation skill snapshots and resource readers. Add a focused `skills.ts` service and contract/editor modules; use the existing private-file and draft utilities.

1. Add owned standalone skill storage, grants, origin/alias mapping, and service operations for list/read/save/import/assign/enable.
2. Implement the three-source catalog and editing rules above, including readable titles, duplicate-name disambiguation, full resources, and revision checks.
3. Migrate skill-only packages with a repeatable transaction per source package and verified file/grant reconciliation. Keep source records as rollback inputs.
4. Connect chat selection, agent assignment, new-agent creation, preview discovery, and saved options to stable skill identities. Continue resolving older references.
5. Reuse native discovery without requiring inference credentials or a model request merely to browse/edit account-owned skill data.

**Acceptance:** every migrated skill retains all bytes and effective assignments; disabled skills remain disabled; editing survives restart and changes the next intended request; stale concurrent edits are rejected; workspace and persistent agent skills are visible with their correct scope; a plugin-supplied skill can produce an editable copy; existing drafts and scheduled selections resolve; import, preview, execution, revocation, and recovery work without numbered skill plugins.

**Rollback checkpoint:** retain the original package/grant records until the migrated discovery and restored-data checks pass. Test repeated migration and an interruption between copying and catalog cutover; both must recover without duplicate skill entries or lost edits.

### Slice 3 — Deliver Credentials and plugin-owned setup

**Modify/extend:** `ProjectSettingsPanels.tsx`, `SettingsPanel.tsx`, `PluginManager.tsx`, `McpSettings.tsx`, `ComposioPage.tsx`, `ComposioMcpPanel.tsx`, image/search connection components; `settings.ts`, `plugins.ts`, `mcp-oauth-connections.ts`, `composio-connections.ts`, `image-connections.ts`, `creation-setup-operations.ts`, `broker.ts`.

1. Add the public metadata projection and type-specific connection operations over the existing stores.
2. Replace Tools & credentials with Credentials, including tool associations, edit/reconnect, and refresh/check results.
3. Put setup and supported advanced provider configuration in plugin details. Stop creating unbound “generic API credentials” through a legacy-only form.
4. Add account-owned plugin-key references with shared-key compatibility. Keep AI connections as the inference-provider destination.
5. Preserve Composio account authorization and existing API-key connection workflows. Remove the API-key path only after an explicit migration establishes equivalent access and retained history.

**Acceptance:** every known saved credential is visible as useful public metadata or identified as retained; secrets never return to catalog/UI responses; replacement/reconnection works from either entry point; standard users cannot edit shared administrator keys; one account cannot read or use another account's connection; changed credentials invalidate pending work correctly; image generation remains disabled.

### Slice 4 — Put all agent tool families under plugin enablement

**Modify:** `plugin-contracts.ts`, `plugin-validation.ts`, `plugins.ts`, `tool-contracts.ts`, `tool-service.ts`, `remote-tools.ts`, `broker.ts`, `codex-harness.ts`, `agent-policy.ts`, `native-patch-policy.ts`, `tool-execution-scope.ts`, creation/preview resource services, and the relevant family definitions.

1. Add allowlisted bundled declarations for the existing host families. Require plugin ownership on their model-facing definitions.
2. Extract the duplicated definition filtering into a shared availability function using the existing plugin service and policies. Use it for catalog, native execution, compatibility execution, and previews.
3. Cover native command/patch capabilities and child workers as well as host MCP tools. Add plugin revision/access state to worker reuse/invalidation where needed.
4. Seed grants from effective pre-migration behavior. Migrate the active search switch and implicit Serper fallback into explicit grants before removing them. Preserve existing explicit per-chat source selections and retain compatibility parsing for saved `ChatOptions.tools`.
5. Apply the same controls to scheduled turns, named agents, goals, and creation previews. Do not give previews new write families merely because ordinary chats support them.

**Acceptance:** disabling a plugin removes every tool in its family from agent discovery and blocks a previously prepared call at execution. Enabling restores the family only within existing scope. Account switches, revocation during review, parent/child policy limits, Plan mode, Chat only, selected-files access, and scheduled/preview boundaries remain enforced. Core user-interface file and document workflows continue to work.

### Slice 5 — Consolidate the agent editor and retire dormant settings

**Modify:** `AgentSettings.tsx`, `AgentDefinitionEditor.tsx`, `AgentBehaviorFields.tsx`, `AgentAutomations.tsx`, `AgentMemoryPanel.tsx`, `ProjectSettingsPanels.tsx`, `settings.ts`, `contracts.ts`, `agent-saved-editor-draft.ts`, `agent-saved-editor-draft` consumers, portable/restored settings and editor recovery.

1. Apply the complete settings and agent-section tables above. Keep shared components for controls with multiple legitimate entry points.
2. Merge Schedule/Automations and retain reviewed paused-schedule import. Remove the Workflows placeholder and old-schedule creation form.
3. Remove disconnected service capability/channel/source/team/contact/vector controls after migrated destinations are usable. Preserve retained values and restrictive grants.
4. Update draft validation and restoration so saved old sections/fields are accepted and mapped without discarding unsaved work. Removing a TypeScript union member alone would break retained drafts.
5. Remove unused desktop broker handlers for Stripe administration, legacy prompt editing, and other retired writes once reference checks establish that nothing current invokes them. Compatibility reads/importers remain narrowly scoped where still necessary.

**Acceptance:** no operational control promises an unavailable desktop service; current agent appearance, behavior, skills, memory, documents, delegation, and automations work; old draft recovery remains usable; no duplicate scheduler or archive editor creates competing saves; histories and retained legacy data are unchanged.

### Slice 6 — Convert remaining integrations by service

**Areas:** `src/integrations`, `supabase/functions` service implementations, plugin adapters/declarations, existing MCP and Composio bridges.

Create a small conversion record per family: current consumer, connection/auth scope, exact tool equivalents, grant mapping, credential binding/reconnect requirement, bounded check, and retirement condition. Deliver functioning connectors incrementally through Plugins. Prioritize integrations with saved credentials and actual current use, established by the implementation inventory.

**Acceptance per connector:** the assigned agent discovers and uses its real schema; missing/expired credentials produce a working setup route; restrictions and tool-call reviews are preserved; disabling stops access; old records remain recoverable. A provider row with no callable implementation must not be labeled ready.

This slice has variable scope. The code cannot establish which external services are still deployed or which saved connections the user currently relies on. Inventory resolves that before selecting adapters; unsupported services remain clearly retained until converted.

### Slice 7 — Qualify, install, and remove proven dead code

**Areas:** desktop verification scripts, packaging/recovery, navigation/settings documentation, remaining legacy desktop modules and dependencies.

1. Run focused checks for changed behavior, then the relevant installed acceptance flow using a recoverable upgrade. Keep outputs on F:.
2. Verify actual installed navigation, skill edit/restart, plugin enablement, credential replacement/reconnect, one ordinary ChatGPT OAuth tool workflow, and a workspace-agent workflow. Use controlled provider adapters for OpenRouter format coverage unless that connection itself changed. Do not repeat uncertain paid operations.
3. Reconcile accounts, passwords, chats, files, plugin/skill grants, credential references, agent revisions, draft recovery, schedules, and disabled image settings against the baseline. Retain migration receipts and recovery instructions.
4. Delete unused UI and retired desktop handlers only after static and runtime consumers are resolved. `GoalDialog.tsx` and `ComposioConnectionCard.tsx` currently have no normal desktop import callers and are deletion candidates; inspect test/dynamic references before removal.
5. Keep `document-worker.ts`, `shared-formulas.ts`, and `spreadsheet-layout.ts`: the document worker is dynamically launched by `documents.ts`. Static nonreachability does not establish they are unused.
6. Update current guides and mark older checkpoint documents historical. Audit root dependencies against both application builds before removing libraries.
7. Treat old web/hosted endpoint deletion as a separate final retirement checklist tied to identified deployment consumers. Leave historical migrations immutable.

**Acceptance:** the shipped application demonstrates the requested structure and preserved behavior; no active execution path bypasses plugin disablement; changed data restores correctly; remaining unconverted integrations and retired-service dependencies are explicitly listed. A passing source test alone is insufficient for installed completion.

## Verification plan

Reuse the existing checks that match each slice, updating expected navigation deliberately rather than weakening their behavior checks.

| Area | Existing starting points | New evidence required |
| --- | --- | --- |
| Static correctness | `npm run desktop:typecheck` | New contracts and all callers compile. |
| Plugin import/update | `test-plugin-import.mjs`, `test-plugin-updates.mjs`, `test-plugin-compatibility.mjs` | Mixed packages remain supported; skill-only imports route correctly; endpoint changes retain existing review rules. |
| Skills/native lifecycle | `test-plugin-skills.mjs`, `test-plugin-skill-storage.mjs`, `test-plugin-child-lifecycle.mjs`, `test-preview-skills107-*` | Standalone migration, all resource hashes, old selection aliases, editing/stale edits, per-agent grants, worker invalidation, preview and workspace scope. Check harness paths before reusing older fixture scripts. |
| Catalog/settings | `test-plugin-catalog55-ui.mjs`, `test-tool-settings-ui.mjs`, `test-agent-app-catalog68-ui.mjs` | Integrated/Composio; Skills excluded from plugins; canonical routes; keyboard/Back/Forward; correct agent/chat scope. |
| Credentials/Composio | `test-composio-mcp161.mjs`, `test-composio-mcp-ui161.mjs`, `test-composio-encryption.mjs`, current MCP OAuth tests | Metadata-only responses, replacement/check/reconnect, cross-account isolation, shared-key authority, legacy retention. |
| Permissions and providers | Existing native-policy, plugin-revocation, browser, terminal, and computer tests | Disabled bundled families block native and host paths; both provider adapters; child/preview/scheduler behavior. |
| Schedules and recovery | Current scheduler, portable settings, editor draft, and recovery suites | Old schedule snapshots and drafts resolve skill/plugin aliases; restored data preserves migration state; current and migrated databases restore. |

Use fixtures for service writes and expired/revoked credentials. Live verification should establish only the remaining real integration uncertainty, using ordinary ChatGPT OAuth for routine model checks. Do not enable image generation, broad access, old paused schedules, or additional accounts as a testing side effect.

## Data migration, rollback, and deletion rules

- Add new migrations after the current highest migration at implementation time. Never edit applied SQL or hard-code `0085` merely because `0084` is currently the last file.
- Store origin mappings and completed migration receipts transactionally. Repeating migration must reuse the same records and must not duplicate grants or overwrite newer user edits.
- Migrate by account/source and commit only after byte/grant reconciliation. Preserve database ownership protections and existing secret references.
- Keep original skill-only plugin records and selection aliases during the rollback window. Hide migrated source wrappers from product catalogs; do not remove their underlying bytes prematurely.
- A rollback before new writes can restore the prior package/configuration. After users edit skills or create new bindings, an old binary may not understand the new data. Rollback then requires a compatible exporter/down-conversion or restoration of the verified baseline plus explicit recovery of later work. Do not imply that simply reinstalling the previous binary preserves new edits.
- Preserve old schema and service credentials until consumer checks pass. Removing visible controls, retiring handlers, moving data, and deleting schema are separate checkpoints.
- Deletion of old tables/services requires: replacement or retained-import access, no active readers/writers/callbacks, verified backup/restore, and a record of what is intentionally retired. Shared historical schema may remain indefinitely if removal creates risk without user benefit.

## Recommended delivery order and scope

The first user-visible delivery should merge plugin tabs, remove the Tools destination and duplicate Settings entries, route working controls to their canonical destinations, and keep all saved state intact. The next delivers independent skill storage and editing; Credentials follows; bundled tool gating then completes the architectural consolidation. Retiring dormant agent controls follows their replacements. Remaining integration conversion proceeds service by service.

This avoids coupling a useful navigation improvement to an open-ended rewrite of every historical integration. Completion of the overall objective still requires all active agent tool sources to obey plugin enablement and all skill forms to be manageable as skills.

Use the existing plugin service, secret stores, execution broker, native skill cache, recovery system, and scheduler. Add the standalone skill records, public credential projection, shared availability checks, and compatibility mappings required by these concrete outcomes. A new marketplace, generic automation engine, parallel credential vault, rewritten chat runtime, or wholesale database replacement is outside this plan.

## Source map for implementation

Paths are relative to `F:\Agentopia`; line numbers reflect the audited working tree and will move as changes are made.

| Source | Audit anchor |
| --- | --- |
| `desktop/ui/SettingsPanel.tsx:21`, `:30` | Settings IDs and complete navigation, duplicated managers |
| `desktop/ui/CustomizePages.tsx:11`, `:14`, `:18` | Composite Tools page and packaged-only Skills catalog |
| `desktop/ui/CustomizeNavigation.tsx:7` | Tools navigation and unfiltered installed plugins |
| `desktop/ui/PluginManager.tsx:24`, `:39` | Public/Personal/Composio split and bundled/imported grouping |
| `desktop/ui/ProjectSettingsPanels.tsx:13`, `:19`, `:25`, `:35`, `:40` | System keys, provider catalog, legacy credentials, prompt library, Stripe |
| `desktop/ui/AgentSettings.tsx:36` | Full legacy agent-section navigation; current editor also includes active preview/creation/resource paths |
| `desktop/ui/AgentEditorResources.tsx:9` | App sources and persistent agent skill chips |
| `desktop/src/contracts.ts:8`, `:15`, `:34`, `:36` | Saved views/options, agent sections, old capability definitions |
| `desktop/src/plugins.ts:18`, `:27`, `:36`, `:68` | Skill package reads, legacy MCP wrapping, catalog, search fallback |
| `desktop/src/plugin-validation.ts:21`, `:54` | Package restrictions and bundled declarations |
| `desktop/src/native-plugin-skills.ts:19` | Byte integrity, materialization, native extra roots, legacy skill selection identity |
| `desktop/src/chat-workspace-skills.ts:13` | Selected workspace skill capture and request validation |
| `desktop/src/agent-contracts.ts:1`, `desktop/src/agent-policy.ts:19` | Persistent skill records and injection into real agent instructions |
| `desktop/src/remote-tools.ts:49`, `:55` | Search credential/capability checks and MCP/Chrome/Composio sources |
| `desktop/src/tool-service.ts:107`, `desktop/src/broker.ts:1193`, `:1215` | Definition assembly in executor and both chat execution paths |
| `desktop/src/codex-harness.ts:74`, `:196`, `:219`, `:464` | Native worker setup, skills, sandbox/tool settings, access-change invalidation |
| `desktop/src/tool-execution-scope.ts:24` | Restricted preview tool families and broker-issued execution scopes |
| `desktop/src/creation-tool-resources.ts:12`, `creation-tool-scope.ts:2` | Unsaved agent plugin grants and versioned resource identities |
| `desktop/src/settings.ts:35`, `:91`, `:101`, `:122`, `:129` | Legacy assignment queries, credentials, system keys, prompts, Stripe handlers |
| `desktop/src/secrets.ts:7`, `mcp-oauth-connections.ts:15`, `image-connections.ts`, `composio-connections.ts:27` | Protected local credentials and specialized service scopes |
| `desktop/database/0030-plugins.sql`, `0058-plugin-updates.sql` | Owned plugin/grant/connection records and update transaction |
| `desktop/database/0065-legacy-schedule-import.sql`, `0069-explicit-agent-integrations.sql`, `0082-creation-package-skills.sql`, `0084-account-composio-preview.sql` | Schedule compatibility, explicit access, creation skills, account Composio preview boundaries |
| `desktop/src/portable-settings.ts:19`, `restored-settings.ts:7`, `portable-backup.ts` | Saved-option validation and recovery boundaries |
| `scripts/desktop/export-codex-skills130.mjs`, `import-codex-skills130.cjs` | Why numbered skill bundles were introduced and how they were granted |
| `desktop/vite.config.mjs`, `desktop/tsconfig.json`, `scripts/desktop/build.mjs` | Actual desktop build roots and packaging |
| `src/routing/routeConfig.tsx`, `src/integrations`, `supabase/functions`, `services` | Older web/service consumers requiring a separate retirement decision |

