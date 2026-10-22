# Private 0.44.6 installer — independent native child inference

The corrected Windows installer is packaged and verified with controlled responses. It remains uninstalled. Agentopia 0.43.7 and the production database at migration 45 remain in place. The earlier 0.44.5 installer stays held.

## Resulting behavior

A child chat can resume after its parent response is stopped, then be stopped through its own control. Credential authorization follows the actual native thread and turn and checks current ownership and permissions. An active child cannot authorize a request from the stopped parent. The correction and its original reproduction are explained in [Independent child inference](independent-child-inference.md).

This candidate also contains the previous native goal work: automatic turns retain their chat activity, steering, Stop control and saved usage; composer turn allowances remain enforced; restored active goals are paused before thread loading. Dedicated child chats retain saved activity, separate drafts and follow-up controls. The compact interface is unchanged from the preceding candidate.

## What was verified

- 116 checks execute modules extracted from this exact application archive with its delivered dependencies and real Codex executable. Controlled upstream responses exercise native goals, child lifecycle, routing, permissions, skills, provider adapters and connection defaults.
- The real native child case stops the parent, resumes its child, starts another child turn, refuses a stopped-parent request while that child is working, and stops the resumed child. This establishes independent controls within the tested lifecycle.
- Six delivered goal-interface workflows, five skill workflows, five dedicated child-chat workflows and three child presentation helper cases pass. The skill workflows passed on their first run. Dark and narrow goal and child captures were visually inspected; controls and text remain within the chat column.
- Six installer checks verify the complete embedded application package, all 6,147 delivered resource paths, archive integrity, the exact tested application archive, migration 0056 and schema 56 metadata.

These checks use controlled identities and provider responses. They establish the execution, permissions and interface behavior covered by those cases. Live model choices, ordinary installed operation, restart and Windows reboot acceptance still require verification. No live model requests or paid inference were used. The unexplained first skill discovery timeout in the older 0.44.5 test remains recorded; the current first-run pass does not establish its cause.

## Database upgrade rehearsal

A subsequent [current-data upgrade rehearsal](upgrade-rehearsal-0.44.6.md) passes six checks using the delivered maintenance script and all migrations through 56. It restores and preserves 20,134 existing rows across 141 tables, validates repeat provisioning and failed-migration rollback, then removes its separate database. This supplements the immutable release proof; installed and live acceptance remain open.

## Fresh native runtime recovery

Eight subsequent [fresh-runtime recovery checks](fresh-runtime-recovery-0.44.6.md) also pass: the bundled Linux runtime imports, restores the current snapshot, preserves all compared rows and 190 readable vault records, and retains them through full runtime termination and restart. The owned test distribution is removed and production remains healthy. The ordinary installer, full-profile and live workflows remain open.

## Exact artifact

- Version: 0.44.6, Windows x64.
- Installer: .supabase/desktop-native-goals/candidate-0446/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe
- Installer size: 1502583808 bytes.
- Installer SHA-256: 009cd8ba3e87f7e1169751bb266e4601e5256c78d02d9a5a3b6c8c60a66b85df
- Application archive SHA-256: cb63e47cbc1eabbbf90cbd8b8a022d4575f555623175def530bcd68d7ac473a7
- Full package SHA-256: 0af99870e08509868270fc246826a5074c855ee68f88ebc2b6f6d3534cbb20e5
- Delivered schema: 56 migrations.

Only codex-gateway.js and codex-harness.js differ among 1,014 compiled modules relative to 0.44.5. All 2,232 dependency files and all 6,145 external resources other than version metadata are byte-identical, including the interface, migrations and runtime binaries. The temporary installer-helper adjustments were restored and their original hashes verified.

Evidence is retained under .supabase/desktop-native-goals/candidate-0446: preparation.json, package-proof.json, units/evidence.json, units/parent-stop-child-resume.json, goal-ui/evidence.json, built-ui/evidence.json, child-ui/evidence.json, qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.

## Remaining acceptance

The saved ChatGPT connection needs fresh authorization before exact-image live goal, skill and browser acceptance. The current installed system was observed read-only: 2 accounts, 101 conversations and 338 messages, with 45 applied desktop migrations. The retained original WSL distribution remains stopped.

Next release steps are fresh ChatGPT live acceptance, a verified backup, coordinated installation and migration, ordinary installed workflows and restart recovery. Clean-machine installation and Windows reboot checks remain release requirements. The composer retains its existing one-to-ten-turn goal allowance; an unbounded composer option and token-budget editing remain future work. Broader desktop parity is ongoing.
