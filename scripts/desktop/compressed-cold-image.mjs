import {createReadStream,createWriteStream} from 'node:fs';
import {lstat,realpath,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGzip,createGunzip} from 'node:zlib';
import {Transform,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const identity=s=>({dev:s.dev,ino:s.ino,size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs});
async function ordinary(file){const info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1,'A cold image must be an ordinary unshared file');assert.equal((await realpath(file)).toLowerCase(),path.resolve(file).toLowerCase());return info;}
async function digestFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}

export async function verifyCompressedColdImage(file,{rawBytes,rawSha256,maxRawBytes=rawBytes}){
 assert(Number.isSafeInteger(rawBytes)&&rawBytes>=8&&Number.isSafeInteger(maxRawBytes)&&maxRawBytes>=rawBytes&&/^[a-f0-9]{64}$/.test(rawSha256));
 const before=await ordinary(file),hash=createHash('sha256');let bytes=0;
 await pipeline(createReadStream(file),createGunzip(),new Writable({write(chunk,encoding,done){bytes+=chunk.length;if(bytes>maxRawBytes)return done(Error('Expanded cold image exceeds its declared limit'));hash.update(chunk);done();}}));
 assert.equal(bytes,rawBytes,'Expanded cold image size differs');assert.equal(hash.digest('hex'),rawSha256,'Expanded cold image hash differs');assert.deepEqual(identity(await ordinary(file)),identity(before),'The compressed image changed during verification');
 return {success:true,rawBytes,rawSha256,compressedBytes:before.size,compressedSha256:await digestFile(file),compression:'gzip',verification:'Independent full decompression and SHA-256 comparison'};
}

// The caller must keep the application and its bound WSL runtime stopped throughout.
// The output is exclusive and bounded. Failed output remains an explicitly incomplete file.
export async function captureCompressedColdImage(source,destination,{maxCompressedBytes}){
 assert(Number.isSafeInteger(maxCompressedBytes)&&maxCompressedBytes>0);assert.notEqual(path.resolve(source).toLowerCase(),path.resolve(destination).toLowerCase());
 const before=await ordinary(source),header=Buffer.alloc(8),file=await open(source,'r');try{assert.equal((await file.read(header,0,8,0)).bytesRead,8);assert.equal(header.toString('ascii'),'vhdxfile','The source is not a VHDX');}finally{await file.close();}
 const hash=createHash('sha256');let rawBytes=0,compressedBytes=0;
 await pipeline(createReadStream(source),new Transform({transform(chunk,encoding,done){rawBytes+=chunk.length;hash.update(chunk);done(null,chunk);}}),createGzip({level:6}),new Transform({transform(chunk,encoding,done){compressedBytes+=chunk.length;if(compressedBytes>maxCompressedBytes)return done(Error('Compressed image reached its reserved disk-space budget'));done(null,chunk);}}),createWriteStream(destination,{flags:'wx'}));
 assert.equal(rawBytes,before.size);assert.deepEqual(identity(await ordinary(source)),identity(before),'The source changed during capture');const rawSha256=hash.digest('hex');
 const verification=await verifyCompressedColdImage(destination,{rawBytes,rawSha256});
 assert.equal(await digestFile(source),rawSha256,'The cold source changed after capture');assert.deepEqual(identity(await ordinary(source)),identity(before),'The source changed after verification');
 return {...verification,source:path.resolve(source),file:path.resolve(destination),sourceIdentity:identity(before),maxCompressedBytes,sourceReadTwice:true};
}

// A separate filesystem reader can bypass host AppData virtualization. Its read
// promise must reject on a failed process, and its inspection must pin the source.
export async function captureCompressedColdImageFromReader(destination,{read,inspect,maxCompressedBytes}){
 assert(Number.isSafeInteger(maxCompressedBytes)&&maxCompressedBytes>0);const before=await inspect();assert(Number.isSafeInteger(before.size)&&before.size>=8);
 const first=await read(),hash=createHash('sha256');let rawBytes=0,compressedBytes=0,header=Buffer.alloc(0);
 try{await Promise.all([first.completed,pipeline(first.stream,new Transform({transform(chunk,encoding,done){if(header.length<8){header=Buffer.concat([header,chunk.subarray(0,8-header.length)]);if(header.length===8&&header.toString('ascii')!=='vhdxfile')return done(Error('The source is not a VHDX'));}rawBytes+=chunk.length;if(rawBytes>before.size)return done(Error('The source exceeds its inspected size'));hash.update(chunk);done(null,chunk);}}),createGzip({level:6}),new Transform({transform(chunk,encoding,done){compressedBytes+=chunk.length;if(compressedBytes>maxCompressedBytes)return done(Error('Compressed image reached its reserved disk-space budget'));done(null,chunk);}}),createWriteStream(destination,{flags:'wx'}))]);}catch(error){first.stream.destroy();await first.completed.catch(()=>{});throw error;}
 assert.equal(rawBytes,before.size);assert.deepEqual(await inspect(),before,'The reader source changed during capture');const rawSha256=hash.digest('hex'),verification=await verifyCompressedColdImage(destination,{rawBytes,rawSha256});
 const second=await read(),afterHash=createHash('sha256');let secondBytes=0;try{for await(const chunk of second.stream){secondBytes+=chunk.length;afterHash.update(chunk);}await second.completed;}catch(error){second.stream.destroy();await second.completed.catch(()=>{});throw error;}
 assert.equal(secondBytes,rawBytes);assert.equal(afterHash.digest('hex'),rawSha256);assert.deepEqual(await inspect(),before,'The reader source changed after verification');
 return {...verification,file:path.resolve(destination),sourceIdentity:before,maxCompressedBytes,sourceReadTwice:true,readerBypassesHostAppDataRedirect:true};
}
