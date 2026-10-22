# Agent directory and home — October 22, 2026

The 0.44.66 renderer update introduces the directory and home structure from the user's ChatGPT agent screenshots. It retains the installed backend archive and database schema. The frozen build is based on the previously installed automation UI. Source67's unfinished workspace-import bootstrap is explicitly excluded when preparing the renderer.

## What is connected

The directory uses compact searchable rows, recent-use dates derived from actual saved conversations, Recently used/Built by me tabs, a template banner and an editable template picker. Pins are presentation preferences saved on this device under the signed-in owner's identifier. Retired agents remain accessible in a separate expandable list. Templates prefill the existing creation form; users review their provider, model and instructions before saving.

Each owned agent has a home page with its name, description, private-account badge, prompt box, starter prompts and Activity/Apps/Memory tabs. Activity combines actual scheduled occurrences, saved named-agent assignments and conversation history. It distinguishes recorded completion/failure from an ordinary conversation, retains upcoming schedules and opens actual saved conversations. A failed assignment lookup leaves available conversation/schedule data visible and explains the partial result. Older assignments can be loaded through the existing paginated owner-scoped API.

Apps uses the agent's existing connection catalog and distinguishes an assigned connection from one requiring setup. Disabled connections are excluded from that list. Compound imported names such as `exa-web-search · exa` display **Web Search**, with **Exa** retained as connection metadata. Identifiers, grants, models and assignment permissions are unchanged.

Memory presents the private shared-memory entry and actual saved projects. Project folders open the established memory editor with that exact project selected; the existing backend continues to enforce isolated project scope. The automation button opens the installed scheduler interface.

Agent-home prompt submission uses the ordinary chat submission path and selected saved identity/model. It sends once, clears inherited attachments from this new prompt, and preserves an existing new-chat draft separately. Opening a saved activity also preserves other conversation drafts. The agent home supports its own path, remembered startup and Back/Forward navigation; unavailable identities return to the owned directory.

At narrow widths, the directory/home sidebar collapses without changing the saved wide-window preference. The user can toggle it. Starter cards stack, and all send/edit controls remain within the visible page.

## Evidence and delivery

Thirteen rendered full-app workflows passed against the exact frozen UI, with no renderer errors. They cover directory/search/retired records, durable pins, editable templates, real saved-record shapes, connection status and compound labels, exact isolated memory scope, automation access, deep links/restored startup, partial read failure, one chosen-agent prompt submission, draft preservation, activity navigation, narrow layout and unavailable identities. These workflows use a controlled bridge and generated accounts; they make no production inference requests.

Eight additional full-app queue and steering scenarios passed against the same renderer. They verify delayed acknowledgements across navigation, newer unsent text, stale draft reads, model/options capture, refused submission and local draft-clear failure without repeated sending.

Fresh read-only Chrome inspection confirmed the reference's Activity, Apps and Memory tabs, actual app access rows and memory folders. The native Agentopia window was inspected after installation for the actual saved identity, activity, assigned connections and private/project folders. No production prompt, schedule, memory edit or assignment was submitted during visual inspection.

The first native Apps inspection revealed the compound-label case, which was corrected and added to the final rendered test. An initial file-hash check also detected a re-encrypted local store. A read-only isolated Electron comparison found **every decrypted entry identical** to its recovery copy. No plaintext credential values were returned or written. The installation verifier now handles this exact-value comparison when ciphertext changes.

Current build: `.supabase/desktop-agent-directory66/1792694968141/proof.json`.
Full-app checks: `rendered-1792695027761/evidence.json` under that build.
Draft checks: `F:/Agentopia-Acceptance/chat-acceptance-drafts/1792695037344/evidence.json`.
The current `installed.json` receipt under that build records the final installation and saved-data comparison.

## Remaining parity

The full-page agent editor, editable agent-specific starter cards and avatars, home-page dictation, organization-wide agent discovery/sharing, and working external channels remain separate work. Current pins are local preferences. The template banner and owned directory do not establish cloud execution or 24/7 operation. The broader scheduled-workspace recovery, physical reboot and long unattended acceptance gates remain open.
