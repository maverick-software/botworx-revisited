import {_electron,expect} from '@playwright/test';
import {readFile,writeFile,mkdir,copyFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {installCoordinationGuard} from './coordination-controlled-workflows.mjs';
import {observeParallelInputs,verifyParallelReopen} from './parallel-chat-ack-workflows.mjs';
import {installImageGuard} from './image-packaged-workflows.mjs';
import {runChatPolishPackaged,verifyChatPolishReopen,stopChatPolishFixture} from './chat-polish-packaged-workflows.mjs';
desktopOperation('resume owned43 file-menu acceptance after settled UI-test timing failure');
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??''),exec=promisify(execFile),version='0.44.43',schema=69;
assert.equal(path.dirname(out),path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility'));assert(/^\d{13}$/.test(path.basename(out)));
const json=async file=>JSON.parse(await readFile(file,'utf8')),hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04443'),release=await json(path.join(candidate,'qualification.json')),evidence=await json(path.join(out,'evidence.json'));
assert(release.success&&release.version===version&&evidence.version===version&&evidence.imageSha256===release.imageSha256);
assert(!evidence.success&&evidence.failureClosedNormally&&evidence.checks.length===11&&evidence.registered&&evidence.failureRuntime.active.length===0&&evidence.failureRuntime.native.length===0);
assert(evidence.error.includes('Expected values to be strictly deep-equal'));assert(evidence.error.includes('reveal'));
const prior=path.join(out,'evidence-before-menu-timing-resume.json');await copyFile(path.join(out,'evidence.json'),prior);
const profile=evidence.profile,logicalProfile=evidence.logicalProfile,profileName=path.basename(logicalProfile),distribution=evidence.distribution,storage=evidence.storage,production=evidence.production,resources=path.join(out,'program/resources/resources'),executable=path.join(out,'program/Agentopia.exe');
assert.equal((await realpath(logicalProfile)).toLowerCase(),profile.toLowerCase());assert.equal(await hashFile(path.join(out,'program/resources/app.asar')),release.imageSha256);
assert.equal((await json(path.join(profile,'runtime-binding.json'))).distribution,distribution);
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
const run=async(args,timeout=60000)=>decode((await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:16*1024*1024})).stdout),linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const list=async(running=false)=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const registration=async()=>{const query="Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty -LiteralPath $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";const found=JSON.parse((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',query],{windowsHide:true,encoding:'utf8'})).stdout);assert.equal(found.name,distribution);assert.equal(path.win32.normalize(found.path.replace(/^\\\\\?\\/,'' )).toLowerCase(),storage.toLowerCase());assert(storage.toLowerCase().startsWith(out.toLowerCase()+path.sep));return found;};
await registration();assert(!(await list(true)).includes(distribution));assert((await list(true)).includes(production));
const require=createRequire(path.join(out,'archived/package.json')),{Runtime}=require('./build/runtime.js'),runtime=new Runtime(resources,profile,()=>{}),audit=async()=>JSON.parse(await runtime.command(['python3',linux(path.join(out,'audit-coordination-runtime.py')),linux(out)],60000));
const resume={at:new Date().toISOString(),prior,priorSha256:await hashFile(prior),reason:'The menu click dispatches an asynchronous IPC operation; the test must await the recorded Explorer dispatch before inspecting the result. All six previews succeeded before this fixture assertion.',previousShutdownChecks:evidence.shutdownChecks,sourceSha256:await hashFile(path.join(root,'scripts/desktop/chat-polish-packaged-workflows.mjs'))};
evidence.resumes=[resume];evidence.shutdownChecks=[];delete evidence.error;delete evidence.failureRuntime;delete evidence.failureClosedNormally;evidence.phase='resuming-settled-file-workflows';
await copyFile(path.join(root,'scripts/desktop/chat-polish-packaged-workflows.mjs'),path.join(out,'chat-polish-packaged-workflows-resumed.mjs'));await copyFile(import.meta.filename,path.join(out,'resume-chat-polish43-packaged.mjs'));
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async text=>{evidence.checks.push(text);await save();console.log('PASS: '+text);};let application,registered=true;
async function launch(label,signedIn=false){
 const env={...process.env,AGENTOPIA_TEST_PROFILE:profileName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:executable,cwd:os.tmpdir(),env,timeout:60000});
 const page=await application.firstWindow();
 const info=await application.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),appPath:app.getAppPath(),exe:app.getPath('exe')}));
 assert(info.packaged);assert.equal(info.version,version);assert([logicalProfile.toLowerCase(),profile.toLowerCase()].includes(info.userData.toLowerCase()));const physical={userData:await realpath(info.userData),sessionData:await realpath(info.sessionData)};assert.equal(physical.userData.toLowerCase(),profile.toLowerCase());assert.equal(physical.sessionData.toLowerCase(),profile.toLowerCase());info.physical=physical;assert.equal(info.exe.toLowerCase(),executable.toLowerCase());
 assert.equal(info.appPath.toLowerCase(),path.join(out,'program/resources/app.asar').toLowerCase());
 await installCoordinationGuard(application,{maxResponses:80});await observeParallelInputs(application);await installImageGuard(application);
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
 const current=application,launcherPid=current.process().pid,observed=await current.evaluate(({app})=>({pid:process.pid,exe:app.getPath('exe')}));assert.equal(observed.exe,executable);
 const folder=path.join(out,'shutdown-'+Date.now());await mkdir(folder);const watcher=exec('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/desktop/watch-owned-process.ps1'),String(observed.pid),executable,folder],{windowsHide:true,encoding:'utf8',timeout:160000});watcher.catch(()=>{});
 await expect.poll(async()=>{try{return JSON.parse((await readFile(path.join(folder,'watch-ready.json'),'utf8')).replace(/^\uFEFF/,'')).pid;}catch{return null;}},{timeout:15000}).toBe(observed.pid);
 const startedAt=Date.now();await current.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))?.close());
 await watcher;const exit=JSON.parse((await readFile(path.join(folder,'windows-exit.json'),'utf8')).replace(/^\uFEFF/,''));assert(exit.signaled&&exit.hasExited);assert.equal(exit.exitCode,0);assert(!(await list(true)).includes(distribution));
 (evidence.shutdownChecks??=[]).push({actualPid:observed.pid,launcherPid,folder,exit,elapsedMs:exit.at-startedAt,privateRuntimeStopped:true});await save();
 await Promise.race([current.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);application=undefined;
}

