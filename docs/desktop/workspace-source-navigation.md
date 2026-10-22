# Workspace source navigation

Updated October 16, 2026. Version 0.23.0 extends the sidebar workspace reader with numbered source previews and saved desktop locations.

The narrow application rail switches between Chats, Agents, Plugins, and the right workspace. Chats returns to the current conversation. New chat starts a separate conversation. The adjacent sidebar retains projects and chat history. The right workspace retains its own tabs, folder navigation, breadcrumbs, preview, browser, canvas, and terminal controls.

## Read and navigate source

Text and code previews use a read-only reader with line numbers, syntax colors, selection, and folding. Markdown keeps its rendered view and offers Source. The existing Edit file action opens the separate editor; reading and following a citation preserve an unsaved editor draft.

- Press **Ctrl+G** or click the line indicator to go to `18`, `18:4`, or `18-22`.
- Click a line number to select its line. Shift-click another number to extend the range from the original anchor.
- Click **Copy source reference** to copy a local file link with the selected line or range.
- Press **Ctrl+F** to search the entire loaded text, including lines outside the visible screen. A matching folded section opens when selected.
- Refresh rereads the file while retaining the reading position. Reading normalizes line endings for display and leaves the file bytes unchanged.

Local links accept `file.ts#L18`, `file.ts#L18C4`, `file.ts#L18-L22`, and line/column suffixes such as `file.ts:18:4`. [Inspect the source-location implementation](../../desktop/src/source-locations.ts#L1-L10). Ordinary Markdown section links still open their rendered heading.

The shared `read_file` tool returns a reference-specific citation address and the actual line count. ChatGPT and OpenRouter receive the same citation instructions. Clicking a reply citation selects its referenced folder and opens the source location. It uses a folder or file already opened by the signed-in user and does not grant new access.

## Reopen the same desktop location

The application remembers the current view, conversation, agent, and project for each account in Windows-protected local storage. Startup restores the saved conversation, its message history, provider and thinking options, protected draft, and its own workspace tabs. Returning from Agents or Plugins to Chats retains that conversation. Deleted or unavailable items are omitted after ownership checks. A failed restoration leaves the saved metadata available for a later retry.

Normal close flushes pending workspace and location writes. Abrupt-termination recovery applies to state the application has acknowledged as saved. Opening a saved chat does not send another AI request or restart a goal.

## Boundaries

Source links apply to supported text/code files. PDF and Office documents retain their extracted-text reader. Binary files, folders, and outside paths cannot become source locations. A stale or out-of-range line shows an actionable notice. The right pane uses a virtualized reader, so the visible page contains only the lines near the current position; search and copy operate on the complete loaded text within the existing file-size limits.

The desktop location is installation-local. It does not synchronize open windows between computers. Browser/canvas tabs and the existing editor retain their own permission and isolation rules. Provider requests still require internet access.

## Verification

The 112 automated checks and complete installed desktop workflow passed. Installed normal-close and parent-only termination checks restored the conversation, source range/column, renamed path, tab order, directory tabs and Markdown section bookmark. Controlled provider tests exercised both request formats, an unrelated visible folder, protected editor drafts, folded source targets, full-text copy/search and source refresh.

Separate live GPT-6.1 Sol requests through ChatGPT and OpenRouter read the actual generated file and opened their returned citations. OpenRouter retained the earlier ChatGPT value. Reload restored four saved messages and the selected source line without inference replay; the generated file bytes stayed unchanged. These live records are retained in `.supabase/desktop-live-source-navigation/evidence.json` with their original build-proof digest.

[Open the organization guide](workspace-organization.md) · [Browse desktop docs](./) · [Preview search](workspace-preview-search.md)

![Existing project MCP image](../../public/mcp-light.png)
