import {verifyWorkspaceReaderUI} from './workspace-reader-workflow.mjs';
import {beginDocumentNavigationRecovery,verifyDocumentNavigationRecovery,cleanupDocumentNavigationRecovery} from './document-navigation-recovery.mjs';
import {runMcpOAuthPackaged,verifyMcpOAuthReopen,stopMcpOAuthFixture} from './mcp-oauth-packaged-workflows.mjs';
import {cloneMcpRevocationProgram} from './clone-mcp-revocation-program.mjs';
import {runProviderFailurePackaged,verifyProviderFailureReopen} from './provider-failure-packaged-workflows.mjs';
import {runPublicPluginPackaged,verifyPublicPluginReopen} from './public-plugin-packaged-workflows.mjs';
import {runWorkspaceAccessPackaged,verifyWorkspaceAccessReopen} from './workspace-access-packaged-workflows.mjs';
import {runBackgroundCommandsPackaged,verifyBackgroundCommandsReopen} from './background-command-packaged-workflows.mjs';
import {runImageChildPackaged,verifyImageChildrenReopen} from './image-child-workflows.mjs';
import {installImageGuard,runImagePackaged,verifyImagePackagedReopen} from './image-packaged-workflows.mjs';
import {_electron,expect} from '@playwright/test';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,cp,realpath,stat,statfs} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {extractAll} from '@electron/asar';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {installCoordinationGuard,runCoordinationControlled,verifyCoordinationReopen} from './coordination-controlled-workflows.mjs';
import {runScheduledPackaged,verifyScheduledPackagedReopen} from './scheduled-packaged-workflows.mjs';

desktopOperation('continue isolated39 workspace-reader profile after startup failure');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),version='0.44.39',schema=69,candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04439');
const out=path.resolve(process.argv[2]??'');assert.equal(path.dirname(out),path.resolve('C:/Users/charl/AgentopiaQA/plugin-compatibility'));assert(/^\d{13}$/.test(path.basename(out)));
const json=async file=>JSON.parse(await readFile(file,'utf8')),intent=await json(path.join(out,'intent.json')),priorFile=path.resolve(process.argv[3]??path.join(out,'evidence.json')),priorBytes=await readFile(priorFile),prior=JSON.parse(priorBytes),release=await json(path.join(candidate,'qualification.json'));
assert(priorFile.startsWith(out+path.sep));assert(intent.version===version&&intent.imageSha256===release.imageSha256&&prior.success===false&&prior.failureClosedNormally&&['first-launch','workspace-reader'].includes(prior.phase));
const {distribution,production,storage,profile,logicalProfile}=intent,profileName=path.basename(logicalProfile),resources=path.join(out,'program/resources/resources'),image=release.image;
const hashFile=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};assert.equal(await hashFile(path.join(out,'program/resources/app.asar')),release.imageSha256);assert.equal((await realpath(profile)).toLowerCase(),profile.toLowerCase());
const continuation=path.join(out,'workspace-continuation-'+Date.now());await mkdir(continuation);
const evidence={...prior,at:new Date().toISOString(),success:false,error:undefined,phase:'continuation-prepared',resumedFrom:{file:priorFile,sha256:await hashFile(priorFile)},checks:[...prior.checks],shutdownChecks:[...prior.shutdownChecks],repeatedCompletedRequests:0};
const save=()=>writeFile(path.join(continuation,'evidence.json'),JSON.stringify(evidence,null,2)),check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};
for(const name of ['continue-workspace-reader39-platform.mjs','workspace-reader-workflow.mjs','document-navigation-recovery.mjs'])await copyFile(path.join(root,'scripts/desktop',name),path.join(continuation,name));
const decode=b=>(b.includes(0)?b.toString('utf16le'):b.toString('utf8')).replace(/^\uFEFF/,'').trim(),linux=v=>'/mnt/'+v[0].toLowerCase()+v.slice(2).replaceAll('\\','/');
const run=async(args,timeout=60000)=>{const r=await exec('wsl.exe',args,{encoding:'buffer',windowsHide:true,timeout,maxBuffer:16*1024*1024});return decode(r.stdout);};
const list=async(running=false)=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
assert.deepEqual((await list()).sort(),[...prior.before.registered,distribution].sort());assert.deepEqual((await list(true)).sort(),[...prior.before.running].sort());
const require=createRequire(path.join(out,'archived/package.json')),{Runtime,coreServicesReady}=require('./build/runtime.js');let application,runtime=new Runtime(resources,profile,()=>{}),registered=true;
const registration=async()=>{
 const script="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";
 const result=JSON.parse((await exec('wsl.exe',['-d',production,'-u','agentopia','--exec','/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000})).stdout);
 assert.equal(result.name,distribution);
 const actual=path.win32.normalize(result.path.replace(/^\\\\\?\\/,''));
 assert.equal(actual.toLowerCase(),storage.toLowerCase());assert(actual.toLowerCase().startsWith(out.toLowerCase()+path.sep));
 return result;
};
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
 const current=application,launcherPid=current.process().pid,observed=await current.evaluate(({app})=>({pid:process.pid,exe:app.getPath('exe')}));assert.equal(observed.exe,executable);
 const folder=path.join(out,'shutdown-'+Date.now());await mkdir(folder);const watcher=exec('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/desktop/watch-owned-process.ps1'),String(observed.pid),executable,folder],{windowsHide:true,encoding:'utf8',timeout:160000});watcher.catch(()=>{});
 await expect.poll(async()=>{try{return JSON.parse((await readFile(path.join(folder,'watch-ready.json'),'utf8')).replace(/^\uFEFF/,'')).pid;}catch{return null;}},{timeout:15000}).toBe(observed.pid);
 const startedAt=Date.now();await current.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))?.close());
 await watcher;const exit=JSON.parse((await readFile(path.join(folder,'windows-exit.json'),'utf8')).replace(/^\uFEFF/,''));assert(exit.signaled&&exit.hasExited);assert.equal(exit.exitCode,0);assert(!(await list(true)).includes(distribution));
 (evidence.shutdownChecks??=[]).push({actualPid:observed.pid,launcherPid,folder,exit,elapsedMs:exit.at-startedAt,privateRuntimeStopped:true});await save();
 await Promise.race([current.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);application=undefined;
}

