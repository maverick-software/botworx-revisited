# Visual input inside embedded browser documents

October 17, 2026. Included in installed 0.43.7. The installed resource audit matches the qualified browser modules and renderer. Ordinary desktop startup passes and the application is open and signed in. Live model use of this new coordinate-review path remains a separate qualification. See [the coordinated release](maintenance-0.43.7.md).

## Finding and behavior

The installed browser could dispatch a screenshot-coordinate click into a separate-process iframe, but its review inspected the outer iframe element. The controlled baseline prepared clicks on four protected field types without inspecting those inner fields. It also dispatched a benign click after the reviewed embedded button was replaced by an identical-looking element. No credentials were supplied and no protected-field input was dispatched during the baseline.

Visual reviews now inspect the actual control in its own document. Coordinates follow each enclosing content quadrilateral, including nesting, scaling and browser zoom. Frame-owner hit checks establish that the selected embedded document is the document under the pointer. The same isolated inspection used for ordinary pages then checks the selected control. A hidden or unavailable inner document cannot fall back to a review of its iframe container.

Reviews bind document identity, ancestor navigation history, target identity and the existing screenshot regions. Replacing an embedded control with identical markup requires a new review. Same-address history round trips expire the screenshot and prepared operation. Unrelated frame navigation remains usable for a stable main-page target. Closing the tab clears pending frame review records and navigation watchers.

Password, verification, payment and native file fields retain their dedicated-control requirements under both Default permissions and Full access. The inline review shows the embedded document's address and title alongside the actual control. The screenshot marker, preview-readiness requirement, exact input, cancellation and single-use capture behavior remain in place.

## Verification

The dedicated real Electron/Chromium workflow passes 13 scenarios. Its recorded process identifiers establish that the outer page, cross-site frame and nested frame cross Chromium process boundaries. It covers protected fields under both permission modes, trusted clicks with independent loopback HTTP receipts, identical-looking replacement, nested input, wheel scrolling, history changes before and after review, scaling, same-process frames, frames inside closed components, zoom, curved canvas drag and close-time cleanup.

The existing 33 embedded-document scenarios pass, including selected-file uploads and reference-based controls. The ordinary visual-pointer workflow also passes, covering clicks, double/right clicks, hover, dragging, two-axis scrolling, scoped changes, provider/mode boundaries, screenshot expiry, zoom, pinch scaling, downscaled captures, cancellation and uncertain-input protection. Eight geometry/input unit checks pass. Main-process isolated compilation and renderer typecheck pass.

The actual rendered review passes preview readiness, embedded-destination visibility, escaped site/target text, exact approval, expired-preview denial and keyboard interaction, including dark, light and narrow layouts. The narrow screenshot was also visually inspected.

These checks use controlled local pages and isolated application profiles, with no model inference, production database changes, application restarts or paid provider requests. They do not establish installed behavior or model-driven behavior for the new implementation. Further transformation, display, site and interaction coverage remains part of the broader desktop goal.

## Repeatable checks

Run `node scripts/desktop/test-browser-frame-pointer.mjs` with `AGENTOPIA_BROWSER_MODULES` pointing to the compiled build directory and `AGENTOPIA_FRAME_POINTER_OUTPUT` selecting fresh private evidence output. `AGENTOPIA_FRAME_POINTER_BASELINE=1` records the old container-only behavior against an installed archive without dispatching input to protected fields. The test fixture closes its own tabs and process and stops its loopback server.

`AGENTOPIA_BROWSER_MODULES` also selects isolated modules for the existing frame and ordinary pointer workflows. `AGENTOPIA_POINTER_UI_OUTPUT` selects an isolated rendered-review output directory. Evidence is retained under `.supabase/desktop-frame-pointer/`, including `baseline/evidence.json`, `source-final/evidence.json`, `existing-frames/evidence.json`, `ordinary-pointer-history-scoped/evidence.json`, `review-ui/evidence.json`, `units.log` and `evidence.json`.

The persistent-workspace-agent chat owns the next shared integration/build window. This source change and the saved-session persistence fix must be included in the combined regression, packaging and installed startup checks before they are reported as installed.
