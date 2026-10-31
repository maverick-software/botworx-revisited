import {open,lstat,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';import {diffLines} from 'diff';
import {safeName,textTypes} from './workspace';
import type {ResponseFileChange} from './response-file-contracts';
type Entry={hash:string;text:string|null;bytes:number;binary:boolean};
export type ResponseFileSnapshot={root:string;identity:string;files:Map<string,Entry>;complete:boolean};
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
/** Bounded, local-only snapshots of this chat's actual working folder. Never follow links. */
export async function snapshotResponseFiles(root:string,signal:AbortSignal,only?:string):Promise<ResponseFileSnapshot>{
 const absolute=path.resolve(root),stat=await lstat(absolute);if(stat.isSymbolicLink()||!stat.isDirectory()||!samePath(await realpath(absolute),absolute))throw Error('The working folder changed.');
 const result:ResponseFileSnapshot={root:absolute,identity:`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`,files:new Map(),complete:true};let entries=0,bytes=0;
 async function visit(folder:string,depth:number):Promise<void>{
  signal.throwIfAborted();if(depth>24)throw Error('Workspace depth limit');
  if(!samePath(await realpath(folder),folder)||(await lstat(folder)).isSymbolicLink())throw Error('A working folder became a link');
  for(const entry of await readdir(folder,{withFileTypes:true})){
   signal.throwIfAborted();if(!safeName(entry.name))continue;const relative=path.relative(absolute,path.join(folder,entry.name));if(only&&!samePath(relative,only)&&!samePath(relative.slice(0,only.length+1),only+path.sep)&&!samePath(only.slice(0,relative.length+1),relative+path.sep))continue;if(++entries>4000)throw Error('Workspace file limit');
   const file=path.join(folder,entry.name),info=await lstat(file);if(info.isSymbolicLink())continue;
   if(info.isDirectory()){await visit(file,depth+1);continue;}if(!info.isFile())continue;
   if(info.size>20*1024*1024||(bytes+=info.size)>32*1024*1024)throw Error('Workspace size limit');
   const handle=await open(file,'r');try{
    const opened=await handle.stat();if(opened.ino!==info.ino||opened.dev!==info.dev||opened.size!==info.size)throw Error('A file changed while being recorded');
    const data=await handle.readFile(),after=await handle.stat();if(after.mtimeMs!==opened.mtimeMs||after.size!==opened.size||data.length!==opened.size)throw Error('A file changed while being recorded');
    let text:string|null=null,binary=!textTypes.has(path.extname(file).toLowerCase())||data.includes(0);if(!binary&&data.length<=160000){try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{binary=true;}}
    result.files.set(path.relative(absolute,file).replaceAll('\\','/'),{hash:createHash('sha256').update(data).digest('hex'),text,bytes:data.length,binary});
   }finally{await handle.close();}
  }
  if(!samePath(await realpath(folder),folder)||(await lstat(folder)).isSymbolicLink())throw Error('A working folder became a link');
 }
 try{await visit(absolute,0);const current=await lstat(absolute);if(`${current.dev}:${current.ino}:${current.birthtimeMs}`!==result.identity)throw Error('The working folder changed');}catch{result.complete=false;}
 return result;
}
export function responseFileChanges(before:ResponseFileSnapshot,after:ResponseFileSnapshot):{files:ResponseFileChange[];notice?:string}{
 if(!before.complete||!after.complete||!samePath(before.root,after.root)||before.identity!==after.identity)return {files:[],notice:'The working folder could not be fully compared. Recorded tool patches remain available.'};
 const files:ResponseFileChange[]=[];let textBytes=0;
 for(const name of new Set([...before.files.keys(),...after.files.keys()])){
  const old=before.files.get(name),next=after.files.get(name);if(old?.hash===next?.hash)continue;
  const available=(!old||old.text!==null)&&(!next||next.text!==null),text=available&&(textBytes+=(old?.bytes??0)+(next?.bytes??0))<=1000000,parts=text?diffLines(old?.text??'',next?.text??'',{timeout:50,maxEditLength:8000}):undefined;
  files.push({key:'workspace:'+name,path:path.join(before.root,...name.split('/')),relativePath:name,kind:!old?'created':!next?'deleted':'modified',before:text?old?.text??null:null,after:text?next?.text??null:null,beforeHash:old?.hash??null,afterHash:next?.hash??null,text,binary:old?.binary||next?.binary||false,added:parts?parts.reduce((n,p)=>n+(p.added?p.count??0:0),0):null,removed:parts?parts.reduce((n,p)=>n+(p.removed?p.count??0:0),0):null});
 }
 return files.length>200?{files:[],notice:'More than 200 files changed in the working folder. Recorded tool patches remain available.'}:{files};
}
