import {randomUUID} from 'node:crypto';
import {agentId} from './agent-contracts';
import {redactCredentialText} from './terminal-runner';
import type {Secrets} from './secrets';

export type AgentReportSource={childRequestId:string;childInstanceId:string;parentRequestId:string;parentConversationId:string};
export type AgentReportDelivery=AgentReportSource&{
 status:'waiting'|'ready'|'running'|'delivered'|'acknowledged'|'held'|'cancelled';
 createdAt:string;updatedAt:string;attemptId?:string;dispatchStarted?:boolean;error?:string;
};
type ReportStore=Pick<Secrets,'get'|'set'>;
type ReportLaunch=(owner:string,rows:ReadonlyArray<AgentReportDelivery>,attemptId:string,signal:AbortSignal)=>Promise<void>;
/** The host may use this only while it can prove no native turn was submitted. */
export class AgentReportDeferred extends Error{}
/** A confirmed local failure before native turn/start was attempted. */
export class AgentReportNotSubmitted extends Error{}
const statuses=['waiting','ready','running','delivered','acknowledged','held','cancelled'];
const sourceKeys=['childRequestId','childInstanceId','parentRequestId','parentConversationId'] as const;
const inactive=new Set(['delivered','acknowledged','held','cancelled']);
const explanation=(error:unknown)=>redactCredentialText(error instanceof Error?error.message:String(error)).slice(0,2000);

/** Metadata only. Actual child output and execution authority must be read and
 * checked by the broker immediately before the existing Codex continuation.
 * Persist the dispatch marker before inference; uncertain attempts stay held.
 */
