# Workspace preview search

Version 0.22.0 — October 15, 2026.

The desktop keeps its separate application rail, chat and project sidebar, central conversation, and right workspace. The workspace has its own file/browser/canvas tabs and resizable folder navigation. Add tab and Close workspace now stay beside the scrolling tab list, including when all 16 tabs are open or the pane is narrowed to 320 pixels. Below 460 pixels, the folder tree uses at most 40% of the pane and documents use smaller margins. The folder-width grip returns when the pane is wider, retaining the chosen wide-layout width.

Open a document in the right workspace and press **Ctrl+F**, or choose its search icon. Type a phrase, use **Enter / Shift+Enter**, **F3 / Shift+F3**, or the arrow buttons to move through matches, and use **Match case** when capitalization matters. **Escape** closes search. Ctrl+F in the file editor keeps the editor's existing find and replace. In a directory tab it focuses that directory's file filter.

Find this phrase: sidebar workspace reader.

Search stays inside the current preview. Markdown search includes rendered text and links; View source searches the file's source. For PDF, Word, spreadsheets and presentations, a nonempty search temporarily displays all available extracted text, so it can find text outside the currently selected page, section, sheet or slide. Closing search restores the previous section and its normal preview. The caption identifies partial extraction when the document reader's existing limits apply. Scanned pages still require text extraction before their words can be searched.

Browser pages and HTML canvases use the browser engine's actual page search. Ctrl+F also works when the embedded page has keyboard focus. Page section links retain responsive search. Failed page loads show an error and end the pending search. Search clears when leaving that tab. Downloads, persistent browser sessions and broader browser controls remain further work.

Search words remain temporary interface state. They are separated by account, conversation and selected tab, and are cleared when beginning search in another location. Searching does not change files, chat messages, model/provider choices, attachments or file-sharing permissions. It does not submit an AI request. Terminal output, images and plan canvases have their own controls; this preview search covers documents and pages.

The document search counts every match within the already bounded preview. It paints at most 501 surrounding match highlights at once to keep large results usable; previous and next can reach the entire result set. Browser result counts come from the embedded browser engine.

Reopening a workspace now rereads its selected file. Changes made while the pane was closed appear without needing to choose another tab. Failed or revoked file reads clear the old preview and display the error. Unsaved editor drafts retain their existing protection and conflict checks.

[Open the organization guide](workspace-organization.md) · [Open the document navigation guide](workspace-document-navigation.md) · [Browse desktop docs](./)

![Existing project MCP image](../../public/mcp-light.png)

Verification includes a reproduced stale-file failure before the fix; literal and Unicode search; case sensitivity; cross-format Markdown text; match wrapping and 2,505 results; PDF/Office searches beyond the visible section; unchanged file bytes and editor search; native canvas/browser results and focused-page shortcuts; stale native search requests; and visible Add/Close controls with 16 tabs. The full compiled and installed workflows passed, including the installed upgrade and unchanged compiled-resource checks. Provider responses in regression were controlled; the earlier actual ChatGPT/OpenRouter conversations and saved connections are checked separately for preservation.

Terminal permission displays now retain newer enable/revoke changes when a delayed startup read finishes. Both terminal modes protect their loading responses; execution continues to use the main process permission checks. A controlled delayed-history check verifies that a revoked session stays disabled and that explicit re-enabling restores its controls.

Installed normal-close and forced-termination checks retained tabs, their order and a document section bookmark. The original signed-in administrator and both provider connections reopened successfully, with the existing accounts, passwords and earlier saved conversations intact.
