# Windows runtime and sign-in recovery

October 18, 2026. Installed Agentopia remains **0.44.17 with schema 59**. WSL management works again and the ordinary desktop shortcut restores the signed-in administrator and original working conversation. ChatGPT reports plan access authorized, the preference for ChatGPT on new chats is checked, and the shared OpenRouter connection/default remain intact. No model requests were submitted during recovery.

The Windows WSL management service remained in its stopping state after a normal stop request. The recovery helper verified the service executable and process, ended that stalled service process, and restarted it. This interrupted WSL sessions; it was not a graceful Linux shutdown. The production runtime subsequently opened with healthy database, authentication, database API, realtime, storage and function services. Read-only comparisons matched both account/password records, profiles, roles, 103 conversations and 356 messages before and after reopening. All 190 encrypted vault records remained readable. No new installer or schema migration ran.

## Windows profile selection

The initial automation launch accessed the Windows Store host's package-cache copy of the settings. Administrator sign-in succeeded there with the original generated local password, but its file-reference library differed from the ordinary physical profile. A subsequent Explorer launch through the existing desktop shortcut restored the ordinary profile's existing local session without entering a password. Its saved conversation, selected ChatGPT model/High thinking and Full access were verified visually.

The computer-use accessibility tree continued to return old startup text after the ordinary application had opened. Fresh screenshots established its actual state. The apparent continuing startup delay was therefore not a demonstrated application failure. Final interface checks used fresh screenshots and coordinate actions.

One pasted-image draft retained its registered reference but the encrypted image file was absent. Recovery found exactly one same-owner, same-conversation saved image with the matching filename and byte count. The original PNG bytes were encrypted with Windows protected storage and restored only to that missing attachment's location. The credential file's hash stayed unchanged. Reopening the conversation rendered the draft thumbnail again. The cause and timing of the earlier missing file remain unproven; automatic reference-based image cleanup across differing Windows filesystem views warrants investigation.

## Evidence and backup limits

The private evidence directory is `.supabase/desktop-runtime-recovery/recovery-1792355637015/`. It contains the service restart receipt, database comparisons, initial package-cache sign-in record and final `ordinary-login-verification.json`. `image-recovery-1792357211905/evidence.json` records the exact one-file image recovery. Passwords and tokens were not printed.

The two earlier profile archives were fully read and compared against their Windows-visible sources, and the existing logical database backup's five manifest entries were verified. Later physical reads through WSL demonstrated that Windows redirected ordinary AppData reads to the package-cache copy. Those archives therefore do **not** establish a fresh backup of both distinct physical profiles. The prior physical backups and database disk remain retained; a new physical-profile snapshot is still required before an upgrade. The recent archives are also not a cold disk image.

The saved outcome of the earlier packaged coordination rehearsal was inspected without replay: its source request failed on an overlong Codex state path before any native turn, tool call or delivery was recorded. The corrected rehearsal's partial import still needs scoped cleanup and a deliberate new qualification. Full packaged coordination and the broader desktop goal remain open.
