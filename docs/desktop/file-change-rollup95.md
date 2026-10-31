# Response file-change rollup

Agentopia 0.44.85 now shows a changed-files card below a completed response when it has recorded file changes. The card lists created, modified, deleted, and moved files, shows added and removed text lines, initially displays three files, and expands to show the rest. **View changes** opens the saved response's file review, including text differences and binary-file notices.

Existing host write previews and native patches continue to supply their recorded changes. Native responses also take bounded before-and-after snapshots of their actual working folder, so files written through commands can appear even when no patch event was emitted. Durable file-management receipts supply file moves and removals. Overlapping observations are suppressed where a recorded patch already covers the file.

Snapshots are local to the response's working folder. They exclude protected names and dependency folders, do not follow symbolic links, and enforce time, size, depth, and file-count limits. An incomplete comparison does not invent deletions or line totals. Binary files and text too large to record are identified without fabricated text counts. A file returned to its original contents during the response has no net change.

Changes are saved with the existing native-turn state and remain available when the chat is reopened. Historical responses without a saved patch, file-operation receipt, or before-and-after observation cannot acquire reliable change totals retroactively. No database migration or new dependency is required.

Undo remains available for edits with an existing recovery record. An observed command-generated file does not expose an unsupported Undo action. Existing recovery checks continue to preserve files changed after the response.

## Verification

- Backend and interface type checks and the packaged interface build passed.
- Twenty focused checks cover filesystem comparisons, cancellation and bounds, saved-state reconstruction, patch overlap, file-operation receipts, native change handling, and event presentation.
- Component interaction checks cover placement below the answer, expansion, review navigation, text and binary output, empty responses, keyboard interaction, and light, dark, and narrow layouts.
- The installed-package proof and installation recovery audit are recorded under `.supabase/desktop-file-rollup95/`. The installation checks compare saved database rows and protected account settings before and after replacement.
- A dedicated ordinary-chat test uses generated fixtures to create two files, modify one, and delete one. The expected text total is three added and two removed lines, with a separate binary-file entry. Its saved chat, filesystem checks, and visual-review result are retained with the package evidence.
