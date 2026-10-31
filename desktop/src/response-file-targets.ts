import path from 'node:path';import {lstat,realpath} from 'node:fs/promises';
import {safeName} from './workspace';import {privateProfilePath} from './desktop-profile';import {privateRuntimePath} from './runtime-binding';
import {snapshotResponseFiles,responseFileChanges,type ResponseFileSnapshot} from './response-file-changes';
import type {ResponseFileChange} from './response-file-contracts';import type {ToolDefinition} from './tool-contracts';
export const fileTargetsTool:ToolDefinition={name:'record_file_targets',description:'Record the BEFORE state of files or output folders for this response’s changed-files rollup. Call BEFORE any file-changing command or desktop action, including targets outside the working folder. Resolve computed destinations first, then pass their absolute paths. Include both move source and destination. This only records changes; it grants no write permission. Repeating a path preserves its original before state. Do not include unrelated folders or private application data.',parameters:{type:'object',properties:{paths:{type:'array',items:{type:'string'},minItems:1,maxItems:32}},required:['paths'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
export const fileTargetsInstructions='Before a command or desktop action creates, modifies, moves, or deletes files, call sylvana_host.record_file_targets with the absolute paths of all intended files or output folders, including destinations outside the working directory. Resolve environment variables and computed paths first. Register targets before changing them, including both sides of a move; an output folder may be registered before it exists. The tool retains the first before state and the host compares final contents automatically. It does not authorize an operation or expand file permissions. Preserve Sylvana’s internal recovery folders. Do not replace this call with a list of filenames in your answer.';
const canonical=(value:string)=>{const normalized=path.resolve(value).replaceAll('\\','/');return process.platform==='win32'?normalized.toLowerCase():normalized;};
const within=(file:string,root:string)=>canonical(file)===canonical(root)||canonical(file).startsWith(canonical(root)+'/');
type Target={path:string;before:ResponseFileSnapshot;only?:string};
/** Request-owned observations of declared targets, independent of the working folder. */
export class ResponseFileTargets{
 private targets:Target[]=[];private queue:Promise<unknown>=Promise.resolve();private bytes=0;private partial=false;private closed=false;
 constructor(private cwd:string,private protectedRoots:string[]=[]){}
 private allowed(file:string){const absolute=path.resolve(file);if(path.parse(absolute).root===absolute||absolute.startsWith('\\\\')||privateProfilePath(absolute)||privateRuntimePath(absolute)||absolute.split(/[\\/]/).slice(1).some(part=>!safeName(part))||this.protectedRoots.some(root=>within(absolute,root)))throw Error('This private or system path cannot be recorded.');return absolute;}
 async record(values:unknown,signal:AbortSignal):Promise<{recorded:string[];unavailable:string[]}>{
  if(!Array.isArray(values)||!values.length||values.length>32||values.some(v=>typeof v!=='string'||v.length>4096||!path.isAbsolute(v)))throw Error('Provide up to 32 absolute file or output-folder paths.');
  const run=async()=>{signal.throwIfAborted();if(this.closed)throw Error('This response has finished recording files.');const recorded:string[]=[],unavailable:string[]=[];
   for(const value of values){signal.throwIfAborted();try{const file=this.allowed(value);if(this.targets.some(t=>within(file,t.path))){recorded.push(file);continue;}if(this.targets.length>=64)throw Error('Target limit');let root=path.dirname(file);while(true){try{const info=await lstat(root);if(!info.isDirectory()||info.isSymbolicLink()||canonical(await realpath(root))!==canonical(root))throw Error('A target parent is linked.');break;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const parent=path.dirname(root);if(parent===root)throw error;root=parent;}}
    const before=await snapshotResponseFiles(root,signal,path.relative(root,file)),size=[...before.files.values()].reduce((n,e)=>n+e.bytes,0);if(!before.complete||this.bytes+size>48*1024*1024)throw Error('Target inventory unavailable');this.bytes+=size;this.targets.push({path:file,before,only:path.relative(root,file)});recorded.push(file);
   }catch{this.partial=true;unavailable.push(value);}}
   return {recorded,unavailable};};const pending=this.queue.then(run);this.queue=pending.catch(()=>{});return pending;
 }
 async recordCommand(command:string,cwd:string,signal:AbortSignal){const targets=commandFileTargets(command,cwd).filter(file=>{try{this.allowed(file);return !/\.(exe|dll|node)$/i.test(file);}catch{return false;}});if(targets.length)return this.record(targets,signal);}
 async finish(signal:AbortSignal):Promise<{files:ResponseFileChange[];notice?:string}>{
  await this.queue;this.closed=true;const files=new Map<string,ResponseFileChange>(),covered:string[]=[];let textBytes=0;
  for(const target of this.targets){try{const observed=responseFileChanges(target.before,await snapshotResponseFiles(target.before.root,signal,target.only));if(observed.notice)this.partial=true;
    for(const file of observed.files){if(covered.some(root=>within(file.path,root)))continue;const size=Buffer.byteLength(file.before??'')+Buffer.byteLength(file.after??'');textBytes+=size;files.set(canonical(file.path),{...file,key:'target:'+file.path,relativePath:file.path.replaceAll('\\','/'),...(textBytes>1000000?{before:null,after:null,text:false,added:null,removed:null}:{})});}
    covered.push(target.path);
   }catch{this.partial=true;}}
  return {files:files.size<=200?[...files.values()]:[],...((this.partial||files.size>200)?{notice:'Some file targets could not be fully compared. Recorded tool patches remain available.'}:{})};
 }
}
/** Literal external paths are recorded automatically before approved native commands. */
export function commandFileTargets(command:string,cwd:string):string[]{
 const paths=[cwd];for(const match of command.matchAll(/(['"])([a-z]:[\\/][^'"\r\n]*?)\1/gi)){const value=match[2].replaceAll('\\\\','\\');if(!/[$%*?]/.test(value))paths.push(value);}return [...new Set(paths)].slice(0,32);
}
