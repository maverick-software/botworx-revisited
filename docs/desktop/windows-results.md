# Saved Windows results in chat

October 17, 2026 · 0.42.2 installed private release

Completed Windows activity now presents a short result and its saved screenshot before the technical record. **Input sent** is based on the input receipt; the interface asks the user to review the resulting window rather than claiming that the application achieved the intended outcome. If a new screenshot was unavailable, that limitation remains visible. Screenshot captures show their observed-control count, and window-list results show the shared windows and their availability.

The complete metadata and textual tool output remain under **Technical result**. The large JSON display is created only when that disclosure opens. The existing screenshot viewer still opens the original saved image. Viewing a completed result does not request a fresh live window capture or offer to replay input.

Saved action reviews now distinguish completed, declined, interrupted, failed, and running actions. An interrupted or failed action asks the user to check the shared window before continuing; it does not assume that no input occurred.

The isolated interface workflow checks receipt wording, exact recorded text, missing read-back images, unsuccessful and declined actions, captures and shared windows, the original-image viewer, keyboard controls, lazy technical records, and dark/light/narrow layouts. It uses fixture results and sends no input or inference. Its first Escape check lacked native window focus; the test was corrected to establish focus before testing keyboard dismissal, with the initial failure retained. Action-preview and browser-pointer review workflows also passed.

The installed check passed against the original eight actual ChatGPT/OpenRouter inputs, their saved images and exact text. It verified lazy technical records, reloaded history, and confirmed that expired grants remained unusable. The complete 221-check suite, browser/action review workflows, navigation, packaged resources, and original-data comparisons passed. Release evidence is under `.supabase/desktop-tool-results/`. [Earlier action-review behavior](windows-input-review.md), [Windows profile continuity](windows-profile.md).
