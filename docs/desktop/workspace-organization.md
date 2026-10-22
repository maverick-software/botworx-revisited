# Workspace organization

Version 0.20.0 extends the separate application rail, chat/project sidebar and right workspace with saved folder navigation and tab organization.

## Saved folder navigation

Expanded folders, the visible-file filter and **Follow file** are saved for each account, conversation and selected root folder. Switching roots restores that root's view. Switching conversations restores that conversation's view. Closing and reopening the folder sidebar preserves it.

**Follow file** reveals the selected file's parent folders when a different file is selected. Turning it off lets you browse independently. **Collapse all folders** closes the current tree. Arrow keys move between visible file/folder buttons; Right expands a folder or enters it, Left collapses a folder or moves to its parent, and Home/End jump to the first/last visible row. Enter opens the focused file. F2 and Delete retain the reviewed rename and Local Recovery controls.

The filter applies to filenames in expanded directories; it does not search file contents or scan the entire workspace. Directory rows remain available while filtering. Up to 63 saved expanded paths are retained per root, alongside the existing 64-directory live-update limit. Up to 32 root views are retained per conversation. Earlier root views are dropped as new roots exceed that bound. Collapse all clears retained descendant expansion choices.

Confirmed Agentopia folder moves relocate expanded descendants and open the necessary destination parents. Removal clears expansion for the removed subtree. Original conversation attachment snapshots remain unchanged. External renames continue to use ordinary filesystem refresh and require manual navigation to a new path.

## Tabs

Drag a tab onto another tab to reorder it. Right-click a tab or open its action menu to move it left/right, close it, close the other tabs, close tabs to its right, or close all tabs. Middle-click closes a tab.

While a tab has keyboard focus, Left/Right select adjacent tabs, Home/End select the first/last tab, Shift+Left/Right move the focused tab, and Delete closes it. These keys apply to the tab strip; they do not replace text-editing keys inside a document. Closing an active tab selects its neighboring tab. Reordering retains the selected document.

Closing editors first flushes their protected local drafts. It leaves the saved file unchanged. Reopening the editor restores its unsaved text. Closing a terminal tab follows the existing session policy; use the terminal's explicit stop controls to end a running process.

Navigation changes use the existing short delayed save. Normal chat switching and window close explicitly flush the current pane; a forced-termination check covers state already acknowledged by the backend. A plan implementation handoff waits for other drafts while excluding its own pending action, which prevents circular waiting when it opens the plan's conversation.

Pane state is stored in the existing Windows-protected per-account store. Switching chats and normal window close explicitly save the current pane. If its conversation has been deleted, the obsolete local pane record is removed so navigation can continue; a conversation owned by another account remains unavailable. Saved state contains navigation metadata and preferences; changing the tree does not attach file contents to a model or change the chosen AI provider. PostgreSQL, Supabase and the existing immutable migrations are retained.

## Verification

Source and installed verification results are recorded in [implementation status](implementation-status.md). Folder/file operations retain their [inspection and recovery boundaries](workspace-file-management.md). Broader desktop parity remains active in the [backlog](parity-backlog.md).
