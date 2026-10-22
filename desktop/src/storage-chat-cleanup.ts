import {randomUUID} from 'node:crypto';
import type {StorageChat,StorageChild,StorageChatReview,StorageChatResult} from './storage-contracts';
import {storageUuid} from './storage-files';

export type ChatCleanupHost={guard:(owner:string)=>Promise<void>;read:(owner:string)=>Promise<{chats:StorageChat[];children:StorageChild[]}>;busy:()=>boolean;exclusive:<T>(task:()=>Promise<T>)=>Promise<T>;deleteChat:(owner:string,id:string)=>Promise<void>};
type Plan={owner:string;review:StorageChatReview;chats:StorageChat[]};
export class StorageChatCleanup{
 private plans=new Map<string,Plan>();
 constructor(private host:ChatCleanupHost){}
 async prepare(owner:string,ids:unknown):Promise<StorageChatReview>{
  return this.host.exclusive(async()=>{
   await this.host.guard(owner);if(this.host.busy())throw Error('Finish or pause active chats, subagents and commands before cleanup.');
   if(!Array.isArray(ids)||!ids.length||ids.length>100||!ids.every(storageUuid)||new Set(ids).size!==ids.length)throw Error('Choose between 1 and 100 distinct chats to review.');
   for(const [id,plan]of this.plans)if(Date.parse(plan.review.expiresAt)<Date.now())this.plans.delete(id);if(this.plans.size>=100)throw Error('Close older cleanup reviews and try again.');
   const data=await this.host.read(owner),byId=new Map(data.chats.map(row=>[row.id,row])),chats=ids.map(id=>byId.get(id));
   if(chats.some(row=>!row))throw Error('A selected chat is unavailable for your account. Refresh the list and select again.');
   const selected=chats as StorageChat[],review:StorageChatReview={id:randomUUID(),kind:'chats',chats:selected.map(({id,title,messages,children,bytes})=>({id,title,messages,children,bytes})),messages:selected.reduce((sum,row)=>sum+row.messages,0),children:selected.reduce((sum,row)=>sum+row.children,0),bytes:selected.reduce((sum,row)=>sum+row.bytes,0),expiresAt:new Date(Date.now()+120000).toISOString()};
   await this.host.guard(owner);this.plans.set(review.id,{owner,review,chats:structuredClone(selected)});return structuredClone(review);
  });
 }
 async commit(owner:string,id:unknown):Promise<StorageChatResult>{
  await this.host.guard(owner);if(!storageUuid(id))throw Error('Choose a valid cleanup review.');const plan=this.plans.get(id);
  if(!plan||plan.owner!==owner)throw Error('This cleanup review belongs to another account or has already been used.');
  this.plans.delete(id);if(Date.parse(plan.review.expiresAt)<Date.now())throw Error('The cleanup review expired. Review the chats again.');
  return this.host.exclusive(async()=>{
   await this.host.guard(owner);if(this.host.busy())throw Error('Active work started after review. Finish or pause it before cleanup.');
   const result:StorageChatResult={kind:'chats',deleted:[],skipped:[],incomplete:[]};
   for(let index=0;index<plan.chats.length;index++){
    const saved=plan.chats[index];let attempted=false;
    try{
     await this.host.guard(owner);if(this.host.busy())throw Error('Active work started during cleanup.');
     const data=await this.host.read(owner),current=data.chats.find(row=>row.id===saved.id);await this.host.guard(owner);
     if(!current){result.skipped.push({itemId:saved.id,reason:'unavailable'});continue;}
     if(current.fingerprint!==saved.fingerprint){result.skipped.push({itemId:saved.id,reason:'changed'});continue;}
     if(this.host.busy())throw Error('Active work started during cleanup.');attempted=true;await this.host.deleteChat(owner,saved.id);
     result.deleted.push({kind:'chat',itemId:saved.id,conversationId:saved.id,removedBytes:saved.bytes,removedFiles:0});
    }catch{
     // A failed reply can follow a committed database deletion. Re-read before reporting its outcome.
     try{
      await this.host.guard(owner);if(this.host.busy())throw Error('Cleanup interrupted.');
      if(attempted){const data=await this.host.read(owner);await this.host.guard(owner);if(!data.chats.some(row=>row.id===saved.id)){result.deleted.push({kind:'chat',itemId:saved.id,conversationId:saved.id,removedBytes:saved.bytes,removedFiles:0});continue;}}
      result.incomplete.push({itemId:saved.id,reason:'failed'});
     }catch{
      result.incomplete.push({itemId:saved.id,reason:attempted?'uncertain':'interrupted'});
      for(const remaining of plan.chats.slice(index+1))result.incomplete.push({itemId:remaining.id,reason:'interrupted'});break;
     }
    }
   }
   return result;
  });
 }
}
