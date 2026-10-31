import {currentBrandKind} from './legacy-brand';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {lstat,realpath,readdir,open,mkdir,chmod} from 'node:fs/promises';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip,createGunzip} from 'node:zlib';
import {pack,extract,type Header} from 'tar-stream';
import {storageDirectory,storageWithin} from './storage-files';

export type RecoveryEntry={path:string;kind:'file'|'folder';size:number;mode:number;sha256?:string};
export type RecoveryInventory={entries:RecoveryEntry[];files:number;folders:number;bytes:number;fingerprint:string;contentSha256:string};
export type RecoveryExtra={name:'history.bundle'|'index.bin'|'git-state.tar.gz';path:string;size:number;sha256:string};
export type WorkspaceRecoveryManifest={format:1;kind:'sylvana-workspace-recovery';entries:RecoveryEntry[];extras:Omit<RecoveryExtra,'path'>[];contentSha256:string;metadata:Record<string,unknown>};
export type RecoveryArtifact={path:string;sha256:string;manifestSha256:string;bytes:number;files:number;expandedBytes:number};
export const workspaceRecoveryLimits={entries:250000,bytes:512*1024**3,manifest:64*1024**2,depth:64,milliseconds:300000};
type Guard=()=>Promise<void>;
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const same=(a:string,b:string)=>process.platform==='win32'?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase():path.normalize(a)===path.normalize(b);
const identity=(stat:Awaited<ReturnType<typeof regular>>)=>[stat.dev.toString(),stat.ino.toString(),stat.birthtimeNs.toString()];
const invalid=()=>Error('The workspace recovery file is invalid, incomplete or changed.');
function relative(value:string,root=false){if(root&&value==='')return '';if(!value||value.length>4000||value.startsWith('/')||/[\\:\x00-\x1f]/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..'||/[. ]$/.test(part)||/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)))throw invalid();return value;}
async function regular(file:string,folder?:boolean){if(!path.isAbsolute(file))throw invalid();const stat=await lstat(file,{bigint:true});if(stat.isSymbolicLink()||!same(await realpath(file),file)||!(folder?stat.isDirectory():stat.isFile()&&stat.nlink===1n))throw Error('Linked or special workspace items cannot be archived.');return stat;}
const contentId=(entries:RecoveryEntry[])=>digest(JSON.stringify(entries));
function budget(signal:AbortSignal){const until=Date.now()+workspaceRecoveryLimits.milliseconds;return()=>{signal.throwIfAborted();if(Date.now()>until)throw Error('This workspace takes too long to archive. Keep it until its recovery can be verified.');};}
async function* bytes(file:string,expectedSize:number,guard:Guard,check:()=>void){
 await guard();check();const before=await regular(file),handle=await open(file,'r');
 try{const start=await handle.stat({bigint:true});if(JSON.stringify(identity(start))!==JSON.stringify(identity(before))||Number(start.size)!==expectedSize)throw Error('A workspace file changed while opening its recovery snapshot.');let position=0,last=Date.now();
  while(position<expectedSize){check();if(Date.now()-last>500){await guard();last=Date.now();}const buffer=Buffer.alloc(Math.min(128*1024,expectedSize-position)),read=await handle.read(buffer,0,buffer.length,position);if(!read.bytesRead)throw Error('A workspace file changed during its recovery snapshot.');position+=read.bytesRead;yield buffer.subarray(0,read.bytesRead);}
  const end=await handle.stat({bigint:true}),after=await regular(file);if(end.size!==start.size||end.mtimeNs!==start.mtimeNs||JSON.stringify(identity(after))!==JSON.stringify(identity(before))||after.size!==before.size||after.mtimeNs!==before.mtimeNs)throw Error('A workspace file changed during its recovery snapshot.');await guard();check();
 }finally{await handle.close();}
}
export async function recoveryFile(file:string,guard:Guard,signal:AbortSignal){const before=await regular(file),size=Number(before.size);if(size>workspaceRecoveryLimits.bytes)throw Error('The recovery file exceeds its size limit.');const hash=createHash('sha256'),check=budget(signal);for await(const chunk of bytes(file,size,guard,check))hash.update(chunk);return {size,sha256:hash.digest('hex')};}

/** This scanner intentionally includes ignored files such as .env, build output
 * and user drafts. Recovery is private local data, never model attachment data. */
export async function workspaceRecoveryInventory(root:string,guard:Guard,signal:AbortSignal,options:{includeGit?:boolean}={}):Promise<RecoveryInventory>{
 await guard();await storageDirectory(root);const check=budget(signal),entries:RecoveryEntry[]=[],fingerprints:unknown[]=[];let total=0,files=0,folders=0;
 async function walk(name:string,depth:number){check();if(depth>workspaceRecoveryLimits.depth||entries.length>=workspaceRecoveryLimits.entries)throw Error('This workspace exceeds the automatic recovery item limit.');relative(name,true);const file=path.join(root,...name.split('/')),info=await lstat(file,{bigint:true});
  if(info.isSymbolicLink()||!same(await realpath(file),file)||!info.isDirectory()&&(!info.isFile()||info.nlink!==1n))throw Error('Linked or special workspace items cannot be archived.');
  if(name==='.git'&&!options.includeGit){if(!info.isFile())throw Error('The workspace Git control file changed.');return;}
  if(name.endsWith('/.git')&&info.isFile()&&!options.includeGit)throw Error('A nested worktree or submodule uses external Git metadata. Preserve it separately before archiving this workspace.');
  if(info.isDirectory()){folders++;entries.push({path:name,kind:'folder',size:0,mode:Number(info.mode)&0o777});fingerprints.push([name,'folder',identity(info),Number(info.mode)&0o777]);for(const child of(await readdir(file)).sort())await walk(name?name+'/'+child:child,depth+1);}
  else{files++;const size=Number(info.size);total+=size;if(total>workspaceRecoveryLimits.bytes)throw Error('The workspace exceeds the automatic recovery size limit.');const hash=createHash('sha256');for await(const chunk of bytes(file,size,guard,check))hash.update(chunk);const sha256=hash.digest('hex');entries.push({path:name,kind:'file',size,mode:Number(info.mode)&0o777,sha256});fingerprints.push([name,'file',identity(info),size,info.mtimeNs.toString(),Number(info.mode)&0o777,sha256]);}
 }
 await walk('',0);await guard();return {entries,files,folders,bytes:total,fingerprint:digest(JSON.stringify(fingerprints)),contentSha256:contentId(entries)};
}

function manifest(value:unknown):WorkspaceRecoveryManifest{
 if(!value||typeof value!=='object')throw invalid();const item=value as WorkspaceRecoveryManifest;
 if(item.format!==1||currentBrandKind(item.kind)!=='sylvana-workspace-recovery'||!Array.isArray(item.entries)||!item.entries.length||item.entries.length>workspaceRecoveryLimits.entries||!Array.isArray(item.extras)||item.extras.length>3||!item.metadata||typeof item.metadata!=='object'||Array.isArray(item.metadata))throw invalid();
 const seen=new Set<string>();let total=0;for(const entry of item.entries){relative(entry.path,true);const key=process.platform==='win32'?entry.path.toLowerCase():entry.path;if(seen.has(key)||!['file','folder'].includes(entry.kind)||!Number.isSafeInteger(entry.size)||entry.size<0||!Number.isInteger(entry.mode)||entry.mode<0||entry.mode>0o777||entry.kind==='folder'&&(entry.size!==0||entry.sha256!==undefined)||entry.kind==='file'&&!/^[a-f0-9]{64}$/.test(entry.sha256??'')||entry.path==='.git')throw invalid();seen.add(key);total+=entry.size;}
 if(item.entries[0].path!==''||item.entries[0].kind!=='folder'||total>workspaceRecoveryLimits.bytes||contentId(item.entries)!==item.contentSha256)throw invalid();
 const extra=new Set();for(const entry of item.extras){if(!['history.bundle','index.bin','git-state.tar.gz'].includes(entry.name)||extra.has(entry.name)||!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>workspaceRecoveryLimits.bytes||!/^[a-f0-9]{64}$/.test(entry.sha256))throw invalid();extra.add(entry.name);total+=entry.size;}if(total>workspaceRecoveryLimits.bytes)throw invalid();return item;
}

export async function writeWorkspaceRecovery(root:string,inventory:RecoveryInventory,extras:RecoveryExtra[],metadata:Record<string,unknown>,destination:string,guard:Guard,signal:AbortSignal):Promise<RecoveryArtifact>{
 await guard();await storageDirectory(root);if(storageWithin(root,destination))throw Error('Recovery must be saved outside the workspace being archived.');await storageDirectory(path.dirname(destination));const check=budget(signal),record=manifest({format:1,kind:'sylvana-workspace-recovery',entries:inventory.entries,extras:extras.map(({path:unused,...entry})=>entry),contentSha256:inventory.contentSha256,metadata}),encoded=Buffer.from(JSON.stringify(record));if(encoded.length>workspaceRecoveryLimits.manifest)throw Error('The workspace recovery manifest is too large.');
 const tar=pack(),output=createWriteStream(destination,{flags:'wx',mode:0o600}),done=pipeline(tar,createGzip({level:6}),output,{signal});done.catch(()=>{});
 async function entry(header:Partial<Header>&Pick<Header,'name'>,file?:string,expected?:string,data?:Buffer){
  await guard();check();let accept!:(error?:Error|null)=>void;const completed=new Promise<void>((resolve,reject)=>{accept=error=>error?reject(error):resolve();});completed.catch(()=>{});const target=tar.entry({...header,mtime:new Date(0),uid:0,gid:0},accept);
  if(data){target.end(data);await completed;return;}
  if(!file){target.end(Buffer.alloc(0));await completed;return;}
  const hash=createHash('sha256'),source=Readable.from(bytes(file,header.size!,guard,check)),hashing=new Transform({transform(chunk,encoding,next){hash.update(chunk);next(null,chunk);}});await Promise.all([pipeline(source,hashing,target,{signal}),completed]);if(hash.digest('hex')!==expected)throw Error('A workspace file changed after the recovery inventory.');
 }
 try{
  await entry({name:'manifest.json',type:'file',size:encoded.length,mode:0o600},undefined,undefined,encoded);
  for(const saved of record.entries){await entry({name:saved.path?'files/'+saved.path:'files/',type:saved.kind==='folder'?'directory':'file',size:saved.size,mode:saved.mode},saved.kind==='file'?path.join(root,...saved.path.split('/')):undefined,saved.sha256);}
  for(const saved of extras)await entry({name:saved.name,type:'file',size:saved.size,mode:0o600},saved.path,saved.sha256);
  tar.finalize();await done;await guard();const hash=await recoveryFile(destination,guard,signal);return {path:destination,sha256:hash.sha256,manifestSha256:digest(encoded),bytes:hash.size,files:inventory.files,expandedBytes:inventory.bytes+extras.reduce((sum,file)=>sum+file.size,0)};
 }catch(error){tar.destroy(error as Error);output.destroy();await done.catch(()=>{});throw error;}
}

/** Parse and verify every byte before a caller removes the original checkout.
 * Extraction only accepts the manifest's exact regular files/directories. */
export async function verifyWorkspaceRecovery(artifact:RecoveryArtifact,guard:Guard,signal:AbortSignal,destination?:string,validateManifest?:(record:WorkspaceRecoveryManifest)=>void|Promise<void>){
 await guard();const compressed=await recoveryFile(artifact.path,guard,signal);if(compressed.sha256!==artifact.sha256||compressed.size!==artifact.bytes)throw invalid();const check=budget(signal),tar=extract(),seen=new Set<string>();let record:WorkspaceRecoveryManifest|undefined,expanded=0;const entries=new Map<string,RecoveryEntry|WorkspaceRecoveryManifest['extras'][number]>();
 if(destination){await storageDirectory(path.dirname(destination));await mkdir(destination);await storageDirectory(destination);}
 const done=pipeline(createReadStream(artifact.path),createGunzip(),tar,{signal});done.catch(()=>{});
 tar.on('entry',(header,stream,next)=>{stream.on('error',error=>tar.destroy(error));void(async()=>{
  check();await guard();const name=relative(header.name.replace(/\/$/,'')),key=process.platform==='win32'?name.toLowerCase():name;
  if(seen.has(key)||!['file','directory'].includes(header.type??'')||!Number.isSafeInteger(header.size)||header.size<0||seen.size>workspaceRecoveryLimits.entries+4)throw invalid();seen.add(key);
  if(name==='manifest.json'){
   if(record||seen.size!==1||header.type!=='file'||header.size>workspaceRecoveryLimits.manifest)throw invalid();const chunks:Buffer[]=[];let length=0;for await(const value of stream){const data=Buffer.from(value as Uint8Array);check();length+=data.length;if(length>workspaceRecoveryLimits.manifest)throw invalid();chunks.push(data);}const encoded=Buffer.concat(chunks);if(length!==header.size||digest(encoded)!==artifact.manifestSha256)throw invalid();record=manifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(encoded)));
   // Ownership and journal bindings are checked after authenticating the
   // manifest, before advancing to any file body or extraction write.
   await validateManifest?.(record);check();await guard();for(const entry of record.entries)entries.set(entry.path?'files/'+entry.path:'files',entry);for(const entry of record.extras)entries.set(entry.name,entry);next();return;
  }
  if(!record)throw invalid();const entry=entries.get(name);
  if(!entry||header.size!==entry.size||header.type!==(('kind' in entry&&entry.kind==='folder')?'directory':'file'))throw invalid();expanded+=entry.size;if(expanded>workspaceRecoveryLimits.bytes)throw invalid();
  let target:string|undefined;if(destination){const parts=name.split('/');target=path.join(destination,...parts);if(header.type==='directory'){await storageDirectory(path.dirname(target));await mkdir(target);await storageDirectory(target);}else await storageDirectory(path.dirname(target));}
  if(header.type==='directory'){for await(const chunk of stream)if(Buffer.from(chunk as Uint8Array).length)throw invalid();next();return;}
  const hash=createHash('sha256');let count=0,last=Date.now();const handle=target?await open(target,'wx',0o600):undefined;
  try{for await(const value of stream){const chunk=Buffer.from(value as Uint8Array);check();count+=chunk.length;if(count>entry.size)throw invalid();if(Date.now()-last>500){await guard();last=Date.now();}hash.update(chunk);if(handle)await handle.writeFile(chunk);}if(count!==entry.size||hash.digest('hex')!==entry.sha256)throw invalid();if(target&&'mode' in entry&&process.platform!=='win32')await chmod(target,entry.mode);await guard();}
  finally{await handle?.close();}
  next();
 })().catch(error=>{stream.destroy(error as Error);tar.destroy(error as Error);});});
 try{await done;if(!record||seen.size!==1+record.entries.length+record.extras.length||expanded!==artifact.expandedBytes)throw invalid();await guard();if(destination&&process.platform!=='win32')for(const entry of [...record.entries].reverse())if(entry.kind==='folder'){check();await guard();await chmod(path.join(destination,'files',...entry.path.split('/').filter(Boolean)),entry.mode);}return record;}
 catch(error){tar.destroy(error as Error);await done.catch(()=>{});throw error;}
}
