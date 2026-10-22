# Selecting a retained database copy for standalone installation

October 17, 2026. This records the source-development checkpoint after 0.42.2. The binding is now installed and qualified through the complete local 0.43.0 adoption. [Current installation, data and live verification](standalone-installation.md).

## Problem and resulting behavior

Startup, maintenance, backup downloads, and voice uploads previously named `AgentopiaRuntime` independently. A relocated database needs a different registration while the original remains available for recovery. Changing startup alone would send some operations to the old database environment.

The main process now reads `runtime-binding.json` from its private Windows profile. A migrated installation supplies format 1, a generated version-4 UUID as `instanceId`, and the exact distribution name `AgentopiaRuntime-<instanceId>`. Additional fields, other names, unsupported formats, oversized files, links, and hard-linked settings files are rejected. An existing invalid file produces an actionable error. Profiles without a binding retain the original distribution name, preserving the current installation and fresh-install behavior.

The selected binding is held for the process lifetime. Before provisioning, startup verifies both the existing Agentopia runtime identity and `/opt/agentopia/runtime-instance` against the bound instance ID. A missing migrated registration produces an error instead of creating a blank database. A mismatched copy fails before setup files or provisioning commands are sent. Shutdown acts only after identity verification and stops only that selected distribution. It never invokes global WSL shutdown.

Setup resources, schema files, migration input, backup downloads, voice-resource installation, recordings, cancellation, and audio cleanup now use the same selection. Voice calls `Runtime.send` rather than a transfer function with an independent default name. Windows filesystem protection also rejects both original and generated runtime shares through normal, case-varied, and extended UNC paths.

This is a maintenance binding, kept outside renderer control. Provider connections, PostgreSQL schema, and the actual Codex harness remain unchanged.

## Verification

The source desktop and interface compiled, and all **231 desktop regression checks passed** with no failures or skips. Eight new binding checks cover strict settings, default compatibility, retained selection, missing registrations, instance mismatch, verified shutdown, private filesystem paths, and closing before ownership verification. The suite also includes the staged native repair tests and the existing real local Whisper cancellation check.

Run `node scripts/desktop/test-runtime-binding-wsl.mjs` for the real WSL routing test. It imports an isolated 47.5 MB Linux archive containing the system Python interpreter, standard library, and required libraries. Backend management and transcription responses are controlled fixtures: this tests which environment receives commands and exact bytes, rather than qualifying a PostgreSQL restore or speech recognition. A local HTTP fixture supplies the authentication-health response.

The test first presents the wrong instance marker. The product refuses it, and a read-back confirms that setup did not run. After fixing that marker in the disposable environment, the normal `Runtime` class starts it, sends exact Unicode file bytes, retrieves all six backup resources, installs a checksum-verified voice-resource fixture, uploads a real PCM WAV recording, receives its expected byte fingerprint, removes both recording copies, blocks workspace attachment to the backend share, and shuts down the selected distribution. Before unregistering the disposable environment, the test verifies its registration name and storage path. It confirms that all pre-existing registrations and running environments remain available, and that the six actual Supabase services are healthy before and after. The complete workflow passed.

The maintenance tests initially generated Python bytecode files inside the pinned resource folder. The integrity check rejected those extra files. They were moved to private evidence storage, the tests now use Python's `-B` option, and all **4,199 pinned runtime files** verify again. The installed runtime was unaffected.

A separate database audit after the regression suite retains both original accounts, passwords, roles, **93 conversations, 308 messages**, and all **45 migration checksums**.

## Migration inventory and remaining gate

Read-only inventory checked the seven chat, native-turn, tool-receipt, file-review, request, and terminal tables for paths under the old Windows profile. It found none. A separate Electron process decrypted copied credential files and checked all 76 stored entries, including 30 file references, without emitting provider values. It also found no old-profile paths. These checks support retaining the existing reference IDs and external workspace paths; they do not establish a completed full-profile copy.

The current profile has **91 native homes**, all with a state index and no linked home directories. The earlier native repair proof covers two real provider branches. A complete migration must validate and repair every copied home and preserve empty managed workspace directories as well as files. The warm filesystem inventory estimates 11.5 GB of retained profile files, including 11.0 GB of earlier backups, plus a 5.9 GB WSL disk. It is a size estimate, not a consistent recovery snapshot.

The original application remains open on installed 0.42.2. The new binding is compiled and tested in source; no actual user database has been exported into an adopted installation, no production binding file has been written, and no replacement shortcut has been activated. The next step is the stopped-application profile copy and full-size database export/import, with the original retained until standalone launch, complete history, provider behavior, browser sessions, child controls, and recovery are verified. Windows Store filesystem redirection must be accounted for when writing the ordinary Windows profile and running its installer.

Private evidence is under `.supabase/desktop-standalone/`: `binding-core.log`, `binding-tests.log`, the completed `binding-wsl-*/evidence.json`, `binding-data/`, and the path/size inventories. Keep this directory private; it contains encrypted credential and conversation recovery copies.
