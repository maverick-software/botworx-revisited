// Launched by the visible .cmd from normal Windows. No ordinary-app UI is driven.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat,realpath,statfs} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,closed,linux} from './phased-backup-control.mjs';
import {inventoryPrivateProfile} from './capture-private-profile.mjs';
import {captureMaintenancePortable} from './capture-maintenance-portable.mjs';
import {probeMaintenanceWindowsContext} from './maintenance-windows-context.mjs';
import {runMaintenancePlan} from './maintenance-plan.mjs';
import {captureMaintenanceProgram} from './maintenance-program-rollback67.mjs';
import {maintenanceUpdateCommand,installedUpdater,installedUpdaterSha256} from './maintenance-update-command67.mjs';
import {closeOrdinaryAgentopia,reopenOrdinaryAgentopia} from './normal-maintenance67-process.mjs';

const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
const releasePointer=await json(path.join(root,'.supabase/desktop-scheduled-workspaces67-release/current.json')),release=releasePointer.out,packageProof=releasePointer.proof;
const distro='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd',profile='F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile',source='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.66';
const currentSha="74e4477cbbf3cbf3330e47ef5157646d0a113fd12fe786abdc776b654673d235",nextSha=(await json(packageProof)).imageSha256;
let job,phase='startup',proof,installer,setupSha,existingHelper,logical,backupCfg,backup,rollback,selectorHash,bindingHash;
const evidence={success:false,at:new Date().toISOString(),version:'0.44.67',installerInvoked:false,installed:false,ordinaryReopeningPending:true,rebootAcceptancePassed:false,fullGoalComplete:false,providerRequests:0,steps:[]};
const save=async()=>{if(job)await writeFile(path.join(job,'evidence.json'),JSON.stringify(evidence,null,2));};
async function privateCommand(exe,args,{timeout=120000,env=process.env,label='command'}={}) {
 try {return (await exec(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024,timeout,env})).stdout.trim();}
 catch(error) {await writeFile(path.join(job,'private-'+label+'-error.json'),JSON.stringify({message:error.message,stdout:error.stdout,stderr:error.stderr},null,2));throw Error(label+' failed. Private diagnostics: '+job);}
}
const wsl=async(script,args=[],label='runtime',timeout=120000)=>JSON.parse(await privateCommand('wsl.exe',['-d',distro,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop',script)),...args],{label,timeout}));
const checkIdentity=async()=>{assert.equal(await hash('C:/Users/charl/.agentopia/desktop/profile-location.json'),selectorHash,'The profile selector changed');assert.equal(await hash(path.join(profile,'runtime-binding.json')),bindingHash,'The runtime binding changed');};
async function unchangedRecovery(){
 await closed();await checkIdentity();
 const raw=await json(path.join(backupCfg.out,'private-profile-recovery.json'));
 assert.deepEqual(await inventoryPrivateProfile(profile),raw.manifest,'The closed profile changed after recovery');
 const manifest=await json(path.join(logical.snapshot,'manifest.json'));
 for(const row of manifest.files)assert.equal(await hash(path.join(logical.snapshot,row.name)),row.sha256);
}
const descriptions={requireClosed:'Checking that Agentopia is closed normally',normalWindows:'Checking the physical Windows installation location',preflight:'Checking the verified update and available F-drive space',existingServices:'Checking the existing database services and encryption keys',logicalRecovery:'Capturing a fresh consistent database recovery',profileRecovery:'Capturing the current profile, files, drafts and document tabs',verifyRecovery:'Independently verifying all recovery resources and saved database rows',programRollback:'Retaining the active program for rollback on F:',finalChecks:'Rechecking closure, recovery and installer before installation',install:'Installing the verified Agentopia 0.44.67 update',verifyInstalled:'Checking the physical installed application files',verifyData:'Checking preserved database, profile location and runtime binding'};

try {
 desktopOperation('normal Windows Agentopia 0.44.67 recovery and installation');
 assert.equal(root.toLowerCase(),'f:\\agentopia');
 job=path.join(root,'.supabase/desktop-normal-maintenance',String(Date.now()));await mkdir(job,{recursive:true});assert.equal((await realpath(job)).toLowerCase(),job.toLowerCase());
 const sid=await privateCommand('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{label:'identity'});assert(/^S-1-5-[0-9-]+$/.test(sid));
 await privateCommand('icacls.exe',[job,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{label:'recovery-access'});
 console.log('Progress and recovery records: '+job);await save();
 await writeFile(path.join(root,'.supabase/desktop-normal-maintenance/current-update67.json'),JSON.stringify({job,evidence:path.join(job,'evidence.json'),pid:process.pid,version:'0.44.67',controller:'run-normal-maintenance67.mjs'},null,2));
 const actions={
  requireClosed:async()=>{const result=await closeOrdinaryAgentopia({expectedExe:path.resolve(source,'Agentopia.exe'),expectedImageSha256:currentSha,ensureIdle:async()=>{const previous=await json(path.join(root,'.supabase/desktop-production-logical/current.json')),readiness=await wsl('runtime-maintenance-readiness54.py',[linux(previous.out)],'before-close-requests');assert.equal(readiness.unfinishedRequests,0,'Leave active agent requests running; maintenance will wait for their completion.');evidence.precloseReadiness=readiness;}});evidence.normalClose=result;await save();return result;},
  normalWindows:async()=>{const context=await probeMaintenanceWindowsContext();await writeFile(path.join(job,'windows-context.json'),JSON.stringify(context,null,2));assert(context.success,'This process redirects Windows installation writes. Close this window and run Run-Agentopia-Scheduled-Workspaces-Update67.cmd by double-clicking it in normal File Explorer.');return context;},
  preflight:async()=>{
   const launcher=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified67.json'));assert(launcher.success&&launcher.version==='0.44.67');
   for(const [name,digest]of Object.entries(launcher.sourceHashes)){assert(name.startsWith('scripts/desktop/')||name==='Run-Agentopia-Scheduled-Workspaces-Update67.cmd');assert(!name.includes('..'));assert.equal(await hash(path.join(root,name)),digest,'The qualified launcher changed: '+name);}
   proof=await json(packageProof);installer=await json(path.join(release,'installer-verified.json'));const qualification=await json(path.join(release,'qualification.json')),upgrade=await json(path.join(release,'packaged-accepted.json')),packaging=await json(path.join(release,'installer-proof.json'));
   assert(packaging.success);setupSha=packaging.installerSha256;const original52=await json(path.join(root,'.supabase/desktop-composio-candidate52/1792560932895/package-proof.json'));assert(original52.success&&original52.version==='0.44.52');existingHelper=path.join(original52.assets,'runtime/database_state.py');assert.equal(await hash(existingHelper),proof.resourceFiles['runtime/database_state.py']);assert.equal(await hash(packaging.fullPackage),packaging.fullPackageSha256);assert.equal(await hash(installedUpdater),installedUpdaterSha256);
   assert(proof.success&&proof.version==='0.44.67'&&installer.success&&upgrade.success&&qualification.success&&qualification.actualClaimDeferral&&qualification.actualMultiProjectClock&&qualification.causalRevocation&&qualification.coldNoReplay&&qualification.recoveryInheritedOnIdenticalModules);const cold=await json(path.join(release,'packaged-accepted.json'));assert(cold.success&&cold.imageSha256===nextSha,'The qualified current package cold reopening and recovery impact assessment are required before installation.');assert.equal(upgrade.imageSha256,nextSha);
   assert.equal(proof.imageSha256,nextSha);assert.equal(installer.installerSha256,setupSha);assert.equal(await hash(packageProof),qualification.proofSha256);assert.equal(await hash(proof.image),nextSha);assert.equal(await hash(installer.installer),setupSha);assert.equal(await hash(path.join(source,'resources/app.asar')),currentSha,'The active app changed; this launcher is only for the verified 0.44.66 to 0.44.67 update');
   for(const name of ['runtime/manage.py','runtime/database_state.py'])assert.equal(await hash(path.join(proof.assets,name)),proof.resourceFiles[name]);
   for(const directory of [profile,source])assert((await lstat(directory)).isDirectory()&&path.resolve(await realpath(directory)).toLowerCase()===path.resolve(directory).toLowerCase());
   const capacity=await statfs(job);assert(capacity.bavail*capacity.bsize>12*1024**3,'At least 12 GiB free on F: is required');
   const binding=await json(path.join(profile,'runtime-binding.json'));assert.equal(binding.distribution,distro);assert.equal(binding.instanceId,'a91a4800-e08f-4440-a4ec-588762d01bfd');
   selectorHash=await hash('C:/Users/charl/.agentopia/desktop/profile-location.json');bindingHash=await hash(path.join(profile,'runtime-binding.json'));
   await writeFile(path.join(job,'intent.json'),JSON.stringify({out:job,packageProof,sourceProgram:source,sourceProfile:profile,sourceImageSha256:currentSha,targetImageSha256:nextSha,installer:installer.installer,installerSha256:setupSha,standingAuthorization:true},null,2),{flag:'wx'});return {success:true};
  },
  existingServices:async()=>{await closed();return wsl('maintenance-existing-runtime52.py',['start-existing',linux(existingHelper),linux(job)],'existing-services',480000);},
  logicalRecovery:async()=>{await closed();const result=JSON.parse(await privateCommand(process.execPath,[path.join(root,'scripts/desktop/capture-production-logical.mjs')],{timeout:180000,label:'logical-recovery'}));assert(result.success);logical=await json(path.join(root,'.supabase/desktop-production-logical/current.json'));assert.equal(logical.out,result.out);evidence.logicalRecovery=logical;return result;},
  profileRecovery:async()=>{
   backupCfg={out:path.join(job,'recovery'),sourceProfile:profile,sourceHome:'C:/Users/charl',sourcePublicRoot:'C:/Users/charl/Agentopia Files',logicalSnapshot:logical.snapshot,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:nextSha,production:true,scope:'application-update'};
   await mkdir(backupCfg.out);await writeFile(path.join(backupCfg.out,'intent.json'),JSON.stringify(backupCfg,null,2),{flag:'wx'});backup=await captureMaintenancePortable(backupCfg);evidence.currentProfileRecovery=path.join(backupCfg.out,'maintenance-backup.json');
   const settings=await json(path.join(backup.destination,'portable-settings.json')),states=[];const walk=value=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='composio-state')states.push(item);else walk(item);}};walk(settings);evidence.composioDelivery={scope:'Composio connection implementation is unchanged from accepted58; protected per-user keys and disabled portable bindings are preserved.',existingPortableBindings:states.reduce((sum,state)=>sum+state.connections.length,0),liveConnectorVerified:false};return backup;
  },
  verifyRecovery:async()=>{
   const independent=JSON.parse(await privateCommand(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/verify-maintenance-ordinary67.py'),path.join(backupCfg.out,'intent.json')],{timeout:300000,label:'verify-profile'}));assert(independent.success&&independent.scope==='application-update');assert(backup.scope==='application-update'&&backup.fullWorkspaceExport===false);console.log('Application-update recovery is verified. '+backup.externalReferencesPreservedInPlace+' external attachment locations are recorded and retained in place; their folder contents are outside this capture.');
   const sql=await wsl('audit-production-logical.py',[linux(logical.out)],'verify-database');assert(sql.success);await unchangedRecovery();return {success:true};
  },
  programRollback:async()=>{
   await closed();rollback=await captureMaintenanceProgram({job,proof});await wsl('verify-maintenance-installation67.py',['rollback',linux(job)],'verify-rollback',300000);return {success:true};
  },
  finalChecks:async()=>{await unchangedRecovery();await wsl('audit-production-logical.py',[linux(logical.out)],'final-database');assert.equal(await hash(installer.installer),setupSha);assert.equal(await hash(path.join(source,'resources/app.asar')),currentSha);const context=await probeMaintenanceWindowsContext();assert(context.success,'The Windows installation context changed');await closed();evidence.currentRecoveryVerified=true;evidence.rollbackVerified=true;evidence.eligibleForAuthorizedInstallation=true;await save();return {success:true};},
  install:async()=>{
   const temp=path.join('F:/Agentopia-Tmp','update67-'+path.basename(job));await mkdir(temp,{recursive:true});const command=maintenanceUpdateCommand({releaseDirectory:path.dirname(installer.installer),temp});assert.equal(await hash(command.exe),installedUpdaterSha256);
   evidence.installerInvoked=true;evidence.updateMethod='installed-Update.exe --update verified-release-directory';evidence.updateScratch=temp;await save();const code=await new Promise((resolve,reject)=>{const child=spawn(command.exe,command.args,{cwd:command.cwd,env:command.env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';const started=Date.now(),pulse=setInterval(()=>console.log('Updater is running ('+Math.round((Date.now()-started)/1000)+' seconds).'),20000);for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>output+=bytes);child.once('error',error=>{clearInterval(pulse);reject(error);});child.once('close',async code=>{clearInterval(pulse);try{await writeFile(path.join(job,'private-installer.log'),output);resolve(code);}catch(error){reject(error);}});});assert.equal(code,0,'The updater did not finish successfully');return {success:true};
  },
  verifyInstalled:async()=>{const physical=await wsl('verify-maintenance-installation67.py',['installed',linux(job)],'verify-installed',300000);assert(physical.success);evidence.installed=true;return physical;},
  verifyData:async()=>{await unchangedRecovery();const report=await wsl('audit-production-logical.py',[linux(logical.out)],'after-install-database');assert(report.success);return report;}
 };
 if(process.argv.includes('--check-only')) {
  evidence.checkOnly=true;
  for(const name of ['requireClosed','normalWindows','preflight']){phase=name;console.log('\n'+descriptions[name]+'...');assert((await actions[name]()).success);}
  Object.assign(evidence,{success:true,phase:'checks-only-no-installation'});await save();console.log('\nCHECK ONLY: no database start, backup, installation or app launch was performed.');process.exit(0);
 }
 const result=await runMaintenancePlan(actions,name=>{phase=name;console.log('\n'+descriptions[name]+'...');evidence.steps.push({phase:name,startedAt:new Date().toISOString()});});
 Object.assign(evidence,result,{finishedAt:new Date().toISOString(),phase:'installed-awaiting-ordinary-reopening',currentRecoveryVerified:true,rollbackVerified:true});await save();
 evidence.ordinaryReopened=await reopenOrdinaryAgentopia({expectedExe:path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.67/Agentopia.exe'),expectedImageSha256:nextSha});evidence.ordinaryReopeningPending=false;evidence.visualAccountAcceptancePending=true;evidence.phase='installed-and-reopened-awaiting-visual-acceptance';await save();
 console.log('\nAgentopia 0.44.67 is installed and its physical files and saved database rows passed verification.');
 console.log('Agentopia reopened normally. Fresh visual account/document checks and Windows reboot acceptance remain pending.');
 console.log('Recovery and rollback: '+job);
} catch(error) {
 Object.assign(evidence,{phase,error:error.message,failedAt:new Date().toISOString()});await save();
 console.error('\nUPDATE STOPPED during '+phase+': '+error.message);
 console.error(evidence.installerInvoked?'The installer was invoked. Keep the recovery and rollback folder for inspection.':'The installer was not started.');
 if(!evidence.installerInvoked&&evidence.normalClose?.exited){try{evidence.priorOrdinaryAppReopened=await reopenOrdinaryAgentopia({expectedExe:path.resolve(source,'Agentopia.exe'),expectedImageSha256:currentSha});await save();}catch(reopenError){evidence.reopeningError=reopenError.message;await save();}}
 if(job)console.error('Progress and recovery records: '+job);process.exitCode=1;
}
