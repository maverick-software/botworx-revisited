import type {Identity,PortableBackupStatus,PortableBackupResult} from './contracts';
import type {DisplaySnapshot} from './display-state';

type Host={
 identity:()=>Promise<Identity>;
 choose:()=>Promise<string|undefined>;
 locked:<T>(work:()=>Promise<T>)=>Promise<T>;
 flush:()=>Promise<void>;
 capture:(parent:string,progress:(message:string)=>void,display:DisplaySnapshot)=>Promise<PortableBackupResult>;
};
// Own the entire operation, including the folder dialog. Closing must wait before
// asking the renderer to save drafts, because the capture temporarily locks data.
export class BackupControl {
 private pending?:Promise<PortableBackupResult|undefined>;
 private closing=false;
 private state:PortableBackupStatus={phase:'idle',message:''};
 constructor(private host:Host){}
 get busy(){return !!this.pending;}
 status():PortableBackupStatus{return {...this.state};}
 start(display:DisplaySnapshot={}){
  if(this.closing)throw Error('Agentopia is closing. Reopen it before making a backup.');
  if(this.pending)throw Error('A backup is already in progress.');
  this.state={phase:'choosing',message:'Choose a private folder for your backup.'};
  const work=this.perform(structuredClone(display));this.pending=work;
  void work.finally(()=>{this.pending=undefined;this.state={phase:'idle',message:''};}).catch(()=>{});
  return work;
 }
 private async perform(display:DisplaySnapshot){
  const owner=await this.host.identity();if(!owner.admin)throw Error('Administrator access is required.');
  const parent=await this.host.choose();if(!parent)return;
  const guard=async()=>{const current=await this.host.identity();if(!current.admin||current.id!==owner.id)throw Error('Your account changed. Start the backup again.');};
  await guard();this.state={phase:'running',message:'Preparing a consistent backup…'};
  return this.host.locked(async()=>{await guard();await this.host.flush();await guard();return this.host.capture(parent,message=>{this.state={phase:'running',message};},display);});
 }
 async beforeClose(){this.closing=true;await this.pending?.catch(()=>{});}
 keepOpen(){this.closing=false;}
}
