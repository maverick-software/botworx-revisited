# Native Codex file changes

Installed **0.35.1** includes the event handling described here, compact native change cards, the shared Changes pane, verified undo, Unicode Git path handling and recoverable case-only aggregate moves. Actual direct/code-mode parent and native V1 child checks passed, along with both live providers, the installer upgrade and installed resource/data verification. [Current controls and limits](native-file-review.md), [Windows path correction and qualification](native-path-compatibility.md). The historical 0.34.0 event-handling qualification follows.

## Finding and implemented event support

The existing file cards and Changes pane consume completed Agentopia `write_file` snapshots. Native Codex `apply_patch` operations were retained only as file-change items in the work log. The client ignored `item/fileChange/patchUpdated` and `turn/diff/updated`, so streaming patches and aggregate turn diffs could not reach either review or persisted state.

`native-events.ts` now retains those notifications. An early patch update creates a pending file-change item; an empty later start notification preserves that patch. Completion supplies the authoritative final item, and late starts or partial updates cannot replace it. Item identity includes thread, turn and item ID, preventing a follow-up or another child from overwriting an earlier item with the same ID. Aggregate diffs remain separate for each thread/turn. Large aggregate previews are explicitly marked truncated. Private reasoning remains excluded.

The actual harness dispatcher publishes these updates for the main turn, child state, parent mirror and automatic report state. The additional JSON state is backward compatible and requires no migration or modified Codex binary. Five focused checks exercise streaming order, reused IDs, aggregate replacement/bounds, completed-message protection and real harness dispatch.

The renderer now uses the same full item identity for transcript keys and approval lookup. An earlier turn's diff cannot stand in for the current pending patch. Approval stays disabled while the proposed changes array is empty; the panel labels creation, deletion, updates and moves. An isolated UI workflow verifies repeated IDs, successive updates, incomplete proposals, both parent/child approvals and light/dark layouts.

## Qualification and installed correction

All 182 automated regression checks passed. Actual ChatGPT native `apply_patch` created a file, modified another and deleted a third. After a composer switch, one OpenRouter native child patched the same file and retained the earlier marker. Exact resulting bytes, completed native items, separate aggregate diffs, delivered child work and unchanged reopened history passed. The captured pinned-runtime data confirms the add/delete/update representations described below.

Two qualified backend modules and the rebuilt interface were applied to the installed 0.34.0 application. Its prior archive and UI are backed up under `.supabase/desktop-native-patches/installed-before/`; the deployment record contains their digests and exact changed module names. The existing installer predates this correction. A future build includes the source changes.

Installed verification loaded the new event module from the actual application archive, reopened parent/child aggregates and displayed the child's actual patch without another inference request. All four saved messages remained unchanged. The resource audit matched 979 compiled modules, all 12 UI files, pinned runtimes/notices and 37 migrations; a separate audit verified all eight pinned Codex resources, including the unchanged executables. The original-data audit retained both accounts/passwords and roles, all 83 earlier conversations/262 messages and all 37 migration checksums. Agentopia was reopened with all six backend services healthy. Evidence is under `.supabase/desktop-native-patches/`, with the full regression log at `.supabase/desktop-native-events-core.log`.

## Native cards and restoration in 0.35.0

Installed 0.35.0 now connects these records to compact file cards, the Changes pane and verified undo. All 189 regressions passed. Real retained parent/child patches verified source update/create/delete restoration; the installed recovery fixture verified no automatic writes after restart, explicit retry and file opening. Installer upgrade, compact navigation, pinned resources and original-data preservation passed. Both original accounts/passwords, roles, all 84 earlier conversations/266 messages and the 37 original migration checksums remain intact; the two review migrations are additive. [Current controls, implementation, evidence and limits](native-file-review.md).

## Original implementation and acceptance requirements

Connect native changes to the compact file cards and Changes pane. Use actual native add/delete/update/move data, retain each operation's thread/turn/item identity and distinguish incomplete or declined patches. Aggregate counts must not claim a net change by summing unrelated patches to the same file.

Undo needs verified current contents and a durable receipt, including empty creations/deletions, newline handling, renamed paths, multiple sequential edits, child follow-ups and interrupted operations. It must retain ownership and attachment grants, preserve newer edits and local drafts, prevent duplicate restores, and coordinate with active native work. A provider-reported patch alone must not authorize blindly rewriting a file. Native edits outside the owned supported workspace need an explicit review limitation rather than an invented undo snapshot.

`scripts/desktop/test-live-native-patches.mjs --live` captures actual parent/child `apply_patch` operations through ChatGPT and OpenRouter. It requires native completed items, separate aggregate diffs, exact file bytes for creation/update/deletion, preserved earlier context and unchanged reopened history. It retains successful paid evidence for later read-only verification. These records will inform the snapshot/undo implementation and its tests.

Native add/delete records contain file content; update records contain unified patches. Upstream conversion and rendering describe those distinct representations: [app-server item conversion](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/item_builders.rs), [native display conversion](https://github.com/openai/codex/blob/main/codex-rs/tui/src/app_server_approval_conversions.rs). Actual pinned-runtime captures remain the qualification evidence.
