# Packaged application startup and recovery — 0.44.7

October 17, 2026. The actual packaged Windows executable passes seven startup and recovery checks against a separate WSL environment and a restored database snapshot. It starts its normal entry point and delivered interface, reaches the local sign-in screen, handles a second launch, closes normally and opens again after its backend has stopped. Production remains on installed 0.43.7 with schema45.

## What was exercised

The test copies the exact qualified [0.44.7 application](goal-limits-0.44.7.md), including its executable, application archive, bundled Linux runtime and database resources. It runs from a temporary working directory with Windows developer tools removed from its PATH. Supabase port numbers in the private resource copy are changed so the production backend can continue running. The normal main process, preload bridge and renderer remain the delivered bytes.

A separate test profile receives the checksum-verified [database snapshot](upgrade-rehearsal-0.44.6.md). The bundled Linux archive is imported into a generated WSL distribution with a matching instance binding. The app's normal startup restores the snapshot and applies all 57 migrations. The Windows test folders grant access to the current user and SYSTEM.

Playwright observes the real app. After the first window appears, a test guard permits only local HTTP fetch requests in the main process. Neither launch records a blocked request. No provider credentials are copied into the test secret store, no account login is attempted, and no AI request is sent. These controls define the scope of this startup test.

## Results and their meaning

- The actual executable reports packaged version 0.44.7, loads `agentopia://app/login` and shows the email, password and sign-in controls. Both launches report a ready database and no captured renderer errors.
- The first startup applies schema57. All 20,134 original rows across 141 tables preserve their compared column values, including the existing authentication records. The snapshot contains two accounts, 101 conversations and 338 messages.
- All 190 existing vault records remain readable. The encryption root matches the restored key, database file, runtime settings, Supabase configuration and saved native runtime binding. Every migration checksum matches its packaged SQL file.
- A second executable launch exits while the original process retains one window. This exercises the normal single-instance path.
- Closing the window exits the process with code zero and stops its own WSL environment. Reopening the same executable and profile starts the backend again, reaches sign-in and passes the full data and encryption audit again.
- After the second normal close, cleanup verifies the owned distribution's registered storage location and removes only that distribution. All other registrations and running states match their initial lists. The retained original `AgentopiaRuntime` stays stopped.
- A separate read-only production observation records the original two accounts, 101 conversations, 338 messages and 45 migrations, with the six required backend services healthy.

Two earlier driver attempts are retained alongside the passing run. The first stopped during profile-path validation because Windows redirected the test folder. The second encountered an unavailable `require` helper in the automation context; its cleanup stopped the owned backend, but normal shutdown was not verified in that attempt. The corrected driver resolves the profile from the controller and completes the fresh run described above. Both failed attempts retain their evidence; the second attempt's owned stopped distribution was removed after checking its storage registration.

## Evidence and remaining acceptance

Repeatable startup command: `node scripts/desktop/test-packaged-startup.mjs`. Independent recording command: `node scripts/desktop/record-packaged-startup.mjs 1792301140284`. The passing run, frozen scripts, screenshots, intent, audits and checkpoint are under `.supabase/desktop-packaged-startup/1792301140284`. The original release proof and installer remain unchanged.

The test establishes real packaged application startup, database restoration and normal close/reopen behavior on the current Windows account. It stops at sign-in, so signed-in session restoration, native Codex session recovery and complete chat/browser/tool workflows remain open. Ordinary installer upgrade, a fresh complete backup of the normally closed production profile, a full Windows reboot and clean-machine acceptance also remain open.

Fresh ChatGPT authorization is still needed for live acceptance of the latest workflows. Controlled provider checks already cover the packaged native goal and child lifecycle; live model decisions need their own evidence. The 0.44.7 candidate remains uninstalled, and broader desktop parity remains unfinished.
