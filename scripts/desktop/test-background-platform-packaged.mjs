import {runBackgroundCommandsPackaged,verifyBackgroundCommandsReopen} from './background-command-packaged-workflows.mjs';
import {runImageChildPackaged,verifyImageChildrenReopen} from './image-child-workflows.mjs';
import {installImageGuard,runImagePackaged,verifyImagePackagedReopen} from './image-packaged-workflows.mjs';
import {_electron,expect} from '@playwright/test';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,cp,realpath,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {extractAll} from '@electron/asar';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {installCoordinationGuard,runCoordinationControlled,verifyCoordinationReopen} from './coordination-controlled-workflows.mjs';
import {runScheduledPackaged,verifyScheduledPackagedReopen} from './scheduled-packaged-workflows.mjs';

desktopOperation('packaged background commands, platform restoration and cold recovery rehearsal');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile);
const version='0.44.30',candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04430'),release=JSON.parse(await readFile(path.join(candidate,'qualification.json'),'utf8')),schema=69;
assert(release.success&&!release.installed&&release.version===version&&release.migrations===schema);
const id=randomUUID(),distribution='AgentopiaRuntime-'+id;
const production='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const profileName='cd-'+id;
const out=path.join(root,'.supabase/desktop-packaged-coordination',String(Date.now())),logicalProfile=path.join(process.env.APPDATA,'Agentopia/test-profiles',profileName);let profile=logicalProfile;
const resources=path.join(out,'program/resources/resources'),storage=path.join(out,'wsl');
const delivered=path.join(release.portableDirectory,'resources/resources');
const image=release.image;
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
assert(before.running.includes(production)&&!before.running.includes('AgentopiaRuntime')&&!before.registered.includes(distribution));
await mkdir(out,{recursive:true});assert.equal((await realpath(out)).toLowerCase(),out.toLowerCase());
const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true})).stdout.trim();
assert(/^S-1-5-[0-9-]+$/.test(sid));
await exec('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await mkdir(logicalProfile,{recursive:true});profile=await realpath(logicalProfile);assert.equal(path.basename(profile),profileName);assert.equal(path.basename(path.dirname(profile)),'test-profiles');assert.equal(path.basename(path.dirname(path.dirname(profile))),'Agentopia');await exec('icacls.exe',[profile,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
assert(path.join(profile,'codex/_/openai-oauth','a'.repeat(32)).length<=210,'Choose a shorter isolated profile before copying resources or importing WSL.');
await cp(release.portableDirectory,path.join(out,'program'),{recursive:true});
await copyFile(path.join(root,'scripts/desktop/audit-background-runtime.py'),path.join(out,'audit-coordination-runtime.py'));
await copyFile(path.join(root,'scripts/desktop/test-background-platform-packaged.mjs'),path.join(out,'test-packaged-coordination.mjs'));
await copyFile(path.join(root,'scripts/desktop/prepare-background-snapshot.py'),path.join(out,'prepare-coordination-snapshot.py'));
await copyFile(path.join(root,'scripts/desktop/coordination-controlled-workflows.mjs'),path.join(out,'coordination-controlled-workflows.mjs'));
await copyFile(path.join(root,'scripts/desktop/scheduled-packaged-workflows.mjs'),path.join(out,'scheduled-packaged-workflows.mjs'));
await copyFile(path.join(root,'scripts/desktop/image-packaged-workflows.mjs'),path.join(out,'image-packaged-workflows.mjs'));
await copyFile(path.join(root,'scripts/desktop/image-child-workflows.mjs'),path.join(out,'image-child-workflows.mjs'));
await copyFile(path.join(root,'scripts/desktop/background-command-packaged-workflows.mjs'),path.join(out,'background-command-packaged-workflows.mjs'));
extractAll(image,path.join(out,'archived'));
const require=createRequire(path.join(out,'archived/package.json'));
const {Runtime,coreServicesReady}=require('./build/runtime.js'),{receiveBackup}=require('./build/transfer.js');
await cp(path.join(delivered,'runtime'),path.join(resources,'runtime'),{recursive:true});
await cp(path.join(delivered,'database'),path.join(resources,'database'),{recursive:true});
await copyFile(path.join(delivered,'version.json'),path.join(resources,'version.json'));
const handles=[];let base;
try{
 for(let attempt=0;attempt<30;attempt++){
  base=59000+Math.floor(Math.random()*2500);
  try{for(let offset=0;offset<6;offset++){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(base+offset,'127.0.0.1',resolve);});handles.push(server);}break;}
  catch{await Promise.all(handles.splice(0).map(server=>new Promise(resolve=>server.close(resolve))));base=undefined;}
 }
 assert(base&&handles.length===6);
}finally{await Promise.all(handles.map(server=>new Promise(resolve=>server.close(resolve))));}
const ports={api:base+1,database:base+2,shadow:base,studio:base+3,smtp:base+4,inspector:base+5};
assert.equal(await run(['-d',production,'-u','agentopia','--exec','python3','-c',
 'import socket; sockets=[]\ntry:\n for port in range('+base+','+(base+6)+'):\n  connection=socket.socket(); connection.bind(("127.0.0.1",port)); sockets.append(connection)\n print("free")\nfinally:\n for connection in sockets: connection.close()']), 'free');
