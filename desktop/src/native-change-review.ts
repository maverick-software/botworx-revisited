import type {SupabaseClient} from '@supabase/supabase-js';import {createHash} from 'node:crypto';
import path from 'node:path';
import {nativeChanges,type NativeChange} from './native-change-presentation';import {reconstructNativeChange} from './native-change-snapshots';
import {hashText,type WorkspaceTools} from './workspace-tools';import type {WorkspaceEditor} from './workspace-editor';import type {CodexHarness} from './codex-harness';import type {NativeState} from './native-contracts';import type {NativeChangePath,NativeChangeReceipt,NativeChangeReview} from './native-change-contracts';
const data=(result:any):any=>{if(result.error)throw new Error(result.error.message);return result.data;},digest=(text:string)=>createHash('sha256').update(text).digest('hex');
export class NativeChangeReviewService{
 constructor(private db:SupabaseClient,private workspace:WorkspaceTools,private editor:WorkspaceEditor,private native:CodexHarness,private changed:(owner:string,request:string,conversation:string)=>void,private moveScript=path.resolve(__dirname,'../resources/runtime/file-actions.ps1')){}
 private stage(snapshot:NativeChangePath,current:Awaited<ReturnType<WorkspaceTools['nativeSnapshot']>>){
  const caseMove=!!snapshot.restorePath;if(current.path!==snapshot.path&&(!caseMove||current.path.toLowerCase()!==snapshot.path.toLowerCase()))throw new Error('The workspace path changed.');
  if(caseMove&&current.actualPath!==snapshot.path&&current.actualPath!==snapshot.restorePath)throw new Error('The filename changed after this native edit. Undo preserved its newer name.');
  if(current.sha256===snapshot.beforeHash&&(!caseMove||current.actualPath===snapshot.restorePath))return'before';
  if(caseMove&&current.sha256===snapshot.beforeHash)return'content-restored';
  if(current.sha256===snapshot.afterHash)return'after';throw new Error('The file changed after this native edit. Undo preserved its newer contents.');
 }
 private view(row:any):NativeChangeReceipt{return{id:row.id,key:row.change_key,status:row.status,paths:row.paths,error:row.error??undefined};}
 async recover(){data(await this.db.from('desktop_native_file_review').update({status:'uncertain',error:'Sylvana stopped during undo. Review the current files before explicitly retrying.',updated_at:new Date().toISOString()}).eq('status','restoring'));}
 async statuses(owner:string,request:string){return data(await this.db.from('desktop_native_file_review').select('change_key,status').eq('user_id',owner).eq('request_id',request)).map((row:any)=>({key:row.change_key,status:row.status}));}
 async prepare(owner:string,requestId:string,guard:()=>Promise<void>):Promise<NativeChangeReview>{return this.native.quietFiles(owner,async()=>{
  await guard();const request=data(await this.db.from('desktop_requests').select('id,status,conversation_id').eq('id',requestId).eq('user_id',owner).single());if(request.status==='running')throw new Error('Wait for this response to finish before preparing undo.');
  const row=data(await this.db.from('desktop_codex_turns').select('state,context').eq('request_id',requestId).eq('user_id',owner).single());if(row.context?.options?.mode==='plan'||!['ask','full'].includes(row.context?.options?.permission))throw new Error('This native turn did not authorize file changes.');
  const result:NativeChangeReview={receipts:[],issues:[]};
  for(const change of nativeChanges(row.state as NativeState)){
   try{
    const previous=data(await this.db.from('desktop_native_file_review').select('*').eq('request_id',requestId).eq('user_id',owner).eq('change_key',change.key).maybeSingle());
    if(previous){if(previous.source_hash!==digest(change.patch))throw new Error('The native patch changed after review. Its earlier receipt was preserved.');let available=previous.status!=='restoring';try{if(previous.status!=='restored')for(const snapshot of previous.paths as NativeChangePath[])this.stage(snapshot,await this.workspace.nativeSnapshot(owner,snapshot.path));}catch{available=false;}result.receipts.push({...this.view(previous),available});if(!available)result.issues.push({key:change.key,error:'The file or its workspace grant changed after this snapshot. Newer work was preserved.'});continue;}
    const paths=await this.snapshots(owner,change);await guard();
    const saved=data(await this.db.from('desktop_native_file_review').upsert({user_id:owner,request_id:requestId,change_key:change.key,source_hash:digest(change.patch),status:'ready',paths},{onConflict:'user_id,request_id,change_key',ignoreDuplicates:true}).select('*').maybeSingle());
    if(saved)result.receipts.push(this.view(saved));else result.receipts.push(this.view(data(await this.db.from('desktop_native_file_review').select('*').eq('request_id',requestId).eq('user_id',owner).eq('change_key',change.key).single())));
   }catch(error){result.issues.push({key:change.key,error:(error as Error).message});}
  }
  await guard();return result;
 });}
 private async snapshots(owner:string,change:NativeChange):Promise<NativeChangePath[]>{
  if(change.issue)throw new Error(change.issue);if(!change.absoluteFrom&&!change.absoluteTo)throw new Error('The native file path could not be verified.');
  const current=await this.workspace.nativeSnapshot(owner,change.absoluteTo??change.absoluteFrom!);
  const original=reconstructNativeChange(change,current.content);
  const snapshotPath=(snapshot:typeof current,before:string|null,after:string|null):NativeChangePath=>({path:snapshot.path,referenceId:snapshot.referenceId,relativePath:snapshot.relativePath,before,after,beforeHash:before===null?null:hashText(before),afterHash:after===null?null:hashText(after)});
  if(change.absoluteFrom&&change.absoluteTo&&change.absoluteFrom!==change.absoluteTo){
   if(change.absoluteFrom.toLowerCase()===change.absoluteTo.toLowerCase()){
    if(process.platform!=='win32'||path.dirname(path.resolve(change.absoluteFrom)).toLowerCase()!==path.dirname(path.resolve(change.absoluteTo)).toLowerCase()||!current.actualPath||path.basename(current.actualPath)!==path.basename(change.absoluteTo))throw new Error('The filename casing changed after this native move. Inspect it before preparing undo.');
    const source=await this.workspace.nativeSnapshot(owner,change.absoluteFrom);if(source.actualPath!==current.actualPath)throw new Error('The original move path now refers to another file.');
    const canonical=await this.workspace.nativeSnapshot(owner,current.actualPath!);return[{...snapshotPath(canonical,original.before,original.after),restorePath:path.join(path.dirname(current.actualPath!),path.basename(change.absoluteFrom))}];
   }
   const source=await this.workspace.nativeSnapshot(owner,change.absoluteFrom);if(source.content!==null)throw new Error('The original move path now contains a file. Undo preserved it.');return[snapshotPath(source,original.before,null),snapshotPath(current,null,original.after)];
  }
  return[snapshotPath(current,original.before,original.after)];
 }
 async undo(owner:string,id:string,guard:()=>Promise<void>){return this.native.quietFiles(owner,async()=>{
  await guard();let row=data(await this.db.from('desktop_native_file_review').select('*').eq('id',id).eq('user_id',owner).single());if(row.status==='restored'){await guard();return{...this.view(row),duplicate:true};}if(row.status==='restoring')throw new Error('This undo is already running.');
  const request=data(await this.db.from('desktop_requests').select('status,conversation_id').eq('id',row.request_id).eq('user_id',owner).single());if(request.status==='running')throw new Error('Wait for this response to finish.');
  const paths=row.paths as NativeChangePath[];
  return this.editor.fileOperation(owner,paths.flatMap(snapshot=>snapshot.restorePath?[snapshot.path,snapshot.restorePath]:[snapshot.path]),async()=>{
   const inspect=async(snapshot:NativeChangePath)=>{const current=await this.workspace.nativeSnapshot(owner,snapshot.path);await guard();return this.stage(snapshot,current);};
   const states=await Promise.all(paths.map(inspect));await guard();const previous=row.status;
   row=data(await this.db.from('desktop_native_file_review').update({status:'restoring',error:null,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',owner).eq('status',previous).select('*').single());
   const check=async()=>{await guard();data(await this.db.from('desktop_native_file_review').select('id').eq('id',id).eq('user_id',owner).eq('status','restoring').single());await guard();};
   try{
    for(let index=0;index<paths.length;index++)if(states[index]!=='before'){const snapshot=paths[index];if(await inspect(snapshot)!=='before'){const renewed=await this.workspace.nativeSnapshot(owner,snapshot.path);await this.workspace.restoreNative(owner,{...snapshot,referenceId:renewed.referenceId,relativePath:renewed.relativePath},check,this.moveScript);};}
    for(const snapshot of paths)if(await inspect(snapshot)!=='before')throw new Error('The restoration could not be confirmed.');
    data(await this.db.from('desktop_native_file_review').update({status:'restored',error:null,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',owner));this.changed(owner,row.request_id,request.conversation_id);await guard();return{...this.view(row),status:'restored'};
   }catch(error){const saved=await this.db.from('desktop_native_file_review').select('status').eq('id',id).eq('user_id',owner).maybeSingle();if(saved.data?.status==='restored'){await guard();this.changed(owner,row.request_id,request.conversation_id);return{...this.view(row),status:'restored',recovered:true};}await this.db.from('desktop_native_file_review').update({status:'uncertain',error:(error as Error).message,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',owner);this.changed(owner,row.request_id,request.conversation_id);throw error;}
  });
 });}
}