export class AgentReportQueue{
 private writes:Promise<unknown>=Promise.resolve();
 private processing=new Map<string,{owner:string;conversation:string;parent:string;controller:AbortController;done:Promise<void>}>();
 private timer?:NodeJS.Timeout;
 private closed=false;
 private owners=new Set<string>();
 private faults=new Map<string,string>();
 constructor(private store:ReportStore,private available:(owner:string,conversation:string,parentRequest:string)=>boolean,private launch:ReportLaunch,private changed:(owner:string,conversation:string)=>void=()=>{},private parallel=2){}
 private key(owner:string){return 'agent-reports:'+agentId(owner);}
 private source(value:AgentReportSource){
  for(const key of sourceKeys)agentId(value[key]);
  if(value.childRequestId===value.parentRequestId||value.childInstanceId===value.parentRequestId)throw Error('A specialist report must identify a separate assignment.');
  return Object.fromEntries(sourceKeys.map(key=>[key,value[key]])) as AgentReportSource;
 }
 private read(owner:string):AgentReportDelivery[]{
  const value=this.store.get<AgentReportDelivery[]>(this.key(owner))??[];
  if(!Array.isArray(value)||value.length>5000)throw Error('Saved specialist reports need inspection.');
  const seen=new Set<string>();
  for(const row of value){
   if(!row||typeof row!=='object'||Object.keys(row).some(key=>![...sourceKeys,'status','createdAt','updatedAt','attemptId','dispatchStarted','error'].includes(key as any)))throw Error('Invalid specialist report metadata.');
   this.source(row);
   if(seen.has(row.childRequestId)||!statuses.includes(row.status)||![row.createdAt,row.updatedAt].every(at=>typeof at==='string'&&Number.isFinite(Date.parse(at)))||row.error!==undefined&&(typeof row.error!=='string'||row.error.length>2000||explanation(row.error)!==row.error))throw Error('Invalid specialist report delivery.');
   if(row.attemptId!==undefined)agentId(row.attemptId);
   if(row.dispatchStarted!==undefined&&typeof row.dispatchStarted!=='boolean'||row.dispatchStarted&&!row.attemptId||row.status==='delivered'&&!row.dispatchStarted)throw Error('Invalid specialist report dispatch marker.');
   if(['running','delivered'].includes(row.status)&&!row.attemptId)throw Error('The specialist report is missing its dispatch receipt.');
   seen.add(row.childRequestId);
  }
  return structuredClone(value);
 }
 list(owner:string,parentRequest?:string){if(parentRequest)agentId(parentRequest);return this.read(owner).filter(row=>!parentRequest||row.parentRequestId===parentRequest);}
 fault(owner:string){return this.faults.get(agentId(owner));}
 recordFault(owner:string,error:unknown){agentId(owner);this.faults.set(owner,explanation(error));for(const job of this.processing.values())if(job.owner===owner)job.controller.abort();}
 get busy(){return this.processing.size>0;}
 private write<T>(task:()=>Promise<T>){const next=this.writes.then(task);this.writes=next.catch(()=>{});return next;}
 private async update(owner:string,match:(row:AgentReportDelivery)=>boolean,change:(row:AgentReportDelivery)=>AgentReportDelivery){
  const conversations=new Set<string>();
  await this.write(async()=>{const rows=this.read(owner);let touched=false;const next=rows.map(row=>{if(!match(row))return row;touched=true;conversations.add(row.parentConversationId);return change(row);});if(touched)await this.store.set(this.key(owner),next);});
  for(const conversation of conversations)this.changed(owner,conversation);
 }
 async watch(owner:string,input:AgentReportSource){
  if(this.closed)throw Error('Specialist reporting is closed.');const source=this.source(input);this.owners.add(agentId(owner));
  await this.write(async()=>{
   const rows=this.read(owner),prior=rows.find(row=>row.childRequestId===source.childRequestId);
   if(prior){if(sourceKeys.some(key=>prior[key]!==source[key]))throw Error('This specialist result is already bound to another parent.');return;}
   // Keep receipts rather than evicting them and permitting a late duplicate.
   if(rows.length>=5000)throw Error('The saved specialist-report limit was reached. Preserve its receipts before clearing history.');
   const at=new Date().toISOString();await this.store.set(this.key(owner),[...rows,{...source,status:'waiting',createdAt:at,updatedAt:at}]);
  });this.changed(owner,source.parentConversationId);
 }
 /** Internal recovery imports are derived from owned SQL watch markers and
  * actual native receipts. They never queue automatic inference on startup. */
 async adoptRecovered(owner:string,input:AgentReportDelivery){
  this.source(input);if(!['held','delivered','acknowledged','cancelled'].includes(input.status))throw Error('Recovered specialist reports must require review or already be terminal.');
  const probe={get:()=>[input],set:async()=>{}} as ReportStore;new AgentReportQueue(probe,()=>false,async()=>{}).list(owner);
  await this.write(async()=>{const rows=this.read(owner),prior=rows.find(row=>row.childRequestId===input.childRequestId);if(prior){if(sourceKeys.some(key=>prior[key]!==input[key]))throw Error('Recovered specialist report scope conflicts with its saved delivery.');const idle=!this.processing.has(owner+':'+prior.parentConversationId),receipt=input.status==='delivered'&&['held','running'].includes(prior.status)&&(!prior.attemptId||prior.attemptId===input.attemptId),terminal=['acknowledged','cancelled'].includes(input.status)&&['waiting','ready','held'].includes(prior.status);if(idle&&(receipt||terminal)){Object.assign(prior,structuredClone(input));if(!input.attemptId)delete prior.attemptId;if(!input.dispatchStarted)delete prior.dispatchStarted;if(!input.error)delete prior.error;await this.store.set(this.key(owner),rows);}return;}if(rows.length>=5000)throw Error('The saved specialist-report limit was reached.');await this.store.set(this.key(owner),[...rows,structuredClone(input)]);});
 }
 async ready(owner:string,childRequestId:string){
  agentId(childRequestId);await this.update(owner,row=>row.childRequestId===childRequestId&&row.status==='waiting',row=>({...row,status:'ready',updatedAt:new Date().toISOString()}));this.pump(owner);
 }
 async holdDelivery(owner:string,childRequestId:string,reason:string){
  agentId(childRequestId);await this.update(owner,row=>row.childRequestId===childRequestId&&['waiting','ready'].includes(row.status),row=>({...row,status:'held',error:explanation(reason),updatedAt:new Date().toISOString()}));
 }
 async acknowledge(owner:string,parentRequestId:string,childInstanceId:string){
  agentId(parentRequestId);agentId(childInstanceId);
  await this.update(owner,row=>row.parentRequestId===parentRequestId&&row.childInstanceId===childInstanceId&&['waiting','ready','held'].includes(row.status),row=>({...row,status:'acknowledged',updatedAt:new Date().toISOString()}));
 }
 async recover(owner:string){
  this.owners.add(agentId(owner));
  await this.update(owner,row=>!inactive.has(row.status),row=>({...row,status:'held',error:row.status==='running'?'Sylvana closed while reporting. Inspect the saved parent turn; this report was not replayed.':'Sylvana restarted. Review the specialist result before continuing its report.',updatedAt:new Date().toISOString()}));
 }
 async pauseOwner(owner:string,reason:string){
  for(const job of this.processing.values())if(job.owner===owner)job.controller.abort();
  try{await this.update(owner,row=>!inactive.has(row.status),row=>({...row,status:'held',error:explanation(reason),updatedAt:new Date().toISOString()}));}catch(error){this.recordFault(owner,error);}
 }
 async retryReviewed(owner:string,childRequestId:string,attemptId:string){
  agentId(childRequestId);agentId(attemptId);if(this.closed)throw Error('Specialist reporting is closed.');
  await this.write(async()=>{const rows=this.read(owner),row=rows.find(row=>row.childRequestId===childRequestId);if(!row||row.status!=='held'||row.attemptId!==attemptId||!row.dispatchStarted)throw Error('Inspect this exact saved report before retrying.');row.status='ready';delete row.error;delete row.attemptId;row.dispatchStarted=false;row.updatedAt=new Date().toISOString();await this.store.set(this.key(owner),rows);this.faults.delete(owner);});this.pump(owner);
 }
 async confirmDelivered(owner:string,childRequestId:string,attemptId:string){
  agentId(childRequestId);agentId(attemptId);
  await this.write(async()=>{const rows=this.read(owner),row=rows.find(row=>row.childRequestId===childRequestId);if(!row||!['held','running','delivered'].includes(row.status)||row.attemptId!==attemptId||!row.dispatchStarted)throw Error('This saved report receipt does not match its delivery.');row.status='delivered';delete row.error;row.updatedAt=new Date().toISOString();await this.store.set(this.key(owner),rows);});
 }
 async resumeUnsent(owner:string,childRequestId:string){
  if(this.closed)throw Error('Specialist reporting is closed.');agentId(childRequestId);this.owners.add(agentId(owner));
  await this.write(async()=>{const rows=this.read(owner),row=rows.find(row=>row.childRequestId===childRequestId);if(!row||row.status!=='held')throw Error('This specialist report is not waiting for review.');if(row.dispatchStarted)throw Error('This report may already have run. Inspect its saved parent continuation before explicitly retrying.');row.status='ready';delete row.error;row.updatedAt=new Date().toISOString();await this.store.set(this.key(owner),rows);this.faults.delete(owner);});this.pump(owner);
 }
 async holdParent(owner:string,parentRequestId:string,reason:string){
  agentId(parentRequestId);
  for(const job of this.processing.values())if(job.owner===owner&&job.parent===parentRequestId)job.controller.abort();
  await this.update(owner,row=>row.parentRequestId===parentRequestId&&!inactive.has(row.status),row=>({...row,status:'held',error:explanation(reason),updatedAt:new Date().toISOString()}));
 }
 async cancelParent(owner:string,parentRequestId:string){
  agentId(parentRequestId);
  for(const job of this.processing.values())if(job.owner===owner&&job.parent===parentRequestId)job.controller.abort();
  try{await this.update(owner,row=>row.parentRequestId===parentRequestId&&!['delivered','acknowledged','cancelled'].includes(row.status),row=>({...row,status:'cancelled',error:'The requesting assignment was stopped. No report will restart it.',updatedAt:new Date().toISOString()}));}catch(error){this.recordFault(owner,error);}
 }
 pump(owner:string){
  if(this.closed)return;this.owners.add(agentId(owner));
  void this.write(async()=>{
   if(this.closed||this.faults.has(owner)||this.processing.size>=this.parallel)return;
   const rows=this.read(owner),candidate=rows.find(row=>row.status==='ready'&&!this.processing.has(owner+':'+row.parentConversationId)&&this.available(owner,row.parentConversationId,row.parentRequestId));
   if(!candidate)return;
   const group=rows.filter(row=>row.status==='ready'&&row.parentRequestId===candidate.parentRequestId&&row.parentConversationId===candidate.parentConversationId).slice(0,16),attemptId=randomUUID(),at=new Date().toISOString();
   for(const row of group){row.status='running';row.attemptId=attemptId;row.dispatchStarted=false;row.updatedAt=at;delete row.error;}
   // A failed store write stops here, before the model/provider is reached.
   await this.store.set(this.key(owner),rows);
   const scope=owner+':'+candidate.parentConversationId,controller=new AbortController();let deferred=false;
   const done=Promise.resolve().then(async()=>{
    this.changed(owner,candidate.parentConversationId);
    try{
     if(this.closed||!this.available(owner,candidate.parentConversationId,candidate.parentRequestId))throw Error('The parent scope changed before report dispatch. Review the saved result.');
     controller.signal.throwIfAborted();await this.update(owner,row=>row.status==='running'&&row.attemptId===attemptId,row=>({...row,dispatchStarted:true,updatedAt:new Date().toISOString()}));
     controller.signal.throwIfAborted();await this.launch(owner,structuredClone(group.map(row=>({...row,dispatchStarted:true}))),attemptId,controller.signal);
     await this.update(owner,row=>row.status==='running'&&row.attemptId===attemptId,row=>({...row,status:'delivered',updatedAt:new Date().toISOString()}));
    }catch(error){
     deferred=error instanceof AgentReportDeferred&&!this.closed&&!controller.signal.aborted;const unsent=deferred||error instanceof AgentReportNotSubmitted;
     await this.update(owner,row=>row.status==='running'&&row.attemptId===attemptId,row=>deferred?{...row,status:'ready',attemptId:undefined,dispatchStarted:false,error:undefined,updatedAt:new Date().toISOString()}:{...row,status:'held',...(unsent?{attemptId:undefined,dispatchStarted:false}:{}),error:explanation(error),updatedAt:new Date().toISOString()});
    }
   }).catch(error=>{this.faults.set(owner,'Specialist report storage needs attention: '+explanation(error));this.changed(owner,candidate.parentConversationId);}).finally(()=>{this.processing.delete(scope);if(deferred)this.arm();else this.pump(owner);});
   this.processing.set(scope,{owner,conversation:candidate.parentConversationId,parent:candidate.parentRequestId,controller,done});
  }).catch(error=>{this.faults.set(owner,explanation(error));}).finally(()=>this.arm());
 }
 private arm(){
  if(this.closed||this.timer)return;
  let pending=false;for(const owner of this.owners){if(this.faults.has(owner))continue;try{pending=this.read(owner).some(row=>row.status==='ready')||pending;}catch(error){this.faults.set(owner,explanation(error));}}
  if(pending){this.timer=setTimeout(()=>{this.timer=undefined;for(const owner of this.owners)this.pump(owner);},500);this.timer.unref();}
 }
 async settled(){await this.writes;await Promise.all([...this.processing.values()].map(job=>job.done));await this.writes;}
 async quiesce(){await this.writes;if(this.busy)throw Error('Finish or stop specialist reporting before capturing recovery.');}
 async close(){
  this.closed=true;if(this.timer)clearTimeout(this.timer);this.timer=undefined;
  for(const job of this.processing.values())job.controller.abort();
  for(const owner of this.owners)try{await this.update(owner,row=>!inactive.has(row.status),row=>({...row,status:'held',error:'Sylvana closed. Inspect the saved parent and specialist before continuing.',updatedAt:new Date().toISOString()}));}catch(error){this.recordFault(owner,error);}
  await this.settled();
 }
}
