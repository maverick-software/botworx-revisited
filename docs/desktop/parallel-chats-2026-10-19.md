# Parallel chat and pinning acceptance

The exact uninstalled 0.44.29/schema69 Windows application runs two actual Codex threads concurrently. The user-facing composers and sidebar navigation start/switch those conversations. Sending during A stages a queued message; explicitly steering that message aborts only A's pending response and delivers the guidance to A's replacement response. B continues working and retains its own draft. Stopping A cancels its native turn while B remains running. B subsequently completes its response and its own queued follow-up once.

Captured inputs at the actual native model gateway and saved PostgreSQL messages contain no prompt or guidance from the other conversation. Neither unsent draft appears in model input. This establishes the tested ownership and routing behavior. External model responses are controlled locally, so this does not establish live model reasoning quality, every provider combination or all finishing-turn races.

Both sidebar menus pin their chats into Pinned. Unpinning A leaves B pinned and retains both conversations. Normal close and cold reopening preserve A's cancellation, B's two completed responses, their separate unsent drafts and B's pin. Unpinning B and cold reopening again retain both chats unpinned and all saved content. Neither reopening starts inference. The preservation audit still matches all 20,361 original rows across 152 tables and 190 readable vault entries. Only this test's verified runtime is removed, with other distributions' registration/running states unchanged.

The native part uses four controlled responses across three requests: A's original and steered response, B's response, and B's queued follow-up. Those completed outcomes are adopted from their saved checkpoint for the pinning/recovery continuation. No model request is repeated during that continuation. No real ChatGPT, OpenRouter or image-provider requests occurred in this check.

Retained fixture failures distinguish test errors from application outcomes. Direct page navigation bypassed the normal draft-saving path; the corrected test uses actual sidebar controls. Working chats append Working to accessible names, so title-only exact lookup was corrected to the unique visible row. Hover menus also need the row revealed and its movement into Pinned acknowledged before selecting the next row. No application code or qualified installer changed for these corrections. Earlier failed evidence and stopped profiles remain available. The completed native response checkpoint was reused instead of regenerating its work.

Evidence:
- Native completed checkpoint: `.supabase/desktop-packaged-coordination/1792371345282/parallel-continuation-1792371581497/evidence.json` (four native checks passed before the pin-menu fixture failure).
- Successful pin/recovery continuation: `.supabase/desktop-packaged-coordination/1792371345282/parallel-continuation-1792371737401/evidence.json`.
- Bound acceptance receipt: `.supabase/desktop-platform-release/candidate-04429/parallel-chat-acceptance.json`.

The ordinary application remains 0.44.24/schema67. The 29 installer and fresh backup are verified and installation is awaiting the already-requested Windows action confirmation. Ordinary installed/live parallel-chat acceptance, mixed connections, independent-agent combinations, queue completion races and manual pin ordering comparison remain separate requirements.
