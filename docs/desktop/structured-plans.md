# Structured plans and implementation

Desktop version 0.14.0 adds saved plans, an editable plan canvas, progress, and a goal-based implementation handoff. PostgreSQL and Supabase continue to hold plans, revisions, messages, tool receipts, and goals. Local unsaved edits use Windows-protected application storage.

## Propose and review

Turn on **Add → Plan mode**, describe the work, and send it through either provider. Models with tool support can read the current plan and save a proposal through `planning.set_plan`. New steps start pending. Plan mode continues to exclude file writes; creating a plan does not authorize its implementation.

The conversation shows a compact plan card. Open it, or use **Open plan canvas** in a saved plan-tool result, to display the plan in a right-side tab beside files, browser/canvas tabs, and folder navigation. The card and canvas update as the agent reports progress. Each conversation has one current plan, with up to 20 steps, a 200-character title, and a 4,000-character overview. Steps can contain up to 1,000 characters each.

**Edit plan** allows title, overview, step text, ordering, additions, and removals. Typing saves a local draft. **Save plan** explicitly publishes it to PostgreSQL and clears previous implementation approval. **Discard local edits** asks before removing the draft. Local edits can be recovered after a reload or app restart; forced termination retains acknowledged draft writes. The normal window-close flow flushes pending workspace drafts before shutdown.

Saving uses the revision opened by the editor. If the saved plan changed, the draft stays available and the newer version is preserved. Discard the local changes to reload the current plan. The latest 20 versions are available in **Version history**. Earlier tool messages and implementation goals retain their original snapshots.

## Implement

Review the complete plan and select **Implement plan**. Choose a turn limit from 1 to 10, then **Approve and start**. This creates a goal with a snapshot of the exact approved plan and starts it in that plan's conversation. It retains that conversation's selected provider, model, thinking level, files, and permissions and turns Plan mode off. Switching providers before the handoff or when resuming a paused goal uses the same executor and saved conversation.

Approval of a plan retains the existing file and external-tool controls. A proposed file replacement still waits for approval of its exact diff. Selected files access stays read-only; Chat only excludes file sharing and file/external tools. A plan cannot grant access to another account or an unselected workspace.

During implementation, `planning.get_plan` provides the current step IDs and revision. `planning.update_plan_progress` updates known steps and permits at most one in progress. Reports are accepted only for the current running implementation of the approved content version. An agent cannot replace the approved plan during that implementation. Pause or stop work before saving a changed plan; resuming an older goal after a plan edit requires a new review and implementation goal.

Completion is based on the saved step statuses after a successful response. A completion phrase alone cannot finish a plan goal with pending steps. Progress remains an agent report: users should inspect file changes, tool results, and verification before accepting the outcome. Unfinished work remains visible when a response fails, work is paused, or the turn budget is reached. A new approved implementation can authorize more work.

## Persistence and boundaries

Additive migrations `0017-plans.sql` and `0018-goal-recovery.sql` add owner-protected plans, immutable revision snapshots, goal links, transactional approval/handoff, and recovery of consumed goal attempts. Original migrations are unchanged. The maintenance backup taken before provisioning preserves the earlier database state.

Every implementation request records its starting plan snapshot alongside its model/options and file/project snapshots. An intervening saved plan or project revision change during preparation causes an error before inference begins. File writes retain their current-file hash checks. Request identifiers remain idempotent. On restart, running goals pause, consumed attempts are reconciled from persisted requests, and interrupted plan operations direct the user to the saved plan and revision history. App restarts do not reset the authorized turn budget. Deleting a conversation removes its plan, revisions, linked plan goals, and local plan edit; independent file drafts keep their existing behavior.

Plain-text planning remains available for models that do not support tools. Structured plans require tool support. This delivery does not add shell execution, scheduled wakeups, project memory/sharing, or low-latency provider-native audio. Those remain in the broader [parity audit](parity-backlog.md).

Verification results and their distinction between controlled provider traffic and real inference are recorded in [implementation status](implementation-status.md).

## Verification

All 62 automated checks passed. The five plan core checks were repeated after final changes with verified fixture cleanup. The full installed workflow passed editable/recoverable plans, history, saved request snapshots, rejection of stale edits, approved handoff, actual local file writes, goal limits, app-restart recovery, and original workflows. Additional UI checks opened a plan beside another chat with private unsent context and verified that implementation retained only the plan conversation's provider and file scope, including legacy conversations without saved composer options. Completion control markers are absent from displayed/copied replies. Regression inference was controlled.

The installed application then used real ChatGPT `gpt-6.1-sol` with High thinking to propose a two-step pending plan. The canvas review changed its overview and final verification step. Real OpenRouter `openai/gpt-6.1-sol`, also with High thinking, implemented that reviewed version, waited for the exact generated-file diff approval, saved the requested Status change, reread the saved file, and reported both steps complete. The goal completed in one of two authorized turns. Four messages, original/user-reviewed snapshots, revision history, the approved edit, and actual verification reads reopened.

Live evidence is retained in `.supabase/desktop-live-plans/evidence.json`. The saved conversation is `f5a82b9c-cf1f-4e85-a779-7db6fe8b2248`; the plan is `725c4153-60fd-4660-b251-76c2fc537f4c`. Final checks verified the two original accounts, unchanged passwords and administrator assignment, all prior demonstrations, eighteen immutable migrations, six healthy Supabase services, and an installed build matching the verified source output.
