// Exact packaged storage services, with normal application readiness held.
// No backend, BrowserWindow, provider or native agent may start in this probe.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractFile} from '@electron/asar';
import WebSocket from 'ws';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {authorizeStorageProfile} from './profile-storage-authority.mjs';

function bootstrap(cfg){
 const electron=require('electron'),{app}=electron,fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
 if(app.isReady())throw Error('Storage isolation ran too late');
 app.setPath('home',cfg.home);app.setPath('appData',cfg.appData);app.setPath('userData',cfg.profile);app.setPath('sessionData',cfg.profile);
 app.commandLine.appendSwitch('disable-background-networking');
 const state={heldReadyCalls:0,constructors:[],nodeProcesses:[],network:[]};globalThis.__storagePreflight={electron,state};
 const ready=app.whenReady.bind(app);app.whenReady=()=>{state.heldReadyCalls++;return new Promise(()=>{});};
 const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
 const block=(surface,value)=>{state.network.push({surface,targetSha256:hash(String(value))});throw Error('Storage-only network disabled');};
 globalThis.fetch=async value=>block('fetch',value);
 for(const protocol of ['node:http','node:https']){const module=require(protocol);for(const name of ['request','get'])module[name]=(...args)=>block(protocol+':'+name,args[0]);}
 for(const name of ['connect','createConnection'])require('node:net')[name]=(...args)=>block('node:net:'+name,typeof args[0]==='object'?args[0].host??args[0].path??'socket':args[0]);
 require('node:tls').connect=(...args)=>block('node:tls',typeof args[0]==='object'?args[0].host??'socket':args[0]);
 const child=require('node:child_process');for(const name of ['spawn','spawnSync','exec','execFile','execFileSync','fork'])child[name]=()=>{state.nodeProcesses.push(name);throw Error('Storage-only process creation disabled');};
 for(const [moduleName,name]of [['runtime','Runtime'],['broker','Broker']]){const module=require(app.getAppPath()+'/build/'+moduleName+'.js');module[name]=class{constructor(){state.constructors.push(name);throw Error('Storage-only application construction disabled');}};}
 const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;
 const fingerprint=value=>hash(JSON.stringify(sort(value)));
 let stage='ready';
 void ready().then(async()=>{
  let result;
  try{
   if(cfg.exerciseGuard==='runtime'){stage='guard-exercise';new (require(app.getAppPath()+'/build/runtime.js').Runtime)();}
   if(cfg.exerciseGuard==='network'){stage='guard-exercise';await globalThis.fetch('https://storage-preflight.invalid/');}
   stage='credentials';const {Secrets}=require(app.getAppPath()+'/build/secrets.js'),secrets=new Secrets(cfg.profile);await secrets.load();
   if(cfg.seed){if(Object.keys(secrets.values).length)throw Error('Seed target is not empty');await secrets.set('session',{generated:cfg.marker});await secrets.set('generated-preference',{provider:'openai-oauth',marker:cfg.marker});await fs.mkdir(path.join(cfg.profile,'Partitions/generated-storage'),{recursive:true});}
   const initial=secrets.values;if(!initial||typeof initial!=='object'||!Object.keys(initial).length)throw Error('No copied credential records');
   stage='credential-write';const markerKey='__agentopia-storage-preflight:'+cfg.marker;
   if(Object.hasOwn(initial,markerKey))throw Error('Existing preflight key');
   const before=fingerprint(initial);if(cfg.writeProbe){await secrets.set(markerKey,{generated:cfg.marker});const reread=new Secrets(cfg.profile);await reread.load();if(reread.get(markerKey)?.generated!==cfg.marker)throw Error('Encrypted write did not persist');await reread.set(markerKey,undefined);await secrets.load();if(fingerprint(secrets.values)!==before)throw Error('Credential cleanup changed saved values');}
   stage='cookie-sessions';const dirs=await fs.readdir(path.join(cfg.profile,'Partitions'),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;}),locations=[{id:'default',path:cfg.profile}];
   for(const entry of dirs){if(!entry.isDirectory()||entry.isSymbolicLink()||!/^[a-z0-9_.-]{1,200}$/i.test(entry.name))throw Error('Unsupported persistent partition');locations.push({id:hash(entry.name),path:path.join(cfg.profile,'Partitions',entry.name)});}
   const cookies=[];
   for(const location of locations){const session=electron.session.fromPath(location.path);if(path.resolve(session.storagePath).toLowerCase()!==path.resolve(location.path).toLowerCase())throw Error('Session storage left its copied path');session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{state.network.push({surface:'browser',targetSha256:hash(details.url)});callback({cancel:true});});
    if(cfg.seed)await session.cookies.set({url:'https://storage-preflight.invalid',name:'generated-persistent',value:cfg.marker,expirationDate:Math.floor(Date.now()/1000)+86400});
    stage='cookie-read';const values=await session.cookies.get({}),stable=values.map(cookie=>sort(cookie)).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);cookies.push({partition:location.id,count:values.length,valuesSha256:fingerprint(stable)});
    if(cfg.writeProbe&&location.id==='default'){stage='cookie-write';await session.cookies.set({url:'https://storage-preflight.invalid',name:'generated-preflight',value:cfg.marker,expirationDate:Date.now()/1000+3600});if(!(await session.cookies.get({name:'generated-preflight'})).some(cookie=>cookie.value===cfg.marker))throw Error('Cookie write did not persist');await session.cookies.remove('https://storage-preflight.invalid','generated-preflight');}
    await session.cookies.flushStore();session.flushStorageData();
   }
   cookies.sort((a,b)=>a.partition<b.partition?-1:a.partition>b.partition?1:0);
   stage='expected-values';if(cfg.expectedCredentialValuesSha256&&cfg.expectedCredentialValuesSha256!==before||cfg.expectedCookieValuesSha256&&cfg.expectedCookieValuesSha256!==fingerprint(cookies))throw Error('Copied storage differs from the verified source');
   stage='invariants';if(state.heldReadyCalls<1||state.constructors.length||state.nodeProcesses.length||state.network.length||electron.BrowserWindow.getAllWindows().length)throw Error('Application work escaped storage-only isolation');
   result={success:true,credentialRecords:Object.keys(secrets.values).length,credentialValuesSha256:before,hasSavedSession:!!secrets.get('session'),cookiePartitions:cookies,cookieValuesSha256:fingerprint(cookies),cookiesRead:cookies.reduce((n,row)=>n+row.count,0),encryptedWriteVerified:!!cfg.writeProbe,cookieWriteVerified:!!cfg.writeProbe,profile:app.getPath('userData'),sessionData:app.getPath('sessionData'),version:app.getVersion(),packaged:app.isPackaged,windows:electron.BrowserWindow.getAllWindows().length,state};
  }catch(error){result={success:false,failedStage:stage,errorClass:error?.name??'Error',profile:app.getPath('userData'),windows:electron.BrowserWindow.getAllWindows().length,state};}
  await fs.writeFile(cfg.result,JSON.stringify(result,null,2),{flag:'wx'});globalThis.__storagePreflight.result=result;
 }).catch(async()=>{await fs.writeFile(cfg.result,JSON.stringify({success:false,failedStage:'result-write',state}),{flag:'wx'}).catch(()=>{});});
 return {beforeReady:!app.isReady(),profile:app.getPath('userData'),packaged:app.isPackaged};
}

