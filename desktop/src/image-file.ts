import {lstat,open,realpath} from 'node:fs/promises';
import {imageData,maxImageBytes} from './attachment-images';

/** Read the selected original without following a replacement link or growth. */
export async function readImageFile(file:string){
 const before=await lstat(file);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>maxImageBytes)throw Error('Images must be regular files of 20 MB or smaller.');
 const canonical=await realpath(file),handle=await open(file,'r');
 try{
  const stat=await handle.stat();
  if(stat.ino!==before.ino||stat.dev!==before.dev||stat.size!==before.size||stat.mtimeMs!==before.mtimeMs)throw Error('The image changed while it was being opened. Select it again.');
  const bytes=Buffer.alloc(stat.size);let offset=0;
  while(offset<bytes.length){const part=await handle.read(bytes,offset,bytes.length-offset,offset);if(!part.bytesRead)throw Error('The image changed while it was being read.');offset+=part.bytesRead;}
  const after=await handle.stat(),current=await lstat(file);
  if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||current.isSymbolicLink()||current.nlink!==1||current.ino!==stat.ino||current.dev!==stat.dev||await realpath(file)!==canonical)throw Error('The image changed while it was being read. Select it again.');
  return imageData(bytes);
 }finally{await handle.close();}
}
