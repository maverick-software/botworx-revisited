# Persistent agent identity in the chat header

The selected agent name now stays centered in the conversation header. The chat title remains on the left and existing controls remain on the right. A selected child chat uses its own agent name. Long names truncate within the center column. Message content no longer renders author-name labels during working, completed, or other response states; author information remains available to assistive technology.

The original per-response label check was reproduced with the native and standard message components before the fix. Nine chat-progress checks now pass, covering absence of the label during working and completed states and preservation of progress notes, separators, elapsed time, focus treatment, and activity history. Both TypeScript configurations passed. Eight checks against the packaged styles verified centering and separation from adjacent controls for short and long names, two desktop widths, and light and dark themes.

This is an installed UI correction on version 0.44.85. Compiled main-process code, database schema, recovery reader, runtime files, dependencies, and agent definitions remain byte-identical. The existing verified delivery path captured a fresh database snapshot and encrypted profile recovery, closed and reopened the app normally, retained the previous UI for rollback, and verified the installed resource manifest. The strict database and protected credential comparisons passed. No model requests were sent.

Package proof: `F:/Agentopia/.supabase/desktop-chat-agent88/1793038489459/package-proof.json`.

Final acceptance: `F:/Agentopia/.supabase/desktop-release85/1793036393888/installation-1793038536341/completion.json`. Native inspection confirmed the centered name in the saved conversation and the absence of response author labels. Source changes are committed in `00657e0` and `deaf9a5`.
