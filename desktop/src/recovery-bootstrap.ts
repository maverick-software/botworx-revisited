import {readFileSync,lstatSync,realpathSync,mkdirSync} from 'node:fs';
import {readFile,rename,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import runtimes from './script-runtime-manifest.json';
import recoveryResources from './recovery-resource-manifest.json';
import {recoveryStartup} from './recovery-startup';
export type RecoveryRequest={format:2;kind:'agentopia-desktop-recovery-request';id:string;home:string;appData:string;profile:string;bundle:string;descriptorSha256:string};
export type QueuedRecovery={request:RecoveryRequest;file:string;fileSha256:string;bootstrap:string};
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex'),same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const inside=(root:string,file:string)=>{const rel=path.relative(root,file);return !!rel&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
function checked(file:string,maximum:number){const info=lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>maximum||!same(realpathSync(file),file))throw Error('A recovery request resource is linked or invalid.');return readFileSync(file);}
function directories(file:string){for(let current=path.resolve(file);;current=path.dirname(current)){try{const info=lstatSync(current);if(!info.isDirectory()||info.isSymbolicLink()||!same(realpathSync(current),current))throw Error('A recovery directory is linked or redirected.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(path.dirname(current)===current)break;}}
export function queuedRecovery(home:string,appData:string,profile:string):QueuedRecovery|undefined{
 const file=path.join(home,'.agentopia/recovery-request.json');let bytes:Buffer;try{bytes=checked(file,16*1024);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 let request:RecoveryRequest;try{request=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('The saved recovery request is not valid JSON.');}
 if(Object.keys(request).sort().join(',')!=='appData,bundle,descriptorSha256,format,home,id,kind,profile'||request.format!==2||request.kind!=='agentopia-desktop-recovery-request'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.id)||!/^[a-f0-9]{64}$/.test(request.descriptorSha256))throw Error('The saved recovery request has an unsupported format.');
 for(const value of [request.home,request.appData,request.profile,request.bundle])if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('\\\\')||/[\x00-\x1f\x7f]/.test(value))throw Error('Recovery requires absolute local paths.');
 if(!same(path.resolve(request.home),path.resolve(home))||!same(path.resolve(request.appData),path.resolve(appData))||!same(path.resolve(request.profile),path.resolve(profile))||!same(path.resolve(profile),path.join(appData,'Agentopia'))||!inside(home,appData))throw Error('This recovery request belongs to another Windows profile.');
 directories(path.dirname(file));directories(request.bundle);
 const descriptor=checked(path.join(request.bundle,'desktop-recovery.json'),1024*1024);if(sha(descriptor)!==request.descriptorSha256)throw Error('The queued recovery bundle changed. Preserve it before continuing.');
 let format;try{format=JSON.parse(descriptor.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('The recovery descriptor is invalid.');}
 if(format.format!==2||format.kind!=='agentopia-desktop-recovery'||![2,3,4,5,6,7,8,9,10,11,12].includes(format.requiresDesktopRecoveryFormat))throw Error('This recovery bundle needs a compatible Agentopia recovery release.');
 if(format.requiresDesktopRecoveryFormat<12&&(format.workspaceManifest||format.workspaceArchive))throw Error('Scheduled workspaces require a newer recovery capability.');
 if(format.requiresDesktopRecoveryFormat<6&&format.layoutsManifest)throw Error('Workspace layouts require a newer recovery capability.');
 if(format.requiresDesktopRecoveryFormat<5&&(format.externalArchive||format.externalManifest))throw Error('External files require a newer recovery capability.');
 if(format.requiresDesktopRecoveryFormat<4&&format.settingsManifest)throw Error('Portable settings require a newer recovery capability.');
 let state:any;try{state=JSON.parse(checked(path.join(home,'.agentopia/recovery-state.json'),64*1024).toString('utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 if(state&&(state.format!==2||state.descriptorSha256!==request.descriptorSha256||!same(path.resolve(state.profile),path.resolve(profile))||!same(path.resolve(state.publicRoot),path.join(home,'Agentopia Files'))||!['preparing','interrupted','prepared'].includes(state.status)))throw Error('A different or completed recovery operation already owns this profile.');
 for(const target of [profile,path.join(home,'Agentopia Files')])try{lstatSync(target);if(!state)throw Error('Existing profile or public files must be preserved before recovery.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const bootstrap=path.join(home,'.agentopia/recovery-bootstrap',request.id);directories(bootstrap);mkdirSync(bootstrap,{recursive:true});directories(bootstrap);
 return {request,file,fileSha256:sha(bytes),bootstrap};
}
async function verifyResources(resources:string){
 const root=await realpath(resources);for(const [name,digest]of Object.entries({...Object.fromEntries(Object.entries(runtimes.files).filter(([name])=>name.startsWith(runtimes.python.directory+'/')).map(([name,digest])=>['script-runtimes/'+name,digest])),...recoveryResources.files})){
  const file=path.resolve(resources,name),info=await lstat(file),actual=await realpath(file);if(!inside(root,actual)||!info.isFile()||info.isSymbolicLink()||sha(await readFile(file))!==digest)throw Error('A bundled recovery tool is missing or changed. Repair Agentopia before restoring data.');
 }
}
const labels:Record<string,string>={'staging-profile':'Restoring saved conversations and workspace files…','staging-public':'Restoring documents…','staging-clipboard':'Restoring pasted images…','staging-settings':'Restoring preferences and unsent drafts…','staging-external':'Restoring selected files and workspace folders…','staging-layouts':'Restoring document tabs and display preferences…','staging-workspaces':'Preparing scheduled workspace recovery…','publishing-files':'Preparing restored files…','rebasing-native-histories':'Restoring native conversation indexes…','verifying-published-files':'Verifying restored data…',prepared:'Recovery prepared. Reopening Agentopia…'};
type Execution=(executable:string,args:string[],options:{windowsHide:boolean;timeout:number;maxBuffer:number;encoding:'utf8';signal?:AbortSignal})=>Promise<{stdout:string;stderr?:string}>;
export async function runQueuedRecovery(queued:QueuedRecovery,resources:string,progress:(message:string)=>void,dependencies:{verify?:(root:string)=>Promise<void>;execute?:Execution;pid?:number;signal?:AbortSignal}={}){
 const current=queuedRecovery(queued.request.home,queued.request.appData,queued.request.profile);if(!current||current.fileSha256!==queued.fileSha256)throw Error('The recovery request changed before preparation started.');
 progress('Verifying your recovery files…');await (dependencies.verify??verifyResources)(resources);
 dependencies.signal?.throwIfAborted();
 const monitor=setInterval(()=>{void readFile(path.join(queued.request.home,'.agentopia/recovery-state.json'),'utf8').then(text=>{const state=JSON.parse(text);if(state.descriptorSha256===queued.request.descriptorSha256&&labels[state.phase])progress(labels[state.phase]);}).catch(()=>{});},500);
 try{
  const execute=dependencies.execute??(promisify(execFile) as Execution),python=path.join(resources,'script-runtimes',runtimes.python.directory,runtimes.python.entry);
  const result=await execute(python,['-I','-B',path.join(resources,'runtime/prepare-desktop-recovery.py'),queued.request.bundle,'--compress-staging','--bootstrap-pid',String(dependencies.pid??process.pid)],{windowsHide:true,timeout:30*60*1000,maxBuffer:1024*1024,encoding:'utf8',signal:dependencies.signal});
  dependencies.signal?.throwIfAborted();
  let status;try{status=JSON.parse(result.stdout.trim());}catch{throw Error('Recovery preparation did not return a verified result.');}if(status.success!==true||status.status!=='prepared'||status.databaseImported!==false)throw Error('Recovery preparation is incomplete. Resume the same recovery before opening the database.');
  const prepared=await recoveryStartup(queued.request.profile,queued.request.home);if(!prepared||prepared.record.descriptorSha256!==queued.request.descriptorSha256)throw Error('The prepared recovery does not match the queued request.');
  const again=checked(queued.file,16*1024);if(sha(again)!==queued.fileSha256)throw Error('The queued recovery request changed during preparation.');
  dependencies.signal?.throwIfAborted();
  const completed=path.join(path.dirname(queued.file),'recovery-request-prepared-'+queued.request.id+'.json');try{await lstat(completed);throw Error('A completed recovery request already uses this identity.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await rename(queued.file,completed);progress('Recovery prepared. Reopening Agentopia…');return {success:true as const,relaunch:true as const,profile:queued.request.profile};
 }finally{clearInterval(monitor);}
}
