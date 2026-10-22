# Packaged startup and recovery — 0.44.8

October 18, 2026. The exact private 0.44.8 executable completed seven isolated startup checks in `.supabase/desktop-packaged-startup/1792307917077`. This uses the delivered entry point, preload and interface, with its own profile and WSL environment. Production remains on 0.43.7/schema45.

The check restores the existing database snapshot and applies all 58 packaged migrations. The app reaches the local sign-in screen, handles a second launch with one window, exits normally when closed, stops its own backend and reopens after that backend has stopped. Both data audits compare all 20,134 original rows across 141 tables and confirm 190 existing encrypted records remain readable. The snapshot retains two accounts, 101 conversations and 338 messages.

The executable runs with Windows developer tools removed from PATH. The test observes the real packaged application and permits local HTTP requests after the first window appears; neither launch records a blocked remote request. No provider credentials are copied, no account login is attempted and no inference is sent. Only private test ports and profile resources differ from the delivered package.

Cleanup verifies and removes only the generated runtime. Other WSL registrations and running states match their starting lists. The retained original runtime stays stopped. The original candidate and installer bytes are unchanged.

Commands: `node scripts/desktop/test-packaged-startup.mjs 0.44.8`, followed by `node scripts/desktop/record-packaged-startup.mjs 1792307917077`. Both completed successfully. The independent recorder compared all 6,221 packaged files, permitting only the explicit private-port substitutions. Its read-only production check found the original two accounts, 101 conversations, 338 messages and schema45, with all six required services healthy. The checkpoint and byte-comparison evidence are retained beside the run.

This establishes startup, schema58 snapshot recovery, single-instance handling and close/reopen behavior on this Windows account. Authenticated chat, native session recovery, browser and computer actions, ordinary installer upgrade, Windows reboot and clean-machine acceptance remain separate unfinished work. The [recoverable production-profile snapshot](physical-profile-backup-0.44.8.md) has now completed. Live ChatGPT acceptance awaits resolution of the actual writable Windows credential store and testing its newer refresh credential.
