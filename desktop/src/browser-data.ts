import {createHash} from 'node:crypto';
export type BrowserDownload={id:string;tabId:string;conversation?:string;scope?:'agent-draft-preview';name:string;origin:string;state:'choosing'|'downloading'|'paused'|'completed'|'cancelled'|'interrupted';received:number;total:number;startedAt:string;finishedAt?:string;path?:string;error?:string;resumable?:boolean};
export type BrowserData={rememberSignIns:boolean;downloads:BrowserDownload[]};
export type BrowserStore={get<T>(key:string):T|undefined;set(key:string,value:unknown):Promise<void>};
export const activeDownload=(row:BrowserDownload)=>['choosing','downloading','paused'].includes(row.state);
export function browserPartition(owner:string,persistent:boolean,canvas=false){if(!owner||owner.length>200)throw new Error('Invalid browser account.');return (persistent&&!canvas?'persist:':'')+'sylvana-'+(canvas?'canvas-':'browser-')+createHash('sha256').update(owner).digest('hex');}
export function downloadName(value:string){const safe=value.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'_').replace(/[. ]+$/,'').trim().slice(0,120).replace(/[\uD800-\uDBFF]$/,'').replace(/[. ]+$/,'');return !safe||/^\.{1,2}$/.test(safe)?'download':/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(safe)?'download-'+safe:safe;}
export class BrowserDataStore{
 private owners=new Map<string,BrowserData>();private tail:Promise<void>=Promise.resolve();private failures=new Map<string,string>();
 constructor(private store?:BrowserStore){}
 attach(store:BrowserStore){this.store=store;this.owners.clear();}
 get(owner:string){let data=this.owners.get(owner);if(!data){const saved=this.store?.get<BrowserData>('browser-data:'+owner),rows=Array.isArray(saved?.downloads)?saved.downloads:[];data={rememberSignIns:saved?.rememberSignIns!==false,downloads:rows.filter(row=>row&&/^[a-f0-9-]{36}$/i.test(row.id)&&typeof row.tabId==='string'&&typeof row.name==='string'&&typeof row.origin==='string'&&['choosing','downloading','paused','completed','cancelled','interrupted'].includes(row.state)&&Number.isFinite(row.received)&&Number.isFinite(row.total)).slice(0,50).map(row=>({...row,name:row.name.replace(/[\x00-\x1f\x7f]/g,'_').slice(0,1024),origin:row.origin.slice(0,500),path:typeof row.path==='string'?row.path:undefined,...(activeDownload(row)?{state:'interrupted' as const,resumable:false,error:'Sylvana closed before this download finished. Start it again from the website.'}:{})}))};this.owners.set(owner,data);}return data;}
 save(owner:string){const value=structuredClone(this.get(owner));const next=this.tail.catch(()=>{}).then(async()=>{await this.store?.set('browser-data:'+owner,value);this.failures.delete(owner);});this.tail=next.catch(error=>{this.failures.set(owner,(error as Error).message);});return next;}
 error(owner:string){return this.failures.get(owner)??'';}
 async flush(){await this.tail;if(this.failures.size)throw new Error('Browser history could not be saved. Keep Sylvana open and retry.');}
}
