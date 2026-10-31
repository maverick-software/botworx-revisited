# File changes beyond the working folder and matching card styling

The first rollup compared only the chat's working folder. A command could create or change a file elsewhere without supplying a native patch, so that file had no before-and-after record to display. The card also used smaller text, a bare icon, and short relative names.

Responses now keep request-owned before-and-after observations for actual file targets. The native agent receives `record_file_targets` and instructions to call it before file-changing commands or desktop actions. It accepts absolute files and output folders, including folders that do not exist yet, independently of the chat's working directory. The first before state is retained across repeat registrations. Approved commands also record their working directory and literal external paths automatically. Computed destinations are resolved and registered before execution.

The recorder does not grant permission to write. Full access native commands may use destinations explicitly requested by the user outside attached folders. Scoped file tools retain their selected reference and relative-path rules. The recorder keeps account ownership, cancellation, private-path exclusions, link checks, bounded inventories, and saved-state ownership. It does not inspect unrelated drives or attribute unrelated application activity to a chat.

The final comparison merges target observations with existing write previews, native patches, and file-management receipts. Overlapping targets are deduplicated, repeated edits retain their original contents, and files restored to their original contents have no net change. Binary files have no invented line counts. Incomplete comparisons show a notice. Existing recovery-backed Undo remains conditional on its verified recovery records.

The card uses a dark rounded 40-pixel icon tile, a framed plus/minus icon, 14-pixel heading text, 13-pixel file paths and expansion controls, and 12-pixel line totals and actions. Paths use muted directory text and brighter filenames, with the full path available on hover when space is limited. File review also shows full paths.

Verification includes real filesystem tests outside the working folder, new nested and computed destinations, repeated and overlapping registrations, cancellation and private paths, the Full access command approval path, saved-state merging, native patch recovery checks, and interface interactions. The installed chat check deliberately attaches an empty working folder and changes only a separate, unattached fixture folder, then compares the rollup with independently verified file bytes. Evidence is retained under `.supabase/desktop-file-rollup96/`.

Earlier responses without before states cannot gain reliable historical totals. New operations must have recorded targets, tool previews, or native patches to establish their changes.
