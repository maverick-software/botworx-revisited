// Resume explicit maintenance phases from receipts; never repeat an update or model turn.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {desktopOperation} from './operation-lock.mjs';
import {hash,closed,linux,run,json} from './phased-backup-control.mjs';
import {captureMaintenancePortable} from './capture-maintenance-portable.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {auditRelocatedNative} from './audit-relocated-native54.mjs';
import {reopenOrdinaryAgentopia} from './normal-close-agentopia54.mjs';
import {probeMaintenanceWindowsContext} from './maintenance-windows-context.mjs';

desktopOperation('production private profile relocation54');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),phase=process.argv[2];
assert.equal(root.toLowerCase(),'f:\\agentopia');
const proof=await json((await json(path.join(root,'.supabase/desktop-profile-release54/current.json'))).proof);
assert(proof.success&&proof.version==='0.44.54');
const source=path.resolve('C:/Users/charl/.agentopia/desktop/profile'),home=path.resolve('C:/Users/charl'),instance='a91a4800-e08f-4440-a4ec-588762d01bfd',distro='AgentopiaRuntime-'+instance,target=path.resolve('F:/Agentopia-Data/profiles',instance,'profile'),program=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.54'),exe=path.join(program,'Agentopia.exe'),selector=path.join(home,'.agentopia/desktop/profile-location.json'),pointer=path.join(root,'.supabase/desktop-profile-release54/production-relocation-current.json');
assert.equal(await hash(path.join(program,'resources/app.asar')),proof.imageSha256);
const command=async(file,args,timeout=180000)=>(await exec(file,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout,maxBuffer:8*1024*1024})).stdout.trim();
const wsl=async(script,args=[],timeout=180000)=>JSON.parse(await run(['-d',distro,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop',script)),...args],timeout));
const protect=async dir=>{const sid=await command('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value']);assert(/^S-1-5-[0-9-]+$/.test(sid));await command('icacls.exe',[dir,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q']);};
let out,e;
if(phase==='prepare'){
 await assert.rejects(access(target),{code:'ENOENT'});await assert.rejects(access(pointer),{code:'ENOENT'});
 out=path.join(root,'.supabase/desktop-normal-maintenance',String(Date.now()));await mkdir(out,{recursive:true});await protect(out);
 e={success:false,at:new Date().toISOString(),out,source,target,instance,version:proof.version,imageSha256:proof.imageSha256,steps:[],providerRequests:0,fullGoalComplete:false};await writeFile(pointer,JSON.stringify({out,evidence:path.join(out,'relocation.json')},null,2),{flag:'wx'});
}else{({out}=await json(pointer));e=await json(path.join(out,'relocation.json'));}
const save=()=>writeFile(path.join(out,'relocation.json'),JSON.stringify(e,null,2));
const done=async step=>{assert(!e.steps.includes(step));e.steps.push(step);await save();console.log('PASS '+step);};
const python=path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe');
const drive=async(mode,...args)=>{const lines=(await command(python,['-I','-B',path.join(root,'scripts/desktop/production-relocation-driver54.py'),out,mode,...args],1200000)).split(/\r?\n/);for(const line of lines.slice(0,-1))console.log(line);return JSON.parse(lines.at(-1));};
const inventory=async directory=>{const result=await drive('inventory',directory);assert(result.success);return json(result.inventory);};
try{
 const context=await probeMaintenanceWindowsContext();assert(context.success);e.windowsContext=context;await save();
 if(phase==='prepare'){
  const logicalBefore=await json(path.join(root,'.supabase/desktop-production-logical/current.json'));
  const readiness=await wsl('runtime-maintenance-readiness54.py',[linux(logicalBefore.out)]);assert.equal(readiness.unfinishedRequests,0,'Active agent work must finish before closure');e.beforeClose=readiness;await save();
  // A separately named helper preserves the sealed historical .53 updater.
  const closeSource=(await readFile(path.join(root,'scripts/desktop/normal-close-agentopia54.mjs'),'utf8')).replace('app-0.44.53/Agentopia.exe','app-0.44.54/Agentopia.exe');
  const closeFile=path.join(root,'scripts/desktop/normal-close-current54.mjs');await writeFile(closeFile,closeSource);const {closeOrdinaryAgentopia}=await import('./normal-close-current54.mjs');
  e.normalClose=await closeOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256,ensureIdle:async()=>{assert.equal((await wsl('runtime-maintenance-readiness54.py',[linux(logicalBefore.out)])).unfinishedRequests,0);}});await done('Ordinary .54 app closed normally after fresh idle verification');
  const base=await json(proof.acceptedBase),earlier=await json(base.acceptedBase),existingHelper=path.join(earlier.assets,'runtime/database_state.py');assert.equal(await hash(existingHelper),proof.resourceFiles['runtime/database_state.py']);
  assert((await wsl('maintenance-existing-runtime52.py',['start-existing',linux(existingHelper),linux(out)],480000)).success);await closed();
  const captured=JSON.parse(await command(process.execPath,[path.join(root,'scripts/desktop/capture-production-logical.mjs')]));assert(captured.success);e.logical=await json(path.join(root,'.supabase/desktop-production-logical/current.json'));assert.equal(e.logical.out,captured.out);
  assert((await wsl('audit-production-logical.py',[linux(e.logical.out)])).success);await done('Fresh original database recovery and all saved account rows verified');
  const cfg={out:path.join(out,'recovery'),sourceProfile:source,sourceHome:home,sourcePublicRoot:path.join(home,'Agentopia Files'),logicalSnapshot:e.logical.snapshot,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:proof.imageSha256,production:true,scope:'application-update'};
  await mkdir(cfg.out);await writeFile(path.join(cfg.out,'intent.json'),JSON.stringify(cfg,null,2),{flag:'wx'});assert((await captureMaintenancePortable(cfg)).success);
  assert(JSON.parse(await command(python,['-I','-B',path.join(root,'scripts/desktop/verify-maintenance-portable52.py'),path.join(cfg.out,'intent.json')],300000)).success);await done('Stopped Windows profile and portable recovery independently verified');
 }
 if(phase==='prepare'||phase==='stage'){
  assert(!e.staged);await closed();const cfg=await json(path.join(out,'recovery/intent.json'));assert((await json(path.join(cfg.out,'independent-verification.json'))).success);
  const sourceSeal=path.join(out,'source-seal.json');await writeFile(sourceSeal,JSON.stringify(await inventory(source)),{flag:'wx'});
  const raw=await json(path.join(cfg.out,'private-profile-recovery.json')),independent=path.join(cfg.out,'independent-verification.json'),backupEvidence=path.join(out,'backup-evidence.json');
  await writeFile(backupEvidence,JSON.stringify({success:true,sourceUnchanged:true,fullRawProfileVerified:true,sourceProfile:source,runtimeInstanceId:instance,sourceSealSha256:await hash(sourceSeal),rawProfileArchive:raw.destination,rawProfileArchiveSha256:await hash(raw.destination),independentVerification:independent,independentVerificationSha256:await hash(independent),historicalBackupsRetainedAndCopiedSeparately:true}),{flag:'wx'});
  const integrated=await json(path.join(proof.out,'integrated-migration-accepted.json')),compatibility=path.join(path.dirname(integrated.evidence),'migration-compatibility.json');assert(integrated.success&&integrated.imageSha256===proof.imageSha256);
  const plan={format:1,windowsHome:home,source,target,runtimeInstanceId:instance,targetVersion:proof.version,installedArchive:path.join(program,'resources/app.asar'),installedArchiveSha256:proof.imageSha256,selectorSha256:proof.compiled['desktop-profile-location.js'],sourceLocationSha256:await hash(selector),priorMigrationSha256:await hash(path.join(source,'profile-migration.json')),sourceSeal,sourceSealSha256:await hash(sourceSeal),backupEvidence,backupEvidenceSha256:await hash(backupEvidence),compatibilityEvidence:compatibility,compatibilityEvidenceSha256:await hash(compatibility),nativeRepairPythonSha256:proof.resourceFiles['script-runtimes/python-3.14.8/python.exe'],nativeRepairScriptSha256:proof.resourceFiles['runtime/relocate-native-profile.py'],out:path.join(out,'stage')};
  e.plan=path.join(out,'plan.json');await writeFile(e.plan,JSON.stringify(plan,null,2),{flag:'wx'});await save();
  const staged=await drive('stage');assert(staged.success&&!staged.activated&&staged.sourceRetained);e.staged=staged;await done('Verified physical profile copy staged on F with historical recovery and rebased native indexes');
 }else if(phase==='record-stage'){
  // The real controller finished successfully; its copy progress made the
  // original stdout parser refuse the multi-line result. Never replay the copy.
  assert(!e.staged);await closed();const staged=await json(path.join(out,'stage/stage-evidence.json')),plan=await json(e.plan);
  assert(staged.success&&!staged.activated&&staged.originalSelectorUnchanged&&staged.sourceRetained&&staged.historicalBackupsCopied);assert.equal(staged.target,target);assert.equal(staged.source,source);assert.equal(staged.sourceSealSha256,await hash(plan.sourceSeal));assert.equal(await hash(selector),plan.sourceLocationSha256);assert.equal(await hash(staged.copyEvidence),staged.copyEvidenceSha256);
  e.staged=staged;await done('Verified physical profile copy staged on F with historical recovery and rebased native indexes');
 }else if(phase==='validate'){
  assert(e.staged?.success&&!e.encrypted);await closed();
  const helperHome=path.join(out,'encryption-helper'),profile=path.join(helperHome,'AppData/Roaming/Agentopia');await mkdir(profile,{recursive:true});await copyFile(path.join(target,'Local State'),path.join(profile,'Local State'));
  const missing=randomUUID();await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution:'AgentopiaRuntime-'+missing,instanceId:missing}));
  const cfg={out,home:helperHome,roaming:path.dirname(profile),profile,legacy:profile,program:proof.program,exe:proof.exe,imageSha256:proof.imageSha256,temp:path.join(out,'encryption-temp')};
  const result=await launchDurableProfileProbe(cfg,{label:'copied-encryption',testProfile:false,initialProfile:profile,expectedProfile:profile,isolateOsHome:true,hiddenWindow:true,runMissing:async({application})=>application.evaluate(async({app,safeStorage},target)=>{const req=globalThis.__durableProbeRequire,{Secrets}=req(app.getAppPath()+'/build/secrets.js');if(!safeStorage.isEncryptionAvailable())throw Error('Windows encryption unavailable');const saved=new Secrets(target);await saved.load();if(!Object.keys(saved.values).length)throw Error('Copied credential store is empty');return {version:app.getVersion(),credentialsDecrypted:true,credentialRecords:Object.keys(saved.values).length};},target)});
  assert(result.success&&result.normalExit===0&&result.workflow.version===proof.version&&result.workflow.credentialsDecrypted);
  e.encrypted=path.join(out,'encrypted-evidence.json');await writeFile(e.encrypted,JSON.stringify({success:true,profile:target,imageSha256:proof.imageSha256,credentialsDecrypted:true,actualPackagedVersionObserved:true,realProviderRequests:0,credentialRecords:result.workflow.credentialRecords,evidence:path.join(result.out,'evidence.json')}),{flag:'wx'});await done('Exact packaged .54 decrypts the copied Windows credential store without backend or provider access');
  assert((await auditRelocatedNative({profile:target,source,proof,out:path.join(out,'native-audit')})).success);e.native=path.join(out,'native-audit/evidence.json');await done('Every copied native agent chat reads successfully with unchanged rollouts and no model turns');
 }else if(phase==='publish'){
  assert(e.encrypted&&e.native&&!e.published);await closed();const plan=await json(e.plan),staged=await json(path.join(out,'stage/stage-evidence.json')),targetSeal=path.join(out,'target-final-seal.json');await writeFile(targetSeal,JSON.stringify(await inventory(target)),{flag:'wx'});
  Object.assign(plan,{targetSeal,targetSealSha256:await hash(targetSeal),copyEvidence:staged.copyEvidence,copyEvidenceSha256:staged.copyEvidenceSha256,encryptedEvidence:e.encrypted,encryptedEvidenceSha256:await hash(e.encrypted),nativeEvidence:e.native,nativeEvidenceSha256:await hash(e.native)});await writeFile(e.plan,JSON.stringify(plan,null,2));
  assert((await drive('check')).success);e.published=await drive('publish');assert(e.published.published&&e.published.sourceRetained);await done('All recovery and copied-data receipts rechecked and F profile selector published atomically');
 }else if(phase==='reopen'){
  assert(e.published?.published&&!e.reopened);e.reopened=await reopenOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256});await done('Ordinary .54 application reopened through Explorer');
 }else throw Error('Use prepare, validate, publish or reopen');
}catch(error){e.error=error.stack;await save();throw error;}
await save();console.log(JSON.stringify({out,phase,steps:e.steps.length,profileSelected:e.published?.published??false,providerRequests:0}));
