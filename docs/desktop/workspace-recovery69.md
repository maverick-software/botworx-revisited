# Bundled Git restoration repair — source qualification

Git 2.56, which ships with the desktop app, refused to open a long private history-bundle filename during restoration. It also rejected the null-old-value form of a `HEAD` update while the new repository still contained its initial dangling symbolic reference. These failures stopped restoration and retained the partial copy for inspection.

The repair sends the bundle header through standard input, validates the initial symbolic `HEAD`, and then writes the selected detached commit. Git still verifies the full pack through the existing streamed import. Ownership, physical directory identity, file hashes, account guards, cancellation, and source-workspace checks remain enforced. Only the header is sent to `bundle verify`, because that command finishes after reading it; sending an entire large pack caused a broken pipe in an intermediate attempt.

The latest complete generated run passes all **122 checks** in one invocation, covering the maintenance and dedicated Git-capture suites. The long-path regression now uses a private profile that places both the captured history bundle and its extracted restoration bundle beyond 260 characters. It checks the retained bundle hash, restored commit, unsaved draft, and unchanged source history. Capture verification and reference listing now also receive the bounded header through standard input. Independent streamed pack verification remains required before removal or restoration is accepted.

Earlier runs exposed the two restoration defects and the additional capture-filename defect. One deliberately longer profile root also exceeded Windows Git's working-directory limit. Those failed runs remain retained; their earlier combined qualification is superseded by the complete 122-check result.

Existing passing cases include portable import, independent history verification, staged and unsaved file recovery, large SHA-256 binary history, account and grant boundaries, cancellation, interrupted operations, and prevention of automatic replay. No production profile or provider was accessed.

Three additional checks passed with the established Git 2.48 executable, reusing the same qualified backend: ordinary restoration, the long-bundle-path regression, and large SHA-256 history with staged and unsaved files. Evidence: `.supabase/desktop-chat-file-history69/legacy-git-1792733592108/evidence.json`.

Extra-long private profile roots remain a known limitation when the Git working directory itself exceeds the Windows process limit. Read-only comparison reproduced that refusal with both Git 2.56 and Git 2.48. Those attempts stop during preparation and preserve existing data. This repair does not establish support for arbitrary profile path lengths.

- Intermediate complete run: `.supabase/desktop-chat-file-history69/recovery-1792732099152/evidence.json` — 66 passed, 47 failed before the final stream and HEAD corrections.
- Final complete run: `.supabase/desktop-chat-file-history69/recovery-1792732719318/evidence.json` — 112 passed, one new extreme-root case failed.
- Focused long-bundle-path regression: `.supabase/desktop-chat-file-history69/recovery-1792733544965/evidence.json`.
- Combined qualification with backend hash checks and limitations: `.supabase/desktop-chat-file-history69/recovery-1792733544965/qualification.json`.
- Latest complete 122-check run: `.supabase/desktop-chat-file-history69/recovery-1792734116712/evidence.json`.
- Focused capture-and-restoration filename regression: `.supabase/desktop-chat-file-history69/recovery-1792734052314/evidence.json`.
- Exact Git diagnostics: `.supabase/desktop-chat-file-history69/restore-diagnostic-1792732685208/evidence.json` and `restore-diagnostic-1792733403517/evidence.json`.

The frozen 0.44.69 candidate is built at `.supabase/desktop-recovery69-candidate/1792734798974/package-proof.json`. It contains exactly four changed backend modules, each byte-matched to the tested build, and the sidebar alignment stylesheet. Its file service also matches the service tested against real PostgreSQL/PostgREST. Archived controls, whole-interface checks, packaged warm/cold acceptance, installer construction, and ordinary installation are separate remaining gates. The installed backend remains 0.44.68.
