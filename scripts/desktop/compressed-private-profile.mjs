import {createReadStream,createWriteStream} from 'node:fs';
import {lstat,realpath,rename,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip,createGunzip} from 'node:zlib';
import tar from 'tar-stream';
import path from 'node:path';
import assert from 'node:assert/strict';
import {inventoryPrivateProfile} from './capture-private-profile.mjs';
import {hash} from './phased-backup-control.mjs';

function safeName(name){assert(name&&name===path.posix.normalize(name)&&!path.posix.isAbsolute(name)&&!name.includes('\\')&&!name.split('/').includes('..')&&!/[:\x00]/.test(name),'Unsafe profile archive path');return name;}
export async function verifyCompressedProfile(file,manifest){
 const extract=tar.extract(),seen=new Set(),files={},directories=[];
 const reading=pipeline(createReadStream(file),createGunzip(),extract);reading.catch(()=>{});
 try{for await(const entry of extract){const header=entry.header,name=safeName(header.name.replace(/\/$/,'')),key=name.toLowerCase();assert(!seen.has(key),'Duplicate profile archive entry');seen.add(key);
   if(header.type==='directory'){assert(manifest.directories.includes(name),'Unexpected archive directory');directories.push(name);entry.resume();}
   else{assert(header.type==='file'&&manifest.files[name],'Unexpected profile archive file');const h=createHash('sha256');let bytes=0;for await(const data of entry){bytes+=data.length;h.update(data);}files[name]={bytes,sha256:h.digest('hex')};assert.equal(bytes,header.size);}
  }await reading;
 }catch(error){extract.destroy(error);await reading.catch(()=>{});throw error;}
 assert.deepEqual(directories.sort(),[...manifest.directories].sort());assert.deepEqual(files,Object.fromEntries(Object.entries(manifest.files).map(([k,v])=>[k,{bytes:v.bytes,sha256:v.sha256}])));
 return {success:true,files:Object.keys(files).length,directories:directories.length};
}

export async function captureCompressedProfile(source,destination,{headroomBytes=1536*1024**2,maxCompressedBytes,inventory=inventoryPrivateProfile}={}){
 source=path.resolve(source);destination=path.resolve(destination);assert(destination.endsWith('.tar.gz'));assert(!destination.toLowerCase().startsWith(source.toLowerCase()+path.sep));assert.equal((await realpath(path.dirname(destination))).toLowerCase(),path.dirname(destination).toLowerCase());
 const before=await inventory(source),space=await statfs(path.dirname(destination)),available=space.bavail*space.bsize-headroomBytes;
 const budget=Math.min(maxCompressedBytes??available,available);assert(Number.isSafeInteger(budget)&&budget>0,'No compressed-profile space budget');
 const pending=destination+'.incomplete',pack=tar.pack();let compressedBytes=0;
 const limit=new Transform({transform(chunk,encoding,done){compressedBytes+=chunk.length;if(compressedBytes>budget)done(Error('Compressed profile exceeded its reserved space budget'));else done(null,chunk);}});
 const writing=pipeline(pack,createGzip({level:6}),limit,createWriteStream(pending,{flags:'wx',mode:0o600}));writing.catch(()=>{});
 try{
  for(const name of before.directories){safeName(name);await new Promise((resolve,reject)=>pack.entry({name:name+'/',type:'directory',size:0,mode:0o700},error=>error?reject(error):resolve()));}
  for(const [name,record]of Object.entries(before.files)){safeName(name);const from=path.join(source,name),info=await lstat(from);assert(info.isFile()&&!info.isSymbolicLink());assert.equal(info.size,record.bytes);assert.equal(info.mtimeMs,record.mtimeMs);
   const h=createHash('sha256');let bytes=0;const digest=new Transform({transform(data,encoding,done){bytes+=data.length;h.update(data);done(null,data);}});
   await pipeline(createReadStream(from),digest,pack.entry({name,type:'file',size:record.bytes,mode:0o600,mtime:new Date(record.mtimeMs)}));assert.equal(bytes,record.bytes);assert.equal(h.digest('hex'),record.sha256,'Source changed while compressing');
  }pack.finalize();await writing;
 }catch(error){pack.destroy(error);await writing.catch(()=>{});throw error;}
 const verified=await verifyCompressedProfile(pending,before);assert.deepEqual(await inventory(source),before,'Source changed during compression');
 assert((await statfs(path.dirname(destination))).bavail*(await statfs(path.dirname(destination))).bsize>=headroomBytes);
 // Publication never overwrites an earlier completed archive.
 try{await lstat(destination);throw Error('Completed profile archive already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 await rename(pending,destination);
 return {success:true,storage:'verified-compressed-tar',source,destination,archiveSha256:await hash(destination),archiveBytes:compressedBytes,fileCount:verified.files,bytes:Object.values(before.files).reduce((n,f)=>n+f.bytes,0),manifest:before,sourceComparedAgain:true,historicalBackupsRetainedInPlace:true};
}
