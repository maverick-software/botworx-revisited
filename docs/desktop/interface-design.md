# Desktop interface update — 0.6.0

The interface follows the user's requested ChatGPT Desktop interaction pattern: chat is the home, history stays in the left sidebar, agents and plugins have clear destinations, and settings open from the account submenu. Agentopia keeps its own identity and its existing local Supabase architecture.

## Navigation

- New chat, search, agents, and plugins appear above the user's agent shortcuts and conversation history.
- Conversations are grouped into pinned chats, today, yesterday, the previous seven days, and earlier history.
- The chat selector chooses an agent. Agent instructions and models remain editable from the chat options menu and Agents page.
- The account menu contains Settings, administrator access where permitted, keyboard shortcuts, and sign-out.

## Settings panes

General controls message submission and sidebar state. Appearance offers light, dark, and system themes and reading size. AI connections retains the protected provider workflows. Data controls contains recovery backups, diagnostics, and archived chats. Account includes editable profile information and links to AI account management. Administration retains account creation, roles, suspension, and registration controls.

Version 0.4.0 restores the original settings coverage: system API keys, the integration catalog, Stripe configuration, system prompts, personal tool credentials, and a full agent settings navigation pane. **Settings → Agent settings → Configure** opens all 14 original agent sections. The Agents page and chat options open the same editor. Both settings navigation panes are searchable. See the [settings coverage record](settings-coverage.md) for the controls restored, runtime dependencies, and remaining gaps.

Version 0.5.0 adds the composer layout from the supplied screenshots: Add, permission selection, compact agent selection, an anchored model/thinking picker, dictation, voice mode, and send/stop controls. Plan and attachment chips show active context. A goal strip shows persisted state and the authorized turn budget. The microphone records through the desktop permission handler and local Whisper; voice mode adds Windows speech. Clipboard writing remains allowed for the trusted application while camera and unrelated permissions are denied. See [composer and voice behavior](composer-and-voice.md).

Dialogs use focus containment, Escape dismissal, and focus restoration. Menus support keyboard navigation. Motion honors the system's reduced-motion preference. Preferences are separated by Agentopia account and saved atomically in Windows application settings. Queued preference writes finish before sign-out. Choosing an agent from the new-chat composer preserves an unsent draft.

Version 0.5.1 keeps a separate model/thinking choice for ChatGPT and OpenRouter, selects a valid model when switching, shows the active provider in the usage caption, and links the picker to AI connections. Catalog refresh and searching keep large model lists usable. The picker is constrained to the available window height. New chats retain the current model choice for the same agent. [Provider switching behavior](provider-switching.md).

Version 0.6.0 adds inline workspace activity, full saved diffs, Approve and apply / Deny change, and guarded undo. Default permissions governs reviewed changes; Plan mode remains read-only. File references can be forgotten from the file pane. [Workspace behavior](workspace-tools.md).

## History and safety

History is loaded across the current user's agents. Search matches titles and agent names and includes archives. Rename, pin, archive, restore, and delete are PostgreSQL operations checked against the current user. Deleting a conversation requires confirmation and removes its dependent messages; a running response prevents archive or deletion. Account changes clear loaded chats, drafts, and open settings.

The Plugins page represents the two implemented AI connections, reports saved personal tool connections, and opens Tools & credentials. Capability and tool configuration persists in Supabase; the desktop tool execution service remains separate work. Runtime status is stated in the affected panes. Provider authorization and inference behavior remain subject to the existing live-provider release checks.

## References

The requested interaction patterns were checked against OpenAI's [desktop settings documentation](https://learn.chatgpt.com/docs/app/settings), [Windows release notes](https://help.openai.com/en/articles/10003026-windows-app-release-notes), and [chat search documentation](https://help.openai.com/en/articles/10056348-finding-your-chats-projects-and-files-in-chatgpt). Agentopia's available settings and services determine the controls shown here.

Version 0.7.0 adds the separate application rail and secondary project/chat sidebar shown in the supplied reference. A resizable right workspace hosts file/browser tabs, breadcrumbs, Markdown/source/image previews, interactive HTML canvases, and its own resizable folder navigation. Projects own conversation membership in PostgreSQL; pane layout and file grants remain account-specific. [Workspace navigation and verification](workspace-navigation.md).

Version 0.8.0 adds per-chat tool-source selection in Add → Tools & plugins, external-operation review cards, search source cards, and agent tool configuration from Plugins. Its MCP editor discovers tools, protects and rotates Bearer tokens, and enables/disables a server. Saved pane loading retains navigation commands, and browser/canvas tabs preserve their live state when switching. [Agent tool behavior](tools-and-plugins.md).

Version 0.9.0 gives each project a named chat home, editable instructions, selected shared files/folders, a composer context badge, and expandable per-message context records. Project settings opens from the sidebar menu, header, or composer badge. First-turn project assignment is atomic with the saved request; declined sharing keeps the draft available. Both providers use the same project context and permissions. [Project context](project-context.md).

Version 0.9.1 keeps the latest chat reply visible when a restored right pane changes message wrapping. Scrolling back stops automatic following; an explicit down-arrow returns to the latest message. The regression verifies pane restoration, resizing during scroll-back, and return to the latest reply.

Version 0.10.0 adds a hands-free voice pane with a blue speech orb, microphone level, explicit listening/transcribing/thinking/playback state, pause and end controls, and a model picker while paused. Voice settings is a dedicated global pane and is also accessible inside voice mode. Device, voice, rate, silence, and sensitivity choices are account-specific. [Voice controls and verification](hands-free-voice.md).
