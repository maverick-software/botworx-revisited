# Agent builder release 0.44.85 delivery

This release uses the existing full application delivery path because the agent builder correction changes main-process TypeScript as well as its interface. It retains the installed chat progress and composer focus improvements. It adds no database migration. Schema 90, recovery capability 18, Supabase 2.121.0, native computer helper 1.0.4, production dependencies, and built-in host plugin descriptions remain pinned to the accepted 0.44.84 package.

The accepted installed package proof is `F:/Agentopia/.supabase/desktop-builder-focus86/1793032496061/package-proof.json`. Its completed native inspection is bound through `F:/Agentopia/.supabase/desktop-release84/1793027490229/installation-1793032555913/completion.json`. The full application provenance and test environment come from `F:/Agentopia/.supabase/desktop-release84/1793027490229/package-proof.json`. The installed archive SHA-256 is `a6d739387e5c434a724f274648eddfde97d3dce32f70dd8b8821847e2887f48c`.

`newMigration` in the new proof retains the existing migration 0090 name and checksum so the existing read-only audit can verify it. `noNewMigrations` and `migrationProvenanceProof` record that 0.44.85 introduces no SQL. Preparation compares every existing migration and runtime resource, and binds the strict row and credential policies to the frozen full84 qualification hashes. Credential comparison still accepts only a verified local session renewal and valid Composio token renewal; provider values and other settings must remain identical. Image generation remains disabled.

The isolated implementation worktree prepares tooling only. Merge and review the builder fixes and these delivery changes in `F:/Agentopia`, then run these commands there. Each command must succeed before the next delivery stage. `--accepted-source` must identify the final reviewed commit, including all builder and delivery changes.

```powershell
Set-Location F:/Agentopia
node scripts/desktop/test-release85-tooling.mjs
python -B scripts/desktop/test_release85_preservation.py
node scripts/desktop/test-protected-composio-rotation81.mjs
node scripts/desktop/test-protected-oidc-renewal81.mjs
npm run desktop:typecheck
$reviewedSource = git rev-parse HEAD
node scripts/desktop/prepare-release85.mjs --preflight
node scripts/desktop/prepare-release85.mjs --accepted-source $reviewedSource
node scripts/desktop/qualify-release77.mjs --release85
node scripts/desktop/make-recovery-installer75.mjs --release85
node scripts/desktop/verify-recovery-installer75.mjs --release85
node scripts/desktop/install-release77.mjs --release85
```

Preparation snapshots reviewed sources and recompiles the main process and interface over the current84 program. Qualification uses the existing isolated profile, instance `b521a8fe-d803-4031-af23-4bb51f4e1e56`, with base port 60748. It verifies a complete automatic upgrade backup, reads every original row across all 144 tables, and checks a cold reopening without model inference or replay. Its `qualification.json` freezes the delivery scripts before installer construction.

Installation first checks that the ordinary application is idle, captures fresh logical recovery, and requests normal window closure through the existing close helper. It then saves and independently verifies encrypted recovery and the old program, uses the installed updater, and reopens normally. It verifies the exact new files, all original database rows, the profile selector, and protected settings. Installation writes an installed pointer with native visual acceptance still pending. Inspect the actual installed builder and saved chat, verify the new builder behavior against the bounded qualification evidence, and save a completion receipt before reporting delivery complete. Preserve the installation's recovery and rollback directories.

Do not repeat a failed lifecycle stage blindly. Inspect its retained evidence and running processes first. The existing `--resume-upgraded` and `--resume-closed` routes retain their narrow guards for their specifically documented states.

Local tooling verification establishes routing, immutable base identity, unchanged dependencies/native helper, schema90 checksums, strict row comparison behavior, valid token renewal, and rejection of changed scope, identity, grants, credentials, skills and vault rows. It does not establish that the candidate has been built, installed, or visually accepted. Those outcomes require the delivery stages above and installed inspection.
