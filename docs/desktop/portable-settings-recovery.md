# Portable preferences and unsent drafts

**Subsequent source update:** [selected external files and workspace folders](external-file-recovery.md) are integrated with recovery capability 5. This page records the preceding capability-4 settings checkpoint. Local display/pane choices and installed acceptance remain open.

October 20, 2026: **qualified in source; not installed.** Production remains accepted Agentopia 0.44.47 recovery-bootstrap-15. The normal portable-backup producer now includes selected account settings, restores them into destination Windows encryption after verified sign-in, and requires recovery capability 4. This does not complete external-file/folder recovery or all display settings.

## Preserved values and ownership

The capture reads exactly seven named categories for each account in the matching database snapshot: appearance/keyboard/sidebar preferences, model choices for both supported providers, the preference for ChatGPT when both providers are connected, composer options, unsent chat drafts, the last desktop location, and voice preferences. It does not enumerate or copy the original credential store. Provider tokens, local sign-in sessions, Windows command permissions, computer-use grants and host identity are outside that allowlist. Temporary shared-window IDs and goal IDs are removed from portable composer/draft options. A saved Full access choice remains a choice; destination Windows command authorization is still checked through the existing permission code.

The metadata is bound to the database manifest hash and its archived account IDs. Capture validates field names, settings, draft scopes, text lengths, dates, total draft counts and the serialized UTF-8 byte limit. Unknown categories and nested credential fields are refused. The producer includes its checksum in the final nine-resource descriptor only after the underlying database, managed files, public references, images and settings have been captured successfully.

The launcher and first-start preparation accept the new capability explicitly. Older installed recovery code refuses it. Removing the capability while keeping settings metadata is also refused. Preparation stages the settings metadata before database startup, retains its identity in the recovery journal, and verifies it after publication and when resuming an already prepared operation. The actual TypeScript startup barrier validates the settings contents before opening a prepared or completed restored database.

After sign-in, the broker restores clipboard images and public references, then settings, before returning the identity that allows the interface to load preferences and drafts. Settings and their applied marker are written in one encrypted-store transaction. A failed publication can retry; an account change prevents publication. A conflicting existing preference is preserved and reported. Once the marker is applied, later preference changes and draft deletion remain respected across controller recreation and reopening.

## Verification

Final source qualification: `.supabase/desktop-portable-settings/1792482407846-source/qualification.json`. It retains the earlier complete frozen source, an overlay of changed source files, and copies/hashes of the changed launcher and supporting scripts. All source inputs were compared before and after verification.

- 131 JavaScript cases cover the portable producer, actual broker sign-in ordering, settings validation and atomic publication, startup barriers, actual main-process backup/close handling, and existing agent, queue, image, attachment and recovery behavior.
- Four actual Settings/backup-hook workflows with generated data verify edit flushing, progress, disabled controls, success, cancellation and failure. Their source hashes match the qualified Settings interface.
- 31 direct Python cases cover existing preparation, images, the seven new settings-preparation cases and database snapshot handling. Prepared bytes and metadata are exercised before any real database import.
- 36 PowerShell groups and five additional Windows PowerShell 5 groups cover existing launchers, all nine capability-4 resources, corruption, missing metadata, downgrade refusal, an isolated fresh-home request and refusal by the actual installed revision-15 helper.

Real Windows evidence: `.supabase/desktop-clipboard-recovery/1792482392381/evidence.json`. Three Electron processes use generated data, actual Windows encryption and actual encrypted-store code. A fresh app profile receives image pixels/IDs, appearance preferences, a model choice and an unsent draft without copying the source credential file or generated provider token. A separate process reopens them, changes the preference and deletes the draft/image, then verifies that recovery does not revive the deleted values. Original encrypted settings and image bytes remain unchanged. These are separate app profiles on the same Windows account; restoration under another Windows account remains unverified.

The actual prior bootstrap module also refuses capability 4 before creating a bootstrap profile: `.supabase/desktop-clipboard-recovery/settings-legacy-1792482272265/evidence.json`. The current module accepts its isolated queue; this specific check does not import a database.

## Remaining acceptance

Selected external files and workspace folders still require a separately owned byte capture, attachment-ID rebinding and translation of former absolute paths. They are currently registered by host paths; carrying those strings alone cannot restore their contents on a fresh machine. Their backup must preserve originals and account boundaries while handling linked, excluded and changed paths explicitly.

Display choices stored only in browser local storage, workspace-pane/tab state and window geometry are not included by this seven-category settings record. Complete portable preferences still need those paths integrated and verified. The normal product backup has not been run against the production database, and actual fresh-backend import/sign-in, full release delivery, installer/reboot acceptance and a different Windows-account restore remain open. No production profile or installed archive changed, and no model request was sent or replayed. The full desktop-parity and workspace-agent goal remains active.
