import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstat,realpath,opendir,open} from 'node:fs/promises';
import type {Stats} from 'node:fs';
import type {WorkspaceFiles} from './workspace';
import {safeName} from './workspace';
import type {FileNode,FileSnapshot} from './file-operation-contracts';

export const fileIdentity=(stat:Stats)=>`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
export const insidePath=(root:string,target:string)=>{const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
export const sameFilePath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Bounded inventory and hashes; file contents never become operation metadata or model output. */
export async function snapshotFiles(files:WorkspaceFiles,root:string,signal:AbortSignal,privateRecoveryRoot?:string,validate?:(file:string)=>void):Promise<FileSnapshot>{
 const nodes:FileNode[]=[],deadline=Date.now()+15000;let total=0;
 const check=()=>{signal.throwIfAborted();if(Date.now()>deadline)throw new Error('Folder inspection exceeded 15 seconds. Choose a smaller folder.');};
 const scan=async(file:string,relative:string,depth:number):Promise<void>=>{
  check();if(nodes.length>=1000||depth>20)throw new Error('Choose a folder with at most 1,000 items and 20 nested levels.');
  if(!privateRecoveryRoot||!insidePath(privateRecoveryRoot,file)){files.checkPath(file);validate?.(file);}
  const before=await lstat(file);if(before.isSymbolicLink()||before.isFile()&&before.nlink>1||!sameFilePath(await realpath(file),file))throw new Error('Linked or changed paths cannot be moved through the workspace.');
  if(!before.isFile()&&!before.isDirectory())throw new Error('Only regular files and folders can be managed.');
  const node:FileNode={path:relative,kind:before.isDirectory()?'folder':'file',identity:fileIdentity(before),mtime:before.mtimeMs,size:before.isFile()?before.size:0};nodes.push(node);
  if(before.isDirectory()){
   const directory=await opendir(file);for await(const entry of directory){check();if(!safeName(entry.name)||/[<>:"|?*\x00-\x1f]/.test(entry.name))throw new Error('This folder contains excluded hidden, credential, or dependency items. Manage those items separately in Windows.');await scan(path.join(file,entry.name),relative?relative+'/'+entry.name:entry.name,depth+1);}
  }else{
   if(total+before.size>50*1024*1024)throw new Error('Choose files and folders containing at most 50 MB.');
   const handle=await open(file,'r'),hash=createHash('sha256'),buffer=Buffer.alloc(65536);let size=0;
   try{if(fileIdentity(await handle.stat())!==node.identity)throw new Error('A file changed during inspection. Review it again.');for(;;){check();const chunk=await handle.read(buffer,0,buffer.length,size);if(!chunk.bytesRead)break;size+=chunk.bytesRead;if(total+size>50*1024*1024)throw new Error('Choose files and folders containing at most 50 MB.');hash.update(buffer.subarray(0,chunk.bytesRead));}const after=await handle.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||fileIdentity(after)!==node.identity)throw new Error('A file changed during inspection. Review it again.');}finally{await handle.close();}
   if(size!==before.size)throw new Error('A file changed during inspection. Review it again.');node.sha256=hash.digest('hex');total+=size;
  }
  const after=await lstat(file);if(fileIdentity(after)!==node.identity||after.mtimeMs!==node.mtime||!sameFilePath(await realpath(file),file))throw new Error('This item changed during inspection. Review it again.');
 };
 await scan(root,'',0);nodes.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {nodes,fingerprint:digest(nodes),contentHash:digest(nodes.map(({path,kind,size,sha256})=>({path,kind,size,sha256}))),files:nodes.filter(n=>n.kind==='file').length,folders:nodes.filter(n=>n.kind==='folder').length,bytes:total};
}
