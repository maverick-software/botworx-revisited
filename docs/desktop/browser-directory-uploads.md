# Browser directory uploads

Source development, October 17, 2026. This work follows the frozen 0.44.0 candidate and is **not installed**. Installed Agentopia remains 0.43.7. The separate 0.44.0 installer contains the persistent-agent and OAuth recovery work, without this directory feature.

## Behavior

The browser tool `browser_upload_folder` selects an attached folder, or a subfolder inside it, for a native HTML directory input. Its arguments identify the existing browser tab, current snapshot and upload-field reference, attached folder reference, and relative subfolder path. It preserves the folder's name and all nested file paths. An ordinary file field continues to use `browser_upload`; that tool can also clear a directory field with an empty file list.

Sending an attachment already authorizes its use as AI context. A website upload remains a separate external action and retains its inline review. The review lists the receiving website and embedded document, form destination, folder name, every relative file path and size. The list scrolls within a bounded panel. Full access retains this website review. Neither an original absolute path nor a temporary path appears in the tool result or review.

Folder selection includes every eligible file in its complete manifest. Hidden, credential, dependency, linked and protected application paths reject the whole operation. Nothing is silently omitted. Limits are 100 regular files, 20 MiB per file and 40 MiB total; the existing 100 MiB per-account temporary-copy budget remains shared with individual uploads. The inventory also limits depth and total items. Empty directories cannot be represented by a website's file selection; a completely empty folder produces an explicit error.

Before dispatch, the service checks the attachment's continued availability, every file's bytes and the complete folder inventory again. A new, removed or modified item invalidates the review. The website receives only staged private copies of the approved bytes. It can read or send them immediately, so selection does not establish remote acceptance. Uncertain operations are not replayed automatically. Copies stay available to the browser until its tab closes; restart cleanup and account quotas use the existing upload-storage lifecycle.

## Native view finding

Controlled probes against the pinned Electron 44.7.2 runtime reproduced a silent difference: `DOM.setFileInputFiles` populated a standalone BrowserWindow directory field, while a hidden WebContentsView acknowledged the command without populating it. Denying browser permissions did not reproduce the failure in the standalone window, and making only the child view visible did not resolve it. A presented native host did.

Directory dispatch therefore retains the actual browser view in a presented native surface until a fresh trusted change event and the expected native file list are observed. An already visible browser view stays in place. A hidden view uses a temporary, non-activating host and is restored afterward, retaining its document and website session. Closing that temporary surface cancels the operation while preserving the original tab. This display behavior still needs review in the ordinary installed application before release.

The implementation uses Chromium's actual directory selection, rather than assigning a synthetic file list. Chromium documents the file-selection protocol, and Playwright documents selecting a directory through an upload control. The Windows behavior above is established by the project's own reproductions. [Chromium protocol](https://chromedevtools.github.io/devtools-protocol/tot/DOM/#method-setFileInputFiles), [Playwright uploads](https://playwright.dev/docs/input#upload-files).

## Evidence and limits

Both canonical backend and renderer type checks pass. The isolated compiled source passes 19 actual Chromium scenarios. An independent loopback server verifies the exact file bytes and relative paths, including duplicate basenames, Unicode, empty files, selected subfolders, closed components and cross-process embedded documents. The full 100-file boundary transfers successfully. Other cases exercise changed manifests, attachment removal, cancellation, temporary-window closure, protected and linked paths, excluded hidden files, count/size limits, staging-path collisions and tab cleanup.

The real review renderer passes dark 720-pixel and light 360-pixel layouts. All 100 rows remain present and scrollable, with no horizontal overflow. The existing 13 actual component-upload scenarios and 33 actual embedded-document scenarios also pass with the new compiled modules. Fifteen existing local browser/workspace regression checks pass. One database-receipt regression could not initialize because its required Supabase URL was absent; it has not been retried against production or the other chat's rejected optional authentication fixture.

Evidence is retained under `.supabase/desktop-directory-upload/`: `promotion.json` records the eight source files' exact before/after hashes and their comparison to the frozen 0.44.0 source. `baseline/` preserves the original files. `qualified-engine/evidence.json` records the directory workflow. Renderer and existing component/frame evidence have separate output directories. Earlier failed probes and their diagnostic observations remain available.

The repeatable commands are `desktop:test:browser-directories` and `desktop:test:browser-directory-review`. The engine command accepts `AGENTOPIA_BROWSER_MODULES` to use an isolated compiled build. These checks make no live model requests and do not use production credentials or databases.

Remaining gates are the database-backed stable tool receipt, full regression/release packaging, installed UI and data-preservation checks, ordinary/minimized-window presentation, and one actual ChatGPT-driven folder upload. OpenRouter uses the same tool path; an additional paid request should be made only when connection-specific evidence is needed. No live inference has been used for this directory work.

## Subsequent storage verification

Generated records through the already-running managed Supabase API now verify actual saved folder approvals/results, denial, cancellation, agent revocation, duplicate recognition after a new service instance and independent child scopes. All generated records were removed. Simultaneous delivery exposed a missing folder-specific uniqueness rule; additive migration 0055 passes a separate actual PostgreSQL concurrency check in a removed disposable database. Production remains at 45 migrations. The fix is required before a directory-upload release and is absent from the unchanged frozen 0.44.1 archive. The earlier pending checks above describe their original checkpoints. [Exact evidence and remaining release work](plugin-file-import.md).
