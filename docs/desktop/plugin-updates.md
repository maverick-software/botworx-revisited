# Reviewed plugin updates

October 17, 2026. Imported plugins now have an update flow in source. It preserves agent assignments and credentials for unchanged connections, replaces changed connections without carrying their tokens, and invalidates native sessions using the earlier skill package. Additive migration 0058 is required. This source checkpoint has since been packaged in the separate [0.44.8 installer](plugin-updates-0.44.8.md), which remains uninstalled. The frozen 0.44.7 installer and installed 0.43.7 remain unchanged.

## User workflow

Open Plugins → Manage plugin → Update plugin. Select a folder or ZIP, or paste the new JSON package. The package must keep its installed name and use a different semantic version. A deliberately selected older version can also be reviewed; its version is shown before applying it.

Review shows the installed and replacement versions, new server addresses, the complete package digest and skill contents. It separates connections whose credentials will be retained from added, changed and removed servers, and lists added, changed and removed skill resource paths. Editing the JSON clears the review. Applying the reviewed update is a separate explicit action; opening or validating a package does not update it or run helpers.

The package keeps its account-level enabled setting and all agent assignment settings. For each existing server, credentials survive only when its name, exact URL and transport all match. Removing a server deletes its owned connection and encrypted credentials. Changing its address or transport creates a replacement connection without the earlier token. Added servers also begin without credentials. Disabled assignments and retired agents receive no new connections during an update; enabling a valid assignment later creates its missing connections through the existing assignment flow.

Bundled plugins continue to be updated with the application. Historical connection wrappers retain their existing management path. This screen updates imported packages owned by the signed-in account.

## Execution and consistency

The package identity follows the public stable-name and explicit-version guidance in the [OpenAI plugin documentation](https://developers.openai.com/plugins/deploy/submission#package-identity-and-components). Agentopia continues to validate packages against its pinned portable schemas and host support rules. An update uses the same reviewed package format as installation.

The trusted broker revalidates the replacement package, exact digest and native skill metadata. PostgreSQL locks the owned records and verifies the installed digest again before applying the package and reconciling connections in one transaction. A stale review cannot overwrite another completed update. If a connection creation fails, the entire operation rolls back, including credential removal.

Actual native skill sessions using the old package are closed. An independent child is interrupted even after its parent has finished, and its completed tool activity remains in saved history. Resuming its earlier configuration is blocked before inference. New turns load the updated instructions. Pending remote tool calls include the package digest in their configuration signature and must pass the existing fresh-review checks after a package change.

Derived skill cache cleanup removes earlier package copies for the current account while retaining the new digest and other accounts’ files. Package replacement does not run helper scripts, migrate credentials between server addresses or change the chosen AI provider.

## What was verified

No live provider inference was used. Tests use controlled accounts, packages, model responses and temporary profiles; the database checks operate on an isolated restoration of the existing snapshot.

- Both backend and renderer compile. Forty-two focused and regression checks cover update review and ownership, exact digests, package/schema rejection, scoped cache replacement, existing importer/skill/reference behavior, agent policy and actual bundled Codex execution.
- Actual Codex controlled turns first receive an old skill marker, then receive the new marker through both ChatGPT and OpenRouter adapters after replacement. The new turns exclude the old instructions. This proves transport and native skill loading; model responses are supplied locally.
- The actual native child case reads a reviewed reference after parent completion. Updating the package aborts its held stream, closes the runtime, saves its completed reference receipt and interrupted status, and refuses old-configuration restoration before another provider request.
- Eight PostgreSQL checks apply schema45 through schema58 to a separate database while preserving all 20,134 original rows across 141 tables. They verify ownership and execution permissions, transactional rollback, exact credential retention, credential removal, disabled/retired grants, stale reviews, two overlapping updater sessions, conversion to a skills-only package and complete fixture cleanup. The temporary database is removed. Production remains at two accounts, 101 conversations, 338 messages and 45 migrations.
- Six real-renderer workflows cover the dedicated update screen, native-picker result review, editing and identity errors, dark/light/narrow layouts, failed-save inspection and an explicit retry with duplicate controls disabled. The picker and registry are controlled. Screenshots were inspected.

The first two database attempts stopped on generated fixture setup errors: an incorrect provider identifier and duplicate generated connection names. Both temporary databases were removed and production observations matched. The corrected tests then passed, followed by a separate passing run that adds the overlapping-session check. A Windows encoding error during source editing was corrected from the frozen release copy before compilation and qualification.

Evidence:

- Source/build and 42 checks: `.supabase/desktop-plugin-updates/check-1792301696617`.
- Eight PostgreSQL checks: `.supabase/desktop-plugin-updates/storage-1792301662850`.
- Six interface workflows: `.supabase/desktop-plugin-updates/ui-1792301604129`.
- Frozen source, compilation settings, dependency declarations and hashes: `.supabase/desktop-plugin-updates/qualification-1792301812117`.
- Current source index: `.supabase/desktop-plugin-updates/latest-source.json`.

Repeatable commands are `node scripts/desktop/test-plugin-updates.mjs` and `node scripts/desktop/test-plugin-update-storage.mjs`. For the interface command, set `AGENTOPIA_PLUGIN_UPDATE_BUILD` to that run’s isolated build and run `node scripts/desktop/test-plugin-update-ui.mjs`.

## Remaining work

The separately qualified 0.44.8 package now includes migration 0058. Live ChatGPT acceptance after fresh authorization, installed plugin updates and restart/credential retention remain open, alongside the full-profile backup, ordinary installer upgrade, Windows reboot and clean-machine gates. Hooks, local-command MCP packages, OAuth-only connections, publisher signatures and marketplace delivery remain further plugin work. Broader desktop parity is unfinished.
