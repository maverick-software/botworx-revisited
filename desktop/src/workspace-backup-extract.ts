import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,mkdir,readFile,writeFile,rename,open,readdir,statfs} from 'node:fs/promises';
import {createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {extract} from 'tar-stream';
import {backupDirectory,backupMember} from './backup-archives';
import {recoveryFile} from './workspace-recovery-files';
import {storageUuid,storageWithin} from './storage-files';
import {validateWorkspacePayload,type WorkspacePayload} from './workspace-backup-payload';

export type WorkspacePayloadBinding={descriptorSha256:string;databaseManifestSha256:string;owners:string[]};
type Guard=()=>Promise<void>;
type Marker={format:1;kind:'agentopia-workspace-extraction';id:string;indexSha256:string;descriptorSha256:string;owners:string[];rootIdentity:string;status:'copying'|'complete'|'interrupted';files:number;bytes:number};
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function need(value:unknown,message='The sealed workspace recovery is invalid, incomplete or changed.'):asserts value{if(!value)throw Error(message);}
const exists=async(file:string)=>{try{await lstat(file);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}};
const sameOwners=(left:string[],right:string[])=>JSON.stringify(left.map(value=>value.toLowerCase()).sort())===JSON.stringify(right.map(value=>value.toLowerCase()).sort());
const checked=(guard:Guard,signal:AbortSignal)=>async()=>{signal.throwIfAborted();await guard();signal.throwIfAborted();};
async function rootIdentity(root:string){await backupDirectory(root);const value=await lstat(root,{bigint:true});return sha(JSON.stringify([value.dev.toString(),value.ino.toString(),value.birthtimeNs.toString()]));}
async function sealed(file:string,expected:string,guard:Guard,signal:AbortSignal){
 await guard();const stat=await lstat(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=64*1024**2,'The workspace recovery descriptor is linked or exceeds its size limit.');const bytes=await readFile(file);need(sha(bytes)===expected);need((await recoveryFile(file,guard,signal)).sha256===expected);return bytes;
}
function bind(record:WorkspacePayload,binding:WorkspacePayloadBinding){
 need(binding&&/^[a-f0-9]{64}$/.test(binding.descriptorSha256)&&/^[a-f0-9]{64}$/.test(binding.databaseManifestSha256)&&Array.isArray(binding.owners)&&binding.owners.every(storageUuid)&&new Set(binding.owners.map(owner=>owner.toLowerCase())).size===binding.owners.length,'Use the verified database and descriptor ownership for workspace recovery.');
 need(record.records.databaseManifestSha256===binding.databaseManifestSha256&&sameOwners(record.records.accounts.map(account=>account.owner),binding.owners),'This workspace backup does not match the restored database accounts.');
}
export async function loadWorkspacePayload(source:string,binding:WorkspacePayloadBinding,guard:Guard,signal:AbortSignal){
 const check=checked(guard,signal);await check();await backupDirectory(source);for(const marker of ['WORKSPACE-BACKUP-INCOMPLETE.txt','BACKUP-INCOMPLETE.txt'])need(!await exists(path.join(source,marker)),'This workspace backup was marked incomplete. Preserve it and use a verified completed backup.');
 need(binding&&typeof binding.descriptorSha256==='string'&&/^[a-f0-9]{64}$/.test(binding.descriptorSha256));const bytes=await sealed(path.join(source,'workspace-data.json'),binding.descriptorSha256,check,signal),record=validateWorkspacePayload(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));bind(record,binding);await check();return {record,bytes};
}
/** Extracts only sealed regular files/directories into a new private container.
 * Original source paths, Git metadata and interrupted requests are never used
 * as execution instructions. Account import is a separate guarded operation. */
