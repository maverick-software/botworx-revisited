# Native Codex in Agentopia

Agentopia 0.30.0 runs the unmodified Windows Codex app-server 0.163.0 over private standard input/output. New chat requests use this runtime by default. Codex owns inference continuation, tool scheduling, context management, skills, steering, and child-agent execution. The previous custom provider loop remains explicitly selectable by internal legacy-adapter fixtures; it is never an automatic fallback after a native failure.

## Connections and private state

ChatGPT and OpenRouter use the same executable and native agent loop. Each account, conversation, connection, model, workspace permission, and effective tool/instruction scope receives a separate runtime home. No personal Codex home is reused. The native thread identifier is recorded in PostgreSQL and resumed on subsequent requests. Workers now remain supervised while native children continue after parent completion. Dedicated child steering, cancellation, follow-up, recovery and automatic main-agent reports are described in [Background agents](background-agents.md). Multiple parent chats can continue independently. [Dedicated child chats](subagent-chats.md) add sidebar selection, their own composers and drafts, and collapsible live activity in the main chat.

The trusted inference gateway forwards Responses requests to the selected connection. It obtains the current credential from Agentopia’s protected provider broker on each request. Codex receives an ephemeral gateway credential rather than the administrator’s OpenRouter key or the user’s ChatGPT token. Its shell environment excludes provider and gateway credential variables. The gateway binds to loopback, requires its scoped credential, restricts request paths and models, disables remote response storage, and rejects server-side continuation identifiers. Provider failures remain visible and do not invoke another connection.

The bundled catalog selects **native V1 subagents** because ChatGPT-plan authorization rejects the encrypted `agent_message` input used by V2. Model tool modes otherwise remain those in the pinned upstream catalog. Executables and the native execution loop are unchanged. OpenRouter model identifiers are added as catalog aliases. Both GPT-6.1 Sol connections require real inference qualification; the bundled catalog alone does not prove account entitlement. Other OpenRouter models can have different tool and reasoning support.

## Chat interface

- The composer sends ordinary messages using `turn/start`, guidance during work using `turn/steer` with the exact active turn identifier, and Stop using `turn/interrupt`.
- Up to four account-owned conversations can work concurrently. Navigation and drafts remain independent of running conversations. The sidebar identifies running chats; returning to a chat restores its active request.
- The Skills menu calls native `skills/list`. A selected skill is checked again against discovery before submitting its native skill input item. Project skills live under `.agents/skills/<name>/SKILL.md` in an attached workspace folder.
- Work disclosures retain native item identities, progress/final message phases, commands and exit status, file diffs, plans, child-thread activity, and confirmed child results. They do not expose raw reasoning content.
- Native questions and command/file approvals are answered against the originating request, thread, turn, and item. Requests from another Agentopia account are rejected. Standard accounts do not receive native shell execution; Agentopia’s existing scoped tools remain available according to their permissions.
- Existing workspace, planning, memory, and assigned plugin tools are exposed through a private native MCP transport inherited by children. Older saved parent threads may retain their compatible dynamic-tool declarations. Codex calls them through the same host validation, approval, schema checks, persistence, and file-recovery paths used by Agentopia.

## Using the controls

Choose an agent and a connected provider/model, then send a message. While it works, type additional guidance and press Enter or **Steer**. Settings and attachment changes apply to the next submitted turn; steering sends text to the existing turn. **New chat** leaves other chats working. Open a running chat from the sidebar to return to its stream or approvals.

For skills, attach the workspace folder and choose **+ → Skills**. Select a discovered skill before submitting the message. For delegation, ask the agent to use subagents for parallel subtasks. Ask for background work when it should finish the parent response before the children return. Use the child cards or Background agents panel to inspect results, steer, stop or follow up.

## History and recovery

PostgreSQL/Supabase remains the application database for accounts, agents, conversations, requests, native thread mappings, and UI item snapshots. Codex also retains its own internal SQLite databases and rollouts under Agentopia’s private application-data directory. These internal files are part of using the actual runtime.

