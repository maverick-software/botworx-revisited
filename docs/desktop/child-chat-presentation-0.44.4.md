# Child chats and plugin lifecycle — private 0.44.4 installer

Later goal audit: **do not promote this frozen installer**. Its goal loop can outlive the owned chat request. A separate source correction and migration 0056 are qualified in [Native Codex goals](native-goals.md); packaging and live/installed acceptance remain open. The artifact and its original evidence are unchanged.

October 17, 2026. The first 0.44.4 Windows installer is built and its payload is verified. It remains uninstalled. The running app stays on 0.43.7 with production schema 45. This image includes the cleanup correction and the quieter child-chat presentation. Earlier frozen images remain unchanged.

## User-visible behavior

Plugin revocation now leaves one neutral notice explaining the stop and how to continue. It no longer labels that event as an application shutdown. Older saved shutdown wording uses a neutral session-closed fallback. Failed child work and failed follow-up actions retain their error display.

Child and parent identifiers are available under collapsed Assigned work or Details. The assigned prompt, saved transcript, completed tool receipt and follow-up draft remain accessible. A completed private host transport entry is omitted from the child transcript only when its exact native call identifier matches a completed saved receipt. Historical entries without that link, unmatched calls, failures and calls still running remain visible. The original native events stay in saved state.

The call identifier is carried in native activity events and their saved JSON. It does not add a database column, change provider payloads or alter tool permissions. The [concurrent plugin cleanup correction](plugin-child-lifecycle.md) is retained. The slim caption, headers, sidebar and dividers are preserved; the style change only wraps the collapsed metadata when expanded.

## Exact artifact

- Installer: `.supabase/desktop-child-presentation/candidate-0444-r2/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe`
- Installer bytes: 1502577152
- Installer SHA-256: `12ddbf994d0fc36acceb6f291736f96fea12d294bcb5ddde0b36ae998cdd9f80`
- Application archive SHA-256: `e4a8a6acc24d7c04b6284de790afc023b5fd07a288cf550673a998753a764561`
- Application/schema metadata: 0.44.4 / 55.

The cache-only 0.44.4 portable checkpoint is retained separately. This child-presentation revision supplies the first installer for that version. Of 1,014 backend modules, only codex-harness.js and tool-service.js change from the cache-only checkpoint. All 2,232 dependencies and 6,133 resources outside the interface match it, including all 55 migrations. The interface is rebuilt from the recorded source.

## Verification and its scope

The native tests use the actual bundled Codex runtime and controlled provider responses. They prove the exercised execution, transport and persistence paths. Real models have not performed this new acceptance workflow, so their task quality and current authorization remain separate gates. Paid inference usage is zero.

| Check | Result and meaning |
| --- | --- |
| Backend and renderer compilation | The exact source snapshot compiles, including the optional call link and renderer helper. |
| Archived modules and native lifecycle | 84 checks pass. A real native child reads its reviewed reference after its parent finishes; revocation cancels its stream, saves its activity, blocks stale restore and removes its derived cache. The saved notice identifies the plugin change, and its receipt links to the actual native call. Provider/default/policy/session checks also pass. |
| Presentation helper | 3 checks verify exact successful-call matching, preservation of failed/running/historical/unmatched entries and neutral interruption notices. The helper leaves saved data unchanged. |
| Delivered skill interface | 5 workflows pass for package review, explicit installation/assignment, chat selection, provider switching and revocation recovery. The bridge and installation store are controlled. |
| Delivered child interface | 5 workflows pass using the actual native child record: compact parent display, exact saved activity, failed-follow-up draft retention, separate parent/child drafts and reload recovery. Additional assertions cover the single notice, collapsed identifiers and one tool receipt. The saved draft bridge is controlled. |
| Layout inspection | Captured dark and light layouts, including a 404-pixel child column, preserve readable wrapping and bounded tool labels without horizontal overflow. |
| Installer payload | Six checks verify the setup hash, every delivered resource path/size, full archive integrity, exact application archive, schema metadata and complete embedded package/RELEASES record. Build helpers are restored to their original bytes. |

The final read-only database observation reports 2 accounts, 101 conversations, 338 messages and 45 applied migrations. No production migration, service start, OAuth renewal or installation was performed. The retained original WSL distribution remains stopped.

Evidence under `.supabase/desktop-child-presentation/candidate-0444-r2/`: preparation.json, package-proof.json, units/evidence.json, units/child-evidence.json, built-ui/evidence.json, child-ui/evidence.json, qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.

## Remaining acceptance gates

The read-only authorization inspection `.supabase/desktop-workspace-agents/authorization/1792293478893/evidence.json` still finds expired saved ChatGPT authorization. It made no renewal attempt, inference request or canonical credential write. Fresh human authorization is required for actual model-driven skill and browser acceptance.

The next upgrade needs a fresh verified backup, coordinated installation, ordinary installed workflow and restart checks. Clean-machine and Windows reboot qualification also remain open. This installer checkpoint leaves the [full desktop goal](capability-acceptance-snapshot.md) active.
