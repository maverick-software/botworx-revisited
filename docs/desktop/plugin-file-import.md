# Reviewed plugin file and folder import

Source checkpoint, October 17, 2026. Installed Agentopia remains 0.43.7. This change follows the frozen 0.44.0 installer and private 0.44.1 portable candidate; neither artifact has been changed. No new installer or production migration was applied.

## User workflow

Plugins → Import plugin now includes **Open plugin file** and **Open plugin folder**. A file may be a JSON package, a `plugin.json` next to its `mcp.json`, or a ZIP. A selected folder contains those two declarations. Compatibility packages may put the manifest under `.codex-plugin/`; ZIPs may have one enclosing folder.

The picker reads declarations and displays the same schema, server-address and package-digest review as pasted JSON. Importing does not install anything or contact a server. The user chooses **Install reviewed plugin**, then assigns it to an agent and verifies its tools. JSON editing is available under **Edit package JSON**. Editing or starting another import clears the previous review, preventing installation using stale review data. Cancelling the picker retains the prior text without restoring its old approval.

Only the existing remote MCP plugin capabilities are accepted. Package scripts and assets are not extracted or executed. Packages declaring skills, hooks, local executable MCP servers or unsupported extensions receive an explicit error; they are not silently installed with missing capabilities. Existing protected Bearer credentials remain in the connection settings. Package declarations cannot include credentials, headers or query-string secrets.

## File handling

The importer uses the pinned Agent Plugins 1.0.0 schemas and existing package digest. ZIPs are limited to 4 MiB compressed, 16 MiB declared expanded size and 128 entries; the combined declaration data is limited to 256,000 bytes. Actual decompression is bounded even when archive size declarations are false. Entry names, duplicate/case-colliding declarations, manifest ambiguity, encryption, symbolic links, offsets, file size and CRC checks are validated before a package is returned. No files are extracted.

Filesystem reads retain a bounded open handle, check the selected file's identity and changes during reading, reject links and protected paths, and recheck the signed-in account after the native picker and before returning. Only the source basename appears in the review. The renderer cannot supply an arbitrary file path through this picker action.

## Verification

`npm run desktop:test:plugin-import` compiles into a new private output folder and checks the backend and interface types. Its latest successful run is `.supabase/desktop-plugin-import/check-1792287849778/evidence.json`: ten parser/security/file-handling cases, two existing schema/tool-descriptor cases and five real renderer cases pass. The renderer uses the actual importer with a controlled native picker and installation store. Screenshots cover light narrow and dark wide layouts. These checks make no network or model requests.

A separate test uses temporary generated records through the already-running managed Supabase API. `.supabase/desktop-plugin-import/storage-1792288383721/evidence.json` records seven successful checks. An actual ZIP is parsed, saved with its exact reviewed digest in PostgreSQL, assigned to a generated agent, discovered through a controlled loopback MCP server and executed once. Disabling the plugin blocks discovery. Folder-tool approvals, saved results, restart duplicate detection, changed-argument refusal, cancellation, agent revocation and distinct native child receipts pass through the real tool service and PostgreSQL. Its browser executor is controlled; actual Chromium byte transfer is established separately by the 0.44.1 browser checks.

The temporary account, agent and chat records were removed. Before and after inventories contain the same two existing accounts, 101 conversations and 338 messages. This test made no live inference requests, started no service and changed no production migration.

Two earlier attempts remain recorded. The first found the controlled MCP server did not return the protocol's unsupported-method response. After correcting the fixture, the second exposed a real concurrent-folder-receipt gap. The completed test explicitly leaves concurrency to the isolated migration qualification below; it does not claim the 45-migration production database contains the fix.

## Folder receipt correction and release gates

The existing upload uniqueness rule covers `browser_upload`. The new `browser_upload_folder` name also needs a database reservation before review/dispatch. Additive migration **0055-browser-folder-receipts.sql** permits one receipt per request, native thread and provider call identifier. It preserves independent parent/child scopes. Migrations 0001–0054 are unchanged.

`.supabase/desktop-plugin-import/folder-migration-1792288450002/evidence.json` records five actual PostgreSQL checks in a newly created disposable database. The exact migration applies; duplicate parent calls are rejected; separate child threads and new call identifiers are accepted; unrelated tool names retain their existing behavior; two simultaneous connections commit one folder receipt and reject the competing insert. That database was removed. Production still has 45 migrations and unchanged account/history counts. Repeat with `npm run desktop:test:folder-receipts` after explicitly setting `AGENTOPIA_TEST_DISTRIBUTION` to an already-running managed runtime. The helper does not start services or migrate production.

The native operating-system picker through the ordinary installed broker, combined release regressions, packaging, installed user workflows and real ChatGPT agent use of the new importer remain unqualified. The folder uniqueness fix must accompany any future directory-upload release; the already frozen 0.44.1 artifact predates it and remains uninstalled. Fresh human ChatGPT authorization remains necessary for pending live checks. Skills/hooks/local-server plugin execution, OAuth-only plugin connections, publisher signatures, remote marketplace installation and in-place upgrades remain separate work.
