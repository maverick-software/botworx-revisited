import {cloneMcpRevocationProgram} from './clone-mcp-revocation-program.mjs';
import {verifyMcpRevocationPackaged,verifyMcpOAuthReopen,stopMcpOAuthFixture} from './mcp-oauth-packaged-workflows.mjs';
import {installCoordinationGuard,verifyCoordinationReopen} from './coordination-controlled-workflows.mjs';
import {installImageGuard} from './image-packaged-workflows.mjs';
import {_electron,expect} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('continue retained MCP OAuth packaged profile without replay');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04439'),version='0.44.39',schema=69;
const out=path.resolve(process.argv[2]??'');assert.equal(path.dirname(out),path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility'));assert(/^\d{13}$/.test(path.basename(out)));
const json=async file=>JSON.parse(await readFile(file,'utf8')),hashFile=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const previousEvidence=path.resolve(process.argv[3]??'');assert(previousEvidence.startsWith(out+path.sep));const originalBytes=await readFile(previousEvidence),prior=JSON.parse(originalBytes),intent=await json(path.join(out,'intent.json')),release=await json(path.join(candidate,'qualification.json'));assert(release.success&&prior.success===false&&prior.failureClosedNormally&&prior.firstAudit.success);assert(prior.error.includes('Timeout')&&prior.mcpOAuth.phase==='native-completed');assert.equal(intent.version,'0.44.38');assert.equal(prior.imageSha256,intent.imageSha256);assert.equal(await hashFile(release.image),release.imageSha256);
const {distribution,production,storage,profile,logicalProfile}=intent,profileName=path.basename(logicalProfile),resources=path.join(out,'program-04439/resources/resources'),image=release.image;assert.equal((await realpath(profile)).toLowerCase(),profile.toLowerCase());assert.equal(await hashFile(path.join(out,'program/resources/app.asar')),intent.imageSha256);
const sharedUpgradeProgram=await cloneMcpRevocationProgram(root,release,path.join(out,'program-04439'));let upgradedConfig=await readFile(path.join(resources,'runtime/config.toml'),'utf8');for(let n=0;n<6;n++)upgradedConfig=upgradedConfig.replaceAll(String(57320+n),String(intent.ports.shadow+n));await writeFile(path.join(resources,'runtime/config.toml'),upgradedConfig);assert.equal(await hashFile(path.join(out,'program-04439/resources/app.asar')),release.imageSha256);
const continuation=path.join(out,'oauth-revocation39-'+Date.now());await mkdir(continuation);const resumedFrom={path:previousEvidence,sha256:createHash('sha256').update(originalBytes).digest('hex')};
const evidence={...prior,at:new Date().toISOString(),success:false,error:undefined,failureRuntime:undefined,failureSource:undefined,phase:'revocation39-upgrade-prepared',resumedFrom,continuation,version,imageSha256:release.imageSha256,sourceVersion:'0.44.38',sharedUpgradeProgram,checks:[...prior.checks],shutdownChecks:[...prior.shutdownChecks],repeatedCompletedRequests:0};
const save=()=>writeFile(path.join(continuation,'evidence.json'),JSON.stringify(evidence,null,2)),check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};
for(const name of ['continue-mcp-revocation-platform.mjs','mcp-oauth-packaged-workflows.mjs','coordination-controlled-workflows.mjs'])await copyFile(path.join(root,'scripts/desktop',name),path.join(continuation,name));
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim(),linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const run=async(args,timeout=60000)=>{try{const result=await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:16*1024*1024});return decode(result.stdout);}catch(error){await writeFile(path.join(continuation,'private-wsl-error.log'),Buffer.concat([error.stdout??Buffer.alloc(0),error.stderr??Buffer.alloc(0)]));throw Error('The retained owned WSL operation failed.');}};
const list=async(running=false)=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
assert.deepEqual((await list()).sort(),[...prior.before.registered,distribution].sort());assert.deepEqual((await list(true)).sort(),[...prior.before.running].sort());
const require=createRequire(path.join(out,'archived/package.json')),{Runtime,coreServicesReady}=require('./build/runtime.js');let application,runtime=new Runtime(resources,profile,()=>{}),registered=true;

