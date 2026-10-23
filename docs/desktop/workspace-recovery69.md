# Bundled Git restoration repair — source qualification

Git 2.56, which ships with the desktop app, refused to open a long private history-bundle filename during restoration. It also rejected the null-old-value form of a `HEAD` update while the new repository still contained its initial dangling symbolic reference. These failures stopped restoration and retained the partial copy for inspection.

The repair sends the bundle header through standard input, validates the initial symbolic `HEAD`, and then writes the selected detached commit. Git still verifies the full pack through the existing streamed import. Ownership, physical directory identity, file hashes, account guards, cancellation, and source-workspace checks remain enforced. Only the header is sent to `bundle verify`, because that command finishes after reading it; sending an entire large pack caused a broken pipe in an intermediate attempt.

The complete generated recovery run passed 112 existing checks. Its one failing new regression used a deliberately extended private profile root and hit a separate Windows Git working-directory limit during preparation. The regression was revised to use the ordinary generated profile layout and to check the actual restoration bundle path, which still exceeds 260 characters. That focused run passed and compared the retained bundle hash, restored commit, unsaved draft, and unchanged source history. The backend bytes are identical between the complete run and focused run. The combined qualification records these two runs explicitly; the complete run itself had one failure.

Existing passing cases include portable import, independent history verification, staged and unsaved file recovery, large SHA-256 binary history, account and grant boundaries, cancellation, interrupted operations, and prevention of automatic replay. No production profile or provider was accessed.

Three additional checks passed with the established Git 2.48 executable, reusing the same qualified backend: ordinary restoration, the long-bundle-path regression, and large SHA-256 history with staged and unsaved files. Evidence: `.supabase/desktop-chat-file-history69/legacy-git-1792733592108/evidence.json`.

Extra-long private profile roots remain a known limitation: Git can fail when its working directory itself exceeds the Windows process limit, and some capture commands still pass long filenames directly to Git. Those attempts stop during preparation and preserve existing data. This repair does not establish support for arbitrary profile path lengths.

- Intermediate complete run: `.supabase/desktop-chat-file-history69/recovery-1792732099152/evidence.json` — 66 passed, 47 failed before the final stream and HEAD corrections.
- Final complete run: `.supabase/desktop-chat-file-history69/recovery-1792732719318/evidence.json` — 112 passed, one new extreme-root case failed.
- Focused long-bundle-path regression: `.supabase/desktop-chat-file-history69/recovery-1792733544965/evidence.json`.
- Combined qualification with backend hash checks and limitations: `.supabase/desktop-chat-file-history69/recovery-1792733544965/qualification.json`.
- Exact Git diagnostics: `.supabase/desktop-chat-file-history69/restore-diagnostic-1792732685208/evidence.json` and `restore-diagnostic-1792733403517/evidence.json`.

These changes remain source-only. A frozen next package, installation, ordinary-window inspection, and the remaining full parity requirements are still pending.
