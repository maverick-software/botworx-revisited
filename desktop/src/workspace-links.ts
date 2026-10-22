import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sourceFragment,sourceFragmentText,sourceLinkSuffix,sourceLocation} from './source-locations';
import {textTypes} from './workspace';
import {lstat,realpath} from 'node:fs/promises';
import type {FileReference} from './contracts';
import type {WorkspaceLink} from './workspace-link-contracts';
import type {WorkspaceFiles} from './workspace';
import {WorkspaceTools} from './workspace-tools';
import {browserAddress} from './workspace-browser';
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const inside=(root:string,target:string)=>{const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
export function documentFragment(value:unknown){if(typeof value!=='string'||value.length>500||/[\x00-\x1f\x7f]/.test(value))throw new Error('Invalid document section.');const location=sourceFragment(value,true);return location?sourceFragmentText(location):value;}
function decoded(value:string){try{return decodeURIComponent(value);}catch{throw new Error('This document link has invalid encoding.');}}
export class WorkspaceDocumentLinks{
 constructor(private files:WorkspaceFiles){}
 private retained(user:string,reference:FileReference){if(!this.files.list(user).some(row=>row.id===reference.id&&row.kind===reference.kind&&same(row.path,reference.path)))throw new Error('This workspace reference was forgotten. Open the folder again to follow its links.');}
 async resolve(user:string,args:Record<string,unknown>):Promise<WorkspaceLink>{
  if(typeof args.href!=='string'||!args.href.trim()||args.href.length>4000||/[\x00-\x1f\x7f]/.test(args.href))throw new Error('Use a valid document link.');
  let href=args.href.trim();
  if(/^https?:/i.test(href)||href.startsWith('//'))return {kind:'web',url:browserAddress(href.startsWith('//')?'https:'+href:href)};
  if(/^agentopia-file:/i.test(href)){
   const url=new URL(href);if(url.username||url.password||url.port||url.search)throw new Error('Use a valid workspace file reference.');
   const reference=this.files.list(user).find(row=>row.id===url.hostname&&row.source!=='clipboard');if(!reference)throw new Error('This workspace reference is unavailable. Open its file or folder again.');
   const relative=decoded(url.pathname.replace(/^\//,''));if(reference.kind==='file'&&relative!=='')throw new Error('This reference grants access to one file.');
   const resolved=await new WorkspaceTools(this.files).operationPath(user,reference.id,relative),target=pathToFileURL(resolved.target);target.hash=url.hash;this.retained(user,reference);
   return this.resolve(user,{referenceId:reference.id,path:'',href:target.href});
  }
  const suffix=sourceLinkSuffix(href);href=suffix.href;
  const hash=href.indexOf('#');let fragment=hash>=0?documentFragment(decoded(href.slice(hash+1))):suffix.fragment;
  if(href.startsWith('#'))return {kind:'anchor',fragment:fragment!};
  let source=this.files.list(user).find(row=>row.id===args.referenceId&&row.source!=='clipboard'),fallback=false;
  if(!source&&!args.referenceId){let absolute:string|undefined;if(/^file:/i.test(href)){const url=new URL(href);if(url.hostname&&url.hostname!=='localhost')throw new Error('Use a file inside an already opened workspace folder.');url.hash='';url.search='';absolute=sourceLinkSuffix(fileURLToPath(url),false).href;}else{const raw=decoded((hash>=0?href.slice(0,hash):href).split('?')[0]);if(/^[a-z]:[\\/]/i.test(raw))absolute=sourceLinkSuffix(raw,false).href;}if(absolute){const target=path.resolve(absolute);this.files.checkPath(target);source=this.files.list(user).filter(row=>row.source!=='clipboard'&&(row.kind==='file'?same(row.path,target):inside(row.path,target))).sort((a,b)=>a.kind===b.kind?b.path.length-a.path.length:a.kind==='file'?-1:1)[0];fallback=!!source;}}
  if(!source)throw new Error('Open a workspace folder or file before following local links.');
  const tools=new WorkspaceTools(this.files),from=await tools.operationPath(user,source.id,!fallback&&typeof args.path==='string'?args.path:''),sourceStat=await lstat(from.target);
  if(!sourceStat.isFile()&&!sourceStat.isDirectory())throw new Error('This document location is unavailable.');
  let target:string;
  if(/^file:/i.test(href)){
   const url=new URL(href);if(url.hostname&&url.hostname!=='localhost')throw new Error('Use a file inside an already opened workspace folder.');url.hash='';url.search='';const decodedPath=sourceLinkSuffix(fileURLToPath(url),false);if(decodedPath.fragment){if(fragment!==undefined)throw new Error('Use either a source line suffix or a document section.');fragment=decodedPath.fragment;}target=path.resolve(decodedPath.href);
  }else{
   let raw=decoded((hash>=0?href.slice(0,hash):href).split('?')[0]);const decodedSuffix=sourceLinkSuffix(raw,false);if(decodedSuffix.fragment){if(fragment!==undefined)throw new Error('Use either a source line suffix or a document section.');raw=decodedSuffix.href;fragment=decodedSuffix.fragment;}
   if(/^[a-z][a-z\d+.-]*:/i.test(raw)&&!(/^[a-z]:[\\/]/i.test(raw)))throw new Error('This link type cannot be opened in the workspace.');
   if(/^\\\\/.test(raw)||/[\x00-\x1f\x7f<>"|?*]/.test(raw))throw new Error('Use a valid local workspace link.');
   const base=sourceStat.isDirectory()?from.target:path.dirname(from.target);
   target=raw===''?from.target:path.resolve(raw.startsWith('/')?source.kind==='folder'?source.path:path.dirname(source.path):base,raw.startsWith('/')?'.'+raw:raw);
  }
  this.files.checkPath(target);
  const covers=(reference:FileReference)=>reference.source!=='clipboard'&&(reference.kind==='file'?same(reference.path,target):inside(reference.path,target));
  const reference=covers(source)?source:this.files.list(user).filter(covers).sort((a,b)=>a.kind===b.kind?b.path.length-a.path.length:a.kind==='file'?-1:1)[0];
  if(!reference)throw new Error('This link is outside your opened files and folders. Open its folder to access it.');
  const relative=reference.kind==='file'?'':path.relative(reference.path,target).split(path.sep).join('/'),resolved=await tools.operationPath(user,reference.id,relative),stat=await lstat(resolved.target);
  if(!stat.isFile()&&!stat.isDirectory())throw new Error('This link does not point to a regular file or folder.');
  const canonical=await realpath(resolved.target),canonicalRelative=reference.kind==='file'?'':path.relative(reference.path,canonical).split(path.sep).join('/');this.retained(user,source);this.retained(user,reference);
  if(sourceFragment(fragment)&&(!stat.isFile()||!textTypes.has(path.extname(canonical).toLowerCase())))throw new Error('Source line references apply to supported text and code files.');
  return {kind:stat.isDirectory()?'folder':'file',referenceId:reference.id,path:canonicalRelative,name:path.basename(canonical),...(fragment!==undefined?{fragment}:{})};
 }
 async location(user:string,args:Record<string,unknown>){
  const location=sourceLocation(args.location),reference=this.files.list(user).find(row=>row.id===args.referenceId&&row.source!=='clipboard');if(!reference)throw new Error('Open this workspace file again before copying its reference.');
  const resolved=await new WorkspaceTools(this.files).operationPath(user,reference.id,typeof args.path==='string'?args.path:''),stat=await lstat(resolved.target);
  if(!stat.isFile()||!textTypes.has(path.extname(resolved.target).toLowerCase()))throw new Error('Source line references apply to supported text and code files.');
  const canonical=await realpath(resolved.target);this.retained(user,reference);const url=pathToFileURL(canonical);url.hash=sourceFragmentText(location);return {href:url.href};
 }
 async image(user:string,args:Record<string,unknown>){
  const link=await this.resolve(user,args);if(link.kind!=='file'||!['.png','.jpg','.jpeg','.webp'].includes(path.extname(link.name).toLowerCase()))throw new Error('Inline images must be local PNG, JPEG, or WebP files inside your opened workspace.');
  const preview=await new WorkspaceTools(this.files).view(user,{permission:'files',mode:'chat',thinking:'default',files:[link.referenceId]},{reference_id:link.referenceId,path:link.path});
  if(!('image' in preview)||typeof preview.image!=='string')throw new Error('This image could not be previewed.');
  if(!this.files.list(user).some(row=>row.id===args.referenceId)||!this.files.list(user).some(row=>row.id===link.referenceId))throw new Error('This image reference was forgotten.');
  return {image:preview.image,referenceId:link.referenceId,path:link.path,name:link.name};
 }
}
