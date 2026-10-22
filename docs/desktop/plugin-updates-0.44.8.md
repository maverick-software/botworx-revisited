# Private 0.44.8 installer — reviewed plugin updates

The separate Windows installer now packages [reviewed imported-plugin updates](plugin-updates.md) and additive migration 0058. The delivered archive and complete installer payload pass controlled checks. It is uninstalled; production remains on Agentopia 0.43.7/schema45.

October 18 continuation: ordinary-profile ChatGPT inference and credential renewal have now passed. The exact packaged live check then exposed a long native-state path failure before inference. The 0.44.8 artifact is retained unchanged while [the separate 0.44.9 correction](native-state-paths-0.44.9.md) is qualified. Historical authorization and count observations below retain their original scope.

## Delivered behavior

Plugins → Manage plugin → Update plugin accepts a reviewed folder, ZIP or JSON package with the same identity and a different version. Review identifies retained, changed, added and removed connections and skill resources. Editing the package clears the prior review. Applying it preserves account settings and agent assignments.

Exact server-name, URL and transport matches retain their connection identifiers and protected credentials. Changed or new servers begin without the earlier credential; removed connections have their owned secrets removed. Disabled assignments and retired agents receive no new connections. PostgreSQL applies replacement and credential reconciliation together and refuses stale revisions. The source database qualification also demonstrates rollback after an induced insertion failure and two overlapping updater sessions.

Actual native skill sessions using the earlier package close, including independent children whose parent has finished. Completed activity stays saved, and an old-configuration resume is refused before inference. New native turns receive the replacement instructions through either existing provider adapter. Derived cache cleanup retains the new digest and other accounts’ files. The update does not execute helpers.

The installer also retains explicit unlimited goals, editable native token budgets, independent child routing, persistent named agents, reviewed plugin skills, OAuth recovery and the earlier browser/composer controls.

## Checks against the exact delivered archive

- 131 checks use modules extracted from this application archive, its dependencies and the actual bundled Codex executable. Controlled model responses demonstrate replacement skill instructions under both adapters, interruption and saved activity for the background child, twelve native goal turns, token-budget changes, independent child routing, ownership, plugin schemas, references, permissions and connection defaults.
- Six complete delivered-interface workflows cover plugin update review, edits and identity errors, dark/light/narrow layout, failure inspection and explicit retry with duplicate controls disabled. The bridge, picker and registry are controlled.
- Eleven delivered goal workflows, five skill workflows and five child-chat workflows pass. The child chat reopens the actual saved package-update interruption, reference activity and separate draft. Skill discovery uses packaged native metadata without requesting models or credentials. Three child presentation helper cases also pass.
- Six installer checks verify the setup hash, all 6,149 delivered resource paths and lengths, full archive integrity, the exact tested application archive, migration 0058/schema58 metadata and the complete embedded application package with its RELEASES record.

No live provider inference or paid request was used. These tests establish packaging, transport, lifecycle and interface behavior with controlled inputs. Actual model decisions and ordinary installed workflows retain their own release gates. The new database function separately passes eight [snapshot-based PostgreSQL checks](plugin-updates.md), preserving all 20,134 original rows across 141 tables before and after generated fixture cleanup.

## Artifact and preservation

- Version: 0.44.8, Windows x64.
- Installer: .supabase/desktop-plugin-updates/candidate-0448/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe.
- Installer size: 1502589440 bytes.
- Installer SHA-256: 88aca63b3527f4556312645998e202bc1abe0032c5f404e6d9d51c1afc7cee7c.
- Application archive SHA-256: 8deeff23a954ee00353ef3842f211432835103ae509554484c8cffb891d925f4.
- Full application package SHA-256: 56ccaa5e1e0934a8f564486881f9515b03d1dd9dbabd8cd51e92fff23aeaf084.
- Database metadata: 58 migrations.

Compared with 0.44.7, broker.js, native-plugin-skills.js and plugins.js change, and plugin-update.js is added. The remaining 1,012 compiled modules and all 2,232 dependency files are byte-identical. All styles, earlier migrations and native runtime resources remain unchanged; 6,134 resources outside the interface, new migration and version metadata match. The installer helpers’ original bytes are restored and independently checked.

Evidence is retained under .supabase/desktop-plugin-updates/candidate-0448: preparation.json, package-proof.json, units/evidence.json, units/update-child-evidence.json, update-ui/evidence.json, goal-ui-settled/evidence.json, built-ui/evidence.json, child-ui/evidence.json, qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.

## Live and installed acceptance remain open

Physical-file inspection found a newer ChatGPT connection in the ordinary Windows profile than the previously rejected package-cache connection. Its access token is expired and its renewal remains untested; fresh human authorization is conditional on that result. Read-only inspection sends no inference. OpenRouter has not been used as a paid substitute. See [credential provenance and recovery](oauth-connection-recovery.md).

The final read-only production observation records 2 accounts, 101 conversations, 338 messages and 45 migrations, with the six required backend services healthy. Installed 0.43.7 remains unchanged and the retained original WSL distribution stays stopped.

The exact [0.44.8 packaged startup check](packaged-startup-0.44.8.md) now passes seven real-executable checks and independent comparison of all 6,221 packaged files. Both physical [recoverable profile snapshots and the cold disk import check](physical-profile-backup-0.44.8.md) also passed. The earlier 0.44.7 evidence retains its own version and schema57 scope. Current-image live behavior, ordinary installer upgrade and schema58 production migration, signed-in chat/browser/tool workflows, native-session restart recovery, Windows reboot and clean-machine acceptance remain open. Broader desktop parity is unfinished.
