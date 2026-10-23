// Finish the qualified restore after its first completed document read was
// checked against a thread predating the library's intentional scope changes.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {finishNativeLibraryRecovery71,coldLibraryRecovery71} from './agent-library-recovery71-workflows.mjs';

desktopOperation('finish restored71 reference-scope and cold persistence checks without replay');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-library71-real/current.json'));
const cfg=await json(pointer.restoredIntent),candidate=await json(pointer.candidateFile),source=await json(pointer.sourceIntent),receipt=await json(path.join(source.out,'documents-recovery-source-accepted.json'));
const sourceProof=await json(receipt.evidence),f=await json(receipt.checkpoint),saved=await json(sourceProof.savedRecords),checkpoint=path.join(cfg.out,'restore-checkpoint.json'),progress=await json(checkpoint);
const priorFile=path.resolve(process.argv[2]);assert(priorFile.startsWith(cfg.out+path.sep));const prior=await json(priorFile),probe=await json(path.join(prior.out,'restored-app/evidence.json'));
assert(!prior.success&&prior.checks.length===4&&prior.actualPasswordSignIn&&prior.error.includes('Expected values to be strictly equal'));
assert.equal(probe.failureCleanupNormalExit,0);assert.equal(probe.controlledNetwork.calls.length,2);assert(probe.controlledNetwork.calls.every(row=>row.requestId===progress.requestId));assert.deepEqual(probe.controlledNetwork.blocked,[]);assert.deepEqual(probe.controlledNetwork.errors,[]);
const complete=await json(prior.completeDatabaseAudit);assert(complete.success&&complete.tablesCompared===128&&complete.schemaMigrations===72);
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),candidate.imageSha256);assert.equal(prior.imageSha256,candidate.imageSha256);assert(!(await list(true)).includes(cfg.distribution));assert(!(await list(true)).includes(source.distribution));
const out=path.join(cfg.out,'acceptance-'+Date.now());await mkdir(out);const e={...prior,success:false,at:new Date().toISOString(),out,checks:[...prior.checks],priorPassedEvidence:priorFile};delete e.error;
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2)),check=async text=>{e.checks.push(text);await save();console.log('PASS '+text);};await save();
try{
 const resumed=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'restored-app')),testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,
  runReady:async({application,page})=>{assert.equal((await page.evaluate(()=>window.agentopia.call('auth.state'))).identity?.id,f.owner);return finishNativeLibraryRecovery71({application,page,f,saved,progress,checkpoint,e,out,check,inheritedOriginalResponses:2});}});
 assert.equal(resumed.normalExit,0);assert(!(await list(true)).includes(cfg.distribution));e.restoredNormalExit=0;
 const cold=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'cold-app')),testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,
  runReady:({application,page})=>coldLibraryRecovery71({application,page,f,progress,out})});
 assert.equal(cold.normalExit,0);assert.equal(cold.controlledNetwork.calls.length,0);assert(!(await list(true)).includes(cfg.distribution));
 Object.assign(e,{coldNormalExit:0,coldModelRequests:0,runtimeStopped:true});await check('A second cold reopening retains sign-in, eight completed requests, both intentionally revoked requests, all three originals and both retained versions, without inference or replay; sessions close normally.');
 e.success=true;await save();await writeFile(path.join(cfg.out,'documents-recovery-accepted.json'),JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checkpoint},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checks:e.checks.length,sourceTablesCompared:128,currentOriginals:3,previousOriginals:2,coldModelRequests:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await save();console.error('Inspect continuation evidence at '+out+' before another action.');process.exitCode=1;}
