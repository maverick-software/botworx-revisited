import {watch,type FSWatcher} from 'node:fs';
import path from 'node:path';
import {lstat} from 'node:fs/promises';
import type {WorkspaceTools} from './workspace-tools';
import type {WorkspaceFiles} from './workspace';
import {safeName} from './workspace';
import type {ChatEvent} from './contracts';

type Subscription={owner:string;id:string;referenceId:string;relativePath:string;kind:'folder'|'file';target?:string;identity?:string;stamp?:string;watcher?:FSWatcher;timer?:ReturnType<typeof setTimeout>;probe?:ReturnType<typeof setInterval>;checking?:boolean;closed:boolean};
/** Watches visible directories and active files through the owned workspace resolver. */
export class WorkspaceMonitor{
 private epoch=0;
 get generation(){return this.epoch;}
 private entries=new Map<string,Subscription>();
 constructor(private files:WorkspaceFiles,private tools:WorkspaceTools,private active:(owner:string)=>boolean,private emit:(owner:string,event:ChatEvent)=>void,private delay=300,private interval=3000){}
 private options(reference:string){return {permission:'files' as const,mode:'chat' as const,thinking:'default' as const,files:[reference]};}
 private async target(entry:Subscription){
  if(entry.kind==='folder')return this.tools.commandDirectory(entry.owner,this.options(entry.referenceId),{reference_id:entry.referenceId,path:entry.relativePath});
  const {target}=await this.tools.operationPath(entry.owner,entry.referenceId,entry.relativePath);
  if(!(await lstat(target)).isFile())throw new Error('Choose an existing file inside the selected workspace.');return target;
 }
 private stamp(stat:Awaited<ReturnType<typeof lstat>>){return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;}
 private current(entry:Subscription){return !entry.closed&&this.entries.get(entry.id)===entry&&this.active(entry.owner)&&this.files.list(entry.owner).some(reference=>reference.id===entry.referenceId);}
 private event(entry:Subscription,error?:string){if(this.current(entry))this.emit(entry.owner,{kind:'workspace',requestId:'',ownerId:entry.owner,workspace:{id:entry.id,referenceId:entry.referenceId,path:entry.relativePath,...(error?{error}:{})}});}
 private dispose(entry:Subscription){entry.closed=true;entry.watcher?.close();clearTimeout(entry.timer);clearInterval(entry.probe);if(this.entries.get(entry.id)===entry)this.entries.delete(entry.id);}
 stop(owner:string,id:string){const entry=this.entries.get(id);if(entry&&entry.owner!==owner)throw new Error('This workspace watcher belongs to another account.');if(entry)this.dispose(entry);}
 close(){this.epoch++;for(const entry of [...this.entries.values()])this.dispose(entry);}
 stopOwner(owner:string){for(const entry of [...this.entries.values()])if(entry.owner===owner)this.dispose(entry);}
 private changed(entry:Subscription){if(!this.current(entry)||entry.timer)return;entry.timer=setTimeout(()=>{entry.timer=undefined;void this.check(entry,true);},this.delay);entry.timer.unref();}
 private async check(entry:Subscription,notify=false){
  if(!this.current(entry)){this.dispose(entry);return;}if(entry.checking){if(notify)this.changed(entry);return;}entry.checking=true;
  try{
   const target=await this.target(entry);
   const stat=await lstat(target),identity=`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
   if(!this.current(entry)){this.dispose(entry);return;}
   if(target!==entry.target||entry.kind==='folder'&&identity!==entry.identity)throw new Error('This folder was moved or replaced. Refresh folder navigation to reconnect.');
   const stamp=this.stamp(stat);if(notify||stamp!==entry.stamp){entry.stamp=stamp;this.event(entry);}
  }catch{this.event(entry,entry.kind==='file'?'This file is unavailable or changed. Refresh the preview to reconnect.':'This folder is unavailable or changed. Refresh folder navigation to reconnect.');this.dispose(entry);}
  finally{entry.checking=false;}
 }
 async start(owner:string,id:string,referenceId:string,relativePath:string,guard:()=>Promise<void>,generation=this.epoch,kind:'folder'|'file'='folder'){
  if(generation!==this.epoch)throw new Error('This workspace watcher was closed.');
  this.stop(owner,id);if(this.entries.size>=64)throw new Error('Automatic workspace updates cover up to 64 visible folders and files. Close a view or use Refresh.');
  const entry:Subscription={owner,id,referenceId,relativePath,kind,closed:false};this.entries.set(id,entry);
  try{
   await guard();const target=await this.target(entry),stat=await lstat(target);await guard();
   if(!this.current(entry)){this.dispose(entry);throw new Error('This workspace watcher was closed.');}
   entry.target=target;entry.identity=`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;entry.stamp=this.stamp(stat);
   // Directory names are signals only. Contents are read through the normal owned workspace API.
   let warning:string|undefined;
   try{entry.watcher=watch(kind==='file'?path.dirname(target):target,{persistent:false},(_type,name)=>{if(kind==='file'?!name||String(name).toLowerCase()===path.basename(target).toLowerCase():!name||safeName(String(name)))this.changed(entry);});entry.watcher.on('error',()=>{entry.watcher?.close();entry.watcher=undefined;this.event(entry,kind==='file'?'Live notifications stopped. File changes are still checked every few seconds.':'Live notifications stopped. Folder changes are still checked every few seconds.');});}
   catch{warning=kind==='file'?'Live notifications are unavailable. File changes are checked every few seconds.':'Live notifications are unavailable. Folder additions and removals are checked every few seconds; use Refresh for file contents.';}
   entry.probe=setInterval(()=>void this.check(entry),this.interval);entry.probe.unref();return {warning};
  }catch(error){this.dispose(entry);throw error;}
 }
}
