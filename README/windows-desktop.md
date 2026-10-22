# Agentopia for Windows

Agentopia Desktop keeps PostgreSQL and Supabase. Electron opens the React interface and supervises a dedicated WSL 2 distribution named `AgentopiaRuntime`. The application uses the native Supabase runtime; Docker, a separate Node.js installation, and a separate Supabase CLI installation are not application prerequisites.

The private release supports local account sign-in, administrator account management, agent configuration, OpenRouter, individual ChatGPT connections, streamed text conversations, cancellation, saved history, database backups, and diagnostic export. The original web application and its database remain available separately for recovery.

## Install and open

Use Windows 11 x64 with WSL 2 available. Run `AgentopiaSetup.exe`, then open **Agentopia** from its desktop or Start menu shortcut. The installer is an unsigned private build. First launch imports its bundled Ubuntu 24.04 runtime and initializes a private database. An existing WSL distribution with the same name must pass Agentopia's runtime identity check before the application uses it.

First launch displays setup progress and errors. **Retry startup** repeats setup; **WSL installation instructions** opens Microsoft's prerequisite guide. Windows virtualization and WSL feature changes may require administrator access and a Windows restart.

Each installation generates its own persistent Supabase API and signing keys. A fresh database also receives its own encryption root. These private values stay in the dedicated runtime and are generated after installation; they are excluded from the application package. Migration and recovery retain the source database encryption root so existing encrypted records remain readable.

A fresh database displays the first-administrator setup form. On this computer, the installation migration retains `admin@agentopia.local` and `user@agentopia.local`, their original passwords, profiles, and roles. Account changes in the desktop database are independent of the recovery database used by the original web application.

## Connect AI providers

Open the account menu at the bottom of the sidebar, choose **Settings**, then **AI connections**. The **Plugins** sidebar page also opens these connection settings. It shows the available OpenRouter and ChatGPT connections; agent MCP connections and configured web search are available through reviewed calls.

An administrator opens **AI connections**, enters the OpenRouter API key, loads available models, chooses a default, and selects **Validate and save**. The default can later be changed with **Save default model** while leaving the key field empty. Standard users can use the shared connection; they cannot retrieve its credential or change it. The key is encrypted with Windows credential protection and stays in the trusted application process.

Each Agentopia user can select **Continue with ChatGPT** in AI connections. Authorization opens the system browser. The connection is associated with that Agentopia user, the validated ChatGPT account identity, and the issued client registration for its workspace. Credentials renew locally and remain protected by Windows encryption. **Disconnect ChatGPT** removes the connection.

ChatGPT must grant permission to use the account's plan for this private application. Application sign-in and AI inference authorization are separate checks. A successful browser sign-in alone does not demonstrate plan access. Provider failures remain visible; the application does not choose a different provider automatically.

## Agent tools

Open Plugins → Configure tools to add a remote MCP server, optionally supply a protected Bearer token, discover its tools, and enable the connection. In a chat, Add → Tools & plugins chooses the connections exposed to the agent. External calls show the server, operation, and arguments and require approval. The same workflow works through ChatGPT and OpenRouter. Serper web search additionally requires the administrator’s API key and the agent’s Web search capability. [Behavior and supported connections](../docs/desktop/tools-and-plugins.md).

## Projects and workspace panes

The narrow rail switches application areas while the secondary sidebar holds agents, projects, chat history, and the account menu. Create projects with the Projects plus button, optionally link a local folder, and move chats through Chat options → Move to project. Removing a project keeps its chats and files.

Project settings also provides instructions and shared files/folders. New chats and goals use that context from their first message through either provider. A composer badge opens it for review, and each message retains its original instructions and supplied file snapshot. Default permissions asks before sharing; Chat only keeps instructions and excludes file contents. [Project context](../docs/desktop/project-context.md).

The workspace button opens a resizable right pane with file tabs and folder navigation. It previews Markdown, source, and supported images, runs isolated HTML canvases, and opens sandboxed browser tabs. Use Attach project folder to include a folder in a message under the selected sharing permissions. Browsing alone does not send files to an AI provider. [Controls and limits](../docs/desktop/workspace-navigation.md).

## Agents and conversations

The default home is the chat workspace. The sidebar contains **New chat**, **Search chats**, **Agents**, **Plugins**, your agents, and your conversation history across agents. Recent chats also appear on the home screen. Select an agent in the sidebar or the chat selector, then send a message. The **Agents** page manages agent instructions and provider/model preferences.

**Settings → Agent settings → Configure** opens the original 14-section editor: General, Identity, Behavior, Capabilities, Memory, Documents, Channels, Sources, Team, Contacts, MCP, Schedule, Workflows, and Automations. Personality and conversation-context limits affect desktop chat. Tool switches, resource assignments, channel permissions, and MCP configuration are stored in the original database structures; their desktop execution services remain required. New and edited schedules are saved paused. Workflows and Automations retain their original planned-feature status.

The account Settings menu also includes editable profiles, personal tool credentials, and administrator panes for **System API keys**, **Integrations**, **Stripe billing**, and **System prompts**. Supabase Vault protects saved service credentials. Stripe account/product checks require a Stripe credential; billing authorization, checkout, and webhooks require a deployed service. The [settings coverage record](../docs/desktop/settings-coverage.md) describes each restored control and the remaining service dependencies.

