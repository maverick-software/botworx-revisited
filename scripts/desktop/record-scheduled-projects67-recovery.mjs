import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {json,hash,save} from './phased-backup-control.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const records=path.join(root,'.supabase/desktop-scheduled-workspaces67');
const pointer=await json(path.join(records,'current-recovery.json'));
const recovery=await json(pointer.evidence),previous=await json(path.join(records,'workspaces-qualified.json'));
assert(recovery.success&&recovery.passed===22&&recovery.failed===0&&recovery.skipped===0&&recovery.cancelled===0);
assert(recovery.sourceOnly&&!recovery.installed&&recovery.providerRequests===0&&recovery.productionWrites===0);
for(const evidence of [previous,recovery])for(const [name,digest]of Object.entries(evidence.sourceHashes))assert.equal(await hash(path.join(root,name)),digest);
assert.equal(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,'0.44.66');
assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.66/resources/app.asar'),previous.installedImageSha256);
const pending=[
 'Connect the qualified recovery helpers to a production Git command runner, authenticated owner/run journal and exclusive maintenance barrier; add retained ready/partial/deleted-task review.',
 'Add one-use reviewed removal and tested restoration/opening; validate unchanged files, Git state, directory identities and request state before removal, and retain uncertain outcomes without retry.',
 ...previous.pending.slice(1),
];
const evidence={...previous,at:new Date().toISOString(),recoveryHelpers:pointer.evidence,recoveryCases:22,helperGitRunnerIsControlledFixture:true,productionRecoveryRoutingImplemented:false,archivalRemovalImplemented:false,restoreUiImplemented:false,sourceHashes:{...previous.sourceHashes,...recovery.sourceHashes},pending,fullFeatureComplete:false,fullGoalComplete:false,delivered:false};
await save(path.join(records,'recovery-qualified.json'),evidence);
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
ledger.at=evidence.at;
ledger.latestGoalTurnOutcome='progress:22 real-filesystem/Git recovery checks pass, including independent restoration of detached/reset-away commits, staged/unstaged versions, conflicts, resolve-undo, operation trees and split indexes. Helpers remain source-only and do not expose cleanup. Installed66/schema69 unchanged; image generation stays disabled with its connection retained.';
Object.assign(ledger.sourceWork67,{phase:'file and Git recovery helpers qualified; production maintenance routing, retained-workspace review, safe removal/restoration UI and packaged acceptance remain',qualification:path.join(records,'recovery-qualified.json'),recovery:pointer.evidence,recoveryCases:22,sourceHashes:evidence.sourceHashes,pending,productionRecoveryRoutingImplemented:false,archivalRemovalImplemented:false,restoreUiImplemented:false});
ledger.userPreferences={...ledger.userPreferences,imageGeneration:'disabled; retain existing connection for later explicit enablement'};
ledger.next[0]='Continue source67 from docs/desktop/scheduled-workspaces67-plan.md. Qualified foundation113, actual Git preparation18, shared tools78, rendered editor/results5 and recovery helpers22. Wire recovery through the production safe Git runner and exclusive owner/run maintenance journal, retained partial/deleted-run review, one-use archival removal and recovery UI. Then combined packaged PostgreSQL/Git/Codex warm/cold acceptance and recoverable installation. Installed66/schema69 remains unchanged. Keep images disabled; never replay completed goal68.';
await save(ledgerFile,ledger);
const file=path.join(root,'docs/desktop/scheduled-workspaces67-plan.md');
let plan=await readFile(file,'utf8');const marker='\n## Qualified file and Git recovery helpers\n';if(plan.includes(marker))plan=plan.slice(0,plan.indexOf(marker));
plan+=marker+`
Two new internal helpers create and verify streaming compressed recovery archives. Recovery includes all regular working files, ignored data, Unicode names, empty folders, a standalone index, local history and Git operation metadata. Every file has a recorded hash. Extraction accepts only the manifest's exact regular files and directories, uses a new destination, and rejects traversal, duplicate names, links, unlisted members, changed bytes and corrupted archives. Root Git control files are excluded from the working-files snapshot; Git metadata is captured separately for inspection before restoration. Private recovery contents are never model attachments.

A full Git bundle preserves reachable history but excludes the working tree and index, as described in [Git's bundle documentation](https://git-scm.com/docs/git-bundle). The helper additionally saves the index and a private synthetic commit containing staged and conflict/resolve-undo blobs, with local reflog commits as parents. Objects referenced by unfinished operation metadata are preserved too. This creates no source-branch or checkout commit. A journal callback receives intent before mutations and the exact temporary reference/commit; failures retain it for inspection. The temporary reference is removed only after the bundle and metadata snapshot verify. The production owner/run journal and safe command adapter still need wiring.

Twenty-two cases pass against actual Windows Git and filesystem paths, with generated repositories prepared through ScheduledWorkspaces and WorkspaceFiles. Fresh repositories with no original object database verify/unbundle the recovery and read reset-away detached commits, staged versions, three conflict stages, resolve-undo data, split indexes and an auto-merge tree. Separate working-file restoration preserves newer unstaged and ignored versions. Original source HEAD/index and original checkout index bytes remain unchanged. Negative cases cover damaged archives, changed files, hard links, junctions, nested external Git metadata, active index locks, external index claims, missing operation objects, cancellation, revoked authority and a persistence failure after temporary-reference creation. Completed or uncertain provider work is never replayed; these tests make zero provider requests and write no production data. Evidence: \`${pointer.evidence}\`.

Test development exposed an unhandled entry-stream error while rejecting invalid archives, differing slash formats in absolute Windows Git paths, long temporary-reference paths and a Git split-index timestamp refresh. Error handling and path normalization were corrected. Recovery references now use a compact hashed identity; the controlled Git runner enables Windows long paths, and bundle revisions are explicitly separated from filenames. Index inspection now uses a private Git-directory shell and copied shared indexes because GIT_INDEX_FILE alone still resolves shared files through GIT_DIR. The original metadata is compared before and after capture. Earlier failures are retained with their generated fixtures and logs.

This qualification covers helpers with a controlled trusted Git runner. It does not qualify production removal, the application's recovery UI, partial-workspace discovery or combined installed scheduling behavior. Nothing is deleted by these helpers. The remaining work is recorded in recovery-qualified.json and the acceptance ledger. Agentopia remains0.44.66/schema69; no new installer or migration was applied. The user reaffirmed that image generation should stay disabled while retaining its existing connection for later enablement.
`;
await writeFile(file,plan);
console.log(JSON.stringify({success:true,recoveryCases:22,sourceOnly:true,installed:'0.44.66',productionRecoveryRoutingImplemented:false,fullFeatureComplete:false}));
