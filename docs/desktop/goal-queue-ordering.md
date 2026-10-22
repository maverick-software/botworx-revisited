# Goals and queued messages

October 18, 2026. This source work follows the cross-chat broker integration. The ordinary installed app remains 0.44.17/schema59; the frozen 0.44.18 candidate is separate. No production migration or new installer is part of this change.

## User-visible behavior

A message submitted during work remains queued by default. Explicit Steer still supplies guidance to the current native turn. When a goal is pursuing its objective, accepting queued work asks the native runtime to pause automatic continuation. The current response can finish. The queued messages then run in order, and the goal continues afterward.

The goal retains its objective, accumulated goal-turn count, remaining allowance and original execution options. Queued responses retain the connection, model, permissions and context selected when each was sent; they do not count as goal turns. No automatic provider fallback is introduced. Native goal identity and token allowance are retained when the same native scope is resumed.

The goal's saved state remains running during this temporary yield. Its details explain that queued messages run before continuation. This is separate from the user's Pause control, which prevents automatic goal resumption. Mark complete and Delete also end the continuation intent. These controls leave an independently running queued user response alone.

A held queue entry waits for explicit review, removal or resume. A failed, cancelled or unconfirmed queued response pauses the goal for inspection, including when the queue entry was already removed after acceptance. The goal waits until the receiving response's outcome has been saved, rather than treating removal from the queue as task completion.

Closing or signing out wakes the suspended goal so shutdown can finish. Existing startup recovery pauses saved running goals and holds queued entries. Restart does not authorize automatic replay or resume.

## Implementation

`GoalQueue` coordinates temporary yielding, outcome settlement and wakeups within an account and conversation. It waits on actual queue/lifecycle events and coalesces asynchronous readiness checks. The durable messages remain in the existing queue and database records.

The broker asks `CodexHarness.yieldGoal` to pause a matching running composer goal. A saved `goalYielded` marker distinguishes this temporary pause from a native usage limit, blocked state or ordinary user pause. Work accepted while the native goal is still preparing is checked before automatic continuation is armed. Current-turn steering and goal ownership remain unchanged.

During a yield, the broker's queue gate allows messages in that conversation to run while retaining the goal's continuation intent. Completed queued requests settle their saved status before the goal can proceed. Failed outcomes pause the goal and hold remaining messages. User controls take precedence over a delayed readiness check.

Goal cleanup now targets the requests owned by that goal. Shared native workers retain unrelated newer roots, independently owned children and other reports. Completed child results keep their completed status, including when a pending report is cancelled. A second goal cannot enter a conversation already owned by another running goal.

The transcript no longer adds a second native-goal card for a goal already managed by the composer strip. Independently created native goals and child controls remain available. The active-agent chip also uses the theme's text color, correcting the dark label that previously appeared blank on its dark background.

## Evidence

- `.supabase/desktop-goal-queue-ordering/check-1792351059862/evidence.json`: backend/renderer compilation and **101 checks** pass. Coverage includes queue settlement, failed outcomes, Pause/complete during queued work, simultaneous goal-start reservation, source cancellation, sender attribution, native inference routing and existing goal/queue regressions.
- That folder's `native-queue-openai-oauth.json`, `native-queue-openrouter.json` and `native-queue-openai-oauth-preparation.json` run the actual bundled Codex app-server with controlled persistence and model responses. Each sends exactly three controlled requests in order: the goal response, queued user response and resumed goal. The first response is allowed to finish; goal identity, creation time and token allowance survive. The preparation case accepts queued work before native goal setup finishes. No live provider request is made.
- `.supabase/desktop-goal-queue/ui-1792351258484/evidence.json`: **ten complete DesktopApp renderer workflows** pass through a controlled bridge. They cover default queueing, editing, explicit steering, reopen/removal, inline goal creation, the single-strip yielded state, Pause preserving an active queued response, editing errors, expand/delete and theme/narrow navigation. The actual 760-pixel viewport switches between the workspace pane and usable chat controls. Dark, light, yielded-goal and narrow captures were inspected. Source and generated-renderer hashes are retained.
- `.supabase/desktop-chat-delivery/controls-ui-1792351240184/evidence.json`: **twelve coordination renderer checks** pass with the updated native-turn presentation, including received/steered source labels, exact-turn controls and permission revocation.

The earlier 93- and 100-check runs are retained as intermediate evidence. The final run additionally covers the chat reservation made before asynchronous goal setup. The UI verifier's narrow case was corrected to resize the actual browser viewport and prove navigation back from the workspace pane to the composer. A screenshot at the original emulated width was not counted as narrow-layout evidence.

Repeat the source/runtime checks with `npm run desktop:test:goal-queue-ordering`. The complete interface check is `node scripts/desktop/test-goal-queue-ui.mjs`; coordination controls use `npm run desktop:test:chat-delivery-controls-ui`.

## Acceptance boundaries

Source tests exercise the queue coordinator and real broker control flow with controlled persistence. Separate tests run the actual bundled Codex app-server through ChatGPT and OpenRouter adapters with controlled model responses. Those prove the stated native pause/message/resume sequence without using provider credentials or issuing paid inference.

Complete acceptance still requires the complete packaged sender/receiver interface, rapid finishing-turn races, cold restart during a yield, live ChatGPT work and physical installed verification. Provider/model changes during the wait, queued messages that revise the objective or change the native goal's state, and scope changes require explicit full-workflow cases before claiming complete parity. The broader artifact, schedule, skill and desktop requirements remain in the capability snapshot.