The menu beside each chat supports rename, pin, archive, and permanent deletion. Pinned chats stay at the top. Search matches titles and agent names, including archived chats. **Settings → Data controls** lists archived chats and lets you restore them. History management is saved in PostgreSQL and stays private to the signed-in account.

**Stop response** cancels a request and saves the partial response with its cancellation status. Interrupted responses retain a distinct status when the application restarts. You can copy assistant replies with the copy button beneath them.

The model control beside the microphone opens an account-specific model picker and thinking slider. **Add (+)** contains Files and folders, Plan mode, Goal, and Voice mode. The permissions control selects Chat only, approval for each file-sharing turn, or access to the selected files. Model/thinking choices, plan state, and supplied file snapshots are recorded with the conversation. Goals have an explicit turn budget and pause/resume controls.

The microphone uses bundled local Whisper English transcription and inserts dictation for review. Voice mode provides tap-to-talk messages and spoken replies through Windows' installed voice. Recording audio stays on this computer and is deleted after transcription; sent text uses the selected provider. Text/code files and PNG/JPEG/WebP images are supported. See [composer and voice behavior](../docs/desktop/composer-and-voice.md) for limits, permission enforcement, goal behavior, and verification.

**Settings → Appearance** offers light, dark, and system themes plus conversation text size. **General** controls whether Enter or Ctrl+Enter sends a message. Shift+Enter always adds a line. These preferences are remembered separately for each account on this Windows profile. Administration and backup controls appear in Settings for administrators.

Keyboard shortcuts: **Ctrl+Shift+O** starts a new chat, **Ctrl+K** searches history, **Ctrl+B** collapses or expands the sidebar, **Ctrl+,** opens Settings, and **Esc** closes the active menu or pane. Settings panes keep keyboard focus within the dialog.

Account sign-in, agent editing with a previously selected model, and saved history use the local backend and work without internet access. AI requests and refreshing provider model catalogs require internet access.

## Backups and recovery

An administrator selects **Back up**. The application exports a consistent database snapshot, logical recovery archives, the database encryption root, a checksum manifest, and a Windows recovery helper. Keep the whole backup folder private. Provider connections are protected by the current Windows account and must be reconnected after recovery under another Windows account.

To recover into a fresh Windows user profile or another computer, prepare WSL 2 and copy the entire backup folder. Before installing or launching Agentopia, open PowerShell in that folder and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Restore-Agentopia.ps1
```

Install and launch Agentopia. Its first startup verifies the archive checksums and restores accounts, roles, passwords, agents, and text history. The helper refuses to overwrite an existing `AgentopiaRuntime` distribution. Preserve a damaged runtime before investigating or recovering into a fresh profile. This first release backs up database content and its encryption root; file attachments are outside the text-only release scope.

Manual installer upgrades retain the dedicated WSL database and Windows application data. A database backup precedes an application/schema version change. Ordinary uninstall removes application files and shortcuts while retaining the runtime and data. Data removal is a separate explicit operation.

## Project commands

```powershell
npm ci
npm run desktop:typecheck
npm run desktop:test
npm run desktop:build
npm run desktop:make
npm run desktop:test:installed
```

`desktop:test` expects an already running native `AgentopiaRuntime` database with exactly one administrator; its disposable database fixtures are removed afterward. To use the separate proof runtime, set `AGENTOPIA_NATIVE_TEST_STATUS` to a private native stack status JSON file. Tests do not print service credentials.

`desktop:prepare-runtime` builds the clean Linux template from verified Ubuntu and Supabase downloads and the native software cache in the installed `AgentopiaRuntime`. It requires the verified source archives and checksum manifest in the private `.supabase/desktop-poc/downloads` build directory; preparing the factory image is a maintainer operation. It exports software and dependencies without accounts, stack state, database files, encryption roots, or provider credentials. `desktop:migrate-local` prepares a private export of the original local database in Windows application data. Those migration files are excluded from the installer.

The Forge build stages only the compiled desktop application, its runtime dependencies, frontend assets, versioned database resources, and clean Linux image. It excludes source environment files and private setup/migration directories. Builds use an exclusive lock to prevent concurrent packaging from changing staged resources.

Installed workflow tests use disposable accounts and an isolated Windows credential profile. Their provider replies are simulated. Live OpenRouter and eligible ChatGPT requests remain separate release checks.

See `docs/desktop/implementation-status.md` for evidence and remaining release gates.

The composer remembers a model/thinking choice separately for each provider. Switch providers without starting another conversation; the usage caption follows the next request. See [provider switching](../docs/desktop/provider-switching.md) and the [desktop parity audit](../docs/desktop/parity-backlog.md). `desktop:test` starts the existing provisioned Agentopia runtime when it is stopped and runs the database and adapter checks; it does not create a new installation.

Version 0.6.0 adds [workspace tools and reviewed edits](../docs/desktop/workspace-tools.md). Select a folder, choose Default permissions, and ask for a change. The conversation presents a diff for approval before saving; completed changes can be undone when the file still matches. ChatGPT and OpenRouter use the same controls. Plan mode and Selected files access remain read-only.

Version 0.10.0 adds [hands-free voice](../docs/desktop/hands-free-voice.md). Open Voice mode and choose Start conversation. A pause sends the spoken turn; speaking again interrupts the reply. Pause or End voice releases the microphone. Settings → Voice selects a microphone, installed Windows reply voice, rate, sensitivity, and pause interval. Dictation still inserts text for review. Both AI connections use the same local transcription and conversation path.
