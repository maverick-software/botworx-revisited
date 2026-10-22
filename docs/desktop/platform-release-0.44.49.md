# Agentopia 0.44.49 — Storage and Notifications

Status: installed and accepted through the ordinary Windows profile. The full desktop-parity goal remains active.

The ordinary installed application is 0.44.49. Its responsive chat-details card collapses at narrow widths and opens as an overlay without taking width from the conversation. The saved account, ChatGPT/OpenRouter connections, conversation, draft, model choice and document tabs passed ordinary reopening checks. The installed Storage and Notifications pages read the original account; their acceptance deleted no user items and changed no notification preferences.

The 0.44.49 candidate adds account-scoped Storage and Notifications settings. Storage lists chats, archived chats, saved subagent records and Agentopia-managed working copies. It supports archive/restore and a review before cleanup. Cleanup checks ownership, active work, saved file references and changes since review. Chat deletion preserves generated files, external projects and native Codex session files. Individual subagent/native-profile deletion is not implemented. Content-size estimates do not claim exact reclaimed Windows disk space.

Notifications provides independently saved response and task switches. Replies notify while the app is in the background, completed goals notify once, and scheduled tasks retain their individual policies. Notification navigation rechecks the signed-in owner and preserves drafts. Actual Windows toast display remains unobserved.

Recovery capability 7 carries the notification choices. Earlier backups remain readable. The new producer and preparer reject incompatible or malformed notification metadata rather than silently losing it.

## Qualification

- Frozen candidate: `.supabase/desktop-release-04449/1792536883499/package-proof.json`.
- Packaged startup and all 7,256 resource hashes: `qualification.json` in that directory. The actual packaged app reports 0.44.49 and safely refuses an intentionally missing private runtime.
- Exact packaged agent/control modules: 638 checks across 86 fixture files passed, with zero failures or skipped tests. Evidence: `.supabase/desktop-agent-controls49/1792537119089/evidence.json`. These use controlled responses and generated data; there were no live provider requests.
- Combined source qualification: `.supabase/desktop-storage/1792536586165-source/qualification.json`: 123 backend checks and 20 renderer workflows, with retained Python/PowerShell recovery checks.
- The first archived test attempt passed 623 checks and failed 15 because the snapshot layout did not supply the paths expected by the fixture mocks and Python readers. Correcting the fixture layout produced the full 638-check passing run; the application package was unchanged.

Current package SHA-256: `f3a19ed27797ba86ce052bef8955226fbd5ecb8b9c38ce5d5d7d52baebc42f14`.

## Delivery work

The installer was constructed entirely on F:. Every one of its 7,329 embedded application files passed verification. The actual 0.44.49 upgrade created its recovery copy and retained password sign-in, history, the unsent draft and the document tab in a separate restored database. Its Storage page archived, restored and deleted only a generated chat, and deleted one generated F-drive working copy after displaying its file in the review. The Notifications switches retained their choices after interface reopening, and the real Settings backup included both choices in its capability-7 bundle.

The application-update recovery rehearsal independently verified all 109 generated private-profile files and the bundle resources, retained its two external attachment locations in place, and preserved notification choices. A separate read-only check verified all 7,531 active 0.44.48 program files and their rollback copy; the production profile and database were not modified. The version-pinned launcher passed 16 phase/failure cases, 13 update-command cases and 7 existing-runtime guard cases. Fresh production recovery still must be captured after normal app closure. Existing update authorization covers installation; no new version approval is required.

The supported native Windows control connection still fails before initialization with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. A fresh reference-app comparison and native toast observation therefore remain pending. This does not establish complete platform parity, different-Windows-user recovery, a reboot test, or a full current external-workspace portable export.

The first installer construction stopped during Squirrel extraction because a temporary path exceeded the legacy Windows path-length limit. The package was unchanged. The retry uses short F-drive temporary directories and retains the failed maker log under `installer-build/maker.log`.

The shortened-path installer construction and complete embedded payload verification passed. `installer-verified.json` records 7329 verified files. The exact-version isolated upgrade and real settings/recovery workflow are now being prepared. Production installation is still pending.

## Final acceptance records

- Exact upgrade and packaged Settings: `.supabase/desktop-release-04449/1792536883499/database-upgrade-accepted.json`. It retains five passed checks from the first attempt and two completed checks after a selector was scoped to the Settings navigation. The first test stopped because the header and the Settings section both have a Notifications button; the application package was unchanged.
- Capability-7 update recovery: `.supabase/desktop-maintenance-backup/1792538311037/evidence-resumed.json`. The legacy independent verifier expected format 6. The version-49 verifier requires format 7 and passed against the same capture.
- Actual installed-program rollback qualification: `.supabase/desktop-normal-maintenance/1792538376164/qualification.json`.
- Normal update launcher: `.supabase/desktop-normal-maintenance/launcher-qualified49.json` and `Run-Agentopia-Settings-Update.cmd`.

Agentopia 0.44.48 completed normal closure through the verified local cooperative process command. The already-authorized update then ran through the installed Update.exe from normal Windows Explorer. Fresh recovery and rollback were verified before installation. Ordinary-49 acceptance read Storage and Notifications without deleting user items or changing notification choices, verified saved data and connections, restored the original draft/panes/window, and reopened the app without debugger flags.

A fresh full application restore of the actual capability-7 Settings bundle also passed under the same Windows user. It retained password sign-in, both disabled notification choices, file/folder/image identities and contents, the unsent draft and document tab. The bundled Codex harness continued the same saved native thread with one new controlled response; a cold reopen retained the reply and later draft without replay. Both app processes exited normally. Only the identified F-drive test runtime was unregistered, removing its disposable disk; the original runtime and ordinary app were retained. Evidence: `capability7-restore-accepted.json` and the referenced five-check application report. This does not establish a different-Windows-user restore.

Cleanup of the inactive first failed installer’s input/temp/vendor/output folders passed canonical-path, inactive-process and linked-path preflight. Automatic approval review rejected the deletion with “blocked by policy” before execution. Those intermediates remain; no alternate deletion was attempted. The completed isolated restore runtime was separately and successfully unregistered through its verified identity before that rejection.

## Ordinary installation accepted

Maintenance job: `F:/Agentopia/.supabase/desktop-normal-maintenance/1792539864117/evidence.json`. Every one of the 7,330 expected physical installed files matches the verified release. Fresh capability-7 application-update recovery independently verifies 4,094 raw-profile files. The 45 external attachment locations are preserved in place; their folder contents are outside this capture.

Acceptance: `F:/Agentopia/.supabase/desktop-ordinary-settings49/1792540058383/acceptance.json`. After ordinary reopening, all 126 compared tables and 1,749 saved rows match the fresh pre-installation snapshot, including both accounts/passwords and roles, 116 chats, 402 messages, 191 readable encrypted vault records and four encryption-root bindings. The ordinary parent is PID 45016 at this checkpoint, without debugger flags. No model prompt was sent for ordinary installation acceptance.

Full settings parity is not claimed. Read-only inspection of the currently installed reference bundle identifies three completion-notification modes, separate permission/question alerts and dated bulk chat/subagent cleanup that exceed the current subset. See `reference-bundle-inspection-2026-10-20.md`. Fresh reference UI interactions and Windows toast observation remain unverified.
