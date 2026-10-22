# Full-page agent editor and automation navigation

The agent editor now opens as a separate page below the desktop menu bar. It provides Back navigation, the agent name and description, section navigation, instructions and connection controls, automations, and a saved-agent preview. The existing policy, procedures, skills, memory, connections and earlier configuration sections remain accessible. Background chat components stay mounted and their controls are temporarily inactive, so opening the editor preserves chat state and unsent drafts.

Saving an existing agent keeps the page open. Unsaved persistent-role changes remain present when the user switches sections or saves basic instructions. Leaving with unsaved changes requires an explicit discard choice. Preview is labelled “Preview saved agent” and is disabled while edits are unsaved; it opens the saved identity's home without submitting an AI request. New-agent creation retains the selected provider, validates the name field and saves once.

The home automation list and form now replace each other, with one modal visible at a time. The compact new-automation form resolves the agent's explicitly saved provider/model against that provider's catalog. The account's remembered composer model no longer replaces it. An unavailable saved agent model produces an actionable error and prevents saving or running. Existing saved schedules keep their saved options. This change applies to the compact agent automation form; the advanced task editor retains its explicit model controls.

Agent home connection rows now show the readable app name, optional connection alias and “Connected” or “Connection required”. Internal schema-discovery and execution explanations have been removed from those rows.

Qualification uses the actual compiled renderer and a controlled application bridge. Eighteen complete-app workflows cover directory/home navigation, full-page editing, saved metadata, unsaved role retention, memory scope, provider choice, creation, preview, automation transitions, narrow layouts and existing drafts. Eight additional queued-message/steering workflows verify draft preservation against the same renderer. Twelve focused automation workflows cover cadence/time zones, explicit model selection, missing-model refusal, single-dialog navigation, permissions, context exclusion and uncertain run acknowledgement. These checks make no external model requests. Their overlapping coverage is recorded separately.

The live Chrome reference editor and automation form were inspected without editing or submitting them. The reference contains richer instruction editing, an agent-building assistant and external channels. Those capabilities, avatar editing, organization sharing/discovery, and unsaved-definition preview remain unfinished in Agentopia. Full parity is not claimed.

Frozen renderer: `F:/Agentopia/.supabase/desktop-agent-editor67/1792702559348/proof.json`.

Complete-app qualification: `F:/Agentopia/.supabase/desktop-agent-editor67/1792702559348/rendered-1792702703217/evidence.json`.

Queue/steering drafts: `F:/Agentopia-Acceptance/chat-acceptance-drafts/1792702778195/evidence.json`.

Focused automation qualification: `F:/Agentopia-Acceptance/agent-automations-1792702364423/evidence.json`.

UI-only installation and ordinary visual acceptance passed. Its controller captures a fresh database snapshot and verified compressed raw profile, retains the prior UI on F:, checks the physical Windows location, closes/reopens normally and verifies unchanged account/agent/database data. The backend stays on the verified 0.44.67 archive, schema70 and recovery capability12. Actual ordinary inspection verifies the full-page editor, correct saved-agent preview, concise connection rows, one foreground automation dialog and the saved gpt-5.6-sol model. Both unsaved automation dialogs were closed without submission. All1,800 saved database rows and protected-store values are unchanged. Four agent profiles and both memories remain valid. Fresh raw-profile recovery and previous UI rollback are retained on F:. No model or OpenRouter requests were made.

Delivery receipt: `F:/Agentopia/.supabase/desktop-agent-editor67/1792702559348/delivery-accepted.json`.
