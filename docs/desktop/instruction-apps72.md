# Instruction app references — version72 source checkpoint

The agent instruction editor now supports selecting an assigned app with typed @ or Insert app. The saved Markdown contains the connection identity and a readable label. Two connections with the same name remain distinct. Formatted chips display the current name and connection state; renaming or revoking an app does not silently rewrite saved instructions. Source editing remains available, and opening, switching views or saving unrelated metadata preserves the original instruction bytes.

The picker uses the same catalog request as the agent's Apps resource row. App and profile reads run together once per editor revision; typing does not fetch another catalog. Both General and Behavior use the shared result. Filtering, keyboard selection, Escape, empty results, retry, source caret replacement, whole-chip deletion and undo are covered. Manual search cannot submit the agent form. Disabled connections are excluded; assigned connections needing reconnection remain identifiable.

At execution, the broker resolves each saved identity against the current assigned, enabled, connected sources and the final offered tool definitions. The runtime annotation identifies available connections for schema discovery. Unassigned, foreign, disconnected and policy-filtered references are unavailable and cannot select a similarly named connection. The annotation grants no permissions, changes no tool definitions and never modifies the stored instructions. Names and labels are quoted data. Both the native and retained legacy dispatch paths use this helper.

An additional save fix preserves text typed while an earlier save is pending. The completed request clears the unsaved state only if the current fields still match the submitted fields. Otherwise the newer draft remains visible and unsaved, saved preview remains disabled and a subsequent explicit save sends that draft.

The installed ordinary application remains **0.44.71**, with schema72 and recovery12. Root package and lock versions remain71. These source changes have not been frozen, installed or exercised through an actual Broker/PostgreSQL integration yet. No dependency or database migration was added. There were no live provider requests, ordinary-profile writes or changes to protected settings during this checkpoint.

Verification binds the following successful receipts to current source hashes, compiled modules, renderer files, controller fingerprints and screenshot hashes:

| Check | Result and purpose |
| --- | --- |
| Backend and interface compilation | Both pass; the new shared reference code compiles for runtime and renderer use. |
| Reference behavior | Six focused groups pass: source identity, punctuation escaping, literal code, duplicate names, missing access and unchanged grants/settings. |
| Existing policy/native/backup cases | Thirteen pass against the current compiled backend. |
| Instruction picker in owned Electron | Fourteen workflows pass, including a real pending-save gate and one shared catalog per full editor. |
| Existing rich instruction editor | Eight unchanged regression workflows pass, including source preservation, tables, tasks, links and clipboard handling. |
| Full application renderer | Twenty workflows pass against the source Vite build with a controlled bridge. These include the aligned editor layout, navigation, resource rows, saved identity and metadata editing. |
| Queue and steering drafts | Eight workflows pass against that same renderer, including switching chats and edits typed during acknowledgement. |
| Actual pinned Codex harness | Three turns across OAuth and OpenRouter adapters pass using five controlled response steps and two actual schema-discovery bridge dispatches. Removal changes the native scope. |

The native fixture uses an in-memory database and controlled provider responses. It establishes execution and context delivery through the actual harness; it does not demonstrate live-model understanding, actual Broker dispatch or PostgreSQL integration. The draft runner's generic receipt labels supplied renderer resources as packaged; this run explicitly supplied the source renderer. The combined qualification records that limitation.

Private evidence on F: (ignored by Git):

- Combined: `.supabase/desktop-instruction-apps72/qualified-1792757237556/evidence.json`; current pointer: `qualified-current.json` in that family.
- Compiled source: `.supabase/desktop-instruction-apps72/1792756951177/evidence.json`.
- Picker: `.supabase/desktop-instruction-apps72/ui-1792756963445/evidence.json`; wide light and narrow dark screenshots were visually inspected.
- Rich regressions: `.supabase/desktop-instruction-editor67/tests-1792756968388/evidence.json`.
- Full renderer: `.supabase/desktop-instruction-apps72/app-1792756973124/evidence.json`.
- Native fixture: `.supabase/desktop-instruction-apps72/native-1792756993774/evidence.json`.
- Drafts: `F:/Agentopia-Acceptance/chat-acceptance-drafts/1792757178197/evidence.json`.

Run the new controllers in source, UI, existing rich-editor, full-app and native order, then run the existing draft controller with AGENTOPIA_DRAFT_UI_RESOURCES set to the full-app receipt's rendererResources. The qualifier accepts the UI, rich, full-app, native and draft receipt paths in that order. Each operation uses the desktop operation lock. Full goal completion remains false.

Next freeze72 from the accepted71 resources, add the compiled instruction-app-references module and changed broker/UI, verify the archived output, and exercise owned PostgreSQL/Broker catalog, policy and save/reload behavior. Exact-version whole-profile recovery, installer verification and fresh ordinary update acceptance follow. The unchanged schema72 uses the strict equal-schema maintenance auditor over all128 tables. Native ordinary-window visual acceptance remains pending at the Windows lock; the previous unlock request remains pending. Physical reboot, different-user recovery and the remaining parity requirements remain open.
