# Reference comparison and reading-flow correction

October 18, 2026. Installed Agentopia is 0.44.17. The source change described below is not yet installed.

The user explicitly requested direct screenshots and comparisons with ChatGPT/Codex Desktop. Native captures of the reference application's Codex view showed the running goal strip, chat transcript, application rail, project sidebar, and right-side goal editor. The reference displays ordinary replies without a repeated assistant-name heading. Agentopia's installed chat repeated its current assistant's name above every response. The reference window was also receiving user input while its goal editor was open; the input guard refused a model-picker action. No reference model choice or goal content was changed, and that attempted action is not counted as a completed interaction test.

The source transcript now omits redundant headings for ordinary replies from the current primary agent. Saved historical names and roles remain represented. Alternate authors retain visible labels, including a different agent with the same display name. Returning from another author displays the primary agent's label. Every response retains its accessible author name and unchanged saved metadata. This presentation change does not alter requests, agent identity, provider routing, tools or stored messages.

The installed-image baseline is exercised with the full DesktopApp and a controlled bridge containing a long saved conversation. It reproduces repeated author headings while passing initial opening at the latest response, timeline reading during streaming, and returning to latest after switching chats. The initially observed installed scroll position was not reproduced as a defect in this fixture; scrolling logic was left unchanged.

Evidence:

- `.supabase/desktop-chat-reading/1792343462793/evidence.json`: delivered 0.44.17 baseline, three reading-flow cases pass and the redundant-heading expectation fails.
- `.supabase/desktop-chat-reading/1792343548312/evidence.json`: all four corrected source workflows pass, including renamed authors, alternate authors and same-name/different-ID attribution.
- `.supabase/desktop-chat-reading/transcript-regression-1792343503251/evidence.json`: existing continuous-history regression passes, covering citations, attention states, all 300 saved messages, a bounded timeline, streaming while reading earlier messages, dark/light, narrow and larger-text layouts.
- `npm run desktop:typecheck`: passes for backend and renderer contracts.

All application runs use isolated controlled accounts and responses; no production data or provider inference is used. Native reference captures were inspected in the Computer Use tool output and were not saved or re-emitted. Source fixture screenshots are retained with their evidence. Further parity checks remain open, including real queued-message and goal behavior through the installed ChatGPT connection, the expanded artifact/tool requirements and the complete current-release recovery and clean-machine gates.


The subsequent 0.44.18 packaged candidate passes all four reading workflows and nine goal/queue workflows using its delivered renderer, and a real ChatGPT result opens its cited source in that renderer. A fresh native capture of the actual reference was inspected again alongside ordinary/larger geometry candidate captures. The live light-theme capture reveals an existing unreadable active-agent chip; contrast and composer-row duplication remain visual parity work. Native capture of ordinary Agentopia initially returned white while backgrounded; activating and reobserving the returned window produced a usable capture. No reference application model, goal content or messages were changed. [Exact candidate and live evidence](chat-inspection-0.44.18.md).

Later source work corrects the active-agent chip's inherited button text color and removes the extra native-goal card when the composer already owns that goal. Ten controlled full-renderer goal/queue workflows pass in `.supabase/desktop-goal-queue/ui-1792351258484/evidence.json`; dark, light, yielded-goal and actual 760-pixel captures were inspected. At narrow width, the workspace pane occupies the content area and the persistent rail toggles back to usable chat/model controls. These are Agentopia source captures compared with the previously observed single-strip reference pattern. They do not constitute a new live reference interaction or installed verification. Broader composer duplication and full visual parity remain open. [Goal/queue behavior and evidence](goal-queue-ordering.md).


## Later native observations during scheduling work

Computer Use captured the actual installed Agentopia window (0.44.17, window 594860) and reference desktop window (ChatGPT, window 28183308) without input or submission. Agentopia retained the existing conversation and pasted-image draft, showed ChatGPT/GPT-6.1 Sol High and Full access, and displayed the saved backup notification. The transcript still repeats primary-agent headings; the existing quieter-transcript correction remains outside this installed version. The reference capture shows its compact goal strip with elapsed time, delete, pause and expand controls above the composer, with a pending question displayed inside the conversation interface.

The captures use different window dimensions (approximately 1362×900 and 1920×1030), so this is a qualitative observation rather than a matched-size visual pass. Scheduled-task interaction was not exercised in the reference UI. The source scheduling target is separately grounded in the fetched official Scheduled tasks documentation; its UI comparison remains open. The installed conversation also retains the earlier failed temporary website preview at localhost:4176. That particular preview workflow has no newer successful persistence/serving demonstration in this session.
