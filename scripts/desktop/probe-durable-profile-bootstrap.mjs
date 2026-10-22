// Establish a controlled QA home before running the exact packaged main module.
import {_electron,expect} from '@playwright/test';
import {readFile,writeFile,mkdir,readdir,lstat,link,copyFile,realpath} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('probe exact42 startup with isolated Electron home preload');
const root=path.resolve(import.meta.dirname,'../..'),proof=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04442/qualification.json'),'utf8'));assert(proof.success&&proof.version==='0.44.42');
const out=path.resolve('C:/Users/charl/AgentopiaQA/durable-transition',String(Date.now())),home=path.join(out,'home'),roaming=path.join(home,'AppData/Roaming'),legacy=path.join(roaming,'Agentopia'),testName='dp-'+randomUUID(),instance=randomUUID(),binding={format:1,distribution:'AgentopiaRuntime-'+instance,instanceId:instance},program=path.join(home,'AppData/Local/AgentopiaDesktop/app-0.44.42'),exe=path.join(program,'Agentopia.exe');
await mkdir(out,{recursive:true});await mkdir(legacy,{recursive:true});await mkdir(program,{recursive:true});
let linked=0;for(const name of await readdir(proof.portableDirectory,{recursive:true})){const from=path.join(proof.portableDirectory,name),to=path.join(program,name),st=await lstat(from);assert(!st.isSymbolicLink());if(!st.isFile())continue;await mkdir(path.dirname(to),{recursive:true});if(name.replaceAll('\\','/')==='resources/resources/runtime/config.toml')await copyFile(from,to);else await link(from,to);linked++;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(await readFile(path.join(program,'resources/app.asar'))),proof.imageSha256);
const possibleProfiles=[path.join(process.env.APPDATA,'Agentopia/test-profiles',testName),path.join(legacy,'test-profiles',testName)];const physicalProfiles=[];for(const folder of possibleProfiles){await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'runtime-binding.json'),JSON.stringify(binding),{flag:'wx'});physicalProfiles.push(await realpath(folder));}
const bootstrap=path.join(out,'bootstrap.cjs'),intent={out,home,roaming,legacy,program,exe,testName,instance,binding,physicalProfiles,imageSha256:proof.imageSha256,linked};await writeFile(path.join(out,'intent.json'),JSON.stringify(intent,null,2));
await writeFile(bootstrap,`const{app}=require('electron'),fs=require('node:fs'),c=require(${JSON.stringify(path.join(out,'intent.json'))});if(app.isReady())throw Error('Profile bootstrap ran too late');app.setPath('home',c.home);app.setPath('appData',c.roaming);app.setPath('userData',c.legacy);app.setPath('sessionData',c.legacy);fs.writeFileSync(require('node:path').join(c.out,'bootstrap-observed.json'),JSON.stringify({beforeReady:true,home:app.getPath('home'),appData:app.getPath('appData'),userData:app.getPath('userData')}));globalThis.fetch=async()=>{throw Error('External access disabled for profile bootstrap probe');};`);
const evidence={at:new Date().toISOString(),out,imageSha256:proof.imageSha256,exactArchive:true,controlledHomePreload:true,providerRequests:0,productionAccess:false,success:false};let app;
try{
 const env={...process.env,AGENTOPIA_TEST_PROFILE:testName,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({executablePath:exe,args:['-r',bootstrap],cwd:os.tmpdir(),env,timeout:60000});const page=await app.firstWindow();
 evidence.bootstrap=JSON.parse(await readFile(path.join(out,'bootstrap-observed.json'),'utf8'));assert(evidence.bootstrap.beforeReady);assert.equal(evidence.bootstrap.home,home);
 evidence.actual=await app.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,home:app.getPath('home'),appData:app.getPath('appData'),userData:app.getPath('userData'),exe:app.getPath('exe')}));assert(evidence.actual.packaged&&evidence.actual.version==='0.44.42');assert.equal(evidence.actual.home,home);assert.equal(evidence.actual.userData,path.join(legacy,'test-profiles',testName));
 await expect.poll(async()=>page.evaluate(()=>window.agentopia?.call('runtime.status')),{timeout:30000}).toMatchObject({phase:'error',ready:false});
 const status=await page.evaluate(()=>window.agentopia.call('runtime.status'));assert(status.message.includes('not registered'));evidence.absentPrivateRuntimeRefused=true;await page.screenshot({path:path.join(out,'bootstrap-probe.png')});
 const child=app.process();const ended=new Promise(resolve=>child.once('exit',code=>resolve(code)));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('agentopia://app/'))?.close());const code=await Promise.race([ended,new Promise((_,reject)=>setTimeout(()=>reject(Error('Probe close timeout')),20000))]);assert.equal(code,0);app=undefined;evidence.normalExit=code;
 assert.equal(hash(await readFile(path.join(program,'resources/app.asar'))),proof.imageSha256);evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}
finally{await app?.close().catch(()=>{});await writeFile(path.join(out,'bootstrap-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,out,exactArchive:true,providerRequests:0,error:evidence.error}));}
