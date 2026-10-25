# Agentopia — complete installer matches the installed application

Checkpoint137 produces a complete Agentopia 0.44.76 installer for the already installed checkpoint136 application. It includes the imported-skill compatibility and before-Save Computer Use, browser and native-command changes introduced in checkpoints132,134,135 and136. The ordinary application remains on the same verified archive and UI. No product code, dependency, helper or database migration changes in this slice. The complete parity goal remains active and incomplete.

## Artifact and purpose

[AgentopiaSetup.exe](F:/Agentopia-Tmp/i76-1792871832218/o/AgentopiaSetup.exe) is 1,520,937,984 bytes. Its SHA-256 is `b7fa650d49c74d590c1ecb2f8698c781a350a6d7649b5b67130c25f180aef65a`.

The [complete package](F:/Agentopia-Tmp/i76-1792871832218/o/AgentopiaDesktop-0.44.76-full.nupkg) and RELEASES entry remain beside Setup. These are retained active release artifacts even though the existing builder places them under Agentopia-Tmp. The canonical release pointer is `.supabase/desktop-current-release137/current.json`; its proof and verification receipts are under `.supabase/desktop-preview128-release/1792871782623`.

This closes the gap between the focused ordinary updates and the older complete installer. Private account/profile contents are retained through the existing profile/recovery path and remain outside the installer. The 228 imported skills are part of the retained account data. The installer is a current-version recovery/reinstallation artifact; a future version-changing update retains its own upgrade acceptance. The same-version installer was not executed over the ordinary profile.

## What was verified

The source gate follows the accepted132→134→135→136 archive chain back to complete checkpoint131. Every recorded compiled difference agrees with the actual archives. Eleven compiled modules differ from complete131. Recovery, encryption, database, settings and updater modules remain identical to that complete release. The old full encrypted recovery evidence is reused with that explicit boundary, alongside current136 packaged/cold workflows and installed data/settings preservation. Different-Windows-user and physical reboot recovery remain unverified.

The source test payload uses isolated ports60748–60753. A separate installer payload copies only runtime/config.toml from the ordinary installation, restoring production defaults57320–57325. Exact text comparison proves those port replacements are the whole configuration difference. All 72 program files and 7,497 supporting files then agree with the installed application, including its archive and UI. The source test payload and previous evidence remain unchanged.

The existing pinned Squirrel builder uses short F-drive paths and private helper copies. Its intermediate NuGet archive is removed by that existing path. Streaming verification checks the installer/package hashes, unchanged executable sections of the generated launcher, the pinned updater, every decompressed application/supporting file, version metadata, and the exact full package embedded in Setup with its matching RELEASES record. All 7,570 packaged files pass. Shared vendor helper hashes remain unchanged.

One actual startup uses the installer’s staged executable, a fresh isolated profile and a deliberately unregistered runtime. It verifies the reported version and profile, the refusal to use an unregistered runtime, zero external requests and normal shutdown. That generated runtime is never registered. This tests fresh startup and runtime selection; complete private database recovery is supported by the explicitly reused evidence, rather than rerun by this startup check.

Two initial source-gate failures remain retained. Nested ASAR reads required native Windows path separators; direct extraction confirmed the files existed. The supporting-file gate then identified the expected isolated-port configuration, leading to the separate production-port payload described above. Both failures occurred before installer construction or provider calls.

## Preservation and remaining work

Installer construction makes no ordinary profile/database writes and does not restart the ordinary app. Final protection-file hashes and read-only saved-state comparison are bound in the checkpoint137 receipt. No real ChatGPT OAuth or OpenRouter inference request occurs. Image generation stays disabled, and both existing provider connections remain retained.

The installed application’s complete137-table/1,898-row and108-protected-value preservation evidence remains checkpoint136. The requested five-item rail, compact voice button, reference typography, Skills review page and collapsible right background pane remain installed. See [the full32-element goal table](goal-status76.md) and [the installed command-preview report](continuation-brief136.md).

Next work is before-Save delegation and persistent private memory through the existing agent runtime and ownership paths. Authenticated Google-editor setup, broader representative apps/skills, extended unattended work, production-context summarization and fresh reference/scaling comparisons remain open. Automatic approval review’s previous “blocked by policy” rejection still leaves the superseded uninstalled135 test directory intact; it was not retried in this slice.
