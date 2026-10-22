import {createReadStream,createWriteStream} from 'node:fs';
import {lstat,realpath,readdir,statfs,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGzip,createGunzip} from 'node:zlib';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import tar from 'tar-stream';
import type {PublicOutputInventory} from './public-file-recovery';
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function requireValue(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export const backupHash=async(file:string)=>{const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex');};
export function backupMember(name:string){requireValue(!!name&&name===path.posix.normalize(name)&&!path.posix.isAbsolute(name)&&!/[\\:\x00-\x1f\x7f]/.test(name)&&name.split('/').every(part=>part!=='.'&&part!=='..'&&!!part&&!/[. ]$/.test(part)&&!/[<>"|?*]/.test(part)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)),'A backup filename is invalid.');return name;}
export async function backupDirectory(file:string){for(let current=path.resolve(file);;current=path.dirname(current)){const info=await lstat(current);requireValue(info.isDirectory()&&!info.isSymbolicLink()&&same(await realpath(current),current),'A backup folder is linked or redirected.');if(path.dirname(current)===current)break;}}
export function portableProfileEntry(name:string){
 const parts=name.split('/');if(!['codex','workspaces','attachments','chrome-tools'].includes(parts[0]))return false;
 if(parts[0]==='chrome-tools')return parts.length===1||/^[a-f0-9-]{36}$/i.test(parts[1])&&(parts.length===2||parts[2]==='artifacts');
 if(parts[0]==='codex'&&parts.length>=5){const inner=parts.slice(4);if(['auth.json','config.toml','.sandbox','.sandbox_migration','cap_sid','tmp','.tmp'].includes(inner[0])||inner[0]==='skills'&&inner[1]==='.system')return false;}
 return true;
}
export async function backupInventory(root:string,select:(name:string)=>boolean=()=>true,allowMissing=false):Promise<PublicOutputInventory>{
 if(allowMissing)await backupDirectory(path.dirname(root));
 try{await backupDirectory(root);}catch(error){if(allowMissing&&(error as NodeJS.ErrnoException).code==='ENOENT')return {files:{},directories:[]};throw error;}
 const files:PublicOutputInventory['files']=Object.create(null),directories:string[]=[],seen=new Set<string>();
 async function walk(relative:string){for(const name of(await readdir(path.join(root,relative))).sort()){const member=relative?relative+'/'+name:name;if(!select(member))continue;backupMember(member);requireValue(!seen.has(member.toLowerCase()),'Backup paths differ only in letter case.');seen.add(member.toLowerCase());const file=path.join(root,member),before=await lstat(file);requireValue(!before.isSymbolicLink()&&same(await realpath(file),file),'A backup entry is linked or redirected.');if(before.isDirectory()){directories.push(member);await walk(member);}else{requireValue(before.isFile()&&before.nlink===1,'A backup entry is not an independent regular file.');const digest=await backupHash(file),after=await lstat(file);requireValue(before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'A file changed while the backup was reading it.');files[member]={bytes:before.size,sha256:digest,mtimeMs:before.mtimeMs};}}}
 await walk('');return {files,directories:directories.sort()};
}
type ArchiveControl={guard?:()=>Promise<void>;signal?:AbortSignal};
const archiveCheck=async(control:ArchiveControl)=>{control.signal?.throwIfAborted();await control.guard?.();control.signal?.throwIfAborted();};
export async function verifyBackupArchive(file:string,inventory:PublicOutputInventory,control:ArchiveControl={}){
 await archiveCheck(control);const extract=tar.extract(),reading=pipeline(createReadStream(file),createGunzip(),extract,{signal:control.signal}),seen=new Set<string>(),files:PublicOutputInventory['files']=Object.create(null),directories:string[]=[];reading.catch(()=>{});
 try{for await(const entry of extract){await archiveCheck(control);const name=backupMember(entry.header.name.replace(/\/$/,''));requireValue(!seen.has(name.toLowerCase()),'A backup archive contains duplicate paths.');seen.add(name.toLowerCase());if(entry.header.type==='directory'){requireValue(inventory.directories.includes(name),'A backup directory is unlisted.');directories.push(name);entry.resume();}else{requireValue(entry.header.type==='file'&&!!inventory.files[name],'A backup archive contains an unsupported entry.');const hash=createHash('sha256');let bytes=0,last=Date.now();for await(const chunk of entry){control.signal?.throwIfAborted();if(Date.now()-last>500){await archiveCheck(control);last=Date.now();}const data=chunk as Buffer;hash.update(data);bytes+=data.length;}const expected=inventory.files[name];requireValue(bytes===expected.bytes&&hash.digest('hex')===expected.sha256,'Archived file bytes differ from the backup inventory.');files[name]=expected;}}await reading;await archiveCheck(control);}catch(error){extract.destroy(error as Error);await reading.catch(()=>{});throw error;}
 requireValue(Object.keys(files).length===Object.keys(inventory.files).length&&JSON.stringify(directories.sort())===JSON.stringify([...inventory.directories].sort()),'A backup archive is incomplete.');
}
export async function captureBackupArchive(root:string,destination:string,options:{select?:(name:string)=>boolean;allowMissing?:boolean;reserveBytes?:number}={}){
 const select=options.select??(()=>true),before=await backupInventory(root,select,options.allowMissing);
 return {...await captureMappedBackupArchive(destination,before,name=>path.join(root,name),async()=>{requireValue(JSON.stringify(await backupInventory(root,select,options.allowMissing))===JSON.stringify(before),'Source files changed while the backup was being verified.');},options.reserveBytes),source:root};
}
export async function captureMappedBackupArchive(destination:string,before:PublicOutputInventory,source:(name:string)=>string,verifySources:()=>Promise<void>,reserve=1024**3,control:ArchiveControl={}){
 await archiveCheck(control);await backupDirectory(path.dirname(destination));
 try{await lstat(destination);throw Error('A completed backup archive already exists.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const space=await statfs(path.dirname(destination)),budget=space.bavail*space.bsize-reserve;requireValue(budget>128*1024,'There is not enough free space for a backup while keeping the disk reserve.');
 const pack=tar.pack(),pending=destination+'.incomplete';let compressed=0;const limit=new Transform({transform(bytes,_encoding,done){compressed+=bytes.length;if(compressed>budget)done(Error('The backup reached its reserved disk-space limit.'));else done(null,bytes);}}),writing=pipeline(pack,createGzip({level:6}),limit,createWriteStream(pending,{flags:'wx',mode:0o600}),{signal:control.signal});writing.catch(()=>{});
 try{for(const name of before.directories){await archiveCheck(control);backupMember(name);await new Promise<void>((resolve,reject)=>pack.entry({name:name+'/',type:'directory',size:0,mode:0o700},error=>error?reject(error):resolve()));}
  for(const [name,record]of Object.entries(before.files)){await archiveCheck(control);backupMember(name);const file=source(name);await backupDirectory(path.dirname(file));const info=await lstat(file);requireValue(info.isFile()&&!info.isSymbolicLink()&&same(await realpath(file),file)&&info.nlink===1&&info.size===record.bytes&&info.mtimeMs===record.mtimeMs,'A source file changed before backup.');const hash=createHash('sha256');let bytes=0,last=Date.now();const digest=new Transform({transform(chunk,_encoding,done){void(async()=>{control.signal?.throwIfAborted();if(Date.now()-last>500){await archiveCheck(control);last=Date.now();}hash.update(chunk);bytes+=chunk.length;done(null,chunk);})().catch(done);}});await pipeline(createReadStream(file),digest,pack.entry({name,type:'file',size:record.bytes,mode:0o600,mtime:new Date(record.mtimeMs!)}),{signal:control.signal});requireValue(bytes===record.bytes&&hash.digest('hex')===record.sha256,'A source file changed during backup.');}
  pack.finalize();await writing;
 }catch(error){pack.destroy(error as Error);await writing.catch(()=>{});throw error;}
 await verifyBackupArchive(pending,before,control);await verifySources();await archiveCheck(control);const remaining=await statfs(path.dirname(destination));requireValue(remaining.bavail*remaining.bsize>=reserve,'The backup reached its reserved disk-space limit.');await rename(pending,destination);
 return {success:true,storage:'verified-compressed-tar',destination,archiveSha256:await backupHash(destination),archiveBytes:compressed,fileCount:Object.keys(before.files).length,manifest:before};
}
