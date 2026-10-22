# Projects and workspace panes

Updated October 16, 2026. Introduced in desktop version 0.7.0.

The desktop has independent navigation surfaces, following the supplied ChatGPT/Codex reference: a narrow application rail, a chat and project sidebar, the conversation, a right workspace pane, and a folder tree within that pane. The account submenu continues to open the full settings dashboard.

Version 0.23.0 adds numbered, highlighted source previews, checked line/column citations, Go to line, and account-specific restoration of the current conversation/view and its workspace. The Chats rail button returns to the current conversation; New chat starts a separate one. [Source navigation and recovery](workspace-source-navigation.md).

## Navigation and projects

The rail opens chats, agents, connections, workspace files, and settings. The secondary sidebar can be collapsed with Ctrl+B while the rail stays available. Chat history, agent shortcuts, search, account controls, and expandable projects remain in the secondary sidebar.

Create a project with the plus beside Projects. Give it a name and optionally choose a local folder. Its menu opens the folder, starts a chat in that project, or changes its settings. Existing conversations can be moved through Chat options → Move to project. Removing a project keeps its conversations and local files.

Projects and conversation membership are saved in PostgreSQL by additive migration 0014. Database permissions and the desktop broker restrict them to their Agentopia owner. Local folder grants and pane preferences are stored separately in Windows-protected account storage. No existing database migration is changed.

## File tabs and folder navigation

Use the workspace button in the conversation header or application rail to open or close the right pane. Open a local folder through its plus menu. The folder selector switches between already granted references. Directories expand on demand, and text/code files and supported images open in tabs. The filter applies to filenames in loaded directories; expand directories to reveal their contents.

Markdown opens as a rendered document. View source displays its text. Code and other text formats open as source; PNG, JPEG, and WebP images have image previews. Refresh rereads the file from disk. Browsing a file does not send it to an AI provider. Attach project folder adds the reference to the composer, where the current sharing permissions apply.

Version 0.13.0 adds **Edit** for text and code, a bundled editor with find/replace and Ctrl+S, **New text file**, and **Recover local drafts**. Typing preserves a protected local draft; Save explicitly writes the file. Conflicts show the current saved file beside the draft and require another review if it changes again. [Editor controls and recovery](workspace-editor.md).

Drag the separators to resize the workspace and folder tree; the separators also accept left and right arrow keys. Toggle folder navigation to give the document more space. On narrow windows the workspace becomes an overlay with an accessible close control. Open tabs, the selected file, widths, and folder visibility are remembered separately for each account and conversation. Closing a tab keeps its file on disk. Agent file activity includes Open in workspace.

File browsing reuses the workspace path validation used for agent tools. It rejects parent traversal, credential and hidden paths, application storage, backend data, linked paths, and unsupported binary files. Text previews are limited to 256 KB and 160,000 characters; images are limited to 2 MB. Each directory lists up to 200 entries. Version 0.12.0 adds read-only PDF, Word, spreadsheet, and presentation previews, including a spreadsheet grid. These documents retain their original files. [Document support and limits](documents.md).

## Canvas and browser

An HTML tab offers Preview HTML canvas. Its JavaScript can operate its own document, supporting interactive generated artifacts. A restrictive policy blocks network requests, frames, forms, and external resources. The canvas has no Node.js access, desktop preload bridge, or filesystem privileges.

Open browser accepts HTTPS addresses and HTTP loopback addresses for local development. Each browser tab has an address bar, back, forward, and reload controls. Its page runs in a separately sandboxed Electron WebContentsView with Node.js disabled and no Agentopia preload. File and application protocols, popup windows, downloads, and permission requests are blocked. Browser views hide while application dialogs and menus are open. Closing Agentopia or signing out closes its browser views. Browser cookies are kept in memory for this application session; persistent browser sign-ins and downloads are outside this delivery.

The privileged application renderer retains its existing restrictive network policy. External page content cannot invoke account, provider, file, or administrative operations. This follows Electron's documented [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view) and [renderer security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Verification

