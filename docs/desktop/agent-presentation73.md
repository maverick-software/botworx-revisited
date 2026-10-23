# Saved agent appearance and conversation starters

Version0.44.73 is now installed and visually accepted, with icons, colors, local profile images and ordered conversation starters for saved agents. Root package versions are0.44.73, the database schema remains72 and recovery format remains12. This document records the original source qualification; agent-presentation73-runtime.md and release73-preparation.md describe the subsequent actual PostgreSQL, packaged, recovery and installed evidence. The full parity goal remains active.

## Resulting behavior

Identity settings provide eight icons, six colors and a local PNG, JPEG or WebP upload. Upload prepares a centered 128-pixel square PNG thumbnail; the user explicitly saves it. Cancelling the picker changes nothing. Agent directory rows, agent home and the editor share the avatar component. Image reads are lazy and tied to the current owner, agent and saved image digest. Existing external or older noncanonical image references are preserved; desktop does not fetch or display them automatically. The settings panel explains how to upload those images again.

Saved agents can have up to six ordered conversation starters. An unset list uses the existing three defaults; an explicitly empty list hides all starters. Selecting a starter fills the home composer without sending. Cards disappear while a draft is present. Multiline text and surrounding whitespace survive selection and submission, and the home composer honors the selected Enter or Ctrl+Enter preference. Imported identifiers and markup-like prompt text remain ordinary data.

Appearance saves are independent of instruction and identity saves. They preserve newer appearance edits made while an earlier save is pending. Preview and navigation reflect both independent dirty states. A refused save retains the draft, and reloading requests an explicit discard choice. Unknown saved appearance formats cannot be overwritten. Appearance during initial agent creation and previews of unsaved agents remain open work.

## Storage and ownership

The implementation uses existing agents.metadata.desktop_presentation and agents.avatar_url columns. It adds no migration or replacement storage service. Public agent summaries omit raw avatar URLs and unrelated metadata. Every appearance read and write requires the selected account and owned agent. Broker guards repeat after asynchronous ownership checks and before opening a picker. Pending image and save operations participate in the maintenance exclusion counter.

A presentation revision identifies the exact saved appearance and image. Save also compares the current row update timestamp in PostgreSQL. This permits unrelated completed settings changes while refusing a concurrent overwrite. Metadata is merged from the current row; instructions, models, permissions and unrelated settings are preserved. Store tests currently use a controlled database implementation, so actual PostgreSQL timestamp and concurrency behavior still require integration verification.

Local imports enforce protected-path checks, independent regular-file identity, size bounds and matching file extension and raster header. Image dimensions are bounded before decode. PNG and JPEG use Electron's native image decoder. The installed Electron decoder could not decode the tested WebP, so WebP uses a temporary sandboxed Chromium window with network and permissions blocked, then canonicalizes the small PNG. The window closes after success or failure. This processes a user-selected local image and makes no provider request. Account image generation remains disabled.

## Qualification

The private authoritative qualification is .supabase/desktop-agent-presentation73/qualified-1792762069194/evidence.json. It binds the exact current source, compiled modules, renderer files, test controllers and these receipts:

| Check | Purpose and result |
| --- | --- |
| Source 1792761875726 | Backend and interface types; nine focused contract/store groups and 25 policy, broker and instruction regressions pass. These include ownership, stale results, picker cancellation, maintenance exclusion, revision conflicts, metadata preservation and bounded imports. |
| Appearance UI ui-1792762025805 | Ten actual Electron renderer workflows pass with a controlled bridge, including explicit saves, newer drafts, image display, multiline shortcuts, starter limits, imported identifiers and wide/light and narrow/dark layouts. Screenshots were inspected. |
| Full interface app-1792762032763 | Twenty complete-interface workflows pass against the current renderer, including exact multiline home submission and existing editor, directory, schedule and assignment behavior. |
| Instruction UI ui-1792761262902 | Fourteen existing instruction-editor workflows pass. The qualifier checks unchanged imported source hashes before reusing this receipt. |
| Drafts 1792762056407 | Eight queue and steering acknowledgement workflows pass against the same current complete renderer, including switching chats, newer drafts and refused or delayed acknowledgements. |
| Raster raster-1792760818689 | Four actual Electron checks cover PNG, JPEG, WebP and rejection of unsupported markup. Reuse requires byte-identical compiled image, store and contract modules. |

The renderer tests use controlled account records and bridge responses. They establish interface behavior and exact requests, not production persistence or model understanding. No production data or ordinary profile was written and no model request was made. The final qualifier asserts the exact source and artifact fingerprints rather than treating earlier runs as interchangeable.

Two failed attempts are retained. The first raster run exposed missing native WebP decoding and led to the isolated Chromium fallback. An earlier UI run exposed a textarea accessible-label problem, which was corrected. The last shortcut failure came from the fixture issuing a keypress before React rendered its changed preference; the fixture now synchronously commits that change, and all ten workflows pass without changing product shortcut behavior.

## Delivery and remaining gaps

The frozen73 candidate passed archive and complete-renderer comparison, actual owned PostgreSQL/Broker save/reload and account/concurrency guards, image persistence and exact native starter context. Independent whole-profile restoration preserved avatar bytes and starters. Installer verification, fresh ordinary recovery/program rollback, authorized normal update, complete saved-data/protected-setting comparisons and installed native visual acceptance now pass. The historical source-only receipt remains limited to source qualification; the combined delivery receipt is .supabase/desktop-recovery73-release/1792763635729/installed-final-qualified.json.

The user confirmed Windows was unlocked, and supported computer use inspected the actual installed73 General and Identity pages. Sidebar/header top edges align and the appearance/starter controls are visible without changing agent fields or submitting a message. Physical reboot and another Windows user's recovery remain untested. Full parity remains active, including initial-creation appearance, legacy avatar resolution, builder assistance, unsaved preview, organization/sharing/external channels and the remaining requirements in parity-requirements57.md.
