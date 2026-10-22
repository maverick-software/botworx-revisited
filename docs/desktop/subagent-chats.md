# Dedicated subagent chats

Agentopia 0.29.0 adds a dedicated chat view for each native Codex child, through both the ChatGPT and OpenRouter connections. PostgreSQL and Supabase continue to store application records; the pinned, unmodified Codex app-server 0.163.0 continues to execute the agents.

The current navigation refinement is documented in [Conversation subagents](conversation-subagents.md); the original 0.29.0 inference qualification below remains historical evidence for the execution path.

## Following and directing work

From 0.29.3, open **Subagents** in the current chat header to see its children. The main sidebar and project groups list parent conversations. The panel shows each child's name, status, assignment and input indicator. On wide chats it docks beside the transcript; on narrow chats it is dismissible. Selecting a child opens its actual native messages, command output, tool activity, questions, saved results, and report-delivery status. **Main agent** returns to its parent chat. Desktop Back and Forward include child selections.

The child's composer sends **Steer subagent** input to its current native turn. When it stops, **Send follow-up** starts another turn on the same child. **Stop subagent** interrupts that child; the main chat and other children retain their own controls. The connection, workspace, tools and permissions come from the child's originating execution context. Changing a parent's composer does not change an already-running child's scope.

Each child has a separate protected local draft. Switching between children and the main chat preserves unsent text. Closing Agentopia flushes the visible draft and selected location. On reopening, the same saved child chat and its draft are restored when their owned records remain available.

## Collapsible activity in the main chat

Each child also remains visible within the originating parent response. Its compact disclosure row shows its name, status and whether input is needed. Expand the card to inspect its transcript, command output, tool receipts, approvals and saved result. **Open chat** opens the full view. Cards containing a pending native question or host approval expand to make the request visible.

Activity is streamed from actual native events. An older command without a saved completion is labelled **No completion recorded**, so reopening a child does not present an interrupted historical action as live work. The main agent's automatic report has a separate disclosure row. Completed reports start collapsed; running reports, errors and pending questions remain visible.

## Storage and recovery

Child chat selection uses the originating Agentopia request and native thread identifiers. The broker checks ownership of the saved request and child before returning its history. Viewing a saved child does not start a model or resume execution. No duplicate application conversation or custom inference loop is created for the child view. Saved locations must reference the owned parent conversation and an existing child; removed children fall back to the main chat during restoration.

The child-state index loads the latest 100 parent execution records globally and up to 1,000 when a particular main chat is opened. Existing parent history remains available independently. Live snapshots update the conversation panel without replacing another chat's messages or draft. Delayed history reads preserve newer child events.

**Agentopia must remain open for work to run.** Closing or signing out stops active work. An interrupted child remains readable and requires an explicit follow-up to resume. Existing scope validation, approval checks, revocation, report delivery, backup controls and provider compatibility limits remain as described in [Background agents](background-agents.md).

The integration uses the public [Codex app-server](https://learn.chatgpt.com/docs/app-server) turn, steering, interruption and event model. The interface binds to the bundled 0.163.0 protocol; online documentation may describe newer fields.

## Repeatable verification

- `desktop/tests/child-chats.test.cjs` checks separate child drafts, route parsing, owned history reads, snapshots that cannot mutate backend state, and preservation of newer live data during history loading. `desktop/tests/desktop-location.test.cjs` checks owned child restoration and fallback after removal.
- `scripts/desktop/test-subagent-chat-ui.mjs` opens saved real child records in Electron without requesting inference. It checks inline expansion, parent/child drafts, Back and Forward, reload restoration, project sidebar entries, and dark/light rendering.
- `scripts/desktop/test-subagent-chats.mjs` uses the actual protected ChatGPT and OpenRouter connections. It requires real native child commands and host tool receipts, steering from the dedicated view, independent main turns, child Stop and follow-up, automatic main-agent results, application restart recovery of the same child and draft, collapsible saved activity, and a backup.

Live verification records are stored in `.supabase/desktop-subagent-chats/`; interface-only records are in `.supabase/desktop-subagent-chat-ui/`. An application restart does not establish full Windows reboot or clean-machine installation behavior.


## Installed verification — October 16, 2026

**0.29.0 is installed and open.** All **142 automated checks passed**, including owned child-history reads, saved-location validation, draft separation, native lifecycle controls, and the existing database, permissions, file and terminal workflows. Provider inference in controlled regression fixtures is separate from the following live qualification.

The installed application ran outside the source directory with the original protected ChatGPT and OpenRouter connections, using GPT-6.1 Sol at High thinking. Actual native children continued after their parent finished and while another main-agent turn completed. The ChatGPT case spawned two real siblings: both were selectable in the sidebar, retained separate drafts, completed native commands, and delivered results to the main agent. Both connections accepted steering from dedicated child chats and returned actual file values through native parent reports. Children also called the host file tool under their own recorded native identities, including a Default-permissions case.

The installed interface stopped a child, followed up on the same child, and retained another child's draft while that send completed. Closing and reopening Agentopia restored the selected child and its unsent draft, marked unfinished work interrupted, and explicitly resumed the same native child. Reopened main chats retained collapsible child activity and main-agent reports. The actual Electron interface check separately passed Back/Forward, project sidebar grouping, selected-row visibility after loading, and dark/light rendering without requesting inference.

The final preservation audit retained the two original accounts, their passwords and roles, earlier live conversations and files, and all **34 immutable migrations**. Installed modules, UI and native resources match the recorded build. All six core Supabase services and local Whisper remained healthy; temporary test providers were absent. The original command-permission settings were restored, and the backup included PostgreSQL and the recovered native child rollout.

Release records are under `.supabase/desktop-poc/subagent-chats/`, with the automated log copied as `automated-0.29.0.log`. The private backup is `C:/Users/charl/AppData/Roaming/Agentopia/backups/2026-10-16T20-45-21.611Z-manual`. These checks establish the tested application-restart behavior; full Windows restart and clean-machine qualification remain separate checks.
