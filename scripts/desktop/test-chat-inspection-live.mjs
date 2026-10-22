import {_electron,expect} from '@playwright/test';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,cp,realpath,stat,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {extractAll} from '@electron/asar';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {installInspectionLiveGuard as installLiveGuard,runChatInspectionLive as runPackagedLive} from './chat-inspection-live-workflows.mjs';

desktopOperation('exact corrected packaged live ChatGPT acceptance');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile);
const version='0.44.18',upgradeCandidate=process.argv.includes('--upgrade-candidate'),recoverBeforeLive=process.argv.includes('--recover-before-live');
const guardRequire=createRequire(import.meta.url),physical=guardRequire('./workspace-agent-physical-authorization.cjs').physicalAuthorization(root,process.argv[2]);
const candidates={'0.44.18':'desktop-chat-inspection/candidate-04418'};
assert(Object.hasOwn(candidates,version),'Select a qualified packaged release.');
const candidate=path.join(root,'.supabase',candidates[version]);
const release=JSON.parse(await readFile(path.join(candidate,'qualification.json'),'utf8'));
const rehearsal=JSON.parse(await readFile(path.join(root,'.supabase/desktop-upgrade-rehearsal/latest.json'),'utf8'));
assert(release.success&&rehearsal.success&&!release.installed);
assert.equal(release.version,version);const schema=release.migrations;assert.equal(schema,60);
const sourceEvidence=JSON.parse(await readFile(rehearsal.evidence,'utf8'));
const resumeIndex=process.argv.indexOf('--resume'),resumeId=resumeIndex<0?undefined:process.argv[resumeIndex+1];assert(resumeId===undefined||/^\d{13}$/.test(resumeId));
const resumeRoot=resumeId?path.join(root,'.supabase/desktop-packaged-live',resumeId):undefined;
assert(!resumeId&&!upgradeCandidate&&!recoverBeforeLive,'Inspect saved request outcomes before preparing any recovery; this one-request workflow never automatically replays a fixture.');
const prior=resumeRoot?JSON.parse(await readFile(path.join(resumeRoot,'intent.json'),'utf8')):undefined,previous=resumeRoot?JSON.parse(await readFile(path.join(resumeRoot,'evidence.json'),'utf8')):undefined;
assert(!upgradeCandidate||prior,'A candidate upgrade must reuse an explicitly selected stopped fixture.');
let interruptionAudit;
if(recoverBeforeLive){assert(prior);const pointer=JSON.parse(await readFile(path.join(resumeRoot,'latest-interruption-audit.json'),'utf8'));assert(pointer.success);interruptionAudit=JSON.parse(await readFile(pointer.evidence,'utf8'));assert(interruptionAudit.success&&interruptionAudit.eligibleForExplicitPreLiveRecovery&&interruptionAudit.privateRuntimeStopped&&interruptionAudit.noNewRequestAfterInterruption&&interruptionAudit.noNativeThreadOrItems&&interruptionAudit.noToolCalls&&interruptionAudit.noAgentInvocations);assert.equal(interruptionAudit.sourceAttempt,previous.attempt);assert.equal(interruptionAudit.imageSha256,previous.imageSha256);assert.equal(previous.phase,'first-launch');assert.equal(previous.liveRequests,undefined);}
if(prior){assert.equal(previous.version,prior.version,'Interrupted candidate preparation: inspect candidate-upgrade.json and its retained program before explicit recovery.');assert.equal(previous.imageSha256,prior.imageSha256,'The saved outcomes and program intent belong to different images. Inspect the retained upgrade checkpoint.');assert.equal(prior.version,upgradeCandidate?release.baseVersion:version);assert.equal(prior.imageSha256,upgradeCandidate?release.baseImageSha256:release.imageSha256);if(!recoverBeforeLive){assert(previous.success===false&&previous.failureClosedNormally);assert((previous.liveRequests??[]).every(row=>row.phase==='failed')&&Array.isArray(previous.failureNetwork?.inference)&&previous.failureNetwork.inference.length===0,'Inspect prior model outcomes before resuming');}}
const id=prior?.instanceId??randomUUID(),distribution='AgentopiaRuntime-'+id;
const production='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const profileName='live-'+id;
const out=resumeRoot??path.join(root,'.supabase/desktop-packaged-live',String(Date.now())),logicalProfile=path.join(process.env.APPDATA,'Agentopia/test-profiles',profileName);let profile=logicalProfile;
const resources=path.join(out,'program/resources/resources'),storage=path.join(out,'wsl');
const delivered=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/resources');
const image=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/app.asar');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
assert.equal(await hashFile(image),release.imageSha256);
assert.equal(await hashFile(path.join(delivered,'runtime.tar.gz')),(await readFile(path.join(delivered,'runtime.sha256'),'utf8')).trim());
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const run=async(args,timeout=60000)=>{
 try{const result=await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:16*1024*1024});return decode(result.stdout);}
 catch(error){await writeFile(path.join(out,'private-wsl-error.log'),Buffer.concat([error.stdout??Buffer.alloc(0),error.stderr??Buffer.alloc(0)]));throw Error('The owned WSL operation failed; inspect the private diagnostic before recovery.');}
};
const list=async(running=false)=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const before={registered:await list(),running:await list(true)};
assert(before.running.includes(production)&&!before.running.includes('AgentopiaRuntime')&&!before.running.includes(distribution));assert.equal(before.registered.includes(distribution),!!resumeId);
const latestLive=path.join(root,'.supabase/desktop-chat-inspection/latest-live.json');
try{const previous=await readFile(latestLive,'utf8');throw Error('A live fixture already exists. Inspect its request ID and evidence before another submission: '+latestLive);}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(latestLive,JSON.stringify({at:new Date().toISOString(),pid:process.pid,version,imageSha256:release.imageSha256,out,phase:'preparing',requestId:null},null,2),{flag:'wx'});
await mkdir(out,{recursive:true});assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();
assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await mkdir(logicalProfile,{recursive:true});profile=await realpath(logicalProfile);assert.equal(path.basename(profile),profileName);assert.equal(path.basename(path.dirname(profile)),'test-profiles');assert.equal(path.basename(path.dirname(path.dirname(profile))),'Agentopia');await exec('icacls.exe',[profile,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const freeze=resumeId?path.join(out,'resume-'+Date.now()):out;await mkdir(freeze,{recursive:true});if(resumeId){await copyFile(path.join(out,'evidence.json'),path.join(freeze,'previous-evidence.json'));await copyFile(path.join(out,'intent.json'),path.join(freeze,'previous-intent.json'));}
const upgradeCheckpoint=path.join(out,'candidate-upgrade.json');let upgrade;
async function markUpgrade(phase){upgrade.phase=phase;upgrade.updatedAt=new Date().toISOString();await writeFile(upgradeCheckpoint,JSON.stringify(upgrade,null,2));await writeFile(path.join(freeze,'candidate-upgrade.json'),JSON.stringify(upgrade,null,2));}
if(!resumeId)await cp(path.join(candidate,'staging/out/Agentopia-win32-x64'),path.join(out,'program'),{recursive:true});
if(upgradeCandidate){
 const program=path.join(out,'program'),retained=path.join(freeze,'previous-program');assert.equal(path.dirname(program),out);assert.equal(path.dirname(retained),freeze);assert.equal(await hashFile(path.join(program,'resources/app.asar')),prior.imageSha256);
 const running=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-CimInstance Win32_Process -Filter \"name='Agentopia.exe'\" | Select-Object -ExpandProperty ExecutablePath | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true})).stdout.trim();const executables=running?JSON.parse(running):[];assert(![executables].flat().filter(Boolean).some(file=>file.toLowerCase()===path.join(program,'Agentopia.exe').toLowerCase()),'The fixture application must be stopped before replacing its program.');
 let oldUpgrade;try{oldUpgrade=JSON.parse(await readFile(upgradeCheckpoint,'utf8'));assert.equal(oldUpgrade.phase,'evidence-written','An earlier candidate preparation is incomplete. Inspect its checkpoint before continuing.');assert.equal(oldUpgrade.toImage,prior.imageSha256);await copyFile(upgradeCheckpoint,path.join(freeze,'previous-candidate-upgrade.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
 upgrade={at:new Date().toISOString(),phase:'prepared',fromVersion:prior.version,fromImage:prior.imageSha256,toVersion:version,toImage:release.imageSha256,freeze,program,retained};await writeFile(upgradeCheckpoint,JSON.stringify(upgrade,null,2),{flag:oldUpgrade?'w':'wx'});await markUpgrade('prepared');await rename(program,retained);await markUpgrade('program-retained');await cp(path.join(candidate,'staging/out/Agentopia-win32-x64'),program,{recursive:true});assert.equal(await hashFile(path.join(program,'resources/app.asar')),release.imageSha256);await markUpgrade('program-copied');
}
await copyFile(path.join(root,'scripts/desktop/audit-packaged-startup.py'),path.join(freeze,'audit-packaged-startup.py'));
await copyFile(path.join(root,'scripts/desktop/packaged-live-workflows.mjs'),path.join(freeze,'packaged-live-workflows.mjs'));
await copyFile(path.join(root,'scripts/desktop/chat-inspection-live-workflows.mjs'),path.join(freeze,'chat-inspection-live-workflows.mjs'));
await copyFile(path.join(root,'scripts/desktop/workspace-agent-physical-authorization.cjs'),path.join(freeze,'workspace-agent-physical-authorization.cjs'));
await copyFile(path.join(root,'scripts/desktop/record-workspace-agent-acceptance.mjs'),path.join(freeze,'record-workspace-agent-acceptance.mjs'));
if(!resumeId)await copyFile(path.join(physical.snapshot,'Local State'),path.join(profile,'Local State')); 
await copyFile(path.join(root,'scripts/desktop/test-packaged-live.mjs'),path.join(freeze,'test-chat-inspection-live.mjs'));
const archive=path.join(out,'archived-'+version);if(!resumeId||upgradeCandidate)extractAll(image,archive);
const require=createRequire(path.join(archive,'package.json'));
const {Runtime,coreServicesReady}=require('./build/runtime.js'),{receiveBackup}=require('./build/transfer.js');
if(!resumeId)await cp(path.join(delivered,'runtime'),path.join(resources,'runtime'),{recursive:true});
if(!resumeId)await cp(path.join(delivered,'database'),path.join(resources,'database'),{recursive:true});
if(!resumeId)await copyFile(path.join(delivered,'version.json'),path.join(resources,'version.json'));
const handles=[];let base=prior?.ports.shadow;
try{
 for(let attempt=0;!base&&attempt<30;attempt++){
  base=59000+Math.floor(Math.random()*2500);
  try{for(let offset=0;offset<6;offset++){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(base+offset,'127.0.0.1',resolve);});handles.push(server);}break;}
  catch{await Promise.all(handles.splice(0).map(server=>new Promise(resolve=>server.close(resolve))));base=undefined;}
 }
 assert(base&&(resumeId||handles.length===6));
}finally{await Promise.all(handles.map(server=>new Promise(resolve=>server.close(resolve))));}
const ports={api:base+1,database:base+2,shadow:base,studio:base+3,smtp:base+4,inspector:base+5};
assert.equal(await run(['-d',production,'-u','agentopia','--exec','python3','-c',
 'import socket; sockets=[]\ntry:\n for port in range('+base+','+(base+6)+'):\n  connection=socket.socket(); connection.bind(("127.0.0.1",port)); sockets.append(connection)\n print("free")\nfinally:\n for connection in sockets: connection.close()']), 'free');
let configuration=await readFile(path.join(resources,'runtime/config.toml'),'utf8');
for(let offset=0;offset<6;offset++)configuration=configuration.replaceAll(String(57320+offset),String(base+offset));
assert(!configuration.includes('5732'));
await writeFile(path.join(resources,'runtime/config.toml'),configuration);
const manifestEntry=sourceEvidence.backupFiles.find(item=>item.name==='pgsodium_root.key');assert(manifestEntry);
const intent={at:new Date().toISOString(),pid:process.pid,version,schema,imageSha256:release.imageSha256,
 instanceId:id,distribution,storage,profile,logicalProfile,profileLinux:linux(profile),ports,sourceBackup:sourceEvidence.backupDirectory,
 rootKeySha256:manifestEntry.sha256,production,productionMigrated:false,providerRequests:0,
 runtimeArchiveSha256:await hashFile(path.join(delivered,'runtime.tar.gz')),
 resourceDifference:'Supabase test ports only; all code and migrations remain delivered bytes.'};
await writeFile(path.join(freeze,'intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});
if(upgradeCandidate){await writeFile(path.join(out,'intent.json'),JSON.stringify({...intent,replaces:prior.imageSha256,retainedProgram:path.join(freeze,'previous-program')},null,2));await markUpgrade('intent-written');}
const evidence={...intent,attempt:path.basename(freeze),checks:[],phase:'prepared',before,progress:[],...(interruptionAudit?{interruptionAudit}:{}),...(previous?{fixtureUser:previous.fixtureUser,resumedFrom:freeze,agents:previous.agents,projects:previous.projects,markers:previous.markers,priorFailedRequests:[...(previous.priorFailedRequests??[]),...(previous.liveRequests??[])]}: {})};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
await save();if(upgradeCandidate)await markUpgrade('evidence-written');
const check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};
let runtime,registered=!!resumeId;
const registration=async()=>{
 const script="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";
 const result=JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true})).stdout);
 assert.equal(result.name,distribution);
 const actual=path.win32.normalize(result.path.replace(/^\\\\\?\\/,''));
 assert.equal(actual.toLowerCase(),storage.toLowerCase());assert(actual.toLowerCase().startsWith(out.toLowerCase()+path.sep));
 return result;
};
let application;
const executable=path.join(out,'program/Agentopia.exe');
const audit=async()=>JSON.parse(await runtime.command(['python3',linux(path.join(freeze,'audit-packaged-startup.py')),linux(out)],60000));
async function launch(label,signedIn=false){
 const env={...process.env,AGENTOPIA_TEST_PROFILE:profileName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:executable,cwd:os.tmpdir(),env,timeout:60000});
 const page=await application.firstWindow();
 const info=await application.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),appPath:app.getAppPath(),exe:app.getPath('exe')}));
 assert(info.packaged);assert.equal(info.version,version);assert([logicalProfile.toLowerCase(),profile.toLowerCase()].includes(info.userData.toLowerCase()));const physical={userData:await realpath(info.userData),sessionData:await realpath(info.sessionData)};assert.equal(physical.userData.toLowerCase(),profile.toLowerCase());assert.equal(physical.sessionData.toLowerCase(),profile.toLowerCase());info.physical=physical;assert.equal(info.exe.toLowerCase(),executable.toLowerCase());
 assert.equal(info.appPath.toLowerCase(),path.join(out,'program/resources/app.asar').toLowerCase());
 await installLiveGuard(application);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let status,last;const deadline=Date.now()+240000;
 while(Date.now()<deadline){
  status=await page.evaluate(()=>window.agentopia?.call('runtime.status')??{ready:false,phase:'loading'});
  if(status.phase!==last){last=status.phase;console.log(label+': '+status.phase);}
  if(status.phase==='error')throw Error(status.message);
  if(status.ready)break;await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert(status?.ready,'The packaged program did not report a ready local session.');
 if(!signedIn){await expect(page.getByLabel('Email address',{exact:true})).toBeVisible({timeout:15000});await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();}
 else await expect(page.getByRole('button',{name:/^New chat\b/}).first()).toBeVisible({timeout:30000});
 assert(page.url().startsWith('agentopia://app/'));assert.deepEqual(errors,[]);
 const network=await application.evaluate(()=>globalThis.__startupNetwork);assert.deepEqual(network.blocked,[]);
 await page.screenshot({path:path.join(out,label+'.png')});
 return {info,status,url:page.url(),network,rendererErrors:errors};
}
async function closeNormally(){
 const current=application,child=current.process(),exited=child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve));
 await current.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0]?.close());
 let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The owned packaged program did not finish normal shutdown.')),60000);})]);}finally{clearTimeout(timer);}
 assert.equal(child.exitCode,0);application=undefined;
 assert(!(await list(true)).includes(distribution));
}
try{
 const actualAppData=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Environment]::GetFolderPath('ApplicationData')"],{encoding:'utf8',windowsHide:true})).stdout.trim();
 assert.equal(actualAppData.toLowerCase(),process.env.APPDATA.toLowerCase());
 const previous=await json(path.join(root,'.supabase/desktop-maintenance-0437/update.json'));
 assert.equal(path.dirname(path.dirname(logicalProfile)).toLowerCase(),previous.ordinaryProfile.toLowerCase());
 assert.equal(await hashFile(path.join(out,'program/resources/app.asar')),release.imageSha256);
 if(!resumeId){
 await receiveBackup(sourceEvidence.backupDirectory,path.join(profile,'migration-input'),production);
 const manifest=await json(path.join(profile,'migration-input/manifest.json'));
 for(const entry of manifest.files)assert.equal(await hashFile(path.join(profile,'migration-input',entry.name)),entry.sha256);
 const baseline=await run(['-d',production,'-u','agentopia','--exec','python3','-c','from pathlib import Path;print(Path('+JSON.stringify(sourceEvidence.backupDirectory+'/private-snapshot-fingerprints.json')+').read_text())']);
 await writeFile(path.join(out,'private-snapshot-fingerprints.json'),baseline);
 await check('The actual packaged program is copied intact and its isolated profile receives the verified database snapshot.');
 evidence.phase='importing';await save();await run(['--import',distribution,storage,path.join(delivered,'runtime.tar.gz'),'--version','2'],600000);registered=true;
 evidence.registration=await registration();
 await run(['-d',distribution,'-u','root','--exec','python3','-c',"from pathlib import Path;assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1';assert not list(Path('/home/agentopia/.supabase/stacks').glob('*'));Path('/opt/agentopia/runtime-instance').write_text("+JSON.stringify(id)+")"]);
 await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:id}),{flag:'wx'});
 const probeEnv={...process.env,ELECTRON_RUN_AS_NODE:'1'};const resolved=JSON.parse((await exec(executable,['-e',"const fs=require('node:fs');console.log(JSON.stringify({profile:fs.realpathSync.native("+JSON.stringify(logicalProfile)+")}))"],{cwd:os.tmpdir(),env:probeEnv,encoding:'utf8',windowsHide:true,timeout:15000})).stdout.trim());assert.equal(resolved.profile.toLowerCase(),profile.toLowerCase());evidence.packagedProfileProbe=resolved;
 }else{await registration();const binding=await json(path.join(profile,'runtime-binding.json'));assert.equal(binding.distribution,distribution);assert.equal(binding.instanceId,id);}
 runtime=new Runtime(resources,profile,()=>{});
 evidence.phase='first-launch';await save();evidence.firstLaunch=await launch('first-launch',!!resumeId);
 const page=await application.firstWindow();
 evidence.initialDataAudit=await audit();assert(evidence.initialDataAudit.success&&evidence.initialDataAudit.schema===60);await check('The exact packaged app upgrades the restored snapshot to schema 60 with original table values and readable encrypted records preserved.');
 evidence.phase='live-workflows';await save();
 const live=await runPackagedLive({application,page,runtime,physical,out,release,check,evidence,save,recorderPath:path.join(freeze,'record-workspace-agent-acceptance.mjs')});
 evidence.phase='normal-close';await save();await closeNormally();
 await check('The signed-in packaged app closes normally and stops only its private backend');
 evidence.phase='cold-reopen';await save();evidence.secondLaunch=await launch('cold-reopen',true);
 const reopened=await application.firstWindow();const identity=await reopened.evaluate(()=>window.agentopia.call('auth.state'));assert.equal(identity.identity.id,live.userId);
 const saved=evidence.liveRequests.at(-1),messages=await reopened.evaluate(conversationId=>window.agentopia.call('messages.list',{conversationId}),saved.conversationId);assert(messages.some(message=>message.metadata?.timing?.requestId===saved.requestId||message.content.text===saved.reply));
 evidence.coldReopen={identityRestored:true,savedConversation:saved.conversationId,replyPreserved:true,noInference:true};
 const afterReopen=await application.evaluate(()=>globalThis.__startupNetwork);assert.equal(afterReopen.inference.length,0);assert.deepEqual(afterReopen.blocked,[]);
 await check('A full private-backend cold reopen restores the same signed-in user and saved live conversation without replaying inference');
 await closeNormally();await registration();await run(['--unregister',distribution],120000);registered=false;
 assert.deepEqual((await list()).sort(),before.registered.filter(name=>name!==distribution).sort());assert.deepEqual((await list(true)).sort(),[...before.running].sort());
 evidence.disposableRuntimeRemoved=true;evidence.productionMigrated=false;evidence.installed=false;evidence.phase='completed';evidence.success=true;await save();await writeFile(latestLive,JSON.stringify({at:new Date().toISOString(),version,imageSha256:release.imageSha256,out,phase:'completed',success:true,requestId:evidence.liveRequests?.[0]?.requestId,evidence:path.join(out,'evidence.json')},null,2));
 console.log(JSON.stringify({success:true,version,checks:evidence.checks,evidence:path.join(out,'evidence.json'),liveOpenRouterRequests:0,refreshRequests:0,installed:false},null,2));
}catch(error){evidence.success=false;evidence.error=error.message;evidence.registered=registered;if(application)evidence.failureNetwork=await application.evaluate(()=>globalThis.__startupNetwork).catch(()=>null);await save();throw Error('Packaged live acceptance stopped; inspect the retained checkpoint before repeating: '+out,{cause:error});}
finally{
 if(application){try{await closeNormally();evidence.failureClosedNormally=true;}catch{evidence.failureClosedNormally=false;await application?.close().catch(()=>{});}await save();}
 if(registered&&(await list(true)).includes(distribution)){
  await registration();await run(['-d',distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop']).catch(()=>{});await run(['--terminate',distribution],30000);evidence.failureRuntimeStopped=true;await save();
 }
}
