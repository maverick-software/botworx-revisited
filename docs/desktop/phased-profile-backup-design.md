# Recoverable profile backup workflow

Implemented and exercised October 18, 2026. This replaces the earlier all-files archival draft. The required checkpoint is a verified snapshot of actual user data from both physical Windows profiles and a cold export of the bound backend disk. Archiving old recovery folders and regenerable runtime caches is optional and does not gate app availability.

The controller requires the app closed, records WSL distribution state, verifies the owned runtime identity, and records hashes for critical backend files. It copies and verifies the current logical dump/key files and manifest, then exports the stopped backend disk and verifies its header and hash.

A generated private reader distribution copies both physical AppData roots without starting Supabase. `profile_archive.py` streams exclusive archives, verifies every member, and re-reads the source to detect changes. `phased_backup.py` applies the same native-state exclusions as the qualified product backup policy: provider-scope temporary folders and bundled system skills are omitted while custom skills and nested reference folders remain included. Attachments, browser partitions, native histories, SQLite databases and protected credentials remain covered. Old top-level backups and generated test profiles remain intact at their source. The bound Linux disk is separately exported.

On success, `seal-physical-profile.mjs` records `currentSnapshotComplete: true`, scope `recoverable-profile-data`, policy `runtime-native-backup-v1`, and both archive hashes and counts. It verifies and removes only the generated reader and restores original WSL state. `fullBackupComplete` remains false because historical all-files archival was not performed.

`verify-physical-backup.mjs --core <timestamp> --execute` imports a disposable disk copy, checks six critical backend files and confirms PostgreSQL remains stopped. It removes only the generated distribution after validating its exact storage registration. Success records `latest-core-import-check.json` and permits reopening through `latest-core-backup.json.appMayReopen`. Database restore, application behavior and inference have separate acceptance tests.

The completed run is `.supabase/desktop-installed-0448/physical-backup-1792306988278`. Both snapshots and the cold disk import check passed; installed Agentopia 0.43.7 reopened with its saved session and interface state. The private 0.44.8 release remains uninstalled. See [the current recovery record](physical-profile-backup-0.44.8.md) for the physical credential-store finding and remaining work.

Earlier cancelled operations and partial copies are retained. `archive-physical-history.mjs` refuses this recoverable-data checkpoint; its older all-files inventory cannot be treated as complete by this workflow.
