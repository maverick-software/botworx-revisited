// Preserve the qualified85 application; replace and qualify its single recovery reader.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,copyFile,link,writeFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list,run,linux} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {qualified85Proof,qualified85ProofSha256,recoveryResource,approvedRecoverySha256,assertRelease85Recovery} from './release85-recovery-compat.mjs';

assert.deepEqual(process.argv.slice(2),['--prepare-and-qualify']);
desktopOperation('qualify exact85 recovery-reader compatibility correction');
const root='F:/Agentopia',exec=promisify(execFile),original=await json(qualified85Proof),originalQualification=path.join(original.out,'qualification.json'),q=await json(originalQualification),upgradeFile=path.join(original.out,'upgrade-check/evidence.json'),upgrade=await json(upgradeFile),prior=await json(original.qaIntent);
assert.equal(await hash(qualified85Proof),qualified85ProofSha256);assert(q.success&&upgrade.success&&upgrade.coldNoReplay&&upgrade.qaRuntimeStopped);
assert.equal(await hash(path.join(root,'desktop',recoveryResource)),approvedRecoverySha256);
assert(!(await list(true)).includes(prior.distribution));
const git=async args=>(await exec('git',args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:2000000})).stdout.trim();
await git(['diff','--exit-code','HEAD','--','desktop','scripts/desktop']);const commit=await git(['rev-parse','HEAD']);
const out=path.join(root,'.supabase/desktop-release85',String(Date.now())),program=path.join(out,'program'),assets=path.join(program,'resources/resources'),sourceRoot=path.join(out,'source'),source=path.join(sourceRoot,'desktop');await mkdir(out);
const e={success:false,at:new Date().toISOString(),out,version:original.version,imageSha256:original.imageSha256,providerRequests:0,ordinaryProfileWrites:0,originalQualification: {file:originalQualification,sha256:await hash(originalQualification)},originalUpgrade:{file:upgradeFile,sha256:await hash(upgradeFile)},automaticUpgradeRepeated:false},save=()=>writeFile(path.join(out,'preparation.json'),JSON.stringify(e,null,2));await save();
async function cloneFile(from,to,digest,copy=false){assert.equal(await hash(from),digest,from);await mkdir(path.dirname(to),{recursive:true});await(copy?copyFile(from,to):link(from,to));assert.equal(await hash(to),digest,to);}
try{
 for(const[name,digest]of Object.entries(original.programFiles))await cloneFile(path.join(original.program,name),path.join(program,name),digest);
 const resourceFiles={...original.resourceFiles,[recoveryResource]:approvedRecoverySha256};
 for(const[name,digest]of Object.entries(resourceFiles))await cloneFile(name===recoveryResource?path.join(root,'desktop',name):path.join(original.assets,name),path.join(assets,name),digest,name===recoveryResource||['runtime/config.toml','runtime/database_state.py'].includes(name));
 const sourceHashes={...original.sourceHashes,[recoveryResource]:approvedRecoverySha256};
 for(const[name,digest]of Object.entries(sourceHashes))await cloneFile(name===recoveryResource?path.join(root,'desktop',name):path.join(original.source,name),path.join(source,name),digest,name===recoveryResource);
 for(const[name,digest]of Object.entries(original.compiled))await cloneFile(path.join(original.source,'build',name),path.join(source,'build',name),digest);
 for(const name of ['package.json','package-lock.json'])await copyFile(path.join(original.sourceRoot,name),path.join(sourceRoot,name));
 const qaProgram=path.join(out,'qa/program');
 for(const[name,digest]of Object.entries(original.programFiles))await cloneFile(path.join(program,name),path.join(qaProgram,name),digest);
 for(const[name,digest]of Object.entries(resourceFiles))await cloneFile(name==='runtime/config.toml'?path.join(prior.assets,name):path.join(assets,name),path.join(qaProgram,'resources/resources',name),name==='runtime/config.toml'?prior.testConfigSha256:digest,['runtime/config.toml','runtime/database_state.py',recoveryResource].includes(name));
 const cfg={...prior,out:path.join(out,'qa'),temp:path.join(out,'qa/temp'),program:qaProgram,exe:path.join(qaProgram,'Agentopia.exe'),assets:path.join(qaProgram,'resources/resources'),configFile:path.join(qaProgram,'resources/resources/runtime/config.toml'),imageSha256:original.imageSha256};await writeFile(path.join(out,'qa-intent.json'),JSON.stringify(cfg,null,2));
 const p={...original,out,program,assets,sourceRoot,source,sourceCommit:commit,applicationSourceCommit:original.sourceCommit,exe:path.join(program,'Agentopia.exe'),image:path.join(program,'resources/app.asar'),ui:path.join(assets,'ui'),sourceHashes,resourceFiles,runtimeResourcesUnchanged:false,qualifiedApplicationProof:qualified85Proof,qualifiedApplicationProofSha256:qualified85ProofSha256,runtimeResourceChanges:[{file:recoveryResource,before:original.resourceFiles[recoveryResource],after:approvedRecoverySha256}],sourceChanges:[...original.sourceChanges,recoveryResource],qaIntent:path.join(out,'qa-intent.json'),preparation:path.join(out,'preparation.json'),sourceQualification:path.join(out,'preparation.json')};
 await assertRelease85Recovery(p);
 for(const mutate of [v=>v.imageSha256='0'.repeat(64),v=>v.resourceFiles['runtime/config.toml']='0'.repeat(64),v=>v.runtimeResourceChanges=[],v=>v.qualifiedApplicationProofSha256='0'.repeat(64)]){const bad=structuredClone(p);mutate(bad);await assert.rejects(assertRelease85Recovery(bad));}
 e.invalidCandidateMutationsRejected=4;
 const proof=path.join(out,'package-proof.json');await writeFile(proof,JSON.stringify(p,null,2));
 for(const name of ['composio-public-jwks85.json','composio-service-policy85.json'])await cloneFile(path.join(original.out,name),path.join(out,name),await hash(path.join(original.out,name)));
 // Validate the exact sealed backup that exposed the mismatch, including raw files.
 const backupOut=path.join(original.out,'installation-1793035888940/recovery'),intent={...await json(path.join(backupOut,'intent.json')),assets},intentFile=path.join(out,'retained-backup-intent.json');await writeFile(intentFile,JSON.stringify(intent,null,2));
 const validation=await exec(path.join(assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/verify-maintenance-ordinary75.py'),intentFile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:300000,maxBuffer:1024*1024});e.retainedRecovery=JSON.parse(validation.stdout);assert(e.retainedRecovery.success&&e.retainedRecovery.portableCapability===18);await save();
 const protectedBefore={};for(const name of ['credentials.bin','Local State','runtime-binding.json'])protectedBefore[name]=await hash(path.join(cfg.profile,name));const backupsBefore=(await readdir(path.join(cfg.profile,'backups'))).sort();
 console.log('Exact retained recovery now validates. Checking the corrected packaged application in the isolated account.');
 const cold=await launchDurableProfileProbe(cfg,{label:'recovery85-cold',testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,hiddenWindow:true,startupTimeoutMs:900000,normalCloseTimeoutMs:120000,runReady:async({application,page})=>{
  assert.equal(await application.evaluate(({app})=>app.getVersion()),p.version);assert.deepEqual(await page.evaluate(()=>window.agentopia.call('native.active')),[]);
  const code="import sys,json;sys.path.insert(0,'/mnt/f/Agentopia/scripts/desktop');from audit_logical_snapshot71 import audit;print(json.dumps(audit(sys.argv[1],sys.argv[2],sys.argv[3],60750,composio_service_policy=json.load(open(sys.argv[4])),expected_new_migration=json.load(open(sys.argv[5]))['newMigration'])))";const auditOut=path.join(out,'database-audit');await mkdir(auditOut);e.database=JSON.parse(await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3','-c',code,linux(upgrade.automaticBackup.directory),linux(auditOut),cfg.instance,linux(path.join(out,'composio-service-policy85.json')),linux(proof)],120000));assert(e.database.success&&e.database.allOriginalRowsComparedWithoutExclusions&&e.database.tablesCompared===144);return {version:p.version,activeNativeRequests:0};
 }});
 assert(cold.success&&cold.normalExit===0&&cold.controlledNetwork.calls.length===0);assert(!(await list(true)).includes(cfg.distribution));assert.deepEqual((await readdir(path.join(cfg.profile,'backups'))).sort(),backupsBefore);
 e.coldEvidence=path.join(cold.out,'evidence.json');e.coldNoReplay=true;e.qaRuntimeStopped=true;e.protectedFilesUnchanged={};for(const[name,digest]of Object.entries(protectedBefore))e.protectedFilesUnchanged[name]=await hash(path.join(cfg.profile,name))===digest;assert(e.protectedFilesUnchanged['Local State']&&e.protectedFilesUnchanged['runtime-binding.json']);
 const frozen={};for(const name of [...Object.keys(q.sourceHashes),'release85-recovery-compat.mjs','prepare-release85-recovery.mjs'])frozen[name]=await hash(path.join(root,'scripts/desktop',name));
 for(const[name,digest]of Object.entries(q.sourceHashes))if(!['squirrel-stub-integrity75.mjs','install-release77.mjs'].includes(name))assert.equal(frozen[name],digest,name);
 const qualification={...q,at:new Date().toISOString(),proof,proofSha256:await hash(proof),sourceHashes:frozen,originalApplicationQualification:e.originalQualification,inheritedAutomaticUpgradeEvidence:e.originalUpgrade,automaticUpgradeRepeated:false,recoveryCompatibilityValidated:true,targetedColdEvidence:{file:e.coldEvidence,sha256:await hash(e.coldEvidence)},retainedRecovery:e.retainedRecovery};await writeFile(path.join(out,'qualification.json'),JSON.stringify(qualification,null,2),{flag:'wx'});
 e.success=true;await save();const upgraded={...e,automaticBackup:upgrade.automaticBackup,inheritedWarmEvidence:upgrade.warmEvidence};await mkdir(path.join(out,'upgrade-check'));await writeFile(path.join(out,'upgrade-check/evidence.json'),JSON.stringify(upgraded,null,2));
 await assertRelease85Recovery(p);for(const[file,digest]of [[qualified85Proof,qualified85ProofSha256],[originalQualification,e.originalQualification.sha256],[upgradeFile,e.originalUpgrade.sha256]])assert.equal(await hash(file),digest);
 await writeFile(path.join(root,'.supabase/desktop-release85/current.json'),JSON.stringify({out,proof},null,2));await writeFile(path.join(root,'.supabase/desktop-release85/upgrade-current.json'),JSON.stringify({out:path.join(out,'upgrade-check'),evidence:path.join(out,'upgrade-check/evidence.json')},null,2));console.log(JSON.stringify({success:true,out,proof,retainedRecovery:true,coldNoReplay:true,providerRequests:0}));
}catch(error){e.error=error.message;await save();throw error;}