`desktop/tests/navigation.test.cjs` checks project and conversation ownership, direct database permissions, isolated saved layouts, protected file paths, project removal without chat deletion, and browser address restrictions.

`scripts/desktop/navigation-workflow.mjs` exercises the actual desktop controls with temporary local files and a real local HTTP server. It verifies file tabs, Markdown/source switching, resizing, folder controls, interactive canvas execution, absence of Node.js and Agentopia bridges in external views, browser navigation, settings overlays, saved layout restoration, and a compact window. Its fixture accounts, projects, and files are disposable. The existing live provider evidence is retained; this layout change does not require sending additional paid inference requests.

The development verification passed all 30 automated tests and the focused desktop workflow, including starting a chat in a project, moving it out and back through the UI, and reopening that conversation’s saved pane. The browser navigation check uses an actual pointer event so Chromium records normal user navigation history.

The actual installed 0.7.0 application subsequently passed the full desktop workflow, including original settings and account controls, controlled provider switching, reviewed file edits, real local Whisper transcription, and forced-termination recovery. A separate installed run verified that all composer controls stay inside the conversation at the default 1360 × 900 window size while the right pane is open. The installer upgrade retained its disposable account, project, chat, completed reply, and message order.

Version 0.7.1 makes the composer respond to the width of its conversation column when the workspace is open. Permission and agent buttons become compact, model labels shorten, and recent-chat details adapt to the space. This was checked with the owner’s real agent/model selection as well as the disposable UI fixture. The folder tree also expands to reveal the selected file and highlights it.

The actual installed 0.7.1 patch passed the complete desktop workflow again. Its browser check also exercised Forward and verified that periodic status updates do not replace an address while the user edits it. Both the saved-conversation composer and the new-chat home remained within their column beside the workspace pane. The owner’s real account separately passed the same composer fit check, with both AI connections retained.

Version 0.14.0 adds a persistent **Plan** tab in the same right workspace. Plans have editable steps, local draft recovery, saved version history, progress and an explicit reviewed implementation handoff through either provider. Per-message snapshots retain the plan context originally submitted. [Structured plan behavior](structured-plans.md).

## Terminal workspace

Version 0.16 adds a PowerShell terminal tab alongside documents, plans, canvases, and browser pages. It streams actual output, retains per-account command history, and shows exit status and cancellation. Administrators must explicitly enable Windows commands. Agent commands use the current chat permission setting and open their saved output in this same right pane. [Command controls and limits](windows-terminal.md).


Version 0.17 adds [interactive sessions](interactive-terminal.md) in Terminal, with retained state, prompted input, reviewed provider input, saved transcripts and restart recovery. Starting-folder controls follow the folder tree until an explicit terminal folder is selected.

Version 0.18.0 adds live updates for expanded folders, manual refresh without collapsing the tree, New folder, directory/file action menus, and protection of open unsaved drafts during external changes. [Live folder controls and limits](live-folder-navigation.md).

Version 0.19.0 adds F2 rename, right-click item actions, move, Delete review, Local Recovery and older operation history. Confirmed changes update live and saved file tabs; active editors and unsaved drafts are protected. [File management and recovery](workspace-file-management.md).


Version 0.20.0 adds saved expansion/filter/follow settings for each conversation and root, keyboard folder navigation, tab reordering and group-close controls. [Workspace organization](workspace-organization.md) describes their persistence and draft-protection behavior.


Version 0.21.0 adds local document/image/section navigation, directory tabs, sibling breadcrumb menus and Markdown tables/tasks. [Document navigation](workspace-document-navigation.md) describes its supported links, image limits, privacy behavior and recovery checks.


Version 0.22.0 adds local preview find, native browser/canvas find, fixed Add/Close tab controls, readable narrow-pane spacing, and selected-file refresh when the workspace is reopened. [Preview search and layout](workspace-preview-search.md) explains the keyboard controls, extracted-text scope and temporary search state.