const bounded=(promise,ms)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Storage probe timeout')),ms))]).finally(()=>clearTimeout(timer));};
export async function launchStoragePreflight(cfg){
 const qa=path.resolve('C:/Users/charl/AgentopiaQA/storage-preflight');assert(path.resolve(cfg.out).startsWith(qa+path.sep));await authorizeStorageProfile(cfg);assert.equal(path.resolve(cfg.exe),path.join(path.resolve(cfg.out),'program/Agentopia.exe'));
 assert(/^[a-z0-9-]+$/.test(cfg.label));for(const value of [cfg.home,cfg.appData])assert(path.resolve(value).startsWith(path.resolve(cfg.out)+path.sep));
 const folder=path.join(cfg.out,cfg.label);await mkdir(folder,{recursive:true});const result=path.join(folder,'result.json'),receipt={at:new Date().toISOString(),out:folder,profile:cfg.profile,storageOnly:true,ordinaryProfileChanged:false,providerRequests:0,success:false};
 const env={...process.env,PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','AGENTOPIA_TEST_PROFILE'])delete env[key];
 let socket,nodeUrl,stderr='',sequence=0;const pending=new Map(),pauses=[];const child=spawn(cfg.exe,['--inspect-brk=0'],{env,cwd:os.tmpdir(),windowsHide:true,stdio:['ignore','pipe','pipe']});const exited=new Promise(resolve=>child.once('exit',resolve));child.stdout.resume();child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-20000);nodeUrl??=stderr.match(/Debugger listening on (ws:\/\/[^\s]+)/)?.[1];});
 const waitFor=async(fn,ms=30000)=>{const until=Date.now()+ms;while(Date.now()<until){const value=await fn();if(value)return value;if(child.exitCode!==null)throw Error('Storage probe exited before verification');await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Storage probe observation timeout');};
 const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Storage debugger timeout'));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 try{
  await waitFor(()=>nodeUrl);socket=new WebSocket(nodeUrl);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.on('message',bytes=>{const frame=JSON.parse(String(bytes));if(frame.id){const item=pending.get(frame.id);if(!item)return;clearTimeout(item.timer);pending.delete(frame.id);frame.error?item.reject(Error('Storage debugger rejected evaluation')):item.resolve(frame.result);}else if(frame.method==='Debugger.paused')pauses.push(frame.params);});
  await rpc('Debugger.enable');const breakpoint=await rpc('Debugger.setBreakpointByUrl',{lineNumber:0,urlRegex:'app\\.asar[/\\\\]build[/\\\\]main\\.js$'});await rpc('Runtime.runIfWaitingForDebugger');let stopped;
  for(let n=0;n<6;n++){const pause=await waitFor(()=>pauses.shift());if(pause.hitBreakpoints?.includes(breakpoint.breakpointId)){stopped=pause;break;}await rpc('Debugger.resume');}assert(stopped);const frame=stopped.callFrames[0],script=await rpc('Debugger.getScriptSource',{scriptId:frame.location.scriptId});assert.equal(script.scriptSource,extractFile(path.join(cfg.out,'program/resources/app.asar'),'build/main.js').toString());receipt.mainModuleVerified=true;
  const setup=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:'('+bootstrap.toString()+')('+JSON.stringify({...cfg,result})+')',returnByValue:true});assert(!setup.exceptionDetails,'Storage isolation bootstrap failed');assert(setup.result.value.beforeReady&&setup.result.value.packaged);receipt.bootstrap=setup.result.value;
  await rpc('Debugger.removeBreakpoint',{breakpointId:breakpoint.breakpointId});await rpc('Debugger.resume');await rpc('Debugger.disable');
  receipt.result=await waitFor(async()=>{try{return JSON.parse(await readFile(result,'utf8'));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return;throw error;}},60000);
  socket.send(JSON.stringify({id:++sequence,method:'Runtime.evaluate',params:{expression:'globalThis.__storagePreflight.electron.app.quit()'}}));socket.close();socket=undefined;assert.equal(await bounded(exited,20000),0);receipt.preflightExitCode=0;receipt.success=receipt.result.success;
  const digest=createHash('sha256').update(await readFile(path.join(cfg.out,'program/resources/app.asar'))).digest('hex');assert.equal(digest,cfg.imageSha256);receipt.imageSha256=digest;
 }catch(error){receipt.error=error.message;throw Object.assign(Error('Storage preflight failed; inspect protected receipt: '+folder),{cause:error});}
 finally{socket?.close();for(const p of pending.values())clearTimeout(p.timer);if(child.exitCode===null){child.kill();await bounded(exited,5000).catch(()=>{});}await writeFile(path.join(folder,'evidence.json'),JSON.stringify(receipt,null,2));}
 return receipt;
}
