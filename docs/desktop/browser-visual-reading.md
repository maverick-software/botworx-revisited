# Visual reading in the Agentopia browser

Installed private release **0.37.0** — October 17, 2026. PostgreSQL and native Supabase remain the database/backend.

Agents can use `browser_screenshot` to receive the visible viewport of their conversation-owned Agentopia browser tab as an image. The existing native Codex MCP transport delivers the image separately from the text metadata. The screenshot appears inside the response's expandable activity and opens in a local preview.

## Using it in chat

Ask an agent to open a page in Agentopia's browser and inspect it visually. Review the initial visit and the separate image-sharing request. Expand **Worked for…** in its reply to inspect the captured image, then select the thumbnail for the full preview.

To continue through the other connection, change the composer provider/model in the same chat and ask the agent to use its existing browser tab. The second provider needs its own image-sharing approval. The tab retains its page and website session, and the preceding conversation remains available to the agent.

## Sharing and behavior

- Visiting and reading a site retains its existing review flow. Sharing its pixels asks for separate approval for each site and provider in that tab, including Full access. Closing the tab ends these image-sharing grants.
- Images can include visible form contents. The approval states that the image is shared with ChatGPT or OpenRouter and saved in chat activity. Text snapshots continue to exclude editable values.
- Other users' tabs, other conversations' tabs, manually opened tabs, and HTML canvases cannot be captured by this agent tool. Chat only and Files only permissions exclude it. Plan mode permits this read operation.
- Images contain the visible viewport, with the longest edge bounded to 1,600 pixels and JPEG output capped at 1,400,000 bytes. Long pages can be read by scrolling and taking another screenshot. Actionable element references still come from `browser_snapshot`.
- There is no automatic provider fallback. A model must support image input to interpret tool images.
- Images and page text are untrusted reference material. Screenshot metadata supplies the tab, address, title, capture identifier and dimensions; encoded image bytes stay out of the displayed JSON text.

## Rendering and persistence

Windows returned an empty image when Electron's `capturePage` was used on a WebContentsView that had never been drawn. A controlled diagnosis compared the hidden view with the same live view attached to a temporary hidden BrowserWindow. The latter produced the expected pixels.

The capture implementation temporarily hosts hidden tabs in that hidden window. It retains their actual document, cookies, history and viewport dimensions. Visible tabs use their current surface. Hidden/minimized application windows also use the hidden host. Completion or cancellation restores the view's size, visibility and position and disposes the helper window. User layout changes interrupt that capture. Navigation and account/conversation checks run before and after capture; a changed page or revoked identity cannot produce a delivered image.

The browser capture API is documented in [Electron's webContents reference](https://www.electronjs.org/docs/latest/api/web-contents#contentscapturepagerect-opts). The Windows rendering behavior and restoration are established by the project's controlled Chromium tests.

Migration `0041-browser-screenshot-receipts.sql` adds a receipt index scoped to request, native thread and provider call identifier. Repeated delivery cannot take a second capture for the same call. Existing migrations remain unchanged. Screenshots are saved with existing tool activity and conversation history.

## Verification evidence

- `.supabase/desktop-browser-vision/engine/evidence.json`: actual Chromium image bytes and native image conversion; per-provider/site approvals; account/conversation/mode restrictions; cancellation before and during capture; restoration; navigation and closed-tab checks; large viewport limits; fresh hidden document changes; hidden/minimized application capture.
- `.supabase/desktop-browser-vision-core.log`: 198 regression checks passed, including screenshot review, denial, child-thread receipt separation and duplicate-call protection.
- `.supabase/desktop-browser-vision-actions.log`: existing real browser input, page sharing, ownership, stale/covered target and cancellation checks passed.
- `.supabase/desktop-browser-vision-data.log`: existing profile/download checks passed, including account isolation, persistent/temporary sessions, exact bytes, pause/resume, cancellation, history and scoped metadata. Save choices in that test are controlled.
- `.supabase/desktop-browser-vision/live/evidence.json` and `read-only-verification.json`: actual ChatGPT and OpenRouter requests used Codex 0.163.0 and GPT-6.1 Sol at High. They read different random eight-character codes and blue-circle/red-square shapes drawn only in canvas pixels. The codes were absent from non-image tool results. The second request kept the authenticated tab, advanced the card exactly once through a reviewed click and recalled the first code. Both image-sharing approvals and actual native MCP image parts were verified. Existing checkpoints prevent resubmitting these paid requests.
- `.supabase/desktop-browser-vision/installed/evidence.json`: the actual installed executable opened both native/host screenshot previews, retained the provider/model choices, kept compact expandable history and preserved the saved images through restart. Dark/light and minimum-width layouts passed. Its working folder was temporary and its command search path excluded development programs. No installed verification repeated inference.
- `.supabase/desktop-browser-vision-core-final.log`: the final 198 regression checks passed with no failures, skips or cancellations after the final capture changes.
- `.supabase/desktop-browser-vision/release/release-summary.json`: actual installer upgrade, packaged resource integrity, original-data comparison and six healthy required native services. The disposable upgrade fixture retained its account, project, protected MCP credential, instructions, conversation, lifecycle and message order, then was removed.

## Installed artifact and preservation

Installer: `desktop/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe`, 1,502,472,192 bytes. SHA-256: `6bd0c9638866f1c6079565a0730dd249477276c505a2f6201a340debaf5f307a`.

The installer exited successfully. Its installed resources match 988 compiled modules, 12 UI files, 41 migrations and the pinned Codex, Chrome, computer, script and command runtimes, including notices and the native patch guard. Both original accounts/passwords, roles, all 86 earlier conversations and 274 earlier messages were preserved. All 40 prior migration checksums match. The new archived visual test brings the current total to 87 conversations and 278 messages. The 0.36.0 installer, backend archive and updated history interface remain backed up under the release evidence directory. Agentopia was reopened normally with database, REST, authentication, realtime, storage and functions healthy.

General Windows input, native Save As interaction, Chrome consent with an existing personal profile, clean-machine/reboot qualification, agent-owned live browser-tab recovery after full restart, browser coordinate/select/keyboard/upload controls and broader desktop parity remain open. This release qualifies visual reading, sharing, saved previews and provider continuity within the live tab; it does not close the full parity goal.
