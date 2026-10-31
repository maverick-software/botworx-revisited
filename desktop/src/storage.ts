import path from 'node:path';import {randomUUID} from 'node:crypto';import {readdir,lstat} from 'node:fs/promises';
import type {FileReference} from './contracts';import type {StorageChat,StorageChild,StorageCopy,StorageReview,StorageResult,StorageSummary} from './storage-contracts';
import {storageUuid,storageCopyName,storageDirectory,storageInventory,removeStorageCopy,storageWithin,type StorageInventory} from './storage-files';
import {StorageChatCleanup} from './storage-chat-cleanup';
type Host={guard:(owner:string)=>Promise<void>;read:(owner:string)=>Promise<{chats:StorageChat[];children:StorageChild[]}>;references:(owner:string)=>FileReference[];busy:()=>boolean;exclusive:<T>(task:()=>Promise<T>)=>Promise<T>;deleteChat:(owner:string,id:string)=>Promise<void>;reveal?:(folder:string)=>Promise<void>};
type Plan={owner:string;review:StorageReview;fingerprint:string;parent?:string;name?:string;inventory?:StorageInventory};
export class DesktopStorage{
 private plans=new Map<string,Plan>();
 private chatCleanup:StorageChatCleanup;
 constructor(private profile:string,private outputs:string,private host:Host){this.chatCleanup=new StorageChatCleanup(host);}
 prepareChats(owner:string,ids:unknown){return this.chatCleanup.prepare(owner,ids);}
 commitChats(owner:string,id:unknown){return this.chatCleanup.commit(owner,id);}
 private parent(owner:string,location:'outputs'|'legacy'){if(!storageUuid(owner))throw Error('Choose a valid storage account.');return path.resolve(location==='outputs'?this.outputs:path.join(this.profile,'workspaces'),owner);}
 private protected(owner:string,target:string){return this.host.references(owner).some(reference=>reference.source!=='clipboard'&&(storageWithin(target,reference.path)||reference.kind==='folder'&&storageWithin(reference.path,target)));}
 private copy(owner:string,id:unknown){if(typeof id!=='string')throw Error('Choose a working copy.');const [location,name,...extra]=id.split(':');if(extra.length||!['outputs','legacy'].includes(location)||!storageCopyName(name))throw Error('Invalid working-copy identity.');return {parent:this.parent(owner,location as 'outputs'|'legacy'),name,location:location as 'outputs'|'legacy'};}
 async summary(owner:string):Promise<StorageSummary>{
  await this.host.guard(owner);const data=await this.host.read(owner),copies:StorageCopy[]=[],warnings:string[]=[];
  for(const location of ['outputs','legacy'] as const){const parent=this.parent(owner,location);let names:string[];try{await storageDirectory(parent);names=(await readdir(parent)).sort();}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;warnings.push((error as Error).message);continue;}
   for(const name of names){if(/^\.sylvana-cleanup-/.test(name))warnings.push('An incomplete cleanup folder remains. Review the working-files folder in Windows before further cleanup.');if(!storageCopyName(name))continue;if(copies.length>=500){warnings.push('More working copies are present. Review the account folders in Windows.');break;}await this.host.guard(owner);const id=location+':'+name,conversationId=storageUuid(name.slice(0,36))&&name[36]==='-'?name.slice(0,36):null,title=data.chats.find(chat=>chat.id===conversationId)?.title??'Saved working copy';let inventory:StorageInventory|undefined,blocked:string|undefined;
    try{if(!(await lstat(path.join(parent,name))).isDirectory())continue;inventory=await storageInventory(path.join(parent,name));if(this.protected(owner,path.join(parent,name)))blocked='A saved file or folder reference uses this copy. Remove that reference before cleanup.';}catch(error){blocked=(error as Error).message;}
    copies.push({id,name:title,conversationId,location,files:inventory?.files??0,folders:inventory?.folders??0,bytes:inventory?.bytes??0,measured:!!inventory,...(blocked?{blocked}:{})});
   }
  }
  await this.host.guard(owner);return {...data,copies,busy:this.host.busy(),warnings,contentBytes:data.chats.reduce((sum,row)=>sum+row.bytes,0),workingBytes:copies.reduce((sum,row)=>sum+row.bytes,0)};
 }
 async prepare(owner:string,kind:unknown,itemId:unknown):Promise<StorageReview>{
  return this.host.exclusive(async()=>{
  await this.host.guard(owner);if(this.host.busy())throw Error('Finish or pause active chats, subagents and commands before cleanup.');for(const [id,plan]of this.plans)if(Date.parse(plan.review.expiresAt)<Date.now())this.plans.delete(id);if(this.plans.size>=100)throw Error('Close older cleanup reviews and try again.');
  const id=randomUUID(),expiresAt=new Date(Date.now()+120000).toISOString();let plan:Plan;
  if(kind==='chat'){if(!storageUuid(itemId))throw Error('Choose a valid conversation.');const data=await this.host.read(owner),chat=data.chats.find(row=>row.id===itemId);if(!chat)throw Error('This chat is unavailable for your account.');plan={owner,fingerprint:chat.fingerprint,review:{id,kind,itemId,title:chat.title,bytes:chat.bytes,files:0,messages:chat.messages,children:chat.children,sample:[],expiresAt}};}
  else if(kind==='working-copy'){const {parent,name}=this.copy(owner,itemId),target=path.join(parent,name);if(this.protected(owner,target))throw Error('A saved file or folder reference uses this working copy. Remove that reference before cleanup.');const data=await this.host.read(owner),conversation=storageUuid(name.slice(0,36))&&name[36]==='-'?name.slice(0,36):null,title=data.chats.find(row=>row.id===conversation)?.title??'Working copy';const inventory=await storageInventory(target,true);plan={owner,parent,name,inventory,fingerprint:inventory.fingerprint,review:{id,kind,itemId:itemId as string,title,bytes:inventory.bytes,files:inventory.files,messages:0,children:0,sample:inventory.sample,expiresAt}};}
  else throw Error('Choose a chat or working copy to review.');
  await this.host.guard(owner);this.plans.set(id,plan);return structuredClone(plan.review);
  });
 }
 async commit(owner:string,id:unknown):Promise<StorageResult>{
  await this.host.guard(owner);if(!storageUuid(id))throw Error('Choose a valid cleanup review.');const plan=this.plans.get(id);if(!plan||plan.owner!==owner)throw Error('This cleanup review belongs to another account or has already been used.');this.plans.delete(id);if(Date.parse(plan.review.expiresAt)<Date.now())throw Error('The cleanup review expired. Review the item again.');
  return this.host.exclusive(async()=>{await this.host.guard(owner);if(this.host.busy())throw Error('Active work started after review. Finish or pause it before cleanup.');if(plan.review.kind==='chat'){const data=await this.host.read(owner),chat=data.chats.find(row=>row.id===plan.review.itemId);if(!chat||chat.fingerprint!==plan.fingerprint)throw Error('This chat changed after review. Review it again before deleting it.');await this.host.guard(owner);await this.host.deleteChat(owner,chat.id);return {kind:'chat',itemId:chat.id,conversationId:chat.id,removedBytes:chat.bytes,removedFiles:0};}
   if(this.protected(owner,path.join(plan.parent!,plan.name!)))throw Error('A file or folder reference now uses this working copy. Review it again.');await removeStorageCopy(plan.parent!,plan.name!,id,plan.inventory!,async()=>{await this.host.guard(owner);if(this.protected(owner,path.join(plan.parent!,plan.name!)))throw Error('This working copy gained a saved reference.');});return {kind:'working-copy',itemId:plan.review.itemId,conversationId:null,removedBytes:plan.inventory!.bytes,removedFiles:plan.inventory!.files};
  });
 }
 async reveal(owner:string,id:unknown){await this.host.guard(owner);const {parent,name}=this.copy(owner,id),folder=path.join(parent,name);await storageDirectory(folder);await this.host.guard(owner);if(!this.host.reveal)throw Error('Opening the folder in Windows is unavailable.');await this.host.reveal(folder);}
}
