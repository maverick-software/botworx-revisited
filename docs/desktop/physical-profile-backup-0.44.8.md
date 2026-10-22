# Recoverable profile snapshot before the private 0.44.8 upgrade

On October 18, 2026, the corrected backup completed in `.supabase/desktop-installed-0448/physical-backup-1792306988278`. Both physical Windows profiles were captured and independently verified: 3,317 ordinary-profile files and 3,048 package-cache files. The current backend's cold disk export is 5,472,518,144 bytes. Five logical dump/key files and their manifest were also verified. Original files, accounts, passwords and database schema were left unchanged.

The disk import check passed separately: a disposable copy opened, all six recorded identity, database and encryption files matched, and PostgreSQL remained stopped throughout. The generated test distribution was removed after checking its exact registration. Evidence is recorded in `latest-core-backup.json` and `latest-core-import-check.json` under `.supabase/desktop-installed-0448`. No provider requests were sent by these checks. Disk import and file preservation do not establish full database restore or live model behavior.

Agentopia 0.43.7 was reopened after those checks. Its administrator session, history, saved draft and workspace pane restored. The private 0.44.8 candidate remains uninstalled.

## Scope and corrected policy

Earlier attempts unnecessarily tried to archive older backups and regenerable caches before reopening the app. One replacement also stalled in a quadratic scope validator. Those operations were explicitly cancelled, their terminal results checked, and their partial output retained. They are superseded by the completed recoverable-data snapshot; historical all-files archival is not a prerequisite for reopening.

The completed snapshot follows the qualified runtime's `runtime-native-backup-v1` policy. It preserves protected credentials and Local State, the runtime binding where present, native chat histories and databases, custom skills, attachments, and browser partitions including cookies. Native runtime temporary directories and bundled system skills are excluded according to the product's existing backup policy. Top-level old backups and generated test profiles remain in their original locations. The current Linux database disk has its separate cold export. This is a recoverable user-data snapshot; historical and generated files have not all been copied.

## Physical Windows profile provenance

Windows package virtualization can redirect individual AppData files even when the profile root reports its ordinary location. The two captured physical roots are:

- `C:\Users\charl\AppData\Roaming\Agentopia`
- `C:\Users\charl\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Agentopia`

The manual backup `2026-10-18T05-51-28.237Z-manual` physically resides in the package-cache root. The cold backend disk belongs to the installation's bound runtime. Physical reads used WSL filesystem access and checked the owned runtime identity. No unrelated distribution was stopped or removed.

After reopening through the Windows computer-use launcher, a physical comparison showed the package-cache credentials file changed while the ordinary credentials file retained its prelaunch hash. The current running app therefore still writes the package-cache credential store. The ordinary profile contains a different, newer ChatGPT credential pair whose refresh has not been tested. Do not infer that pair's rejection from an earlier failed renewal against the package-cache pair, and do not rotate an isolated copied store. Resolve launch/profile provenance before testing the newer credential through a writable running app.

Subsequently, clicking the desktop shortcut in File Explorer reached the ordinary profile. Its stale local session required a guarded session-only repair; the original administrator login then restored. One actual-Codex ChatGPT message succeeded, and physical inspection confirmed renewed access and refresh credentials saved in the ordinary store. The retained package-cache store stayed unchanged. See [the completed renewal checkpoint](oauth-connection-recovery.md).

The exact [0.44.8 packaged startup check](packaged-startup-0.44.8.md) has also passed. Installed upgrade, current-candidate authenticated workflows, restart and clean-machine acceptance remain outstanding. Earlier 0.44.7 checks retain their recorded version scope.
