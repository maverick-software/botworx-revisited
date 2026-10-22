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
import {captureMaintenanceProgram} from './maintenance-program-rollback.mjs';
import {maintenanceUpdateCommand,installedUpdater,installedUpdaterSha256} from './maintenance-update-command.mjs';

const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
const release=path.join(root,'.supabase/desktop-release-04448/1792527849453'),packageProof=path.join(release,'package-proof.json');
const distro='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd',profile='C:/Users/charl/.agentopia/desktop/profile',source='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47';
const currentSha='cc3d18ff9db9404fa5479603248afb7ce5dd65067e27ec0977a86ce13152800d',nextSha='d4779251528ccfe57dc9c7137615665b3daf809e916117a13f6b0b9cd4fe9dd7',setupSha='46cd43bc3e6af6dac25efc563c38a38896c502c513a4a6ae27eb7118d2d4ffbf';
let job,phase='startup',proof,installer,logical,backupCfg,backup,rollback,selectorHash,bindingHash;
const evidence={success:false,at:new Date().toISOString(),version:'0.44.48',installerInvoked:false,installed:false,ordinaryReopeningPending:true,rebootAcceptancePassed:false,fullGoalComplete:false,providerRequests:0,steps:[]};
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
const descriptions={requireClosed:'Checking that Agentopia is closed normally',normalWindows:'Checking the physical Windows installation location',preflight:'Checking the verified update and available F-drive space',existingServices:'Checking the existing database services and encryption keys',logicalRecovery:'Capturing a fresh consistent database recovery',profileRecovery:'Capturing the current profile, files, drafts and document tabs',verifyRecovery:'Independently verifying all recovery resources and saved database rows',programRollback:'Retaining the active program for rollback on F:',finalChecks:'Rechecking closure, recovery and installer before installation',install:'Installing the verified Agentopia 0.44.48 update',verifyInstalled:'Checking the physical installed application files',verifyData:'Checking preserved database, profile location and runtime binding'};