let configuration=await readFile(path.join(resources,'runtime/config.toml'),'utf8');
for(let offset=0;offset<6;offset++)configuration=configuration.replaceAll(String(57320+offset),String(base+offset));
assert(!configuration.includes('5732'));
await writeFile(path.join(resources,'runtime/config.toml'),configuration);
// The verified snapshot and its root-key fingerprint are prepared before import.
const intent={at:new Date().toISOString(),pid:process.pid,version,schema,sourceSchema:67,imageSha256:release.imageSha256,
 instanceId:id,distribution,storage,profile,logicalProfile,profileLinux:linux(profile),ports,sourceBackup:null,
 rootKeySha256:null,production,productionMigrated:false,providerRequests:0,
 runtimeArchiveSha256:await hashFile(path.join(delivered,'runtime.tar.gz')),
 resourceDifference:'Supabase test ports only; all code and migrations remain delivered bytes.'};
await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2),{flag:'wx'});
const evidence={...intent,checks:[],phase:'prepared',before,progress:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
const check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};
let runtime,registered=false;
const registration=async()=>{
 const script="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";
 const result=JSON.parse((await exec('wsl.exe',['-d',production,'-u','agentopia','--exec','/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000})).stdout);
 assert.equal(result.name,distribution);
 const actual=path.win32.normalize(result.path.replace(/^\\\\\?\\/,''));
 assert.equal(actual.toLowerCase(),storage.toLowerCase());assert(actual.toLowerCase().startsWith(out.toLowerCase()+path.sep));
 return result;
};
let application;
const executable=path.join(out,'program/Agentopia.exe');
const audit=async()=>JSON.parse(await runtime.command(['python3',linux(path.join(out,'audit-coordination-runtime.py')),linux(out)],60000));
async function launch(label,signedIn=false){
 const env={...process.env,AGENTOPIA_TEST_PROFILE:profileName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:executable,cwd:os.tmpdir(),env,timeout:60000});
 const page=await application.firstWindow();
 const info=await application.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),appPath:app.getAppPath(),exe:app.getPath('exe')}));
 assert(info.packaged);assert.equal(info.version,version);assert([logicalProfile.toLowerCase(),profile.toLowerCase()].includes(info.userData.toLowerCase()));const physical={userData:await realpath(info.userData),sessionData:await realpath(info.sessionData)};assert.equal(physical.userData.toLowerCase(),profile.toLowerCase());assert.equal(physical.sessionData.toLowerCase(),profile.toLowerCase());info.physical=physical;assert.equal(info.exe.toLowerCase(),executable.toLowerCase());
 assert.equal(info.appPath.toLowerCase(),path.join(out,'program/resources/app.asar').toLowerCase());
 await installCoordinationGuard(application,{maxResponses:80});await installImageGuard(application);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let status,last;const deadline=Date.now()+240000;
 while(Date.now()<deadline){
  status=await page.evaluate(()=>window.agentopia?.call('runtime.status')??{ready:false,phase:'loading'});
  if(status.phase!==last){last=status.phase;console.log(label+': '+status.phase);}
  if(status.phase==='error')throw Error(status.message);
  if(status.ready)break;await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert(status?.ready,'The packaged program did not report a ready local session.');
 if(signedIn)await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:30000});else{await expect(page.getByLabel('Email address',{exact:true})).toBeVisible({timeout:15000});await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();}
 assert(page.url().startsWith('agentopia://app/'));assert.deepEqual(errors,[]);
 const network=await application.evaluate(()=>({calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked}));assert.deepEqual(network.blocked,[]);
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
 evidence.phase='snapshot';await save();const snapshot=JSON.parse(await run(['-d',production,'-u','agentopia','--exec','python3',linux(path.join(out,'prepare-coordination-snapshot.py')),linux(out)],300000));assert(snapshot.success&&snapshot.temporaryDatabaseRemoved);Object.assign(intent,{sourceBackup:snapshot.backupDirectory,rootKeySha256:snapshot.rootKeySha256});evidence.snapshot=snapshot;evidence.sourceBackup=snapshot.backupDirectory;evidence.rootKeySha256=snapshot.rootKeySha256;await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2));await save();
 await receiveBackup(snapshot.backupDirectory,path.join(profile,'migration-input'),production);const manifest=await json(path.join(profile,'migration-input/manifest.json'));for(const entry of manifest.files)assert.equal(await hashFile(path.join(profile,'migration-input',entry.name)),entry.sha256);
 await check('The actual packaged program is copied intact and its isolated profile receives the verified database snapshot.');
 evidence.phase='importing';await save();await run(['--import',distribution,storage,path.join(delivered,'runtime.tar.gz'),'--version','2'],600000);registered=true;
 evidence.registration=await registration();
 await run(['-d',distribution,'-u','root','--exec','python3','-c',"from pathlib import Path;assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1';assert not list(Path('/home/agentopia/.supabase/stacks').glob('*'));Path('/opt/agentopia/runtime-instance').write_text("+JSON.stringify(id)+")"]);
 await writeFile(path.join(profile,'runtime-binding.json'),JSON.stringify({format:1,distribution,instanceId:id}),{flag:'wx'});
 const probeEnv={...process.env,ELECTRON_RUN_AS_NODE:'1'};const resolved=JSON.parse((await exec(executable,['-e',"const fs=require('node:fs');console.log(JSON.stringify({profile:fs.realpathSync.native("+JSON.stringify(logicalProfile)+")}))"],{cwd:os.tmpdir(),env:probeEnv,encoding:'utf8',windowsHide:true,timeout:15000})).stdout.trim());assert.equal(resolved.profile.toLowerCase(),profile.toLowerCase());evidence.packagedProfileProbe=resolved;
 runtime=new Runtime(resources,profile,()=>{});
 evidence.phase='first-launch';await save();evidence.firstLaunch=await launch('first-launch');
 await check(`The real ${version} executable starts its packaged entry point and frontend, restores the backend and opens the sign-in screen with Windows developer tools removed from PATH.`);
 evidence.firstAudit=await audit();assert(evidence.firstAudit.success&&evidence.firstAudit.schema===schema&&coreServicesReady({runtime:'native',services:evidence.firstAudit.services}));
 await check(`Application initialization preserves every original row and readable vault records after applying schema ${schema}.`);
 const secondEnv={...process.env,AGENTOPIA_TEST_PROFILE:profileName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete secondEnv.ELECTRON_RUN_AS_NODE;await exec(executable,[],{cwd:os.tmpdir(),env:secondEnv,windowsHide:true,timeout:15000});
 assert(application.process().exitCode===null);assert.equal((await application.windows()).length,1);evidence.secondInstanceExit=true;
 await check('A second launch exits after focusing the existing instance instead of creating another window or backend.');
 evidence.phase='controlled-workflows';await save();await runCoordinationControlled({application,page:await application.firstWindow(),runtime,out,evidence,save,check});await runScheduledPackaged({application,page:await application.firstWindow(),runtime,out,evidence,save,check});await runImagePackaged({application,page:await application.firstWindow(),out,evidence,save,check,baseOnly:true});await runImageChildPackaged({application,page:await application.firstWindow(),out,evidence,save,check});await runBackgroundCommandsPackaged({application,page:await application.firstWindow(),runtime,out,evidence,save,check});await expect.poll(()=>application.evaluate(()=>globalThis.__coordination.broker.active.size+globalThis.__coordination.broker.goals.size),{timeout:30000}).toBe(0);
 await closeNormally();evidence.phase='closed-once';await save();
 await check('Closing the real window exits normally and stops only its bound private runtime.');
 evidence.secondLaunch=await launch('second-launch',true);await verifyBackgroundCommandsReopen({application,page:await application.firstWindow(),out,evidence,save,check});await verifyImageChildrenReopen({application,page:await application.firstWindow(),evidence,check});await verifyCoordinationReopen({application,page:await application.firstWindow(),evidence,check,out});await verifyScheduledPackagedReopen({application,page:await application.firstWindow(),evidence,check,out});evidence.secondAudit=await audit();assert(evidence.secondAudit.success&&evidence.secondAudit.schema===schema);
 await check('The real executable cold-starts again with the saved profile, restored database and encryption bindings intact.');
 await closeNormally();await registration();await run(['--unregister',distribution],120000);registered=false;
 assert.deepEqual((await list()).sort(),[...before.registered].sort());assert.deepEqual((await list(true)).sort(),[...before.running].sort());
 evidence.disposableRuntimeRemoved=true;await check('The owned test runtime is removed after checking its storage registration and all other distributions retain their original states.');
 evidence.phase='completed';evidence.success=true;await save();console.log(JSON.stringify({success:true,version,checks:evidence.checks,evidence:path.join(out,'evidence.json'),productionMigrated:false,installed:false,providerRequests:0},null,2));
}catch(error){evidence.success=false;evidence.error=error.message;evidence.registered=registered;
 if(application){
  try{evidence.failureRuntime=await application.evaluate(async()=>{const s=globalThis.__coordination,b=s?.broker;return {calls:s?.calls,blocked:s?.blocked,errors:s?.errors,trace:s?.trace,active:b?[...b.active.keys()]:[],native:b?[...b.native.running.keys()]:[]};});}catch{}
  try{const page=await application.firstWindow();await page.screenshot({path:path.join(out,'failure.png')});await writeFile(path.join(out,'failure-aria.txt'),await page.locator('body').ariaSnapshot());}catch{}
  try{if(evidence.sourceRequest)evidence.failureSource=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('id,status,error').eq('id',id).eq('user_id',(await b.identity()).id).single();if(r.error)throw Error(r.error.message);return r.data;},evidence.sourceRequest);}catch{}
 }
 await save();throw Error('Packaged coordination stopped; inspect saved request outcomes and the retained checkpoint before recovery: '+out,{cause:error});}
finally{
 if(application){try{await closeNormally();evidence.failureClosedNormally=true;}catch{evidence.failureClosedNormally=false;await application?.close().catch(()=>{});}await save();}
 if(registered&&(await list(true)).includes(distribution)){
  await registration();await run(['-d',distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop']).catch(()=>{});await run(['--terminate',distribution],30000);evidence.failureRuntimeStopped=true;await save();
 }
}
