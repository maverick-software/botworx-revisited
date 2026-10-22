# Private 0.44.5 installer — native Codex goals

Later boundary audit: **do not promote this frozen installer**. A native child cannot resume inference after its parent response is interrupted because authorization still checks the parent’s cancelled controller. The archived-code failure is retained under `.supabase/desktop-native-goals/child-resume-audit-1792296814180`. The earlier payload and workflow results remain valid for their original scope.

The private Windows installer includes the [native goal correction](native-goals.md) and migration 0056. It remains uninstalled. The current application is 0.43.7 with database migration 45.

## What this delivers

Automatic Codex goal turns stay attached to the chat’s owned execution, streaming activity, steering and Stop control. Composer goals use the actual Codex lifecycle, preserve their existing turn allowance and record usage before inference. Native child goals keep their chat activity after parent completion and can be stopped from their own chat. A restored active goal is paused before its thread is loaded.

The goal display is a compact, collapsible row. Pause lets an in-flight response finish; Stop interrupts it. Completion and saved partial work remain visible after reopening the chat. The earlier slim navigation and child transcript presentation are preserved.

## Verification

- 108 checks run modules extracted from the exact application archive with its own dependencies and delivered Codex executable. They cover goal continuation, ownership, turn accounting, steering, pause/stop, native children, plugins, permissions, provider routes and connection defaults.
- Six delivered-interface goal workflows cover continued activity after the first response, exact-turn steering, pause versus Stop, completion, saved history, drafts and narrow layouts.
- Five delivered skill workflows and five child-chat workflows pass. Three child transcript helper cases also pass. Dark and narrow captures were visually inspected.
- Six installer checks establish that setup embeds the complete tested package, exact application archive, all 6,147 delivered resource paths, migration 0056 and schema 56 metadata.

The first skill interface run timed out at its 20-second discovery deadline after import and assignment had passed. Two fresh runs passed all five checks. The instrumented run recorded 723 ms for initial runtime verification, approximately 200 ms for native initialization and 14–15 ms for skill listing, with zero model or credential requests. The first timeout’s cause remains unproven and its failure evidence is retained.

These checks use controlled identities and model responses. They prove lifecycle and interface behavior within that scope; live model decisions, ordinary installed operation and reboot behavior remain open. No paid inference was used.

## Exact artifact

- Version: 0.44.5 (Windows x64).
- Installer: .supabase/desktop-native-goals/candidate-0445/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe
- Installer SHA-256: c4173363048dff7dd4902e58d7c08012ba72a11d98f7779a5f4337950fa1bccf
- Application archive SHA-256: 69e3c664181a0b90c5daeb6f95146ea2c90cd86c7f94538a2e0a7f60d724db20
- Full package SHA-256: d9605787c478fd2fa41206931aa66eba41635f4661c9de0139333acbfe92c634
- Delivered schema: 56 migrations.

Only broker.js and codex-harness.js differ among 1,014 compiled modules. All 2,232 dependency files are unchanged. Outside the rebuilt interface, only the added recovery migration and version metadata differ; 6,132 earlier resources remain identical. The installer helper binaries were restored and verified after packaging.

Evidence lives under .supabase/desktop-native-goals/candidate-0445: preparation.json, package-proof.json, units/evidence.json, goal-ui/evidence.json, child-ui/evidence.json, built-ui/evidence.json (initial failure), built-ui-r2/evidence.json, built-ui-r3/evidence.json (instrumented pass), qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.

## Remaining acceptance

The saved ChatGPT connection has plan scope but its inspected access token is expired. Fresh user authorization is needed for exact-image live goal, skill and browser tests. The separate current installation still contains 2 accounts, 101 conversations and 338 messages. Its database was observed read-only and remains at migration 45; the retained original WSL distribution stays stopped.

Promotion still requires live acceptance, a fresh verified backup, an ordinary installer upgrade with the additive migrations, installed workflows, restart recovery, and clean-machine/Windows reboot checks. The source goal controls still use their existing one-to-ten-turn composer allowance; unbounded composer configuration and token-budget editing remain future parity work. Broader desktop parity remains ongoing.