try {
 desktopOperation('normal Windows Agentopia 0.44.48 recovery and installation');
 assert.equal(root.toLowerCase(),'f:\\agentopia');
 job=path.join(root,'.supabase/desktop-normal-maintenance',String(Date.now()));await mkdir(job,{recursive:true});assert.equal((await realpath(job)).toLowerCase(),job.toLowerCase());
 const sid=await privateCommand('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{label:'identity'});assert(/^S-1-5-[0-9-]+$/.test(sid));
 await privateCommand('icacls.exe',[job,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{label:'recovery-access'});
 console.log('Progress and recovery records: '+job);await save();
 const actions={
  requireClosed:async()=>{try{await closed();}catch{throw Error('Agentopia is still open. Close Agentopia normally, including its tray window if present, then run this launcher again.');}return {success:true};},
  normalWindows:async()=>{const context=await probeMaintenanceWindowsContext();await writeFile(path.join(job,'windows-context.json'),JSON.stringify(context,null,2));assert(context.success,'This process redirects Windows installation writes. Close this window and run Run-Agentopia-Update.cmd by double-clicking it in normal File Explorer.');return context;},
  preflight:async()=>{
   const launcher=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified.json'));assert(launcher.success&&launcher.version==='0.44.48');
   for(const [name,digest]of Object.entries(launcher.sourceHashes)){assert(name.startsWith('scripts/desktop/')||name==='Run-Agentopia-Update.cmd');assert(!name.includes('..'));assert.equal(await hash(path.join(root,name)),digest,'The qualified launcher changed: '+name);}
   const backupQualification=await json(path.join(root,'.supabase/desktop-maintenance-backup/qualified-current.json'));assert(backupQualification.success&&backupQualification.hiddenHelper&&backupQualification.sourceUnchanged&&backupQualification.workspaceModePassed&&backupQualification.applicationUpdateModePassed&&backupQualification.sourcePathGuardsPassed);
   for(const [name,digest]of Object.entries(backupQualification.sourceHashes))assert.equal(await hash(path.join(root,'scripts/desktop',name)),digest,'A qualified backup component changed: '+name);
   proof=await json(packageProof);installer=await json(path.join(release,'installer-verified.json'));const qualification=await json(path.join(release,'qualification.json')),upgrade=await json(path.join(release,'database-upgrade-accepted.json')),packaging=await json(path.join(release,'installer-proof.json'));
   assert(packaging.success);assert.equal(await hash(packaging.fullPackage),packaging.fullPackageSha256);assert.equal(await hash(installedUpdater),installedUpdaterSha256);
   assert(proof.success&&proof.version==='0.44.48'&&installer.success&&upgrade.success&&qualification.success);
   assert.equal(proof.imageSha256,nextSha);assert.equal(installer.installerSha256,setupSha);assert.equal(await hash(packageProof),qualification.proofSha256);assert.equal(await hash(proof.image),nextSha);assert.equal(await hash(installer.installer),setupSha);assert.equal(await hash(path.join(source,'resources/app.asar')),currentSha,'The active app changed; this launcher is only for the verified 0.44.47 to 0.44.48 update');
   for(const name of ['runtime/manage.py','runtime/database_state.py'])assert.equal(await hash(path.join(proof.assets,name)),proof.resourceFiles[name]);
   for(const directory of [profile,source])assert((await lstat(directory)).isDirectory()&&path.resolve(await realpath(directory)).toLowerCase()===path.resolve(directory).toLowerCase());
   const capacity=await statfs(job);assert(capacity.bavail*capacity.bsize>12*1024**3,'At least 12 GiB free on F: is required');
   const binding=await json(path.join(profile,'runtime-binding.json'));assert.equal(binding.distribution,distro);assert.equal(binding.instanceId,'a91a4800-e08f-4440-a4ec-588762d01bfd');
   selectorHash=await hash('C:/Users/charl/.agentopia/desktop/profile-location.json');bindingHash=await hash(path.join(profile,'runtime-binding.json'));
   await writeFile(path.join(job,'intent.json'),JSON.stringify({out:job,packageProof,sourceProgram:source,sourceProfile:profile,sourceImageSha256:currentSha,targetImageSha256:nextSha,installer:installer.installer,installerSha256:setupSha,standingAuthorization:true},null,2),{flag:'wx'});return {success:true};
  },
  existingServices:async()=>{await closed();return wsl('maintenance-existing-runtime.py',['start-existing',linux(path.join(proof.assets,'runtime/database_state.py')),linux(job)],'existing-services',480000);},
  logicalRecovery:async()=>{await closed();const result=JSON.parse(await privateCommand(process.execPath,[path.join(root,'scripts/desktop/capture-production-logical.mjs')],{timeout:180000,label:'logical-recovery'}));assert(result.success);logical=await json(path.join(root,'.supabase/desktop-production-logical/current.json'));assert.equal(logical.out,result.out);evidence.logicalRecovery=logical;return result;},
  profileRecovery:async()=>{
   backupCfg={out:path.join(job,'recovery'),sourceProfile:profile,sourceHome:'C:/Users/charl',sourcePublicRoot:'C:/Users/charl/Agentopia Files',logicalSnapshot:logical.snapshot,program:proof.program,exe:proof.exe,assets:proof.assets,imageSha256:nextSha,production:true,scope:'application-update'};
   await mkdir(backupCfg.out);await writeFile(path.join(backupCfg.out,'intent.json'),JSON.stringify(backupCfg,null,2),{flag:'wx'});backup=await captureMaintenancePortable(backupCfg);evidence.currentProfileRecovery=path.join(backupCfg.out,'maintenance-backup.json');return backup;
  },
  verifyRecovery:async()=>{
   const independent=JSON.parse(await privateCommand(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/verify-maintenance-portable.py'),path.join(backupCfg.out,'intent.json')],{timeout:300000,label:'verify-profile'}));assert(independent.success&&independent.scope==='application-update');assert(backup.scope==='application-update'&&backup.fullWorkspaceExport===false);console.log('Application-update recovery is verified. '+backup.externalReferencesPreservedInPlace+' external attachment locations are recorded and retained in place; their folder contents are outside this capture.');
   const sql=await wsl('audit-production-logical.py',[linux(logical.out)],'verify-database');assert(sql.success);await unchangedRecovery();return {success:true};
  },
  programRollback:async()=>{
   await closed();rollback=await captureMaintenanceProgram({job,proof});await wsl('verify-maintenance-installation.py',['rollback',linux(job)],'verify-rollback',300000);return {success:true};
  },
  finalChecks:async()=>{await unchangedRecovery();await wsl('audit-production-logical.py',[linux(logical.out)],'final-database');assert.equal(await hash(installer.installer),setupSha);assert.equal(await hash(path.join(source,'resources/app.asar')),currentSha);const context=await probeMaintenanceWindowsContext();assert(context.success,'The Windows installation context changed');await closed();return {success:true};},
  install:async()=>{
   const temp=path.join('F:/Agentopia-Tmp','update48-'+path.basename(job));await mkdir(temp,{recursive:true});const command=maintenanceUpdateCommand({releaseDirectory:path.dirname(installer.installer),temp});assert.equal(await hash(command.exe),installedUpdaterSha256);
   evidence.installerInvoked=true;evidence.updateMethod='installed-Update.exe --update verified-release-directory';evidence.updateScratch=temp;await save();const code=await new Promise((resolve,reject)=>{const child=spawn(command.exe,command.args,{cwd:command.cwd,env:command.env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';const started=Date.now(),pulse=setInterval(()=>console.log('Updater is running ('+Math.round((Date.now()-started)/1000)+' seconds).'),20000);for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>output+=bytes);child.once('error',error=>{clearInterval(pulse);reject(error);});child.once('close',async code=>{clearInterval(pulse);try{await writeFile(path.join(job,'private-installer.log'),output);resolve(code);}catch(error){reject(error);}});});assert.equal(code,0,'The updater did not finish successfully');return {success:true};
  },
  verifyInstalled:async()=>{const physical=await wsl('verify-maintenance-installation.py',['installed',linux(job)],'verify-installed',300000);assert(physical.success);evidence.installed=true;return physical;},
  verifyData:async()=>{await checkIdentity();const report=await wsl('audit-production-logical.py',[linux(logical.out)],'after-install-database');assert(report.success);return report;}
 };
 if(process.argv.includes('--check-only')) {
  evidence.checkOnly=true;
  for(const name of ['requireClosed','normalWindows','preflight']){phase=name;console.log('\n'+descriptions[name]+'...');assert((await actions[name]()).success);}
  Object.assign(evidence,{success:true,phase:'checks-only-no-installation'});await save();console.log('\nCHECK ONLY: no database start, backup, installation or app launch was performed.');process.exit(0);
 }
 const result=await runMaintenancePlan(actions,name=>{phase=name;console.log('\n'+descriptions[name]+'...');evidence.steps.push({phase:name,startedAt:new Date().toISOString()});});
 Object.assign(evidence,result,{finishedAt:new Date().toISOString(),phase:'installed-awaiting-ordinary-reopening',currentRecoveryVerified:true,rollbackVerified:true});await save();
 console.log('\nAgentopia 0.44.48 is installed and its physical files and saved database rows passed verification.');
 console.log('Open Agentopia normally to check the current chat, account and responsive details card. Ordinary reopening and reboot acceptance remain pending.');
 console.log('Recovery and rollback: '+job);
} catch(error) {
 Object.assign(evidence,{phase,error:error.message,failedAt:new Date().toISOString()});await save();
 console.error('\nUPDATE STOPPED during '+phase+': '+error.message);
 console.error(evidence.installerInvoked?'The installer was invoked. Keep the recovery and rollback folder for inspection.':'The installer was not started.');
 if(job)console.error('Progress and recovery records: '+job);process.exitCode=1;
}
