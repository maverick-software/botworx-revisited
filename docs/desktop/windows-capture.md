# Selected-window capture and Windows input

October 17, 2026 · 0.42.0 installed private release

Installed 0.42.1 retains this exact backend and improves the action-review interface. See [Windows action reviews](windows-input-review.md) for its separate verification and remaining UI work.

Agentopia keeps the actual Codex 0.163.0 harness for ChatGPT and OpenRouter. The Windows tool bridge supplies account-bound window grants, screenshots, reviewed input, and saved PostgreSQL activity. This change replaces screenshot acquisition and corrects modal ownership checks; it retains the existing tool names and approval flow.

## Capture path

The old implementation requested thumbnails for every window and then selected the shared window's image. The installed 0.41.0 test enumerated its target but received an empty thumbnail. Chromium reported a timeout waiting for the first Windows Graphics Capture frame. Standard Computer Use could still capture that window.

The new path enumerates source identifiers with thumbnail generation disabled, selects the exact granted native window, and opens a video stream for that source only. It copies one frame and immediately stops every track. A private, hidden, sandboxed renderer hosts the fixed capture document. It has no preload bridge or Node access, cannot navigate or open windows, blocks network requests, and denies camera and microphone permission requests. The display-media handler accepts one video-only request from that exact document and frame. Its secure base address is internal; no website is loaded. [Electron capture API](https://www.electronjs.org/docs/latest/api/desktop-capturer/), [source identifier format](https://www.electronjs.org/docs/latest/api/structures/desktop-capturer-source).

Cancellation destroys the private renderer and discards late frames. A ten-second outer deadline bounds a stalled capture. The first-frame wait is registered before playback begins so a static dialog, which may produce only one frame, can be captured. Frame dimensions and source identity are validated before any image is returned.

The stream requests native dimensions, and Agentopia reduces the model image to at most 1280 by 960 pixels. Original dimensions must match one of the native window's known capture rectangles. This supplies an explicit physical rectangle for coordinate conversion. A real enlarged-window check mapped the 1802 by 1116 native rectangle to a 1280 by 793 image, aligned painted edges within one image pixel, and dispatched a coordinate click that applied the note exactly once.

## Dialog ownership

The native helper now reports the immediate owner obtained through GetWindow with GW_OWNER. The service follows a bounded owner chain back to the explicitly shared window while checking process identity and start time. It rejects missing ownership, cycles, other processes, and unrelated windows. The native input worker also rejects owner changes since observation. The controlled Windows Forms dialog demonstrated why the earlier root-owner shortcut was insufficient: its reported root ancestor was itself, while GW_OWNER correctly identified the main form. [Microsoft ownership guidance](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getparent).

The helper is version 1.0.1, built with the existing pinned .NET SDK and self-contained runtime. All 401 helper/runtime files remain integrity-pinned. The installed application needs no separate SDK or runtime installation.

## Evidence

Source tests passed real selected-window capture; original and scaled screenshot geometry; double, right, and middle coordinate clicks; vertical and horizontal wheel input; cancellation after a real drag began, with button release; cancellation during actual typing, preserving only the observed partial entry; modal capture and return; stream cancellation; and repeated captures without abandoned private windows.

A separate source input test entered exact Unicode text and produced one application receipt. The visible-host test also completed that input sequence. Its foreground-grant helper returned false, while mandatory native target-focus checks and actual inputs succeeded; that optional grant result must not be presented as a demonstrated permission handoff.

The complete 217-check suite passed. Installed ChatGPT and OpenRouter used the actual Codex harness to inspect the same native window and perform eight reviewed inputs. ChatGPT read a visual-only code and entered an exact Unicode note. OpenRouter read the changed code, kept the first note intact, and appended the new code. The controlled application recorded exactly one Apply receipt per provider. Standard Computer Use activated Agentopia for each review; native read-back records confirmed target foreground focus after every input.

The paid workflow passed. Its first post-run database checker failed because normal app shutdown had stopped Supabase. The checker was corrected to start the existing native services before reading the saved evidence; no paid requests were repeated. The original failure log remains beside the recovered verification log.

Restart retained native images, reviews, choices, and messages, expired old window grants and previews, and resumed no input. The packaged engine passed the same physical input, modal, cancellation, and geometry checks. Navigation remained compact. All 994 compiled modules, 12 UI assets, 401 helper/runtime files, and other pinned resources matched the tested build. Upgrade and backup checks passed. Both original accounts/passwords/roles and all 92 earlier conversations and 300 messages were retained. Agentopia was reopened with six required native Supabase services healthy. Evidence is under `.supabase/desktop-computer-stream/release/release-summary.json`.

Broader application types, multiple displays and DPI settings, additional interruption scenarios, permission-mode parity, and the rest of the desktop parity backlog remain ongoing.
