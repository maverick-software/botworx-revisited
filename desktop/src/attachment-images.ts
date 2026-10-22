import {nativeImage,safeStorage} from 'electron';
import {mkdir,writeFile,readFile,unlink,readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {maxImageBytes} from './image-limits';
export {maxImageBytes} from './image-limits';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function imageMime(bytes:Buffer){
 if(!bytes.length||bytes.length>maxImageBytes)throw new Error('Images must be 20 MB or smaller.');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216,webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!png&&!jpeg&&!webp)throw new Error('Unsupported image format. Choose a PNG, JPEG, or WebP image.');
 return png?'image/png':jpeg?'image/jpeg':'image/webp';
}
export function imageData(bytes:Buffer){return 'data:'+imageMime(bytes)+';base64,'+bytes.toString('base64');}
function decodeImage(bytes:Buffer){
 imageData(bytes);const image=nativeImage.createFromBuffer(bytes),size=image.getSize();
 if(image.isEmpty()||size.width*size.height>32000000)throw new Error('This image is invalid or exceeds 32 million pixels.');
 // Keep the submitted format and pixels. Converting a compact JPEG/WebP to
 // PNG can exceed the input limit and changes the user's original attachment.
 return bytes;
}
type Cipher=Pick<typeof safeStorage,'isEncryptionAvailable'|'encryptString'|'decryptString'>;
export class AttachmentImages{
 constructor(private directory:string,private cipher:Cipher=safeStorage,private decode:(bytes:Buffer)=>Buffer=decodeImage){}
 private file(user:string,id:string){if(!uuid.test(user)||!uuid.test(id))throw new Error('Invalid attachment owner or identifier.');return path.join(this.directory,user,id+'.bin');}
 prepare(value:unknown){
  if(typeof value!=='string'||value.length>Math.ceil(maxImageBytes/3)*4||!value.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error('Paste a PNG, JPEG, or WebP image of 20 MB or smaller.');
  const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw new Error('The pasted image is invalid.');return this.decode(bytes);
 }
 async write(user:string,id:string,bytes:Buffer){
  const file=this.file(user,id);if(!this.cipher.isEncryptionAvailable())throw new Error('Windows attachment encryption is unavailable.');
  await mkdir(path.dirname(file),{recursive:true});const encrypted=this.cipher.encryptString(bytes.toString('base64'));
  await writeFile(file,encrypted,{flag:'wx',mode:0o600});
 }
 async read(user:string,id:string){
  if(!this.cipher.isEncryptionAvailable())throw new Error('Windows attachment encryption is unavailable.');
  try{return imageData(Buffer.from(this.cipher.decryptString(await readFile(this.file(user,id))),'base64'));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new Error('The pasted image is missing. Paste it again.');throw error;}
 }
 async restore(user:string,id:string,bytes:Buffer){
  imageData(bytes);this.decode(bytes);const file=this.file(user,id),same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  for(let current=path.dirname(file);;current=path.dirname(current)){try{const info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink()||!same(await realpath(current),current))throw Error('The recovered image folder is linked or redirected.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(path.dirname(current)===current)break;}
  let existing;try{existing=await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(existing){if(!existing.isFile()||existing.isSymbolicLink()||existing.nlink!==1||!same(await realpath(file),file))throw Error('The recovered image conflicts with an existing file.');const image=await this.read(user,id),previous=Buffer.from(image.slice(image.indexOf(',')+1),'base64'),after=await lstat(file);if(!previous.equals(bytes)||existing.ino!==after.ino||existing.size!==after.size||existing.mtimeMs!==after.mtimeMs)throw Error('The recovered image conflicts with existing image bytes.');return;}
  await this.write(user,id,bytes);
 }
 async remove(user:string,id:string){try{await unlink(this.file(user,id));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
 async recover(user:string,retained:string[]){
  const directory=path.dirname(this.file(user,'00000000-0000-4000-8000-000000000000'));
  let entries:string[];try{entries=await readdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  for(const name of entries){const id=name.slice(0,-4);if(name.endsWith('.bin')&&uuid.test(id)&&!retained.includes(id)&&(await lstat(path.join(directory,name))).isFile())await this.remove(user,id);}
 }
}
