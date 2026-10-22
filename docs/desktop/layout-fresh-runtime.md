# Fresh backend import and cold restart

October 20, 2026: the corrected source passes a real empty-backend import, cold restart and password sign-in test. These changes are not installed. The normal Settings producer and complete restored application still need acceptance.

The test imported the same checked Linux archive used by the installed app into a new WSL2 runtime stored on F:. It verified that the runtime had no existing database or accounts, assigned a unique installation identity and separate ports, and copied the retained recovery's database archives only after verifying every file hash. A fresh private test profile ran the qualified Runtime startup code. The command executor recorded private output on error; it executed the normal WSL commands without model adapters or simulated database services.

Six workflow groups passed:

1. Register a new empty runtime only in its owned F-drive test directory.
2. Import the real saved database and encryption root through the qualified startup code.
3. Match all 126 saved tables and 1,743 rows, all 69 migration checksums, 191 readable vault records and four encryption-root bindings, with healthy core services.
4. Stop and terminate the test runtime normally, restart it with the same private profile, and repeat the full audit successfully.
5. Create a temporary account, sign in with its generated password, sign out, remove the account and verify that all original table fingerprints still match.
6. Remove only the successful disposable runtime after checking its registered storage path. All other registrations and running states match their earlier state.

Evidence: `.supabase/desktop-layout-fresh-runtime/1792525697712/evidence.json`, with the frozen test/audit/authentication scripts, source qualification, input hashes and both database audits. Combined source qualification is `.supabase/desktop-layout-recovery/1792525557828-source/qualification.json`: 177 JavaScript cases, 61 direct Python cases, 48 PowerShell groups, five Windows PowerShell 5 groups, four Settings workflows, four layout workflows and 13 chat-details workflows pass.

The earlier failures exposed missing planner-statistics refresh, stale process records and database workers that outlived the main process. [Diagnosis, corrections and regression cases](database-import-statistics.md). The final run needed no manual statistics or process-record repair.

After the successful test, the three failed disposable runtime disks were removed after verifying each UUID, stopped state and exact registered F-drive directory. Their diagnostic files remain. The cleanup removed 8,157,921,280 logical disk bytes and preserved every unrelated runtime state. Original and retained recovery disks were preserved. The cleanup receipt is `.supabase/desktop-layout-fresh-runtime/failed-runtime-cleanup.json`.

A final independent read-only query of the original production runtime matches all 126 tables and 1,743 saved rows, including both accounts, 116 chats, 400 messages and 191 vault records. Its receipt is `1792525697712/production-after.json`. No model request was submitted or replayed.

This test used the retained verified database archives, rather than a new bundle from the normal Settings producer. It did not restore all native agent histories, external files, images and display state together into the complete app. The separate Windows tests cover generated file/settings/layout recovery; the combined real-data application flow, different Windows user, full installer, reboot and restored agent execution remain open. The responsive UI update is separately prepared and still awaits normal closure of the open Agentopia application while the Windows control helper is unavailable.
