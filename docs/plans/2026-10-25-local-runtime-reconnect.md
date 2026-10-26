# Local connection recovery correction

The reported location-save, plugin-load and agent-draft errors share a local connection failure. Startup recorded `ready=true` and never rechecked that state. If WSL or its native services stopped afterward, the desktop continued dispatching calls against that stale state. Its Retry action also did nothing once startup had completed.

A second failure prolonged the agent-editor problem. Its first failed read was cached as a rejected initialization promise and treated as a draft reconciliation problem. Restoring connectivity did not clear that promise. The controlled test reproduces this failure against commit `737136dccd11edf721c48101fc00fe71889f85c0`, then runs the same case against the correction.

## Implemented behavior

- Resume, window focus and observed transport failures share one health/recovery attempt. Normal online desktop calls and draft keystrokes issue no additional health requests. Observations cache their result for five seconds and automatic recovery attempts back off for twenty seconds. When a dispatched operation settles, its one-shot event can retry a deferred recovery. The user can explicitly retry sooner.
- Health verifies authentication service availability and an authenticated query returning zero agent rows. This also detects a reachable HTTP server whose database connection has failed. Credentials remain in memory and are not included in diagnostics or test output.
- Reconnection uses the installation's already verified runtime binding, bound database port, existing PostgreSQL data directory and four matching encryption-root bindings. It starts the existing native services only. It does not call Broker initialization, run application migrations, create accounts, replace encryption roots or provision a new database. The maintenance file and connection identity must remain unchanged.
- The live Broker and mounted editor stay present. A distinct connection status supplies a Reconnect button. A transport failure leaves the exact emergency journal and pending write identity intact. Only the failed editor read can reopen automatically after recovery. Ownership, conflicting revisions and invalid journals retain their existing strict recovery behavior.
- A failed caller is never invoked again by connection recovery. An interrupted action asks the user to inspect its saved result before retrying.
- Recovery waits for active desktop calls, native/preview work, terminals, editor writes and maintenance. Passive saved queues do not prevent recovery. The existing maintenance fence prevents queue admissions during reconnection.
- Stop, local goal pause and Deny remain available using the cached signed-in owner and exact live request/approval identities. Native controls additionally check the current child turn or background process identity. Accept, send, answer questions, resume and report retry remain excluded from the offline path. Goal pause clearly labels an unconfirmed saved status.

## Verification

Run `node scripts/desktop/test-runtime-reliability.mjs`. The runner compiles the backend, checks renderer types, reproduces the original rejected-read bug, then runs corrected connection/editor/cancellation tests and Python existing-service/stale-lock tests. Test output stays under the worktree's `.supabase/runtime-reliability/` directory.

At the latest source verification, 42 JavaScript tests, five existing-service tests and ten existing PostgreSQL process-record tests passed. The checks cover zero extra requests during 200 ordinary admissions; coalesced reconnect attempts; no replay after an interrupted action; preservation of real draft conflicts and exact pending write identities; account-switch and signed-out rejection; decline-only approvals; exact native child/process identity; retained passive queues; and active work stopping before recovery proceeds.

The pre-existing `runtime-import-shutdown.test.py` fixture rejects the unchanged importer's `ANALYZE` command before reaching its assertions. It was not modified or counted as passing. The directly affected stale process-record tests pass.

The ordinary installation’s authentication and REST HTTP endpoints responded to read-only probes. No production services were stopped, no production data or credentials were changed, and no model request was made by these tests. A real service interruption/resume in an isolated QA installation remains required for release qualification, followed by mounted-editor, data and encryption-root comparisons.

Read-only shortcut inspection found both Desktop and Start Menu entries target the root `AgentopiaDesktop/Agentopia.exe` launcher, with the current `app-0.44.79` working directory. The uninstall registration also reports version 0.44.79. This inspection did not establish a stale shortcut as the cause of the navigation shown in the supplied screenshots.
