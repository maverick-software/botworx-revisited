# Windows action reviews

October 17, 2026 · 0.42.1 installed private release

Windows input reviews now lead with the proposed action, followed by the shared window and target. Window and target labels stay on one line; their full values remain available in the title tooltip and the expandable technical details. Typing shows the exact literal text in a bounded, scrollable block. Key commands have a separate keyboard label. Clicks identify the mouse button and double-click behavior, scrolling shows direction and wheel amount, and dragging shows its start and end coordinates with a line over the screenshot.

The screenshot and target marker remain visible before approval. The consequence of sending input is stated next to the review. Raw arguments and the full tool description are available under **Technical details**. Existing Approve and Deny controls, window permissions, and input execution rules are retained.

Image readiness is now associated with the exact snapshot identifier. Replacing a review with a different snapshot disables approval until that image loads. A delayed response from the previous image cannot enable the new review. Expired or undisplayable images keep approval disabled while denial remains available. Saved, completed reviews display their action and exact text without requesting a new live preview or offering to repeat the input.

## Verification

The component workflow exercises all five Windows input types in an isolated Electron window using a fixture bridge. It checks literal Unicode and HTML-like text, long labels and text, keyboard approval and denial, delayed and replaced snapshots, expired and broken images, and saved reviews. Dark, light, and narrow layouts are inspected for horizontal overflow. These checks exercise review behavior; they do not send operating-system input or model requests.

The existing browser-pointer review and computer-sharing interface checks also pass, along with 17 computer-service, capture, and persistence regressions. The desktop build includes both desktop and renderer TypeScript checks. All 994 compiled backend modules exactly match qualified 0.42.0; this release changes the renderer and version metadata. The earlier real Windows input and both-provider evidence remains documented in [Windows capture and input](windows-capture.md).

Installed 0.42.1 was launched from a temporary directory with the development runtimes absent from its search path. Its review check opened the retained real-provider conversation and inspected all eight saved actions, exact Unicode text, key commands, and technical disclosures. Expired previews and window grants remained unusable. Reload preserved the four saved messages and both provider connections, with no new input or inference. Installed navigation and complete packaged-resource fingerprints passed. Both original accounts, passwords, roles, all 93 existing conversations and 304 messages, and all 45 migrations were retained. The normal app window was reopened, with all six required native Supabase services healthy.

At the 0.42.1 checkpoint, expanded completed results still showed substantial observation JSON. Installed 0.42.2 adds concise receipts, saved screenshots, a technical disclosure, and status-specific saved-review wording. See [Saved Windows results](windows-results.md). Full desktop parity remains ongoing.

The 0.42.1 evidence is recorded under `.supabase/desktop-computer-review/`. Windows-shell shortcut and cold-backend startup were subsequently qualified in [0.42.2](windows-profile.md). Broader permissions, Windows application/display coverage, standard installation-location and clean-machine/reboot qualification, browser, voice, and desktop parity work remain open.