export async function extractWorkspacePayload(source:string,parent:string,binding:WorkspacePayloadBinding,guard:Guard,signal:AbortSignal,reserveBytes=1024**3){
 const check=checked(guard,signal),loaded=await loadWorkspacePayload(source,binding,check,signal),{record,bytes}=loaded;need(Number.isSafeInteger(reserveBytes)&&reserveBytes>=0);await backupDirectory(parent);
 const destination=path.join(parent,record.indexSha256);need(!storageWithin(source,destination)&&!storageWithin(destination,source),'Extract workspace recovery outside the backup source.');
 need(!await exists(destination),'This workspace extraction already exists. Inspect it before starting another; existing files are preserved.');
 const archive=path.join(source,'workspace-data.tar.gz'),before=await recoveryFile(archive,check,signal);need(before.sha256===record.archiveSha256);await check();await mkdir(destination);const identity=await rootIdentity(destination);
 let marker:Marker={format:1,kind:'agentopia-workspace-extraction',id:randomUUID(),indexSha256:record.indexSha256,descriptorSha256:binding.descriptorSha256,owners:record.records.accounts.map(account=>account.owner),rootIdentity:identity,status:'copying',files:0,bytes:0};
 const save=async()=>{const file=path.join(destination,'.workspace-extraction.json'),temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(marker,null,2),{flag:'wx',mode:0o600});await rename(temporary,file);};
 const owned=async()=>{await check();need(await rootIdentity(destination)===identity,'The workspace extraction directory was replaced.');const free=await statfs(destination);need(free.bavail*free.bsize>=reserveBytes,'Workspace extraction reached its disk-space reserve.');};
 let tar:ReturnType<typeof extract>|undefined,reading:Promise<void>|undefined;
 try{
  await save();await writeFile(path.join(destination,'.workspace-payload.json'),bytes,{flag:'wx',mode:0o600});await owned();const seen=new Set<string>(),directories=new Set(record.manifest.directories);let expanded=0,last=Date.now();
  tar=extract();reading=pipeline(createReadStream(archive),createGunzip(),tar,{signal});reading.catch(()=>{});
  for await(const entry of tar){
   await owned();const name=backupMember(entry.header.name.replace(/\/$/,''));need(name.length<=8192&&name.split('/').length<=80&&!seen.has(name.toLowerCase())&&seen.size<250000&&Number.isSafeInteger(entry.header.size)&&entry.header.size>=0);seen.add(name.toLowerCase());const target=path.join(destination,...name.split('/'));need(storageWithin(destination,target)&&target!==destination);await backupDirectory(path.dirname(target));
   if(entry.header.type==='directory'){need(directories.has(name)&&entry.header.size===0);await mkdir(target,{mode:0o700});await backupDirectory(target);entry.resume();continue;}
   const expected=record.manifest.files[name];need(entry.header.type==='file'&&expected&&entry.header.size===expected.bytes);const free=await statfs(destination);need(free.bavail*free.bsize>=reserveBytes+expected.bytes,'There is not enough space to extract the workspace file while keeping the reserve.');
   const output=await open(target,'wx',0o600),hash=createHash('sha256');let count=0;
   try{for await(const value of entry){signal.throwIfAborted();if(Date.now()-last>500){await owned();last=Date.now();}const chunk=Buffer.from(value as Uint8Array);count+=chunk.length;expanded+=chunk.length;need(count<=expected.bytes&&expanded<=512*1024**3);hash.update(chunk);await output.writeFile(chunk);}need(count===expected.bytes&&hash.digest('hex')===expected.sha256);marker.files++;marker.bytes+=count;}
   finally{await output.close();}
   if(Date.now()-last>500){await save();last=Date.now();}
  }
  await reading;need(seen.size===record.manifest.directories.length+Object.keys(record.manifest.files).length);await owned();need((await recoveryFile(archive,owned,signal)).sha256===before.sha256);await sealed(path.join(source,'workspace-data.json'),binding.descriptorSha256,owned,signal);await owned();marker={...marker,status:'complete'};await save();return {destination,record};
 }catch(error){tar?.destroy(error as Error);await reading?.catch(()=>{});if(await rootIdentity(destination).catch(()=>undefined)===identity){marker={...marker,status:'interrupted'};await save().catch(()=>{});}throw error;}
}
/** A completed extraction is reverified without extracting or overwriting it.
 * This permits cold startup to establish file integrity before owner import. */
export async function verifyExtractedWorkspacePayload(destination:string,binding:WorkspacePayloadBinding,guard:Guard,signal:AbortSignal,owner?:string){
 const check=checked(guard,signal);await check();await backupDirectory(destination);const bytes=await sealed(path.join(destination,'.workspace-payload.json'),binding.descriptorSha256,check,signal),record=validateWorkspacePayload(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));bind(record,binding);need(path.basename(destination)===record.indexSha256);
 const markerFile=path.join(destination,'.workspace-extraction.json'),info=await lstat(markerFile);need(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<=64*1024);const marker=JSON.parse(await readFile(markerFile,'utf8')) as Marker;
 need(marker.format===1&&marker.kind==='agentopia-workspace-extraction'&&storageUuid(marker.id)&&marker.status==='complete'&&marker.indexSha256===record.indexSha256&&marker.descriptorSha256===binding.descriptorSha256&&Array.isArray(marker.owners)&&sameOwners(marker.owners,binding.owners)&&marker.rootIdentity===await rootIdentity(destination),'Workspace extraction is incomplete or its ownership changed. Keep the remaining files for inspection.');
 if(owner!==undefined)need(storageUuid(owner)&&binding.owners.includes(owner),'This account is outside the workspace recovery.');
 const all=new Set([...record.manifest.directories,...Object.keys(record.manifest.files),'.workspace-payload.json','.workspace-extraction.json']),expected=new Set<string>(['.workspace-payload.json','.workspace-extraction.json']);if(owner===undefined)for(const name of all)expected.add(name);else for(const name of all)if(name.split('/')[1]===owner){const parts=name.split('/');for(let i=1;i<=parts.length;i++)expected.add(parts.slice(0,i).join('/'));}let count=0;
 async function walk(relative:string,depth:number){need(depth<=80);await check();for(const name of await readdir(path.join(destination,relative))){const member=relative?relative+'/'+name:name;need(all.has(member),'Unexpected or unowned files appeared in workspace extraction.');if(!expected.has(member))continue;need(++count<=250002);const file=path.join(destination,...member.split('/')),stat=await lstat(file);need(!stat.isSymbolicLink()&&(stat.isDirectory()||stat.isFile()&&stat.nlink===1));if(stat.isDirectory()){need(record.manifest.directories.includes(member));await backupDirectory(file);await walk(member,depth+1);}else if(member!=='.workspace-payload.json'&&member!=='.workspace-extraction.json'){const saved=record.manifest.files[member];need(saved);const actual=await recoveryFile(file,check,signal);need(actual.size===saved.bytes&&actual.sha256===saved.sha256,'Recovered workspace bytes changed after extraction.');}}}
 await walk('',0);need(count===expected.size);need(marker.rootIdentity===await rootIdentity(destination));await check();return record;
}
