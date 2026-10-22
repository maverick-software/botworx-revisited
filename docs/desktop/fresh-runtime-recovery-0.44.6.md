# Fresh-runtime recovery for 0.44.6

October 17, 2026. Eight recovery checks pass with the delivered 0.44.6 runtime supervisor, bundled Linux archive and database resources. A new WSL 2 distribution restored the current database snapshot, applied schema 56, stopped normally, and recovered its data and encryption root after full termination. The test distribution was then removed. Production remains on installed 0.43.7 and schema45.

## Setup

The test extracts backend modules from the exact verified [0.44.6 application archive](native-routing-0.44.6.md). It imports the bundled Linux runtime into a newly generated distribution and uses a private Windows profile containing the checksum-verified [database snapshot](upgrade-rehearsal-0.44.6.md). Its Windows folder grants access to the current user and SYSTEM. No canonical application profile, provider connection, or installed executable is changed.

Only the Supabase test port numbers differ from delivered resources. This lets the production backend continue running. The test controller registers the generated distribution and assigns its installation binding before calling the delivered Runtime.start. Resource transfers, first-run database import, migration manager, shutdown and second startup then execute normally against that distribution and profile. The test verifies the instance binding and registered storage path before removing its own distribution. The default first-launch branch that registers the legacy-named distribution is outside this check.

## Results

- The bundled archive imports with cached software and no existing stack, database or accounts.
- Native PostgreSQL, REST, authentication, realtime, storage and functions become healthy after restoration and again after cold restart. No Docker engine is started.
- All 20,134 compared rows across 141 public, authentication, vault and pgsodium tables preserve their existing values. Account password hashes, profiles, roles, agents, conversations and messages match the source snapshot.
- All 190 existing encrypted vault records remain readable after restoration and after cold restart. Their values are processed inside the private audit and are never printed.
- The restored key matches the database key file, private runtime settings, Supabase configuration and saved native stack binding. All 56 migration checksums match the delivered SQL.
- A controlled vault record is created and verified before shutdown, decrypts to its exact expected value after restart, and is removed before the final original-data comparison.
- Normal shutdown terminates only the recovery distribution. It is unregistered after its storage path is verified inside the test directory. The registered distributions and their running states return to their exact starting lists.
- A separate read-only production check confirms two accounts, 101 conversations, 338 messages and 45 migrations, with all six required services still healthy. The retained original AgentopiaRuntime stays stopped.

## Evidence and remaining work

Repeatable command: `node scripts/desktop/test-fresh-runtime-recovery.mjs`. The test’s frozen scripts, private profile, resource copies, progress, data audits, intent and independent checkpoint are retained under .supabase/desktop-fresh-recovery/1792299042697. The application archive and original release proof are unchanged.

This establishes fresh native backend recovery and cold restart on the current Windows account with separate test ports. It does not establish an ordinary installer upgrade, a different Windows account or clean machine, Windows reboot, restored native Codex session files, a complete desktop chat/browser/tool workflow, or live inference. No account login was attempted through the copied authentication service and no provider request was made.

Actual installation still needs fresh ChatGPT live acceptance and a fresh backup of the complete normally closed application profile. The remaining installed workflows must use that exact qualified image. Broader desktop parity remains unfinished.
