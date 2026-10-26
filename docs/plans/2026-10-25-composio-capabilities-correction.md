# Composio catalog and agent capabilities correction

User-requested correction after release 0.44.79. The installed baseline is preserved while the correction is implemented and verified.

## Required user outcome

- Plugins → Composio browses Composio's full published service catalog with readable names, tool information and connection status. Connecting a service starts from this page through an explicit user action.
- An existing account authorization is reused and refreshed by the application. An agent does not need a chat instruction or a composer chip to initialize or enable an assigned connected service.
- Saved agents and new-agent drafts select individual connected services as capabilities. The same capability scope applies to preview, native/compatibility execution and inherited work. Account ownership, explicit disables, ordinary tool reviews and chat permission limits remain enforced.
- Listing services/accounts never initiates authorization. Actual historical Connect schemas show that management actions are nested in each toolkit object; a default action can initiate authorization. A model instruction saying “list” does not replace the actual protocol argument.
- Transient local service loss is distinguished from a conflicting retained draft. Recovery preserves journals, resumes only verified existing services when safe, and never replays an uncertain write or model request.

## Implementation boundaries

Use the existing plugin records, agent grants, creation grant snapshots, MCP OAuth engine and execution services. Publish the service catalog from actual first-party metadata, with provenance and validated pagination. Protect tokens locally and keep identifiers/credentials out of model-controlled arguments. Preserve existing Composio project-key connections alongside browser authorization.

Map old umbrella grants only against verified connected service information. A partial catalog page or search result cannot be treated as a complete account inventory. Existing grants and historical requests remain recoverable; newly connected services must not silently acquire unrelated agent permissions.

The runtime connection repair must not recreate the Broker, provision a new database, reset encryption roots, clear a draft, or retry a dispatched mutation. Normal request ownership and maintenance gates remain in force.

## Acceptance and delivery

Verify the actual Connect tool schema and read-only listing shape, catalog pagination/search, explicit service authorization path, and service capability availability without chat setup. Test saved/new-agent and preview scopes, revocation, cross-account isolation, generic meta-tool bypass attempts, transient local outages and retained drafts. Keep image generation disabled and provider choices unchanged.

Before installing the correction, capture a fresh consistent baseline and verified application recovery, qualify the exact packaged upgrade and cold reopening, verify the installer payload, then inspect the corrected installed workflow. Report any authentication handoff or provider limitation explicitly. Existing accounts, chats, credentials, agent definitions and workspace references must remain preserved.

## Source verification before release 0.44.80

The merged service adapter, capability and OAuth checks pass 54 tests, including token-refresh ownership races and the two background synchronization/recovery interleavings. Both TypeScript targets pass. Seven Electron UI checks cover browsing without chat initialization, explicit QuickBooks connection, multiple-account selection, terminal partial-scan status through a search, retry, narrow windows and expired authorization. The published catalog contains 1,645 service definitions; every definition passes the canonical capability-package checks.

The merged runtime reliability runner passes 42 JavaScript and 15 Python checks. It first reproduces the retained rejected draft-read problem against accepted release 79, then verifies the correction. The release tooling checks exact updater paths, original-row comparisons and narrow protected-setting renewal rules. No live model request or production restart was used for these checks.

The broader preview fixture suite retains the same 18 failures observed against the accepted baseline. They were not counted as passing or used to claim full-suite success. Focused preview binding and authority checks pass. The unchanged importer shutdown fixture also rejects its existing ANALYZE command; directly affected process-record checks pass.

The saved provider schemas establish the nested list action, direct tool account selector and argument validation. Public provider documentation does not establish that a missing account array means disconnected. Those responses therefore retain an unknown status and prevent complete-inventory conversion; the UI provides an explicit retry. Real account listing and installed-workflow verification remain separate delivery checks.

## Packaged verification

The first exact release80 candidate (`1792983634749`) completed the real schema87-to-88 upgrade, verified its automatic complete recovery backup, compared 1,336 original rows across 144 tables, and reopened without replay. A real stopped-service test then exposed a scheduler deadlock: a pending read counted as active work and prevented recovery. Commit `95d5eb3` tracks active stage/claim/finalization work separately, invalidates the old read generation during recovery, and retains the original backup barriers. The corrected source passes 65 scheduler/reliability checks, 54 Composio/OAuth checks, 15 Python checks and both type checks.

The corrected candidate is `1792984969940`, image SHA-256 `16e39dc85d2debe7d1ddc4fd7db0621aa037d3ea0734928415bbec0ac0e37fa5`. Only `broker.js` and `task-scheduler.js` differ from the first candidate. SQL, runtime resources, interface and native dependencies match exactly. Incremental qualification retains the original upgrade evidence, captures a new complete QA backup through the packaged Broker/Runtime backup fence, and verifies both warm and cold opening against that fresh baseline. No schema marker was rewritten and the upgrade was not artificially repeated.

The final stopped-service run preserved all 145 selected public/Vault/account table summaries, protected-setting fingerprints, four root bindings, the same Broker/runtime objects, exact mounted editor fields and recovery-journal bytes. One verified existing-service resume succeeded with no provisioning, SQL writes or model/agent-action replay. QA subsequently closed with exit code0 and its runtime stopped; the ordinary release79 process stayed running.

The verifier required two corrections: sort table summaries because PostgreSQL can return UNION ALL branches in different order, and verify bounded sequential attempts on the same instance instead of requiring exactly one attempt. Regression checks reject altered fingerprints, overlap, changed bindings, provisioning and SQL writes. The original qualification and failed verification records remain preserved. The final optional screenshot capture timed out after the functional checks passed; an independent acceptance record rechecks their persisted results, normal cleanup, zero provider calls and the untouched ordinary process. This capture failure did not require another application change or another stopped-service run.

Evidence is under `.supabase/desktop-release80/1792984969940/`: `incremental-check/evidence.json`, `runtime-reconnect-1792985829769/functional-acceptance.json`, `outage-verifier-correction.json`, and the preserved qualification before the verifier correction. Installer construction started after these checks. Ordinary installation and live Composio verification are still pending at this point in the record.
