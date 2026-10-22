import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstat,readdir,readFile,realpath} from 'node:fs/promises';
import {storageDirectory} from './storage-files';

const same=(a:string,b:string)=>process.platform==='win32'?path.normalize(a).toLowerCase()===path.normalize(b).toLowerCase():path.normalize(a)===path.normalize(b);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unsafe=()=>Error('Git storage contains a linked, redirected or unsupported path. Keep the workspace and inspect its repository.');

/** Git's alternates file uses C-quoted byte strings for quoted paths. Resolve
 * relative entries from the object directory, as Git does, never from info/. */
export function gitAlternatePath(line:string){
 if(!line.startsWith('"')){if(/[\x00-\x1f\x7f]/.test(line))throw unsafe();return line;}
 if(!line.endsWith('"')||line.length<2)throw unsafe();const chunks:Buffer[]=[];
 for(let i=1;i<line.length-1;i++){
  if(line[i]==='"')throw unsafe();
  if(line[i]!=='\\'){const point=line.codePointAt(i)!;chunks.push(Buffer.from(String.fromCodePoint(point)));if(point>0xffff)i++;continue;}
  const escaped=line[++i];if(i>=line.length-1)throw unsafe();
  if(escaped==='\\'||escaped==='"')chunks.push(Buffer.from(escaped));
  else if(/[0-7]/.test(escaped)){const octal=/^[0-7]{1,3}/.exec(line.slice(i))![0],value=parseInt(octal,8);if(value>255)throw unsafe();chunks.push(Buffer.from([value]));i+=octal.length-1;}
  else throw unsafe();
 }
 const bytes=Buffer.concat(chunks),value=bytes.toString('utf8');if(!Buffer.from(value).equals(bytes)||/[\x00-\x1f\x7f]/.test(value))throw unsafe();return value;
}

type CachedDirectory={signature:string;directories:string[]};
/** Inspect nested storage before trusted Git writes. Object files may be
 * immutable hardlinks from a normal local clone; refs/logs/pointers may not.
 * Cache unchanged directories to avoid restatting every packed/loose object
 * on every recovery command. Directory identity/change times invalidate it. */
export class WorkspaceGitStorage{
 private cache=new Map<string,CachedDirectory>();
 private topology?:string;
 constructor(private common:string,private checkPath:(file:string)=>void,private checkAlternatePath:(file:string)=>void=checkPath,private allowAlternates=true){}
 async verify(guard:()=>Promise<void>,signal?:AbortSignal){
  const deadline=Date.now()+60000;let entries=0,lastGuard=0;const stores=new Map<string,string>(),pointers:[string,string][]=[],active=new Set<string>();
  const check=async(force=false)=>{signal?.throwIfAborted();if(Date.now()>deadline||entries>250000)throw Error('Git storage is too large to inspect within this review. Keep it for manual recovery.');if(force||Date.now()-lastGuard>=100){await guard();lastGuard=Date.now();}};
  const stat=async(file:string)=>{this.checkPath(file);const info=await lstat(file,{bigint:true});if(info.isSymbolicLink()||!same(await realpath(file),file))throw unsafe();return info;};
  const optional=async(file:string)=>{try{return await stat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}};
  const identity=(info:Awaited<ReturnType<typeof stat>>)=>digest([info.dev.toString(),info.ino.toString(),info.birthtimeNs.toString()]);
  const walk=async(root:string,hardlinks:boolean,depth=0):Promise<void>=>{
   await check();if(depth>64)throw unsafe();const info=await stat(root);if(!info.isDirectory())throw unsafe();
   const signature=digest([identity(info),info.mtimeNs.toString(),info.ctimeNs.toString()]),cached=this.cache.get(root);let directories:string[];
   if(cached?.signature===signature)directories=cached.directories;
   else{
    directories=[];for(const name of(await readdir(root)).sort()){
     if(!name||name==='.'||name==='..'||/[\\/\x00-\x1f\x7f]/.test(name))throw unsafe();const file=path.join(root,name),child=await stat(file);if(++entries%256===0)await check();
     if(child.isDirectory())directories.push(file);else if(!child.isFile()||!hardlinks&&child.nlink!==1n)throw unsafe();
    }
    const after=await stat(root);if(identity(after)!==identity(info)||after.mtimeNs!==info.mtimeNs||after.ctimeNs!==info.ctimeNs)throw Error('Git storage changed while inspecting its paths. Review it again.');
    this.cache.set(root,{signature,directories});
   }
   for(const directory of directories)await walk(directory,hardlinks,depth+1);
  };
  const visit=async(store:string):Promise<void>=>{
   await check(true);const normalized=process.platform==='win32'?store.toLowerCase():store;if(active.has(normalized))throw Error('Git object store alternates contain a cycle. Inspect them before recovery.');if(stores.has(normalized))return;if(stores.size>=32)throw Error('Git uses too many alternate object stores for this review.');
   await storageDirectory(store);const info=await stat(store);if(!info.isDirectory())throw unsafe();stores.set(normalized,identity(info));active.add(normalized);await walk(store,true);
   const pointer=path.join(store,'info','alternates'),pointerInfo=await optional(pointer);let contents='';
   if(pointerInfo){if(!pointerInfo.isFile()||pointerInfo.nlink!==1n||pointerInfo.size>65536n)throw unsafe();const bytes=await readFile(pointer);contents=bytes.toString('utf8');if(!Buffer.from(contents).equals(bytes))throw unsafe();const after=await stat(pointer);if(identity(after)!==identity(pointerInfo)||after.size!==pointerInfo.size||after.mtimeNs!==pointerInfo.mtimeNs)throw Error('Git alternate object pointers changed during inspection.');}
   pointers.push([normalized,contents]);
   for(const line of contents.split(/\r?\n/).filter(Boolean)){
    const decoded=gitAlternatePath(line);if(!decoded)continue;const target=path.resolve(store,decoded);this.checkPath(target);this.checkAlternatePath(target);
    // Object stores reached through the selected repository's verified pointer
    // graph are Git metadata, not additional model folder grants. A restored
    // independent repository must retain no alternate dependency.
    if(!this.allowAlternates)throw Error('The independent restored Git repository gained an alternate object store. Keep it for inspection.');
    await visit(target);
   }
   active.delete(normalized);
  };
  await check(true);await storageDirectory(this.common);const common=await stat(this.common);if(!common.isDirectory())throw unsafe();await visit(path.join(this.common,'objects'));
  for(const name of ['refs','logs','worktrees','reftable','info']){const directory=path.join(this.common,name),info=await optional(directory);if(info){if(!info.isDirectory())throw unsafe();await walk(directory,false);}}
  for(const name of ['HEAD','config','config.worktree','packed-refs','shallow','commondir','gitdir']){const file=path.join(this.common,name),info=await optional(file);if(info&&(!info.isFile()||info.nlink!==1n))throw unsafe();}
  const topology=digest([identity(common),[...stores].sort(),pointers.sort(([a],[b])=>a.localeCompare(b))]);
  if(this.topology&&this.topology!==topology)throw Error('Git object store ownership or alternate pointers changed during recovery. Keep the workspace and review it again.');this.topology=topology;await check(true);
 }
}
