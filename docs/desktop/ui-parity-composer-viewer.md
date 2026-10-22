# Composer menu and document viewer comparison

The October 19 follow-up compared the actual ChatGPT Desktop add menu and PDF side panel with installed Agentopia 0.44.45 and the user's four screenshots. The reference menu is a compact list aligned above the entire composer. Its document panel has one dark toolbar containing a file menu, Request edits, percentage zoom and Download. Agentopia repeated the document filename, showed gray page controls and opened the file tree by default.

## Changes for 0.44.46

The + button opens a composer-width list above the input, with Files and folders first, Attach context, Goal and Plan mode. Ready connections assigned to the current agent appear under Plugins & apps. Selecting an app inserts an @app reference in the draft and enables that connection if necessary. The live reference check selected Truthifi, observed its draft mention, then removed the temporary mention without sending a message. File and folder selection opens the native picker directly from this list; existing references can also be selected. Configuration launchers for skills, tools, computer use and terminal were removed from this menu.

Settings has separate Skills, Chat tools, Plugins & apps, Computer use and Windows terminal pages. Skills and chat-tool selections retain the current chat's options. Computer sharing retains the existing explicit window selection and revocation controls. Terminal settings retain the existing permission checks and open the command/session workspace. Moving these controls does not grant additional permissions.

Attach context searches local references, agents, current-chat Agentopia tabs and saved chats. Selecting a chat inserts a visible, editable excerpt of its latest 20 user/assistant messages, capped at 16,000 characters, into the draft. Tab selection inserts its title and URL. These actions do not send a model request. This picker does not yet enumerate external Chrome tabs or cloud Pages. The existing @agent autocomplete remains available.

Word/PDF panels have a single dark toolbar with file actions, Request edits, percentage zoom and Download. The page surround is dark in the dark theme and light in the light theme. File navigation is closed by default for documents and remains available through the file menu. Download uses the existing owner-checked Save a copy operation. Request edits attaches the reference and stages a normal chat draft; the user describes the changes and sends it. It is not an in-place Word editing engine. Child chats retain their separate drafts and do not expose this parent-draft action.

The document remains inside its opaque-origin sandbox. Its only new incoming commands are bounded zoom/page values and a two-value light/dark theme. File actions remain in the parent application and retain the existing account, path, file-size and sensitive-path checks. Extracted text and searching remain available through the file menu.

## Verification

The frozen candidate is recorded in `.supabase/desktop-platform-release/candidate-04446/package-proof.json`. Qualification runs 63 local backend checks and 16 actual component workflows with simulated provider responses. These exercise menu order, width/alignment, keyboard navigation, file selection, context insertion, cancellation while switching chats, retained Settings selections, computer selection, terminal settings, real PDF pixels/page changes/zoom, original DOCX layout, scanned PDFs, document controls and sandbox isolation. Screenshots are stored with each UI evidence receipt. The delivered full application also runs the existing five conversation-reading workflows.

Earlier uninstalled source snapshots are retained separately. They preceded the screenshot-driven alignment correction, context-picker cancellation recovery, visual renderer refresh and the live-reference app-mention correction. Their packaging jobs were stopped before installation, their original packaging helpers were verified restored, and the final qualification exercises the corrected behavior. None of the earlier snapshots was installed.

These changes address the menu, settings placement and viewer chrome. Full Word pagination fidelity, direct document annotations/editing, visual spreadsheet/PowerPoint pages, cloud Pages context and complete reference-settings parity remain separate work. No paid AI request is needed for this update's verification.

## Final installed verification

0.44.46 and UI correction 1 are installed and verified. The final dismissal recovery case raises the interface suite to 17 workflows; five delivered-app reading checks also pass. The full baseline database comparison matched 126 tables and 1,658 saved rows. Native PDF saving is byte-identical, and normal reopening restores the account, ChatGPT selection and both document tabs without replaying a request. Final UI hashes were checked again after reopening. The UI correction has its own qualification, activation and rollback receipts; the baseline full installer does not contain that last correction. See [installed delivery details](platform-release-0.44.46.md#installed-acceptance).
