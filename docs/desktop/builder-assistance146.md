# Agent builder assistance acceptance

Outcome: the new/saved agent editor offers a conversation beside the current configuration, as observed in the reference editor. A user can describe an agent, ask for improvements or advanced procedures, inspect suggested field changes, apply them to the unsaved form, and test the resulting draft through the existing preview. Existing Save/Create controls commit the configuration.

Reuse the existing real Codex draft-preview executor, selected connection/model, Stop, ownership checks, durable encrypted draft journal and retained PostgreSQL conversation. Builder and test conversations must use different saved session locations. No new dependency, execution service or database table is needed.

Acceptance before implementation:

- New and saved editors show the builder beside configuration; narrow windows keep both reachable. Reference actions include Test this agent, Add advanced logic and Improve this agent.
- Proposals can edit name, description, instructions, handle, role, procedures, written guardrails, persistent skill text, icon, color and conversation starters. They cannot grant tool access, connect services, change the selected provider/model or save an agent. Existing permission/resource controls remain authoritative.
- Applying a proposal preserves unrelated edits. If a proposed field changed since submission, application refuses to overwrite it. Proposed changes remain reviewable after reopening, and malformed or unsupported output remains visible without altering the draft.
- Real Codex execution uses the chosen connected provider and normal Stop/capacity/owner/recovery paths. The target configuration is treated as data; its instructions are not executed as the builder's instructions.
- Closing/reopening reads retained builder history and pending outcomes without inference replay. Draft preview history remains separate. Full configuration size limits remain supported without truncating saved instructions.
- Focused shared-contract and rendered-editor checks cover the behavior above, followed by one fresh real OAuth builder/edit/test flow in an isolated packaged profile and recoverable installed verification. Reuse unchanged provider/Computer Use/recovery evidence. Preserve the ordinary accounts, passwords, chats and connections.

This slice leaves authenticated external-service acceptance, remaining sharing/channel differences, the warm-endurance shutdown diagnosis, reliable longer OpenRouter work and the final complete installer in the full goal.

The first packaged database attempt rejected the added builder snapshot key before any provider dispatch. Migration0083 extends the existing preview acceptance function to retain that passive context and enforce Chat only, no tools/delegation/memory, and no attached execution resources. It adds no table and preserves the previous function checks. The corrected acceptance must use fresh request identities and retain the failed preflight.
