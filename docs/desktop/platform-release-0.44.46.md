# Agentopia 0.44.46 — composer menu, settings and viewer chrome

Status: installed through normal Windows Explorer, with verified UI corrections 1, 2 and 3 and successful ordinary-account/cold-reopening acceptance.

The update replaces composer configuration dialogs with dedicated Settings pages, puts attachments and chat actions first in the + menu, adds a context picker, and reduces document viewing to one compact toolbar. See [the comparison and limits](ui-parity-composer-viewer.md).

The final frozen payload is under `C:/Users/charl/AgentopiaQA/menu-viewer-release/1792448277330`. Its backend archive SHA-256 is `7aa5f96384e7d8e13145ea4478065327a09b02ae88114c51454e80f6df32ea99`. The full resource manifest also identifies the UI assets, which are outside that archive. There is no database schema change: schema 69 and the prior runtime resources are retained.

Qualification passed 63 local backend checks and 16 interface workflows against the frozen source and delivered viewer assets. The actual full app also passed five conversation-reading workflows against the delivered UI. Those checks use controlled responses and make no paid model requests.

The checked recovery is `C:/Users/charl/AgentopiaRecovery/before-04446/1792447705031`. It contains 3,692 ordinary-profile files, 3,053 Store-profile files, five logical database backup files and a 6,274,678,784-byte cold database image. A read-only check recovered the two account records/passwords, 109 chats, 380 messages and 190 request records, along with retained search citations, native thread/turn records, the prior image/answer and two child-chat results/reports. It started no database services and sent no model requests.

Earlier uninstalled snapshots remain under `candidate-04446-before-menu-alignment`, `candidate-04446-before-context-recovery`, `candidate-04446-before-preview-refresh` and `candidate-04446-before-app-mentions`. Packaging was stopped as the context, refresh and live app-selection checks found corrections, and each job's original packaging helpers were verified restored. Installation must use only the final candidate's verified installer.

Installation is covered by the user's standing authorization recorded in AGENTS.md. The release receipts live in `.supabase/desktop-platform-release/candidate-04446`. Installed account, file-action, settings and cold-reopening results will be recorded there separately. The broader desktop parity goal remains incomplete.

## Installed acceptance

The installer passed seven integrity groups covering 7,444 packaged resources. Its SHA-256 is `5241a948473a95dc1ba3042f8f6a11bebebae7f62c38f8b101988e09a6098dc1`. The ordinary upgrade comparison matched all 126 checked tables and 1,658 saved rows, including passwords and encrypted records. The native Download action saved an identical PDF copy in the owned QA folder. Settings pages, real skill discovery, the composer menu, Word/PDF layout and restored ChatGPT selection were inspected in the ordinary app.

A final UI-only correction clears a pending chat-excerpt read when its popover is dismissed. It passed 17 interface workflows and five delivered-app reading checks, then replaced only the closed app's UI assets with the previous UI retained for rollback. All 7,443 installed resource hashes matched the final manifest. Normal Explorer reopening restored the account, ChatGPT model and both document tabs. A subsequent comparison confirmed the 216 final UI files and unchanged saved core counts, with no request replay. The final resource-manifest SHA-256 is `70a0bb1caed1a13b792b6e071a534aa6b81b3682a10af564f65fb681a7741d53`.

The full 0.44.46 installer contains the qualified baseline UI; the currently installed app additionally contains UI correction 1. Reinstalling that baseline installer requires reapplying the verified UI correction. The next full installer should incorporate the correction. The source, frozen UI, rollback copy and activation/check receipts are retained in `ui-hotfix-*.json` and `C:/Users/charl/AgentopiaQA/menu-viewer-ui-hotfix/1792449195963`. This distinction is recorded in release-proof.json.

Composer sizing correction 2 is installed and reopened. Send and Stop now use 28-pixel circles in wide and narrow panels, with scaled and centered icons. Twenty-five local workflows pass; the post-reopening data comparison preserves all 126 checked tables. [Sizing details, recovery scope and evidence](composer-button-sizing.md). The baseline installer remains unchanged and requires these UI corrections when reinstalled.

Workspace navigation correction 3 is installed and verified with the ordinary account. The header provides ChatGPT/Codex mode choices, notifications and search; the account avatar now lives at the rail bottom. Project/task mode choices survive reopening and remain separate from agent/provider selection. Fifty-two controlled workflows pass, including persistent-agent forms and built-agent selection. [Comparison, evidence and remaining scope](workspace-navigation-parity.md).
