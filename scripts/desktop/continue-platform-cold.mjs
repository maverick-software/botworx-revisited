import {_electron,expect} from '@playwright/test';
import {readFile,writeFile,mkdir,copyFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {installCoordinationGuard,verifyCoordinationReopen} from './coordination-controlled-workflows.mjs';
import {verifyScheduledPackagedReopen} from './scheduled-packaged-workflows.mjs';

desktopOperation('continue owned platform cold-reopen checkpoint');
const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];assert.equal(id,'1792361730670');
const original=path.join(root,'.supabase/desktop-packaged-coordination',id),json=async file=>JSON.parse(await readFile(file,'utf8'));
const prior=await json(path.join(original,'evidence.json')),intent=await json(path.join(original,'intent.json'));
assert(prior.failureClosedNormally&&prior.phase==='closed-once'&&prior.version==='0.44.24'&&prior.schema===67);assert(prior.checks.some(s=>s.startsWith('Closing the real window')));assert(prior.error.includes('New chat'));
const out=path.join(original,'cold-continuation-'+Date.now());await mkdir(out);for(const file of ['continue-platform-cold.mjs','coordination-controlled-workflows.mjs','scheduled-packaged-workflows.mjs'])await copyFile(path.join(root,'scripts/desktop',file),path.join(out,file));
const executable=path.join(original,'program/Agentopia.exe'),image=path.join(original,'program/resources/app.asar'),h=createHash('sha256');for await(const bytes of createReadStream(image))h.update(bytes);assert.equal(h.digest('hex'),intent.imageSha256);
const exec=promisify(execFile),decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim(),run=async(args)=>decode((await exec('wsl.exe',args,{windowsHide:true,encoding:'buffer',timeout:120000,maxBuffer:4*1024*1024})).stdout),linux=file=>'/mnt/'+file[0].toLowerCase()+file.slice(2).replaceAll('\\','/');
const list=async running=>(await run(['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
const registered=await list(),running=await list(true);assert(registered.includes(intent.distribution)&&!running.includes(intent.distribution));
async function registration(){const script="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+intent.distribution+"'){@{name=$r.DistributionName;path=$r.BasePath}|ConvertTo-Json -Compress}}";const found=JSON.parse(await run(['-d',intent.production,'-u','agentopia','--exec','/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',script]));assert.equal(found.name,intent.distribution);const target=path.win32.normalize(found.path.replace(/^\\\\\?\\/,''));assert.equal(target.toLowerCase(),intent.storage.toLowerCase());assert(target.toLowerCase().startsWith(original.toLowerCase()+path.sep));}
await registration();
const require=createRequire(path.join(original,'archived/package.json')),{Runtime}=require('./build/runtime.js'),runtime=new Runtime(path.join(original,'program/resources/resources'),intent.profile,()=>{});
const evidence={...prior,priorEvidence:path.join(original,'evidence.json'),priorFixtureError:prior.error,error:undefined,success:false,phase:'cold-continuation',checks:[...prior.checks]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async message=>{evidence.checks.push(message);await save();console.log('PASS: '+message);};await save();let application;
async function close(){const current=application,child=current.process(),exited=child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve));await current.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0]?.close());let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Normal shutdown timed out')),60000);})]);}finally{clearTimeout(timer);}assert.equal(child.exitCode,0);application=undefined;assert(!(await list(true)).includes(intent.distribution));}
try{
 const env={...process.env,AGENTOPIA_TEST_PROFILE:path.basename(intent.profile),PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:executable,cwd:os.tmpdir(),env,timeout:60000});await installCoordinationGuard(application);const page=await application.firstWindow();
 const info=await application.evaluate(({app})=>({exe:app.getPath('exe'),profile:app.getPath('userData'),version:app.getVersion(),packaged:app.isPackaged}));assert.equal(info.exe.toLowerCase(),executable.toLowerCase());assert.equal(info.version,intent.version);assert(info.packaged);assert.equal((await realpath(info.profile)).toLowerCase(),intent.profile.toLowerCase());
 await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:240000});assert.equal((await page.evaluate(()=>window.agentopia.call('auth.state'))).identity.id,prior.fixtureUser);
 await check('Cold startup restores the same signed-in owner and Scheduled sidebar; ordinary New chat is correctly absent from that sidebar.');
 await verifyCoordinationReopen({application,page,evidence,check,out});await verifyScheduledPackagedReopen({application,page,evidence,check,out});
 evidence.secondAudit=JSON.parse(await runtime.command(['python3',linux(path.join(original,'audit-coordination-runtime.py')),linux(original)],60000));assert(evidence.secondAudit.success&&evidence.secondAudit.schema===67);await check('Cold startup preserves every original database row, readable vault value and migration checksum.');
 await close();await registration();await run(['--unregister',intent.distribution]);assert.deepEqual(await list(),registered.filter(name=>name!==intent.distribution));assert.deepEqual(await list(true),running);evidence.disposableRuntimeRemoved=true;evidence.success=true;evidence.phase='completed';await save();
 await writeFile(path.join(root,'.supabase/desktop-platform-release/candidate-04424/full-packaged-acceptance.json'),JSON.stringify({success:true,version:intent.version,imageSha256:intent.imageSha256,schema:67,initialEvidence:path.join(original,'evidence.json'),continuationEvidence:path.join(out,'evidence.json'),providerRequests:0,installed:false,productionMigrated:false},null,2),{flag:'wx'});console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),providerRequests:0}));
}catch(error){evidence.error=error.message;await save();if(application){const page=await application.firstWindow();await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});await writeFile(path.join(out,'failure-aria.txt'),await page.locator('body').ariaSnapshot()).catch(()=>{});}throw error;}
finally{if(application){try{await close();evidence.closedNormally=true;}catch{await application.close().catch(()=>{});}await save();}}
