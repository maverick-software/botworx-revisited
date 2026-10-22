# Live folder navigation

Version 0.18.0 extends the separate application rail, chat sidebar, and right workspace pane. The folder navigation in the right pane now follows local file changes while retaining expanded folders and the selected file.

## Using the folder tree

Open a workspace folder and expand its directories. Files created, renamed, removed, or saved by an agent, a terminal command, or another application appear in the corresponding expanded directory. The selected document preview refreshes for changes in its directory. An open text editor retains its protected draft; an external file change still requires the existing conflict review before Save can replace it.

Use **New folder** beside the file filter, or a directory's **Actions → New folder here**. Enter a relative path inside the chosen workspace. Parent folders must exist. Creating a folder never replaces an existing file or folder. Directory actions also offer **New text file here** and **Copy relative path**. File actions offer **Open file**, **Edit file** for supported text/code, and **Copy relative path**.

**Refresh folder navigation** reconnects folder notifications and reloads listings while keeping expanded directories open. This is also available when a drive or folder becomes unavailable. Updates do not force the navigation to scroll back to the selected file each time another file changes.

Folder creation is an explicit local user action. The AI tool catalog continues to provide the existing reviewed text-file writes. Agent-driven directory creation, reviewed rename/move/removal operations, and recovery for those operations remain further work. Windows File Explorer can still manage local files outside the application.

## Privacy, permissions, and limits

Browsing and updating the tree do not send file contents to an AI provider. Attaching files and sending a message continue to use the same ownership and sharing checks for ChatGPT and OpenRouter. No provider adapter, credential, selected model, conversation snapshot, or database migration changes in this release.

The backend watches only visible, expanded directories, without recursive traversal. It supports up to 64 active folder subscriptions. Collapsing a directory, hiding the tree, changing accounts, signing out, reloading the window, losing its renderer, or closing the application releases its subscriptions. Pending subscriptions from an earlier window cannot start after a reload. Hidden, credential, dependency, linked, and protected application/backend paths retain the existing restrictions. Notifications contain subscription identifiers and relative directory paths; they do not contain absolute paths or file contents.

Notifications are grouped over a short interval. A periodic directory check detects an unavailable, moved, or replaced directory and reports that Refresh is needed. Filesystem notifications have operating-system and network-drive limitations. When notification registration is unavailable, additions and removals are checked every few seconds, with a visible notice to refresh file contents manually. See the [Node filesystem documentation](https://nodejs.org/docs/latest/api/fs.html#fswatchfilename-options-listener).

The filename filter still applies to filenames in loaded directories. Each listing retains the existing 200-entry limit. Expanded directories stay open during live updates and manual refresh; expansion of unrelated folders is not saved across application restarts.

## Verification

`desktop/tests/workspace-monitor.test.cjs` uses actual temporary directories to check external writes, directory creation and rename notifications, rejected traversal and linked paths, access removal, account changes, cancelled startup, and notifications without contents or absolute paths. It also checks nested folder creation, duplicate protection, invalid Windows names, another account's reference, and a cancelled account check.

`scripts/desktop/navigation-workflow.mjs` exercises the real sidebar controls against temporary files. It checks external creation, rename, removal and preview refresh; nested folder creation; duplicate protection; retained expansion after Refresh; and preservation of an unsaved editor draft when the disk file changes. These checks do not require paid AI requests. The wider installed regression checks provider switching and the existing agent workflow separately.

The final 0.18.0 source passed all 85 automated checks. The actual installed application passed the complete desktop regression and the live-folder UI checks above. The installer upgrade preserved its account/project/conversation fixture, and the normal profile retained its original accounts, passwords, provider connections and earlier live conversations. The installed modules and interface files match the recorded build hashes. Evidence is listed in [implementation status](implementation-status.md).
