# Managed agent draft recovery

October 28, 2026. Installed on the active Sylvana 0.46.0 application as `managed-agent-draft-1`.

## Cause and change

The editor selects the `sylvana` provider for managed web accounts. New-agent and saved-agent draft validators still accepted only `openai-oauth` and `openrouter`. An otherwise valid empty form therefore failed draft validation, and Back's required save refused to leave the editor. Changing only the provider in the reproduction made the same form pass. Two new regression checks failed against the original compiled validators with the reported errors.

Both passive draft validators now accept the existing `sylvana` provider. Unknown provider values, ownership rules, scope restrictions, revision conflicts, field limits, and execution validation remain enforced. Storing a managed draft grants no additional inference or tool capability.

The old validator retained rejected forms in the local recovery journal. The editor previously skipped recapturing an unchanged payload, which could leave a now-valid recovered form marked rejected after an update. Capture now revalidates when a draft error remains, using the existing store and its ownership, conflict, and validation guards. No draft format or stored content is rewritten by a migration.

## Verification and delivery

Type checking and 31 focused draft, storage, ownership, revision, and recovery checks passed. Three controlled Electron UI checks cover an empty managed Create agent → Back sequence, edited fields surviving leave/reopen without creating an agent, and cold recovery of an unchanged managed draft rejected by the old validator. Those UI checks use generated identities and the actual draft store. They send no inference request.

The candidate application archive differs from the installed 0.46.0 archive in exactly two compiled validator modules. All other 3,681 files retain their bytes. The production UI build passed, and all 223 delivered UI files were verified after installation. The selected profile and its files remained unchanged while resources were replaced.

Sylvana closed normally before installation. A verified copy of all 72 closed-profile files is protected at `F:/Sylvana-Data/profiles/private-recovery/20261028-agent-draft-provider/closed-profile`. Previous application and UI resources remain on F: for rollback. Temporary duplicates on the system drive were removed after verifying those copies.

Native inspection of the reopened installed application confirmed the same account, exact existing builder text, and Back returning to chat without an error banner. No agent was created and no builder text was submitted to AI. Evidence and the installation receipt are in `F:/Sylvana/verification/agent-draft-provider-20261028/`. This focused installed repair is included in subsequent builds; no replacement full installer was published as part of this repair.
