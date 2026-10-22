import path from 'node:path';import {createHash} from 'node:crypto';import {createReadStream} from 'node:fs';import {lstat,realpath,readdir,rename,rm} from 'node:fs/promises';
export const storageUuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const storageWithin=(root:string,file:string)=>{const relative=path.relative(path.resolve(root),path.resolve(file));return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export const storageCopyName=(value:string)=>/^(?:[a-f0-9]{16,64}|[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}-[a-f0-9]{16,64})$/i.test(value);
export async function storageDirectory(directory:string){for(let current=path.resolve(directory);;current=path.dirname(current)){const info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink()||!same(await realpath(current),current))throw Error('Storage contains a linked or redirected folder.');if(path.dirname(current)===current)return;}}
export type StorageInventory={files:number;folders:number;bytes:number;sample:string[];fingerprint:string};
export async function storageInventory(root:string,contents=false):Promise<StorageInventory>{
 await storageDirectory(root);const rows:unknown[]=[],sample:string[]=[],deadline=Date.now()+30000;let files=0,folders=0,bytes=0;
 const check=()=>{if(Date.now()>deadline)throw Error('This working copy takes too long to inspect. Review it in Windows before cleanup.');if(rows.length>=10000)throw Error('This working copy contains more than 10,000 items. Review it in Windows before cleanup.');};
 async function walk(relative:string,depth:number){check();if(depth>32)throw Error('This working copy has too many nested folders.');const file=path.join(root,relative),before=await lstat(file);if(before.isSymbolicLink()||!same(await realpath(file),file)||!before.isDirectory()&&(!before.isFile()||before.nlink!==1))throw Error('Linked files and special items cannot be removed through Storage.');
  if(sample.length<30&&relative)sample.push(relative.replaceAll(path.sep,'/'));const identity=[before.dev,before.ino,before.birthtimeMs];
  if(before.isDirectory()){folders++;rows.push([relative,'folder',identity]);for(const name of(await readdir(file)).sort())await walk(relative?path.join(relative,name):name,depth+1);}
  else{files++;bytes+=before.size;if(bytes>64*1024**3)throw Error('This working copy is larger than 64 GB. Review it in Windows before cleanup.');let digest:string|undefined;if(contents){const hash=createHash('sha256');for await(const chunk of createReadStream(file)){check();hash.update(chunk);}digest=hash.digest('hex');}const after=await lstat(file);if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||after.isSymbolicLink())throw Error('Files changed during storage inspection. Wait for writes to finish and review again.');rows.push([relative,'file',identity,before.size,before.mtimeMs,digest]);}
 }
 await walk('',0);return {files,folders,bytes,sample,fingerprint:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
}
export async function removeStorageCopy(parent:string,name:string,plan:string,expected:StorageInventory,guard:()=>Promise<void>){
 if(!storageCopyName(name)||!storageUuid(plan))throw Error('Invalid working-copy cleanup identity.');await storageDirectory(parent);const target=path.join(parent,name),staged=path.join(parent,'.agentopia-cleanup-'+plan);if(!storageWithin(parent,target)||path.dirname(target)!==parent)throw Error('This working copy left its account storage.');
 await guard();const current=await storageInventory(target,true);if(current.fingerprint!==expected.fingerprint)throw Error('The working copy changed after review. Review it again before deleting it.');await guard();
 try{await lstat(staged);throw Error('A previous cleanup needs inspection before continuing.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await rename(target,staged);
 try{await guard();const checked=await storageInventory(staged,true);if(checked.fingerprint!==expected.fingerprint)throw Error('The working copy changed before cleanup.');await guard();await storageDirectory(staged);await rm(staged,{recursive:true,force:false});}
 catch(error){let restored=false;try{await lstat(target);}catch(missing){if((missing as NodeJS.ErrnoException).code==='ENOENT'){try{await rename(staged,target);restored=true;}catch{}}}throw Error((error as Error).message+(restored?' The remaining folder is back in its original location.':' Inspect the remaining .agentopia-cleanup folder in Windows before trying again.'));}
}
