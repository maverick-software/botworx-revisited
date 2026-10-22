# Chat layout refinement

October 16, 2026 · Windows private release 0.29.1

The conversation and composer share an 800-pixel outer grid with consistent edge spacing. Transcript scrollbars reserve space without shifting the text away from the composer. Narrow conversations use smaller gutters, including when the right workspace pane is open. Child transcripts use the same geometry.

The composer uses a 12-pixel content inset, a 15-pixel input font (17 with large text enabled), and 12-pixel permission/model labels. File and folder cards have less padding; image previews retain their existing preview treatment. The bottom toolbar groups Add and permissions on the left and model/thinking, dictation and send/stop on the right. At narrow pane widths the permission label becomes an icon while its accessible name and menu remain available.

Agent selection and direct creation live in the header. The duplicate composer selector was removed. Native assistant turns start with the recorded work disclosure; the repeated author/version rows are consolidated into the header and expandable activity. The disclosure preserves the Codex version, model and thinking details. User-message execution settings remain available to assistive technology without adding a small metadata row above every message. Native command status labels stay on one line while long commands wrap independently.

Verification uses the real Electron application and existing saved conversations, without sending AI requests. `scripts/desktop/test-chat-layout.mjs` checks transcript/composer alignment, toolbar overflow, a single agent picker, three window widths (including the application's enforced minimum), dark/light themes, large text, menus, activity expansion, the right pane, and child-chat rendering. `test-subagent-chat-ui.mjs` supplies the existing child navigation, separate draft, reload, project grouping and theme regression checks. TypeScript compilation and the desktop production build are also required.

The native harness, provider routing, database schema and existing migrations are unchanged. The real ChatGPT/OpenRouter execution qualification remains the 0.29.0 run documented in [Subagent chats](subagent-chats.md). This visual patch does not claim a new paid-provider run or complete desktop parity. Final installed layout evidence and preservation/resource checks are kept under `.supabase/desktop-chat-layout/` and `.supabase/desktop-poc/chat-polish/`.

Installed verification passed for 0.29.1: all four theme/window combinations aligned the transcript and composer with no toolbar overflow. Menu access, large text, work disclosure, split-pane and child views passed. The child navigation regression also passed. The final audit confirmed both original accounts and passwords, prior saved histories/files, 34 unchanged migrations, matching installed build resources, six healthy backend services, and local Whisper readiness. No AI inference was requested for this patch.