An older custom conversation, or a changed provider/model/permission scope, imports prior text into a native branch. Returning to a previous branch imports any intervening conversation text before resuming its native thread. This preserves readable conversation context without transferring provider-specific encrypted reasoning. The UI identifies imported branches.

Backups require idle parents, children and report processing. The supervisor closes idle workers before copying native state. They include the PostgreSQL backup, private native runtime state, and Agentopia-managed scratch workspaces. External selected folders require their own backups. Recovery instructions accompany the backup. On another Windows account, reconnect AI providers; Windows-protected credentials are not portable.

Native file diffs are displayed for review. Agentopia tool edits retain the existing checked Undo workflow. Native command and patch side effects are not automatically reversed by changing conversation history; native command/patch Undo is not supplied by this integration.

## Reproducible resources and verification

Run `npm run desktop:prepare-codex` to obtain the pinned Windows package, verify its npm SHA-512 integrity, retain its licenses, and prepare the catalog. Desktop builds verify the executable and catalog checksums. There is no first-launch Codex download and no dependency on a separately installed Codex CLI.

`desktop/tests/codex-native.test.cjs` tests the authenticated streaming gateway and starts the real bundled app-server to check initialization, workspace skill discovery, thread creation, and rejection of stale steering. Existing adapter regression tests explicitly select the legacy loop. `scripts/desktop/test-live-codex.mjs` uses the actual desktop interface, original protected connections, and PostgreSQL; it does not simulate provider replies.

Live evidence is saved under `.supabase/desktop-live-codex/`. Release verification must distinguish those real provider runs from controlled regression fixtures.

### Installed verification — October 16, 2026

Agentopia **0.27.1** was built with Electron Forge, installed over the existing application, and exercised from a temporary working directory. The final automated run passed **126 checks**. The installed real-provider workflow passed concurrent chats, native child results through both GPT-6.1 Sol connections, native thread resume, provider switching with shared text context, composer steering, navigation while another chat worked, native skill invocation, the existing workspace tool bridge, an approved Microsoft Learn MCP search, cancellation, and reopened native activity.

Delegation qualification used **High** thinking, **Default permissions**, and an explicit request to discover and use native delegation. An earlier **Low / Chat only** OpenRouter turn answered the calculation without creating a child; its absence of a native spawn event correctly failed verification. Because the prompt, thinking level, and permission setting changed for the passing run, this does not isolate which change affected the model’s decision. Both the earlier refusal and later passing evidence were retained. The runtime capability is demonstrated under the passing settings; model compliance is not guaranteed for every prompt or model.

A separate application restart resumed the exact same native thread and recalled context added through OpenRouter. The actual **+ → Files and folders → Add folder** and **+ → Skills** controls selected a workspace skill, and the model returned a fresh value present only in that skill file. A subsequent backup included native state alongside PostgreSQL. A full Windows reboot was not performed for this build.

The final preservation audit confirmed the original two accounts, one administrator, unchanged password fingerprints, prior real-provider conversations and files, all 32 migration checksums, healthy Supabase services, and installed code/resources matching the verified build. One existing terminal bootstrap-output check failed in the initial broad run; its isolated rerun and both subsequent complete runs passed.

Verification records: `.supabase/desktop-poc/codex-native/automated-0.27.1.log`, `installed-live-high-0.27.1.log`, `restart-and-backup.log`, `final-data-check.json`, and `installer.json`; real-provider details are in `.supabase/desktop-live-codex/evidence.json` and `restart-and-backup.json`.

Implementation references: [Codex app-server](https://learn.chatgpt.com/docs/app-server), [ChatGPT-plan app-server configuration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [ChatGPT-plan capability restrictions](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [OpenRouter’s Codex configuration](https://openrouter.ai/blog/tutorials/codex-cli-openrouter/).
