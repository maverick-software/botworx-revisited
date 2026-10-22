// Preserve the complete application-owned public export family, including edited
// files under older profile tags. User-selected external workspaces are separate.
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readdir,lstat,realpath,utimes,writeFile,readFile,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import tar from 'tar-stream';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureCompressedProfile,verifyCompressedProfile} from './compressed-private-profile.mjs';

const sha=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const inside=(root,file)=>{const relative=path.relative(root,file);return !!relative&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
const owner=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function entryName(name){
 assert(typeof name==='string'&&name&&name===path.posix.normalize(name)&&!path.posix.isAbsolute(name)&&!/[\\:\x00-\x1f\x7f]/.test(name),'Invalid public-output archive path');
 const parts=name.split('/');assert(parts.every(n=>n!=='.'&&n!=='..'&&!/[. ]$/.test(n)&&!/[<>"|?*]/.test(n)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(n)),'Unsafe public-output name');
 assert(/^[a-f0-9]{12}$/i.test(parts[0])&&(parts.length===1||owner.test(parts[1])),'Unexpected public-output ownership layout');return parts;
}
async function directory(file){const s=await lstat(file);assert(s.isDirectory()&&!s.isSymbolicLink()&&same(await realpath(file),path.resolve(file)),'Linked or redirected recovery directory');}
async function ancestors(file){for(let current=path.resolve(file);;current=path.dirname(current)){await directory(current);if(path.dirname(current)===current)break;}}
export function validatePublicOutputManifest(manifest){
 assert(manifest&&typeof manifest==='object'&&manifest.files&&Array.isArray(manifest.directories),'Missing public-output inventory');
 assert(Object.getPrototypeOf(manifest.files)===Object.prototype&&Object.keys(manifest.files).length<=100000&&manifest.directories.length<=100000,'Invalid public-output inventory');
 const seen=new Set(),dirs=new Set(manifest.directories);
 for(const [name,isFile]of [...manifest.directories.map(n=>[n,false]),...Object.keys(manifest.files).map(n=>[n,true])]){
  const parts=entryName(name),key=name.toLowerCase();assert(!seen.has(key),'Duplicate public-output path');seen.add(key);assert(!isFile||parts.length>=3,'Files must belong to an account directory');
  for(let i=1;i<parts.length;i++)assert(dirs.has(parts.slice(0,i).join('/')),'Missing parent in public-output inventory');
  if(isFile){const row=manifest.files[name];assert(row&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&/^[a-f0-9]{64}$/.test(row.sha256)&&Number.isFinite(row.mtimeMs)&&row.mtimeMs>=0,'Invalid public-output file record');}
 }
 return manifest;
}
export async function inventoryPublicOutputs(source,{allowIncompleteMarker=false}={}){
 source=path.resolve(source);assert.equal(path.basename(source),'Agentopia Files');await ancestors(source);
 const files={},directories=[];
 async function visit(relative){for(const name of(await readdir(path.join(source,relative))).sort()){
  if(!relative&&name==='.agentopia-restore-incomplete.json'&&allowIncompleteMarker)continue;
  const entry=path.posix.join(relative,name);entryName(entry);const file=path.join(source,entry),before=await lstat(file);assert(!before.isSymbolicLink()&&same(await realpath(file),file),'Linked public output');
  if(before.isDirectory()){directories.push(entry);await visit(entry);}else{
   assert(before.isFile()&&before.nlink===1,'Public outputs must be ordinary independent files');const digest=await sha(file),after=await lstat(file);
   assert(before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'Public output changed during hashing');
   files[entry]={bytes:before.size,sha256:digest,mtimeMs:before.mtimeMs};
  }
 }}
 await visit('');return validatePublicOutputManifest({files,directories:directories.sort()});
}
export async function capturePublicOutputs(source,destination,options={}){
 source=path.resolve(source);destination=path.resolve(destination);assert.equal(path.basename(source),'Agentopia Files');assert(!same(source,destination)&&!inside(source,destination),'Store recovery outside the source collection');await ancestors(path.dirname(destination));
 const result=await captureCompressedProfile(source,destination,{...options,inventory:inventoryPublicOutputs});
 return {...result,format:1,kind:'agentopia-public-outputs',sourceRoot:source,ownershipLayoutRetained:true,includesAllProfileTags:true,externalSelectedWorkspacesIncluded:false};
}
export async function verifyPublicOutputs(archive,receipt){
 assert(receipt?.success&&receipt.format===1&&receipt.kind==='agentopia-public-outputs'&&/^[a-f0-9]{64}$/.test(receipt.archiveSha256),'Invalid public-output recovery receipt');
 const manifest=validatePublicOutputManifest(receipt.manifest);assert.equal(await sha(archive),receipt.archiveSha256,'Public-output archive changed');
 return verifyCompressedProfile(archive,manifest);
}
export async function restorePublicOutputs(archive,receipt,destination,{headroomBytes=512*1024**2}={}){
 destination=path.resolve(destination);assert.equal(path.basename(destination),'Agentopia Files');await ancestors(path.dirname(destination));
 const sourceRoot=path.resolve(receipt.sourceRoot);
 assert(!same(destination,sourceRoot)&&!inside(sourceRoot,destination)&&!inside(destination,sourceRoot),'Use a separate fresh export collection for recovery');
 // Verify every member and its bytes before claiming or writing the destination.
 await verifyPublicOutputs(archive,receipt);
 const manifest=receipt.manifest,bytes=Object.values(manifest.files).reduce((sum,row)=>sum+row.bytes,0),space=await statfs(path.dirname(destination));
 assert(space.bavail*space.bsize>bytes+Object.keys(manifest.files).length*4096+headroomBytes,'Insufficient reserved space for public-output restoration');
 await mkdir(destination); // Atomic claim; an existing collection is never merged or overwritten.
 const incomplete=path.join(destination,'.agentopia-restore-incomplete.json');
 await writeFile(incomplete,JSON.stringify({archive:path.resolve(archive),startedAt:new Date().toISOString()}),{flag:'wx'});
 for(const name of manifest.directories)await mkdir(path.join(destination,name),{recursive:false});
 const extract=tar.extract(),reading=pipeline(createReadStream(archive),createGunzip(),extract),seen=new Set();reading.catch(()=>{});
 try{
  for await(const entry of extract){const name=entry.header.name.replace(/\/$/,''),parts=entryName(name),target=path.join(destination,...parts);assert(inside(destination,target)&&!seen.has(name.toLowerCase()),'Duplicate or escaping restore entry');seen.add(name.toLowerCase());
   if(entry.header.type==='directory'){assert(manifest.directories.includes(name));entry.resume();}
   else{const row=manifest.files[name];assert(entry.header.type==='file'&&row&&entry.header.size===row.bytes);await ancestors(path.dirname(target));await pipeline(entry,createWriteStream(target,{flags:'wx',mode:0o600}));assert.equal(await sha(target),row.sha256,'Restored output differs');await utimes(target,new Date(row.mtimeMs),new Date(row.mtimeMs));}
  }await reading;
 }catch(error){extract.destroy(error);await reading.catch(()=>{});throw error;}
 assert.equal(seen.size,manifest.directories.length+Object.keys(manifest.files).length);
 // The marker is the sole generated file, and is removed only after all entries
 // pass. No source file or existing destination entry is ever removed.
 const restored=await inventoryPublicOutputs(destination,{allowIncompleteMarker:true});
 const contents=value=>Object.fromEntries(Object.entries(value.files).map(([name,row])=>[name,{bytes:row.bytes,sha256:row.sha256}]));
 assert.deepEqual(restored.directories,manifest.directories);assert.deepEqual(contents(restored),contents(manifest));
 const {unlink}=await import('node:fs/promises');await unlink(incomplete);
 return {success:true,at:new Date().toISOString(),destination,archiveSha256:receipt.archiveSha256,files:Object.keys(restored.files).length,bytes,ownershipLayoutRetained:true,existingFilesOverwritten:0,sourceWrites:0,chatLinkRebasingTested:false};
}
