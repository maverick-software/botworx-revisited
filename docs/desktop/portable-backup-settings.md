# Portable backup and pasted-image recovery

**Subsequent source update:** [portable account preferences and unsent drafts](portable-settings-recovery.md) are now integrated and qualified with recovery capability 4. This page records the preceding capability-3 integration checkpoint. Production remains unchanged.

October 20, 2026: **qualified in source; not installed.** Production remains accepted Agentopia 0.44.47 recovery-bootstrap-15. The normal Settings command is connected in source to the portable producer. This is progress toward complete recoverable upgrades; external folders, portable preferences, actual fresh-backend restoration, packaging and installed acceptance remain open.

## User workflow and shutdown

Data controls now labels the action Workspace backup and explains its scope. An administrator chooses a private parent folder. The app creates a uniquely named child and restricts its Windows permissions before exporting database records. Cancelling the folder dialog creates no backup. The interface saves pending drafts, editor work, location and queued preferences before requesting capture. While capture runs, Settings shows its current stage and prevents additional settings actions. A completed request reports the verified destination; errors restore the controls and report the failure.

The main process owns the operation from folder selection through completion. It verifies administrator identity before selection and rechecks that identity before capture. It enters the broker's consistency barrier, settles browser persistence, and supplies the producer with database capture, all archived owners' public references and their clipboard-image readers. New data requests and attachments are refused while this operation is pending. Active agent and scheduled work must finish or pause before that barrier can be entered.

Closing waits for the backup operation, including an open folder choice, before requesting the final renderer draft flush. This order matters because draft storage is temporarily locked during capture. A failed backup also settles before shutdown; it leaves an incomplete marker and does not publish a complete recovery descriptor. The original legacy runtime backup remains available to existing maintenance callers; the Settings command now uses the portable path in source.

## Portable pasted images

The producer exports validated PNG, JPEG or WebP image bytes with each archived account and attachment ID. It excludes the original encrypted attachment files and provider credentials. The private backup contains a separate verified image archive and inventory. Its eight-resource descriptor requires recovery capability 3. The actual installed revision-15 launcher and bootstrap refuse that capability, preventing an older app from silently omitting images.

Preparation checks ownership, IDs, paths, hashes, sizes and account limits before staging images. Startup checks prepared image bytes before opening the restored database. After verified sign-in, restoration encrypts each owner's images with the destination Windows encryption context and publishes their references and completion marker together. An interrupted publication can resume without overwriting an existing matching encrypted image; conflicting bytes are refused. Successfully applied plaintext staging copies are removed when their hashes still match. Later user deletion is respected, including after a separate-process reopen.

## Evidence and limits

The frozen clipboard source qualification is `.supabase/desktop-clipboard-recovery/1792481209995-source/qualification.json`: 104 JavaScript cases, 24 direct Python cases, 30 PowerShell cases and four additional Windows PowerShell 5 cases. It includes the prepared-startup missing/corrupted-image check and permits completed startup after the staging copies have been removed.

The real Windows encryption evidence is `.supabase/desktop-clipboard-recovery/1792480925750/evidence.json`. Three separate Electron processes exported a generated image, restored it into a fresh app profile without the original encrypted settings, and reopened/deleted it. Pixels and the attachment ID survived, the original image stayed unchanged, and deletion did not trigger restoration. These profiles used the same Windows user; a different Windows user remains untested.

The integration qualification is `.supabase/desktop-backup-settings/1792481635110-source/qualification.json`: 117 JavaScript cases and four actual Settings/backup-hook workflows. Its main-process cases execute the actual compiled IPC and close handlers with isolated service substitutes. They verify administrator checks, cancellation, producer callbacks, progress, data-call blocking and shutdown order. The Settings workflows use generated data and a controlled bridge. They verify edit flushing before capture, progress and disabled controls, success, cancellation and failure. They do not create a real production database backup.

The qualification retains the complete earlier frozen source plus an overlay of changed files and hashes of all current source inputs. The unchanged Python/launcher sources reuse the earlier pinned qualification. The installed application archive is unchanged. No model request was sent or replayed.

Normal product backup has not yet been run against the production database, and no new release has been installed. Complete recovery must still demonstrate selected external files/folders, portable user preferences, real fresh database import and ordinary restored sign-in, installer/reboot behavior, and account/data preservation. Workspace-agent identity, SOPs, tools, isolated memory, coordination, status, steering, cancellation and restart acceptance remain part of the full active goal.
