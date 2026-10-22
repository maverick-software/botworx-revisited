import {mkdir,readdir,lstat,realpath,copyFile,utimes,statfs} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {hash} from './phased-backup-control.mjs';
export function currentProfileEntry(name){const parts=name.replaceAll('\\','/').split('/');if(['backups','test-profiles'].includes(parts[0])||parts.join('/')==='wsl/ext4.vhdx')return false;if(parts[0]==='codex'){const inner=parts.slice(4);if(['tmp','.tmp'].includes(inner[0])||(inner[0]==='skills'&&inner[1]==='.system'))return false;}return true;}
export async function inventoryPrivateProfile(source){
 assert.equal((await realpath(source)).toLowerCase(),path.resolve(source).toLowerCase());assert(!(await lstat(source)).isSymbolicLink());const files={},directories=[];
 async function walk(relative){for(const entry of await readdir(path.join(source,relative),{withFileTypes:true})){const name=path.join(relative,entry.name).replaceAll('\\','/');if(!currentProfileEntry(name))continue;const file=path.join(source,name),info=await lstat(file);assert(!info.isSymbolicLink(),'A linked profile entry needs inspection');if(info.isDirectory()){directories.push(name);await walk(name);}else{assert(info.isFile(),'A profile entry is not an ordinary file');files[name]={bytes:info.size,sha256:await hash(file),mtimeMs:info.mtimeMs};}}}
 await walk('');return {files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b))),directories:directories.sort()};
}
export async function capturePrivateProfile(source,destination,{headroomBytes=1536*1024**2}={}){
 assert(!path.resolve(destination).toLowerCase().startsWith(path.resolve(source).toLowerCase()+path.sep));
 const before=await inventoryPrivateProfile(source),bytes=Object.values(before.files).reduce((n,f)=>n+f.bytes,0),space=await statfs(path.dirname(destination));assert(space.bavail*space.bsize>bytes+Object.keys(before.files).length*4096+headroomBytes,'The current profile copy exceeds its reserved disk-space budget');await mkdir(destination);
 for(const directory of before.directories)await mkdir(path.join(destination,directory),{recursive:true});
 for(const [name,record]of Object.entries(before.files)){const from=path.join(source,name),to=path.join(destination,name);assert.equal(await hash(from),record.sha256,'The closed profile changed before copying');await copyFile(from,to,constants.COPYFILE_EXCL);assert.equal(await hash(to),record.sha256,'A copied profile file differs');const info=await lstat(from);assert.equal(info.size,record.bytes);assert.equal(info.mtimeMs,record.mtimeMs);await utimes(to,info.atime,info.mtime);}
 assert.deepEqual(await inventoryPrivateProfile(source),before,'The closed profile changed during capture');
 const copied=await inventoryPrivateProfile(destination);assert.deepEqual(copied.directories,before.directories);assert.deepEqual(Object.fromEntries(Object.entries(copied.files).map(([k,v])=>[k,{bytes:v.bytes,sha256:v.sha256}])),Object.fromEntries(Object.entries(before.files).map(([k,v])=>[k,{bytes:v.bytes,sha256:v.sha256}])));
 return {success:true,storage:'verified-directory-copy',source:path.resolve(source),destination:path.resolve(destination),fileCount:Object.keys(before.files).length,bytes,manifest:before,sourceComparedAgain:true,historicalBackupsRetainedInPlace:true};
}
