import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {insidePath} from './file-snapshot';
import type {Secrets} from './secrets';
import {WorkspaceTools} from './workspace-tools';
import type {EditorDraft,EditorSnapshot,EditorSave} from './editor-contracts';
const normalize=(value:string)=>value.replace(/\r\n/g,'\n');
export class WorkspaceEditor{
 private leases=new Map<string,{owner:string;path:string}>();private leaseEpoch=0;
 clearLeases(){this.leaseEpoch++;this.leases.clear();}
 private queues=new Map<string,Promise<unknown>>();private controllers=new Set<AbortController>();private epoch=0;
 constructor(private secrets:Secrets,private tools:WorkspaceTools){}
 get generation(){return this.epoch;}
 cancel(){this.epoch++;this.clearLeases();for(const controller of this.controllers)controller.abort();}
 async close(){this.cancel();await Promise.allSettled(this.queues.values());}
 async fileOperation<T>(owner:string,paths:string[],task:()=>Promise<T>):Promise<T>{
  const previous=this.queues.get(owner)??Promise.resolve(),operation=previous.catch(()=>{}).then(async()=>{
   const affected=(file:string)=>paths.some(root=>insidePath(root,file));
   if([...this.leases.values()].some(lease=>lease.owner===owner&&affected(lease.path)))throw new Error('Close the file editor before moving or removing this item. Its unsaved work will stay in local drafts.');
   const key='editor-drafts:'+owner,drafts=this.secrets.get<EditorDraft[]>(key)??[];
   if(drafts.some(draft=>affected(draft.canonicalPath)&&(draft.base===null||draft.content!==normalize(draft.base))))throw new Error('Save or discard affected local drafts before moving or removing this item. Open Recover local drafts to review them.');
   const result=await task(),remaining=drafts.filter(draft=>!affected(draft.canonicalPath));
   if(remaining.length!==drafts.length)await this.secrets.set(key,remaining).catch(()=>{});
   return result;
  });this.queues.set(owner,operation);try{return await operation;}finally{if(this.queues.get(owner)===operation)this.queues.delete(owner);}
 }
 async call(action:string,args:Record<string,unknown>,owner:string,guard:()=>Promise<void>,generation=this.epoch):Promise<any>{
  const leaseEpoch=this.leaseEpoch;const controller=new AbortController();this.controllers.add(controller);
  const check=async()=>{controller.signal.throwIfAborted();if(generation!==this.epoch||args.owner!==owner)throw new Error('Your account changed while editing.');await guard();controller.signal.throwIfAborted();if(generation!==this.epoch)throw new Error('Your account changed while editing.');};
  const previous=this.queues.get(owner)??Promise.resolve(),operation=previous.catch(()=>{}).then(async()=>{
   await check();const key='editor-drafts:'+owner,drafts=this.secrets.get<EditorDraft[]>(key)??[];
   const store=async(next:EditorDraft[])=>{if(next.length>20||next.reduce((size,d)=>size+d.content.length+(d.base?.length??0),0)>1500000)throw new Error('Draft storage is full. Save or discard older drafts before continuing.');await check();await this.secrets.set(key,next);};
   if(action==='workspace.editor.list')return drafts;
   if(action==='workspace.editor.release'){if(typeof args.lease!=='string')throw new Error('Invalid editor lease.');const lease=this.leases.get(args.lease);if(lease&&lease.owner!==owner)throw new Error('This editor belongs to another account.');this.leases.delete(args.lease);return;}

   if(action==='workspace.editor.open'){
    if(typeof args.referenceId!=='string'||typeof args.path!=='string')throw new Error('Choose an available workspace file.');
    const snapshot=await this.tools.editorSnapshot(owner,args.referenceId,args.path,args.create===true);await check();
    if(args.lease!==undefined){if(typeof args.lease!=='string'||!/^[a-f0-9-]{36}$/i.test(args.lease))throw new Error('Invalid editor lease.');if(leaseEpoch===this.leaseEpoch)this.leases.set(args.lease,{owner,path:snapshot.path});}

    const existing=drafts.find(d=>d.canonicalPath.toLowerCase()===snapshot.path.toLowerCase());
    if(existing){const next={...existing,referenceId:args.referenceId,relativePath:args.path};await store(drafts.map(d=>d.id===next.id?next:d));return next;}
    const draft:EditorDraft={id:randomUUID(),referenceId:args.referenceId,relativePath:args.path,name:path.basename(snapshot.path),canonicalPath:snapshot.path,base:snapshot.content,baseHash:snapshot.sha256,content:normalize(snapshot.content??''),revision:0,updatedAt:new Date().toISOString()};await store([...drafts,draft]);return draft;
   }
   const draft=drafts.find(d=>d.id===args.id);if(!draft)throw new Error('This draft is unavailable.');
   if(args.revision!==draft.revision)throw new Error('This draft changed in another tab. Reopen it before editing further.');
   if(action==='workspace.editor.discard'){await store(drafts.filter(d=>d.id!==draft.id));return;}
   if(action==='workspace.editor.update'){
    if(typeof args.content!=='string'||args.content.length>160000||args.content.includes('\0')||Buffer.byteLength(args.content)>256000)throw new Error('Use UTF-8 text with at most 160,000 characters and 256 KB.');
    const next={...draft,content:normalize(args.content),revision:draft.revision+1,updatedAt:new Date().toISOString()};await store(drafts.map(d=>d.id===next.id?next:d));return next;
   }
   if(action!=='workspace.editor.save'&&action!=='workspace.editor.reload')throw new Error('Unsupported editor operation.');
   const current=await this.tools.editorSnapshot(owner,draft.referenceId,draft.relativePath,true);await check();
   if(current.path!==draft.canonicalPath)throw new Error('The file path changed. Add the original workspace again.');
   if(action==='workspace.editor.reload'){
    const next={...draft,base:current.content,baseHash:current.sha256,content:normalize(current.content??''),revision:draft.revision+1,updatedAt:new Date().toISOString()};await store(drafts.map(d=>d.id===draft.id?next:d));return next;
   }
   const expected=args.expectedHash===undefined?draft.baseHash:args.expectedHash;
   if(expected!==current.sha256)return {draft,conflict:current} satisfies EditorSave;
   const options={permission:'ask' as const,mode:'chat' as const,thinking:'default' as const,files:[draft.referenceId]};
   const preview=await this.tools.preview(owner,options,{reference_id:draft.referenceId,path:draft.relativePath,expected_hash:expected,content:draft.content,reason:'Saved explicitly from the workspace editor.'});await check();
   await this.tools.apply(owner,options,preview,controller.signal);
   const next={...draft,base:preview.after,baseHash:preview.afterHash,content:normalize(preview.after),revision:draft.revision+1,updatedAt:new Date().toISOString()};
   // The file may already be saved if protected draft persistence fails. A later Save rechecks its hash.
   await this.secrets.set(key,drafts.map(d=>d.id===draft.id?next:d));return {draft:next,saved:true} satisfies EditorSave;
  });this.queues.set(owner,operation);
  try{return await operation;}finally{this.controllers.delete(controller);if(this.queues.get(owner)===operation)this.queues.delete(owner);}
 }
}