try{await registration();await save();
 evidence.phase='first-launch';await save();evidence.firstLaunch=await launch('reader-resume-'+path.basename(continuation),!!prior.fixtureUser);
 await check(`The real ${version} executable starts its packaged entry point and frontend, restores the backend and restores its isolated session with Windows developer tools removed from PATH.`);
 evidence.firstAudit=await audit();assert(evidence.firstAudit.success&&evidence.firstAudit.schema===schema&&coreServicesReady({runtime:'native',services:evidence.firstAudit.services}));
 await check(`Application initialization preserves every original row and readable vault records after applying schema ${schema}.`);
 const secondEnv={...process.env,AGENTOPIA_TEST_PROFILE:profileName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete secondEnv.ELECTRON_RUN_AS_NODE;await exec(executable,[],{cwd:os.tmpdir(),env:secondEnv,windowsHide:true,timeout:15000});
 assert(application.process().exitCode===null);assert.equal((await application.windows()).length,1);evidence.secondInstanceExit=true;
 await check('A second launch exits after focusing the existing instance instead of creating another window or backend.');
 evidence.phase='workspace-reader';await save();if(!prior.fixtureUser)await setupWorkspaceOwner({application,page:await application.firstWindow(),runtime,evidence,save});else assert.equal((await application.evaluate(async()=>globalThis.__coordination.broker.identity())).id,prior.fixtureUser);
 await verifyWorkspaceReaderUI(application,await application.firstWindow(),out);
 await check('Actual39 workspace search reads PDF/Word/spreadsheet/slides beyond selected sections, reloads closed-pane file changes, searches canvas/native browser pages, bounds2505-match rendering and keeps16-tab controls usable at320px without inference.');
 evidence.navigation=await beginDocumentNavigationRecovery(application,await application.firstWindow());await save();
 await check('Actual39 records reordered file/folder tabs and a focused Markdown section for cold recovery.');
 assert.equal((await application.evaluate(()=>globalThis.__coordination.calls)).length,0);

 await closeNormally();evidence.phase='closed-once';await save();
 await check('Closing the real window exits normally and stops only its bound private runtime.');
 evidence.secondLaunch=await launch('reader-resume-second',true);await verifyDocumentNavigationRecovery(await application.firstWindow(),evidence.navigation);await check('Cold39 reopening restores the fixture session, reordered folder/file tabs and Markdown section focus without inference replay.');await cleanupDocumentNavigationRecovery(await application.firstWindow(),evidence.navigation);evidence.navigation.cleaned=true;assert.equal((await application.evaluate(()=>globalThis.__coordination.calls)).length,0);evidence.secondAudit=await audit();assert(evidence.secondAudit.success&&evidence.secondAudit.schema===schema);
 await check('The real executable cold-starts again with the saved profile, restored database and encryption bindings intact.');
 await closeNormally();await registration();await run(['--unregister',distribution],120000);registered=false;
 assert.deepEqual((await list()).sort(),[...prior.before.registered].sort());assert.deepEqual((await list(true)).sort(),[...prior.before.running].sort());
 evidence.disposableRuntimeRemoved=true;await check('The owned test runtime is removed after checking its storage registration and all other distributions retain their original states.');
 assert.equal(await hashFile(priorFile),evidence.resumedFrom.sha256);evidence.phase='completed';evidence.success=true;await save();console.log(JSON.stringify({success:true,version,checks:evidence.checks,evidence:path.join(continuation,'evidence.json'),productionMigrated:false,installed:false,providerRequests:0},null,2));
}catch(error){evidence.success=false;evidence.error=error.message;evidence.registered=registered;
 if(application){
  try{evidence.failureRuntime=await application.evaluate(async()=>{const s=globalThis.__coordination,b=s?.broker;return {calls:s?.calls,blocked:s?.blocked,errors:s?.errors,trace:s?.trace,active:b?[...b.active.keys()]:[],native:b?[...b.native.running.keys()]:[]};});}catch{}
  try{const page=await application.firstWindow();await page.screenshot({path:path.join(continuation,'failure.png')});await writeFile(path.join(continuation,'failure-aria.txt'),await page.locator('body').ariaSnapshot());}catch{}
  try{if(evidence.sourceRequest)evidence.failureSource=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('id,status,error').eq('id',id).eq('user_id',(await b.identity()).id).single();if(r.error)throw Error(r.error.message);return r.data;},evidence.sourceRequest);}catch{}
 }
 await save();throw Error('Packaged coordination stopped; inspect saved request outcomes and the retained checkpoint before recovery: '+out,{cause:error});}
