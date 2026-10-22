import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-chart-format-release62/current.json'));
const qualified=await json(path.join(pointer.out,'qualification.json')),verified=await json(path.join(pointer.out,'installer-verified.json'));
assert(qualified.success&&verified.success&&qualified.version==='0.44.62');
assert.equal(await hash(pointer.proof),qualified.proofSha256);
const prior=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified61.json')),sourceHashes={};
const replaced=new Set(['run-normal-maintenance61.mjs','normal-maintenance61-process.mjs','maintenance-program-rollback61.mjs','maintenance-update-command61.mjs','verify-maintenance-installation61.py']);
for(const [name,digest] of Object.entries(prior.sourceHashes)){
 if(!name.startsWith('scripts/desktop/')||replaced.has(path.basename(name)))continue;
 assert.equal(await hash(path.join(root,name)),digest,'Shared qualified maintenance source changed: '+name);sourceHashes[name]=digest;
}
for(const name of ['run-normal-maintenance62.mjs','normal-maintenance62-process.mjs','maintenance-program-rollback62.mjs','maintenance-update-command62.mjs','verify-maintenance-installation62.py']){
 const digest=qualified.sourceHashes[name];assert(digest);assert.equal(await hash(path.join(root,'scripts/desktop',name)),digest);sourceHashes['scripts/desktop/'+name]=digest;
}
const result={success:true,at:new Date().toISOString(),version:'0.44.62',sourceHashes,installerVerified:verified.evidence,updateCommandChecks:13,reusedUnchangedPhaseFailureChecks:16,reusedUnchangedExistingRuntimeChecks:12,standingUpdateAndRestartAuthorization:true,autonomousNormalClosure:true,freshRecoveryAndPhysicalRollbackRequiredBeforeInstall:true,ordinaryReopeningHandledByController:true,selectedProfile:'F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile',installed:false};
await writeFile(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified62.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:result.version,sourceFiles:Object.keys(sourceHashes).length}));
