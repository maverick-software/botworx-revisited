# Installed 0.43.0 — ordinary Windows installation and retained data

October 17, 2026. Agentopia 0.43.0 is installed, signed in, and open through its real Windows desktop shortcut. PostgreSQL and native Supabase remain the application database and services. The bundled Codex runtime remains 0.163.0, with ChatGPT authorization and OpenRouter available through the same chat interface.

The executable now resides under `%LOCALAPPDATA%/AgentopiaDesktop/app-0.43.0`. Its active profile is `%APPDATA%/Agentopia`, and the copied WSL disk is in that profile's `wsl` folder. A private installation binding selects a separately named `AgentopiaRuntime-<UUID>` distribution and verifies its identity before provisioning or shutdown. The original host-cache installation, profile, registered `AgentopiaRuntime`, database export, and 0.42.2 recovery installer are retained. The original runtime stays stopped. New work is saved in the adopted copy.

## Provisioning and history transfer

The application was closed normally before copying. A consistent database recovery backup passed its manifest checks. The stopped original WSL export passed complete archive parsing, a runtime-identity check, and a SHA-256 checksum. It was imported as a separately named copy, preserving the original registration. No Docker engine was introduced.

`copy-desktop-profile.py` verifies source stability and each destination file's bytes, rejects links and conflicting destinations, and keeps a resumable manifest outside both profiles. It copies credentials together with their matching Local State encryption metadata, previous backups, native histories, browser data, custom skills, and managed workspaces. WSL storage and transient caches are handled separately. Nothing is deleted from the original profile.

The first stopped-profile stage verified 163,777 files. The promotion into ordinary Windows storage verified 163,598 files, totaling 11,653,101,142 bytes. Comparing the manifests explains the difference: repairing the 91 native indexes checkpointed 180 SQLite journal/shared-memory sidecar files and added one relocation marker. All other file bytes, including native rollout and paginated-history contents, remained identical. The application's relational database remains PostgreSQL; these SQLite files are Codex's existing internal history indexes.

The native repair rebases only managed path indexes. All homes are validated before writing; rollout bytes and pagination offsets are preserved. During adoption, actual Codex processes opened all 120 saved threads across 91 homes by their existing identifiers, reading 171 saved turns and preserving 35 recorded child relationships. Every returned rollout path resolved inside the adopted profile. These checks did not start an inference turn.

## Database, credentials, and installed-resource checks

Before new chat tests, the adopted database matched the source for both account identities, password fingerprints, roles, 93 conversations, 308 messages, and every one of the 45 immutable migration checksums. Separate canonical fingerprints matched all 692 original-account rows across 63 account-owned public tables. Saved session and provider credentials decrypted under the same Windows account using the copied encryption metadata.

The 233-check regression run passed. The final profile protection was then covered by 21 focused checks, including protection of retained application profiles after the active profile changes. The full regression count and focused count overlap; they are not a count of distinct new tests. An actual Electron regression also verifies raw application-archive hashing and refusal to repeat a completed migration. Seven profile-copy scenarios and an actual Windows junction refusal check are included in the earlier regression coverage.

All 6,137 delivered resource files match the prepared application image, including the executable, 996 compiled modules, interface assets, bundled tools and runtimes, Linux and voice archives, and 45 migrations. Managed Linux application directories contain no symlink dependency on a Windows host folder. The installed application uses ordinary Windows storage; the one-time migration helper and private evidence remain in the source workspace.

## Live chat and Windows launch checks

Two unique live requests continued an existing diagnostic conversation. The composer selected ChatGPT and then OpenRouter at High thinking with text-only permissions. Both replies used their original native Codex thread identifiers. OpenRouter recalled the verification code supplied in the preceding ChatGPT exchange. Reloading the interface retained both replies. Four messages were added to the existing conversation, bringing the database to 312 messages across the same 93 conversations; the earlier 308 messages still match their recorded fingerprints.

The saved-child interface was exercised without sending another request: opening the parent's Subagents panel, selecting a child, reading its saved result and reported-to-parent status, observing the follow-up control, and returning to the main chat all passed. The account exposed 24 saved child entries. This checks access to completed child work after relocation; it does not establish a new active-child steering or cancellation run for this release.

The verification application closed normally and stopped its bound copied runtime. Starting the real installed desktop shortcut then restored the original signed-in account, chat, and composer context from a stopped backend. PostgreSQL, REST, authentication, realtime, storage, and functions were all healthy, and local authentication answered its health request. Both new provider replies survived this restart. A second desktop-shortcut launch retained the same process and window. The final application has no debugging launch flag, its temporary debugging port is closed, and the temporary debugging shortcut has been disabled. The original source credential-store fingerprint remains unchanged.

## Failure handling and evidence

The first adoption preflight stopped before changing a profile because Electron's virtual archive reader could not hash the application archive itself. The reader now uses Electron's unpatched `original-fs` module, and the actual Electron regression passes against the rebuilt package.

The first child-display assertion compared raw Markdown punctuation with rendered text. Its read-only recovery checked the saved result marker in the result pane and passed. A cold-start database verifier was also corrected to join request timing and native state from their separate tables, matching the application's message loader. Neither correction resent an AI request. Exactly two new inference requests were issued for this migration.

During the normal shortcut check, the Windows automation accessibility view retained startup text while the fresh window image showed the restored account and chat. Startup was established from the image and independent backend/data checks. The cause of the stale accessibility view remains to be investigated; it has not been attributed to either the application or the automation helper.

Private checkpoints, manifests, source/copy fingerprints, backup and export records, native-history results, installed-resource comparison, paid-request identifiers, read-only verifier recovery, cold-start and single-instance results are under `.supabase/desktop-standalone/migration/`. That directory contains private database and profile copies and is excluded from distribution.

## Remaining qualification

A clean Windows machine, a full Windows reboot on 0.43.0, and portability to another Windows account have not been qualified by this run. Credential portability is established only for the same Windows account; provider reconnection is required when the Windows encryption identity changes. Browser-profile bytes were copied, but this release's migration checks do not establish fresh website-session or personal-Chrome authorization. Further active background-child continuation, steering and cancellation after relocation, voice operation, broader Windows applications and displays, and full desktop interaction parity remain under the ongoing project goal.

The retained original is a recovery snapshot from before the new checks. Close the adopted application and stop its copied runtime before reopening that original; both configurations use the same local service ports. Back up subsequent work in the adopted installation before recovering to an earlier snapshot.
