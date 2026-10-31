import path from 'node:path';
import {shell} from 'electron';
import {randomUUID,createHash} from 'node:crypto';
import {lstat,realpath,mkdir,rmdir} from 'node:fs/promises';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {WorkspaceFiles} from './workspace';
import type {WorkspaceTools} from './workspace-tools';
import type {WorkspaceEditor} from './workspace-editor';
import type {ChatOptions,ChatEvent} from './contracts';
import type {FileAction,FileOperation,FileOperationPreview,FileOperationView,FileOperationResult,FileSnapshot,FileOperationPage,FileOperationCursor} from './file-operation-contracts';
import {fileIdentity,insidePath,sameFilePath,snapshotFiles} from './file-snapshot';
import {prepareFileMove} from './file-move';
import {mutateWorkspace} from './workspace-mutations';

const data=(value:any):any=>{if(value.error)throw new Error(value.error.message);return value.data;};
const slash=(value:string)=>value.split(path.sep).join('/');
const optionalStat=async(file:string)=>{try{return await lstat(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}};
const exactExists=async(file:string)=>{if(!await optionalStat(file))return false;return await realpath(file)===file;};
const validPath=(value:unknown)=>{if(typeof value!=='string'||!value||value.length>500||/[<>:"|?*\x00-\x1f]/.test(value))throw new Error('Choose a relative workspace path using valid Windows names.');return value;};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class FileOperations{
 private active=new Set<{owner:string;controller:AbortController;done:Promise<unknown>}>();
 constructor(private db:SupabaseClient,private files:WorkspaceFiles,private tools:WorkspaceTools,private editor:WorkspaceEditor,private script:string,private emit:(owner:string,event:ChatEvent)=>void,private explorer:{showItemInFolder:(file:string)=>void}=shell){}
 private run<T>(owner:string,signal:AbortSignal|undefined,guard:()=>Promise<void>,task:(signal:AbortSignal,check:()=>Promise<void>)=>Promise<T>){
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const check=async()=>{controller.signal.throwIfAborted();await guard();controller.signal.throwIfAborted();};
  const done=Promise.resolve().then(async()=>{await check();return task(controller.signal,check);}),entry={owner,controller,done};this.active.add(entry);
  return done.finally(()=>{this.active.delete(entry);signal?.removeEventListener('abort',abort);});
 }
 async stopOwner(owner:string){this.cancelOwner(owner);await Promise.allSettled([...this.active].filter(entry=>entry.owner===owner).map(entry=>entry.done));}
 cancelOwner(owner:string){for(const entry of this.active)if(entry.owner===owner)entry.controller.abort();}
 async close(){for(const entry of this.active)entry.controller.abort();await Promise.allSettled([...this.active].map(entry=>entry.done));}
 async recoverOwner(owner:string,guard:()=>Promise<void>){return this.run(owner,AbortSignal.timeout(20000),guard,async(signal,check)=>{let after='';for(;;){const query=this.db.from('desktop_file_operations').select('*').eq('user_id',owner).eq('status','interrupted').order('id').limit(100);const rows=data(await (after?query.gt('id',after):query)) as FileOperation[];for(const row of rows){await check();await this.reconcile(row,signal);}if(rows.length<100)break;after=rows.at(-1)!.id;}});}
 async recover(){data(await this.db.from('desktop_file_operations').update({status:'interrupted',error:'Sylvana restarted. Inspect the saved operation; it will not run again automatically.',updated_at:new Date().toISOString()}).in('status',['prepared','applying','restoring']));}
 private snapshot(file:string,signal:AbortSignal,privateRoot?:string){return snapshotFiles(this.files,file,signal,privateRoot,target=>this.tools.guardManagedPath(target));}
 private async query<T>(request:PromiseLike<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve(request),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error('The local database did not acknowledge this file operation within 10 seconds. Inspect its saved journal before retrying.')),10000);timer.unref();})]);}finally{clearTimeout(timer);}}
 private load(owner:string,id:string):Promise<FileOperation>{return this.query(this.db.from('desktop_file_operations').select('*').eq('id',id).eq('user_id',owner).single()).then(data) as Promise<FileOperation>;}
 private async patch(row:FileOperation,values:Partial<FileOperation>){data(await this.query(this.db.from('desktop_file_operations').update({...values,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',row.user_id)));Object.assign(row,values);return row;}
 view(row:FileOperation):FileOperationView{const p=row.preview,s=p.snapshot;return {id:row.id,source:row.source,action:row.action,status:row.status,phase:row.phase,workspaceName:path.basename(p.root),kind:s?.nodes[0]?.kind??'folder',referenceId:this.files.list(row.user_id).find(ref=>ref.kind==='folder'&&sameFilePath(ref.path,p.root))?.id??p.referenceId,path:p.path,destination:p.destination,reason:p.reason,files:s?.files??0,folders:s?.folders??1,bytes:s?.bytes??0,sample:s?.nodes.slice(0,20).map(node=>node.path||p.path)??[],fingerprint:s?.fingerprint??null,error:row.error,createdAt:row.created_at,result:row.result};}
 private async finish(row:FileOperation,result:FileOperationResult,restored=false){
  const p=row.preview,reference=this.files.list(row.user_id).find(ref=>ref.kind==='folder'&&sameFilePath(ref.path,p.root));
  const change={referenceId:reference?.id??p.referenceId,from:restored&&row.action==='move'?p.target:p.source,...(row.action==='move'?{to:restored?p.source:p.target}:{}),action:row.action==='move'?'move':row.action==='remove'?(restored?'create':'remove'):(restored?'remove':'create')};
  const revision=Number(data(await this.query(this.db.rpc('desktop_finish_file_operation',{p_user:row.user_id,p_id:row.id,p_status:restored?'restored':'completed',p_preview:p,p_result:result,p_change:change}))));
  if(!Number.isSafeInteger(revision)||revision<=0)throw new Error('Invalid file operation revision.');
  Object.assign(row,{status:restored?'restored':'completed',result,error:null,change_revision:revision});
  await this.pushTool(row).catch(()=>{});
  try{this.emit(row.user_id,{kind:'workspace-operation',requestId:'',ownerId:row.user_id,fileOperation:this.view(row),workspaceChange:{...change,action:change.action as 'move'|'remove'|'create',revision}});}catch{}
 }
 private assertGrant(owner:string,preview:FileOperationPreview,renewed=false){if(!this.files.list(owner).some(ref=>ref.kind==='folder'&&sameFilePath(ref.path,preview.root)&&(renewed||ref.id===preview.referenceId)))throw new Error('This workspace grant was forgotten. Add the folder again and prepare a fresh review.');}
 private async root(owner:string,preview:FileOperationPreview){
  const reference=this.files.list(owner).find(ref=>ref.kind==='folder'&&sameFilePath(ref.path,preview.root));if(!reference)throw new Error('Add the original workspace folder again before inspecting or restoring this operation.');
  const resolved=await this.tools.operationPath(owner,reference.id,'');if(!sameFilePath(resolved.target,preview.root)||fileIdentity(await lstat(resolved.target))!==preview.rootIdentity)throw new Error('The original workspace folder was moved or replaced. Inspect the saved operation before continuing.');return reference;
 }
 private references(owner:string,root:string,item:string){if(this.files.list(owner).some(ref=>ref.source!=='clipboard'&&!sameFilePath(ref.path,root)&&insidePath(item,ref.path)))throw new Error('This item has a separate file or folder reference. Forget that reference before moving or removing the item; its original file will stay on disk.');}
 async inspect(owner:string,referenceId:string,relativePath:string,guard:()=>Promise<void>,signal?:AbortSignal){return this.run(owner,signal,guard,async(signal,check)=>{validPath(relativePath);const {reference,target}=await this.tools.operationPath(owner,referenceId,relativePath);if(reference.kind!=='folder'||sameFilePath(target,reference.path))throw new Error('Choose an item inside a workspace folder.');const snapshot=await this.snapshot(await realpath(target),signal);await check();return {path:relativePath,kind:snapshot.nodes[0]?.kind,fingerprint:snapshot.fingerprint,files:snapshot.files,folders:snapshot.folders,bytes:snapshot.bytes,items:snapshot.nodes.slice(0,100).map(node=>({path:node.path,kind:node.kind})),truncated:snapshot.nodes.length>100,untrusted:true};});}
 async prepare(owner:string,args:Record<string,unknown>,guard:()=>Promise<void>,context:{signal?:AbortSignal;requestId?:string;toolId?:string;options?:ChatOptions}={}):Promise<FileOperation>{return this.run(owner,context.signal,guard,async(signal,check)=>{
  if(!['move','remove','create_folder'].includes(String(args.action)))throw new Error('Choose move, remove, or create_folder.');const action=args.action as FileAction,relativePath=validPath(args.path),destination=action==='move'?validPath(args.destination):'';
  if(typeof args.reference_id!=='string'||typeof args.reason!=='string'||!args.reason.trim()||args.reason.length>2000)throw new Error('A workspace change needs a folder reference and a reason.');
  if(context.options&&(!['ask','full'].includes(context.options.permission)||context.options.mode==='plan'||!context.options.files.includes(args.reference_id)))throw new Error('Workspace changes require selected files, approval permissions, and Plan mode off.');
  const key=hash([action,args.reference_id,relativePath,destination,args.expected_hash??null]);
  if(context.requestId){data(await this.db.from('desktop_requests').select('id').eq('id',context.requestId).eq('user_id',owner).single());if(context.toolId)data(await this.db.from('desktop_tool_calls').select('id').eq('id',context.toolId).eq('request_id',context.requestId).eq('user_id',owner).single());const existing=data(await this.db.from('desktop_file_operations').select('*').eq('user_id',owner).eq('request_id',context.requestId).eq('dedup_key',key).maybeSingle());if(existing)return existing;}
  const {reference,target}=await this.tools.operationPath(owner,args.reference_id,relativePath,action==='create_folder');if(reference.kind!=='folder'||sameFilePath(reference.path,target))throw new Error('The workspace root cannot be moved or removed.');
  const root=reference.path,rootIdentity=fileIdentity(await lstat(root));let source=target,dest=target,snapshot:FileSnapshot|null=null;
  if(action==='create_folder'){if(context.options?args.expected_hash!==null:args.expected_hash!==undefined&&args.expected_hash!==null)throw new Error('A new folder needs a null expected hash.');if(await optionalStat(target))throw new Error('That file or folder already exists. Choose another name.');}
  else{source=await realpath(target);this.references(owner,root,source);snapshot=await this.snapshot(source,signal);if(context.options&&args.expected_hash!==snapshot.fingerprint)throw new Error('Inspect the item first and supply its current fingerprint before proposing this change.');}
  if(action==='move'){
   dest=(await this.tools.operationPath(owner,reference.id,destination,true)).target;const parent=await realpath(path.dirname(dest));dest=path.join(parent,path.basename(dest));
   if(source===dest||snapshot!.nodes[0].kind==='folder'&&insidePath(source,dest))throw new Error('Choose a different destination outside this item.');
   const existing=await optionalStat(dest);if(existing&&!sameFilePath(source,dest))throw new Error('The destination already exists. Choose another name; existing items are preserved.');
   if((await lstat(source)).dev!==(await lstat(parent)).dev)throw new Error('Move items within the same filesystem volume.');
  }
  if(action==='remove')dest='';
  const parentIdentity=fileIdentity(await lstat(path.dirname(action==='move'?dest:source)));await check();
  const preview:FileOperationPreview={root,rootIdentity,referenceId:reference.id,path:slash(path.relative(root,source)),destination:action==='move'?slash(path.relative(root,dest)):'',source,target:dest,parentIdentity,snapshot,reason:args.reason.trim()};
  return data(await this.db.from('desktop_file_operations').insert({id:randomUUID(),user_id:owner,request_id:context.requestId??null,tool_id:context.toolId??null,source:context.requestId?'agent':'user',action,status:'prepared',phase:'apply',dedup_key:key,preview}).select('*').single());
 });}
 private async recoveryPath(row:FileOperation,create=false){
  const {root}=row.preview;await this.root(row.user_id,row.preview);let current=root;
  for(const segment of ['.sylvana-recovery',row.user_id,row.id]){
   current=path.join(current,segment);const existing=await optionalStat(current);
   if(!existing&&create)await mkdir(current,{mode:0o700});else if(!existing)throw new Error('The recovery folder is missing. Inspect the original workspace in Windows.');else if(create&&segment===row.id)throw new Error('This recovery slot already exists. Review the saved operation before retrying.');
   const stat=await lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink()||!sameFilePath(await realpath(current),current))throw new Error('A recovery folder was replaced or linked. Inspect it in Windows.');
  }
  return path.join(current,'item');
 }
 private async currentSnapshot(row:FileOperation,signal:AbortSignal,restoring=false){
  const p=row.preview,reference=await this.root(row.user_id,p),relative=restoring&&row.action==='move'?p.destination:p.path;
  if(restoring&&row.action==='remove'){const target=await this.recoveryPath(row);return {target,snapshot:await this.snapshot(target,signal,path.dirname(target))};}
  const resolved=await this.tools.operationPath(row.user_id,reference.id,relative,row.action==='create_folder'&&!restoring);return {target:resolved.target,snapshot:row.action==='create_folder'&&!restoring?null:await this.snapshot(resolved.target,signal)};
 }
 async interrupt(owner:string,id:string){const row=await this.load(owner,id);if(row.status==='prepared')await this.patch(row,{status:'interrupted',error:'The request ended before this change was applied. Prepare a fresh review to continue.'});}
 async deny(owner:string,id:string){const row=await this.load(owner,id);if(row.status!=='prepared')return this.view(row);await this.patch(row,{status:'denied',error:null});return this.view(row);}
 async apply(owner:string,id:string,guard:()=>Promise<void>,signal?:AbortSignal):Promise<FileOperationResult>{return this.run(owner,signal,guard,async(signal,check)=>{
  const initial=await this.load(owner,id);if(initial.status==='completed'&&initial.result)return initial.result;return this.editor.fileOperation(owner,[initial.preview.source,initial.action==='move'?initial.preview.target:initial.preview.source],()=>mutateWorkspace(async()=>{
   const row=await this.load(owner,id);if(row.status==='completed'&&row.result)return row.result;if(row.status!=='prepared')throw new Error('This operation is no longer awaiting review. Inspect it and prepare a fresh change.');
   let helper:Awaited<ReturnType<typeof prepareFileMove>>|undefined,began=false;
   try{
    await check();const p=row.preview;await this.root(owner,p);this.references(owner,p.root,p.source);
    const parent=path.dirname(row.action==='move'?p.target:p.source);if(fileIdentity(await lstat(parent))!==p.parentIdentity)throw new Error('The destination folder changed after review. Prepare a new change.');
    if(row.action!=='create_folder')helper=await prepareFileMove(this.script,signal);
    if(row.action==='remove')p.target=await this.recoveryPath(row,true);
    await this.patch(row,{status:'applying',preview:p,error:null});began=true;
    await check();const current=await this.currentSnapshot(row,signal);if(row.action==='create_folder'){if(await optionalStat(current.target))throw new Error('The destination already exists. Nothing was replaced.');}
    else if(current.snapshot!.fingerprint!==p.snapshot!.fingerprint)throw new Error('The item changed after review. Prepare a fresh change.');
    if(row.action==='move'){const reference=await this.root(owner,p);const resolved=await this.tools.operationPath(owner,reference.id,p.destination,true);if(!sameFilePath(resolved.target,p.target)||fileIdentity(await lstat(path.dirname(p.target)))!==p.parentIdentity)throw new Error('The destination changed after review.');if(await optionalStat(p.target)&&!sameFilePath(p.source,p.target))throw new Error('The destination already exists. Nothing was replaced.');}
    if(row.action==='remove'&&await this.recoveryPath(row)!==p.target)throw new Error('The recovery destination changed.');
    if(row.action!=='remove'&&fileIdentity(await lstat(parent))!==p.parentIdentity)throw new Error('The destination folder changed after review.');
    await check();this.assertGrant(owner,p);signal.throwIfAborted();if(row.action==='create_folder')await mkdir(p.source,{mode:0o700});else await helper!.commit(p.source,p.target);
    const afterPath=row.action==='create_folder'?p.source:p.target;let warning:string|undefined;
    try{p.after=await this.snapshot(afterPath,new AbortController().signal,row.action==='remove'?path.dirname(p.target):undefined);}catch{warning='The operation finished, but the item changed before its final inventory was saved. Inspect it before restoring.';}
    const result:FileOperationResult={operation_id:row.id,action:row.action,path:p.path,absolute_path:p.source,...(row.action==='move'?{destination_absolute_path:p.target}:{}),kind:p.snapshot?.nodes[0]?.kind??'folder',...(row.action==='move'?{destination:p.destination}:{}),changed:true,...(row.action==='remove'?{removed:true}:{}),...(warning?{warning}:{})};
    await this.finish(row,result);return result;
   }catch(error){await this.patch(row,{status:began?'interrupted':'failed',error:(error as Error).message}).catch(()=>{});throw error;}
   finally{await helper?.close();}
  }));
 });}
 async restore(owner:string,id:string,guard:()=>Promise<void>,signal?:AbortSignal):Promise<FileOperationResult>{return this.run(owner,signal,guard,async(signal,check)=>{
  const initial=await this.load(owner,id);if(initial.status==='restored'&&initial.result)return initial.result;if(initial.request_id){const request=data(await this.db.from('desktop_requests').select('status').eq('id',initial.request_id).eq('user_id',owner).single());if(request.status==='running')throw new Error('Wait for this response to finish before undoing its workspace changes.');}return this.editor.fileOperation(owner,[initial.preview.source,initial.preview.target||initial.preview.source],()=>mutateWorkspace(async()=>{
   const row=await this.reconcile(await this.load(owner,id),signal);if(row.status==='restored'&&row.result)return row.result;if(row.status!=='completed')throw new Error('Inspect this operation before restoring it.');let helper:Awaited<ReturnType<typeof prepareFileMove>>|undefined,began=false;
   try{
    await check();const p=row.preview;await this.root(owner,p);this.references(owner,p.root,row.action==='move'?p.target:p.source);const before=await this.currentSnapshot(row,signal,true),expected=p.after??p.snapshot;if(await realpath(before.target)!==before.target)throw new Error('The item path changed after this operation. Inspect it before restoring.');
    if(!expected||before.snapshot?.contentHash!==expected.contentHash||before.snapshot.nodes[0].identity!==expected.nodes[0].identity)throw new Error('The item changed after this operation. Restore was stopped to preserve its current contents.');
    if(row.action==='create_folder'){if(before.snapshot.nodes.length!==1)throw new Error('This folder contains files. Move them before undoing its creation.');}
    else{const reference=await this.root(owner,p),original=await this.tools.operationPath(owner,reference.id,p.path,true);if(!sameFilePath(original.target,p.source))throw new Error('The original path changed.');if(await optionalStat(p.source)&&!sameFilePath(before.target,p.source))throw new Error('The original path is occupied. Restore preserves existing files.');helper=await prepareFileMove(this.script,signal);}
    await this.patch(row,{status:'restoring',phase:'restore',error:null});began=true;await check();const latest=await this.currentSnapshot(row,signal,true);if(latest.snapshot!.fingerprint!==before.snapshot!.fingerprint)throw new Error('The item changed during restore review. Inspect it again.');
    await check();const reference=await this.root(owner,p);await this.tools.operationPath(owner,reference.id,p.path,row.action!=='create_folder');
    this.assertGrant(owner,p,true);if(row.action==='create_folder')await rmdir(latest.target);else await helper!.commit(latest.target,p.source);
    const result:FileOperationResult={operation_id:row.id,action:row.action,path:p.path,absolute_path:p.source,...(row.action==='move'?{destination_absolute_path:p.target}:{}),kind:p.snapshot?.nodes[0]?.kind??'folder',...(row.action==='move'?{destination:p.destination}:{}),changed:true,restored:true};await this.finish(row,result,true);return result;
   }catch(error){if(began)await this.patch(row,{status:'interrupted',error:(error as Error).message}).catch(()=>{});throw error;}finally{await helper?.close();}
  }));
 });}
 private async pushTool(row:FileOperation){
  if(!row.tool_id)return;let tool;
  if(row.result&&(row.status==='completed'||row.status==='restored'))tool=data(await this.db.from('desktop_tool_calls').update({status:row.status==='restored'?'reverted':'completed',result:row.result,error:null,updated_at:new Date().toISOString()}).eq('id',row.tool_id).eq('user_id',row.user_id).eq('name','manage_file').in('status',row.status==='restored'?['running','interrupted','failed','completed']:['running','interrupted','failed']).select('*').maybeSingle());
  if(!tool)tool=data(await this.db.from('desktop_tool_calls').select('*').eq('id',row.tool_id).eq('user_id',row.user_id).maybeSingle());if(tool)try{this.emit(row.user_id,{kind:'tool',requestId:tool.request_id,conversationId:tool.conversation_id,tool});}catch{}
 }
 async receipt(owner:string,id:string){const row=await this.load(owner,id);if(row.status==='interrupted'&&row.result){const recorded=data(await this.db.from('desktop_file_events').select('revision').eq('operation_id',id).eq('user_id',owner).eq('phase',row.phase).maybeSingle());if(recorded)await this.patch(row,{status:row.phase==='restore'?'restored':'completed',error:null});}return row.status==='completed'||row.status==='restored'?row:null;}
 private async reconcile(row:FileOperation,signal:AbortSignal){
  if(row.status!=='interrupted')return row;const p=row.preview;
  try{
   const recorded=data(await this.db.from('desktop_file_events').select('revision,change').eq('operation_id',row.id).eq('user_id',row.user_id).eq('phase',row.phase).maybeSingle());
   if(recorded&&row.result){await this.patch(row,{status:row.phase==='restore'?'restored':'completed',result:{...row.result,observed_after_restart:true},error:null});await this.pushTool(row).catch(()=>{});try{this.emit(row.user_id,{kind:'workspace-operation',requestId:'',ownerId:row.user_id,fileOperation:this.view(row),workspaceChange:{...recorded.change,revision:Number(recorded.revision)}});}catch{}return row;}
   await this.root(row.user_id,p);
   if(row.phase==='restore'){
    const expected=p.after??p.snapshot;if(!expected)return row;
    if(row.action==='create_folder'){
     const current=await optionalStat(p.source);if(current&&fileIdentity(current)===expected.nodes[0].identity)await this.patch(row,{status:'completed',phase:'apply',error:'Undo did not finish. The created folder is still present; review its current contents before trying again.'});
     else if(!current){signal.throwIfAborted();await this.finish(row,{operation_id:row.id,action:row.action,path:p.path,kind:'folder',changed:true,restored:true,observed_after_restart:true},true);}return row;
    }
    const destination=row.action==='remove'?await this.recoveryPath(row):p.target;
    if(await exactExists(p.source)){
     const original=await this.snapshot(p.source,signal),remaining=await optionalStat(destination);
     if(original.contentHash===expected.contentHash&&original.nodes[0].identity===expected.nodes[0].identity&&(!remaining||fileIdentity(remaining)!==expected.nodes[0].identity)){signal.throwIfAborted();await this.finish(row,{operation_id:row.id,action:row.action,path:p.path,kind:expected.nodes[0].kind,changed:true,restored:true,observed_after_restart:true},true);return row;}
    }
    const unchanged=await optionalStat(destination);if(unchanged&&await exactExists(destination)&&fileIdentity(unchanged)===expected.nodes[0].identity)await this.patch(row,{status:'completed',phase:'apply',error:'Restore did not finish. The saved item remains in its result location. Review it before trying again.'});
   }else{
    if(row.action==='create_folder')return row;
    const target=row.action==='remove'?await this.recoveryPath(row):p.target;if(!await exactExists(target))return row;
    const snapshot=await this.snapshot(target,signal,row.action==='remove'?path.dirname(target):undefined);if(snapshot.contentHash!==p.snapshot!.contentHash||snapshot.nodes[0].identity!==p.snapshot!.nodes[0].identity)return row;p.after=snapshot;
    signal.throwIfAborted();await this.finish(row,{operation_id:row.id,action:row.action,path:p.path,kind:p.snapshot!.nodes[0].kind,...(row.action==='move'?{destination:p.destination}:{}),changed:true,...(row.action==='remove'?{removed:true}:{}),observed_after_restart:true});
   }
  }catch{}return row;
 }
 async get(owner:string,id:string,guard:()=>Promise<void>){return this.run(owner,undefined,guard,async(signal,check)=>{const row=await this.reconcile(await this.load(owner,id),signal);await check();return this.view(row);});}
 async page(owner:string,guard:()=>Promise<void>,options:{before?:FileOperationCursor;filter?:'all'|'recovery'}={}):Promise<FileOperationPage>{return this.run(owner,undefined,guard,async(signal,check)=>{
  const before=options.before;if(before&&(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(before.id)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(before.createdAt)||!Number.isFinite(Date.parse(before.createdAt))))throw new Error('Invalid file history cursor. Refresh the history.');
  let query=this.db.from('desktop_file_operations').select('*').eq('user_id',owner).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
  if(options.filter==='recovery')query=query.eq('action','remove').in('status',['completed','interrupted','applying','restoring']);
  if(before)query=query.or('created_at.lt.'+before.createdAt+',and(created_at.eq.'+before.createdAt+',id.lt.'+before.id+')');
  const saved=data(await this.query(query)) as FileOperation[],rows=saved.slice(0,50);for(let i=0;i<rows.length;i++)rows[i]=await this.reconcile(rows[i],signal);await check();const last=rows.at(-1);return {rows:rows.map(row=>this.view(row)),next:saved.length>50&&last?{id:last.id,createdAt:last.created_at}:null};
 });}
 async reveal(owner:string,id:string,guard:()=>Promise<void>){return this.run(owner,undefined,guard,async(_signal,check)=>{const row=await this.load(owner,id);if(row.action!=='remove')throw new Error('This operation has no removed item.');const target=await this.recoveryPath(row);const stat=await optionalStat(target);if(!stat)throw new Error('This recovery item is no longer present. Refresh the file history.');if(stat.isSymbolicLink()||stat.isFile()&&stat.nlink>1||!sameFilePath(await realpath(target),target))throw new Error('Linked recovery items cannot be revealed. Inspect the original workspace in Windows.');await check();this.assertGrant(owner,row.preview,true);if(!this.explorer)throw new Error('Windows File Explorer is unavailable.');this.explorer.showItemInFolder(target);});}
 async list(owner:string,guard:()=>Promise<void>){return this.run(owner,undefined,guard,async(signal,check)=>{const rows=data(await this.db.from('desktop_file_operations').select('*').eq('user_id',owner).order('created_at',{ascending:false}).limit(50)) as FileOperation[];for(let i=0;i<rows.length;i++)rows[i]=await this.reconcile(rows[i],signal);await check();return rows.map(row=>this.view(row));});}
}