// Retain the same PID-based Windows exit observer and packaged launcher as the
// original rehearsal. They are copied below from that versioned controller.
const registration=async()=>{
 const script="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";
 const result=JSON.parse((await exec('wsl.exe',['-d',production,'-u','agentopia','--exec','/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000})).stdout);
 assert.equal(result.name,distribution);
 const actual=path.win32.normalize(result.path.replace(/^\\\\\?\\/,''));
 assert.equal(actual.toLowerCase(),storage.toLowerCase());assert(actual.toLowerCase().startsWith(out.toLowerCase()+path.sep));
 return result;
};

const executable=path.join(out,'program-04439/Agentopia.exe');
const audit=async()=>JSON.parse(await runtime.command(['python3',linux(path.join(out,'audit-coordination-runtime.py')),linux(out)],60000));
async function launch(label,signedIn=false){
 const env={...process.env,AGENTOPIA_TEST_PROFILE:profileName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:executable,cwd:os.tmpdir(),env,timeout:60000});
 const page=await application.firstWindow();
 const info=await application.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),appPath:app.getAppPath(),exe:app.getPath('exe')}));
 assert(info.packaged);assert.equal(info.version,version);assert([logicalProfile.toLowerCase(),profile.toLowerCase()].includes(info.userData.toLowerCase()));const physical={userData:await realpath(info.userData),sessionData:await realpath(info.sessionData)};assert.equal(physical.userData.toLowerCase(),profile.toLowerCase());assert.equal(physical.sessionData.toLowerCase(),profile.toLowerCase());info.physical=physical;assert.equal(info.exe.toLowerCase(),executable.toLowerCase());
 assert.equal(info.appPath.toLowerCase(),path.join(out,'program-04439/resources/app.asar').toLowerCase());
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
 const current=application,launcherPid=current.process().pid,observed=await current.evaluate(({app})=>({pid:process.pid,exe:app.getPath('exe')}));assert.equal(observed.exe,executable);
 const folder=path.join(out,'shutdown-'+Date.now());await mkdir(folder);const watcher=exec('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/desktop/watch-owned-process.ps1'),String(observed.pid),executable,folder],{windowsHide:true,encoding:'utf8',timeout:160000});watcher.catch(()=>{});
 await expect.poll(async()=>{try{return JSON.parse((await readFile(path.join(folder,'watch-ready.json'),'utf8')).replace(/^\uFEFF/,'')).pid;}catch{return null;}},{timeout:15000}).toBe(observed.pid);
 const startedAt=Date.now();await current.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))?.close());
 await watcher;const exit=JSON.parse((await readFile(path.join(folder,'windows-exit.json'),'utf8')).replace(/^\uFEFF/,''));assert(exit.signaled&&exit.hasExited);assert.equal(exit.exitCode,0);assert(!(await list(true)).includes(distribution));
 (evidence.shutdownChecks??=[]).push({actualPid:observed.pid,launcherPid,folder,exit,elapsedMs:exit.at-startedAt,privateRuntimeStopped:true});await save();
 await Promise.race([current.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);application=undefined;
}


try{
 await registration();await save();evidence.continuationLaunch=await launch('oauth-revocation39-first',true);assert.equal(await application.evaluate(async()=> (await globalThis.__coordination.broker.identity()).id),prior.fixtureUser);
 evidence.continuationFirstAudit=await audit();assert(evidence.continuationFirstAudit.success&&evidence.continuationFirstAudit.schema===schema);await check('The39 packaged executable upgrades the retained38 profile with its controlled account, original rows and completed OAuth chat intact; no completed model request is replayed.');
 await verifyMcpRevocationPackaged({application,page:await application.firstWindow(),out,evidence,save,check});
 evidence.nativeToolReceipts=await application.evaluate(async({app})=>{const b=globalThis.__coordination.broker,owner=(await b.identity()).id,r=await b.admin.from('desktop_tool_calls').select('id,request_id,native_thread_id,name,status,arguments').eq('user_id',owner),turns=await b.admin.from('desktop_codex_turns').select('request_id,state').eq('user_id',owner);if(r.error||turns.error)throw Error('Cannot inspect native receipts');const require=process.getBuiltinModule('module').createRequire(process.getBuiltinModule('path').join(app.getAppPath(),'package.json')),{nativeActivityReceipt}=require('./build/native-activity-presentation.js'),saved=r.data.filter(row=>row.native_thread_id);if(!saved.length||saved.some(row=>!row.arguments?.provider_call_id?.startsWith(row.native_thread_id+':')))throw Error('Native call identity lost');let mapped=0;const walk=(state,id)=>{for(const item of state.items??[])if(nativeActivityReceipt(item,state.items,r.data,id))mapped++;for(const child of state.children??[])walk(child.state,id);for(const report of state.reports??[])walk(report.state,id);};for(const turn of turns.data)walk(turn.state,turn.request_id);if(!mapped)throw Error('No native receipt resolves');return {savedNativeReceipts:saved.length,exactNativeMatches:mapped,allKnownCallIdentitiesPreserved:true};});await save();
 await closeNormally();await check('The continued packaged window closes normally and stops only its bound runtime.');
 evidence.continuationSecondLaunch=await launch('oauth-revocation39-second',true);await verifyCoordinationReopen({application,page:await application.firstWindow(),evidence,check,out});await verifyMcpOAuthReopen({application,page:await application.firstWindow(),out,evidence,save,check});evidence.secondAudit=await audit();assert(evidence.secondAudit.success&&evidence.secondAudit.schema===schema);await check('Both the completed OAuth chat and the original database survive another cold start without inference replay.');
 await closeNormally();await registration();await run(['--unregister',distribution],120000);registered=false;assert.deepEqual((await list()).sort(),[...prior.before.registered].sort());assert.deepEqual((await list(true)).sort(),[...prior.before.running].sort());evidence.disposableRuntimeRemoved=true;await check('Only the exactly registered QA runtime is removed; all other distributions retain their original states.');
 assert.equal(await hashFile(resumedFrom.path),resumedFrom.sha256);evidence.phase='completed';evidence.success=true;await save();console.log(JSON.stringify({success:true,version,checks:evidence.checks.length,evidence:path.join(continuation,'evidence.json'),repeatedCompletedRequests:0,providerRequests:0}));
}catch(error){evidence.error=error.stack;evidence.success=false;try{const page=await application.firstWindow();await page.screenshot({path:path.join(continuation,'failure.png')});await writeFile(path.join(continuation,'failure-aria.txt'),await page.locator('body').ariaSnapshot());await writeFile(path.join(continuation,'failure.html'),await page.content());}catch{}await save();throw error;}
finally{await stopMcpOAuthFixture(out);if(application){try{await closeNormally();evidence.failureClosedNormally=true;}catch(error){evidence.failureCloseError=error.message;await application.close().catch(()=>{});}await save();}if(registered&&(await list(true)).includes(distribution)){await registration();await run(['-d',distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop']).catch(()=>{});await run(['--terminate',distribution],30000);evidence.failureRuntimeStopped=true;await save();}}
