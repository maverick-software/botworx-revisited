# Windows document links in chat — October 30, 2026

The reported responses contained literal Markdown such as `[Sample Document.docx](C:\Users\charl\Sylvana Files\...\Sample Document.docx)`. The unescaped spaces prevent CommonMark from recognizing the destination as a link. Consequently, `ChatLink` and the existing canvas opener never received the click target.

`remark-windows-file-links.ts` repairs drive-absolute Markdown links inside prose text nodes. It preserves the original path separators and encodes filename characters, then emits a normal Markdown link node handled by the existing `ChatLink`. It preserves code examples, existing parsed links, web links and incomplete syntax. Native and ordinary conversation renderers share the plugin, so saved responses receive the correction without changing stored messages or calling a model again.

The renderer does not grant file access. The existing workspace link resolver still verifies account ownership, retained references, paths and supported document handling. The installed backend archive is unchanged.

The focused UI check first reproduced the literal Markdown output, then verified clickable filenames, the exact encoded canvas-handler destination, keyboard activation, parentheses, hash and percent characters, code examples and existing links. Evidence: `F:/Sylvana/verification/provider-goal/windows-file-links/evidence.json`.

Native verification exposed a second issue during development: changing backslashes to forward slashes made the offered-link ownership check unable to match the saved reply. The renderer now keeps the original separators; decoding the emitted URL reproduces the exact offered Windows path. The regression check covers this match. No file-access checks were weakened.

Installed acceptance: clicking the filename in the existing conversation opened the formatted Word canvas with the actual heading, synthetic paragraph and three-row table visible. No additional model request was made. Native evidence and screenshot: `F:/Sylvana/verification/provider-goal/windows-file-links/native-acceptance.json` and `installed-canvas.png`. The normal maintenance installation preserved the closed profile exactly, account identity and saved-work counts.
