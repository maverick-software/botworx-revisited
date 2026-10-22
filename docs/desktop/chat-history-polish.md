# Chat history refinement

The 0.40.1 installer includes this layout. Its installed navigation check passed on October 17, 2026: saved section choices survived reload, rows stayed 32 pixels tall with single-line labels, hover and keyboard menus worked, search reached saved chats, and messages remained unchanged. Source-renderer checks also passed in dark, light and narrow layouts. Current screenshots and evidence are under `.supabase/desktop-browser-upload/navigation/` and `history/`.

The upgrade and resource audits passed, preserving both original accounts/passwords, roles, all 89 earlier conversations, 288 earlier messages and previous migration checksums. The initial 0.40.0 packaged upload failure was traced to long Windows paths and repaired in 0.40.1; live installed requests through both providers and the separate transfer/restart cleanup check passed. [Upload diagnosis and verification](browser-uploads.md).

Updated October 17, 2026. Applied to the source and the installed 0.36.0 interface; the subsequent 0.37.0 installer included the refinement. Installed 0.38.0 passed the source and installed history navigation checks again.

The transcript now follows the latest user prompt and its replies. Completed earlier exchanges fold behind the existing “previous messages” control as new prompts arrive. Expanding that control holds its boundary while incoming replies arrive, so the reader can continue browsing. Pending responses and approvals keep their complete exchange visible; opening a citation reveals its earlier message.

Recent and project chats now use the same single-line row and menu. Multi-line titles display their first non-empty line, with the original title retained in storage and the hover tooltip. Project chats now offer Rename, Pin, Archive and Delete alongside Move to project. Existing confirmation flows still apply. Project indentation is lighter, date headings are smaller, and keyboard focus has an explicit outline. Chat rows retain their 32-pixel height and 13-pixel labels.

## Verification

- The desktop build and both TypeScript projects passed.
- Five focused checks covered exchange boundaries, waiting prompts, live decisions, hidden commentary, titles and recorded timestamps.
- A real Electron renderer with fixture conversations verified new-prompt folding, expansion during new replies, citations, pending approvals, full project menus, selected-chat visibility, section disclosures and access to all history. Dark/light and narrow layouts had no horizontal overflow.
- The installed executable verified saved section preferences across reload, single-line rows, hover and keyboard actions, search, and unchanged saved messages. No AI requests were made.
- Database fingerprints matched before and after: both accounts, roles, four projects, 86 conversation records and 274 messages, including their saved titles and content.

Evidence: `.supabase/desktop-history-polish/evidence.json`, `installed/evidence.json`, `data-before.json`, `data-after.json`, and `deployment/evidence.json`. The installed screenshot is `installed/compact-installed.png` in that directory.

The previous installed interface is backed up. Its backend archive is byte-for-byte unchanged. Agentopia was reopened after verification. This is an interface refresh to this installation; the existing 0.36.0 setup executable was not regenerated. The rebuilt interface is staged for the next installer.

The 0.38.0 installer includes this interface. Its installed checks verified the section preferences, 32-pixel single-line rows, hover/keyboard menus, full search, collapsed earlier exchanges and unchanged saved transcripts. The final regression suite passed all 201 checks; both original accounts/passwords, roles, all 87 earlier conversations and 278 earlier messages were preserved. Current interface evidence is `.supabase/desktop-browser-recovery/navigation/compact-installed.png`; the corresponding source-layout evidence is under `history` in that directory.
