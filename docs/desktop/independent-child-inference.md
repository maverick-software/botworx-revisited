# Independent child inference after a parent Stop

Source correction — October 17, 2026. Installed Agentopia remains 0.43.7. The frozen 0.44.5 installer remains held.

## What happened and why

A new check through the actual archived 0.44.5 harness stopped a parent response, then sent an explicit follow-up in its completed child chat. Codex accepted the child turn, but Agentopia rejected every request for its model credential because the gateway checked the parent’s cancelled controller. The child could appear to be working while its model request never left the local gateway. No paid inference was used in the reproduction.

The native request identifies the child in its thread-id header while session-id can still identify the parent. Authorization must follow the live child thread and turn. Using the shared session or every execution in the worker couples otherwise independent controls.

## Source correction

- The gateway validates native thread and turn metadata before requesting a provider credential. It matches that pair to an active owned root, report or child execution.
- Children use their own cancellation controller and retain the parent’s current account, agent, workspace and plugin permission checks. Stopping a response does not silently revoke an otherwise valid child assignment. Explicit account, provider, agent, goal and plugin revocation still stop their affected work.
- Early HTTP requests wait briefly for the trusted app-server start notification. An unrelated active thread or shared session never supplies ownership.
- Local scope refusals return a 403 instead of a retryable network error. The gateway checks authorization again after retrieving the credential, and a caller abort cannot start a later upstream request.
- A resumed child begins its real turn lifecycle when the start acknowledgement arrives. Its Stop control can then interrupt that resumed generation.

## What the tests establish

The failing archived case is retained at .supabase/desktop-native-goals/child-resume-audit-1792296814180. The corrected actual-Codex case resumes the child after parent interruption, starts another child turn, refuses a stopped-parent request while that child is active, and cancels the child’s held response through its own control. This establishes both independent continuation and separation between execution scopes.

Thirty-seven focused checks pass, including malformed routing, exact-turn ownership, delayed start notifications, current permissions, cancellation before forwarding, the earlier goal workflows and both provider routes. Thirty-five existing plugin, skill, permission and child lifecycle checks pass against byte-identical backend modules. Backend and renderer compilation pass. All provider responses are controlled and no production data is accessed.

Only codex-gateway.ts and codex-harness.ts differ from the frozen 0.44.5 product snapshot. The interface, migrations, runtime binaries and provider settings are unchanged. The existing migration 0056 remains required; this correction adds no migration.

Evidence:

- Focused checks: .supabase/desktop-native-goals/check-1792297436010
- Plugin and child checks: .supabase/desktop-plugin-skills/check-1792297506514
- Source hashes and compiled module manifest: .supabase/desktop-native-goals/routing-qualification-1792297657759

The correction is now packaged in the separately verified [0.44.6 installer](native-routing-0.44.6.md). It passes exact-artifact controlled checks and remains uninstalled, pending fresh ChatGPT live acceptance, backup, installation and restart checks. The earlier 0.44.5 installer and its original test records remain unchanged and must not be promoted.
