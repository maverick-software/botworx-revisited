# Agentopia 0.43.7 maintenance release

Installed October 17, 2026. Agentopia is open with the existing administrator signed in automatically and ChatGPT selected for a new chat.

## Delivered behavior

The chat sidebar has a remembered width between 200 and 400 pixels. Drag its thin boundary, use the arrow keys, hold Shift for a larger step, or use Home/End for the limits. The workspace and folder-navigation boundaries use the same divider component. The visible lines remain one pixel wide while their invisible pointer targets are wider. Caption, chat-header and tab bars are smaller, and scrollbars are thinner.

Successful sign-in and credential renewal are saved immediately through Windows encryption. Temporary account-service failures retain the saved session for startup Retry. Explicit logout remains effective during server failure. Ordinary installed startup restored the existing account without password entry.

Screenshot-based browser actions inspect the actual control inside embedded documents. Review records include its destination and identity; replacement or relevant navigation invalidates stale input. Dedicated restrictions on password, payment, verification and file fields remain enforced. The separate browser guide describes the tested geometry and remaining live-model qualification.

## How this release was assembled and checked

The source directory is shared with the persistent-workspace-agent and slimmer-UI chats. The release used a private copy of the installed 0.43.6 baseline, restored its original renderer byte for byte, and applied the qualified maintenance changes. Six existing backend modules changed, one sign-in module was added and 994 baseline modules remained identical. Production keeps its 45 migrations. The agent feature's later migrations and unfinished integration were excluded. The shared development package version remains unchanged under that coordination agreement; subsequent installers must exceed 0.43.7.

All 258 distinct regression checks have passing results. Nine initial failures came from direct-require fixtures lacking the candidate's sibling helper-resource directory. The affected files were rerun with the exact resources in that expected layout; the temporary junction was checked and removed before packaging. One interactive session then timed out in the affected-file batch and passed a targeted diagnostic rerun. The precise timeout trigger was not established. The original and recovery logs remain available.

The actual renderer passed drag, keyboard, bounds and reload tests for all three dividers in light/dark layouts at 960, 1280 and 1600 pixels. The exact packaged interface passed ChatGPT defaults, explicit provider switching, attachment context without a sharing dialog, project context and history. Its sidebar resize was saved through the actual broker/encrypted store and restored alongside the temporary account after normal process exit and backend cold start. A project-context fixture initially wrote workspace state behind the open renderer; the corrected fixture opens the pane through the visible control and waits for persistence before reloading. No product change was needed for that fixture correction.

The standalone authentication workflow passed five actual Electron process exits/reopens, including credential rotation after failed role checks, temporary failure, persistent logout and checks for absence of plaintext credentials. Thirteen Chromium iframe-pointer scenarios passed against the exact candidate modules. No live provider requests were made for this maintenance release; earlier saved live results were checked for preservation.

## Installation and preservation

The updater verified a five-file database/encryption backup before its single installer attempt. All 6,137 delivered files match the prepared release, including 1,001 modules and all 45 migrations. Both original accounts, passwords and roles, 101 conversations, 338 messages, encrypted credentials, backend binding and 795 browser-profile files are preserved. A hidden verification-helper window needed a harmless initial document before its waiting driver could finish and quit normally; installation was already complete and was not repeated. The helper template was corrected for future use.

The ordinary installed application restored the administrator automatically, reopened history and workspace tabs, and selected ChatGPT. Six core native Supabase services are healthy. The retained original WSL distribution remains stopped, and application debugging is disabled. The desktop shortcut points to the ordinary Squirrel launcher with the 0.43.7 working directory.

Evidence: `.supabase/desktop-maintenance-0437/release/release-summary.json`, `release/installed-resources.json`, `release/data-after.json`, `release/normal-login.json`, `release/normal-cold-start.json`, `prepared-ui-recovery/evidence.json` and `regression-summary.json`. The preserved installer is `release/AgentopiaSetup-0.43.7.exe` under that directory.

## Remaining qualification

Live ChatGPT-driven use of the new iframe coordinate-review path remains pending. Persistent-workspace-agent implementation continues in its coordinated chat and disposable database. Personal Chrome consent, remaining interface/voice/computer/skills parity, clean-machine installation and a full Windows reboot of this release remain separate work. The broad desktop goal remains active.
