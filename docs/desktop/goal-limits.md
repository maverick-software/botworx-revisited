# Goal limits and token budgets

Source qualification — October 17, 2026. These controls are implemented and controlled-tested in source, and a separately verified [0.44.7 installer](goal-limits-0.44.7.md) now packages them. They are not installed. The frozen 0.44.6 installer remains unchanged at schema56; the current installation remains 0.43.7/schema45. This source requires additive migration 0057.

## User behavior

- Add to chat → Goal retains the existing three-response default. Keep working until complete explicitly removes the turn cap. An optional finite cap accepts 1–1,000 turns.
- Use a token budget sets a total native Codex goal allowance. Earlier usage reported by Codex is retained when a paused goal is resumed with a revised budget. Removing the budget preserves that recorded usage.
- A paused goal exposes Goal settings in the composer. It can save new limits or save and resume. Active executions must stop before settings can change. Editing limits retains the goal objective and saved turn count.
- Native continuation keeps its existing streaming, steering, cancellation, tool permissions and child controls. Plan mode still authorizes one planning response. Unlimited and token-budget settings require the Codex harness; both ChatGPT and OpenRouter use that harness.
- Native budget exhaustion pauses work. Raising a budget explicitly reactivates continuation, including the native budget-limited state. A spent allowance cannot start another provider request until settings change.
- Creating a separate goal explicitly starts a distinct allowance, even if its objective text matches an earlier goal. Resuming the same goal preserves usage.
- Failed saves retain the edited fields and show an inline error. The dialog and saved-goal rows fit the dark and narrow light layouts inspected in the component fixture.

## Native usage and boundaries

The goal token display follows Codex’s own accounting. Its active-goal counter can differ from provider response usage, particularly when pausing or applying a turn cap. In the controlled test, a budget of 10 allowed an in-flight response to finish and reported 14 tokens before further continuation stopped. This setting is not a dollar-spend estimate. Provider charges and account limits still apply.

A token-budget change does not itself restart inference. A user must choose Resume; the harness reactivates the native goal while retaining its usage. Work after runtime loss still requires an explicit new request. Agent, workspace and plugin permission checks remain enforced.

## Verification

- 45 focused checks compile the backend and renderer and use the real pinned Codex executable with controlled provider responses. They include twelve automatic native turns, native completion, budget exhaustion, budget revision/removal with retained usage, zero-turn refusals, a new goal with identical text, both provider routes, earlier steering/cancellation/ownership cases and account-scoped settings.
- 35 plugin, skill, agent-policy and independent-child checks pass against byte-identical compiled backend modules.
- Five Electron component-interface checks cover preserved defaults, explicit unlimited limits, budget creation, paused-goal editing, rejected-save drafts and narrow layout. These do not establish a complete installed workflow.
- Four real PostgreSQL checks restore an owned copy of the current snapshot and apply all migrations through 57. All 20,134 original values across 141 tables remain unchanged. Constraints reject invalid settings. Recovery records twelve native turns, preserves zero for refused inference, keeps the one-turn legacy fallback and never reduces saved usage. The test database is removed.
- No live provider request was made and no production migration was applied. Production remains at two accounts, 101 conversations, 338 messages and 45 migrations.

Evidence: .supabase/desktop-native-goals/check-1792299708197, .supabase/desktop-plugin-skills/check-1792299789436, .supabase/desktop-goal-limits/ui-1792299651895, .supabase/desktop-goal-limits/storage-1792299667480. Frozen product sources, tests, compiled modules and hashes are in .supabase/desktop-goal-limits/qualification-1792299867535.

An initial test incorrectly treated a paused one-turn goal as if it had active native goal accounting. The final refusal case uses an actual native budget-limited state. That distinction is retained in the earlier test evidence.

## Remaining release work

The separate 0.44.7 image now includes migration 0057 and passes delivered-interface and installer checks. Fresh ChatGPT live acceptance, a fresh complete profile backup, actual upgrade, native-session and installed workflow recovery, Windows reboot and clean-machine checks remain open. The 0.44.6 backend recovery and migration proofs retain their original schema56 scope. Broader desktop parity remains unfinished.

[Official OpenAI app-server documentation](https://learn.chatgpt.com/docs/app-server#manage-a-thread-goal) describes persisted goal state and budget changes that preserve usage. The pinned executable was also exercised directly for the behavior above.
