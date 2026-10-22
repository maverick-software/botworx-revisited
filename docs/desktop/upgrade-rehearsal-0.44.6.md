# Database upgrade rehearsal for 0.44.6

October 17, 2026. The current database was backed up, restored into a newly generated test database, upgraded through migration 56, and checked for data preservation and rollback. Installed Agentopia remains 0.43.7 and its database remains at migration 45.

## Setup and purpose

The test uses the maintenance script and SQL resources delivered with the verified [0.44.6 installer](native-routing-0.44.6.md). The backup script runs unchanged against the existing PostgreSQL/Supabase database in read-only mode. It exports one consistent database snapshot and creates the full database, account, application and vault archives plus the encryption-root recovery file. Checksums and private file permissions were verified. No provider requests were made.

The restore destination is a separate database in the already-running native PostgreSQL cluster. The test redirects only the provisioning script’s resource root and database destination; it does not modify the delivered maintenance script or migrations. The cluster-bound pg_cron scheduler, its jobs and permissions are omitted from the secondary database. The existing public schema is reused. All existing public, authentication, vault and pgsodium table data is restored and compared.

## Results

- The restored copy matched 20,134 existing rows across 141 tables. The comparison includes account password hashes, profiles, roles, agents, conversations, messages and stored encrypted records. Sensitive values stay inside the test process.
- The delivered provisioning script applied all eleven migrations from 46 through 56. Every previously existing column value remained unchanged. Added columns and new tables were checked separately through the migration version records and required schema objects.
- A second provisioning run validated the same 56 checksums and left both the version records and existing data unchanged.
- A synthetic extra migration created a table and then deliberately failed. The table and its migration version record both rolled back. The preceding successful upgrade and original data remained intact.
- The folder-call uniqueness index and native-goal recovery function were present. The generated test database was removed and its removal independently rechecked.
- Production remained at two accounts, 101 conversations, 338 messages and 45 applied migrations. The retained original WSL distribution stayed stopped. No service was started or stopped.

## Failures retained and corrected

The first restore attempt omitted the scheduler extension and jobs but retained permissions referring to its absent schema. PostgreSQL refused that restore and the test database was removed. The test exclusion was extended to those permissions, after which the restore and upgrade passed. A later rollback assertion initially treated binary error output as text; the assertion was corrected and the complete six-check run passed. These were test-fixture corrections. The application package was unchanged.

## Evidence and limits

Run the repeatable check with `node scripts/desktop/test-upgrade-snapshot.mjs`. Its frozen fixture, intent, evidence and independent checkpoint are in .supabase/desktop-upgrade-rehearsal/1792298762713. Earlier attempts remain in their separate timestamped directories. The original 0.44.6 release proof and installer are unchanged.

This establishes logical data preservation, migration repeatability and failed-migration rollback on the current PostgreSQL runtime. It does not establish an installer upgrade, a restore into a fresh WSL runtime, transfer of the encryption root to another Windows account, an authenticated API workflow, or restart/reboot behavior. The existing authentication service remains pointed at production throughout; no account sign-in or provider request is made through the copied database.

The retained Linux backup is private to the Agentopia service account. The actual upgrade still needs a fresh complete application backup after normal closure so native session databases and workspace state are captured consistently. Fresh ChatGPT authorization remains necessary for the pending live goal, skill and browser checks.

A subsequent [fresh-runtime recovery check](fresh-runtime-recovery-0.44.6.md) verifies import into a new WSL distribution, all compared row values, 190 readable vault records and the encryption root across a full runtime stop and restart. The limitations above describe this earlier database-copy test; the linked check supplies the later backend recovery evidence.
