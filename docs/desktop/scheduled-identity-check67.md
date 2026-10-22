# Same-account identity checks and scheduled claims — source67

The packaged combined scheduling check demonstrated real clock dispatch into two project chats. Actual Codex tool calls wrote a marker in a new Git worktree and another in a selected local folder, while the original Git checkout stayed unchanged. An in-flight scheduled request was cancelled and remained cancelled after normal reopening. A queued revoked-folder run remained held without a chat request or Git reservation.

That held run's message said the account changed. Its absence of effects establishes a safe outcome, but does not establish that file-grant revocation caused the hold. The scheduling gate remains open.

An actual packaged diagnostic then controlled the ordering of a real PostgreSQL claim and an ordinary identity check. The observation wrapper left the scheduler's decision unchanged. The account UUID and scheduler generation stayed identical, the session remained signed in, no recovery was pending, and no backup was active. Only the temporary identity-check flag was set. The Broker's scheduler owner callback returned null during that check. The actual TaskScheduler therefore held the newly claimed, unsubmitted run with the account-changed message. No inference occurred. The same predicate also caused an earlier diagnostic schedule-save operation to reject a still-valid account.

The source fix separates account identity from temporary dispatch availability. The owner callback now remains stable while the same signed-in account is checked. Maintenance or identity/recovery checking prevents polling through `canPoll`. If a temporary block appears after a durable claim, the scheduler returns the unsubmitted run to pending only when persistence proves deferral is safe. It holds the run if that proof fails. Genuine sign-out, account change or closure still uses the ownership hold. No completed or uncertain request is automatically retried.

Two new regressions failed before the fix. After the fix, all 22 maintenance/scheduler cases pass, including normal resumption exactly once and refusal to defer an uncertain claim. All 41 desktop admission/close/storage controls also pass. These suites overlap and are not combined into a total. The source fix has not yet been packaged or verified in a new Windows candidate. The prior frozen candidate remains ineligible for scheduling/installation qualification.

Evidence:

- Original combined case: `.supabase/desktop-scheduled-workspaces67-real/1792696871496/restored/project-schedules-1792699286650/evidence.json` and its `app/evidence.json` (normal failure cleanup, five locally controlled responses across three native requests).
- Read-only cold audit: `.supabase/desktop-scheduled-workspaces67-real/1792696871496/restored/project-schedule-audit-1792699427607/evidence.json`. It does not replay the original work and does not prove the cause of the revoked run's hold.
- Actual claim/identity trace: `.supabase/desktop-scheduled-workspaces67-real/1792696871496/restored/identity-diagnosis-1792699662649/evidence.json`.
- Failing source regressions: `.supabase/desktop-scheduled-workspaces67/maintenance-poll-1792699711985/evidence.json`.
- Passing source regressions: `.supabase/desktop-scheduled-workspaces67/maintenance-poll-1792699744977/evidence.json`.
- Current desktop controls: `.supabase/desktop-scheduled-workspaces67/controls-1792699807479/evidence.json`.
- Recorded findings and next gates: `.supabase/desktop-scheduled-workspaces67/identity-check-qualified.json`.

Next: freeze a new candidate, verify the actual Broker owner/polling wiring during a post-claim identity check, then run new combined project/clock/cancellation/revocation cases. The previous requests, outcomes, edited files and diagnostic holds must remain preserved. Revocation must reach its own saved-scope validation before it can qualify. Recheck the necessary archive/recovery/installer gates for that corrected package before ordinary-profile installation. Ordinary Agentopia remains on 0.44.66 and was not changed by these tests.
