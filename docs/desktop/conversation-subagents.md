# Conversation subagents

October 16, 2026 · Windows private release 0.29.3

The main sidebar and project groups show parent conversations. Child entries no longer expand every historical conversation into a tree. The parent row remains selected while its child chat is open.

Open **Subagents** in a conversation's header to see that conversation's children. The panel lists each child's name, assignment, current status, pending input and whether it reported back. Its Main chat row returns to the parent. Selecting a child opens the existing dedicated child chat and closes the panel, keeping its transcript and composer available. The panel docks beside wide conversations and becomes a dismissible drawer in narrow ones. Escape closes it and returns focus to the header control. Switching conversations closes the old panel.

Inline child activity remains in the originating response as a compact disclosure row, with an Open chat link. Expanding it retains the live native transcript, tools, approvals, results, steering and cancellation controls. A pending question or approval expands the relevant child. Completed main-agent reports also start as compact disclosure rows. Running reports, errors and pending native input open their content so controls remain visible.

The native Codex runtime, provider routing, background execution, account ownership checks and PostgreSQL/Supabase schema are unchanged. Child selection, separate protected drafts, Back/Forward and explicit restart recovery continue to use the existing owned records. The global Background agents manager remains available in the activity rail for work across conversations. The actual inference qualification remains the 0.29.0 run described in [Dedicated subagent chats](subagent-chats.md).

`test-subagent-chat-ui.mjs` checks the real Electron interface without inference: no nested child rows in global navigation, conversation-only panel contents, docked transcript geometry, Escape/focus return, inline expansion, collapsed reports, independent main/child drafts, Back/Forward, saved child restoration, project grouping and dark/light rendering. `test-chat-layout.mjs` covers the surrounding composer and workspace at multiple widths. The verification helpers open children through the current conversation panel.

Interface evidence is stored in `.supabase/desktop-chat-subagents/`; layout evidence is in `.supabase/desktop-chat-layout-v3/`; installer, build resource and data-preservation checks are in `.supabase/desktop-poc/chat-subagents/`. No AI inference is requested by these UI checks.

Installed verification passed for 0.29.3. The actual Electron UI passed conversation-only panel contents, empty child trees in global navigation, docked geometry, keyboard dismissal/focus, child and report disclosures, independent drafts, Back/Forward, reload restoration, project grouping and dark/light rendering. The separate installed layout check passed three widths, large text and the file/browser pane. The preservation audit retained both original accounts/passwords, earlier histories/files and all 34 migrations, matched installed resources to the build, and confirmed six healthy Supabase services plus local Whisper readiness. These UI checks requested no inference.
