# Workspace file management

Version 0.19.0 adds reviewed rename, move, and recoverable removal to the right folder sidebar and the shared agent tool loop. PostgreSQL and Supabase continue to store account, conversation, permission, and operation records.

## Folder sidebar controls

Open an item's action menu, or right-click its row. **Rename item** accepts a new name; **Move item** accepts a new relative path inside the selected workspace. Parent folders must already exist. F2 opens rename, and Delete opens removal review.

**Review change** inspects the current item without changing it. The review shows its original path, proposed destination, file/folder counts, size, and a sample of included items. Apply explicitly confirms the operation. A changed item or occupied destination stops the action and requires a fresh review. Case-only renames work on Windows.

**Move to Local Recovery** removes an item from its working location while retaining its files inside the same workspace. Open **Add workspace tab → File operations and recovery** to find saved operations, filter for Local Recovery, restore a removed item, or undo a completed move. Older records are available through **Load earlier operations**. **Show in Windows** reveals an owned recovery item in Windows File Explorer.

Restore checks the saved item and the original path again. It preserves a newer file already occupying that path. Undo stops when the result's contents have changed. Undoing folder creation requires the folder to remain empty. A recovery item is retained until restored or managed explicitly outside Agentopia; moving it into Local Recovery retains its disk usage.

Save or discard affected unsaved drafts before moving or removing their files. Use **Done editing** or close the editor first. An active editor is protected even before its latest keystrokes reach local draft storage. Saved, inactive draft records are cleared after a confirmed move; protected unsaved drafts are preserved.

Confirmed moves update open tabs and saved workspace layouts, including a tab opened through another granted parent folder. An older layout save is reconciled against the operation journal before persistence. Conversation messages and the file snapshots originally sent to providers keep their original contents.

## Agent tools and provider switching

Both ChatGPT and OpenRouter use the same functions:

1. `workspace.inspect_path` returns a bounded inventory and the item's current fingerprint. It returns metadata and hashes, rather than file contents.
2. `workspace.manage_file` accepts `move`, `remove`, or `create_folder`. A move/removal requires the fingerprint from inspection. Creating a folder requires a null expected hash.
3. Default permissions show the review in the conversation. Denial disables further file mutations for that response. Plan mode and selected-file read-only permissions omit mutation functions; Chat only omits file functions.
4. Explicitly enabled administrator Full access can apply selected-workspace changes automatically. It uses the existing native host authorization checks. These file operations do not require enabling Windows commands under Default permissions.

The activity receipt records the actual outcome and links to recovery. Undo and recovery update the saved tool receipt. If a request is cancelled after a confirmed filesystem change, the operation's completed result is retained. Cancellation does not silently reverse a change that already happened. Provider selection is never changed automatically on failure.

## Filesystem and ownership boundaries

The workspace root itself cannot be moved or removed. Source and destination stay inside an owned, selected folder, on the same filesystem volume. Existing hidden, credential, dependency, linked-path, hard-link, application-storage, and backend-storage exclusions still apply. Folder inspection rejects an excluded descendant, rather than moving only part of the folder.

An operation covers at most 1,000 items, 20 directory levels, and 50 MB, with a bounded inspection period. A file or subfolder separately granted as another reference must first be forgotten before its containing item can be moved or removed. Forgetting a reference preserves its file. This keeps existing grants and project attachments explicit.

The pinned Windows helper receives paths as JSON data and calls the native move API without replacement. It is ready before final path/content checks and accepts one commit. It accepts no user-written PowerShell command. Closing its input before commit leaves files in place. [Microsoft MoveFileW documentation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefilew).

Removed data lives under `.agentopia-recovery/<account>/<operation>/item` inside its original workspace. The entire recovery path is excluded from attachments and ordinary agent file tools, including attempts to attach one of its descendants directly. Files retain their existing Windows access permissions. Administrator-enabled Windows commands retain their documented Windows-account access; the selected-workspace APIs provide a narrower application boundary. [Windows command permissions](windows-terminal.md).

Another Agentopia account cannot read, approve, restore, or reveal this account's journal. PostgreSQL permits an authenticated account to select only its own records and denies direct completion-function execution. The broker performs mutations with fresh account checks and server-held previews. The file-manager handoff uses Electron's [showItemInFolder API](https://www.electronjs.org/docs/latest/api/shell#shellshowiteminfolderfullpath).

If a forgotten workspace is attached again at its original path, recovery can use the renewed grant. Moving or replacing the workspace root outside Agentopia requires inspection in Windows or returning it to its original location. The recovery folder travels with a workspace moved by Windows.

## Journal, interruption, and upgrades

Additive migrations 0023 and 0024 add owned operation records, append-only layout events, and an atomic completion function. Earlier applied migrations remain unchanged. The runtime backs up the database before applying new migrations.

The operation is recorded before commit. After the actual filesystem change, one database transaction saves its completion, appends its layout event, and updates its linked tool receipt. Duplicate completion does not add another event. File writes, editor saves, and folder operations share a mutation queue.

Startup marks unfinished operations interrupted. For a restored account with its folder grants available, it checks saved completion records and the actual files before opening its saved layouts. A confirmed moved item gets a recovered receipt and layout event. Pending work is never replayed automatically. If an outcome cannot be established, it stays visibly interrupted for inspection. Creation of a folder interrupted before its completion record can require manual inspection because its creator cannot be established from an existing folder alone.

The journal's primary lookup, status-write, and completion requests have ten-second acknowledgement limits. A missing acknowledgement leaves an inspectable journal record; it does not trigger a replacement move or deletion. Ordinary uninstallation and upgrades retain the database and local workspace data under the existing recovery policy.

## Verification boundaries

The native move tests use actual Windows files and directories to verify preserved bytes, occupied-destination refusal, case-only names, and closing a helper before commit. Database tests use the real local Supabase installation for ownership, review fingerprints, races, protected drafts, private recovery, paging, saved layout reconciliation, interrupted completion, atomic completion with a lost response, and restoration.

Controlled ChatGPT and OpenRouter responses drive the real shared broker and Windows helper. Those tests exercise visible review, denial, cancellation, preserved bytes, saved receipts, undo and explicitly enabled Full access. They demonstrate adapter behavior without requiring paid inference.

The desktop workflow uses actual folder rows, F2, right-click menus, Delete, review dialogs, reload, restoration and editor drafts. The Windows File Explorer handoff is intercepted at its API boundary to verify the selected recovery path; a general Explorer UI test is outside that check. A separate test terminates only the actual Electron main process after the Windows move and before the database completion request, then verifies startup reconciliation, retained bytes, saved-tab relocation and restoration without replay.

A live 0.19.0 source-build check used the owner's real ChatGPT and OpenRouter GPT-6.1 Sol connections with High thinking in one conversation. ChatGPT created a generated folder and moved its test file after two visible approvals. OpenRouter inspected that file and moved it into Local Recovery after a third approval. Explicit restoration and undo through the interface returned the original bytes and removed the empty generated folder. All four messages, both replies and all three restored operation records reopened. Provider inference and file actions were real; the native file picker was restricted to the generated fixture. Evidence is retained in `.supabase/desktop-live-file-operations/`.

Real-provider and installed-package results are recorded separately in [implementation status](implementation-status.md). These controls extend the ongoing [desktop parity work](parity-backlog.md); full document editing, broader workspace organization and other remaining surfaces retain their existing limits.
