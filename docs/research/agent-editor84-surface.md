# Agent editor surface, slice 84

Create and Edit now use a narrow main column containing the agent avatar, name and description, resource picker rows, a compact Conversation starters button and one Instructions editor. The existing model, permissions, memory, files, identity and automation controls remain available through compact controls.

Clicking the avatar opens a profile modal containing the existing protected local image picker and visual icon/color choices. Conversation starters have a separate modal with editable titles/prompts, ordering/removal and AI generation through the existing durable builder conversation. Generated starters appear as a reviewable proposal. Closing generation stops its owned request; a reply for an earlier draft cannot replace current starters. A saved agent still requires explicit Save profile and starters. New-agent modal changes remain in its creation draft.

The Instructions toolbar starts collapsed behind its icon button and expands to icon buttons with accessible labels/tooltips. Its compact mode menu switches between formatted editing and Markdown source. Selection survives toolbar and link actions. Source bytes remain unchanged until an edit. The UI uses the shared 500,000-character bound.

Legacy guidance folds into Instructions once per exact legacy source. The editing copy keeps the original definition for recovery. Reloading the saved definition and reopening a retained draft preserve owner changes without appending the same guidance again. Explicit Save uses the revision-checked atomic basic/behavior API from the behavior slice.

## Verification

`npm run desktop:typecheck` passed with the backend and resource source overlays. `node scripts/desktop/test-agent-editor84-ui.mjs` passed 13 actual Electron checks with a controlled bridge and isolated profile. No production store writes or paid inference requests occurred. The bridge simulated actual builder preview start/read/stop contracts; these UI checks establish interaction and payload behavior, while the backend slice separately verifies the SQL transaction.

Evidence: `F:/Agentopia-Consolidation/skills/.supabase/agent-editor84-ui/1793024376754/evidence.json`.

The same directory contains new/saved page screenshots at 960 and 1470 pixels in light and dark themes, plus profile-modal.png and starters-modal.png. Checks include disabled Create controls with a visible explanation when no model is selected, no inline legacy form, unsaved modal edits, protected image preparation route, reordering/removal, real generation contract, selection-preserving bold/link/undo, exact Markdown restore, atomic revision payload, reload/reopen idempotence, cleared unsaved status after acknowledged Save, presentation revision guard, keyboard modal access/focus restoration, cancellation on close and rejection of late output after a draft change.

This commit is source only. Packaging, installation and live-provider acceptance are owned by the parent delivery task.

The page Escape handler ignores keyboard events arriving through portaled modal content, so closing a profile modal returns to the editor and restores focus. The UI typecheck also passed after the no-model guard.
