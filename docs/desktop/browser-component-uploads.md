# File uploads inside browser components

October 17, 2026. Installed and qualified on this Windows computer in 0.43.3. The broader desktop parity goal remains active.

The embedded browser previously found ordinary file inputs through the document query API. That query did not enter web components, so an agent could read a component's visible controls but could not discover its file field. In addition, a component's `aria-labelledby` identifiers were resolved in the outer document, which could show the wrong field name during review.

The browser now searches with Chromium's DOM protocol and validates each result in its isolated execution context. It resolves label identifiers inside the field's own document or component root. Nested and closed components are supported, including hidden native file fields. Snapshots expose at most 50 validated fields and report omissions. Protocol search handles are discarded after success, failure or cancellation. The pinned Electron implementation was tested directly; the [Chrome DevTools protocol definitions](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/DOM.pdl) describe the underlying search operations.

Uploads retain the existing review of destination, field name, filename, byte count and content fingerprint, including Full access. The original selected file is re-read before transfer; changes made during review require another review. The browser sends a temporary copy with its original filename. Ordinary and component fields use the same quotas, protected-path exclusions and cleanup. Fields inside frames are omitted; moving an approved field into a frame invalidates the operation. General frame interaction, directory uploads and custom non-native choosers remain outside this change.

## Verification

The old installed 0.43.2 reproduced missing open, nested and closed component fields and incorrect outer-document label resolution. A stronger baseline waited for both same-origin and foreign-origin frames before observing native search results.

The actual source Chromium engine passed 13 scenarios: ordinary Unicode file transfer; component discovery and labels; explicit review under Full access; original, edited and multiple-file byte verification; changed-label refusal; clearing without a transfer; disabled and directory restrictions; moving a field into a frame; isolated execution against page prototype overrides; search-handle cleanup after failure and cancellation; and the 50-field limit. Existing ordinary upload, browser, form input and 15 component-control scenarios also passed.

All 241 automated checks passed with the installed application closed and its managed runtime stopped. An earlier complete run also passed, but its initial app-close observation had not finished. The test runner now refuses to start while Agentopia is open; an actual running-app refusal was verified before the final properly sequenced run. Neither the guard nor its negative check terminates applications or starts a backend.

The same 13 component-upload scenarios passed against the installed archive. Package comparison found exactly two changed compiled modules (`agent-browser.js` and `browser-input.js`); the other 996 compiled modules were byte-identical. All 6,137 delivered files matched the prepared image, including 45 unchanged database migrations. The installer completed on its first attempt after a verified five-file database/native-history backup. Protected credentials, backend binding and all 795 saved browser/profile files matched before and after installation.

## Actual provider workflow

The real Windows Open dialog selected one benign owned report. Actual Codex 0.163.0 used ChatGPT authorization with GPT-6.1 Sol High to upload it through a hidden field in a nested component. The loopback website received and verified the original filename, size and content fingerprint. After editing that same owned source file, the composer switched to OpenRouter and the same model/effort. The second request was sent through the chat interface and uploaded the new bytes through a hidden field in a closed component. Both uploads required visible approval despite the existing Full grant.

The independent website recorded exactly one valid upload per provider with the same session cookie and tab. OpenRouter recalled ChatGPT's first receipt after the fixture removed it from the page. The submitted OpenRouter message retained the selected file, Codex harness, provider namespace, model and High thinking level. Reloading retained the messages unchanged.

Two verifier stops happened after the completed ChatGPT turn and before any OpenRouter request. The verifier incorrectly read global composer defaults to check a per-chat attachment; those defaults intentionally omit file references. The corrected verifier checks the visible attachment, saved chat draft and submitted message. Recovery checked that only the first two messages and one website upload existed, then continued only the unsent second turn. The first request and upload were never replayed. All intermediate checkpoints and the original failure evidence are retained.

The owned browser tab was closed, only its cookie was expired, the file-reference list and original interface were restored, and the verification chat was archived. Both fixture processes exited. Normal shutdown stopped only the selected runtime; the retained original runtime stayed stopped. A normal desktop-shortcut cold launch then passed with six healthy native services, authentication, both saved provider replies/native thread IDs and debugging disabled.

Both existing accounts, password fingerprints and roles, all 97 earlier conversations and 324 messages remain unchanged. The single archived verification conversation adds four messages, leaving 98 conversations and 328 messages in total. Original recovery credentials also remain unchanged.

Private evidence is retained under `.supabase/desktop-component-uploads/`: the final 241-check regression log, source and installed engine results, resource comparison, backup/update verification, data fingerprints, `live-installed/final-evidence.json`, independent server receipts, and normal cold-start result. The first request is `ec425bfb-cd2f-47b4-b406-66d8a3729496`; the sole second request is `836ab6e8-bdb7-4080-8037-bbbb9be6a964`, in conversation `73867ca4-c541-4ffa-9451-09d0dfed9f9c`.

This qualification uses a controlled website and this Windows installation. General frames, custom/directory choosers, personal Chrome consent, broader Windows/display and voice coverage, remaining interface parity, clean-machine installation and a full Windows reboot of this release remain further work.

## Repeatable commands

`npm run desktop:test:browser-component-uploads` uses actual Electron/Chromium and real filesystem files without model inference. Its output directory is unique by default. `AGENTOPIA_BROWSER_MODULES` selects an installed archive's build directory. `AGENTOPIA_COMPONENT_UPLOAD_OUTPUT` selects a fresh evidence directory. Existing paid workflow checkpoints must be inspected rather than replayed.

The live workflow uses `prepare-component-upload.mjs` to create a benign owned file and persistent loopback fixture, followed by `test-live-component-uploads.mjs`. The latter waits for the real Windows file picker. It checkpoints before each request and approval, never repeats a submission automatically, and retains the controlled fixture on failure so outcomes can be inspected by request ID. The fixture independently records actual multipart file bytes before acknowledging a receipt. It expires its own cookie and stops after successful cleanup, with a 45-minute maximum lifetime.
