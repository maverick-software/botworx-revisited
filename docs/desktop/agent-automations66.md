# Agent automation interface — October 22, 2026

Installed as a renderer update to ordinary Agentopia 0.44.66. The backend archive and database schema remain the verified 0.44.66 versions. This update builds from the frozen readable-plugin-label release, with only four UI files replaced or added; it does not include the unfinished scheduled-workspace recovery implementation.

## Reference and behavior

The user supplied the ChatGPT agent directory, agent home, Apps, Memory, editor, and automation screenshots. A read-only inspection of the existing Chrome agent editor confirmed the Daily/Interval radio controls, weekday checkboxes, time, named time zone, Channel, optional additional instructions, and Save and run/Add automation actions. Interval choices are 15/30 minutes and one through eight hours. The reference also offers its connected Slack channel. No reference schedule was saved or run.

Agentopia's Edit agent → Automations now opens a working scheduler interface. Schedule also exposes it for existing navigation. The compact 482-pixel dialog follows the reference structure and adapts to narrow windows. Its Channel currently offers Agentopia, the supported local chat destination. External messaging delivery is still required before offering other channels.

Saving captures the selected agent and its existing AI connection through the established scheduler API. Empty additional instructions use a brief request to follow the saved agent instructions and report the result. Daily selections become calendar schedules with an explicit time zone. Interval selections retain the scheduler's anchored interval behavior. Editing preserves paused status. Existing schedules with project, file, conversation or advanced calendar context open the established advanced task interface so the compact form cannot silently remove their context. Run saves and requests one immediate run; stable identifiers and a submission guard prevent double-click submissions. An uncertain save or run response requires inspecting the list/history before another attempt.

Runs require Agentopia to remain open, the account to remain signed in, and Windows to remain awake. These controls use the existing scheduler; the UI update does not add a cloud execution service. Agent revisions, ownership checks, retained scopes, and held-run handling stay enforced by that scheduler.

## Verification and installation

- Nine focused checks passed against the rendered interface with a controlled bridge and the actual calendar engine. They cover weekday translation, unsupported calendar preservation, daylight-saving behavior, save/reopen, paused status, immediate-run IDs, empty weekdays, narrow layout, and lost run acknowledgement. No production account or model request was used.
- Nine full-app checks passed against the frozen release UI. They cover both navigation entries, nested dialogs, actual form dimensions, save/run payloads, focus restoration, access to advanced run history, readable plugin labels, and preservation of an unsent chat draft. Renderer errors: zero.
- Full-app testing found and fixed changes in a portaled automation dialog incorrectly marking the surrounding agent editor dirty.
- A fresh logical database recovery and matching encrypted Windows profile files were captured before the update. Agentopia closed normally, the old UI was retained on F: for rollback, the new UI was verified by file hashes, and Agentopia reopened normally. All six core services became healthy.
- The post-install read-only audit preserved 119 chats, 408 messages, four agent records, their profiles, and the recorded request/instance status counts. Credentials, Windows encryption state, runtime binding, schema release, and the application backend archive passed unchanged checks.
- Native Windows inspection verified the installed form under the saved Native Codex Assistant, its actual selected ChatGPT model, weekday controls, Pacific time zone, and Agentopia channel. The preview was closed without saving or running a production automation. Readable plugin labels remained visible.

Build proof: `.supabase/desktop-agent-automations66/1792693657917/proof.json`.
Full-app evidence: `rendered-1792693683392/evidence.json` under that build.
Installation: `installation-1792693692402/evidence.json` under that build.
Focused evidence: `F:/Agentopia-Acceptance/agent-automations-1792693518798/evidence.json`.

Remaining agent UI parity includes the directory row layout/template presentation, agent home with prompt starters and Activity/Apps/Memory tabs, full-page editor layout, and supported external channels. The broader recovery and installed-workspace acceptance gates remain open.

The subsequent agent directory/home renderer retains this automation interface and supersedes its installed UI inventory. Use `.supabase/desktop-agent-directory66/current.json` and `installed.json` for current UI hashes.
