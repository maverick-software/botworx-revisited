# Embedded documents in the agent browser

October 17, 2026. Agentopia 0.43.4 added document-scoped controls for forms embedded inside a browser page; they remain installed in 0.43.5. The actual source and installed engine checks passed, including all 33 scenarios again in installed 0.43.5. A fresh model-driven workflow also passed two real ChatGPT OAuth turns: one live embedded document and parent session, original and edited file bytes, exactly one upload and valid submission per turn, prior receipt recall and saved history. The desktop parity goal remains active.

A page can put a form in a separate browser document, commonly called an iframe. Previously, Agentopia's page snapshot omitted those controls. An agent can now list the page's visible embedded documents, inspect one, and use its returned references to enter text, click, select an option, send a declared key, scroll, or attach reviewed files. Both the actual Codex harness and the existing provider broker receive the same browser tools.

`browser_snapshot` includes the first 50 document references. `browser_frames` reads additional pages without expiring earlier valid references. Each entry includes its address, owner-provided title, depth and an available parent reference. `browser_frame_snapshot` reads that document and selects its controls for subsequent input. Hidden documents are excluded. Text field values and passwords remain absent from text snapshots. Private runtime window names are never used as document labels.

The implementation supports same-site and cross-site documents, nested documents, frames inside closed web components, and blank or source-content documents. Chromium sometimes runs a cross-site frame in a separate process. Agentopia attaches only to frames discovered within the conversation-owned tab, establishes an isolated inspection context in the selected document, and releases temporary inspection sessions and remote objects. Navigation watchers are bounded and disappear with the tab.

## Input and review

Reviews identify both the outer page and the embedded document, including its address, title, selected control and proposed input. File reviews retain the filename, size, content fingerprint and destination. File selection requires approval even with Full access. A changed file or field must be reviewed again.

Control positions are mapped through each enclosing frame, including scaling, rotation, perspective and browser zoom. The selected control and its enclosing frames must be unobstructed. Text and key input verify the complete focus chain. Scrolling chooses an unobstructed position in the selected document, avoiding a nested document or form control that would receive the wheel event instead.

References include the identity and navigation history of the document and its ancestors. Reloads at the same address, history changes that return to the same address, parent navigation, and debugger reconnection invalidate old references. Positioning is followed by another document check before input. A frame changing during review requires a new snapshot. No uncertain click, upload or submission is replayed automatically.

## Source qualification

Both desktop typechecks and the packaged frontend build passed. All 245 regression checks passed with the installed application closed and its managed backend stopped. The account and history audit afterward preserved both accounts, passwords and roles, all 98 existing conversations, 328 messages and 45 migration checksums.

The new actual Chromium workflow passed 33 scenarios without model inference. These include control and file operations in six document arrangements; separate-process and nested forms; component-hosted and sandboxed source-content frames; hidden and covered documents; transformed geometry and zoom; focus redirection; selected-document scrolling; changed documents and ancestors; history round trips; debugger reconnection; an unrelated disappearing frame; cancellation cleanup; a 58-frame paginated catalog; another-tab rejection; and cleanup when a tab closes. The existing ordinary-browser, form-input, file-upload, component-control, component-upload and visual-pointer workflows also passed.

The source checks use real Chromium, selected local files and independently verified HTTP file receipts. Their application store is controlled and inference is absent. Live provider verification is recorded separately so those checks do not imply model-driven coverage.

## Boundaries

The installed release extends reference-based browser controls. A subsequent source change binds visual pointer input to actual embedded controls and passes separate-process, nested, scaled and zoomed frame checks; packaging and installed/model-driven qualification remain pending. [Visual frame input and evidence](browser-frame-pointer.md). Embedded `data:` and `blob:` addresses, directory uploads and custom non-native choosers remain outside the qualified scope. General website authentication and sensitive fields continue to require manual handling under the existing policy.

Personal Chrome consent, voice, wider Windows/display and skills coverage, remaining interface parity, clean-machine installation and a full Windows reboot of this release remain further qualification work.

## Repeatable checks and evidence

`npm run desktop:test:browser-frames` exercises actual Electron/Chromium without model inference. `AGENTOPIA_BROWSER_MODULES` can select an installed archive's build directory; `AGENTOPIA_BROWSER_FRAMES_OUTPUT` selects a fresh output directory. The previous installed archive reproduces the absent frame tools and omitted embedded controls.

`prepare-frame-workflow.mjs` prepares a benign owned report and a temporary loopback website. `test-live-browser-frames.mjs` selects that report with the native Windows picker and checkpoints before each request and approval. Routine runs now use ChatGPT OAuth for both turns. Its explicit OpenRouter option is reserved for provider-specific qualification. The website records actual bytes, trusted form input, document identity and the parent session cookie. Existing paid checkpoints must be inspected by request ID; never rerun them to recover an unknown outcome.

The first model-driven attempt stopped at an upload review because its verifier expected the wrong card label; no file had been uploaded. Returning to the chat during recovery reloaded the embedded document, clearing its unfinished form. A later controlled upload was received, but its submission correctly failed the fixture’s state checks. Both known requests were cancelled, retained and archived; their owned tab/reference/cookie and fixture were cleaned up. They do not establish a completed form workflow. The verifier now uses the proper review cards and preserves the live document on failure. Fresh qualification subsequently passed using ChatGPT OAuth for both turns. The site recorded one document, two valid transfers, two valid submissions and two valid parent acknowledgements, with zero violations. Exact native thread/request IDs and cleanup evidence are in `.supabase/desktop-browser-frames/live-oauth-qualified/evidence.json`; both accounts and all prior history passed the data audit. The earlier cancelled attempts remain preserved.

Private evidence is retained under `.supabase/desktop-browser-frames/`, including source results, regressions, data fingerprints, previous installer/archive and update preparation. The retained original backend and recovery credentials are preserved.
