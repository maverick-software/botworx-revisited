# Standalone installation: relocation findings and staged native repair

October 17, 2026. Development work following the installed 0.42.2 qualification.

This document records the prerequisite development checkpoint after 0.42.2. The complete local migration and normal Windows shortcut are now qualified in installed 0.43.0, with the original retained for recovery. [Current installation and verification](standalone-installation.md). The findings below explain the earlier experiments and repair design.

Subsequent development adds an installation binding shared by startup, provisioning, backups, and voice. Its 231-check regression suite and actual disposable WSL routing workflow pass. The full profile/database adoption remains pending. [Runtime selection, inventories, and current evidence](runtime-binding.md).

## Current dependencies

The actual running executable and encrypted Windows profile are under the original Store host's package cache. The WSL registration's BasePath also points to that cached profile's `wsl` directory. Moving only the executable would leave the database dependent on the original host's data.

The installed WSL reports version 2.4.13.0 and its local help advertises `--manage <Distro> --move <Location>`. The help process returns a nonzero exit code even when printing this command list; its captured output must be inspected. Microsoft documents export/import recovery, registration at a chosen location, and distribution-specific termination; its command reference directs readers to local help for the complete installed command set. [Microsoft WSL commands](https://learn.microsoft.com/en-us/windows/wsl/basic-commands).

A disposable distribution with a 3.4 MB root archive tested the storage operation while the original AgentopiaRuntime stayed running. After terminating the disposable distribution, `--manage --move` failed with a file-sharing violation. Its registration retained the original location, and an exclusive read check confirmed that its VHD file was still locked. The direct move is therefore unqualified in this operating state.

Exporting the same disposable distribution and importing a separately named copy at the destination succeeded. The copy returned the same exact saved receipt and root identity; all pre-existing registrations and running environments were preserved. Both owned disposable registrations were removed after verifying their names and storage paths. The public `scripts/desktop/test-wsl-relocation.mjs` now repeats this export/import workflow and passed with a fresh disposable pair. The actual Agentopia database has not been moved, stopped, unregistered, or replaced. This qualifies the small-distribution transfer mechanism; a full-size database copy, recovery, and application adoption remain gates.

## Windows encryption proof

An isolated copy of the Electron executable ran from the D: workspace with a new explicit profile. It loaded the product's normal `Secrets` implementation against private copies of the existing encrypted recovery files. Copying `credentials.bin` alone failed to decrypt. Copying that file together with its `Local State` encryption metadata restored the saved account session and both ChatGPT and OpenRouter connection records.

The probe emitted presence flags only. It made no AI requests and did not change the original profile. This proves decryption under the same Windows account after changing directory. It does not prove portability to another Windows account, current provider authorization, or browser-cookie portability.

## Native Codex history proof and repair

The actual pinned Codex 0.163.0 runtime was exercised against copied homes from existing ChatGPT and OpenRouter conversation branches. Initial copies retained absolute rollout paths in their SQLite thread indexes. Codex rejected resuming a paginated thread at the copied file's path while its index still named the original location.

`desktop/runtime/relocate-native-profile.py` repairs the `threads` table's rollout path and any managed workspace or managed agent-configuration paths inside an explicitly staged profile. The original and destination roots must be separate. A completed-copy marker must identify the exact destination and pinned Codex version. The helper checks every home and matching rollout identity before writing any index. It rejects missing files, unsupported schemas, foreign rollout paths, links, and Windows junctions. Index writes use SQLite transactions; the stage marker is replaced atomically. A repaired stage can be checked again after interruption.

Rollout contents, paginated-history databases, child relationships, archived flags, tokens, and external workspace paths are preserved. The helper compares Windows paths without case sensitivity while retaining their original spelling: Codex's rollout parser requires the timestamp's uppercase `T`. An initial implementation lowercased that suffix, which the actual runtime rejected; preserving spelling and adding a regression check fixed the problem. The verifier also accounts for Windows' extended path prefix returned by Codex.

After repair, the real runtime resumed both copied provider threads by their original IDs. A second fresh runtime process loaded each by ID from its copied rollout and returned its saved turn. The source rollout hashes remained unchanged. No `turn/start` request or paid inference was issued. This establishes location-independent resumption for the two checked native branches; all native homes and subagents still require qualification during the complete move.

## Repeatable checks and boundaries

Run `node --test desktop/tests/native-relocation.test.cjs`. It runs six Python regression scenarios using the bundled Python runtime, plus a real Windows junction refusal check. They verify preserved rollout/history bytes and source indexes, archived/thread metadata, external paths, case and namespace handling, all-home validation before writes, idempotence, missing resources, wrong identities, unsupported formats, and path boundaries. Both Node checks pass with no skipped checks. The new test is included by the existing desktop test discovery; the full suite has not been rerun for this maintenance-only change.

The build now includes the helper as a maintenance resource for the next package. No new installer was produced in this step. The current installed 0.42.2 application and database remain in their qualified locations. Private evidence is under `.supabase/desktop-standalone/`; it includes encrypted credential copies and native conversation data and must remain private.

This helper repairs staged native thread indexes only. It does not copy a complete profile, move WSL, retarget encrypted Agentopia file references or PostgreSQL records, qualify browser sessions, or switch desktop shortcuts. Historical messages and other native metadata may still contain original paths. Those records must be distinguished from active dependencies during the migration inventory.

The next release gate is a complete stopped-application copy with a verified database recovery backup, transfer of the managed WSL database through export/import, repair and verification of all native homes, and retargeting of active managed-file references. The application currently uses a fixed distribution name, so adoption of a verified copy needs an explicit design that retains the original for recovery. Then exercise the standalone Windows shortcut, both providers, browser sessions, child continuation, and restart recovery before adopting the new installation. The source profile and a database recovery copy must remain available until that qualification passes.
