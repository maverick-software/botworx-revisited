import type {ScheduledRun} from './scheduled-task-contracts';

type Store={get:<T>(key:string)=>T|undefined;set:(key:string,value:unknown)=>Promise<void>};
type Host={owner:()=>string|null;runs:(owner:string)=>Promise<ScheduledRun[]>;enabled?:(owner:string)=>boolean;show:(name:string,status:string,conversationId?:string,owner?:string)=>void};
/** Persist receipts before showing a Windows alert. Reopening the application
 * seeds historical results rather than replaying its notification history. */
export class ScheduledNotifications{
 private tail=Promise.resolve();
 private initialized=new Set<string>();
 constructor(private store:Store,private host:Host){}
 changed(owner:string){const operation=this.tail.then(()=>this.refresh(owner));this.tail=operation.catch(()=>{});return operation;}
 private async refresh(owner:string){
  if(this.host.owner()!==owner)return;
  const runs=await this.host.runs(owner);if(this.host.owner()!==owner)return;
  const key='scheduled-notifications:'+owner,receipts=this.store.get<Record<string,string>>(key)??{},first=!this.initialized.has(owner),alerts:ScheduledRun[]=[];
  for(const run of runs){
   if(run.owner!==owner||!['completed','failed','held'].includes(run.status)||receipts[run.id]===run.status)continue;
   receipts[run.id]=run.status;
   const policy=run.snapshot.notifications??'important';
   if(!first&&policy!=='off'&&(policy==='all'||run.status!=='completed'))alerts.push(run);
  }
  await this.store.set(key,receipts);this.initialized.add(owner);
  if(this.host.owner()!==owner)return;
  for(const run of alerts){if(this.host.owner()!==owner||this.host.enabled?.(owner)===false)return;this.host.show(run.snapshot.name,run.status,run.conversationId??undefined,owner);}
 }
}
