# Release79 delivery tooling — October25,2026

These tools prepare the merged consolidation source and extend the existing recovery, installer and installed-updater controllers. No updater, production migration or application installation was run while implementing them.

After merging all product changes into F:/Agentopia and committing package version0.44.79, run in order:

1. `node scripts/desktop/prepare-release79.mjs`
2. `node scripts/desktop/qualify-release77.mjs --release79`
3. `node scripts/desktop/make-recovery-installer75.mjs --release79`
4. `node scripts/desktop/verify-recovery-installer75.mjs --release79`
5. `node scripts/desktop/install-release77.mjs --release79`

The preparation script requires the accepted installed78 image, verified78 program/resources and a stopped isolated QA runtime. It copies tracked merged desktop sources into a new F: snapshot, compiles the complete backend and renderer, preserves all historical SQL hashes, copies the new migrations, and writes a new release79 package proof and QA intent. It never modifies old release proof files or the ordinary profile.

Qualification opens the exact packaged candidate on the existing isolated schema84 profile. It verifies the automatic complete upgrade backup and its encrypted Windows files, compares original application/authentication/Vault rows, calls the three public catalogs without model requests, closes normally, and checks a cold reopening without another backup or replay. It produces qualification only after those checks pass. If a checked upgrade fails after applying migrations, inspect the recorded state before using its existing `--resume-upgraded` path; that path requires the original attempt, completed backend readiness, normal cleanup and exactly one automatic backup.

The migration comparator permits only the declared new skill/host/key-binding tables. It validates each new standalone skill against the exact original package resources and grants, validates the migration receipts/aliases/version envelopes, verifies pinned host plugin declarations, rejects unbound additional plugins/grants, and requires the new key-binding table to remain empty during no-write qualification. Every original row is still compared. The two permitted existing-row changes are verified restrictive search grants and the exact appending of missing host grants with the corresponding draft revision change; these are projected to original bytes only after checking preserved fields.

Installer construction, full embedded-file verification, version checks, installed-updater identity, F: scratch guards, fresh production recovery, normal closure, rollback copy, image hashes, automatic upgrade readiness and protected-store checks remain enforced by the existing controllers. The protected-store checker additionally accepts only exact saved Tools→Plugins location redirects for79; provider secret values and disabled image generation remain strict.

Local evidence: `F:\Agentopia-QA\release79-tools\1792977818652\evidence.json`. Checks covered accepted75-79 updater commands and environment cleanup, rejected unrelated disks/versions/scratch paths, parsing all changed JavaScript controllers without executing them, and nine comparator fixtures. The fixtures accepted the intended migration and rejected modified skill bytes, removed original rows, changed original Vault ciphertext, altered draft text, missing host grants, unknown plugin additions, changed skill grants and unexpected credential bindings. Actual candidate build, packaged PostgreSQL upgrade, cold reopening, installer creation and installed verification remain to be executed on the merged source.
