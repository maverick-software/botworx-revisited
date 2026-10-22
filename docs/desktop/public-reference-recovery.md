# Portable public attachment identities and saved links

October 19, 2026: **included in installed 0.44.47 recovery-bootstrap-15**, whose ordinary reopening and saved-data preservation are accepted. The isolated recovery evidence below covers portable attachment identities and owned path translation. It does not establish a complete application restore or a new Windows-account test. [Current installed evidence and remaining requirements](recovery-bootstrap.md).

## Recovery behavior

A protected public-reference index retains each account's public attachment IDs, file/folder kind, name and relative path. The public archive's file inventory supplies the expected bytes and hashes. Account ownership, duplicate IDs/paths, missing parent directories, invalid paths, linked files and changed bytes are checked before references are published. External selected workspaces and clipboard images have separate recovery requirements; they are excluded from this public-only index.

The sign-in controller derives the owner from the verified Agentopia login. It checks the restored files, then saves the references and an applied-recovery marker in one encrypted-file transaction. A failed publication leaves both settings unpublished. The marker prevents later sign-ins from automatically reviving a reference the user has forgotten. Existing matching IDs can be rebased; conflicting IDs or paths are preserved and reported.

After successful reference recovery, saved public paths and known former private-workspace paths translate into the restored home. Translation uses the owned suffix and does not read the earlier Windows home. The existing saved-chat, offered-link, account, native-branch and regular-file checks still apply. An installation without a recovery record keeps its existing behavior. The sign-in integration is now installed; complete fresh-backend application recovery remains open.

## Qualification

The frozen source passes full backend TypeScript diagnostics and **53 local checks**. These cover portable references, encrypted-setting transactions, sign-in ownership/account-change guards, existing edited-output reopening, attachments, background-command ownership, named-agent assignments/cancellation, queues, policy ceilings and memory-source validation. The agent checks use controlled fixtures; no new live model execution is claimed.

A generated relocation test creates a private output and edited public copy, moves the private and public data to a fresh home, removes the former home, restores the original attachment ID and reopens the edited copy through the saved original private link. The original source remains unchanged. Other tests check revocation after restart, foreign-owner input, duplicate/conflicting identities, file-hash failures, symlinks and hard links.

Frozen source, six matching compiled modules, test logs and receipts: `.supabase/desktop-public-reference-recovery/1792475288033/`. The current pointer is `.supabase/desktop-public-reference-recovery/current.json`. The six production source changes are `broker.ts`, `chat-files.ts`, `workspace.ts`, `secrets.ts`, `public-file-recovery.ts` and `restored-public-files.ts`. All UI source remains equal to the accepted revision 14. No new application archive has been created.

## Rehearsal with actual protected data

Recovery directory: `D:/Users/charl/AgentopiaRecovery/export-relocation-14/1792474234936/`.

An isolated Electron helper reads only the copied `Local State` and encrypted credential file extracted from the verified private-profile archive. It uses the two account UUIDs from the matching database archive and exports only public-file references. It writes no production data and performs no network request. The result contains **four public attachment references** and is recorded by `public-reference-index.json`.

A second isolated Electron process starts with a **fresh local credential store**, without copying the original encrypted credentials. It restores those four IDs against the separately restored public collection. All four `agentopia-file` links resolve. The original sample Word link, its account and its three native scopes are independently selected from the archived application database. Resolving that link selects the restored Word copy under the new test home, and its hash matches the public archive inventory. Two private workspace files are restored for this rehearsal. Evidence: `public-reference-rehearsal.json` and its referenced job.

A further Electron launch cold-opens that fresh encrypted store using the final qualified modules. All four IDs and links remain available, and the credential file stays byte-identical during the read-only check. Evidence: `public-reference-reopened.json`. These are separate Electron process checks on the current Windows account; they do not prove another Windows account's full application recovery.

All 126 production tables still match the protected database snapshot after these rehearsals. Production app files, profiles, original public documents and provider connections are unchanged. No AI request was sent or replayed.

## Required next work

Integrate index capture and verified restore preparation into the full recovery path, preserve or rebase native histories, and handle provider reauthorization on a different Windows account. Restore preparation must stage the database/private data, public files and validated reference record together, preserve existing installations, and recover interrupted preparation honestly. External generated files such as Downloads documents and selected workspace folders require an explicit recovery policy and coverage; public-only recovery does not establish their restoration. Then package and qualify the exact archive, deliver it with fresh recovery and test the ordinary app. Full installer, Windows reboot, clean-machine restoration and broader live workspace-agent checks remain open.
