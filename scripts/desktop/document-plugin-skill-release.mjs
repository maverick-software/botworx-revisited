import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-plugin-skills/candidate-0443'),proof=JSON.parse(await readFile(path.join(work,'release-proof.json'),'utf8'));assert(proof.success&&proof.version==='0.44.3'&&proof.installed===false&&proof.liveInferenceRequests===0);
const text=`# Private plugin-skill installer 0.44.3

October 17, 2026. The Windows installer is built and its payload is verified. It remains uninstalled. The ordinary app stays on 0.43.7, with production schema ${proof.production.migrations}. This candidate follows the unchanged 0.44.2 installer.

## Result and behavior

The candidate contains reviewed portable plugin skills: instructions, references, helper scripts and assets remain under one package digest. Assign packages to active agents, then select a skill through the chat Add menu. Real Codex discovery and native skill inputs use the same procedure across ChatGPT and OpenRouter. Standard users can read the reviewed references through scoped host tools; script execution retains existing command permissions. Revocation removes discovery, invalidates affected native workers and leaves stale draft selections explicitly removable. [Feature behavior, public documentation and source evidence](plugin-skills.md).

The slimmer caption, header, dividers and sidebar behavior are preserved. Only plugin/skill styles were appended, including spacing between the plugin import utility links.

## Exact artifact

- Installer: \`.supabase/desktop-plugin-skills/candidate-0443/staging/out/make/squirrel.windows/x64/AgentopiaSetup.exe\`
- Installer bytes: ${proof.installerBytes}
- Installer SHA-256: \`${proof.installerSha256}\`
- Application archive SHA-256: \`${proof.imageSha256}\`
- Version/schema metadata: 0.44.3 / 55; all 55 earlier migrations match the base.

The package contains 1,014 compiled modules: six changed, three added and 1,005 unchanged from 0.44.2. All 2,232 dependency files and 6,132 runtime resources outside UI/version metadata match the earlier candidate. The copied source snapshot and archive/module/resource comparisons are recorded under the candidate directory. The root development package remains at its coordinated 0.43.6 value.

## Verification and practical limits

${proof.unitChecks} focused checks pass against modules byte-matched to the archive. They exercise actual Codex skill discovery and turns with controlled ChatGPT/OpenRouter responses, native helper execution under Full access, a standard-user reference read through private MCP with saved chat activity, permission boundaries, package integrity, revocation, provider defaults, named-agent policy/queues/references and session persistence.

Five workflows pass in the delivered minified interface with the candidate's native binary and byte-matched backend modules: review, explicit install/assignment, chat skill selection, provider switching and revoked-selection recovery. Picker/account/installation state is controlled in this interface fixture. The earlier seven generated-record checks independently exercised the real Broker and running Supabase API, then removed their temporary records.

Six installer payload checks verify the setup hash, every delivered resource path and size, complete package archive integrity, the exact application archive, migration/schema metadata, and the full package embedded in Setup. Pinned Squirrel helper bytes are restored after installer creation.

The first verifier invocation completed the first five checks and stopped on its stale 0.44.2 filename pattern. Its failure record is retained as \`installer-verification/evidence-initial-version-pattern.json\`. The corrected final step binds the RELEASES filename to the recorded 0.44.3 full package and verifies its byte length, SHA-1 and complete embedded SHA-256. No installer rebuild was required.

The final read-only observation reports ${proof.production.users} accounts, ${proof.production.conversations} conversations, ${proof.production.messages} messages and ${proof.production.migrations} production migrations. No installation, migration, service start, OAuth renewal or live inference was performed. The retained original WSL distribution remains stopped.

Evidence under \`.supabase/desktop-plugin-skills/candidate-0443/\`: \`preparation.json\`, \`package-proof.json\`, \`units/evidence.json\`, \`built-ui/evidence.json\`, \`qualification.json\`, \`installer-proof.json\`, \`installer-verification/evidence.json\`, \`final-observation.json\` and \`release-proof.json\`.

## Remaining gates

The read-only authorization check at \`.supabase/desktop-workspace-agents/authorization/1792291680042/evidence.json\` still finds an expired saved ChatGPT authorization. It makes no renewal attempt and writes no canonical credential data. Fresh human authorization is required before the pending actual model-driven browser and skill checks.

Installed skill import/selection, restart recovery and revocation during actual child work remain to be verified. Installation must follow a fresh verified backup and coordinated upgrade, preserving the user's accounts, history and credentials. Clean-machine and Windows reboot acceptance remain open. This installer checkpoint does not declare the broader desktop goal complete. [Complete acceptance table](capability-acceptance-snapshot.md).
`;
await writeFile(path.join(root,'docs/desktop/plugin-skills-0.44.3.md'),text,{flag:'wx'});
for(const file of ['docs/desktop/implementation-status.md','docs/desktop/parity-backlog.md']){const old=await readFile(path.join(root,file),'utf8'),at=old.indexOf('\n'),section='\n\n## October 17 — private 0.44.3 plugin-skill installer\n\nReviewed portable skills now have a separately qualified Windows installer. Actual Codex controlled turns, native helper/reference permissions, 81 archived-module checks, five delivered chat-interface workflows and six complete installer payload checks pass. All 55 migrations and earlier runtime dependencies remain intact; production stays on installed 0.43.7/schema45. Live ChatGPT acceptance, installed recovery and child-work revocation remain open. [Exact artifact, evidence and limits](plugin-skills-0.44.3.md).';await writeFile(path.join(root,file),old.slice(0,at)+section+old.slice(at));}
const featureFile=path.join(root,'docs/desktop/plugin-skills.md');let feature=await readFile(featureFile,'utf8');feature=feature.replace('The feature has not been packaged or installed.','At this source checkpoint the feature had not been packaged or installed. It has since been packaged in the separate, uninstalled [0.44.3 candidate](plugin-skills-0.44.3.md).');await writeFile(featureFile,feature);
const capabilityFile=path.join(root,'docs/desktop/capability-acceptance-snapshot.md');let capability=await readFile(capabilityFile,'utf8');capability=capability.replace('Later portable plugin skills are separately source-qualified and remain outside that frozen image.','Portable plugin skills are separately packaged and controlled-tested in the uninstalled 0.44.3 candidate.');capability=capability.replace('The new package retains all earlier provider/harness modules byte for byte.','The 0.44.2 image retained prior provider/harness modules; 0.44.3 preserves the provider adapters and adds reviewed skill roots and grant validation to the native harness.');capability=capability.replace('Later source adds native Codex skill discovery/selection','The 0.44.3 candidate adds native Codex skill discovery/selection').replace('Package/install the skill follow-up; test restart/child revocation','Install the next qualified image; test restart/child revocation');await writeFile(capabilityFile,capability);console.log('Documented the verified private installer and remaining acceptance gates.');
