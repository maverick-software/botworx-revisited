import path from 'node:path';
import {lstat,open,realpath} from 'node:fs/promises';
import {storageDirectory} from './storage-files';

/** The generated recovery bundle contains one complete pack and one owned
 * reference. Git verifies the pack itself; this only locates its byte range
 * and checksum so index-pack can receive explicit destination filenames. */
export async function workspaceBundlePack(file:string,hashBytes:20|32,guard:()=>Promise<void>,signal:AbortSignal){
 await guard();signal.throwIfAborted();if(!path.isAbsolute(file))throw Error('Use the private Git recovery bundle.');await storageDirectory(path.dirname(file));
 const before=await lstat(file,{bigint:true}),same=(a:string,b:string)=>process.platform==='win32'?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase():path.normalize(a)===path.normalize(b);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||!same(await realpath(file),file)||before.size>512n*1024n**3n||before.size<BigInt(12+hashBytes))throw Error('The private Git recovery bundle is invalid.');
 const identity=(info:typeof before)=>[info.dev,info.ino,info.birthtimeNs,info.size,info.mtimeNs,info.ctimeNs].join(':'),size=Number(before.size),handle=await open(file,'r');
 try{
  if(identity(await handle.stat({bigint:true}))!==identity(before))throw Error('The private Git recovery bundle changed.');
  const read=async(buffer:Buffer,position:number)=>{let offset=0;while(offset<buffer.length){await guard();signal.throwIfAborted();const row=await handle.read(buffer,offset,buffer.length-offset,position+offset);if(!row.bytesRead)throw Error('The private Git recovery bundle was truncated.');offset+=row.bytesRead;}};
  const prefix=Buffer.alloc(Math.min(size,65536));await read(prefix,0);const text=prefix.toString('latin1'),boundary=/\r?\n\r?\n/.exec(text);if(!boundary)throw Error('The private Git recovery bundle header is missing or too large.');
  const offset=boundary.index+boundary[0].length,lines=text.slice(0,boundary.index).split(/\r?\n/),signature=lines.shift(),format=hashBytes===32?'sha256':'sha1';
  if(signature==='# v3 git bundle'){if(lines[0]?.startsWith('@object-format=')){if(lines.shift()!=='@object-format='+format)throw Error('The Git recovery bundle uses another object format.');}else if(hashBytes!==20)throw Error('The Git recovery bundle uses another object format.');}
  else if(signature!=='# v2 git bundle'||hashBytes!==20)throw Error('The Git recovery bundle format is unsupported.');
  const reference=lines.length===1?new RegExp('^([a-f0-9]{'+hashBytes*2+'}) (refs/agentopia/recovery/[a-f0-9]{64})$').exec(lines[0]):null;
  if(!reference||size<offset+12+hashBytes||prefix.length<offset+8||prefix.subarray(offset,offset+4).toString('ascii')!=='PACK'||![2,3].includes(prefix.readUInt32BE(offset+4)))throw Error('The private Git recovery bundle has an incomplete or invalid pack.');
  const trailer=Buffer.alloc(hashBytes);await read(trailer,size-hashBytes);await guard();signal.throwIfAborted();
  if(identity(await handle.stat({bigint:true}))!==identity(before)||identity(await lstat(file,{bigint:true}))!==identity(before))throw Error('The private Git recovery bundle changed while inspecting it.');
  return {file,start:offset,end:size-1,bytes:size-offset,checksum:trailer.toString('hex'),commit:reference[1],reference:reference[2]};
 }finally{await handle.close();}
}