finally{
 await stopMcpOAuthFixture(out);
 if(application){try{await closeNormally();evidence.failureClosedNormally=true;}catch(closeError){evidence.failureCloseError=closeError.stack;evidence.failureClosedNormally=false;await application?.close().catch(()=>{});}await save();}
 if(registered&&(await list(true)).includes(distribution)){
  await registration();await run(['-d',distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop']).catch(()=>{});await run(['--terminate',distribution],30000);evidence.failureRuntimeStopped=true;await save();
 }
}

export async function setupWorkspaceOwner({application,page,runtime,out,evidence,save,check}){
 const state=JSON.parse(await runtime.command(['supabase','stack','status','--output-format','json'])),{createClient}=await import('@supabase/supabase-js'),db=createClient(state.env.API_URL,state.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),data=result=>{if(result.error)throw Error(result.error.message);return result.data;};
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const account={email:'coordination-'+randomUUID()+'@example.invalid',password:randomUUID()+randomUUID()},user=data(await db.auth.admin.createUser({...account,email_confirm:true})).user,role=data(await db.from('roles').select('id').eq('name','admin').single());data(await db.from('user_roles').insert({user_id:user.id,role_id:role.id}));evidence.fixtureUser=user.id;await save();
 await application.evaluate(async(_,owner)=>{const broker=globalThis.__coordination.broker;if(!broker)throw Error('Packaged initialization was not observed');await broker.secrets.set('openai:'+owner,{client_id:'controlled-private-client',subject:'controlled-subject',email:'controlled@example.invalid',id_token:'CONTROLLED',access_token:'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL',refresh_token:'',scope:'chatgpt.tokens.use.direct',expires_at:Date.now()+3600000});const models=[{id:'gpt-6.1-sol',name:'GPT-6.1 Sol',thinking:['default','low','high'],supportsTools:true}];await broker.secrets.set('models:openai-oauth:'+owner,models);await broker.secrets.set('openrouter',{key:'CONTROLLED-NOT-A-ROUTER-KEY'});await broker.secrets.set('openrouter-default','openai/gpt-6.1-sol');await broker.secrets.set('models:openrouter:shared',[{...models[0],id:'openai/gpt-6.1-sol'}]);await broker.secrets.set('prefer-chatgpt:'+owner,true);await broker.secrets.set('chatgpt-welcome:'+owner,true);},user.id);
 await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:/^New chat\b/}).first()).toBeVisible({timeout:30000});
}
