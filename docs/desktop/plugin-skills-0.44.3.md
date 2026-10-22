# Private plugin-skill installer 0.44.3

**Later qualification:** do not promote this installer. An overlap test found a derived-cache cleanup defect, corrected in the separate 0.44.4 portable candidate. Actual native child lifecycle and UI checks are also recorded in the [follow-up](plugin-child-lifecycle.md). The frozen artifact and its original verification records remain unchanged.

October 17, 2026. The Windows installer is built and its payload is verified. It remains uninstalled. The ordinary app stays on 0.43.7, with production schema 45. This candidate follows the unchanged 0.44.2 installer.

## Result and behavior

The candidate contains reviewed portable plugin skills: instructions, references, helper scripts and assets remain under one package digest. Assign packages to active agents, then select a skill through the chat Add menu. Real Codex discovery and native skill inputs use the same procedure across ChatGPT and OpenRouter. Standard users can read the reviewed references through scoped host tools; script execution retains existing command permissions. Revocation removes discovery, invalidates affected native workers and leaves stale draft selections explicitly removable. [Feature behavior, public documentation and source evidence](plugin-skills.md).

The slimmer caption, header, dividers and sidebar behavior are preserved. Only plugin/skill styles were appended, including spacing between the plugin import utility links.

## Exact artifact

- Installer: `.supabase/desktop-plugin-skills/candidate-0443/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe`
- Installer bytes: 1502585344
- Installer SHA-256: `0d683340a00a5c93080e2a51efa35b58536ca3e7ecdabca9fedd954a91de10e9`
- Application archive SHA-256: `9676fd3a68ef4eddc4c6ee6d2d37b5e17cf19e3dcd2a75d331b4a985062dc891`
- Version/schema metadata: 0.44.3 / 55; all 55 earlier migrations match the base.

The package contains 1,014 compiled modules: six changed, three added and 1,005 unchanged from 0.44.2. All 2,232 dependency files and 6,132 runtime resources outside UI/version metadata match the earlier candidate. The copied source snapshot and archive/module/resource comparisons are recorded under the candidate directory. The root development package remains at its coordinated 0.43.6 value.

## Verification and practical limits

81 focused checks pass against modules byte-matched to the archive. They exercise actual Codex skill discovery and turns with controlled ChatGPT/OpenRouter responses, native helper execution under Full access, a standard-user reference read through private MCP with saved chat activity, permission boundaries, package integrity, revocation, provider defaults, named-agent policy/queues/references and session persistence.

Five workflows pass in the delivered minified interface with the candidate's native binary and byte-matched backend modules: review, explicit install/assignment, chat skill selection, provider switching and revoked-selection recovery. Picker/account/installation state is controlled in this interface fixture. The earlier seven generated-record checks independently exercised the real Broker and running Supabase API, then removed their temporary records.

Six installer payload checks verify the setup hash, every delivered resource path and size, complete package archive integrity, the exact application archive, migration/schema metadata, and the full package embedded in Setup. Pinned Squirrel helper bytes are restored after installer creation.

The first verifier invocation completed the first five checks and stopped on its stale 0.44.2 filename pattern. Its failure record is retained as `installer-verification/evidence-initial-version-pattern.json`. The corrected final step binds the RELEASES filename to the recorded 0.44.3 full package and verifies its byte length, SHA-1 and complete embedded SHA-256. No installer rebuild was required.

The final read-only observation reports 2 accounts, 101 conversations, 338 messages and 45 production migrations. No installation, migration, service start, OAuth renewal or live inference was performed. The retained original WSL distribution remains stopped.

Evidence under `.supabase/desktop-plugin-skills/candidate-0443/`: `preparation.json`, `package-proof.json`, `units/evidence.json`, `built-ui/evidence.json`, `qualification.json`, `installer-proof.json`, `installer-verification/evidence.json`, `final-observation.json` and `release-proof.json`.

## Remaining gates

The read-only authorization check at `.supabase/desktop-workspace-agents/authorization/1792291680042/evidence.json` still finds an expired saved ChatGPT authorization. It makes no renewal attempt and writes no canonical credential data. Fresh human authorization is required before the pending actual model-driven browser and skill checks.

Installed skill import/selection, restart recovery and revocation during actual child work remain to be verified. Installation must follow a fresh verified backup and coordinated upgrade, preserving the user's accounts, history and credentials. Clean-machine and Windows reboot acceptance remain open. This installer checkpoint does not declare the broader desktop goal complete. [Complete acceptance table](capability-acceptance-snapshot.md).
