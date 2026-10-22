# Desktop navigation and private chat drafts

Version 0.15.0 adds a desktop bar above the application rail, chat/project sidebar, conversation, and right workspace pane.

The bar provides Back and Forward, Alt+Left/Right, a sidebar toggle, and File, Edit, View, and Help menus. Windows supplies the native caption controls, including maximize and close. Dragging the unused bar moves the window. Navigation is disabled while a response or a conflicting dialog is active. The history covers chats, the agent library, and plugins for the current application session; it retains the selected agent/project for a new-chat page and starts over after signing out or reopening.

An unsent draft is saved separately for each conversation and for each new-chat agent/project location. Switching views, opening another chat, and returning restores that location's message, provider/model, thinking, sharing permissions, mode, and selected file references. Saving a draft does not send a message or call an AI provider. The application still opens its chat home by default; saved conversation drafts appear when their conversations are reopened.

Drafts use the same Windows-protected local storage as account credentials. A signed-in account can retrieve only its own drafts. They remain local to this Windows profile and are separate from the PostgreSQL conversation history and database backups. Selected file references remain subject to the existing sharing and execution checks. Goal execution identifiers are excluded from saved drafts.

Edits are saved after a short pause. Normal window close and sign-out wait for pending chat and workspace draft writes. A failed write displays an error; close provides the existing Keep open / Close anyway choice when the latest draft cannot be acknowledged. A forced process termination can lose edits made since the last acknowledged save. Storage accepts up to 100 nonempty drafts and two million serialized characters per account; it reports a limit rather than silently discarding older work. Send a message or clear its text and attachments to release its draft. Deleting a conversation also removes its local chat draft.

Normal close also records window size, position, and maximized state. On reopening, saved bounds are checked against the current monitor work areas and moved into view when the display arrangement has changed. Window placement is installation-local and contains no chat contents.

The desktop bar follows Electron's documented [custom title bar and native caption control pattern](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar). Renderer isolation, the restricted preload bridge, and sandboxed right-pane browsing remain in place.
