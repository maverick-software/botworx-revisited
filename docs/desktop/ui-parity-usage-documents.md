# Usage, settings and document preview comparison

The October 19 review directly navigated ChatGPT Desktop General, Appearance, Usage & billing, Browser, Voice, Keyboard shortcuts, Notifications, Data controls and Storage. The same existing Sample_Document.docx and Sample_Document.pdf were opened in its right pane, without sending a model request or changing reference account settings.

## Changes prepared for 0.44.45

- The composer has no provider usage footer. Account menu > Usage opens Usage & billing, with fixed web destinations for ChatGPT plan usage and OpenRouter Activity. Connection status comes from the current Agentopia account; provider allowance figures are not invented.
- Settings fills the application below its title bar, retaining the application rail. A searchable left navigation and larger content headings replace the centered modal. Personal, workspace and administration controls remain accessible. Archived chats has its own page, and keyboard shortcuts can be searched. Escape and Back return to the chat and restore focus.
- DOCX previews render original styles, headings, lists, tables, images, explicit page breaks, headers and footers as white document pages. PDFs render original page graphics, including scanned pages, with page navigation and zoom. Extracted text remains separately available for search and AI context.
- The document frame has an opaque sandbox origin, no account/tool bridge, and a content policy restricting resources to bundled assets and embedded data. Original file bytes reach the visual UI only after the existing owner, path, size, linked-file and worker checks. AI reads continue to receive extracted context. Office archive expansion is bounded across all parts.

## Evidence and limits

The current frozen image identity is recorded in candidate-04445/package-proof.json. The first candidate was withheld before installation because secondary dialogs could appear behind the full-page Settings surface; its installer and proofs remain under candidate-04445-withdrawn-layering. The corrected candidate places Settings below secondary dialogs and adds an actual open/close workflow. Qualification is recorded in .supabase/desktop-platform-release/candidate-04445/qualification.json: 63 local backend checks and eight actual component workflows against the frozen source and viewer assets. These establish usage routing, navigation, original-byte preservation and account ownership, document graphics, real page changes, scanned-page pixels, text fallback, isolation and frame cleanup. No paid model request was made. Installer and ordinary-account verification are separate gates.

The first backend attempt included database-dependent integration tests without a database URL. Those tests stopped at client creation; the separate local test run then selected the relevant 63 checks that do not require a database. The original failure log is retained under the first qualification directory. This update makes no SQL migration or provider transport change.

DOCX HTML layout is an approximation of Word pagination, rather than a full Word editing engine. PDF search currently uses the existing extracted-text view. Spreadsheet and PowerPoint previews still use extracted grids/text. Document editing, OCR, reference-level annotations and print controls remain open requirements.

The reference settings contain additional working features: configurable notifications and shortcuts, fonts/colors, browser destination and download preferences, browser history/permissions, and other platform-specific integrations. This release improves the settings shell and the controls already backed by Agentopia. It does not establish complete settings or product parity. The broader acceptance goal remains unfinished.

The expanded reference review distinguishes local controls from cloud services. Reference Notifications contains push/email choices for Codex, group chats, library sharing, responses, tasks and usage. Agentopia must implement appropriate local notification controls and real service integration before offering corresponding switches. No reference preference was changed.

Reference Storage separates chats, subagents, archived chats and working copies, with explicit review before cleanup. Agentopia still needs an equivalent storage breakdown and cleanup workflow. The review did not delete or archive any reference data.

## Installed acceptance

The corrected 0.44.45 is installed through normal Explorer and passes ordinary-account and cold-reopening verification. Both web dashboard actions loaded their intended pages. The installed original DOCX/PDF previews retain layout, the secondary Downloads dialog stays above Settings, and both document tabs return after closing and reopening through the normal launcher. The full data comparison and subsequent cold-start counts preserve all saved accounts/chats/messages/requests; no paid AI request was made. See [installed release evidence](platform-release-0.44.45.md).

Rendering references: [docx-preview official documentation](https://github.com/VolodymyrBaydalka/docxjs) describes its HTML-based layout and pagination limits; [Mozilla PDF.js documentation](https://mozilla.github.io/pdf.js/examples/) documents visual PDF page rendering.
