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


desktopOperation('continue background acceptance with an attachable generated workspace');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),out=path.join(root,'.supabase/desktop-packaged-coordination/1792374110271');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const cfg=await json(path.join(out,'intent.json')),prior=await json(path.join(out,'evidence.json'));assert.equal(cfg.version,'0.44.30');assert.equal(cfg.schema,69);assert(prior.success===false&&prior.failureClosedNormally);assert.equal(prior.failureRuntime.active.length,0);assert.equal(prior.backgroundCommands?.phase,'prepared');assert(!prior.backgroundCommands.A);assert.match(prior.error,/Credential, backend, and dependency paths cannot be attached/);assert(prior.fixtureUser&&prior.imageChildren?.assignmentRevokedAfterParentEnd);
const version=cfg.version,schema=cfg.schema,distribution=cfg.distribution,production=cfg.production,storage=cfg.storage,profile=cfg.profile,profileName=path.basename(profile),logicalProfile=cfg.logicalProfile,id=cfg.instanceId;
assert.equal(distribution,'AgentopiaRuntime-'+id);assert.equal(path.dirname(storage).toLowerCase(),out.toLowerCase());assert.equal(path.basename(profile),'cd-'+id);assert.equal((await realpath(profile)).toLowerCase(),profile.toLowerCase());
const binding=await json(path.join(profile,'runtime-binding.json'));assert.equal(binding.distribution,distribution);assert.equal(binding.instanceId,id);
const resources=path.join(out,'program/resources/resources'),image=path.join(out,'program/resources/app.asar'),release=await json(path.join(root,'.supabase/desktop-platform-release/candidate-04430/qualification.json'));assert(release.success&&release.imageSha256===cfg.imageSha256);assert.equal(await hashFile(image),cfg.imageSha256);
const firstAttempt=path.join(out,'attachment-attempt-'+Date.now()+'.json');await writeFile(firstAttempt,JSON.stringify(prior,null,2),{flag:'wx'});
const evidence={...prior,phase:'continuing-after-protected-fixture-refusal',success:false,earlierRecovery:prior.recovery,recovery:{at:new Date().toISOString(),priorEvidence:firstAttempt,priorEvidenceSha256:await hashFile(firstAttempt),retainedProfile:true,retainedDatabaseSnapshot:true,completedProviderCalls:prior.failureRuntime.calls.length,diagnosis:'The attachment guard correctly refused the fixture inside the protected backend directory. Use a newly generated external temporary workspace. Completed coordination/image/goal/scheduling requests are retained and will not run again.'}};for(const key of ['error','registered','failureRuntime','failureClosedNormally'])delete evidence[key];
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};const before=prior.before;let registered=true;
const require=createRequire(path.join(out,'archived/package.json')),{Runtime,coreServicesReady}=require('./build/runtime.js');const runtime=new Runtime(resources,profile,()=>{});
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim();
const linux=value=>'/mnt/'+value[0].toLowerCase()+value.slice(2).replaceAll('\\','/');
const run=async(args,timeout=60000)=>{
 try{const result=await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout,maxBuffer:16*1024*1024});return decode(result.stdout);}
 catch(error){await writeFile(path.join(out,'private-wsl-error.log'),Buffer.concat([error.stdout??Buffer.alloc(0),error.stderr??Buffer.alloc(0)]));throw Error('The owned WSL operation failed; inspect the private diagnostic before recovery.');}
};
const list=async(running=false)=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

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

await registration();assert(!(await list(true)).includes(distribution));assert((await list(true)).includes(production));await copyFile(path.join(root,'scripts/desktop/continue-background-workspace-packaged.mjs'),path.join(out,'resume-background-controller-'+Date.now()+'.mjs'));await save();
try{
 evidence.continuationLaunch=await launch('continuation-launch',true);await check('The retained protected-path refusal is confirmed; earlier completed platform requests remain saved while only the background fixture uses a new external temporary folder.');
 await runBackgroundCommandsPackaged({application,page:await application.firstWindow(),runtime,out,evidence,save,check});await expect.poll(()=>application.evaluate(()=>globalThis.__coordination.broker.active.size+globalThis.__coordination.broker.goals.size),{timeout:30000}).toBe(0);
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
