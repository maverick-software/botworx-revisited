# Verified desktop recovery preparation

October 19, 2026: **included in installed 0.44.47 recovery-bootstrap-15**, whose ordinary reopening and saved-data preservation are accepted. The original preparation qualification and isolated rehearsal are recorded below. This preparation path combines the database archives, selected private/native files, public exports and portable attachment record. It does not start a database or submit an AI request. [Current installed evidence and remaining requirements](recovery-bootstrap.md).

## Preparation and startup behavior

A sealed descriptor binds six resources: the database manifest, private-profile archive/manifest, public archive/manifest and portable-reference record. Every database file and archive member is checked before a destination is claimed. Ownership, paths, duplicate names, archive entry types and checkpoint bindings are validated. Existing Agentopia runtimes, applications, profiles, public collections and redirected paths are refused.

Preparation stages database migration input, managed workspaces, attachment images, native Codex state and saved Chrome artifacts. Windows-encrypted credentials, website cookies, native provider authentication, machine-specific Codex configuration and Windows sandbox state are excluded so the destination can establish its own credentials. Provider reauthorization remains required.

The operation has a durable journal and an exclusive filesystem lock. Interrupted copies retain their partial files and resume only after verifying the existing bytes against the source prefix. A changed stage is preserved and reported. After files are published, the existing pinned-native relocation helper rewrites the native path indexes. Logical fingerprints verify that native records differ only by the permitted path translation, and the source rollouts and workspace files retain their original bytes.

A new runtime startup check refuses to select or start a database while preparation is incomplete. A restored profile without its journal is also refused. A prepared profile must match the journal's operation markers. Successful database startup marks that same operation complete; a stale or changed operation cannot be completed by an earlier startup attempt. Installations without a recovery record retain their existing behavior.

## Tests and frozen source

The frozen backend passes full TypeScript diagnostics, **60 JavaScript checks** and **11 Python preparation cases**. The JavaScript total includes the earlier public-reference/agent-control checks, five startup cases and two native-relocation wrapper cases. Preparation cases cover completed staging, credential exclusion, corruption, foreign references, mixed checkpoints, linked archive members/destinations, existing installations, concurrent preparers, partial-file resume, changed-stage refusal and resume after publication.

Source and logs: `.supabase/desktop-recovery-preparation/1792476499455/`. Its `source-qualified.json` pins eight compiled modules, the new preparation resource and the build-script change that includes it. The build helper now copies `prepare-desktop-recovery.py` into runtime resources. All UI source remains equal to accepted revision 14. No application archive or installer was produced during this turn.

## Rehearsal with the actual protected checkpoint

Sealed source: `D:/Users/charl/AgentopiaRecovery/export-relocation-14/1792474234936/desktop-recovery.json`, SHA-256 `9c0bb2695f74ef61214f206ca9b7bd68aa841c32cd986dd1c4b28a4c78bfe76f`.

Isolated protected destination: `D:/Users/charl/AgentopiaQA/full-recovery/1792475995885/`. The rehearsal supplies an empty runtime-registration observation for its generated home; it does not alter the real Windows user's registrations or start WSL. The public command checks the real current user's environment and requires a fresh installation.

The real operation stopped twice at its reserved disk-space limit. Both failures retained the same operation and incomplete stage. Completed fake-renderer caches were losslessly archived and independently verified before removing only their exact cache directories. Across three archives, 106 cache profiles totaling 1,080,689,131 source bytes are retained in 44,913,160 compressed bytes. Their screenshots, source fixtures and reports remain. Production profiles, runtime disks and recovery sources were not deleted or moved.

Resuming that same preparation succeeded. It published five database recovery files, 2,627 private/native files and all 17 public files. The native relocation result covers **154 conversations across 122 native homes**. Evidence is the destination's `evidence.json`, including retained pre-resume observations.

The actual pinned Codex **0.163.0** app-server then read all 154 restored conversations with turns included. Every returned path stayed inside its copied home. No turn started and the disabled local inference endpoint received no request. All saved rollout files remained byte-identical. Evidence: `native-read-qualification.json`, `native-read-index.json` and the executable hash in the qualification receipt. The client may initialize its bundled skills and local caches in the isolated copy; the 2,627 count describes the prepared files before those normal client writes.

A separate verifier compares all five staged database resources, all 17 public files/54 directories, managed workspace/image bytes, native thread IDs and all saved rollout hashes against the original archive. It also confirms that the original Windows credential file and provider auth/configuration were not imported. The new startup check accepts the matching prepared profile without starting a database. Evidence: `independent-verification.json` and `startup-guard.json`.

## Remaining release and application recovery work

The database files are staged and verified, **not imported into a new backend**. No ordinary installed application, different Windows account, complete installer or Windows reboot has been tested with this preparation path. It remains source-only until exact packaging, fresh recovery, installation and ordinary acceptance are complete.

The Windows recovery launcher/first-start workflow is now [packaged and qualified in a separate candidate](recovery-bootstrap.md), and awaits installation and ordinary acceptance. Automatic portable-index capture must still be integrated so recovery can be created without developer scripts. External generated files, selected workspaces, clipboard attachment identities and safe portable preferences also need explicit coverage; the public-reference index currently covers public files only. Full installer/clean-machine recovery and broader live workspace-agent acceptance remain open. No completed or uncertain paid request was replayed.
