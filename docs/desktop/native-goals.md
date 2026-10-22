# Native Codex goals in the chat interface

A later [source goal-controls change](goal-limits.md) adds explicit unlimited turns and editable token budgets with migration 0057. It is now packaged in the uninstalled [0.44.7 installer](goal-limits-0.44.7.md). The 0.44.6 behavior and evidence below retain their original bounded-goal scope.

Source qualification — October 17, 2026. The separately verified [0.44.6 installer](native-routing-0.44.6.md) packages this work and the subsequent child inference correction; it is not installed. The earlier 0.44.5 installer remains held. Installed Agentopia remains 0.43.7 and the application database remains at migration 45.

## Finding and resulting behavior

The pinned Codex runtime starts automatic turns when a native goal becomes active. A controlled test through the actual executable demonstrated that the previous Agentopia harness returned after the first response while Codex continued the goal. That detached later work from the chat’s active request and controls. The frozen 0.44.4 child-presentation installer is held; its earlier checks remain valid for their original scope.

The source now keeps a native goal attached to its owned request until it stops and its current response finishes. Automatic turns retain the account, connection, workspace, agent policy, tools, streaming activity and steering controls. The inference gateway requires an active owned execution and waits for its saved accounting before releasing a credential. A reused worker validates its current request rather than retaining the earlier request’s authority check.

## Goal controls and persistence

- Composer goals use the real thread/goal APIs and completion status. The explicit legacy harness retains its existing completion marker.
- Existing one-to-ten-turn allowances remain in force. Each root turn is reserved and saved before inference, updates the visible goal count, and stops native continuation at the allowance. Plan mode produces one planning turn.
- A compact, collapsible goal row shows native status and the token usage reported by Codex. Pause prevents another automatic turn while allowing the current response to finish. The chat Stop control pauses the goal and interrupts the response. Mark complete is an explicit user control.
- Native child goals remain running through automatic turns after the parent response ends. Their chat keeps its activity and Stop subagent control. Reports remain queued until that child goal stops.
- A persisted active goal is paused before loading its thread after runtime loss. Only a new explicit request can then use the provider.
- Additive migration 0056 makes restart recovery count saved root turns inside each request. It retains the legacy one-turn fallback, checks account ownership and never reduces an existing usage count.

The existing composer turn allowance is still the user-facing limit. An unbounded composer option and a UI for editing native token budgets are not implemented in this change. Codex token figures are its own goal accounting; pausing can allow an in-flight response to finish, so those figures should not be treated as a provider billing total.

## Evidence and limits

The following tests use generated content and private temporary profiles. No live inference requests were sent to ChatGPT or OpenRouter.

- 29 focused checks include the actual native goal tool, automatic continuation, steering, pause, cancellation, completion, exact turn allowances, Plan mode, background child goals, both connection routes, cold restoration, current-request validation, delayed notifications and broker state updates.
- 35 existing plugin, skill, agent-policy and child lifecycle checks pass against byte-identical backend modules.
- Five controlled Electron interface checks cover collapsed layout, pause and completion controls, saved/child state, narrow width and inline errors. Captured layouts were visually inspected. These component checks do not establish a complete installed chat workflow.
- Seven checks execute the recovery SQL in PostgreSQL using generated tables in a separate schema inside a rolled-back transaction. The schema disappears, while production row counts, migration count and the installed recovery function remain unchanged.

Qualified source changes are six existing product files and two additions. The earlier slim interface stylesheet remains an exact prefix. Both backend and renderer compile successfully.

Evidence directories:

- Goal workflow: .supabase/desktop-native-goals/check-1792295564722
- Plugin and child regression: .supabase/desktop-plugin-skills/check-1792295609573
- Interface: .supabase/desktop-native-goals/ui-1792295282675
- PostgreSQL: .supabase/desktop-native-goals/storage-1792295056601
- Source hashes and compiled module manifest: .supabase/desktop-native-goals/qualification-1792295706632

The saved ChatGPT connection still has plan scope, but the inspected access token has expired. No renewal or live inference was attempted. Fresh user authorization, an exact new image containing migration 0056, live acceptance, backup, installation and restart checks remain open. Controlled responses prove transport and lifecycle behavior; they do not prove a live model will make every correct decision.

[OpenAI app-server documentation](https://learn.chatgpt.com/docs/app-server) describes the persisted thread goal APIs. The behavior above was also checked against the pinned 0.163.0 executable and its generated protocol types.
