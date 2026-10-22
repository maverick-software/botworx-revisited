# Native changes in chat and verified undo

Updated October 17, 2026. Installed **0.35.1** includes the native change cards and right-side Changes pane introduced in 0.35.0, plus Unicode/empty-file Git path handling and verified case-only aggregate move restoration. Its native compatibility hook blocks the pinned patch writer's unsafe direct same-path/case-only move and directs agents through checked file management. All 194 regressions, actual installer upgrade, packaged parent/child checks, saved live-provider conversation, navigation, resource and preservation audits passed. [Path behavior, release evidence and boundaries](native-path-compatibility.md). ChatGPT and OpenRouter share the review service and unchanged Codex executable.

## Controls

A completed native `apply_patch` operation appears in an **Edited files** card. The card shows file names and line counts from the saved aggregate diff for that thread and turn. It shows three file rows initially and a disclosure for additional changes. Full patches stay inside work history or **View changes**. Child changes can be reviewed from the main conversation or its dedicated child chat.

**View changes** opens the response's saved changes in the workspace pane. Where Agentopia can verify a snapshot, the pane shows the original and resulting text. Otherwise it preserves the recorded patch and explains why restoration is unavailable. **Open file** uses the existing owned workspace navigation. A file already restored has a Restored label; its card no longer claims that edit is still applied.

**Undo edits…** opens a confirmation before writing. Sequential changes are restored in reverse order, checking eligibility again after every restoration. A newer file edit stops undo and preserves remaining files. Earlier successful restorations remain applied and visible. **Recheck files** refreshes eligibility without writing. An interrupted undo has a separate, explicit retry action.

## How verification works

Native completed file-change items and aggregate diffs are matched by thread, turn and path. An unrelated child or follow-up cannot supply a path for another turn's diff. The aggregate describes the final change within that turn, avoiding inflated counts from repeated intermediate patches. When overlapping operations prevent a reliable combined count, the card says View diff.

The trusted process reads the current file through the signed-in account's existing workspace grants. It requires the exact full Git content hash recorded by Codex. It reverses the patch with no fuzzy matching, verifies the original content hash, then applies the patch forward and requires the exact current bytes. The checks distinguish a missing file from an existing empty file and preserve supported UTF-8 text, line endings and final-newline behavior.

Verified before/after contents are stored in a PostgreSQL receipt associated with the account, request and change. The source patch fingerprint cannot change after review. The renderer cannot create or update these receipts directly. Account ownership is checked in the trusted service; database permissions and row access rules separately restrict reads and writes.

Immediately before restoring, Agentopia rechecks the current bytes and workspace permission. It excludes active native work for the account and holds the editor's file-operation lock, which protects unsaved editor drafts. A forgotten workspace must be explicitly selected again. A move restores its original path before removing its verified destination.

Receipts record Ready, Restoring, Restored or Interrupted state. Startup changes unfinished Restoring receipts to Interrupted without touching files. Explicit retry recognizes paths already restored and changes only the remaining verified paths. If the database completed its final update but the response was lost, Agentopia reads the saved status before attempting another write.

## Verification

Six focused tests cover exact hashes, UTF-8/CRLF/no-final-newline cases, creation/deletion and empty files, native move representations, per-thread/turn counts, malformed paths and exclusion of simultaneous native work. A separate test uses real local PostgreSQL and actual temporary files to exercise ownership, direct database write denial, newer edits, unsaved drafts, concurrent undo, idempotency, grant revocation and renewal, interrupted multi-path restoration and lost database completion responses. Its native protocol records are controlled fixtures; it does not call an AI provider.

The Electron interface workflow reuses the successful real ChatGPT parent and OpenRouter child `apply_patch` records under `.supabase/desktop-native-patches/live/`. It verifies compact cards, exact line counts, before/after review, dark and light themes, rejection of a controlled newer edit, explicit UI undo of the child's update followed by the parent's creation/update/deletion, restored state after reload and all four saved messages unchanged. No provider inference is repeated. Evidence and screenshots are under `.supabase/desktop-native-review/ui/`.

The complete 189-check regression suite passed. The actual Windows installer upgrade preserved its disposable account/project/protected connection/agent/conversation fixture and then removed those test records. The installed 0.35.0 workflow reopened the real parent/child receipts and unchanged messages, then used a controlled native patch record and actual CRLF file to exercise restart recovery. Startup marked a prepared Restoring receipt Interrupted and left file bytes untouched; explicit Retry restored the original text once, and Open file displayed it. The installed compact-sidebar workflow also passed. These UI checks made no inference requests.

Final preservation retained both original accounts/passwords and roles, all 84 pre-change conversations/266 messages and all 37 original migration checksums. The two additive review migrations bring the schema to 39. Installed verification matched 983 compiled modules, all 12 UI files, all eight pinned Codex resources, 370 Chrome resources, 401 computer-helper resources, 4,199 script-runtime resources and 1,038 command-tool resources. The backend's new diff dependency is explicitly pinned and bundled at 8.0.2 with its license. The prior installer and patched 0.34.0 archive/UI are retained under `.supabase/desktop-native-review/release/previous-0.34.0/`. Release records and installed evidence are under `.supabase/desktop-native-review/`.

## Limits and further work

Undo supports owned, bounded UTF-8 workspace text files. Protected credential paths, linked paths, binary/oversized files, incomplete or truncated patches, missing full hashes, and unmatched paths cannot acquire an invented snapshot. Verified case-only aggregate moves restore contents first and then the exact original name, with explicit resumable recovery between steps. Direct native case-only Move-to calls are blocked before execution; checked Agentopia renames remain available. Complex move/overwrite chains need additional qualification. A patch format that cannot be parsed remains available in the native work log.

Changes made through shell commands do not automatically become native `apply_patch` cards. Historical turns lacking aggregate diffs retain their work log. Direct external programs can still alter files; current-byte checks detect changes, while the application locks coordinate Agentopia's own native and editor operations. Broader desktop parity, including qualified Windows input and the existing-profile Chrome connection, remains ongoing.
