# Agentopia — real before-Save preview verification

Checkpoint133 verifies real OAuth execution in an unsaved agent preview on the exact currently installed 0.44.76 archive. Two new requests read a reviewed skill reference and a generated invoice file, write independently checked receipts, and reflect a change to the unsaved role. Full test-app reopening preserves both results without inference replay. No saved agent or ordinary chat is created or changed. The installed application is unchanged from checkpoint132; the full goal remains active and incomplete.

## Experiment and result

The experiment ran the actual packaged main-process interface, Broker, PostgreSQL preview tables, permission checks and pinned Codex harness in an isolated generated account and runtime. It used real ChatGPT OAuth responses. The account received a short-lived access-token lease with no refresh credential. The ordinary profile was read only to obtain that existing access; it was not used for test messages, agents or files. No real OpenRouter request occurred.

A small reviewed test skill describes the reconciliation procedure and refers to a separate method file. That reference contains a generated procedure seal and the required output fields. The selected workspace contains 20 generated invoice rows, with quantity, unit price in cents and credit in cents. The model must read the actual file and reference, calculate the net batch total using whole cents, and write one new JSON receipt. The expected result is calculated independently by the observer and is not supplied in the model prompt. Commands, browser actions, delegation, memory writes, other files and external services are excluded.

The first fresh request uses an unsaved identity with a zero-cent handling fee. Its receipt has the exact identity, reference-only procedure seal, 20 rows and **19,754 cents**. The second request changes the unsaved role to a different identity and adds a 17-cent handling fee. Its separate receipt has the new identity and **19,771 cents**. Both files match the independent expected objects; the original CSV and first receipt remain intact. Each task uses six real OAuth response calls and writes its receipt once. The current-role changes come from the actual accepted preview snapshot, while the reviewed package remains the same.

The creation's reviewed package remains attached to its creation identity and is unbound to any saved agent. Saved-agent, profile, definition-revision, normal conversation, ordinary request, message and normal tool-call tables match their pre-test snapshots. Actual preview tool receipts use the separate preview table. The same application then closes normally, removes its leased credentials and stops the generated runtime.

A second complete startup reads both completed preview requests and their tool histories, checks the exact saved files and confirms that the creation still has no saved-agent binding. The normal tables still match. No model response is requested, no pending operation is replayed, and the test app and runtime close normally again. This establishes the named file-and-skill preview path and cold retention. The experiment submits through the actual desktop preview interface; it does not repeat the unchanged editor's rendered interaction checks or certify every preview tool family.

## Observer failure and correction

An initial setup attempt exceeded the test launcher's allowed observation timeout and submitted no model request. Its receipt is retained. An initial actual task then stopped after four response calls and wrote no file. Its stored file-read tool receipt was completed, while the test observer reported a type error.

The observer counted images by calling an array operation on `result.content`. The real `read_file` result uses text in that field, so the observer threw after the product had successfully read the CSV and before the model received the result. A focused regression reproduces the exact failure. The corrected observer counts images only when content is an array; plain text, image blocks and structured content all pass. Product code is unchanged. New request identifiers and a new generated workspace were used for the successful tasks; the original completed request was preserved and never replayed.

## Audit findings and remaining implementation

The current unsaved preview deliberately excludes browser, shared Windows window, command, delegation and persistent-memory execution. In source, `DraftPreviewExecution.capture` rejects selected windows; its capability list includes scoped file, workspace-skill, reviewed-package and selected remote-connection tools. The preview connection chooser sets `browserAvailable={false}`, and the native preview runner disables native commands. Therefore the successful file experiment does not establish complete tool parity for before-Save previews.

The next concrete implementation slice is shared-window Computer Use in Preview draft, using the existing window picker, ComputerService, permission reviews and purple indicators. [The scoped requirements](preview-computer-scope133.md) identify the current normal-conversation assumptions, required preview ownership checks and acceptance checks. Keep unsupported families excluded until their own lifecycle and storage paths are implemented.

The full [32-element goal table](goal-status76.md) remains authoritative for current progress. Current implementation exclusions, authenticated Google connector setup, fresh complete reference comparison, longer default-context/unattended work and the retained reboot/different-user recovery checks remain open. General broader coverage is distinguished from these concrete missing or unverified paths; passing this experiment does not complete the full objective.

## Current state and evidence

Ordinary Agentopia remains 0.44.76/schema82/recovery18 with helper1.0.3 and archive SHA256 `a4b7ddb55d3a853e50e1fd49248e26f78fc993e86a86b266af33d87e6d2f7595`. The current installed proof and checkpoint132 preservation acceptance remain in force. There was no ordinary restart, migration, installation, external message or image-generation request in this checkpoint. Image generation remains disabled.

- `.supabase/desktop-live-draft133/checkpoint133.json` binds this checkpoint.
- `.supabase/desktop-live-draft133/current.json` points to the accepted warm experiment and both request IDs.
- `.supabase/desktop-live-draft133/cold-current.json` records complete cold retention and zero inference.
- `.supabase/desktop-live-draft133/observer-failure-*.json` and `failed-setup-*.json` preserve the earlier attempts.
- `scripts/desktop/test-live-validation-result-shapes.mjs` reproduces the observer defect and checks all three result shapes.

F:/Agentopia remains authoritative. Follow AGENTS.md, exclude docs/research/, use no subagents, preserve all completed or uncertain requests and serialize runtime/build/test/maintenance work through operation-lock.mjs. Routine live checks use OAuth; retain OpenRouter without unnecessary paid tests. The next complete installer must still incorporate checkpoint132's focused archive correction.
