# Browser follow-up candidate 0.44.1

October 17, 2026. This is a separate, **uninstalled portable candidate** built after the frozen 0.44.0 installer. Installed Agentopia remains 0.43.7. No installer was generated for 0.44.1, and no production migration or provider inference was performed.

The candidate adds the reviewed whole-folder upload path and compact browser-activity display described in [directory uploads](browser-directory-uploads.md) and [browser results](browser-result-display.md). It retains 0.44.0's persistent-agent, provider and OAuth recovery implementation.

## Delivered files

All 1,009 compiled modules match the candidate's isolated compiled source. Compared with frozen 0.44.0, exactly six modules changed: `agent-browser.js`, `browser-input.js`, `browser-uploads.js`, `workspace-browser.js`, `workspace-tools.js` and `tool-service.js`. The other 1,003 modules are byte-identical. The minified interface is rebuilt from the copied source snapshot.

All 6,144 delivered resource files match the prepared resources. All 54 database migrations retain their existing contents. The packaged dependency inventory contains 2,232 files, all identical to 0.44.0, including its dependency metadata. The earlier 0.44.0 application archive was read back and still matches its frozen hash.

The 0.44.1 application archive's SHA-256 is `1c7dfe6d4c85dc2a5798dfc4d0032432205681936aed5542156f6176225c4838`. The source/package version remains 0.43.6 under the existing coordination agreement; only this private candidate identifies itself as 0.44.1.

## Qualification

Twenty-one actual Chromium scenarios pass while loading the browser modules directly from the packaged archive. An independent loopback server checks exact bytes and paths, including the complete 100-file boundary, empty files, Unicode, subfolders, closed components and cross-process documents. Cancellation, changed manifests, removed attachments, hidden/credential/protected/linked paths, budgets and cleanup are exercised.

Two additional presentation cases show that a visible browser view uploads in place without creating another window, and a minimized parent stays minimized while its original hidden view and bounds are restored after upload. Closing the temporary presentation window also cancels safely and retains the browser tab. These are actual native-window checks in a private fixture; ordinary installed-app presentation remains a separate check.

Six checks pass against the actual delivered, minified application interface with a controlled desktop bridge. The existing chat and unsent draft reopen; saved folder activity uses the compact result with optional relative paths; changing the active agent preserves the draft; subsequent sends retain the selected ChatGPT provider/model; historical attribution remains; retired agents cannot receive new assignments. These checks use generated data and controlled responses. They establish packaged interface behavior, without testing live model performance or database-backed tool recording.

The initial preparation stopped because private CommonJS metadata had been counted as an extra application module. Inspection found only that one extra metadata file, with no missing modules. All 6,144 copied resources were verified before moving the scope metadata to its parent directory and resuming the existing candidate. The original failure log and repair record are retained. An initial window-count observation used an unavailable fixture binding; the corrected fixture completed the 21-case packaged workflow. No product change or model request was needed for either verifier correction.

## Evidence and remaining work

The immutable candidate is under `.supabase/desktop-browser-followup/candidate-0441/`. Its `preparation.json`, `package-proof.json` and `qualification.json` record source scope, archive hash, module/dependency comparisons and qualification limits. Browser receipts are in `packaged-directory-presentation-qualified/evidence.json`; delivered-interface results are in `built-ui/evidence.json`. `metadata-repair.json` records the preparation correction. Earlier output and failures remain available.

Recheck the saved artifact with `node scripts/desktop/verify-browser-followup-release.mjs --inspect`. This reads and compares the archives and existing evidence without starting Agentopia, Supabase or a provider request. Build and packaging use separate private scripts; none changes the frozen 0.44.0 candidate or shared build output.

Required release work still includes fresh human ChatGPT authorization, database-backed tool approval/result/idempotency checks through an available permitted backend, actual provider-driven browser and agent acceptance, installer generation and a verified fresh backup before production migration. Installed navigation/history, account and credential preservation, cold startup, clean-machine installation and Windows reboot qualification remain open where not established by earlier releases. The optional rejected authentication/API fixture has not been restarted, and the earlier disposable PostgREST endpoint is currently unavailable.

The frozen 0.44.0 candidate retains its own exact-image live and installation gates. A successful check against either version must not be relabeled as evidence for another version's changed behavior. ChatGPT remains the routine live-test connection; this work used zero live ChatGPT or OpenRouter requests.

## Subsequent release correction

Later generated-record tests through the running production API verify actual folder approval/result persistence, denial, cancellation, revocation and child scopes. Concurrent delivery exposed a missing uniqueness constraint for `browser_upload_folder`; new source migration 0055 passes isolated actual PostgreSQL concurrency checks. This frozen 0.44.1 archive still has its original 54 migrations and does not contain that correction. It remains uninstalled and must not be promoted as a completed directory-upload release. A subsequent package must include and qualify 0055 before installation. Production remains unchanged at 45 migrations. [Exact storage evidence, fix and boundaries](plugin-file-import.md).
