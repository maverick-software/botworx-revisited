import type {BrowserStore} from './browser-data';
import {browserAddress} from './browser-address';
export type SavedBrowserTab={id:string;conversation:string;url:string;title:string;updatedAt:string};
type SavedTabs={tabs:SavedBrowserTab[];closed:string[]};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
export class BrowserTabs{
 private owners=new Map<string,SavedTabs>();private tail:Promise<void>=Promise.resolve();private failures=new Map<string,string>();private updates=new Map<string,{owner:string;id:string;url:string;title:string;failed?:boolean}>();
 constructor(private store?:BrowserStore){}
 attach(store:BrowserStore){this.store=store;this.owners.clear();}
 private state(owner:string){let value=this.owners.get(owner);if(!value){const saved=this.store?.get<SavedTabs>('browser-tabs:'+owner);const tabs:SavedBrowserTab[]=[];for(const row of Array.isArray(saved?.tabs)?saved.tabs.slice(0,16):[]){try{if(!uuid(row?.id)||!uuid(row?.conversation)||tabs.some(t=>t.id===row.id))continue;tabs.push({id:row.id,conversation:row.conversation,url:browserAddress(row.url),title:typeof row.title==='string'?row.title.slice(0,240):'',updatedAt:Number.isFinite(Date.parse(row.updatedAt))?row.updatedAt:new Date(0).toISOString()});}catch{/* Invalid records cannot restore a privileged or foreign page. */}}value={tabs,closed:[...new Set((Array.isArray(saved?.closed)?saved.closed:[]).filter(uuid))].slice(-1024)};value.tabs=value.tabs.filter(t=>!value!.closed.includes(t.id));this.owners.set(owner,value);}return value;}
 list(owner:string,conversation?:string){return this.state(owner).tabs.filter(t=>!conversation||t.conversation===conversation).map(t=>({...t}));}
 get(owner:string,id:string){return this.list(owner).find(t=>t.id===id);}
 closed(owner:string,id:string){return this.state(owner).closed.includes(id);}
 private commit(owner:string,change:(value:SavedTabs)=>SavedTabs){const next=this.tail.catch(()=>{}).then(async()=>{const value=change(structuredClone(this.state(owner)));await this.store?.set('browser-tabs:'+owner,value);this.owners.set(owner,value);this.failures.delete(owner);});this.tail=next.catch(error=>{this.failures.set(owner,(error as Error).message);});return next;}
 async put(owner:string,row:SavedBrowserTab){if(!uuid(row.id)||!uuid(row.conversation))throw new Error('Invalid agent browser tab.');const safe={...row,url:browserAddress(row.url),title:row.title.slice(0,240)};await this.commit(owner,value=>{if(!value.tabs.some(t=>t.id===row.id)&&value.tabs.length>=16)throw new Error('Close a saved agent browser tab before opening another.');return {tabs:[...value.tabs.filter(t=>t.id!==row.id),safe],closed:value.closed.filter(id=>id!==row.id)};});}
 async update(owner:string,id:string,url:string,title:string){const update:{owner:string;id:string;url:string;title:string;failed?:boolean}={owner,id,url:browserAddress(url),title:title.slice(0,240)},key=owner+':'+id;this.updates.set(key,update);try{await this.commit(owner,value=>{const previous=value.tabs.find(t=>t.id===id);if(previous){previous.url=update.url;previous.title=update.title;previous.updatedAt=new Date().toISOString();}return value;});}catch(error){update.failed=true;throw error;}if(this.updates.get(key)===update)this.updates.delete(key);}
 async forget(owner:string,id:string){if(!uuid(id))throw new Error('Invalid browser tab.');await this.commit(owner,value=>({tabs:value.tabs.filter(t=>t.id!==id),closed:[...value.closed.filter(v=>v!==id),id].slice(-1024)}));this.updates.delete(owner+':'+id);}
 save(owner:string){return this.commit(owner,value=>value);}
 error(owner:string){return (this.failures.has(owner)||[...this.updates.values()].some(update=>update.owner===owner&&update.failed))?'The latest agent browser tab state could not be saved. Keep Agentopia open and retry saving.':'';}
 async flush(){await this.tail;for(const pending of [...this.updates.values()])await this.update(pending.owner,pending.id,pending.url,pending.title);for(const owner of [...this.failures.keys()])await this.save(owner);await this.tail;if(this.failures.size)throw new Error('Agent browser tabs could not be saved.');}
}
