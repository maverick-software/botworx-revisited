# Live agent creation verification

The installed 0.44.85 application passed the live creation, follow-up, and save checks on October 26, 2026. The test used GPT-6.1 Sol through the saved ChatGPT OAuth connection in an isolated local account and database. The test copy matched the installed application archive and current UI resources. Production agents, chats, settings, and credentials were not modified by the test.

The request described a project meeting assistant that turns pasted notes into an agenda, progress summary, decisions, risks, and action items. The actual live response populated the editor automatically:

| Field | Verified result |
| --- | --- |
| Name | Project Meeting Brief |
| Icon | Briefcase, with the blue profile color |
| Description | A complete description of the meeting-brief workflow |
| Instructions | Populated ROLE, INSTRUCTIONS, and CONSTRAINTS sections, with detailed working steps and limits |
| Conversation starters | Four complete titles and prompts, covering meeting briefs, decisions, weekly syncs, and updates |

The test inspected the actual name and description inputs, instruction source, selected icon and color, and every starter title and prompt. No Apply or Review control was needed. The saved draft survived closing and reopening the isolated application. A live follow-up then changed only the description to the exact requested text; every other core field remained identical. Explicit Create saved one agent under the test account. Reading its agent record, profile, and presentation back from the normal APIs confirmed the saved name, description, instructions, icon, color, starters, and behavior.

Two real OAuth model requests completed successfully: the original creation and the follow-up. The original creation was not replayed. No OpenRouter requests, image generation, or agent tools were used. Temporary connection leases were removed and the isolated runtime stopped normally.

The runner initially needed two corrections: waiting for asynchronous cancellation during the local declaration capture, and avoiding a screenshot timeout after successful field verification. The acknowledged creation result was retained and rechecked after reopening before the follow-up. A missing continuation parameter was corrected before any further model dispatch. These were test-runner changes; the installed application required no changes for this acceptance.

The private test artifacts remain on F: with restricted access. The accepted summary is `F:/Agentopia/.supabase/desktop-builder-live89/1793039383588/accepted-summary.json`. The final acceptance receipt is `F:/Agentopia/.supabase/desktop-builder-live89/1793039383588/live87-builder89-live-20261026-c/evidence.json`; its SHA-256 is `d0f98313fdb0bcf91a5283b69a55da0d5ec20c1bb2a0409618ae4a79dbd0476d`. The initial completed creation is retained separately in the same test directory under `live87-builder89-live-20261026-a`.
