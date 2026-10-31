# Word canvas zoom stability — October 30, 2026

The Word preview calculated its Fit width scale using the width available after any vertical scrollbar. Near the page-height threshold, 70% made the page overflow vertically. The scrollbar then reduced the available width enough to select 68%. At 68%, the page fit vertically, removing the scrollbar and restoring the width that selected 70%. The body resize observer repeated this cycle without user input.

The production renderer reproduced the exact 68/70 cycle in a fixed 620 × 750 iframe with standard Windows-style scrollbars enabled. The original check failed with repeated resize-triggered render reports. Headless Chromium normally hides scrollbars, so this regression test explicitly enables them.

The Word viewer now reserves a stable scrollbar gutter on its root element whenever a Word wrapper is present. This keeps the measured width consistent across that vertical overflow threshold. It changes no zoom controls or document content, and does not apply to PDF or presentation previews.

The focused regression check verifies stable Fit width at the failing dimensions, settlement after narrowing and widening the pane, preservation of manual 100% zoom on resize, and settlement when returning to Fit width. The existing UI typecheck and build passed. Evidence: `F:/Sylvana/verification/provider-goal/word-zoom/before.json` and `evidence.json`.

The same installed desktop session created `Max Admin Verification.docx` using the Max service. Clicking its saved reply filename opened the actual formatted Word canvas. Independent ZIP/XML validation confirmed a valid Word file with one three-row table. The cloud audit confirmed the signed-in platform administrator `mail@enspyredigital.com` had no subscription and no purchased resets; all four Max requests settled with ZDR enabled and zero charged credits. Provider cost was $0.0706894. Evidence: `F:/Sylvana/verification/provider-goal/max-document/`.

Installed acceptance: the restored Max Word canvas displayed 68% in repeated observations more than six seconds apart at the previously failing pane width. The installed zoom menu also successfully selected 100%. The installed CSS fingerprint is recorded in `word-zoom/installed-style.json`. Native acceptance and the final canvas screenshot are recorded alongside the Max document evidence.
