# Recovery of edited public exports

October 19, 2026: the accepted **0.44.47 export-relocation-14** database/private-profile checkpoint now also has a verified archive of the complete `Agentopia Files` collection. The application installation is unchanged during this work. No AI request was sent, and no database restore or production profile change was performed.

## Finding and correction

Application-generated public files live outside the private profile. A private-profile/database backup by itself therefore does not preserve an edited public document. Inspection found 17 files, totaling 309,215 bytes, across six profile-tag directories, including files from earlier profile locations. Capturing only the current tag would omit retained copies.

The new recovery module inventories the complete collection, preserving profile tags, account directories, file names, bytes and modification times. It writes a compressed archive, verifies every member and hash, and compares the source again before publication. It rejects linked or redirected paths, hard-linked files, invalid ownership layouts, duplicate names differing only in case, path traversal, altered archive bytes and archive members absent from the inventory. A bounded capture that fails remains explicitly incomplete.

Restoration verifies the archive before creating its destination. It claims a fresh `Agentopia Files` directory and never merges with or overwrites an existing collection. It writes only inventoried files, checks each hash and the full resulting tree, and removes its incomplete marker only after verification. A destination inside the source is refused. A failed extraction retains its incomplete marker and partial output for inspection.

## Tests and actual recovery rehearsal

Nine local recovery checks pass. They include an edited real Word package, Unicode names, empty files/directories, multiple profile tags, existing destinations, corrupted content, invalid paths, source links/hard links and bounded writes. Eight existing private-profile archive checks also pass after adding the inventory hook shared by the public archive. Logs and results are retained under `.supabase/desktop-public-outputs/qualification-1792474761588/`.

An initial generated restore test exposed a stream-ordering bug: starting decompression before directory setup could emit an archive entry before the iterator subscribed. Directory setup now finishes before the stream starts. The corrected tests completed, and the real capture/rehearsal used that correction. No production source was written during this test.

Actual protected recovery directory: `D:/Users/charl/AgentopiaRecovery/export-relocation-14/1792474234936/`.

- `public-outputs.tar.gz`: all 17 files and 54 directories; compressed size 277,457 bytes; SHA-256 `5628d257bedafa67064103aa4e5e363372e0b6823fe1f02b24b5d2d817138fca`.
- `public-outputs.json`: file/directory inventory, source location and hashes binding it to the existing private-profile archive and database-backup manifest.
- `public-output-restore-check/fresh-home/Agentopia Files/`: separately restored files in the protected recovery directory.
- `public-outputs-restored.json`: restoration receipt.
- `public-outputs-independent-verification.json`: a separate Python archive reader verifies all members and compares the complete source and restored trees. All 309,215 file bytes match; the private-profile archive and logical manifest hashes remain unchanged.

The general full-profile/cold-runtime backup script now includes this public archive step in source. Its syntax check passes; a complete cold-runtime run of that script was not performed in this turn. Existing storage requirements still apply. The current pointer is `.supabase/desktop-public-outputs/current.json`.

## Remaining end-to-end recovery work

This establishes preservation and independent file restoration. It does not establish a complete application restore to another Windows account or home directory. That still needs the database/private profile, saved file-reference identities, old absolute chat links, native histories and provider reauthorization handled together. Public file ownership directories alone do not recreate encrypted attachment registrations. The current installed link resolver's same-home relocation check remains accepted separately.

The settings action labeled Database backup still has its documented database/native-data scope; these maintenance additions are not an installed extension to that product action. The next full recovery release must integrate the public collection and portable reference/path restoration, then demonstrate saved-chat document opening after recovery. Full installer, Windows reboot, clean-machine recovery and broader workspace-agent acceptance remain open.
