import {currentFileHref} from './legacy-brand';
import {inlineDocumentOutputs} from './document-output-links';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {mkdir,lstat,realpath,readFile,writeFile} from 'node:fs/promises';
import {dialog,shell} from 'electron';
import type {SupabaseClient} from '@supabase/supabase-js';
import {WorkspaceDocumentLinks} from './workspace-links';
import {WorkspaceTools} from './workspace-tools';
import {safeName,type WorkspaceFiles} from './workspace';
import {nativeOutputDirectory,nativeWorkspaceScope} from './native-output-path';
import {sourceLinkSuffix} from './source-locations';
import type {RestoredPublicFiles} from './restored-public-files';
export type RecoveredChatLink={args:Record<string,unknown>;check:()=>Promise<void>};

const inside=(root:string,target:string)=>{const rel=path.relative(root,target);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const must=(value:any)=>{if(value.error)throw Error(value.error.message);return value.data;};
/** User-clicked chat outputs are exported separately from private native state. */
export class ChatFiles{
 constructor(private db:SupabaseClient,private files:WorkspaceFiles,private nativeDirectory:string,readonly outputDirectory=nativeOutputDirectory(nativeDirectory),private desktop={dialog,shell},private legacyDirectory?:string|readonly string[],private recovered?:Pick<RestoredPublicFiles,'translate'>,private recoveredLink?:(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>)=>Promise<RecoveredChatLink|undefined>){}
 private async offered(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>){
  if(typeof args.href!=='string'||typeof args.conversationId!=='string'||! /^[a-f0-9-]{36}$/i.test(args.conversationId))return false;
  const href=currentFileHref(args.href.trim());if(!href||href.length>4000||/[\x00-\x1f\x7f]/.test(href))return false;
  const chat=must(await this.db.from('conversation_sessions').select('conversation_id').eq('conversation_id',args.conversationId).eq('user_id',owner).maybeSingle());if(!chat)throw Error('This chat is unavailable for your account.');
  let decodedHref=href;try{decodedHref=decodeURIComponent(href);}catch{}
  // Continue from the last saved message rather than shifting offsets as new
  // replies arrive. Include the ID so equal sequence values cannot hide a link.
  let cursor:{sequence:string;id:string}|undefined;
  for(;;){
   await guard();
   let query=this.db.from('chat_messages_v2').select('content,desktop_sequence,id').eq('conversation_id',args.conversationId).eq('role','assistant').order('desktop_sequence',{ascending:false}).order('id',{ascending:false}).limit(200);
   if(cursor)query=query.or(`desktop_sequence.lt.${cursor.sequence},and(desktop_sequence.eq.${cursor.sequence},id.lt.${cursor.id})`);
   const rows=must(await query);await guard();
   if(rows.some((row:any)=>{const content=typeof row.content==='string'?row.content:row.content?.text??'';return typeof content==='string'&&([href,decodedHref,href.replaceAll(' ','%20')].some(value=>content.includes(']('+value+')')||content.includes('](<'+value+'>)'))||inlineDocumentOutputs(content).some(value=>[href,decodedHref].includes(currentFileHref(value))));}))return true;
   if(rows.length<200)return false;
   const last=rows.at(-1),sequence=String(last.desktop_sequence),id=String(last.id);
   if(!/^\d+$/.test(sequence)||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||cursor&&cursor.sequence===sequence&&cursor.id===id)throw Error('The saved chat message order is unavailable. Try opening this file again.');
   cursor={sequence,id};
  }
 }
 private async regular(root:string,target:string){
  if(!inside(root,target))throw Error('This output is outside its agent workspace.');
  const relative=path.relative(root,target);if(relative.split(path.sep).some(part=>!safeName(part)))throw Error('Private and credential files cannot be opened from chat.');
  if(!same(await realpath(root),root)||(await lstat(root)).isSymbolicLink())throw Error('The output workspace changed.');
  let current=root;for(const part of relative.split(path.sep)){current=path.join(current,part);const info=await lstat(current);if(info.isSymbolicLink()||info.isFile()&&info.nlink>1||!same(await realpath(current),current))throw Error('Linked output paths cannot be opened.');}
  const info=await lstat(target);if(!info.isFile()||info.size>20*1024*1024)throw Error('Choose an output file smaller than 20 MB.');
  return info;
 }
 private async retainedCopy(owner:string,folder:string,name:string,sourceHash:string,current:string,guard:()=>Promise<void>){
  // Only owned registrations in sibling application export roots can follow a
  // relocated private profile. Matching names elsewhere grant no authority.
  if(!/^[a-f0-9]{12}$/i.test(path.basename(this.outputDirectory)))return;
  const family=path.dirname(this.outputDirectory),registered=this.files.list(owner).filter(reference=>{
   if(reference.kind!=='file'||reference.source==='clipboard')return false;
   const parts=path.relative(family,path.resolve(reference.path)).split(path.sep);
   return parts.length===4&&/^[a-f0-9]{12}$/i.test(parts[0])&&same(parts[1],owner)&&same(parts[2],folder)&&same(parts[3],name);
  });
  if(!registered.some(reference=>!same(reference.path,current)))return;
  if(registered.length>32)throw Error('Several saved copies match this link. Open the copy you want from the workspace.');
  const copies:{path:string;referenceId?:string;hash:string}[]=[],candidates=[...registered.map(reference=>({path:reference.path,referenceId:reference.id})),{path:current,referenceId:undefined}];
  for(const candidate of candidates){
   if(copies.some(copy=>same(copy.path,candidate.path)))continue;
   const root=path.join(family,path.relative(family,candidate.path).split(path.sep)[0]);
   try{
    await guard();const before=await this.regular(root,candidate.path),bytes=await readFile(candidate.path),after=await this.regular(root,candidate.path);await guard();
    if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('The saved copy changed while opening it. Try again after writing finishes.');
    if(candidate.referenceId&&!this.files.list(owner).some(reference=>reference.id===candidate.referenceId&&same(reference.path,candidate.path)))continue;
    copies.push({...candidate,hash:createHash('sha256').update(bytes).digest('hex')});
   }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  const edited=copies.filter(copy=>copy.hash!==sourceHash),versions=new Set(edited.map(copy=>copy.hash));
  if(versions.size>1)throw Error('Several saved copies contain different edits. Open the copy you want from the workspace.');
  const preferred=edited.length?edited:copies;return preferred.find(copy=>same(copy.path,current))??preferred[0];
 }
 async resolve(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>){
  const links=new WorkspaceDocumentLinks(this.files);
  // A user-clicked archived link follows only a completed, still-owned restored
  // copy. This viewer translation never rebinds the old model/tool file scope.
  await guard();const recovered=await this.recoveredLink?.(owner,args,guard);
  // The translated path has a current owned folder grant. Ordinary viewer
  // authority supports internal links and older saved links without searching
  // chat messages. Private scratch exports below still require an offered link.
  if(recovered){await guard();await recovered.check();const resolved=await links.resolve(owner,recovered.args);await recovered.check();await guard();return resolved;}
  await guard();try{const resolved=await links.resolve(owner,args);await guard();return resolved;}catch(original){
   if(typeof args.href!=='string'||typeof args.conversationId!=='string'||! /^[a-f0-9-]{36}$/i.test(args.conversationId))throw original;
   const href=currentFileHref(args.href.trim());if(!href||href.length>4000||/[\x00-\x1f\x7f]/.test(href))throw original;
   // Only an actual link offered in this account's saved conversation may export private scratch output.
   if(!await this.offered(owner,args,guard))throw original;
   const suffix=sourceLinkSuffix(href.replace(/^sandbox:/i,'')),fragmentIndex=suffix.href.indexOf('#'),fragment=fragmentIndex>=0?suffix.href.slice(fragmentIndex):suffix.fragment?'#'+suffix.fragment:'';
   let raw:string;try{const value=fragmentIndex>=0?suffix.href.slice(0,fragmentIndex):suffix.href;if(/^file:/i.test(value)){const url=new URL(value);if(url.hostname&&url.hostname!=='localhost')throw original;raw=fileURLToPath(url);}else raw=decodeURIComponent(value);}catch{throw original;}
   raw=this.recovered?.translate(owner,raw)??raw;
   const logicalScratch=path.join(this.nativeDirectory,'workspaces',owner);
   // Windows may expose this trusted profile through its physical package-cache path.
   // Canonicalize only the configured account root; descendants still reject links.
   const scratch=await realpath(logicalScratch).catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return logicalScratch;throw error;});let source:string|undefined;
   // A verified profile copy can retain assistant links to its former workspace.
   // Translate only this owner's workspace suffix, then apply the current chat's
   // branch and file checks below. Never read from the former private directory.
   for(const legacyDirectory of typeof this.legacyDirectory==='string'?[this.legacyDirectory]:this.legacyDirectory??[]){
    if(!path.isAbsolute(raw))break;
    const absolute=path.resolve(raw),legacyScratch=path.join(legacyDirectory,'workspaces',owner);
    if(inside(legacyScratch,absolute))raw=path.join(scratch,path.relative(legacyScratch,absolute));
    else{
     const home=path.dirname(path.dirname(path.dirname(legacyDirectory))),parts=path.relative(home,absolute).split(path.sep);
     if(parts.length>=11&&parts[0].toLowerCase()==='appdata'&&parts[1].toLowerCase()==='local'&&parts[2].toLowerCase()==='packages'&&/^[a-z0-9_.-]+$/i.test(parts[3])&&parts[4].toLowerCase()==='localcache'&&parts[5].toLowerCase()==='roaming'&&parts[6].toLowerCase()==='sylvana'&&parts[7].toLowerCase()==='workspaces'&&same(parts[8],owner))raw=path.join(scratch,...parts.slice(9));
    }
   }
   if(path.isAbsolute(raw)&&inside(logicalScratch,path.resolve(raw)))raw=path.join(scratch,path.relative(logicalScratch,path.resolve(raw)));
   if(path.isAbsolute(raw)&&inside(this.outputDirectory,path.resolve(raw))&&!inside(path.join(this.outputDirectory,owner),path.resolve(raw)))throw Error('This output belongs to another account.');
   const branches=must(await this.db.from('desktop_codex_threads').select('scope').eq('conversation_id',args.conversationId).eq('user_id',owner));
   const scopes=branches.map((row:any)=>row.scope).filter((scope:unknown):scope is string=>typeof scope==='string'&&/^[a-f0-9]{16,64}$/.test(scope)).map((scope:string)=>nativeWorkspaceScope(args.conversationId as string,scope));
   if(path.isAbsolute(raw)&&inside(scratch,path.resolve(raw))){source=path.resolve(raw);if(!scopes.some((scope:string)=>inside(path.join(scratch,scope),source!)))throw Error('This output belongs to another chat workspace.');await this.regular(scratch,source);}
   else if(/^sandbox:/i.test(href)){
    const relative=raw.replace(/^\/mnt\/data\//,'').replace(/^\//,'');if(!relative||relative.split(/[\\/]/).some(part=>!safeName(part)||part==='..'))throw original;
    if(scopes.length>512)throw Error('Use the generated file’s full Windows path to open this output.');
    const matches:string[]=[];for(const scope of scopes){for(const root of [scratch,path.join(this.outputDirectory,owner)]){const candidate=path.join(root,scope,relative);try{await this.regular(root,candidate);matches.push(candidate);}catch{}}}
    if(matches.length!==1)throw Error(matches.length?'Several outputs have this name. Ask the agent for the full file link.':'This output is missing. Ask the agent to recreate it in its workspace and provide its full file link.');source=matches[0];
   }else if(path.isAbsolute(raw)){
    this.files.checkPath(raw);await guard();const selection=await this.files.attach(owner,[{path:raw}],guard);return links.resolve(owner,{href:'sylvana-file://'+selection.selected[0]+'/'+fragment});
   }
   if(!source)throw original;
   const sourceRoot=inside(scratch,source)?scratch:path.join(this.outputDirectory,owner),before=await this.regular(sourceRoot,source),bytes=await readFile(source);await guard();const after=await this.regular(sourceRoot,source);if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('The output changed while opening it. Try again after the agent finishes writing.');
   const hash=createHash('sha256').update(bytes).digest('hex'),canonicalSource=await realpath(source),relativeSource=path.relative(await realpath(sourceRoot),canonicalSource);
   if(!relativeSource||relativeSource==='..'||relativeSource.startsWith('..'+path.sep)||path.isAbsolute(relativeSource))throw Error('This output left its owned workspace.');
   // An editable copy belongs to this chat, source path and source version.
   // Equal contents in other chats/files must never share later user edits.
   const sourceIdentity=relativeSource.replaceAll(path.sep,'/'),key=createHash('sha256').update(JSON.stringify([args.conversationId.toLowerCase(),inside(scratch,source)?'scratch':'output',process.platform==='win32'?sourceIdentity.toLowerCase():sourceIdentity,hash])).digest('hex').slice(0,32),destination=path.join(this.outputDirectory,owner,'export-'+key,path.basename(source));
   const retained=await this.retainedCopy(owner,'export-'+key,path.basename(source),hash,destination,guard);
   if(retained){const copyGuard=async()=>{await guard();if(retained.referenceId&&!this.files.list(owner).some(reference=>reference.id===retained.referenceId&&same(reference.path,retained.path)))throw Error('This saved copy reference was removed. Select it again before opening it.');};await copyGuard();const selection=await this.files.attach(owner,[{path:retained.path}],copyGuard);return links.resolve(owner,{href:'sylvana-file://'+selection.selected[0]+'/'+fragment});}
   let existing=false;try{await this.regular(this.outputDirectory,destination);existing=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   if(!existing){
    let initialBytes=bytes;
    // Preserve a registered legacy copy, including edits made before copies
    // were scoped to chats. Later opens use the independent copy directly.
    const legacy=path.join(this.outputDirectory,owner,hash.slice(0,16),path.basename(source));
    if(this.files.list(owner).some(reference=>reference.kind==='file'&&same(reference.path,legacy))){
     try{const beforeLegacy=await this.regular(this.outputDirectory,legacy),saved=await readFile(legacy),afterLegacy=await this.regular(this.outputDirectory,legacy);if(beforeLegacy.ino!==afterLegacy.ino||beforeLegacy.size!==afterLegacy.size||beforeLegacy.mtimeMs!==afterLegacy.mtimeMs)throw Error('The edited output changed while opening it. Try again after writing finishes.');initialBytes=saved;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
    await guard();this.files.checkPath(destination);await mkdir(path.dirname(destination),{recursive:true});await this.regularDirectory(path.dirname(destination));
    try{await writeFile(destination,initialBytes,{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await this.regular(this.outputDirectory,destination);}
   }
   await guard();const selection=await this.files.attach(owner,[{path:destination}],guard);return links.resolve(owner,{href:'sylvana-file://'+selection.selected[0]+'/'+fragment});
  }
 }
 private async regularDirectory(directory:string){let current=path.parse(directory).root;for(const part of directory.slice(current.length).split(path.sep)){current=path.join(current,part);const info=await lstat(current);if(info.isSymbolicLink()||!info.isDirectory()||!same(await realpath(current),current))throw Error('The export directory contains a linked path.');}}
 async googleInput(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>,signal:AbortSignal){
  await guard();const link=await this.resolve(owner,args,guard);if(link.kind!=='file'||!/\.(docx|xlsx|pptx)$/i.test(link.name))throw Error('Google opening supports Word, Excel and PowerPoint files.');
  const input=await new WorkspaceTools(this.files).browserInput(owner,{permission:'full',mode:'chat',thinking:'default',files:[link.referenceId]},{reference_id:link.referenceId,path:link.path},signal);
  await guard();await input.check();const relative=link.path.replaceAll('\\','/');return {referenceId:link.referenceId,relative:process.platform==='win32'?relative.toLowerCase():relative,name:input.name,bytes:input.bytes,check:async()=>{await guard();await input.check();}};
 }
 async action(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>){
  const action=args.action;if(!['download','open','reveal','google'].includes(String(action)))throw Error('Choose a file action.');
  const link=await this.resolve(owner,args,guard);if(link.kind!=='file')throw Error('Choose a local file for this action.');
  const resolved=await new WorkspaceTools(this.files).operationPath(owner,link.referenceId,link.path);await guard();
  if(action==='reveal'){this.desktop.shell.showItemInFolder(resolved.target);return {revealed:true};}
  if(action==='google')throw Error('Use the connected Google document opening action.');
  if(action==='open'){if(/\.(exe|com|bat|cmd|ps1|sh|js|mjs|cjs|py|pyw|rb|pl|ts|tsx|jsx|msi|lnk|url|reg|scr|vbs|hta)$/i.test(link.name))throw Error('Open executable code in the workspace editor.');const error=await this.desktop.shell.openPath(resolved.target);if(error)throw Error(error);return {opened:true};}
  const result=await this.desktop.dialog.showSaveDialog({title:'Save a copy',defaultPath:link.name});if(result.canceled||!result.filePath)return {cancelled:true};
  this.files.checkPath(result.filePath);if(path.extname(result.filePath).toLowerCase()!==path.extname(link.name).toLowerCase())throw Error('Keep the original file extension when saving this copy.');await guard();const source=await new WorkspaceTools(this.files).operationPath(owner,link.referenceId,link.path);const bytes=await readFile(source.target);await this.regularDirectory(path.dirname(result.filePath));try{const info=await lstat(result.filePath);if(!info.isFile()||info.isSymbolicLink()||info.nlink>1||!same(await realpath(result.filePath),result.filePath))throw Error('Linked save destinations cannot be overwritten.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}await guard();await writeFile(result.filePath,bytes);return {saved:true};
 }
}
