import {nativeImage,safeStorage} from 'electron';
import {mkdir,lstat,realpath,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {maxGeneratedImageBytes} from './image-generation-contracts';
import {rasterImageType} from './image-generation-transport';

export type GeneratedImageScope={owner:string;id:string;requestId:string;conversationId:string;nativeThreadId:string|null};
export type GeneratedImageAsset={id:string;mediaType:'image/png';bytes:number;sha256:string;width:number;height:number};
type Cipher=Pick<typeof safeStorage,'isEncryptionAvailable'|'encryptString'|'decryptString'>;
type Normalized={bytes:Buffer;width:number;height:number};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function normalize(bytes:Buffer):Normalized{
 rasterImageType(bytes);const image=nativeImage.createFromBuffer(bytes),size=image.getSize();
 if(image.isEmpty()||!size.width||!size.height||size.width*size.height>64000000)throw new Error('The generated image is invalid or exceeds 64 million pixels.');
 const png=image.toPNG();if(rasterImageType(png)!=='image/png')throw new Error('The generated image could not be imported as PNG.');return {bytes:png,...size};
}
/** Owner/conversation-bound encrypted assets. Database authorization is rechecked
 * by the required guard; no provider requests or file deletion occur here. */
export class GeneratedImages{
 constructor(private directory:string,private cipher:Cipher=safeStorage,private decode:(bytes:Buffer)=>Normalized=normalize){}
 private scope(value:GeneratedImageScope){for(const key of ['owner','id','requestId','conversationId'] as const)if(!uuid.test(value[key]))throw new Error('Invalid generated-image ownership scope.');if(value.nativeThreadId!==null&&!uuid.test(value.nativeThreadId))throw new Error('Invalid generated-image native thread.');return {owner:value.owner,id:value.id,requestId:value.requestId,conversationId:value.conversationId,nativeThreadId:value.nativeThreadId};}
 private async file(scope:GeneratedImageScope,create=false){
  const root=path.resolve(this.directory),owner=path.join(root,scope.owner);if(create){await mkdir(root,{recursive:true});await mkdir(owner,{recursive:true});}
  for(const directory of [root,owner]){const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Generated-image storage must be an ordinary owned directory.');}
  const actualRoot=await realpath(root),actualOwner=await realpath(owner);if(!actualOwner.startsWith(actualRoot+path.sep))throw new Error('Generated-image storage left its owned directory.');
  return path.join(owner,scope.id+'.bin');
 }
 async write(value:GeneratedImageScope,bytes:Buffer,guard:()=>Promise<void>):Promise<GeneratedImageAsset>{
  const scope=this.scope(value);await guard();if(!this.cipher?.isEncryptionAvailable())throw new Error('Windows generated-image encryption is unavailable.');
  const image=this.decode(bytes);if(rasterImageType(image.bytes)!=='image/png'||!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width<1||image.height<1||image.width*image.height>64000000)throw new Error('Invalid normalized generated image.');
  const asset:GeneratedImageAsset={id:scope.id,mediaType:'image/png',bytes:image.bytes.length,sha256:sha(image.bytes),width:image.width,height:image.height};
  const payload=JSON.stringify({version:1,scope,asset,data:image.bytes.toString('base64')});await guard();
  const file=await this.file(scope,true),handle=await open(file,'wx',0o600);try{await handle.writeFile(this.cipher.encryptString(payload));await handle.sync();}finally{await handle.close();}
  // A revoked operation retains its encrypted bytes for inspected recovery; it
  // cannot publish them to the caller or automatically generate another image.
  await guard();return asset;
 }
 async read(value:GeneratedImageScope,guard:()=>Promise<void>):Promise<{asset:GeneratedImageAsset;bytes:Buffer}>{
  const scope=this.scope(value);await guard();if(!this.cipher?.isEncryptionAvailable())throw new Error('Windows generated-image encryption is unavailable.');
  const file=await this.file(scope),stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>Math.ceil(maxGeneratedImageBytes/3)*4+1024*1024)throw new Error('The stored generated image is invalid.');
  const actual=await realpath(file),owner=await realpath(path.dirname(file));if(!actual.startsWith(owner+path.sep))throw new Error('The stored generated image left its owned directory.');
  const handle=await open(file,'r');let encrypted:Buffer;
  try{
   const opened=await handle.stat();if(!opened.isFile()||opened.nlink!==1||opened.dev!==stat.dev||opened.ino!==stat.ino||opened.size!==stat.size)throw new Error('The saved image changed while it was opened.');
   encrypted=Buffer.alloc(opened.size);let offset=0;while(offset<encrypted.length){const read=await handle.read(encrypted,offset,encrypted.length-offset,offset);if(!read.bytesRead)throw new Error('The saved image was truncated.');offset+=read.bytesRead;}
   const probe=await handle.read(Buffer.alloc(1),0,1,opened.size),after=await handle.stat();if(probe.bytesRead||after.size!==opened.size||after.nlink!==1)throw new Error('The saved image changed during its read.');
  }finally{await handle.close();}
  const payload=JSON.parse(this.cipher.decryptString(encrypted));if(payload.version!==1||!payload.scope||Object.keys(scope).some(key=>payload.scope[key]!==scope[key as keyof GeneratedImageScope]))throw new Error('This generated image belongs to a different request, conversation or native thread.');
  if(typeof payload.data!=='string'||!payload.data.length||payload.data.length>Math.ceil(maxGeneratedImageBytes/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.data))throw new Error('The saved generated-image bytes are invalid.');
  const bytes=Buffer.from(payload.data,'base64'),asset=payload.asset;if(bytes.toString('base64')!==payload.data||rasterImageType(bytes)!=='image/png'||!asset||asset.id!==scope.id||asset.mediaType!=='image/png'||asset.bytes!==bytes.length||asset.sha256!==sha(bytes)||!Number.isSafeInteger(asset.width)||!Number.isSafeInteger(asset.height)||asset.width<1||asset.height<1||asset.width*asset.height>64000000)throw new Error('The saved generated image failed its integrity check.');
  await guard();return {asset:{id:asset.id,mediaType:'image/png',bytes:asset.bytes,sha256:asset.sha256,width:asset.width,height:asset.height},bytes};
 }
}