try{
 await save();resume.launch=await launch('resumed-launch',true);assert.deepEqual(await application.evaluate(()=>globalThis.__coordination.calls),[]);assert.equal((await (await application.firstWindow()).evaluate(()=>window.agentopia.call('native.active'))).length,0);
 await runChatPolishPackaged({application,page:await application.firstWindow(),out,profile,evidence,save,check});await closeNormally();evidence.phase='closed-once';await save();await check('Closing the real window exits normally and stops only its bound private runtime.');
 evidence.secondLaunch=await launch('second-launch',true);await verifyParallelReopen({application,page:await application.firstWindow(),out,evidence,save,check});await verifyChatPolishReopen({application,page:await application.firstWindow(),out,evidence,save,check});evidence.secondAudit=await audit();assert(evidence.secondAudit.success&&evidence.secondAudit.schema===schema);await check('The real executable cold-starts again with the saved profile, restored database and encryption bindings intact.');
 await closeNormally();evidence.thirdLaunch=await launch('third-launch',true);await verifyParallelReopen({application,page:await application.firstWindow(),out,evidence,save,check,unpinned:true});await closeNormally();await registration();await run(['--unregister',distribution],120000);registered=false;
 assert.deepEqual((await list()).sort(),[...evidence.before.registered].sort());assert.deepEqual((await list(true)).sort(),[...evidence.before.running].sort());evidence.disposableRuntimeRemoved=true;await check('The owned test runtime is removed after checking its storage registration and all other distributions retain their original states.');evidence.phase='completed';evidence.success=true;await save();console.log(JSON.stringify({success:true,out,groups:evidence.checks.length,providerRequests:0}));
}catch(error){evidence.success=false;evidence.error=error.stack;await save();throw error;}finally{await stopChatPolishFixture(out);if(application){try{await closeNormally();}catch{await application.close().catch(()=>{});}}if(registered&&(await list(true)).includes(distribution)){await registration();await run(['--terminate',distribution],30000);}await save();}
